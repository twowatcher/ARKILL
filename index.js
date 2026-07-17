require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    PermissionsBitField, 
    ApplicationCommandOptionType, 
    ChannelType 
} = require('discord.js');
const Database = require('better-sqlite3');

// Inicializa o Banco de Dados SQLite
const db = new Database('database.sqlite');

// Criação das tabelas caso não existam
db.prepare(`
    CREATE TABLE IF NOT EXISTS bank (
        userId TEXT PRIMARY KEY,
        balance INTEGER DEFAULT 100
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS welcomeConfig (
        guildId TEXT PRIMARY KEY,
        channelId TEXT,
        roleId TEXT,
        message TEXT
    )
`).run();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});

// Cores padrões para os Embeds
const COLORS = {
    SUCCESS: 0x00FF99,  // Verde claro
    ERROR: 0xFF3333,    // Vermelho
    INFO: 0x0099FF,     // Azul
    FUN: 0x9933FF,      // Roxo
    ECONOMY: 0xFFCC00,  // Dourado/Amarelo
    NEUTRAL: 0x2F3136   // Cinza escuro (padrão Discord)
};

// ==================== FUNÇÕES AUXILIARES DO BANCO ====================
const getAccount = (userId) => {
    let row = db.prepare('SELECT * FROM bank WHERE userId = ?').get(userId);
    if (!row) {
        db.prepare('INSERT INTO bank (userId, balance) VALUES (?, ?)').run(userId, 100);
        row = { userId, balance: 100 };
    }
    return row;
};

const updateBalance = (userId, amount) => {
    getAccount(userId);
    db.prepare('UPDATE bank SET balance = balance + ? WHERE userId = ?').run(amount, userId);
};

const getWelcomeConfig = (guildId) => {
    let row = db.prepare('SELECT * FROM welcomeConfig WHERE guildId = ?').get(guildId);
    if (!row) {
        db.prepare('INSERT INTO welcomeConfig (guildId) VALUES (?)').run(guildId);
        row = { guildId, channelId: null, roleId: null, message: null };
    }
    return row;
};

const updateWelcomeConfig = (guildId, field, value) => {
    getWelcomeConfig(guildId);
    db.prepare(`UPDATE welcomeConfig SET ${field} = ? WHERE guildId = ?`).run(value, guildId);
};

// ==================== SLASH COMMANDS REGISTRATION ====================
const commandsData = [
    { name: 'welcome-config', description: 'Set the welcome channel for new members.', options: [{ name: 'channel', description: 'Select the text channel', type: ApplicationCommandOptionType.Channel, channelTypes: [ChannelType.GuildText], required: true }] },
    { name: 'message-config', description: 'Set the custom welcome message.', options: [{ name: 'message', description: 'Use {member}, {server}, and {total} as placeholders.', type: ApplicationCommandOptionType.String, required: true }] },
    { name: 'role-config', description: 'Set the auto-role given to new members.', options: [{ name: 'role', description: 'Select the role', type: ApplicationCommandOptionType.Role, required: true }] },
    { name: 'ping', description: 'Check the bot\'s latency.' },
    { name: 'clear', description: 'Delete a number of messages in the channel.', options: [{ name: 'amount', description: 'Number of messages (1-99)', type: ApplicationCommandOptionType.Integer, required: true }] },
    { name: 'kick', description: 'Kick a member from the server.', options: [{ name: 'member', description: 'Member to kick', type: ApplicationCommandOptionType.User, required: true }, { name: 'reason', description: 'Reason for the kick', type: ApplicationCommandOptionType.String, required: false }] },
    { name: 'ban', description: 'Ban a member from the server.', options: [{ name: 'member', description: 'Member to ban', type: ApplicationCommandOptionType.User, required: true }, { name: 'reason', description: 'Reason for the ban', type: ApplicationCommandOptionType.String, required: false }] },
    { name: 'meme', description: 'Send a random meme or funny quote.' },
    { name: 'lock', description: 'Lock the current text channel.' },
    { name: 'unlock', description: 'Unlock the current text channel.' },
    { name: 'slow-mode', description: 'Set slow mode for the current channel.', options: [{ name: 'seconds', description: 'Time in seconds (0 to disable)', type: ApplicationCommandOptionType.Integer, required: true }] },
    { name: 'warn', description: 'Warn a member.', options: [{ name: 'member', description: 'Member to warn', type: ApplicationCommandOptionType.User, required: true }, { name: 'reason', description: 'Reason for the warning', type: ApplicationCommandOptionType.String, required: false }] },
    { name: 'set-nick', description: 'Change a member\'s nickname.', options: [{ name: 'member', description: 'Select the member', type: ApplicationCommandOptionType.User, required: true }, { name: 'nickname', description: 'New nickname', type: ApplicationCommandOptionType.String, required: true }] },
    { name: 'server-info', description: 'Display server information.' },
    { name: 'avatar', description: 'Show a user\'s avatar.', options: [{ name: 'user', description: 'Select the user (leave blank for yourself)', type: ApplicationCommandOptionType.User, required: false }] },
    { name: 'user-info', description: 'Show user information.', options: [{ name: 'user', description: 'Select the user (leave blank for yourself)', type: ApplicationCommandOptionType.User, required: false }] },
    { name: 'uptime', description: 'Show how long the bot has been online.' },
    { name: 'say', description: 'Make the bot say something in the channel.', options: [{ name: 'message', description: 'What should I say?', type: ApplicationCommandOptionType.String, required: true }] },
    { name: 'giveaway', description: 'Quick giveaway among members.', options: [{ name: 'prize', description: 'What is being raffled?', type: ApplicationCommandOptionType.String, required: true }] },
    { name: 'invite', description: 'Get the invite link for this bot.' },
    { name: 'calculator', description: 'Perform a simple mathematical operation.', options: [
        { name: 'number1', description: 'First number', type: ApplicationCommandOptionType.Number, required: true },
        { name: 'operation', description: 'Choose the operation', type: ApplicationCommandOptionType.String, required: true, choices: [
            { name: 'Add (+)', value: '+' }, { name: 'Subtract (-)', value: '-' },
            { name: 'Multiply (*)', value: '*' }, { name: 'Divide (/)', value: '/' }
        ]},
        { name: 'number2', description: 'Second number', type: ApplicationCommandOptionType.Number, required: true }
    ]},
    { name: 'rules', description: 'Show the server rules.' },
    { name: 'links', description: 'Show useful links and social media.' },
    { name: 'roll', description: 'Roll a die with custom number of sides.', options: [{ name: 'sides', description: 'Number of sides (Default: 6)', type: ApplicationCommandOptionType.Integer, required: false }] },
    { name: 'coin-flip', description: 'Flip a coin.' },
    { name: 'fortune-cookie', description: 'Open a fortune cookie.' },
    { name: '8ball', description: 'Ask the magic 8-ball a question.', options: [{ name: 'question', description: 'Write your question', type: ApplicationCommandOptionType.String, required: true }] },
    { name: 'hug', description: 'Hug someone.', options: [{ name: 'member', description: 'Who do you want to hug?', type: ApplicationCommandOptionType.User, required: true }] },
    { name: 'kiss', description: 'Kiss someone.', options: [{ name: 'member', description: 'Who do you want to kiss?', type: ApplicationCommandOptionType.User, required: true }] },
    { name: 'slap', description: 'Slap someone.', options: [{ name: 'member', description: 'Who deserves a slap?', type: ApplicationCommandOptionType.User, required: true }] },
    { name: 'pickup-line', description: 'Send a smooth pickup line.' },
    { name: 'joke', description: 'Tell a random joke.' },
    { name: 'attack', description: 'Attack a user.', options: [{ name: 'member', description: 'Who do you want to attack?', type: ApplicationCommandOptionType.User, required: true }] },
    { name: 'compliment', description: 'Compliment a member.', options: [{ name: 'member', description: 'Who do you want to compliment?', type: ApplicationCommandOptionType.User, required: true }] },
    { name: 'reverse', description: 'Reverse the given text.', options: [{ name: 'text', description: 'Text to reverse', type: ApplicationCommandOptionType.String, required: true }] },
    { name: 'ship', description: 'Calculate love compatibility.', options: [{ name: 'member', description: 'The target of Cupid', type: ApplicationCommandOptionType.User, required: true }] },
    { name: 'chances', description: 'Calculate the chance of something happening.', options: [{ name: 'question', description: 'Chance of what?', type: ApplicationCommandOptionType.String, required: true }] },
    { name: 'cow-level', description: 'Check someone\'s simp level.', options: [{ name: 'user', description: 'Select the user', type: ApplicationCommandOptionType.User, required: false }] },
    { name: 'iq', description: 'Calculate someone\'s IQ.', options: [{ name: 'user', description: 'Select the user', type: ApplicationCommandOptionType.User, required: false }] },
    { name: 'dollar', description: 'Get a funny take on the dollar exchange rate.' },
    { name: 'choose', description: 'Make the bot choose between options.', options: [
        { name: 'option1', description: 'First option', type: ApplicationCommandOptionType.String, required: true },
        { name: 'option2', description: 'Second option', type: ApplicationCommandOptionType.String, required: true }
    ]},
    { name: 'poll', description: 'Create a yes/no poll.', options: [{ name: 'topic', description: 'Poll topic', type: ApplicationCommandOptionType.String, required: true }] },
    { name: 'balance', description: 'Check your balance.' },
    { name: 'daily', description: 'Claim your daily reward.' },
    { name: 'work', description: 'Work and earn money.' },
    { name: 'bet', description: 'Bet on a coin flip.', options: [{ name: 'amount', description: 'Amount to bet', type: ApplicationCommandOptionType.Integer, required: true }] },
    { name: 'donate', description: 'Donate money to a friend.', options: [
        { name: 'member', description: 'Recipient', type: ApplicationCommandOptionType.User, required: true },
        { name: 'amount', description: 'Amount to donate', type: ApplicationCommandOptionType.Integer, required: true }
    ]},
    { name: 'rock-paper-scissors', description: 'Play Rock Paper Scissors against the bot.', options: [{ name: 'choice', description: 'Your choice', type: ApplicationCommandOptionType.String, required: true, choices: [
        { name: 'Rock 🪨', value: 'rock' }, { name: 'Paper 📄', value: 'paper' }, { name: 'Scissors ✂️', value: 'scissors' }
    ]}]},
    { name: 'guess', description: 'Guess a number between 1 and 10.', options: [{ name: 'number', description: 'Your guess', type: ApplicationCommandOptionType.Integer, required: true }] },
    { name: 'fps', description: 'Check your mood in FPS.' },
    { name: 'hack', description: 'Simulate hacking a friend.', options: [{ name: 'member', description: 'Target', type: ApplicationCommandOptionType.User, required: true }] },
    { name: 'russian-roulette', description: 'Play Russian Roulette.' },
    { name: 'punch', description: 'Punch someone.', options: [{ name: 'member', description: 'Target', type: ApplicationCommandOptionType.User, required: true }] },
    { name: 'bite', description: 'Bite someone.', options: [{ name: 'member', description: 'Target', type: ApplicationCommandOptionType.User, required: true }] },
    { name: 'kill', description: '"Kill" someone in chat.', options: [{ name: 'member', description: 'Target', type: ApplicationCommandOptionType.User, required: true }] },
    { name: 'run', description: 'Run away from the channel!' },
    { name: 'help', description: 'Show all available commands.' }
];

// ==================== WELCOME EVENT ====================
client.on('guildMemberAdd', async (member) => {
    const config = getWelcomeConfig(member.guild.id);
    if (!config) return;

    if (config.roleId) {
        const role = member.guild.roles.cache.get(config.roleId);
        if (role) await member.roles.add(role).catch(() => {});
    }

    if (config.channelId) {
        const channel = member.guild.channels.cache.get(config.channelId);
        if (channel) {
            let message = config.message || "Welcome {member} to {server}! We now have {total} members!";
            message = message
                .replace(/{member}/g, `${member}`)
                .replace(/{server}/g, member.guild.name)
                .replace(/{total}/g, member.guild.memberCount);

            const embed = new EmbedBuilder()
                .setColor(COLORS.SUCCESS)
                .setTitle('✨ Welcome!')
                .setDescription(message)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            await channel.send({ embeds: [embed] }).catch(() => {});
        }
    }
});

// ==================== BOT READY ====================
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} is online!`);
    client.user.setActivity('moderating with style', { type: 3 });

    try {
        await client.application.commands.set(commandsData);
        console.log('✅ All Slash Commands registered successfully!');
    } catch (error) {
        console.error('Failed to register commands:', error);
    }
});

// ==================== COMMAND HANDLER ====================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, guild, member, channel, user } = interaction;

    // Helper rápido para gerar Embeds de resposta padrão (Sucesso, Erro, Info, etc.)
    const replyEmbed = (title, description, color = COLORS.INFO, ephemeral = false) => {
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(description)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral });
    };

    // ===================== CONFIG =====================
    if (commandName === 'welcome-config') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator))
            return replyEmbed('❌ Access Denied', 'Only administrators can use this command.', COLORS.ERROR, true);
        
        const targetChannel = options.getChannel('channel');
        updateWelcomeConfig(guild.id, 'channelId', targetChannel.id);
        return replyEmbed('✅ Configuration Updated', `Welcome channel set successfully to ${targetChannel}!`, COLORS.SUCCESS, true);
    }

    if (commandName === 'message-config') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator))
            return replyEmbed('❌ Access Denied', 'Only administrators can use this command.', COLORS.ERROR, true);
        
        const welcomeMessage = options.getString('message');
        updateWelcomeConfig(guild.id, 'message', welcomeMessage);
        return replyEmbed('✅ Configuration Updated', `Welcome message updated!\n\n**Preview:**\n${welcomeMessage}`, COLORS.SUCCESS, true);
    }

    if (commandName === 'role-config') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator))
            return replyEmbed('❌ Access Denied', 'Only administrators can use this command.', COLORS.ERROR, true);
        
        const role = options.getRole('role');
        updateWelcomeConfig(guild.id, 'roleId', role.id);
        return replyEmbed('✅ Configuration Updated', `Auto-role has been set to ${role}!`, COLORS.SUCCESS, true);
    }

    // ===================== MODERATION =====================
    if (commandName === 'ping') {
        const pingTime = Date.now() - interaction.createdTimestamp;
        return replyEmbed('🏓 Pong!', `Bot Latency: \`${pingTime}ms\`\nAPI Latency: \`${Math.round(client.ws.ping)}ms\``, COLORS.INFO);
    }

    if (commandName === 'clear') {
        if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages))
            return replyEmbed('❌ Permission Denied', 'You lack permission to manage messages.', COLORS.ERROR, true);
        
        const amount = options.getInteger('amount');
        if (amount < 1 || amount > 99) 
            return replyEmbed('❌ Invalid Amount', 'Amount must be between 1 and 99.', COLORS.ERROR, true);
        
        await channel.bulkDelete(amount, true);
        return replyEmbed('🧹 Channel Cleaned', `Successfully deleted **${amount}** messages in this channel.`, COLORS.SUCCESS);
    }

    if (commandName === 'kick') {
        if (!member.permissions.has(PermissionsBitField.Flags.KickMembers))
            return replyEmbed('❌ Permission Denied', 'You lack permission to kick members.', COLORS.ERROR, true);
        
        const target = options.getUser('member');
        const reason = options.getString('reason') || 'No reason provided';
        const targetMember = await guild.members.fetch(target.id).catch(() => null);
        
        if (!targetMember) return replyEmbed('❌ Member Not Found', 'Could not locate that member on this server.', COLORS.ERROR, true);
        await targetMember.kick(reason);
        return replyEmbed('🚪 Member Kicked', `**${target.tag}** has been kicked from the server.\n\n**Reason:** ${reason}`, COLORS.SUCCESS);
    }

    if (commandName === 'ban') {
        if (!member.permissions.has(PermissionsBitField.Flags.BanMembers))
            return replyEmbed('❌ Permission Denied', 'You lack permission to ban members.', COLORS.ERROR, true);
        
        const target = options.getUser('member');
        const reason = options.getString('reason') || 'Violated server rules';
        const targetMember = await guild.members.fetch(target.id).catch(() => null);
        
        if (!targetMember) return replyEmbed('❌ Member Not Found', 'Could not locate that member on this server.', COLORS.ERROR, true);
        await targetMember.ban({ reason });
        return replyEmbed('🔨 Member Banned', `**${target.tag}** has been banned from the server.\n\n**Reason:** ${reason}`, COLORS.SUCCESS);
    }

    if (commandName === 'lock') {
        if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels))
            return replyEmbed('❌ Permission Denied', 'You lack permission to manage channels.', COLORS.ERROR, true);
        
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        return replyEmbed('🔒 Channel Locked', 'This text channel has been locked. Only administrators/moderators can send messages.', COLORS.ERROR);
    }

    if (commandName === 'unlock') {
        if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels))
            return replyEmbed('❌ Permission Denied', 'You lack permission to manage channels.', COLORS.ERROR, true);
        
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
        return replyEmbed('🔓 Channel Unlocked', 'This channel has been unlocked. Everyone can chat again!', COLORS.SUCCESS);
    }

    if (commandName === 'slow-mode') {
        if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels))
            return replyEmbed('❌ Permission Denied', 'You lack permission to manage channels.', COLORS.ERROR, true);
        
        const seconds = options.getInteger('seconds');
        await channel.setRateLimitPerUser(seconds);
        return replyEmbed('⏳ Slow Mode Updated', `Slow mode has been set to **${seconds}** seconds.`, COLORS.INFO);
    }

    if (commandName === 'warn') {
        const target = options.getUser('member');
        const reason = options.getString('reason') || 'No reason provided';
        return replyEmbed('⚠️ Warning Issued', `**Target:** ${target}\n**Reason:** ${reason}\n\nPlease follow the server rules.`, COLORS.ERROR);
    }

    if (commandName === 'set-nick') {
        if (!member.permissions.has(PermissionsBitField.Flags.ManageNicknames))
            return replyEmbed('❌ Permission Denied', 'You lack permission to manage nicknames.', COLORS.ERROR, true);
        
        const target = options.getUser('member');
        const nickname = options.getString('nickname');
        const targetMember = await guild.members.fetch(target.id).catch(() => null);
        
        if (!targetMember) return replyEmbed('❌ Member Not Found', 'Could not locate that member.', COLORS.ERROR, true);
        await targetMember.setNickname(nickname);
        return replyEmbed('📝 Nickname Updated', `Changed **${target.username}**'s nickname to **${nickname}**.`, COLORS.SUCCESS);
    }

    // ===================== UTILITIES =====================
    if (commandName === 'server-info') {
        const embed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle(`📊 Server Info: ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '👥 Total Members', value: `${guild.memberCount}`, inline: true },
                { name: '📅 Created At', value: guild.createdAt.toLocaleDateString('en-US'), inline: true },
                { name: '👑 Server Owner', value: `<@${guild.ownerId}>`, inline: true }
            )
            .setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'avatar') {
        const target = options.getUser('user') || user;
        const avatarUrl = target.displayAvatarURL({ dynamic: true, size: 1024 });
        
        const embed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle(`🖼️ ${target.username}'s Avatar`)
            .setImage(avatarUrl)
            .setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'user-info') {
        const target = options.getUser('user') || user;
        const embed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle(`👤 User Info: ${target.username}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Tag', value: `\`${target.tag}\``, inline: true },
                { name: 'ID', value: `\`${target.id}\``, inline: true },
                { name: 'Created', value: target.createdAt.toLocaleDateString('en-US'), inline: false }
            )
            .setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'uptime') {
        let totalSeconds = Math.floor(client.uptime / 1000);
        const days = Math.floor(totalSeconds / 86400);
        totalSeconds %= 86400;
        const hours = Math.floor(totalSeconds / 3600);
        totalSeconds %= 3600;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        return replyEmbed('⏰ Bot Uptime', `I have been active and running for:\n\`${days}d ${hours}h ${minutes}m ${seconds}s\``, COLORS.INFO);
    }

    if (commandName === 'say') {
        const text = options.getString('message');
        await interaction.deferReply({ ephemeral: true });
        
        const embed = new EmbedBuilder()
            .setColor(COLORS.NEUTRAL)
            .setDescription(text);
            
        await channel.send({ embeds: [embed] });
        return interaction.editReply({ content: '✅ Message sent!' });
    }

    if (commandName === 'giveaway') {
        const prize = options.getString('prize');
        const members = await guild.members.fetch();
        const winner = members.filter(m => !m.user.bot).random();
        
        if (!winner) return replyEmbed('❌ Error', 'Not enough members found to complete a giveaway.', COLORS.ERROR);
        
        const embed = new EmbedBuilder()
            .setColor(COLORS.FUN)
            .setTitle('🎉 GIVEAWAY ENDED! 🎉')
            .setDescription(`**Prize:** 🎁 **${prize}**\n\n**Winner:** Congratulations ${winner}! Check your DMs.`)
            .setFooter({ text: 'Host giveaway in style!' });
            
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'invite') {
        const link = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
        const embed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle('🔗 Invite Me!')
            .setDescription(`Ready to add style to your server? Use the button or link below:\n\n[Click here to Invite me!](${link})`)
            .setThumbnail(client.user.displayAvatarURL());
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'calculator') {
        const n1 = options.getNumber('number1');
        const op = options.getString('operation');
        const n2 = options.getNumber('number2');
        let result;
        if (op === '+') result = n1 + n2;
        else if (op === '-') result = n1 - n2;
        else if (op === '*') result = n1 * n2;
        else if (op === '/') result = n1 / n2;
        
        return replyEmbed('🔢 Calculator', `**Operation:** \`${n1} ${op} ${n2}\`\n**Result:** \`${result}\``, COLORS.INFO);
    }

    if (commandName === 'rules') {
        const embed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle('📜 Server Rules')
            .setDescription('Please read and strictly follow these rules to maintain a safe environment:\n\n1. **Be respectful** to all members.\n2. **No spamming** or flood in channels.\n3. **Have fun** and enjoy your stay!')
            .setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'links') {
        const embed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle('🌐 Quick Links')
            .setDescription('🔗 **Website:** *Coming soon...*\n🐦 **Twitter/X:** *Coming soon...*')
            .setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }

    // ===================== FUN COMMANDS =====================
    if (commandName === 'meme') {
        const memes = ["Why do programmers prefer dark mode? Because light attracts bugs.", "The code works... I don't know why. Don't touch it.","https://tenor.com/tN24QWBRpuW.gif","https://tenor.com/bXdTS.gif"];
        const select = memes[Math.floor(Math.random() * memes.length)];
        
        const embed = new EmbedBuilder().setColor(COLORS.FUN).setTitle('🤣 Random Meme');
        if (select.startsWith('http')) {
            embed.setImage(select);
        } else {
            embed.setDescription(select);
        }
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'roll') {
        const sides = options.getInteger('sides') || 6;
        const result = Math.floor(Math.random() * sides) + 1;
        return replyEmbed('🎲 Dice Roller', `You rolled a **${sides}**-sided die and got:\n\n🎯 **${result}**`, COLORS.FUN);
    }

    if (commandName === 'coin-flip') {
        const result = Math.random() > 0.5 ? 'Heads 🪙' : 'Tails 🪙';
        return replyEmbed('🪙 Coin Flip', `The coin spun and landed on:\n\n✨ **${result}**`, COLORS.FUN);
    }

    if (commandName === 'fortune-cookie') {
        const fortunes = ["You will have an amazing day!", "The reward for good work is more work.", "Great things are coming your way."];
        const choice = fortunes[Math.floor(Math.random() * fortunes.length)];
        return replyEmbed('🥠 Fortune Cookie', `You crack open the cookie and find a message:\n\n*"${choice}"*`, COLORS.FUN);
    }

    if (commandName === '8ball') {
        const answers = ['Yes!', 'No.', 'Maybe.', 'Definitely!', 'Ask again later.'];
        const question = options.getString('question');
        const choice = answers[Math.floor(Math.random() * answers.length)];
        
        const embed = new EmbedBuilder()
            .setColor(COLORS.FUN)
            .setTitle('🔮 Magic 8-Ball')
            .addFields(
                { name: 'Question:', value: question },
                { name: 'Answer:', value: `**${choice}**` }
            );
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'hug') {
        const target = options.getUser('member');
        const embed = new EmbedBuilder()
            .setColor(COLORS.FUN)
            .setDescription(`🤗 **${user}** gave **${target}** a warm, cozy hug!`)
            .setImage('https://tenor.com/b1Zxv.gif');
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'kiss') {
        const target = options.getUser('member');
        const embed = new EmbedBuilder()
            .setColor(COLORS.FUN)
            .setDescription(`💋 **${user}** kissed **${target}** tenderly!`)
            .setImage('https://tenor.com/qp9WqCNJAo1.gif');
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'slap') {
        const target = options.getUser('member');
        const embed = new EmbedBuilder()
            .setColor(COLORS.FUN)
            .setDescription(`💥 **${user}** slapped **${target}** right across the face! Ouch!`)
            .setImage('https://tenor.com/m8uf7aoaTic.gif');
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'pickup-line') {
        const lines = ["Are you Wi-Fi? Because I'm feeling a connection.", "Do you have a map? I keep getting lost in your eyes."];
        const line = lines[Math.floor(Math.random() * lines.length)];
        return replyEmbed('😏 Smooth Operator', `*"${line}"*`, COLORS.FUN);
    }

    if (commandName === 'joke') {
        const jokes = ["Why don't skeletons fight each other? They don't have the guts.", "Why did the scarecrow win an award? He was outstanding in his field."];
        const joke = jokes[Math.floor(Math.random() * jokes.length)];
        return replyEmbed('😂 Bad Joke Generator', joke, COLORS.FUN);
    }

    if (commandName === 'attack') {
        const target = options.getUser('member');
        const dmg = Math.floor(Math.random() * 100);
        return replyEmbed('⚔️ Battle Report', `💥 **${user.username}** attacked **${target.username}** dealing **${dmg}** points of critical damage!`, COLORS.FUN);
    }

    if (commandName === 'compliment') {
        const target = options.getUser('member');
        const embed = new EmbedBuilder()
            .setColor(COLORS.FUN)
            .setDescription(`✨ ${target}, **${user.username}** wants you to know that you're absolutely amazing!`)
            .setImage('https://tenor.com/ngdezKbCGGU.gif');
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'reverse') {
        const text = options.getString('text');
        const reversed = text.split('').reverse().join('');
        return replyEmbed('🔄 Text Reverser', `**Original:** ${text}\n**Reversed:** \`${reversed}\``, COLORS.FUN);
    }

    if (commandName === 'ship') {
        const target = options.getUser('member');
        const percent = Math.floor(Math.random() * 101);
        return replyEmbed('❤️ Love Meter', `**${user.username}** + **${target.username}** are **${percent}%** compatible!`, COLORS.FUN);
    }

    if (commandName === 'chances') {
        const q = options.getString('question');
        const percent = Math.floor(Math.random() * 101);
        return replyEmbed('📊 Chance Estimator', `**Query:** "${q}"\n\n🎲 Probability: **${percent}%**`, COLORS.FUN);
    }

    if (commandName === 'cow-level') {
        const target = options.getUser('user') || user;
        const score = Math.floor(Math.random() * 101);
        return replyEmbed('🐂 Simp-O-Meter', `**${target.username}** is currently **${score}%** a simp.`, COLORS.FUN);
    }

    if (commandName === 'iq') {
        const target = options.getUser('user') || user;
        const iqScore = Math.floor(Math.random() * 200);
        return replyEmbed('🧠 IQ Scanner', `**${target.username}**'s calculated IQ is:\n\n🔥 **${iqScore}**`, COLORS.FUN);
    }

    if (commandName === 'dollar') {
        return replyEmbed('💵 Market Update', 'The dollar is expensive today. Stop slacking and go work!', COLORS.FUN);
    }

    if (commandName === 'choose') {
        const opt1 = options.getString('option1');
        const opt2 = options.getString('option2');
        const choice = [opt1, opt2][Math.floor(Math.random() * 2)];
        return replyEmbed('🤔 Decider', `Options: \`1. ${opt1}\` | \`2. ${opt2}\`\n\nI choose: **${choice}**!`, COLORS.FUN);
    }

    if (commandName === 'poll') {
        const topic = options.getString('topic');
        const embed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle('📊 PUBLIC POLL')
            .setDescription(`**Topic:**\n${topic}\n\nReact with 👍 or 👎 to cast your vote!`)
            .setFooter({ text: `Created by ${user.username}` });
            
        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
        await msg.react('👍'); 
        await msg.react('👎');
    }

    // ===================== ECONOMY =====================
    if (commandName === 'balance') {
        const account = getAccount(user.id);
        return replyEmbed('💰 Account Balance', `**User:** ${user}\n**Current Balance:** \`$${account.balance}\``, COLORS.ECONOMY);
    }

    if (commandName === 'daily') {
        updateBalance(user.id, 200);
        return replyEmbed('📆 Daily Reward claimed!', `**+$200** was successfully added to your bank! Check back tomorrow.`, COLORS.ECONOMY);
    }

    if (commandName === 'work') {
        const earnings = Math.floor(Math.random() * 80) + 20;
        updateBalance(user.id, earnings);
        return replyEmbed('💼 Hard Work Pays Off', `You finished your shift and earned:\n\n✨ **+$${earnings}**`, COLORS.ECONOMY);
    }

    if (commandName === 'bet') {
        const account = getAccount(user.id);
        const amount = options.getInteger('amount');
        if (amount <= 0 || amount > account.balance) 
            return replyEmbed('❌ Invalid Bet', 'You cannot bet less than $1 or more than your current wallet balance.', COLORS.ERROR, true);
        
        if (Math.random() > 0.5) {
            updateBalance(user.id, amount);
            return replyEmbed('🎉 WINNER!', `Lucky flip! You won **$${amount}**!`, COLORS.ECONOMY);
        } else {
            updateBalance(user.id, -amount);
            return replyEmbed('😭 DEFEAT', `You lost **$${amount}** in the coin flip. Better luck next time!`, COLORS.ERROR);
        }
    }

    if (commandName === 'donate') {
        const target = options.getUser('member');
        const amount = options.getInteger('amount');
        if (amount <= 0) return replyEmbed('❌ Error', 'Amount must be greater than 0.', COLORS.ERROR, true);
        
        const senderAccount = getAccount(user.id);
        if (senderAccount.balance < amount) return replyEmbed('❌ Transaction Failed', 'Insufficient funds in your bank account.', COLORS.ERROR, true);
        
        updateBalance(user.id, -amount);
        updateBalance(target.id, amount);
        return replyEmbed('💸 Wire Transfer Complete', `You successfully sent **$${amount}** to ${target}.`, COLORS.ECONOMY);
    }

    // ===================== MINI GAMES =====================
    if (commandName === 'rock-paper-scissors') {
        const userChoice = options.getString('choice');
        const botChoices = ['rock', 'paper', 'scissors'];
        const botChoice = botChoices[Math.floor(Math.random() * 3)];
        
        let title = '🤝 Tie Match';
        let desc = `You both chose **${botChoice}**!`;
        let color = COLORS.NEUTRAL;
        
        if ((userChoice === 'rock' && botChoice === 'scissors') || 
            (userChoice === 'paper' && botChoice === 'rock') || 
            (userChoice === 'scissors' && botChoice === 'paper')) {
            title = '🎉 Victory!';
            desc = `You chose **${userChoice}** and I chose **${botChoice}**. You beat me!`;
            color = COLORS.SUCCESS;
        } else if (userChoice !== botChoice) {
            title = '😔 Defeat!';
            desc = `You chose **${userChoice}** and I chose **${botChoice}**. Better luck next time!`;
            color = COLORS.ERROR;
        }
        
        return replyEmbed(title, desc, color);
    }

    if (commandName === 'guess') {
        const secret = Math.floor(Math.random() * 10) + 1;
        const guess = options.getInteger('number');
        
        if (guess === secret) {
            return replyEmbed('🎯 Correct Guess!', `Unbelievable! You guessed the right number: **${secret}**!`, COLORS.SUCCESS);
        } else {
            return replyEmbed('❌ Wrong Guess!', `Close, but wrong! The secret number was **${secret}**. Try again!`, COLORS.ERROR);
        }
    }

    if (commandName === 'fps') {
        const score = Math.floor(Math.random() * 60) + 180;
        return replyEmbed('🎮 Framerate Test', `Your current biological mood is running smooth at:\n\n⚡ **${score} FPS**`, COLORS.FUN);
    }

    if (commandName === 'hack') {
        const target = options.getUser('member');
        return replyEmbed('💻 Executing Cyber-Attack', `Hacking into **${target.username}**'s system...\n\n🔑 **Credential Found:** \`password123\`\n⚡ Host control acquired.`, COLORS.FUN);
    }

    if (commandName === 'russian-roulette') {
        const dead = Math.random() < 0.16;
        if (dead) {
            return replyEmbed('💥 BANG!', 'You pulled the trigger and took a bullet. Game over!', COLORS.ERROR);
        } else {
            return replyEmbed('🏳️ *Click*', 'The chamber was empty. You survived this round!', COLORS.SUCCESS);
        }
    }

    if (commandName === 'punch') {
        const target = options.getUser('member');
        return replyEmbed('🥊 Knockout!', `**${user}** landed a solid punch right in **${target}**'s jaw!`, COLORS.FUN);
    }

    if (commandName === 'bite') {
        const target = options.getUser('member');
        return replyEmbed('😬 Chomp!', `**${user}** sneaked up and bit **${target}**!`, COLORS.FUN);
    }

    if (commandName === 'kill') {
        const target = options.getUser('member');
        return replyEmbed('💀 Elimination', `🔫 **${user}** has terminated **${target}**!`, COLORS.ERROR);
    }

    if (commandName === 'run') {
        return replyEmbed('🏃💨 Escape Route', `**${user.username}** got scared and sprinted out of the channel!`, COLORS.FUN);
    }

    // ===================== HELP =====================
    if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setColor(COLORS.NEUTRAL)
            .setTitle('🔥 Bot Commands List')
            .setDescription('Full featured Discord bot with moderation, games, and SQLite economy!')
            .addFields(
                { name: '⚙️ Configuration', value: '`/welcome-config` `/message-config` `/role-config`', inline: false },
                { name: '🛡️ Moderation', value: '`/clear` `/kick` `/ban` `/lock` `/unlock` `/slow-mode` `/warn` `/set-nick`', inline: false },
                { name: '📊 Utilities', value: '`/ping` `/server-info` `/avatar` `/user-info` `/uptime` `/say` `/giveaway` `/invite` `/calculator`', inline: false },
                { name: '😂 Fun & Social', value: '`/meme` `/roll` `/coin-flip` `/fortune-cookie` `/8ball` `/hug` `/kiss` `/slap` `/pickup-line` `/joke` `/attack` `/compliment` `/reverse` `/ship` `/chances` `/cow-level` `/iq` `/choose` `/poll`', inline: false },
                { name: '💰 Economy', value: '`/balance` `/daily` `/work` `/bet` `/donate`', inline: false },
                { name: '🎮 Mini Games', value: '`/rock-paper-scissors` `/guess` `/fps` `/hack` `/russian-roulette` `/punch` `/bite` `/kill` `/run`', inline: false }
            )
            .setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }
});

client.login(process.env.TOKEN);

// ==================== KEEP ALIVE ====================
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot is online! 🔥'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Keep-alive server running on port ${PORT}`));