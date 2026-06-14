import { io } from 'socket.io-client';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001';

// Create a single shared socket instance for the entire application lifecycle
const socket = io(SIGNALING_URL);

/**
 * Hook to return the shared Socket.io connection.
 */
export function useSocket() {
  return socket;
}
