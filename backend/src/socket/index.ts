import { Server as SocketServer, Socket } from 'socket.io';
import { pool } from '../db/pool';
import jwt from 'jsonwebtoken';

interface SocketWithUser extends Socket {
  userId?: number;
  username?: string;
  currentRoom?: string;
}

export const initSocket = (io: SocketServer) => {
  io.use(async (socket: SocketWithUser, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
      const result = await pool.query('SELECT id, username FROM users WHERE id = $1', [decoded.userId]);
      if (result.rows.length === 0) return next(new Error('User not found'));
      socket.userId = result.rows[0].id;
      socket.username = result.rows[0].username;
      next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: SocketWithUser) => {
    if (!socket.userId) return socket.disconnect();

    socket.on('join-room', async ({ roomId }) => {
      if (!roomId) return;
      const roomResult = await pool.query('SELECT id FROM rooms WHERE room_id = $1', [roomId]);
      if (roomResult.rows.length === 0) {
        socket.emit('error', 'Room not found');
        return;
      }
      const roomDbId = roomResult.rows[0].id;
      const member = await pool.query(
        'SELECT 1 FROM room_members WHERE user_id = $1 AND room_id = $2',
        [socket.userId, roomDbId]
      );
      if (member.rows.length === 0) {
        socket.emit('error', 'Not a member');
        return;
      }
      socket.join(roomId);
      socket.currentRoom = roomId;
      socket.emit('room-joined', { roomId, success: true });

      socket.to(roomId).emit('user-joined', { username: socket.username });

      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      const count = roomSockets ? roomSockets.size : 0;
      io.to(roomId).emit('room-users', { count });
    });

    socket.on('typing', ({ roomId, isTyping }) => {
      socket.to(roomId).emit('typing', { userId: socket.userId, username: socket.username, isTyping });
    });

    socket.on('room-message', async ({ roomId, encryptedContent, iv, salt, replyToId }) => {
      const sentAt = new Date();
      const roomResult = await pool.query('SELECT id FROM rooms WHERE room_id = $1', [roomId]);
      if (roomResult.rows.length === 0) {
        socket.emit('error', 'Room not found');
        return;
      }
      const roomDbId = roomResult.rows[0].id;
      const result = await pool.query(
        `INSERT INTO messages (room_id, sender_id, encrypted_content, iv, salt, reply_to_id, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [roomDbId, socket.userId, encryptedContent, iv, salt, replyToId || null, sentAt]
      );
      const msgId = result.rows[0].id;

      const messageData = {
        id: msgId,
        senderId: socket.userId,
        senderName: socket.username,
        encryptedContent,
        iv,
        salt,
        replyToId,
        sentAt: sentAt.toISOString(),
        delivered: false,
        read: false,
      };

      io.to(roomId).emit('new-message', messageData);
    });

    socket.on('mark-delivered', ({ messageId, roomId }) => {
      pool.query('UPDATE messages SET delivered_at = NOW() WHERE id = $1', [messageId]);
      socket.to(roomId).emit('delivered-receipt', { messageId });
    });

    socket.on('mark-read', ({ messageId, roomId }) => {
      pool.query('UPDATE messages SET read_at = NOW() WHERE id = $1', [messageId]);
      socket.to(roomId).emit('read-receipt', { messageId });
    });

    socket.on('delete-message', ({ messageId, roomId }) => {
      pool.query('UPDATE messages SET is_deleted = true WHERE id = $1 AND sender_id = $2', [messageId, socket.userId]);
      socket.to(roomId).emit('message-deleted', { messageId });
    });

    socket.on('disconnect', () => {
      console.log(`User ${socket.username} disconnected`);
    });
  });
};
