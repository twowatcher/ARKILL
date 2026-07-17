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
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');

const db = new Database('database.sqlite');

// ==================== ESTRUTURA DO BANCO DE DADOS ====================
db.prepare(`
    CREATE TABLE IF NOT EXISTS bank (
        userId TEXT PRIMARY KEY,
        balance INTEGER DEFAULT 100,
        lastDaily INTEGER DEFAULT 0
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

db.prepare(`
    CREATE TABLE IF NOT EXISTS inventory (
        userId TEXT,
        itemId TEXT,
        PRIMARY KEY (userId, itemId)
    )
`).run();

// ==================== CONFIGURAÇÃO DO BOT ====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});

const COLORS = {
    SUCCESS: 0x00FF99,
    ERROR: 0xFF3333,
    INFO: 0x0099FF,
    FUN: 0x9933FF,
    ECONOMY: 0xFFCC00,
    NEUTRAL: 0x2F3136
};

// Funções auxiliares do banco
const getAccount = (userId) => {
    let row = db.prepare('SELECT * FROM bank WHERE userId = ?').get(userId);
    if (!row) {
        db.prepare('INSERT INTO bank (userId, balance, lastDaily) VALUES (?, ?, 0)').run(userId, 100);
        row = { userId, balance: 100, lastDaily: 0 };
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

// Itens da loja disponíveis
const LOJA_ITEMS = [
    { id: 'void', name: 'Hayley Void', price: 1000000, desc: 'Nem toda escuridão é vazia, algumas escondem sonhos.' },
    { id: 'howl', name: 'Hayley Howl', price: 2000000, desc: 'Quando a noite chama, Hayley responde com seu verdadeiro espírito.' },
    { id: 'starlight', name: 'Hayley Starlight', price: 3000000, desc: 'Onde as estrelas cruzam o céu, cada estrela caída ilumina um novo caminho.' },
    { id: 'bloom', name: 'Hayley Bloom', price: 4000000, desc: 'Cercada por águas calmas, Hayley floresce em serenidade.' },
    { id: 'frost', name: 'Hayley Frost', price: 5000000, desc: 'Em um reino de cristais, até o inverno guarda sua delicadeza.' },
    { id: 'spirit', name: 'Hayley Spirit', price: 6000000, desc: 'Guiada pelo espírito do lobo, Hayley nunca caminha sozinha.' }
];

// Comandos de Barra
const commandsData = [
    { name: 'balance', description: 'Check your Killcoin balance.' },
    { name: 'work', description: 'Work and earn Killcoins.' },
    { name: 'help', description: 'Show all available commands.' }
];

client.once('ready', async () => {
    console.log(`✅ Bot logado como ${client.user.tag}`);
    await client.application.commands.set(commandsData).catch(console.error);
});

// Evento de Entrada de Membro
client.on('guildMemberAdd', async (member) => {
    const config = getWelcomeConfig(member.guild.id);
    if (!config || !config.channelId) return;

    const channel = member.guild.channels.cache.get(config.channelId);
    if (channel) {
        let msgText = config.message || "Bem-vindo {member} ao {server}!";
        msgText = msgText
            .replace(/{member}/g, `${member}`)
            .replace(/{server}/g, member.guild.name)
            .replace(/{total}/g, member.guild.memberCount);

        const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('✨ Novo Membro!')
            .setDescription(msgText)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        channel.send({ embeds: [embed] }).catch(() => {});
    }
});

// Comandos simples no chat para interagir com a economia
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, user } = interaction;

    if (commandName === 'balance') {
        const acc = getAccount(user.id);
        const embed = new EmbedBuilder()
            .setColor(COLORS.ECONOMY)
            .setTitle('💰 Seus Saldos')
            .setDescription(`**Usuário:** ${user}\n**Saldo Atual:** \`${acc.balance} Killcoins\``);
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'work') {
        const gain = Math.floor(Math.random() * 150) + 50;
        updateBalance(user.id, gain);
        const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('💼 Turno Finalizado')
            .setDescription(`Você trabalhou duro e faturou **${gain} Killcoins**!`);
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setColor(COLORS.INFO)
            .setTitle('📚 Central de Ajuda')
            .setDescription('Gerencie tudo pelo nosso site oficial!\n\n🔗 **Painel Web:** http://localhost:3000');
        return interaction.reply({ embeds: [embed] });
    }
});

client.login(process.env.TOKEN);

// ==================== SERVIDOR EXPRESS & OAUTH2 ====================
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.REDIRECT_URI,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, profile));
}));

// Middlewares
function checkAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/auth/discord');
}

// Rotas do Express
app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', {
    failureRedirect: '/'
}), (req, res) => {
    res.redirect('/');
});

app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

// Página Inicial (Dashboard de Configuração do Boas-vindas)
app.get('/', checkAuth, async (req, res) => {
    const acc = getAccount(req.user.id);
    
    // Filtra servidores onde o usuário é Administrador
    const adminGuilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    
    // Carrega canais da primeira guilda para exibir no seletor
    let channels = [];
    let config = { channelId: '', message: '' };
    if (adminGuilds.length > 0) {
        const guild = client.guilds.cache.get(adminGuilds[0].id);
        if (guild) {
            channels = guild.channels.cache
                .filter(c => c.type === ChannelType.GuildText)
                .map(c => ({ id: c.id, name: c.name }));
            config = getWelcomeConfig(guild.id);
        }
    }

    res.render('index', {
        user: req.user,
        balance: acc.balance,
        guilds: adminGuilds,
        channels,
        config
    });
});

// Salvar Configurações de Boas-vindas pelo Site
app.post('/save-welcome', checkAuth, (req, res) => {
    const { guildId, channelId, message } = req.body;
    
    // Validação de segurança básica se o usuário de fato administra o servidor
    const hasPermission = req.user.guilds.some(g => g.id === guildId && (g.permissions & 0x8) === 0x8);
    if (!hasPermission) return res.status(403).send('Acesso negado.');

    getWelcomeConfig(guildId);
    db.prepare('UPDATE welcomeConfig SET channelId = ?, message = ? WHERE guildId = ?').run(channelId, message, guildId);

    res.redirect('/');
});

// Página do Daily
app.get('/daily', checkAuth, (req, res) => {
    const acc = getAccount(req.user.id);
    res.render('daily', { user: req.user, balance: acc.balance, account: acc });
});

// Coletar Daily (Sistema estrito de 24 horas)
app.post('/daily/claim', checkAuth, (req, res) => {
    const acc = getAccount(req.user.id);
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000; // 24 horas em milissegundos

    if (now - acc.lastDaily < cooldown) {
        const remaining = cooldown - (now - acc.lastDaily);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return res.send(`Ainda não! Você poderá coletar seu Daily novamente em ${hours}h e ${minutes}m.`);
    }

    // Adiciona 500 Killcoins e atualiza o timestamp
    db.prepare('UPDATE bank SET balance = balance + 500, lastDaily = ? WHERE userId = ?').run(now, req.user.id);
    res.redirect('/daily?success=true');
});

// Página da Loja
app.get('/loja', checkAuth, (req, res) => {
    const acc = getAccount(req.user.id);
    const ownedItems = db.prepare('SELECT itemId FROM inventory WHERE userId = ?').all(req.user.id).map(r => r.itemId);

    res.render('loja', {
        user: req.user,
        balance: acc.balance,
        items: LOJA_ITEMS,
        ownedItems
    });
});

// Processo de Compra de Itens na Loja
app.post('/loja/comprar', checkAuth, (req, res) => {
    const { itemId } = req.body;
    const item = LOJA_ITEMS.find(i => i.id === itemId);
    if (!item) return res.status(400).send('Item inválido.');

    const acc = getAccount(req.user.id);
    if (acc.balance < item.price) {
        return res.send('Você não possui Killcoins suficientes!');
    }

    const alreadyOwned = db.prepare('SELECT 1 FROM inventory WHERE userId = ? AND itemId = ?').get(req.user.id, itemId);
    if (alreadyOwned) return res.send('Você já possui este avatar em sua coleção!');

    // Deduz o valor e entrega o item
    db.prepare('UPDATE bank SET balance = balance - ? WHERE userId = ?').run(item.price, req.user.id);
    db.prepare('INSERT INTO inventory (userId, itemId) VALUES (?, ?)').run(req.user.id, itemId);

    res.redirect('/loja?buySuccess=true');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Servidor Web ativo na porta ${PORT}`));