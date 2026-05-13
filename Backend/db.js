const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://bptzqfgciwlvvnhcqdwa.supabase.co',
    'sb_publishable_uz1bi-5WOtKCDt7X5SogUQ_uu8EwUKh'
);

async function getUser({ email, username, id }) {
    if (!email && !username && !id) throw new Error('Email, username or id required');

    let query = supabase.from('Users').select('*');
    if (email) query = query.eq('email', email);
    else if (username) query = query.eq('username', username);
    else query = query.eq('id', id);

    const { data, error } = await query.single();
    if (error) { console.log('getUser error:', error.message); return null; }
    return data;
}

async function searchUser({ username }) {
    if (!username) throw new Error('Username required');
    const { data, error } = await supabase
        .from('Users')
        .select('*')
        .ilike('username', `%${username}%`);
    if (error) { console.log('searchUser error:', error.message); return []; }
    return data;
}

async function register(name, surname, username, password, email) {
    const { data: existing } = await supabase
        .from('Users').select('id').eq('email', email).single();
    if (existing) throw new Error('User already exists');

    const { data, error } = await supabase
        .from('Users')
        .insert({ username, name, surname, password, email })
        .select().single();
    if (error) throw new Error(error.message);
    return data;
}

async function login(email, username, password) {
    const user = await getUser({ email, username });
    if (!user) return null;
    if (password !== user.password) return null;
    return user;
}

async function createChat(type, chat_name, chat_members) {
    const { data, error } = await supabase
        .from('chats')
        .insert({ type, chat_name, chat_members })
        .select().single();
    if (error) { console.log('createChat error:', error.message); return null; }
    return data;
}

async function getChat(chat_id) {
    const { data: chat, error } = await supabase
        .from('chats').select('*').eq('id', chat_id).single();
    if (error || !chat) return null;

    const messages = await getAllMessages(chat_id);
    return { ...chat, messages };
}

async function getAllChats(user_id) {
    const uid = parseInt(user_id);

    // Get all chats where user is a member (chat_members is jsonb array of objects with id)
    const { data: chats, error } = await supabase
        .from('chats')
        .select('*');
    if (error) { console.log('getAllChats error:', error.message); return []; }

    // Filter: user is in chat_members array
    const userChats = (chats || []).filter(c => {
        if (!Array.isArray(c.chat_members)) return false;
        return c.chat_members.some(m => m.id === uid || m.id === String(uid));
    });

    // Attach messages to each chat
    const result = await Promise.all(userChats.map(async (chat) => {
        const messages = await getAllMessages(chat.id);
        return { ...chat, messages };
    }));

    return result;
}

async function getAllMessages(chat_id) {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chat_id)  // NOTE: your schema has "chat_id" - check and fix if needed
        .order('created_at', { ascending: true });
    if (error) { console.log('getAllMessages error:', error.message); return []; }
    return data || [];
}

async function saveMessage(chat_id, sender_id, content, file_url, file_type) {
    const insert = { chat_id, sender_id, content };
    if (file_url) insert.file_url = file_url;
    if (file_type) insert.file_type = file_type;

    const { data, error } = await supabase
        .from('messages')
        .insert(insert)
        .select().single();
    if (error) { console.log('saveMessage error:', error.message); return null; }
    return data;
}

async function findDirectChat(user_id_1, user_id_2) {
    const { data: chats, error } = await supabase
        .from('chats').select('*').eq('type', 'direct');
    if (error || !chats) return null;

    const uid1 = parseInt(user_id_1);
    const uid2 = parseInt(user_id_2);

    return chats.find(c => {
        if (!Array.isArray(c.chat_members) || c.chat_members.length !== 2) return false;
        const ids = c.chat_members.map(m => parseInt(m.id));
        return ids.includes(uid1) && ids.includes(uid2);
    }) || null;
}

module.exports = { register, login, getUser, searchUser, createChat, getChat, getAllChats, getAllMessages, saveMessage, findDirectChat };
