const express = require('express');
const http = require('http');
const path = require('path');
const { ExpressPeerServer } = require('peer');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);

// Configuração do CORS para Socket.io
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Configuração do servidor PeerJS integrado
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/peerjs'
});

app.use(peerServer);

// Configura o Express para entregar arquivos estáticos da pasta raiz
app.use(express.static(path.join(__dirname)));

// Rota principal: Entrega o index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para o grupo.html (Caso você use esse nome de arquivo)
app.get('/grupo.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'grupo.html'));
});

// Objeto para guardar o estado dos usuários conectados
let users = {};

io.on('connection', (socket) => {
  console.log('🟢 Novo cliente Socket.io:', socket.id);

  // 1. Registro do usuário
  socket.on('register', (data) => {
    users[socket.id] = {
      peerId: data.peerId,
      name: data.name,
      isTalking: false
    };
    console.log(`👤 Usuário registrado: ${data.name} (${data.peerId})`);
    broadcastPresence();
  });

  // 2. Escuta o estado de fala e avisa o grupo
  socket.on('talking_state', (data) => {
    if (users[socket.id]) {
      users[socket.id].isTalking = data.isTalking;
      console.log(`🎤 ${users[socket.id].name} está falando: ${data.isTalking}`);

      // Avisa todos os outros quem está transmitindo
      socket.broadcast.emit('user_talking', {
        peerId: users[socket.id].peerId,
        name: users[socket.id].name,
        isTalking: data.isTalking
      });

      broadcastPresence();
    }
  });

  // 3. Desconexão
  socket.on('disconnect', () => {
    if (users[socket.id]) {
      console.log(`🔴 Usuário saiu: ${users[socket.id].name}`);
      
      if (users[socket.id].isTalking) {
        socket.broadcast.emit('user_talking', {
          peerId: users[socket.id].peerId,
          name: users[socket.id].name,
          isTalking: false
        });
      }
      
      delete users[socket.id];
      broadcastPresence();
    }
  });

  function broadcastPresence() {
    const userList = Object.values(users);
    io.emit('presence', userList);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor da Rádio rodando na porta ${PORT}`);
});
