import { useEffect, useState, useRef, useContext } from 'react';
import { useRouter } from 'next/router';
import { AuthContext } from '../../contexts/AuthContext';
import { SocketContext } from '../../contexts/SocketContext';
import { decryptMessage, encryptMessage } from '../../lib/encryption';
import { motion, AnimatePresence } from 'framer-motion';

export default function Room() {
  const router = useRouter();
  const { roomId } = router.query as { roomId: string };
  const { user, token } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [roomKey, setRoomKey] = useState<CryptoKey | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineCount, setOnlineCount] = useState(1);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derive room key from password (PBKDF2) – stored in sessionStorage
  useEffect(() => {
    const deriveKey = async () => {
      const password = sessionStorage.getItem('roomPass');
      const salt = sessionStorage.getItem('roomSalt');
      if (!password || !salt) {
        router.push('/home');
        return;
      }
      const enc = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      const key = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: enc.encode(salt),
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      setRoomKey(key);
    };
    deriveKey();
  }, []);

  // Socket events
  useEffect(() => {
    if (!socket || !roomKey || !roomId) return;

    socket.emit('join-room', { roomId });

    socket.on('room-joined', async () => {
      // Fetch messages
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/rooms/${roomId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const decrypted = await Promise.all(
        data.map(async (msg: any) => {
          if (msg.is_deleted) return { ...msg, content: '[deleted]' };
          const plain = await decryptMessage(roomKey, msg.encrypted_content, msg.iv, msg.salt);
          return { ...msg, content: plain };
        })
      );
      setMessages(decrypted);
    });

    socket.on('new-message', async (msg) => {
      if (msg.senderId !== user?.id) {
        const plain = await decryptMessage(roomKey, msg.encrypted_content, msg.iv, msg.salt);
        const newMsg = { ...msg, content: plain, isMine: false };
        setMessages(prev => [...prev, newMsg]);
        socket.emit('mark-delivered', { messageId: msg.id, roomId });
      }
    });

    socket.on('typing', ({ username, isTyping }) => {
      setTypingUsers(prev => {
        if (isTyping) {
          if (!prev.includes(username)) return [...prev, username];
          return prev;
        } else {
          return prev.filter(u => u !== username);
        }
      });
    });

    socket.on('room-users', ({ count }) => setOnlineCount(count));
    socket.on('delivered-receipt', ({ messageId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, delivered: true } : m));
    });
    socket.on('read-receipt', ({ messageId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, read: true } : m));
    });
    socket.on('message-deleted', ({ messageId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: '[deleted]', is_deleted: true } : m));
    });

    return () => {
      socket.off('room-joined');
      socket.off('new-message');
      socket.off('typing');
      socket.off('room-users');
      socket.off('delivered-receipt');
      socket.off('read-receipt');
      socket.off('message-deleted');
    };
  }, [socket, roomKey, roomId]);

  const sendMessage = async () => {
    if (!input.trim() || !roomKey || !roomId) return;
    const { ciphertext, iv, salt } = await encryptMessage(roomKey, input);
    const tempId = Date.now();
    const msgObj = {
      id: tempId,
      senderId: user?.id,
      senderName: user?.username,
      content: input,
      isMine: true,
      sentAt: new Date().toISOString(),
      delivered: false,
      read: false,
      reply_to_id: replyTo,
      is_deleted: false,
    };
    setMessages(prev => [...prev, msgObj]);
    setInput('');
    setReplyTo(null);
    socket.emit('room-message', {
      roomId,
      encryptedContent: ciphertext,
      iv,
      salt,
      replyToId: replyTo,
    });
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Typing indicator
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleTyping = () => {
      if (socket && roomId) {
        socket.emit('typing', { roomId, isTyping: true });
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          socket.emit('typing', { roomId, isTyping: false });
        }, 1000);
      }
    };
    const inputEl = document.getElementById('messageInput');
    inputEl?.addEventListener('input', handleTyping);
    return () => {
      inputEl?.removeEventListener('input', handleTyping);
      clearTimeout(timeout);
    };
  }, [socket, roomId]);

  const handleDelete = (messageId: number) => {
    if (confirm('Delete this message?')) {
      socket.emit('delete-message', { messageId, roomId });
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: '[deleted]', is_deleted: true } : m));
    }
  };

  const handleReply = (messageId: number) => {
    setReplyTo(messageId);
    document.getElementById('messageInput')?.focus();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col">
      {/* Header */}
      <div className="glass p-4 flex justify-between items-center border-b border-white/10">
        <div>
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
            {roomId}
          </h2>
          <p className="text-sm text-gray-400">
            👤 {onlineCount} online
          </p>
        </div>
        <button
          onClick={() => router.push('/home')}
          className="px-4 py-2 bg-white/10 rounded-lg text-gray-300 hover:bg-white/20 transition"
        >
          Leave
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs p-3 rounded-2xl ${
                msg.isMine
                  ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                  : 'glass text-white'
              } ${msg.is_deleted ? 'opacity-50' : ''}`}
            >
              {!msg.isMine && (
                <p className="text-xs text-purple-300 font-bold">{msg.senderName}</p>
              )}
              <p>{msg.content}</p>
              <div className="flex justify-between items-center mt-1 text-xs opacity-70">
                <span>{new Date(msg.sentAt).toLocaleTimeString()}</span>
                {msg.isMine && (
                  <span>
                    {msg.read ? '✓✓ Read' : msg.delivered ? '✓✓ Delivered' : '✓ Sent'}
                  </span>
                )}
              </div>
              {msg.reply_to_id && (
                <div className="text-xs border-l-2 border-purple-400 pl-2 mt-1 opacity-60">
                  ↳ Reply to #{msg.reply_to_id}
                </div>
              )}
              {!msg.is_deleted && (
                <div className="flex gap-2 mt-1">
                  {!msg.isMine && (
                    <button
                      onClick={() => handleReply(msg.id)}
                      className="text-xs text-purple-300 hover:text-purple-100"
                    >
                      Reply
                    </button>
                  )}
                  {msg.isMine && (
                    <button
                      onClick={() => handleDelete(msg.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {typingUsers.length > 0 && (
          <div className="text-sm text-gray-400 italic">
            {typingUsers.join(', ')} typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="glass p-4 border-t border-white/10">
        {replyTo && (
          <div className="text-xs text-purple-400 mb-2 flex justify-between">
            <span>Replying to message #{replyTo}</span>
            <button onClick={() => setReplyTo(null)} className="text-red-400">✕</button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            id="messageInput"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={sendMessage}
            className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold rounded-lg"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
                                   }
