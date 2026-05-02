let meuId;
let contatoSelecionado = null;
let peer;
let streamLocal;
let chamadaAtiva;
let onlineUsers = [];

// URL base do Render
const backendUrl = 'https://radio2-yocz.onrender.com';
const backendUrlObj = new URL(backendUrl);

const listaContatos = document.getElementById('lista-contatos');
const statusConexao = document.getElementById('status-conexao');
const contatoSelecionadoText = document.getElementById('contato-selecionado');
const btnPtt = document.getElementById('btn-ptt');
const audioRecebido = document.getElementById('audio-recebido');
const onlineCount = document.getElementById('online-count');

const sessaoFalar = document.getElementById('sessao-falar');
const btnVoltarLista = document.getElementById('btn-voltar-lista');

const socket = io(backendUrl, {
  transports: ['websocket', 'polling'],
  secure: true
});

function abrirPopUp() {
  if (sessaoFalar) sessaoFalar.classList.add('ativa');
}

function fecharPopUp() {
  if (sessaoFalar) sessaoFalar.classList.remove('ativa');
  finalizarChamada();
}

function atualizaStatus(texto, cor = '#28a745') {
  if (statusConexao) {
    statusConexao.innerText = texto;
    statusConexao.style.color = cor;
  }
}

// 1. ALTERADO: Registra apenas o peerId diretamente
function registrarNoServidor() {
  if (meuId && socket.connected) {
    console.log('Enviando ID ao servidor para registro:', meuId);
    socket.emit('register', { peerId: meuId, name: meuId }); // O nome passa a ser o próprio ID
  }
}

// 2. ALTERADO: Renderiza apenas o ID no HTML
function renderizarDispositivos() {
  // Filtra para não mostrar você mesmo na lista
  const outrosUsuarios = onlineUsers.filter(u => u.id && u.id !== meuId);
  
  if (onlineCount) {
    onlineCount.innerText = outrosUsuarios.length;
  }

  if (!listaContatos) return;

  if (outrosUsuarios.length === 0) {
    listaContatos.innerHTML = '<li class="empty-text">Nenhum outro dispositivo online no momento.</li>';
    return;
  }

  listaContatos.innerHTML = outrosUsuarios.map((u) => `
    <li>
      <div class="info">
        <strong>ID: ${u.id}</strong>
      </div>
      <button class="btn-chamar" data-id="${u.id}" data-name="${u.id}">Conversar</button>
    </li>
  `).join('');
}

// Configuração do PeerJS ajustada para o Render
const peerConfig = {
  host: backendUrlObj.hostname,
  port: 443,
  path: '/peerjs',
  secure: true,
  key: 'peerjs',
  debug: 1,
};

peer = new Peer(undefined, peerConfig);

peer.on('open', (id) => {
  meuId = id;
  console.log('Meu ID no PeerJS gerado:', id);
  const meuNomeDisplay = document.getElementById('meu-nome-display');
  if (meuNomeDisplay) meuNomeDisplay.innerText = id;
  registrarNoServidor();
});

peer.on('call', (call) => {
  if (!call.peer || call.peer === 'undefined') return;

  chamadaAtiva = call;
  call.answer(streamLocal || null);

  contatoSelecionado = { id: call.peer, name: call.peer };
  if (contatoSelecionadoText) contatoSelecionadoText.innerText = `Em chamada com: ${call.peer}`;
  
  abrirPopUp();
  atualizaStatus('Chamada recebida!', '#ffc107');

  call.on('stream', (remoteStream) => {
    if (audioRecebido) audioRecebido.srcObject = remoteStream;
  });
  call.on('close', () => {
    fecharPopUp();
  });
});

function iniciarChamada(id, name) {
  if (!id || id === 'undefined') {
    atualizaStatus('Erro: ID inválido', '#dc3545');
    return;
  }

  if (!streamLocal) {
    alert('O microfone ainda não está pronto.');
    return;
  }

  contatoSelecionado = { id, name };
  if (contatoSelecionadoText) contatoSelecionadoText.innerText = `Em chamada com: ${name}`;
  abrirPopUp();
  atualizaStatus(`Chamando ${name}...`, '#17a2b8');

  chamadaAtiva = peer.call(id, streamLocal);

  chamadaAtiva.on('stream', (remoteStream) => {
    if (audioRecebido) audioRecebido.srcObject = remoteStream;
  });
  chamadaAtiva.on('close', () => {
    fecharPopUp();
  });
  chamadaAtiva.on('error', (err) => {
    console.error(err);
    atualizaStatus('Erro na chamada', '#dc3545');
  });
}

function finalizarChamada() {
  if (chamadaAtiva) {
    chamadaAtiva.close();
    chamadaAtiva = null;
  }
  if (streamLocal) {
    streamLocal.getAudioTracks()[0].enabled = false;
  }
  if (btnPtt) {
    btnPtt.classList.remove('active');
    btnPtt.innerText = 'PTT';
  }
  atualizaStatus('Chamada encerrada', '#999');
}

function iniciarTransmissao() {
  if (!contatoSelecionado) return;
  if (streamLocal) {
    streamLocal.getAudioTracks()[0].enabled = true;
    if (btnPtt) {
      btnPtt.classList.add('active');
      btnPtt.innerText = 'Falando...';
    }
    atualizaStatus(`Transmitindo áudio...`, '#28a745');
  }
}

function pararTransmissao() {
  if (streamLocal) {
    streamLocal.getAudioTracks()[0].enabled = false;
    if (btnPtt) {
      btnPtt.classList.remove('active');
      btnPtt.innerText = 'PTT';
    }
    atualizaStatus('Silenciado', '#ffffff');
  }
}

navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  .then((stream) => {
    streamLocal = stream;
    streamLocal.getAudioTracks()[0].enabled = false;
    console.log('Microfone autorizado e pronto.');
  })
  .catch((err) => {
    console.error('Erro ao acessar o microfone:', err);
  });

if (listaContatos) {
  listaContatos.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-chamar')) {
      const id = e.target.dataset.id;
      const name = e.target.dataset.name;
      iniciarChamada(id, name);
    }
  });
}

if (btnPtt) {
  btnPtt.addEventListener('mousedown', iniciarTransmissao);
  btnPtt.addEventListener('mouseup', pararTransmissao);
  btnPtt.addEventListener('touchstart', (e) => { e.preventDefault(); iniciarTransmissao(); });
  btnPtt.addEventListener('touchend', pararTransmissao);
}

if (btnVoltarLista) {
  btnVoltarLista.addEventListener('click', fecharPopUp);
}

socket.on('connect', () => {
  console.log('Socket.io conectado com sucesso ao backend!');
  registrarNoServidor();
});

// 3. ALTERADO: Aceita tanto arrays de IDs quanto objetos
socket.on('presence', (users) => {
  console.log('Lista de presença recebida via socket:', users);
  
  if (!users) return;

  onlineUsers = users.map(u => {
    if (typeof u === 'string') {
      return { id: u, name: u };
    }
    return { id: u.id || u.peerId, name: u.name || u.id || u.peerId };
  }).filter(u => u && u.id && u.id !== 'undefined');

  renderizarDispositivos();
});
