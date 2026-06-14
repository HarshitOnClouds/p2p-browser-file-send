// Room state tracker
// Maps roomId -> { senderSocketId, senderUserId, receiverSocketId, receiverUserId }
const rooms = new Map();

/**
 * Stores the sender socket ID and user ID for a given room.
 */
function createRoom(roomId, socketId, userId) {
  const id = roomId || Math.random().toString(36).substring(2, 9);
  rooms.set(id, { senderSocketId: socketId, senderUserId: userId, receiverSocketId: null, receiverUserId: null });
  return id;
}

/**
 * Allows a Sender to reclaim their room if they refresh the page.
 */
function claimRoom(roomId, socketId, userId) {
  const room = rooms.get(roomId);
  if (room && room.senderUserId === userId) {
    room.senderSocketId = socketId;
    rooms.set(roomId, room);
    return true;
  }
  return false;
}

/**
 * Stores the receiver socket ID and user ID for a given room if it exists and has space.
 * Returns true if successful, false otherwise.
 */
function joinRoom(roomId, socketId, userId) {
  const room = rooms.get(roomId);
  if (!room) return false;
  
  // If this user is already the receiver, just update their socket ID
  if (room.receiverUserId === userId) {
    room.receiverSocketId = socketId;
    rooms.set(roomId, room);
    return true;
  }
  
  // If the room is full with someone else
  if (room.receiverSocketId && room.receiverUserId !== userId) {
    return false;
  }

  room.receiverUserId = userId;
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
 * Removes the socket from the room but keeps the room alive for rejoining,
 * unless it's explicitly disbanded.
 */
function removeSocket(socketId) {
  for (const [roomId, room] of rooms.entries()) {
    if (room.senderSocketId === socketId) {
      const remainingPeer = room.receiverSocketId;
      // We no longer delete the room immediately on sender disconnect,
      // giving them a chance to refresh and `claimRoom`.
      // We just clear their active socket.
      room.senderSocketId = null;
      rooms.set(roomId, room);
      return { roomId, remainingPeer };
    } else if (room.receiverSocketId === socketId) {
      const remainingPeer = room.senderSocketId;
      room.receiverSocketId = null; // Receiver left, keep room open for rejoin
      rooms.set(roomId, room);
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
  claimRoom,
  joinRoom,
  getOtherPeer,
  removeSocket,
  roomExists
};
