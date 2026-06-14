const fs = require('fs');
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

function logToFile(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  fs.appendFileSync('debug.log', line);
}

io.on('connection', (socket) => {
  const userId = socket.handshake.auth?.userId;
  logToFile(`[CONNECT] Socket: ${socket.id} | User: ${userId}`);


  socket.on('create-room', (data) => {
    let roomId = data?.roomId;
    logToFile(`[CREATE-ROOM] Socket: ${socket.id} | User: ${userId} | Requested Room: ${roomId}`);
    
    // Check if the user is reclaiming a room they already own
    if (roomId && roomManager.claimRoom(roomId, socket.id, userId)) {
      logToFile(`[CLAIM-ROOM] Success! Sender ${userId} reclaimed room ${roomId}`);
      socket.join(roomId);
      
      const receiverSocketId = roomManager.getOtherPeer(roomId, socket.id);
      if (receiverSocketId) {
        logToFile(`[CLAIM-ROOM] Receiver is already here! Emitting peer-joined to Sender.`);
        socket.emit('peer-joined');
      }
      return;
    }
    
    roomId = roomManager.createRoom(roomId, socket.id, userId);
    logToFile(`[CREATE-ROOM] New room generated: ${roomId}`);
    socket.join(roomId);
    socket.emit('room-created', { roomId });
  });


  socket.on('join-room', ({ roomId }) => {
    logToFile(`[JOIN-ROOM] Socket: ${socket.id} | User: ${userId} | Room: ${roomId}`);
    const success = roomManager.joinRoom(roomId, socket.id, userId);
    logToFile(`[JOIN-ROOM] Success: ${success}`);
    if (success) {
      socket.join(roomId);
      // Emit 'peer-joined' to the sender
      const senderSocketId = roomManager.getOtherPeer(roomId, socket.id);
      logToFile(`[JOIN-ROOM] Emitting peer-joined to Sender Socket: ${senderSocketId}`);
      if (senderSocketId) {
        io.to(senderSocketId).emit('peer-joined');
      }
      logToFile(`Socket ${socket.id} joined room: ${roomId}`);
    } else {
      logToFile(`[JOIN-ROOM] Failed! Room full or missing.`);
      socket.emit('room-error', { message: 'Room not found or full' });
    }
  });

  socket.on('resume-from', ({ roomId, fromChunk }) => {
    logToFile(`[RESUME-FROM] Socket: ${socket.id} | User: ${userId} | Room: ${roomId} | Chunk: ${fromChunk}`);
    const success = roomManager.joinRoom(roomId, socket.id, userId);
    if (success) {
      socket.join(roomId);
      const senderSocketId = roomManager.getOtherPeer(roomId, socket.id);
      if (senderSocketId) {
        io.to(senderSocketId).emit('peer-joined');
        io.to(senderSocketId).emit('resume-transfer', { fromChunk });
      }
    } else {
      socket.emit('room-error', { message: 'Room not found or full' });
    }
  });

  socket.on('leave-room', (data) => {
    const roomId = data?.roomId;
    logToFile(`[LEAVE-ROOM] Socket: ${socket.id} | User: ${userId} | Room: ${roomId}`);
    if (roomId) {
      socket.leave(roomId);
    }
    const result = roomManager.removeSocket(socket.id);
    if (result && result.remainingPeer) {
      io.to(result.remainingPeer).emit('peer-disconnected');
    }
    socket.rooms.forEach(room => {
      if (room !== socket.id) socket.leave(room);
    });
  });


  socket.on('offer', (payload) => {
    const { roomId, sdp } = payload;
    const otherPeer = roomManager.getOtherPeer(roomId, socket.id);
    logToFile(`[OFFER] Socket: ${socket.id} -> Peer: ${otherPeer} | Room: ${roomId}`);
    if (otherPeer) {
      io.to(otherPeer).emit('offer', payload);
    }
  });


  socket.on('answer', (payload) => {
    const { roomId, sdp } = payload;
    const otherPeer = roomManager.getOtherPeer(roomId, socket.id);
    logToFile(`[ANSWER] Socket: ${socket.id} -> Peer: ${otherPeer} | Room: ${roomId}`);
    if (otherPeer) {
      io.to(otherPeer).emit('answer', payload);
    }
  });


  socket.on('ice-candidate', (payload) => {
    const { roomId, candidate } = payload;
    const otherPeer = roomManager.getOtherPeer(roomId, socket.id);
    logToFile(`[ICE-CANDIDATE] Socket: ${socket.id} -> Peer: ${otherPeer} | Room: ${roomId}`);
    if (otherPeer) {
      io.to(otherPeer).emit('ice-candidate', payload);
    }
  });


  socket.on('disconnect', () => {
    logToFile(`Socket disconnected: ${socket.id}`);
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
