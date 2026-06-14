import { io } from 'socket.io-client';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001';

let userId = localStorage.getItem('p2p_userId');
if (!userId) {
  userId = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  localStorage.setItem('p2p_userId', userId);
}

// Create a single shared socket instance for the entire application lifecycle
const socket = io(SIGNALING_URL, {
  auth: {
    userId
  }
});

/**
 * Hook to return the shared Socket.io connection.
 */
export function useSocket() {
  return socket;
}
