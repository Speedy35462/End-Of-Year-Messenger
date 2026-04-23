if(!document.cookie){
    location.href = "register.html"
}

let email = document.cookie.split("=")[1]
let currentUser = null
let currentUserId = null
// let currentChatId = null

const socket = io()

let searchbar = document.getElementById("search");
// let opened_user = null;

searchbar.addEventListener("input",()=>{
    if(searchbar.value == "" || !searchbar.value){ 
        let chats_container = document.getElementById("chats-container");
        let search_result_container = document.getElementById("search-result-container");
        chats_container.style.display = "flex"
        search_result_container.style.display = "none"
        search_result_container.innerHTML = ''
        return
    }
    // console.log(searchbar.value)
    search(searchbar.value)
})

searchbar.addEventListener("focusin",()=>{
    let chats_container = document.getElementById("chats-container");
    let search_result_container = document.getElementById("search-result-container");
    chats_container.style.display = "none"
    search_result_container.style.display = "flex"
    // search_result_container.innerHTML = ''
})

searchbar.addEventListener("focusout",()=>{
    if(searchbar.value!="") return
    let chats_container = document.getElementById("chats-container");
    let search_result_container = document.getElementById("search-result-container");
    chats_container.style.display = "flex"
    search_result_container.style.display = "none"
    // search_result_container.innerHTML = ''
})

async function search(search_content){
    const res = await fetch(`/api/searchUser?username=%${search_content}%`)
    
    const data = await res.json()
    let users = data.users
    // for(let user of data.users){
    //     console.log("Found User:",user.username)
    // }

    let chats_container = document.getElementById("chats-container");
    let search_result_container = document.getElementById("search-result-container");
    chats_container.style.display = "none"
    search_result_container.style.display = "flex"
    search_result_container.innerHTML = ''
    for(let user of users){
        search_result_container.innerHTML+=`
        <div class="chat" onclick=open_profile(${user.id})>
                        <div class="profile-picture"></div>
                        <div>
                            <div class="name">${user.surname + " " + user.name}</div>
                            <div class="lastmessage"><span> Ipsum Dolor Sit Amet</span></div>
                        </div>
                    </div>`
    }
    // console.log(users)
}

async function addFriend(){
    let username = prompt("Write Friend's Username: ")
    const res = await fetch(`/api/getUser?username=${username}`)
    const data = await res.json()
    if(!data) return

    socket.emit("ask_to_make_friends",{reciever:data.user})

    // let chatsContainer = document.getElementById("chats-container")
    // chatsContainer.innerHTML+=`
    // <div class="chat">
    //                 <div class="profile-picture"></div>
    //                 <div>
    //                     <div class="name">${data.user.surname + data.user.name}</div>
    //                     <div class="lastmessage"><span> Ipsum Dolor Sit Amet</span></div>
    //                 </div>
    //             </div>
    // `
}

async function init(){
    console.log(email)
    const res = await fetch(`/api/getUser?email=${email}`)
    const data = await res.json()
    console.log(data)
    currentUser = data.user
    socket.emit("register_user",{user:currentUser})

    // await loadChats()
    // document.getElementById("greetings").textContent = `Hello ${user.surname} ${user.name}`
}

function connect(username){
    socket.emit("connect_to_chat",{username:username})
    // currentChatId = chat_id
}

async function open_profile(user_id){
    const res = await fetch(`/api/getUser?id=${user_id}`)
    const data = await res.json()
    if(!data) return

    user = data.user
    // localStorage.
    console.log("Open User",user)
    // opened_user = user

    let chat_container = document.getElementById("chat-container");
    chat_container.style.display = "grid";

    let name_el = document.querySelector("#chat-container .name");
    name_el.textContent = user.surname + " " + user.name
}

function send_message(username, content){
    // if(!currentChatId) return "No chat selected"
    socket.emit("send_message",{content:content,reciever:username})
}

//SOCKET
socket.on("connect", () => {
    console.log("Connected: ", socket.id)
    currentUserId = socket.id
    init()
})

socket.on("recieve_answer", (data) => {
    console.log("Server sent:", data)
    // currentChatId = data.result
})

socket.on("recieve_message", (data)=>{
    console.log("I got ", data)
})

socket.on("friend_request", (data)=>{
    let sender = data.sender
    let agreement = prompt(`User @${sender.username} wants to make friends with you. Agree?`)
    if(agreement == "yes"){
        let chatsContainer = document.getElementById("chats-container")
        chatsContainer.innerHTML+=`
        <div class="chat">
                        <div class="profile-picture"></div>
                        <div>
                            <div class="name">${sender.surname + " " + sender.name}</div>
                            <div class="lastmessage"><span> Ipsum Dolor Sit Amet</span></div>
                        </div>
                    </div>`
    
    }
})

// init()