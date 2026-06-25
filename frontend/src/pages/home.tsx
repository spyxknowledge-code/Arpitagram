import { useContext, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AuthContext } from '../contexts/AuthContext';
import { motion } from 'framer-motion';

export default function Home() {
  const router = useRouter();
  const { user, logout } = useContext(AuthContext);

  useEffect(() => {
    if (!user) router.push('/');
  }, [user]);

  if (!user) return null;

  const handleCreateRoom = () => {
    router.push('/room/create');
  };

  const handleJoinRoom = () => {
    router.push('/room/join');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col items-center justify-center p-4">
      <motion.h1
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 mb-8"
      >
        ARPITAGRAM
      </motion.h1>
      <p className="text-gray-400 mb-6">Welcome, {user.username}</p>
      <div className="w-full max-w-sm space-y-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleCreateRoom}
          className="w-full py-6 text-xl font-bold rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg shadow-purple-500/50 text-white transform transition-all duration-200"
        >
          ✨ Create Room
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleJoinRoom}
          className="w-full py-6 text-xl font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 shadow-lg shadow-indigo-500/50 text-white transform transition-all duration-200"
        >
          🔑 Join Room
        </motion.button>
        <button
          onClick={logout}
          className="w-full py-3 text-gray-400 hover:text-white border border-gray-700 rounded-lg transition"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
