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
    origin: "*", // Permite qualquer origem
    methods: ["GET", "POST"]
  }
});

// Configuração do servidor PeerJS integrado
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/peerjs'
});

app.use(peerServer);

// Objeto para guardar o estado dos usuários conectados
let users = {};

io.on('connection', (socket) => {
  console.log('🟢 Novo cliente Socket.io:', socket.id);

  // 1. Registro do usuário
  socket.on('register', (data) => {
    // Guarda os dados do usuário associados ao ID do socket
    users[socket.id] = {
      peerId: data.peerId,
      name: data.name,
      isTalking: false // Começa sem falar
    };
    console.log(`👤 Usuário registrado: ${data.name} (${data.peerId})`);
    
    // Atualiza a lista para todos
    broadcastPresence();
  });

  // 🔴 2. MELHORIA CRUCIAL: Escuta o estado de fala e avisa o grupo
  socket.on('talking_state', (data) => {
    if (users[socket.id]) {
      // Atualiza o estado no servidor
      users[socket.id].isTalking = data.isTalking;
      
      console.log(`🎤 ${users[socket.id].name} está falando: ${data.isTalking}`);

      // Envia para TODOS os outros usuários QUEM está falando para bloquear o PTT deles
      socket.broadcast.emit('user_talking', {
        peerId: users[socket.id].peerId,
        name: users[socket.id].name,
        isTalking: data.isTalking
      });

      // Atualiza a lista visual (para o nome ficar vermelho)
      broadcastPresence();
    }
  });

  // 3. Desconexão
  socket.on('disconnect', () => {
    if (users[socket.id]) {
      console.log(`🔴 Usuário saiu: ${users[socket.id].name}`);
      
      // Se ele estava falando e caiu, avisa os outros para liberar o canal
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

  // Função auxiliar para enviar a lista de usuários atualizada para todos
  function broadcastPresence() {
    const userList = Object.values(users);
    io.emit('presence', userList);
  }
});

// Porta do servidor (padrão do Render ou 3000 local)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor da Rádio rodando na porta ${PORT}`);
});
