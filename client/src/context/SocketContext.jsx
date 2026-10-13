import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useToast } from '@chakra-ui/react';
import { useLocation } from 'react-router-dom';
import { API_BASE } from '../services/api';
import { NotificationAPI } from '../services/endpoints';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

/**
 * One authenticated Socket.IO connection per session. Also owns the
 * notification inbox so the bell badge updates in real time.
 */
export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const toast = useToast();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);

  useEffect(() => {
    if (!token || !user) return undefined;
    const s = io(API_BASE || undefined, { auth: { token }, transports: ['websocket', 'polling'], reconnectionDelayMax: 5000 });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('notification:new', (n) => {
      setNotifications((prev) => [n, ...prev].slice(0, 30));
      setUnread((u) => u + 1);
      // The page being viewed already shows this update live; the bell still records it.
      if (n.link && n.link === pathRef.current && n.type !== 'sos') return;
      const id = `n-${n.title}`;
      if (toastRef.current.isActive(id)) return;
      toastRef.current({
        id,
        title: n.title, description: n.body,
        status: n.type === 'sos' || /fail|declin|no drivers/i.test(n.title) ? 'error' : n.type === 'payment' ? 'success' : 'info',
        position: 'top-right', duration: 5000, isClosable: true,
      });
    });
    setSocket(s);
    return () => { s.disconnect(); setSocket(null); setConnected(false); };
  }, [token, user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadNotifications = useCallback(async () => {
    const { data, meta } = await NotificationAPI.list({ limit: 30 });
    setNotifications(data);
    setUnread(meta.unread);
  }, []);

  useEffect(() => { if (user) loadNotifications().catch(() => {}); }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = useCallback(async (id) => {
    await NotificationAPI.read(id);
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await NotificationAPI.readAll();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  }, []);

  const value = useMemo(() => ({ socket, connected, notifications, unread, markRead, markAllRead, loadNotifications }),
    [socket, connected, notifications, unread, markRead, markAllRead, loadNotifications]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);

/** Subscribe to a socket event for the lifetime of a component. */
export function useSocketEvent(event, handler) {
  const { socket } = useSocket();
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => {
    if (!socket) return undefined;
    const fn = (payload) => ref.current(payload);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}
