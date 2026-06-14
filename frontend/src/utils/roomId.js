import { nanoid } from 'nanoid';

/**
 * Generates a random 8-character string to use as a unique room ID.
 * 
 * @returns {string} The generated room ID.
 */
export function generateRoomId() {
  return nanoid(8);
}
