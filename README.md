<div align="center">
  
# 🚀 P2P Browser File Send

**A blazing-fast, secure, and purely peer-to-peer file sharing application.**

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white)](https://webrtc.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

</div>

---

Send files of **any size** directly from one browser to another. No limits, no intermediate servers, no data retention. Your files stay perfectly secure via **AES-GCM 256-bit** End-to-End Encryption, and the transfer utilizes your browser's native **Origin Private File System (OPFS)** for zero-crash streaming.

## ✨ Key Features

- ⚡ **Direct P2P Transfer**: Powered by WebRTC DataChannels for the fastest possible local and remote data transfer routing.
- 🔒 **End-to-End Encryption**: Every chunk of data is encrypted using native Web Crypto APIs (AES-GCM) on the sender's device and decrypted dynamically on the receiver's device.
- 🔄 **Smart Auto-Resume**: Dropped connection? Browser crashed? No problem. Simply rejoin the room and the transfer picks up exactly where it left off, down to the exact byte.
- 📁 **Unlimited File Sizes**: We chunk data into perfectly optimized 1MB slices and stream them directly to the receiver's disk (OPFS), meaning you can transfer 10GB+ files without ever running out of RAM.
- 🛡️ **Zero Server Storage**: The backend exists *strictly* as a signaling server to introduce the two browsers. Not a single byte of your file data ever touches a server.
- 🎨 **Beautiful UI**: Modern, responsive, and minimalist monochrome UI with smooth micro-animations.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 powered by Vite
- **Styling**: Tailwind CSS & Lucide React Icons
- **Core Browser APIs**:
  - `RTCPeerConnection` & `RTCDataChannel` (Networking)
  - `crypto.subtle` (AES-GCM Encryption)
  - `navigator.storage.getDirectory()` (OPFS High-Performance File Writing)

### Backend
- **Runtime**: Node.js & Express
- **Signaling**: Socket.io
- **Role**: Simple lightweight handshake coordinator (creates rooms and exchanges WebRTC SDP/ICE candidates).

---

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing.

### Prerequisites

You will need **Node.js (v18 or higher)** installed.

### 1. Backend Setup

Open a terminal and navigate to the backend directory:
```bash
cd backend
npm install
npm start
```
> The signaling server will spin up on `http://localhost:3001`

### 2. Frontend Setup

Open a **new** terminal and navigate to the frontend directory:
```bash
cd frontend
npm install
npm run dev
```
> The Vite development server will spin up on `http://localhost:5173`

---

## 💻 Usage Guide

1. **Open the App**: Navigate to `http://localhost:5173` in your browser.
2. **Select a File**: Click the dropzone and select the file you wish to send.
3. **Share the Link**: The app will instantly generate a unique room link (which includes the AES decryption key embedded directly in the URL hash, ensuring the server never sees it).
4. **Connect**: Open the link on the receiving device (or in another browser tab).
5. **Transfer**: WebRTC will auto-negotiate the connection and begin streaming the file perfectly securely!

---

## 🧠 How The Architecture Works

1. **Signaling**: User A creates a room. The server generates an ID.
2. **Key Generation**: User A generates an AES-GCM key locally. The key is appended to the URL as a `#hash` (meaning it is never sent to the backend during HTTP requests).
3. **Handshake**: User B joins via the URL. The backend introduces them. They exchange WebRTC Offers/Answers and ICE candidates.
4. **Data Transfer**: The DataChannel opens. User A chunks the file, encrypts each chunk, and fires them across the channel.
5. **Disk Streaming**: User B receives the chunks, decrypts them, and immediately flushes them to the hard drive via OPFS to prevent memory leaks.
6. **Integrity Check**: Once finished, User B runs a full SHA-256 hash on the reconstructed file and compares it to the original file's hash before triggering the final browser download prompt.
