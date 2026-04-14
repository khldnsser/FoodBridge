import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '../api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  socket: Socket | null;
  setToken: (t: string) => void;
  setUser: (u: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>(null!);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  const setToken = (t: string) => {
    localStorage.setItem('token', t);
    setTokenState(t);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setTokenState(null);
    setUser(null);
    socket?.disconnect();
    setSocket(null);
  };

  const refreshUser = async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
  };

  useEffect(() => {
    if (!token) { setLoading(false); return; }

    api.get('/auth/me').then(({ data }) => {
      setUser(data.user);

      // Connect socket
      const s = io('http://localhost:3001', { auth: { token }, transports: ['websocket'] });
      setSocket(s);
    }).catch(() => {
      logout();
    }).finally(() => setLoading(false));
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, socket, setToken, setUser, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
