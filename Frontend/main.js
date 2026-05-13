// ---- INIT ----

if (!document.cookie) location.href = 'login.html';

const email = document.cookie
    .split('; ')
    .find(row => row.startsWith('email='))
    ?.split('=')[1];

if (!email) location.href = 'login.html';

let currentUser = null;
let opened_chat = null; // { chat } or { user }

const socket = io();

// ---- IMAGEKIT CONFIG ----
const IK_URL_ENDPOINT = 'https://ik.imagekit.io/messangerStorage';
const IK_PUBLIC_KEY   = 'public_KuQKDfj1a0mSDhPEu8qVo9FPW60=';

// ---- SEARCH ----

const searchbar = document.getElementById('search');

searchbar.addEventListener('input', () => {
    if (!searchbar.value.trim()) {
        showChats();
        return;
    }
    search(searchbar.value.trim());
});

searchbar.addEventListener('focusin', () => {
    document.getElementById('chats-container').style.display = 'none';
    document.getElementById('search-result-container').style.display = 'flex';
});

searchbar.addEventListener('focusout', () => {
    if (searchbar.value !== '') return;
    showChats();
});

function showChats() {
    document.getElementById('chats-container').style.display = 'flex';
    document.getElementById('search-result-container').style.display = 'none';
    document.getElementById('search-result-container').innerHTML = '<h3 id="nothing-found-search">No user was found</h3>';
}

async function search(query) {
    const res = await fetch(`/api/searchUser?query=${encodeURIComponent(query)}`);
    const data = await res.json();

    const container = document.getElementById('search-result-container');
    document.getElementById('chats-container').style.display = 'none';
    container.style.display = 'flex';

    if (!data.users || !data.users.length) {
        container.innerHTML = '<h3 id="nothing-found-search">No user was found</h3>';
        return;
    }

    let html = '';
    for (const user of data.users) {
        if (user.username === currentUser.username) continue;
        html += `
        <div class="chat" onclick="open_chat({user_id:${user.id}})">
            <div class="profile-picture" data-letter="${(user.name || '?')[0].toUpperCase()}"></div>
            <div>
                <div class="name">${user.surname ? user.surname + ' ' : ''}${user.name}</div>
                <div class="lastmessage"><span>@${user.username}</span></div>
            </div>
        </div>`;
    }
    container.innerHTML = html || '<h3 id="nothing-found-search">No user was found</h3>';
}

// ---- OPEN CHAT ----

async function open_chat({ chat_id, user_id }) {
    const container = document.getElementById('chat-container');
    const nameEl = container.querySelector('.name');
    const subtitleEl = container.querySelector('.lastmessage span');

    const profilePicEl = container.querySelector('.profile-picture');

    if (chat_id) {
        const res = await fetch(`/api/getChat?chat_id=${chat_id}`);
        const data = await res.json();
        if (!data.success) return;

        const chat = data.chat;
        if (chat.type === 'direct') {
            const member = chat.chat_members.find(m => parseInt(m.id) !== currentUser.id)
                || chat.chat_members[0];
            nameEl.textContent = (member.surname ? member.surname + ' ' : '') + (member.name || '');
            subtitleEl.textContent = '@' + (member.username || '');
            profilePicEl.setAttribute('data-letter', (member.name || '?')[0].toUpperCase());
        } else {
            nameEl.textContent = chat.chat_name;
            subtitleEl.textContent = chat.chat_members.length + ' members';
            profilePicEl.setAttribute('data-letter', (chat.chat_name || '?')[0].toUpperCase());
        }

        opened_chat = { chat };
        socket.emit('join_chat', { chat_id: chat.id });

    } else if (user_id) {
        const res = await fetch(`/api/getUser?id=${user_id}`);
        const data = await res.json();
        if (!data.success) return;

        const user = data.user;
        nameEl.textContent = (user.surname ? user.surname + ' ' : '') + user.name;
        subtitleEl.textContent = '@' + user.username;
        profilePicEl.setAttribute('data-letter', (user.name || '?')[0].toUpperCase());
        opened_chat = { user };
    }

    container.style.display = 'grid';

    if (opened_chat.chat) {
        await update_chat_content();
    } else {
        document.getElementById('chat-messages').innerHTML = '';
    }
}

// ---- MESSAGES ----

async function update_chat_content() {
    if (!opened_chat?.chat) return;

    const res = await fetch(`/api/getAllMessages?chat_id=${opened_chat.chat.id}`);
    const data = await res.json();
    if (!data.success) return;

    render_messages(data.messages);
}

function render_messages(messages) {
    const container = document.getElementById('chat-messages');
    let html = '';
    for (const m of messages) {
        const isMine = parseInt(m.sender_id) === currentUser.id;
        html += build_message_html(m, isMine);
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function build_message_html(m, isMine) {
    let body = '';

    if (m.file_url) {
        const type = m.file_type || '';
        if (type.startsWith('image/')) {
            body += `<img class="msg-image" src="${m.file_url}" onclick="window.open('${m.file_url}','_blank')">`;
        } else if (type.startsWith('video/')) {
            body += `<video class="msg-video" src="${m.file_url}" controls></video>`;
        } else {
            const fname = m.file_url.split('/').pop().split('?')[0];
            body += `<a class="msg-file" href="${m.file_url}" target="_blank" download>
                        <img class="msg-file-icon" src="./image/attach-file.png" style="width:18px;height:18px;vertical-align:middle;filter:invert(1);opacity:.9;">
                        <span class="msg-file-name">${fname}</span>
                     </a>`;
        }
    }

    if (m.content) {
        body += `<span>${m.content}</span>`;
    }

    return `<div class="message${isMine ? ' my-message' : ''}">${body}</div>`;
}

// ---- SEND TEXT ----

function send_message(event) {
    event.preventDefault();
    if (!opened_chat) return;

    const input = document.getElementById('message');
    const content = input.value.trim();
    if (!content) return;

    socket.emit('send_message', {
        content,
        chat_id: opened_chat.chat?.id ?? null,
        user_id: opened_chat.user?.id ?? null,
    });

    input.value = '';
}

// ---- FILE UPLOAD ----

let pendingFiles = []; // { file, preview_url }

function openAddFilesMenu() {
    const overlay = document.querySelector('.upload-overlay');
    const isOpen = overlay.style.display === 'flex';
    overlay.style.display = isOpen ? 'none' : 'flex';
}

// Wire up file input & drag-drop
document.getElementById('fileInput').addEventListener('change', (e) => {
    for (const f of e.target.files) addPendingFile(f);
    e.target.value = '';
});

const zone = document.getElementById('zone');
zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag'); });
zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag');
    for (const f of e.dataTransfer.files) addPendingFile(f);
});

function addPendingFile(file) {
    const id = Date.now() + '_' + Math.random().toString(36).slice(2);
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    pendingFiles.push({ id, file, preview });
    renderFileList();
}

function removeFile(id) {
    pendingFiles = pendingFiles.filter(f => f.id !== id);
    renderFileList();
}

function renderFileList() {
    const list = document.getElementById('fileList');
    if (!pendingFiles.length) {
        list.innerHTML = '';
        return;
    }
    let html = '';
    for (const { id, file, preview } of pendingFiles) {
        const ext = file.name.split('.').pop().toUpperCase();
        const size = file.size < 1024 * 1024
            ? (file.size / 1024).toFixed(1) + ' KB'
            : (file.size / 1024 / 1024).toFixed(1) + ' MB';

        let iconHtml;
        if (preview) {
            iconHtml = `<img class="file-icon image" src="${preview}" style="object-fit:cover;border-radius:0;">`;
        } else if (file.type.startsWith('video/')) {
            iconHtml = `<div class="file-icon video"><video src="${URL.createObjectURL(file)}" muted preload="metadata" style="width:75px;height:75px;object-fit:cover;"></video></div>`;
        } else if (file.type.startsWith('audio/')) {
            iconHtml = `<div class="file-icon music"></div>`;
        } else if (ext === 'ZIP' || ext === 'RAR' || ext === '7Z') {
            iconHtml = `<div class="file-icon zip"></div>`;
        } else {
            iconHtml = `<div class="file-icon">${ext}</div>`;
        }

        html += `<div class="file">
            ${iconHtml}
            <div>
                <span class="file-name">${file.name}</span>
                <span class="file-size">${size}</span>
            </div>
            <button class="delete-file" onclick="removeFile('${id}')">✕</button>
        </div>`;
    }
    list.innerHTML = html;
}

async function send_files(event) {
    event.preventDefault();
    if (!opened_chat) return;
    if (!pendingFiles.length) return;

    const sendBtn = document.getElementById('sendFilesBtn');
    sendBtn.disabled = true;
    sendBtn.textContent = 'Uploading...';

    // Get ImageKit auth params from backend
    let authParams;
    try {
        const authRes = await fetch('/api/imagekitAuth');
        authParams = await authRes.json();
    } catch (e) {
        alert('Failed to get upload auth');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
        return;
    }

    for (const { file } of pendingFiles) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('fileName', `${Date.now()}_${file.name}`);
            formData.append('publicKey', IK_PUBLIC_KEY);
            formData.append('signature', authParams.signature);
            formData.append('expire', authParams.expire);
            formData.append('token', authParams.token);
            formData.append('folder', '/messenger');

            const uploadRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
                method: 'POST',
                body: formData,
            });

            if (!uploadRes.ok) {
                const errBody = await uploadRes.json().catch(() => ({}));
                throw new Error(`Upload failed (${uploadRes.status}): ${errBody.message || uploadRes.statusText}`);
            }
            const uploaded = await uploadRes.json();

            socket.emit('send_message', {
                content: null,
                chat_id: opened_chat.chat?.id ?? null,
                user_id: opened_chat.user?.id ?? null,
                file_url: uploaded.url,
                file_type: file.type,
            });
        } catch (err) {
            console.error('File upload error:', err);
            alert(`Failed to upload ${file.name}`);
        }
    }

    pendingFiles = [];
    renderFileList();
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
    document.querySelector('.upload-overlay').style.display = 'none';
}

// ---- CHATS LIST ----

async function update_chats() {
    if (!currentUser) return;
    const res = await fetch(`/api/getAllChats?user_id=${currentUser.id}`);
    const data = await res.json();
    if (!data.success) return;

    const container = document.getElementById('chats-container');
    let html = '';
    for (const chat of data.chats) {
        let chat_name, letter;
        if (chat.type === 'direct') {
            const other = chat.chat_members.find(m => parseInt(m.id) !== currentUser.id)
                || chat.chat_members[0];
            chat_name = (other.surname ? other.surname + ' ' : '') + (other.name || '?');
            letter = (other.name || '?')[0].toUpperCase();
        } else {
            chat_name = chat.chat_name;
            letter = (chat.chat_name || '?')[0].toUpperCase();
        }
        const lastMsg = chat.messages?.at(-1)?.content ?? (chat.messages?.at(-1)?.file_url ? '📎 File' : '');
        html += `<div class="chat" onclick="open_chat({chat_id:${chat.id}})">
                    <div class="profile-picture" data-letter="${letter}"></div>
                    <div>
                        <div class="name">${chat_name}</div>
                        <div class="lastmessage"><span>${lastMsg}</span></div>
                    </div>
                </div>`;
    }
    container.innerHTML = html || '<div id="no-chats"><p style="padding:20px;color:#999;text-align:center">No chats yet.<br>Search for a user to start chatting.</p></div>';
}

// ---- INIT ----

async function init() {
    const res = await fetch(`/api/getUser?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (!data.success || !data.user) {
        location.href = 'login.html';
        return;
    }
    currentUser = data.user;
    socket.emit('register_user', { user: currentUser });
    await update_chats();
}

// ---- SOCKET EVENTS ----

socket.on('connect', () => {
    console.log('Connected:', socket.id);
    init();
});

socket.on('receive_message', async (data) => {
    const { chat_id, sender_id } = data;

    // If this chat is open, append the message live
    if (opened_chat?.chat && opened_chat.chat.id === chat_id) {
        const isMine = parseInt(sender_id) === currentUser.id;
        const container = document.getElementById('chat-messages');
        container.insertAdjacentHTML('beforeend', build_message_html(data, isMine));
        container.scrollTop = container.scrollHeight;
    }

    // Always refresh the chat list so last message updates
    await update_chats();
});

socket.on('chat_created', async (data) => {
    // Always join the socket room so messages arrive immediately for both sides
    socket.emit('join_chat', { chat_id: data.chat.id });

    // Sender: opened_chat.user matches one of the new chat members → switch to real chat
    const isInitiator = opened_chat?.user &&
        data.chat.chat_members.some(m => parseInt(m.id) === opened_chat.user.id);

    if (isInitiator) {
        opened_chat = { chat: data.chat };
        await open_chat({ chat_id: data.chat.id });
    }
    // Recipient: chat list refreshes so the new conversation appears
    await update_chats();
});

socket.on('friend_request', (data) => {
    const sender = data.sender;
    const agreement = confirm(`User @${sender.username} wants to message you. Accept?`);
    if (agreement) {
        update_chats();
    }
});
