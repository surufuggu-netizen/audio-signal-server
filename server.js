const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Audio Signal Server Running');
});

// Store active sessions
const sessions = {};

io.on('connection', (socket) => {
  console.log('Device connected:', socket.id);

  // Child ya Parent dono same childId se join karte hain
  socket.on('join', (childId) => {
    socket.join(childId);
    sessions[socket.id] = childId;
    console.log(`Device joined session: ${childId}`);
    
    // Dusre device ko batao ki partner aa gaya
    socket.to(childId).emit('peer_joined', socket.id);
  });

  // WebRTC Offer (Parent → Child)
  socket.on('offer', (data) => {
    socket.to(data.childId).emit('offer', {
      offer: data.offer,
      fromId: socket.id
    });
  });

  // WebRTC Answer (Child → Parent)
  socket.on('answer', (data) => {
    socket.to(data.toId).emit('answer', {
      answer: data.answer
    });
  });

  // ICE Candidates exchange
  socket.on('ice_candidate', (data) => {
    socket.to(data.childId).emit('ice_candidate', {
      candidate: data.candidate
    });
  });

  // Stop signal
  socket.on('stop_audio', (childId) => {
    socket.to(childId).emit('stop_audio');
  });

  // Disconnect cleanup
  socket.on('disconnect', () => {
    const childId = sessions[socket.id];
    if (childId) {
      socket.to(childId).emit('peer_disconnected');
      delete sessions[socket.id];
    }
    console.log('Device disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Signal server running on port ${PORT}`);
});
