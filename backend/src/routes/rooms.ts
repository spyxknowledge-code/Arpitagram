import express from 'express';
import { authenticate } from '../middleware/auth';
import { pool } from '../db/pool';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const router = express.Router();

// Create room
router.post('/create', authenticate, async (req, res) => {
  const { roomId, password, name } = req.body;
  const userId = (req as any).user.id;
  if (!roomId || !password) return res.status(400).json({ error: 'Room ID and password required' });

  const exists = await pool.query('SELECT id FROM rooms WHERE room_id = $1', [roomId]);
  if (exists.rows.length > 0) return res.status(409).json({ error: 'Room ID already taken' });

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = bcrypt.hashSync(password + salt, 10);
  const result = await pool.query(
    `INSERT INTO rooms (room_id, name, password_hash, salt, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [roomId, name || roomId, hash, salt, userId]
  );
  const roomDbId = result.rows[0].id;
  await pool.query('INSERT INTO room_members (user_id, room_id) VALUES ($1, $2)', [userId, roomDbId]);

  res.json({ success: true, roomId, salt });
});

// Join room
router.post('/join', authenticate, async (req, res) => {
  const { roomId, password } = req.body;
  const userId = (req as any).user.id;
  if (!roomId || !password) return res.status(400).json({ error: 'Room ID and password required' });

  const room = await pool.query('SELECT id, password_hash, salt FROM rooms WHERE room_id = $1', [roomId]);
  if (room.rows.length === 0) return res.status(404).json({ error: 'Room not found' });

  const valid = bcrypt.compareSync(password + room.rows[0].salt, room.rows[0].password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid password' });

  await pool.query('INSERT INTO room_members (user_id, room_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
    userId, room.rows[0].id
  ]);

  res.json({ success: true, roomId, salt: room.rows[0].salt });
});

// Get messages
router.get('/:roomId/messages', authenticate, async (req, res) => {
  const { roomId } = req.params;
  const userId = (req as any).user.id;

  const member = await pool.query(
    `SELECT 1 FROM room_members rm
     JOIN rooms r ON rm.room_id = r.id
     WHERE r.room_id = $1 AND rm.user_id = $2`,
    [roomId, userId]
  );
  if (member.rows.length === 0) return res.status(403).json({ error: 'Not a member' });

  const messages = await pool.query(
    `SELECT m.*, u.username as sender_name
     FROM messages m
     LEFT JOIN users u ON m.sender_id = u.id
     WHERE m.room_id = (SELECT id FROM rooms WHERE room_id = $1)
     ORDER BY m.sent_at ASC`,
    [roomId]
  );
  res.json(messages.rows);
});

// Search messages
router.post('/search', authenticate, async (req, res) => {
  const { roomId, query } = req.body;
  const userId = (req as any).user.id;
  const member = await pool.query(
    `SELECT 1 FROM room_members rm
     JOIN rooms r ON rm.room_id = r.id
     WHERE r.room_id = $1 AND rm.user_id = $2`,
    [roomId, userId]
  );
  if (member.rows.length === 0) return res.status(403).json({ error: 'Not a member' });

  const messages = await pool.query(
    `SELECT m.*, u.username as sender_name
     FROM messages m
     LEFT JOIN users u ON m.sender_id = u.id
     WHERE m.room_id = (SELECT id FROM rooms WHERE room_id = $1)
       AND m.encrypted_content ILIKE $2
     ORDER BY m.sent_at ASC`,
    [roomId, `%${query}%`]
  );
  res.json(messages.rows);
});

export default router;
