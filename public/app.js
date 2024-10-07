let participants = [];
let waitingParticipants = [];
let currentNick = localStorage.getItem('userNick') || '';

const maxParticipants = 10;
let adminPassword;

let eventSource;
const enterButton = document.getElementById('enter-btn');
const exitButton = document.getElementById('exit-btn');
const nickInput = document.getElementById('nick-input');
const roomList = document.getElementById('room-list');
const waitingList = document.getElementById('waiting-list');
const statusDiv = document.getElementById('status');
const fullRoomNames = document.getElementById('full-room-names');
const clearButton = document.getElementById('clear-btn');
const showNamesButton = document.getElementById('show-names-btn');

function fetchAdminPassword() {
    fetch('/api/admin-password')
        .then(response => response.json())
        .then(data => {
            adminPassword = data.password;
        })
        .catch(error => console.error('Erro ao buscar a senha do administrador:', error));
}

fetchAdminPassword();

function connectEventSource() {
    eventSource = new EventSource('/api/events');

    eventSource.onopen = () => {
        if (currentNick) {
            sendAction('JOIN', currentNick);
        }
    };

    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch(data.type) {
            case 'UPDATE':
                participants = data.participants;
                waitingParticipants = data.waitingParticipants;
                updateRoom();
                break;
            case 'ERROR':
                alert(data.message);
                break;
        }
    };

    eventSource.onerror = (error) => {
        eventSource.close();
        setTimeout(connectEventSource, 5000);  
    };
}

connectEventSource();

function updateRoom() {
    roomList.innerHTML = '';
    waitingList.innerHTML = '';

    if (participants.length === 0) {
        roomList.innerHTML = '<li>Nenhum participante na sala.</li>';
    }

    participants.forEach((participant, index) => {
        const listItem = createParticipantListItem(participant, index, true);
        roomList.appendChild(listItem);
    });

    waitingParticipants.forEach((participant, index) => {
        const listItem = createParticipantListItem(participant, index + maxParticipants, false);
        waitingList.appendChild(listItem);
    });

    checkRoomStatus();
}

function createParticipantListItem(participant, index, isMainQueue) {
    const listItem = document.createElement('li');
    listItem.innerText = `${index + 1}. ${participant}`;
    
    const deleteIcon = document.createElement('span');
    deleteIcon.innerHTML = '🗑️';
    deleteIcon.style.cursor = 'pointer';
    
    deleteIcon.addEventListener('click', () => {
        openPasswordModal((password) => {
            if (password === adminPassword) {
                sendAction('REMOVE', participant, isMainQueue);
            } else {
                alert('Senha incorreta! O participante não será removido.');
            }
        });
    });

    listItem.appendChild(deleteIcon);
    return listItem;
}

function openPasswordModal(callback) {
    const modal = document.getElementById('password-modal');
    const closeButton = document.getElementById('close-modal');
    const passwordInput = document.getElementById('admin-password-input');
    const submitButton = document.getElementById('submit-password');

    modal.classList.remove('hidden');

    closeButton.onclick = () => {
        modal.classList.add('hidden');
        passwordInput.value = '';
    };

    submitButton.onclick = () => {
        const password = passwordInput.value;
        modal.classList.add('hidden');
        passwordInput.value = '';
        callback(password);
    };

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.classList.add('hidden');
            passwordInput.value = '';
        }
    };
}

function checkRoomStatus() {
    if (participants.length === maxParticipants) {
        statusDiv.innerText = 'Sala principal cheia. Novos participantes entrarão na fila de espera.';
    } else {
        statusDiv.innerText = 'Sala aberta. Aguarde mais treinadores.';
    }

    clearButton.classList.toggle('hidden', participants.length === 0);
    showNamesButton.classList.toggle('hidden', participants.length === 0);
}

function clearQueue() {
    openPasswordModal((password) => {
        if (password === adminPassword) {
            sendAction('CLEAR').then(() => {
                updateRoom();
            });
        } else {
            alert('Senha incorreta! A fila não será limpa.');
        }
    });
}

function showNames() {
    openPasswordModal((password) => {
        if (password === adminPassword) {
            displayFullRoomNames();
        } else {
            alert('Senha incorreta! Os nomes não serão exibidos.');
        }
    });
}

function sendAction(type, nick, isMainQueue) {
    fetch('/api/action', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, nick, isMainQueue }),
    }).then(response => {
        if (!response.ok) {
            throw new Error('Falha ao enviar ação');
        }
        return response.json();
    }).then(data => {
        if (data.type === 'ERROR') {
            alert(data.message);
        }
    }).catch(error => {
        console.error('Erro ao enviar ação:', error);
        alert('Ocorreu um erro ao enviar a ação. Por favor, tente novamente.');
    });
}

enterButton.addEventListener('click', () => {
    const nick = nickInput.value.trim();
    if (nick === "") {
        alert('Por favor, insira um nick.');
        return;
    }

    sendAction('JOIN', nick);
    currentNick = nick;
    localStorage.setItem('userNick', currentNick);
    nickInput.value = '';
    exitButton.classList.remove('hidden');
    enterButton.classList.add('hidden');
});

exitButton.addEventListener('click', () => {
    if (currentNick !== '') {
        const confirmation = confirm('Você tem certeza de que deseja sair?');
        if (!confirmation) return;
        
        sendAction('LEAVE', currentNick);
        localStorage.removeItem('userNick');
        currentNick = '';

        exitButton.classList.add('hidden');
        enterButton.classList.remove('hidden');
        nickInput.disabled = false;
    }
});
function displayFullRoomNames() {
    const fullRoomNames = document.getElementById('full-room-names');
    fullRoomNames.classList.remove('hidden');
    
    const roomNamesElement = document.getElementById('room-names');
    roomNamesElement.innerText = 'Participantes: ' + participants.join(', ');

    roomNamesElement.style.cursor = 'pointer';
    roomNamesElement.title = 'Clique para copiar os nomes';
    roomNamesElement.onclick = function() {
        copyTextToClipboard(participants.join(', '));
    };
}

updateRoom();

if (currentNick !== '') {
    nickInput.value = currentNick;
    nickInput.disabled = true;
    exitButton.classList.remove('hidden');
    enterButton.classList.add('hidden');
}

function copyTextToClipboard(text) {
    navigator.clipboard.writeText(text).then(function() {
        alert('Nomes copiados para a área de transferência!');
    }).catch(function(err) {
        console.error('Erro ao copiar texto: ', err);
        fallbackCopyTextToClipboard(text);
    });
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        const msg = successful ? 'Nomes copiados para a área de transferência!' : 'Falha ao copiar os nomes.';
        alert(msg);
    } catch (err) {
        console.error('Fallback: Erro ao copiar', err);
        alert('Erro ao copiar os nomes. Por favor, copie manualmente.');
    }

    document.body.removeChild(textArea);
}

clearButton.addEventListener('click', clearQueue);
showNamesButton.addEventListener('click', showNames);