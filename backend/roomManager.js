// Room state tracker
// Maps roomId -> { senderSocketId, receiverSocketId }
const rooms = new Map();

/**
 * Stores the sender socket ID for a given room.
 */
function createRoom(roomId, socketId) {
  rooms.set(roomId, { senderSocketId: socketId, receiverSocketId: null });
}

/**
 * Stores the receiver socket ID for a given room if it exists and has space.
 * Returns true if successful, false otherwise.
 */
function joinRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return false;
  if (room.receiverSocketId) return false; // Room is full

  room.receiverSocketId = socketId;
  rooms.set(roomId, room);
  return true;
}

/**
 * Returns the other socket ID in the room given one socket ID.
 */
function getOtherPeer(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  if (room.senderSocketId === socketId) {
    return room.receiverSocketId;
  }
  if (room.receiverSocketId === socketId) {
    return room.senderSocketId;
  }
  return null;
}

/**
 * Scans all rooms to remove the given socket ID.
 * Returns { roomId, remainingPeer } if the socket was part of a room, for disconnect relay.
 */
function removeSocket(socketId) {
  for (const [roomId, room] of rooms.entries()) {
    if (room.senderSocketId === socketId || room.receiverSocketId === socketId) {
      const remainingPeer = getOtherPeer(roomId, socketId);
      rooms.delete(roomId); // Disband the room if either peer disconnects
      return { roomId, remainingPeer };
    }
  }
  return null;
}

/**
 * Checks if a room exists.
 */
function roomExists(roomId) {
  return rooms.has(roomId);
}

module.exports = {
  createRoom,
  joinRoom,
  getOtherPeer,
  removeSocket,
  roomExists
};
