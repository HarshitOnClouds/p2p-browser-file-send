const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { nanoid } = require('nanoid');
const roomManager = require('./roomManager');

const app = express();
const server = http.createServer(app);

// Use CORS from env or default to Vite's local dev port
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({
  origin: CLIENT_ORIGIN
}));

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // CLIENT -> SERVER: "create-room"
  // Note: This does not handle file data.
  socket.on('create-room', () => {
    const roomId = nanoid(8);
    roomManager.createRoom(roomId, socket.id);
    socket.join(roomId);
    socket.emit('room-created', { roomId });
    console.log(`Room created: ${roomId} by ${socket.id}`);
  });

  // CLIENT -> SERVER: "join-room"
  // Note: This does not handle file data.
  socket.on('join-room', ({ roomId }) => {
    const success = roomManager.joinRoom(roomId, socket.id);
    if (success) {
      socket.join(roomId);
      // Emit 'peer-joined' to the sender
      const senderSocketId = roomManager.getOtherPeer(roomId, socket.id);
      if (senderSocketId) {
        io.to(senderSocketId).emit('peer-joined');
      }
      console.log(`Socket ${socket.id} joined room: ${roomId}`);
    } else {
      socket.emit('room-error', { message: 'Room not found or full' });
    }
  });

  socket.on('leave-room', () => {
    const result = roomManager.removeSocket(socket.id);
    if (result) {
      io.to(result.remainingPeer).emit('peer-disconnected');
    }
    socket.rooms.forEach(room => {
      if (room !== socket.id) socket.leave(room);
    });
  });

  // CLIENT -> SERVER: "offer"
  // Note: This relays the WebRTC SDP offer. It does not handle file data.
  socket.on('offer', ({ roomId, sdp }) => {
    const otherPeer = roomManager.getOtherPeer(roomId, socket.id);
    if (otherPeer) {
      io.to(otherPeer).emit('offer', { sdp });
    }
  });

  // CLIENT -> SERVER: "answer"
  // Note: This relays the WebRTC SDP answer. It does not handle file data.
  socket.on('answer', ({ roomId, sdp }) => {
    const otherPeer = roomManager.getOtherPeer(roomId, socket.id);
    if (otherPeer) {
      io.to(otherPeer).emit('answer', { sdp });
    }
  });

  // CLIENT -> SERVER: "ice-candidate"
  // Note: This relays WebRTC ICE candidates. It does not handle file data.
  socket.on('ice-candidate', ({ roomId, candidate }) => {
    const otherPeer = roomManager.getOtherPeer(roomId, socket.id);
    if (otherPeer) {
      io.to(otherPeer).emit('ice-candidate', { candidate });
    }
  });

  // CLIENT -> SERVER: "disconnect"
  // Note: Cleans up the room. It does not handle file data.
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const disconnectInfo = roomManager.removeSocket(socket.id);
    if (disconnectInfo && disconnectInfo.remainingPeer) {
      io.to(disconnectInfo.remainingPeer).emit('peer-disconnected');
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
