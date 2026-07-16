require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    PermissionsBitField, 
    ApplicationCommandOptionType, 
    ChannelType 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});

// In-memory databases
const bank = new Map();
const welcomeConfig = new Map();

// Helper to initialize bank account
const initBankAccount = (userId) => {
    if (!bank.has(userId)) {
        bank.set(userId, { balance: 100 });
    }
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
    const config = welcomeConfig.get(member.guild.id);
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
                .setColor(0x00FF99)
                .setTitle('✨ New Member!')
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

    if (!welcomeConfig.has(guild.id)) {
        welcomeConfig.set(guild.id, { channelId: null, roleId: null, message: null });
    }
    const config = welcomeConfig.get(guild.id);

    // ===================== CONFIG =====================
    if (commandName === 'welcome-config') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator))
            return interaction.reply({ content: '❌ Only administrators can use this command.', ephemeral: true });
        config.channelId = options.getChannel('channel').id;
        return interaction.reply({ content: `✅ Welcome channel set successfully!`, ephemeral: true });
    }

    if (commandName === 'message-config') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator))
            return interaction.reply({ content: '❌ Only administrators can use this command.', ephemeral: true });
        config.message = options.getString('message');
        return interaction.reply({ content: '✅ Welcome message updated!', ephemeral: true });
    }

    if (commandName === 'role-config') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator))
            return interaction.reply({ content: '❌ Only administrators can use this command.', ephemeral: true });
        config.roleId = options.getRole('role').id;
        return interaction.reply({ content: '✅ Auto-role configured!', ephemeral: true });
    }

    // ===================== MODERATION =====================
    if (commandName === 'ping') return interaction.reply(`🏓 Pong! ${Date.now() - interaction.createdTimestamp}ms`);

    if (commandName === 'clear') {
        if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages))
            return interaction.reply({ content: '❌ You lack permission to manage messages.', ephemeral: true });
        const amount = options.getInteger('amount');
        if (amount < 1 || amount > 99) return interaction.reply({ content: '❌ Amount must be between 1 and 99.', ephemeral: true });
        await channel.bulkDelete(amount, true);
        return interaction.reply(`🧹 Cleared ${amount} messages.`);
    }

    if (commandName === 'kick') {
        if (!member.permissions.has(PermissionsBitField.Flags.KickMembers))
            return interaction.reply({ content: '❌ You lack permission to kick members.', ephemeral: true });
        const target = options.getUser('member');
        const reason = options.getString('reason') || 'No reason provided';
        const targetMember = await guild.members.fetch(target.id).catch(() => null);
        if (!targetMember) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });
        await targetMember.kick(reason);
        return interaction.reply(`🚪 **${target.tag}** has been kicked.`);
    }

    if (commandName === 'ban') {
        if (!member.permissions.has(PermissionsBitField.Flags.BanMembers))
            return interaction.reply({ content: '❌ You lack permission to ban members.', ephemeral: true });
        const target = options.getUser('member');
        const reason = options.getString('reason') || 'Violated server rules';
        const targetMember = await guild.members.fetch(target.id).catch(() => null);
        if (!targetMember) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });
        await targetMember.ban({ reason });
        return interaction.reply(`🔨 **${target.tag}** has been banned.`);
    }

    if (commandName === 'lock') {
        if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels))
            return interaction.reply({ content: '❌ You lack permission.', ephemeral: true });
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        return interaction.reply('🔒 Channel locked!');
    }

    if (commandName === 'unlock') {
        if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels))
            return interaction.reply({ content: '❌ You lack permission.', ephemeral: true });
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
        return interaction.reply('🔓 Channel unlocked!');
    }

    if (commandName === 'slow-mode') {
        if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels))
            return interaction.reply({ content: '❌ You lack permission.', ephemeral: true });
        const seconds = options.getInteger('seconds');
        await channel.setRateLimitPerUser(seconds);
        return interaction.reply(`⏳ Slow mode set to ${seconds} seconds.`);
    }

    if (commandName === 'warn') {
        const target = options.getUser('member');
        const reason = options.getString('reason') || 'No reason provided';
        return interaction.reply(`⚠️ **Warning:** ${target} was warned. Reason: ${reason}`);
    }

    if (commandName === 'set-nick') {
        if (!member.permissions.has(PermissionsBitField.Flags.ManageNicknames))
            return interaction.reply({ content: '❌ You lack permission.', ephemeral: true });
        const target = options.getUser('member');
        const nickname = options.getString('nickname');
        const targetMember = await guild.members.fetch(target.id).catch(() => null);
        if (!targetMember) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });
        await targetMember.setNickname(nickname);
        return interaction.reply(`📝 Nickname of ${target.username} changed to **${nickname}**.`);
    }

    // ===================== UTILITIES =====================
    if (commandName === 'server-info') {
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(`📊 ${guild.name} Information`)
            .addFields(
                { name: 'Members', value: `${guild.memberCount}`, inline: true },
                { name: 'Created', value: guild.createdAt.toLocaleDateString('en-US'), inline: true }
            );
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'avatar') {
        const target = options.getUser('user') || user;
        return interaction.reply(`🖼️ **${target.username}'s Avatar:**\n${target.displayAvatarURL({ dynamic: true, size: 1024 })}`);
    }

    if (commandName === 'user-info') {
        const target = options.getUser('user') || user;
        return interaction.reply(`👤 **Name:** ${target.tag}\n🆔 **ID:** ${target.id}\n📅 **Created:** ${target.createdAt.toLocaleDateString('en-US')}`);
    }

    if (commandName === 'uptime') {
        let totalSeconds = Math.floor(client.uptime / 1000);
        const days = Math.floor(totalSeconds / 86400);
        totalSeconds %= 86400;
        const hours = Math.floor(totalSeconds / 3600);
        totalSeconds %= 3600;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return interaction.reply(`⏰ Online for: \`${days}d ${hours}h ${minutes}m ${seconds}s\``);
    }

    if (commandName === 'say') {
        const text = options.getString('message');
        await interaction.deferReply({ ephemeral: true });
        return channel.send(text);
    }

    if (commandName === 'giveaway') {
        const prize = options.getString('prize');
        const members = await guild.members.fetch();
        const winner = members.filter(m => !m.user.bot).random();
        if (!winner) return interaction.reply('Not enough members.');
        return interaction.reply(`🎉 **GIVEAWAY!** Prize: **${prize}**\n🏆 Winner: ${winner}!`);
    }

    if (commandName === 'invite') {
        return interaction.reply(`🔗 Invite me using this link:\nhttps://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`);
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
        return interaction.reply(`🔢 **Result:** ${result}`);
    }

    if (commandName === 'rules') return interaction.reply('📜 **Server Rules:**\n1. Be respectful.\n2. No spam.\n3. Have fun!');
    if (commandName === 'links') return interaction.reply('🌐 **Useful Links:**\n- Website: Coming soon\n- Twitter: Coming soon');

    // ===================== FUN COMMANDS =====================
    if (commandName === 'meme') {
        const memes = ["Why do programmers prefer dark mode? Because light attracts bugs.", "The code works... I don't know why. Don't touch it.","https://tenor.com/tN24QWBRpuW.gif","https://tenor.com/bXdTS.gif",<div class="tenor-gif-embed" data-postid="11375078409552454630" data-share-method="host" data-aspect-ratio="1" data-width="100%"><a href="https://tenor.com/view/ultrakill-gabriel-ultrakill-ultrakill-gabriel-gif-11375078409552454630">Ultrakill Gabriel Ultrakill GIF</a>from <a href="https://tenor.com/search/ultrakill-gifs">Ultrakill GIFs</a></div> <script type="text/javascript" async src="https://tenor.com/embed.js"></script>];
        return interaction.reply(memes[Math.floor(Math.random() * memes.length)]);
    }

    if (commandName === 'roll') {
        const sides = options.getInteger('sides') || 6;
        const result = Math.floor(Math.random() * sides) + 1;
        return interaction.reply(`🎲 You rolled a ${sides}-sided die and got: **${result}**`);
    }

    if (commandName === 'coin-flip') {
        const result = Math.random() > 0.5 ? 'Heads' : 'Tails';
        return interaction.reply(`🪙 It landed on **${result}**!`);
    }

    if (commandName === 'fortune-cookie') {
        const fortunes = ["You will have an amazing day!", "The reward for good work is more work.", "Great things are coming your way."];
        return interaction.reply(`🥠 **Fortune Cookie:** ${fortunes[Math.floor(Math.random() * fortunes.length)]}`);
    }

    if (commandName === '8ball') {
        const answers = ['Yes!', 'No.', 'Maybe.', 'Definitely!', 'Ask again later.'];
        const question = options.getString('question');
        return interaction.reply(`🔮 **Question:** ${question}\n**Answer:** ${answers[Math.floor(Math.random() * answers.length)]}`);
    }

    if (commandName === 'hug') return interaction.reply(`🤗 ${user} hugged ${options.getUser('member')}! https://tenor.com/b1Zxv.gif`);
    if (commandName === 'kiss') return interaction.reply(`💋 ${user} kissed ${options.getUser('member')}! https://tenor.com/qp9WqCNJAo1.gif`);
    if (commandName === 'slap') return interaction.reply(`💥 ${user} slapped ${options.getUser('member')}! https://tenor.com/m8uf7aoaTic.gif`);
    if (commandName === 'pickup-line') {
        const lines = ["Are you Wi-Fi? Because I'm feeling a connection.", "Do you have a map? I keep getting lost in your eyes."];
        return interaction.reply(lines[Math.floor(Math.random() * lines.length)]);
    }
    if (commandName === 'joke') {
        const jokes = ["Why don't skeletons fight each other? They don't have the guts.", "Why did the scarecrow win an award? He was outstanding in his field."];
        return interaction.reply(jokes[Math.floor(Math.random() * jokes.length)]);
    }

    if (commandName === 'attack') return interaction.reply(`⚔️ ${user} attacked ${options.getUser('member')} and dealt **${Math.floor(Math.random() * 100)}** damage!`);
    if (commandName === 'compliment') return interaction.reply(`✨ ${options.getUser('member')}, ${user} says you're amazing! https://tenor.com/ngdezKbCGGU.gif`);
    if (commandName === 'reverse') return interaction.reply(options.getString('text').split('').reverse().join(''));
    if (commandName === 'ship') {
        const target = options.getUser('member');
        return interaction.reply(`❤️ **Ship:** ${user.username} + ${target.username} = **${Math.floor(Math.random() * 101)}%**`);
    }
    if (commandName === 'chances') return interaction.reply(`📊 The chance of "${options.getString('question')}" is **${Math.floor(Math.random() * 101)}%**.`);
    if (commandName === 'cow-level') {
        const target = options.getUser('user') || user;
        return interaction.reply(`🐂 ${target.username} is **${Math.floor(Math.random() * 101)}%** a simp.`);
    }
    if (commandName === 'iq') {
        const target = options.getUser('user') || user;
        return interaction.reply(`🧠 ${target.username}'s IQ is **${Math.floor(Math.random() * 200)}**.`);
    }
    if (commandName === 'dollar') return interaction.reply('💵 The dollar is expensive today. Go work!');
    if (commandName === 'choose') {
        const opt1 = options.getString('option1');
        const opt2 = options.getString('option2');
        return interaction.reply(`🤔 I choose: **${[opt1, opt2][Math.floor(Math.random() * 2)]}**`);
    }
    if (commandName === 'poll') {
        const topic = options.getString('topic');
        const msg = await interaction.reply({ content: `📊 **Poll:** ${topic}`, fetchReply: true });
        await msg.react('👍'); await msg.react('👎');
    }

    // ===================== ECONOMY =====================
    if (commandName === 'balance') {
        initBankAccount(user.id);
        return interaction.reply(`💰 You have **$${bank.get(user.id).balance}**`);
    }

    if (commandName === 'daily') {
        initBankAccount(user.id);
        bank.get(user.id).balance += 200;
        return interaction.reply('📆 You received your daily **$200**!');
    }

    if (commandName === 'work') {
        initBankAccount(user.id);
        const earnings = Math.floor(Math.random() * 80) + 20;
        bank.get(user.id).balance += earnings;
        return interaction.reply(`💼 You worked and earned **$${earnings}**!`);
    }

    if (commandName === 'bet') {
        initBankAccount(user.id);
        const account = bank.get(user.id);
        const amount = options.getInteger('amount');
        if (amount <= 0 || amount > account.balance) return interaction.reply('❌ Invalid bet amount.');
        if (Math.random() > 0.5) {
            account.balance += amount;
            return interaction.reply(`🎉 You won **$${amount}**!`);
        } else {
            account.balance -= amount;
            return interaction.reply(`😭 You lost **$${amount}**.`);
        }
    }

    if (commandName === 'donate') {
        initBankAccount(user.id);
        const target = options.getUser('member');
        const amount = options.getInteger('amount');
        if (amount <= 0) return interaction.reply('❌ Amount must be greater than 0.');
        initBankAccount(target.id);
        if (bank.get(user.id).balance < amount) return interaction.reply('❌ Insufficient balance.');
        bank.get(user.id).balance -= amount;
        bank.get(target.id).balance += amount;
        return interaction.reply(`💸 You donated **$${amount}** to ${target.username}.`);
    }

    // ===================== MINI GAMES =====================
    if (commandName === 'rock-paper-scissors') {
        const userChoice = options.getString('choice');
        const botChoices = ['rock', 'paper', 'scissors'];
        const botChoice = botChoices[Math.floor(Math.random() * 3)];
        if (userChoice === botChoice) return interaction.reply(`🤝 Tie! Both chose **${botChoice}**.`);
        if ((userChoice === 'rock' && botChoice === 'scissors') || 
            (userChoice === 'paper' && botChoice === 'rock') || 
            (userChoice === 'scissors' && botChoice === 'paper')) {
            return interaction.reply(`🎉 You won! I chose **${botChoice}**.`);
        }
        return interaction.reply(`😔 You lost! I chose **${botChoice}**.`);
    }

    if (commandName === 'guess') {
        const secret = Math.floor(Math.random() * 10) + 1;
        const guess = options.getInteger('number');
        return interaction.reply(guess === secret ? '🎯 Correct!' : `❌ Wrong! The number was **${secret}**.`);
    }

    if (commandName === 'fps') return interaction.reply(`🎮 Your mood is running at **${Math.floor(Math.random() * 60) + 180} FPS**.`);
    if (commandName === 'hack') return interaction.reply(`💻 Hacking ${options.getUser('member').username}... Password found: \`password123\``);
    if (commandName === 'russian-roulette') return interaction.reply(Math.random() < 0.16 ? '💥 You died!' : '🏳️ You survived!');
    if (commandName === 'punch') return interaction.reply(`🥊 ${user} punched ${options.getUser('member')}!`);
    if (commandName === 'bite') return interaction.reply(`😬 ${user} bit ${options.getUser('member')}!`);
    if (commandName === 'kill') return interaction.reply(`💀 ${user} eliminated ${options.getUser('member')}!`);
    if (commandName === 'run') return interaction.reply('🏃💨 You ran away!');

    // ===================== HELP =====================
    if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('🔥 Bot Commands List')
            .setDescription('Full featured Discord bot with moderation and fun commands')
            .addFields(
                { name: '⚙️ Configuration', value: '`/welcome-config` `/message-config` `/role-config`', inline: false },
                { name: '🛡️ Moderation', value: '`/clear` `/kick` `/ban` `/lock` `/unlock` `/slow-mode` `/warn` `/set-nick`', inline: false },
                { name: '📊 Utilities', value: '`/ping` `/server-info` `/avatar` `/user-info` `/uptime` `/say` `/giveaway` `/invite` `/calculator`', inline: false },
                { name: '😂 Fun & Social', value: '`/meme` `/roll` `/coin-flip` `/fortune-cookie` `/8ball` `/hug` `/kiss` `/slap` `/pickup-line` `/joke` `/attack` `/compliment` `/reverse` `/ship` `/chances` `/cow-level` `/iq` `/choose` `/poll`', inline: false },
                { name: '💰 Economy', value: '`/balance` `/daily` `/work` `/bet` `/donate`', inline: false },
                { name: '🎮 Mini Games', value: '`/rock-paper-scissors` `/guess` `/fps` `/hack` `/russian-roulette` `/punch` `/bite` `/kill` `/run`', inline: false }
            );
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