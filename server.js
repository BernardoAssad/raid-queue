require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let participants = [];
let waitingParticipants = [];
const maxParticipants = 10;
let clients = [];

app.get('/api/admin-password', (req, res) => {
    res.json({ password: process.env.ADMIN_PASSWORD });
});

app.get('/api/events', (req, res) => {
    // console.log('Nova conexão SSE recebida');
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res
    };
    clients.push(newClient);

    req.on('close', () => {
        // console.log(`${clientId} Conexão fechada`);
        clients = clients.filter(client => client.id !== clientId);
    });

    // Envie um evento inicial para garantir que a conexão está aberta
    res.write(':\n\n');

    // Mantenha a conexão viva
    const keepAlive = setInterval(() => {
        res.write(':\n\n');
    }, 20000);

    req.on('close', () => {
        clearInterval(keepAlive);
    });

    sendUpdate(res);
});

app.post('/api/action', (req, res) => {
    const { type, nick } = req.body;
    // console.log('Ação recebida:', type, nick);

    switch(type) {
        case 'JOIN':
            if (participants.includes(nick) || waitingParticipants.includes(nick)) {
                res.json({ type: 'ERROR', message: 'Este nick já está na fila. Por favor, escolha outro.' });
            } else if (participants.length < maxParticipants) {
                participants.push(nick);
            } else {
                waitingParticipants.push(nick);
            }
            break;
        case 'LEAVE':
            participants = participants.filter(p => p !== nick);
            waitingParticipants = waitingParticipants.filter(p => p !== nick);
            moveFromWaitingToMain();
            break;
        case 'REMOVE':
            if (req.body.isMainQueue) {
                participants = participants.filter(p => p !== nick);
                moveFromWaitingToMain();
            } else {
                waitingParticipants = waitingParticipants.filter(p => p !== nick);
            }
            break;
        case 'CLEAR':
            participants = [];
            moveFromWaitingToMain(); 
            break;
}

    broadcastUpdate();
    res.json({ success: true });
});

function moveFromWaitingToMain() {
    while (participants.length < maxParticipants && waitingParticipants.length > 0) {
        participants.push(waitingParticipants.shift());
    }
}

function sendUpdate(res) {
    const data = JSON.stringify({
        type: 'UPDATE',
        participants: participants,
        waitingParticipants: waitingParticipants
    });
    res.write(`data: ${data}\n\n`);
}


function broadcastUpdate() {
    // console.log('Enviando atualização para todos os clientes');
    const data = JSON.stringify({
        type: 'UPDATE',
        participants: participants,
        waitingParticipants: waitingParticipants
    });
    clients.forEach(client => {
        try {
            client.res.write(`data: ${data}\n\n`);
        } catch (error) {
            console.error('Erro ao enviar atualização para um cliente:', error);
        }
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app; 