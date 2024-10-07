const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();

// Usar o middleware CORS
app.use(cors());

// Defina suas rotas
app.get('/api/websocket', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

    if (req.method === 'GET') {
        const wss = new WebSocket.Server({ noServer: true });

        res.socket.server.on('upgrade', (request, socket, head) => {
            wss.handleUpgrade(request, socket, head, (ws) => {
                console.log('Novo cliente conectado');

                // Enviar a lista de participantes para o novo cliente
                ws.send(JSON.stringify({ participants, waitingParticipants }));

                ws.on('message', (message) => {
                    const data = JSON.parse(message);

                    if (data.type === 'ADD_PARTICIPANT') {
                        if (!participants.includes(data.name) && !waitingParticipants.includes(data.name)) {
                            if (participants.length < 10) {
                                participants.push(data.name);
                            } else {
                                waitingParticipants.push(data.name);
                            }
                            broadcast();
                        } else {
                            ws.send(JSON.stringify({ error: 'Participante já existe na sala ou na fila de espera.' }));
                        }
                    } else if (data.type === 'REMOVE_PARTICIPANT') {
                        participants = participants.filter(p => p !== data.name);
                        waitingParticipants = waitingParticipants.filter(p => p !== data.name);
                        broadcast();
                    }
                });

                ws.on('close', () => {
                    console.log('Cliente desconectado');
                });
            });
        });
    } else {
        res.status(405).end(); // Método não permitido
    }
});

let participants = [];
let waitingParticipants = [];

function broadcast() {
    const message = JSON.stringify({ participants, waitingParticipants });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

module.exports = app; // Exportar o aplicativo Express