const { createClient } = require("@supabase/supabase-js"); // ← деструктуризация!

const supabase = createClient(
    "https://bptzqfgciwlvvnhcqdwa.supabase.co",
    "sb_publishable_uz1bi-5WOtKCDt7X5SogUQ_uu8EwUKh"
);

async function getUser({ email, username, id }) {
    if (!email && !username && !id) {
        throw new Error("Email, username or id is required");
    }

    let query = supabase.from("Users").select("*");

    if (email) {
        query = query.eq("email", email);
    } else if(username) {
        query = query.eq("username", username);
    } else{
        query = query.eq("id", id);
    }

    const { data, error } = await query.single();

    if (error) {
        console.log("Fetch error:", error);
        return null;
    }

    return data;
}

async function searchUser({ username }) {
    if (!username) {
        throw new Error("Email or username is required")
    }

    const { data, error } = await supabase
        .from("Users")
        .select("*")
        .ilike("username", `%${username}%`) // % — wildcard для частичного совпадения

    if (error) {
        console.log("Fetch error:", error);
        return [];
    }

    return data; // теперь массив всех подходящих юзеров
}

async function register(name, surname, username, password, email) {
    console.log(name, surname, username, password, email)
    const { data: existing } = await supabase
        .from("Users")
        .select("*")
        .eq("email", email)
        .eq("username", username)
        .single();

    if (existing) {
        console.log("User already exists:", existing);
        return;
    }

    const { data, error } = await supabase
        .from("Users")
        .insert({ username, name, surname, password, email })
        .select()
        .single();

    if (error) {
        console.log("Insert error:", error);
        return;
    }

    return data;
}

async function login(email, username, password) {
    const user = await getUser({email, username})
    if(!user){
        console.log("User doesn't exist");
        return
    }

    if(password == user.password){
        return user;
    }
}

async function createChat(type, chat_name, chat_members){
    const { data, error } = await supabase
        .from("chats")
        .insert({type, chat_name, chat_members})
        .select().single()
    
    if(error) {
        console.log("Chat creating error:",error)
        return
    }

    return data
}

module.exports = { register, login, getUser, searchUser, createChat }; // ← CommonJS экспорт