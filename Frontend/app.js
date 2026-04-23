let cookie = document.cookie;

// console.log(cookie)

function setCookie(cname, cvalue, exdays = null){
    if(!exdays){
        document.cookie = cname+'='+cvalue+';'+'path=/'
    } else{
        let d = new Date()
        d.setTime(d.getTime() + (exdays*24*60*60*1000))
        document.cookie = cname+'='+cvalue+';'+expires +';path=/'
    }
    return document.cookie
}

async function register() {
    const username = document.getElementById("username").value;
    const name = document.getElementById("name").value;
    const surname = document.getElementById("surname").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (!name || !username || !email || !password) {
        alert("Заполни все поля!");
        return;
    }

    const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, name, surname, password, email }),
    });

    const data = await res.json();

    if (data.success) {
        // alert("Успешно зарегистрирован!");
        document.cookie = `email=${email}; path=/;`
        location.href = "index.html"
    } else {
        alert("Ошибка: " + data.error);
    }
}

function isEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

async function login(){
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if(!email || !password){
        alert("Fill All Fields")
        return
    }

    let res;
    console.log(isEmail(email))
    if(isEmail(email)){
        res = await fetch(`/api/login?email=${email}&password=${password}`)
    } else{
        res = await fetch(`/api/login?username=${email}&password=${password}`)
    }

    const data = await res.json();

    if(data.success){
        console.log(data)
        document.cookie = `email=${data.user.email}; path=/;`
        location.href = "index.html"
    } else{
        alert("Error", data.error)
        console.log(data)
    }

    // const success = await res.json

    // const res = await
}