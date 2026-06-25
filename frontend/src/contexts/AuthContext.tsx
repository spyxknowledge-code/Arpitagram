import React, { createContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

type AuthContextType = {
  user: { id: number; username: string } | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    headers: { 'Content-Type': 'application/json' },
  });

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password });
    const { token, userId, username: name } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({ id: userId, username: name }));
    setToken(token);
    setUser({ id: userId, username: name });
  };

  const signup = async (username: string, password: string) => {
    const res = await api.post('/auth/signup', { username, password });
    const { token, userId, username: name } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({ id: userId, username: name }));
    setToken(token);
    setUser({ id: userId, username: name });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
