import { useState, useContext } from 'react';
import { useRouter } from 'next/router';
import { AuthContext } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';

export default function CreateRoom() {
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { token } = useContext(AuthContext);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !password) {
      setError('Room ID and password required');
      return;
    }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/rooms/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create room');
        return;
      }
      // Store room password and salt temporarily for encryption
      sessionStorage.setItem('roomPass', password);
      sessionStorage.setItem('roomSalt', data.salt);
      router.push(`/room/${roomId}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass p-8 rounded-2xl max-w-md w-full backdrop-blur-lg border border-white/20"
      >
        <h2 className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
          Create Room
        </h2>
        <form onSubmit={handleCreate} className="mt-6 space-y-4">
          <input
            type="text"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
          <input
            type="text"
            placeholder="Room Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            type="password"
            placeholder="Room Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold rounded-lg shadow-lg"
          >
            Create & Join
          </motion.button>
        </form>
        <p className="text-center mt-4">
          <span
            onClick={() => router.push('/home')}
            className="text-purple-400 cursor-pointer hover:underline"
          >
            ← Back
          </span>
        </p>
      </motion.div>
    </div>
  );
                              }
