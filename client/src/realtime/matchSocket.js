import { io } from 'socket.io-client';

let socket;

export const getMatchSocket = () => {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:5000', {
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });
  }
  return socket;
};
