const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve static files from the React build
const distPath = path.join(__dirname, '../client/dist');
app.use(express.static(distPath));

const rooms = new Map();

io.on('connection', (socket) => {
  let currentRoomId = null;

  socket.on('join_room', ({ roomId, username }) => {
    currentRoomId = roomId;
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        hostId: socket.id,
        users: new Map([[socket.id, { username }]]),
        videoState: { timestamp: 0, isPlaying: false }
      });
    } else {
      const room = rooms.get(roomId);
      room.users.set(socket.id, { username });
      socket.emit('initial_sync', room.videoState);
    }
    broadcastUsers(roomId);
  });

  socket.on('play', ({ roomId, timestamp }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    room.videoState = { timestamp, isPlaying: true };
    socket.to(roomId).emit('sync_play', { timestamp });
  });

  socket.on('pause', ({ roomId, timestamp }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    room.videoState = { timestamp, isPlaying: false };
    socket.to(roomId).emit('sync_pause', { timestamp });
  });

  socket.on('seek', ({ roomId, timestamp }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    room.videoState.timestamp = timestamp;
    socket.to(roomId).emit('sync_seek', { timestamp });
  });

  socket.on('heartbeat', ({ roomId, timestamp, isPlaying }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    room.videoState = { timestamp, isPlaying };
    socket.to(roomId).emit('heartbeat_sync', { timestamp, isPlaying });
  });

  socket.on('disconnect', () => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    room.users.delete(socket.id);
    
    if (room.hostId === socket.id) {
      if (room.users.size > 0) {
        const newHostId = room.users.keys().next().value;
        room.hostId = newHostId;
        io.to(currentRoomId).emit('host_changed', { newHostId });
      } else {
        rooms.delete(currentRoomId);
      }
    }
    broadcastUsers(currentRoomId);
  });
});

function broadcastUsers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const users = Array.from(room.users.entries()).map(([id, data]) => ({
    id, username: data.username, isHost: id === room.hostId
  }));
  io.to(roomId).emit('users_update', { users, count: users.length });
}

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
