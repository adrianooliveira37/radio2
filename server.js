const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { ExpressPeerServer } = require('peer');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling']
});

const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/'
});

app.use('/peerjs', peerServer);
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Armazena os usuários conectados: socket.id -> { id: peerId, name: string }
const onlineUsers = new Map();

function broadcastPresence() {
  const list = Array.from(onlineUsers.values());
  console.log('Enviando lista de presença atualizada:', list);
  io.emit('presence', list);
}

io.on('connection', (socket) => {
  console.log('Novo cliente socket conectado:', socket.id);

  socket.on('register', (data) => {
    if (!data || !data.peerId) return;
    
    console.log(`Registrando usuário: ${data.name} (PeerID: ${data.peerId})`);
    
    onlineUsers.set(socket.id, {
      id: data.peerId,
      name: data.name || 'Dispositivo sem nome'
    });
    
    broadcastPresence();
  });

  socket.on('disconnect', () => {
    if (onlineUsers.has(socket.id)) {
      console.log(`Usuário desconectado: ${onlineUsers.get(socket.id).name}`);
      onlineUsers.delete(socket.id);
      broadcastPresence();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend rodando na porta ${PORT}`);
});