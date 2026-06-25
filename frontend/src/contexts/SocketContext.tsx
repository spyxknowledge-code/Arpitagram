import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import io, { Socket } from 'socket.io-client';
import { AuthContext } from './AuthContext';

type SocketContextType = {
  socket: Socket | null;
};

export const SocketContext = createContext<SocketContextType>({} as SocketContextType);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useContext(AuthContext);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (token) {
      const sock = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
        auth: { token },
      });
      setSocket(sock);
      return () => { sock.disconnect(); };
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
