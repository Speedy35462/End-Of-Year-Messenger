const express = require('express');
const path = require('path');
const http = require('http')
const { Server } = require('socket.io')
const { register, getUser, login, searchUser, createChat } = require('./db.js');
const { log, error } = require('console');

const app = express();
const server = http.createServer(app)
const io = new Server(server)
// const port = 3000;
const port = process.env.port || 3000;

const users = new Map()

app.use(express.json());
app.use(express.static(path.join(__dirname, "../Frontend")));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "../Frontend/index.html"));
});

//POST METHOD

app.post('/api/register', async (req, res) => {
    const { username, name, surname, password, email } = req.body;

    try {
        const user = await register(name, surname, username, password, email);
        res.json({ success: true, user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.post('/api/register', async (req, res) => {
    const { type, chat_name, chat_members } = req.body;


    try {
        const chat = await createChat(type, chat_name, chat_members)
        res.json({ succes: true, chat })
    } catch(err){
        res.status(400).json({ succes: false, error:err.message})
    }
})

//GET METHOD

app.get('/api/login', async (req, res)=>{
    const { email, username, password } = req.query
    console.log(email, username, password)
    try{
        const user = await login(email, username, password)
        res.json({ success: true, user})
    } catch (err){
        res.status(400).json({success:false, error: err.message})
    }
})

app.get('/api/getUser', async (req, res) => {
    const { email, username, id } = req.query;

    try {
        const user = await getUser({ email, username, id });
        res.json({ success: true, user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/searchUser', async (req, res)=>{
    const { username } = req.query;

    try{
        const users = await searchUser({username:username})
        res.json({ succes: true, users })
    } catch(err) {
        res.status(400).json({ succes: false, error: err.message })
    }
})

// ---- Socket.io ----
io.on('connection', (socket) => {
    console.log("User Connected: ", socket.id)
    socket.on("register_user",(data) => {
        users.set(data.user.id,socket.id)
        socket.user = data.user
        console.log("User registered:", data, data.user.id, socket.id)
    })
    // socket.on("connect_to_chat", async (data) => {
    //     console.log("User wants to connect to ",data.username)
    //     const user = await getUser({ username:data.username })
    //     socket.emit("recieve_answer", {result:users.get(user.id)})
    // })
    socket.on("send_message", async (data)=>{
        // io.to(data.reciever_id).emit("recieve_message",{sender_id:socket.id,content:data.content})
        const user = await getUser({ username: data.reciever })
        let sender = socket.user
        io.to(users.get(user.id)).emit("recieve_message",{sender:`@${sender.username}`,content:data.content})
    })
    socket.on("ask_to_make_friends", (data)=>{
        let reciever = data.reciever
        let sender = socket.user
        console.log(sender, "TEST")
        io.to(users.get(reciever.id)).emit("friend_request",{sender:sender})
    })
})
server.listen(port, () => {
    console.log(`Example app listening on http://localhost:${port}/`);
});