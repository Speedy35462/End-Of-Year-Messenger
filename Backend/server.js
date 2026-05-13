const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { register, getUser, login, searchUser, createChat, getChat, getAllChats, getAllMessages, saveMessage, findDirectChat } = require('./db.js');
const ImageKit = require('imagekit');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000; // FIX: was lowercase .port

const imagekit = new ImageKit({
    publicKey: 'public_KuQKDfj1a0mSDhPEu8qVo9FPW60=',
    privateKey: 'private_PsINGpnbFAswGH37vQkv/8ox2/E=',
    urlEndpoint: 'https://ik.imagekit.io/messangerStorage'
});

const users = new Map(); // user_id -> socket.id

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '../Frontend')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend/index.html'));
});

// ---- AUTH ----

app.post('/api/register', async (req, res) => {
    const { username, name, surname, password, email } = req.body;
    try {
        const user = await register(name, surname, username, password, email);
        res.json({ success: true, user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/login', async (req, res) => {
    const { email, username, password } = req.query;
    try {
        const user = await login(email, username, password);
        if (!user) return res.status(401).json({ success: false, error: 'Wrong credentials' });
        res.json({ success: true, user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ---- USERS ----

app.get('/api/getUser', async (req, res) => {
    const { email, username, id } = req.query;
    try {
        const user = await getUser({ email, username, id });
        res.json({ success: true, user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/searchUser', async (req, res) => {
    const { query } = req.query; // FIX: frontend sends ?query=, server expected ?username=
    try {
        const foundUsers = await searchUser({ username: query });
        res.json({ success: true, users: foundUsers });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ---- CHATS ----

app.post('/api/createChat', async (req, res) => { // FIX: was duplicate /api/register
    const { type, chat_name, chat_members } = req.body;
    try {
        const chat = await createChat(type, chat_name, chat_members);
        res.json({ success: true, chat });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/getChat', async (req, res) => {
    const { chat_id } = req.query;
    try {
        const chat = await getChat(chat_id);
        res.json({ success: true, chat });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/getAllChats', async (req, res) => {
    const { user_id } = req.query;
    try {
        const chats = await getAllChats(user_id);
        res.json({ success: true, chats });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/getAllMessages', async (req, res) => {
    const { chat_id } = req.query;
    try {
        const messages = await getAllMessages(chat_id);
        res.json({ success: true, messages });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ---- IMAGEKIT AUTH (backend signs upload requests) ----
app.get('/api/imagekitAuth', (req, res) => {
    const authParams = imagekit.getAuthenticationParameters();
    res.json(authParams);
});

// ---- SOCKET.IO ----

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('register_user', (data) => {
        users.set(data.user.id, socket.id);
        socket.user = data.user;
        console.log('User registered:', data.user.username);
    });

    socket.on('join_chat', (data) => {
        socket.join(`chat_${data.chat_id}`);
    });

    socket.on('send_message', async (data) => {
        const { content, chat_id, user_id, file_url, file_type } = data;
        if (!socket.user) return;

        let targetChatId = chat_id;

        // No existing chat — find or create a direct one
        if (!targetChatId && user_id) {
            const existing = await findDirectChat(socket.user.id, user_id);
            if (existing) {
                targetChatId = existing.id;
            } else {
                const otherUser = await getUser({ id: String(user_id) });
                const members = [
                    { id: socket.user.id, name: socket.user.name, surname: socket.user.surname, username: socket.user.username },
                    otherUser ? { id: otherUser.id, name: otherUser.name, surname: otherUser.surname, username: otherUser.username } : { id: user_id }
                ];
                const newChat = await createChat('direct', null, members);
                if (!newChat) return;
                targetChatId = newChat.id;
                io.to(socket.id).emit('chat_created', { chat: newChat });
                const otherSocketId = users.get(user_id);
                if (otherSocketId) io.to(otherSocketId).emit('chat_created', { chat: newChat });
            }
        }

        if (!targetChatId) return;

        const saved = await saveMessage(targetChatId, socket.user.id, content || null, file_url || null, file_type || null);
        if (!saved) return;

        const payload = {
            id: saved.id,
            chat_id: targetChatId,
            sender_id: socket.user.id,
            content: saved.content,
            file_url: saved.file_url || null,
            file_type: saved.file_type || null,
            created_at: saved.created_at
        };

        io.to(`chat_${targetChatId}`).emit('receive_message', payload);
    });

    socket.on('ask_to_make_friends', (data) => {
        const sender = socket.user;
        const targetSocket = users.get(data.reciever.id);
        if (targetSocket) io.to(targetSocket).emit('friend_request', { sender });
    });

    socket.on('disconnect', () => {
        if (socket.user) users.delete(socket.user.id);
    });
});

server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
});
