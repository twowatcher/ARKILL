require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const express = require('express');
const app = express();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const PREFIX = '!';
const queue = new Map();

// READY
client.once('ready', () => {
    console.log(`✅ PHANTOM Bot (Música) online! 👻`);
    client.user.setActivity('Spotify & YouTube', { type: 'LISTENING' });
});

// PLAY
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const guildQueue = queue.get(message.guild.id);

    if (command === 'play') {
        if (!args[0]) return message.reply('❌ Use: `!play <link ou nome>`');

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ Entre em um canal de voz!');

        let query = args.join(' ');

        if (!guildQueue) {
            const queueConstruct = { voiceChannel, textChannel: message.channel, connection: null, songs: [] };
            queue.set(message.guild.id, queueConstruct);

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });
            queueConstruct.connection = connection;

            queueConstruct.songs.push(query);
            playSong(message.guild.id);
        } else {
            guildQueue.songs.push(query);
            message.reply(`✅ Adicionado à fila: **${query}**`);
        }
    }

    if (command === 'skip') {
        if (guildQueue && guildQueue.songs.length > 0) {
            guildQueue.songs.shift();
            playSong(message.guild.id);
            message.reply('⏭️ Pulou a música!');
        }
    }

    if (command === 'stop') {
        if (guildQueue) {
            guildQueue.connection.destroy();
            queue.delete(message.guild.id);
        }
        message.reply('⏹️ Parado!');
    }

    if (command === 'ajuda') {
        message.reply('**Comandos de Música:**\n`!play <link>`\n`!skip`\n`!stop`');
    }
});

async function playSong(guildId) {
    const guildQueue = queue.get(guildId);
    if (!guildQueue || guildQueue.songs.length === 0) {
        if (guildQueue) guildQueue.connection.destroy();
        queue.delete(guildId);
        return;
    }

    const song = guildQueue.songs[0];
    try {
        const resource = createAudioResource(ytdl(song, { filter: 'audioonly' }));
        const player = createAudioPlayer();
        guildQueue.connection.subscribe(player);
        player.play(resource);

        player.on(AudioPlayerStatus.Idle, () => {
            guildQueue.songs.shift();
            playSong(guildId);
        });
    } catch (e) {
        console.error(e);
        guildQueue.songs.shift();
        playSong(guildId);
    }
}

client.login(process.env.TOKEN);

app.use(express.static('public'));
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Painel rodando`));