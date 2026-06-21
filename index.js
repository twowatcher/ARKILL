require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const app = express();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

const PREFIX = '!';

// ==================== READY ====================
client.once('ready', () => {
    console.log(`✅ PHANTOM Bot online! 👻`);
    client.user.setActivity('nas sombras 👻', { type: 'WATCHING' });
});

// Comandos básicos
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'ajuda' || command === 'comandos') {
        message.reply('**PHANTOM Bot**\n`!ping` - Testar\n`!play` - Música (em breve)\n`!nivel` - Seu nível');
    }

    if (command === 'ping') {
        message.reply(`🏓 Pong! ${Date.now() - message.createdTimestamp}ms`);
    }
});

client.login(process.env.TOKEN);

// ==================== SITE ====================
app.use(express.static('public'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Site rodando na porta ${PORT}`);
});