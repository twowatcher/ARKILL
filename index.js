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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const PREFIX = '!';
const queue = new Map();      // Fila de música
const xpData = new Map();     // Sistema de XP
const WELCOME_CHANNEL_ID = '1411812421814849536';

// ==================== BOT INICIANDO ====================
client.once('ready', () => {
    console.log(`✅ PHANTOM Bot ONLINE! 👻`);
    client.user.setActivity('nas sombras 👻', { type: 'WATCHING' });
});

// ==================== WELCOME ====================
client.on('guildMemberAdd', async member => {
    const channel = await client.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
    if (channel) {
        const embed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('👻 Novo Membro Chegou!')
            .setDescription(`Bem-vindo(a) **${member.user.tag}**!\n\nEsperamos que você se divirta bastante aqui!`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();
        channel.send({ embeds: [embed] });
    }
});

// ==================== XP SYSTEM ====================
client.on('messageCreate', message => {
    if (message.author.bot) return;

    if (!xpData.has(message.author.id)) {
        xpData.set(message.author.id, { xp: 0, level: 1 });
    }

    const user = xpData.get(message.author.id);
    user.xp += Math.floor(Math.random() * 10) + 5;

    if (user.xp >= user.level * 120) {
        user.level++;
        user.xp = 0;
        message.reply(`🎉 **${message.author.username}** subiu para o **nível ${user.level}**!`);
    }
});

// ==================== COMANDOS ====================
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const guildQueue = queue.get(message.guild.id);

    // !ping
    if (command === 'ping') {
        message.reply(`🏓 Pong! ${Date.now() - message.createdTimestamp}ms`);
    }

    // !nivel
    if (command === 'nivel' || command === 'level') {
        const user = xpData.get(message.author.id) || { xp: 0, level: 1 };
        message.reply(`📊 **${message.author.username}**\nNível: **${user.level}**\nXP: **${user.xp} / ${user.level * 120}**`);
    }

    // !play
    if (command === 'play') {
        if (!args[0]) return message.reply('❌ Use: `!play <link do YouTube>`');

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ Você precisa estar em um canal de voz!');

        const query = args.join(' ');

        if (!guildQueue) {
            const queueConstruct = {
                voiceChannel,
                textChannel: message.channel,
                connection: null,
                songs: []
            };
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
            message.reply(`✅ **${query}** adicionada na fila!`);
        }
    }

    // !skip
    if (command === 'skip') {
        if (!guildQueue || !guildQueue.songs.length) return message.reply('❌ Nada tocando!');
        guildQueue.songs.shift();
        playSong(message.guild.id);
        message.reply('⏭️ Música pulada!');
    }

    // !stop
    if (command === 'stop') {
        if (guildQueue) {
            guildQueue.songs = [];
            guildQueue.connection.destroy();
            queue.delete(message.guild.id);
        }
        message.reply('⏹️ Parado e desconectado!');
    }

    // !ajuda
    if (command === 'ajuda' || command === 'comandos') {
        const embed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('👻 PHANTOM Bot - Comandos')
            .addFields(
                { name: '🎵 Música', value: '`!play <link>`\n`!skip`\n`!stop`' },
                { name: '📊 Outros', value: '`!ping`\n`!nivel`\n`!ajuda`' }
            );
        message.reply({ embeds: [embed] });
    }
});

async function playSong(guildId) {
    const guildQueue = queue.get(guildId);
    if (!guildQueue || guildQueue.songs.length === 0) {
        if (guildQueue) guildQueue.connection.destroy();
        queue.delete(guildId);
        return;
    }

    try {
        const resource = createAudioResource(ytdl(guildQueue.songs[0], { filter: 'audioonly' }));
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

// ==================== SITE ====================
app.use(express.static('public'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Painel rodando na porta ${PORT}`);
});