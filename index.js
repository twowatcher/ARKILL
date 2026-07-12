require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers // OBRIGATÓRIO PARA AS BOAS-VINDAS FUNCIONAREM
    ]
});

const PREFIX = '!';

// Bancos de dados temporários na memória
const banco = new Map();
const configBoasVindas = new Map(); 
// Estrutura por servidor: { canalId: string, cargoId: string, mensagem: string }

// ==================== EVENTO: GUILD MEMBER ADD ====================
client.on('guildMemberAdd', async (member) => {
    const serverConfig = configBoasVindas.get(member.guild.id);
    if (!serverConfig) return; // Se o servidor não configurou nada, não faz nada

    // 1. Auto-role (Cargo Automático)
    if (serverConfig.cargoId) {
        const cargo = member.guild.roles.cache.get(serverConfig.cargoId);
        if (cargo) {
            await member.roles.add(cargo).catch(() => console.log(`Erro ao dar cargo para ${member.user.tag}`));
        }
    }

    // 2. Mensagem de Boas-vindas no Canal
    if (serverConfig.canalId) {
        const canal = member.guild.channels.cache.get(serverConfig.canalId);
        if (canal) {
            // Substitui marcadores dinâmicos na mensagem customizada
            let textoCustomizado = serverConfig.mensagem || "Seja bem-vindo(a) ao nosso servidor!";
            textoCustomizado = textoCustomizado
                .replace(/{membro}/g, `${member}`)
                .replace(/{servidor}/g, `${member.guild.name}`)
                .replace(/{total}/g, `${member.guild.memberCount}`);

            const embed = new EmbedBuilder()
                .setColor(0x00FF99)
                .setTitle(`✨ Nova chegada!`)
                .setDescription(textoCustomizado)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            await canal.send({ embeds: [embed] }).catch(() => {});
        }
    }
});

// ==================== READY ====================
client.once('ready', () => {
    console.log(`✅ BLUUDUD BOT ONLINE COM BOAS-VINDAS CUSTOMIZÁVEIS! 🔥`);
    client.user.setActivity('fazendo moderação com estilo', { type: 'WATCHING' });
});

// ==================== COMANDOS ====================
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Inicializa a memória de configuração para o servidor atual caso não exista
    if (!configBoasVindas.has(message.guild.id)) {
        configBoasVindas.set(message.guild.id, { canalId: null, cargoId: null, mensagem: null });
    }
    const dadosServidor = configBoasVindas.get(message.guild.id);

    // ==================== COMANDOS DE CONFIGURAÇÃO DE BOAS-VINDAS ====================

    // Configurar o canal de boas-vindas pelo nome
    if (command === 'config-boasvindas') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Apenas administradores podem configurar o sistema de boas-vindas.');
        }
        
        const nomeCanal = args.join(' ');
        if (!nomeCanal) return message.reply('Formato: `!config-boasvindas nome-do-canal` (ex: `!config-boasvindas geral`)');

        const canalEncontrado = message.guild.channels.cache.find(c => c.name.toLowerCase() === nomeCanal.toLowerCase() && c.isTextBased());
        
        if (!canalEncontrado) return message.reply(`❌ Não encontrei nenhum canal de texto chamado \`${nomeCanal}\`.`);

        dadosServidor.canalId = canalEncontrado.id;
        message.reply(`✅ Canal de boas-vindas definido com sucesso para: ${canalEncontrado}!`);
    }

    // Configurar a mensagem de boas-vindas
    if (command === 'config-mensagem') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Apenas administradores podem usar este comando.');
        }

        const msgCustom = args.join(' ');
        if (!msgCustom) {
            return message.reply('Formato: `!config-mensagem Olá {membro}, bem-vindo ao {servidor}! Agora somos {total} membros.`\n\n*Variáveis aceitas: `{membro}`, `{servidor}`, `{total}`*');
        }

        dadosServidor.mensagem = msgCustom;
        message.reply('✅ Mensagem de boas-vindas atualizada com sucesso!');
    }

    // Configurar o cargo inicial automático pelo nome
    if (command === 'config-cargo') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Apenas administradores podem usar este comando.');
        }

        const nomeCargo = args.join(' ');
        if (!nomeCargo) return message.reply('Formato: `!config-cargo Nome do Cargo` (ex: `!config-cargo Membro`)');

        const cargoEncontrado = message.guild.roles.cache.find(r => r.name.toLowerCase() === nomeCargo.toLowerCase());

        if (!cargoEncontrado) return message.reply(`❌ Não encontrei nenhum cargo chamado \`${nomeCargo}\`.`);

        dadosServidor.cargoId = cargoEncontrado.id;
        message.reply(`✅ Cargo automático definido para: **${cargoEncontrado.name}**`);
    }


    // ==================== MODERAÇÃO ORIGINAL ====================

    if (command === 'ping') {
        message.reply(`🏓 Pong! ${Date.now() - message.createdTimestamp}ms`);
    }

    if (command === 'clear' || command === 'limpar') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('❌ Você não tem permissão pra isso, parça.');
        }
        const qtd = parseInt(args[0]) || 10;
        if (qtd < 1 || qtd > 99) return message.reply('Use um número entre 1 e 99.');
        
        await message.channel.bulkDelete(qtd + 1, true);
        const msg = await message.channel.send(`🧹 Limpei ${qtd} mensagens, tá me devendo um monster!`);
        setTimeout(() => msg.delete(), 4000);
    }

    if (command === 'kick' || command === 'expulsar') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply('❌ Sem permissão.');
        const membro = message.mentions.members.first();
        if (!membro) return message.reply('Mencione alguém para expulsar.');
        
        const motivo = args.slice(1).join(' ') || 'Sem motivo especificado';
        await membro.kick(motivo);
        message.reply(`🚪 ${membro.user.tag} foi expulso. Motivo: ${motivo}`);
    }

    if (command === 'ban' || command === 'banir') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply('❌ Sem permissão.');
        const membro = message.mentions.members.first();
        if (!membro) return message.reply('Mencione alguém para banir.');
        
        const motivo = args.slice(1).join(' ') || 'Quebrou as regras';
        await membro.ban({ reason: motivo });
        message.reply(`🔨 ${membro.user.tag} foi banido. Motivo: ${motivo}`);
    }

    if (command === 'meme') {
        const memes = [
            "https://klipy.com/gifs/shrek-rizz-shrek-meme",
            "Por que o programador faliu? Porque ele usava muito 'break'!",
            "Tudo na vida passa, menos a minha vontade de comer pizza.",
            "O código funciona, mas eu não sei o porquê. Não mexa.",
            "Eu tentando fingir que entendi o que a pessoa falou após ela repetir 3 vezes."
        ];
        const random = memes[Math.floor(Math.random() * memes.length)];
        message.channel.send(random);
    }

    // --- MODERAÇÃO ADICIONAL ---
    if (command === 'lock') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply('❌ Sem permissão.');
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        message.reply('🔒 Canal trancado! Silêncio no tribunal.');
    }

    if (command === 'unlock') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply('❌ Sem permissão.');
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
        message.reply('🔓 Canal destrancado. Podem falar agora.');
    }

    if (command === 'slowmode' || command === 'modolento') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply('❌ Sem permissão.');
        const tempo = parseInt(args[0]) || 0;
        await message.channel.setRateLimitPerUser(tempo);
        message.reply(`⏳ Modo lento definido para ${tempo} segundos.`);
    }

    if (command === 'warn') {
        const membro = message.mentions.members.first();
        if (!membro) return message.reply('Mencione quem vai levar o puxão de orelha.');
        const motivo = args.slice(1).join(' ') || 'Comportamento estranho';
        message.channel.send(`⚠️ **AVISO:** ${membro} foi avisado por: *${motivo}*. Fica esperto!`);
    }

    if (command === 'setnick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageNicknames)) return message.reply('❌ Sem permissão.');
        const membro = message.mentions.members.first();
        const novoNick = args.slice(1).join(' ');
        if (!membro || !novoNick) return message.reply('Uso: !setnick @membro Novo Nome');
        await membro.setNickname(novoNick);
        message.reply(`📝 Nome de ${membro.user.username} alterado para ${novoNick}.`);
    }

    // --- UTILITÁRIOS ---
    if (command === 'serverinfo') {
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(`📊 Informações de ${message.guild.name}`)
            .addFields(
                { name: 'Membros', value: `${message.guild.memberCount}`, inline: true },
                { name: 'Criado em', value: `${message.guild.createdAt.toLocaleDateString('pt-BR')}`, inline: true }
            );
        message.reply({ embeds: [embed] });
    }

    if (command === 'avatar') {
        const usuario = message.mentions.users.first() || message.author;
        message.reply(`🖼️ Avatar de ${usuario.username}: ${usuario.displayAvatarURL({ dynamic: true, size: 1024 })}`);
    }

    if (command === 'userinfo') {
        const usuario = message.mentions.users.first() || message.author;
        message.reply(`👤 **Nome:** ${usuario.tag}\n🆔 **ID:** ${usuario.id}\n📅 **Conta criada em:** ${usuario.createdAt.toLocaleDateString('pt-BR')}`);
    }

    if (command === 'uptime') {
        let totalSeconds = (client.uptime / 1000);
        let days = Math.floor(totalSeconds / 86400);
        totalSeconds %= 86400;
        let hours = Math.floor(totalSeconds / 3600);
        totalSeconds %= 3600;
        let minutes = Math.floor(totalSeconds / 60);
        let seconds = Math.floor(totalSeconds % 60);
        message.reply(`⏰ Estou online faz: \`${days}d ${hours}h ${minutes}m ${seconds}s\``);
    }

    if (command === 'say' || command === 'falar') {
        const fala = args.join(' ');
        if (!fala) return message.reply('O que você quer que eu fale?');
        message.delete().catch(() => {});
        message.channel.send(fala);
    }

    if (command === 'sorteio') {
        const premio = args.join(' ');
        if (!premio) return message.reply('O que vai ser sorteado?');
        const m = await message.guild.members.fetch();
        const ganhador = m.filter(member => !member.user.bot).random();
        message.channel.send(`🎉 **SORTEIO!** Prêmio: **${premio}**\n🏆 Ganhador(a): ${ganhador}! Parabéns!`);
    }

    if (command === 'convite') {
        message.reply('🔗 Quer me adicionar no seu servidor?');
    }

    if (command === 'calculadora' || command === 'calc') {
        const n1 = parseFloat(args[0]);
        const op = args[1];
        const n2 = parseFloat(args[2]);
        if (isNaN(n1) || !op || isNaN(n2)) return message.reply('Formato: `!calc 5 + 5`');
        let res = 0;
        if (op === '+') res = n1 + n2;
        else if (op === '-') res = n1 - n2;
        else if (op === '*') res = n1 * n2;
        else if (op === '/') res = n1 / n2;
        message.reply(`🔢 Resultado: **${res}**`);
    }

    if (command === 'regras') {
        message.reply('📜 **Regras do Servidor:**\n1. Não seja chato.\n2. Não floode.\n3. Respeite todo mundo.');
    }

    if (command === 'links') {
        message.reply('🌐 **Nossos links:**\nSite: Em breve\nTwitter: Em breve');
    }

    // --- DIVERSÃO & INTERAÇÃO ---
    if (command === 'dado') {
        const faces = parseInt(args[0]) || 6;
        const result = Math.floor(Math.random() * faces) + 1;
        message.reply(`🎲 Você rolou um dado de ${faces} lados e tirou: **${result}**`);
    }

    if (command === 'moeda') {
        const lados = ['Cara', 'Coroa'];
        const escolhido = lados[Math.floor(Math.random() * lados.length)];
        message.reply(`🪙 Caiu... **${escolhido}**!`);
    }

    if (command === 'biscoito') {
        const frases = ["Você terá um dia incrível hoje!", "A recompensa pelo bom trabalho é mais trabalho.", "Amanhã você vai acordar mais rico (ou não)."];
        message.reply(`🥠 **Biscoito da Sorte:** ${frases[Math.floor(Math.random() * frases.length)]}`);
    }

    if (command === '8ball') {
        const respostas = ['Sim!', 'Com certeza', 'Talvez', 'Não', 'Definitivamente não.'];
        if (!args.length) return message.reply('Faça uma pergunta.');
        message.reply(`🔮 ${respostas[Math.floor(Math.random() * respostas.length)]}`);
    }

    if (command === 'abracar' || command === 'hug') {
        const alvo = message.mentions.users.first();
        if (!alvo) return message.reply('Mencione alguém para abraçar.');
        message.channel.send(`🤗 ${message.author} deu um abraço apertado em ${alvo}!`);
    }

    if (command === 'beijar' || command === 'kiss') {
        const alvo = message.mentions.users.first();
        if (!alvo) return message.reply('Mencione alguém para beijar.');
        message.channel.send(`💋 ${message.author} deu um beijo em ${alvo}!`);
    }

    if (command === 'tapa' || command === 'slap') {
        const alvo = message.mentions.users.first();
        if (!alvo) return message.reply('Mencione quem merece um tapa.');
        message.channel.send(`💥 Ouuuch! ${message.author} deu um tapa estalado em ${alvo}!`);
    }

    if (command === 'cantada') {
        const cantadas = ["Você não é Wi-Fi, mas sinto uma forte conexão.", "Me chama de tabela periódica e diz que rola uma química entre nós."];
        message.reply(`😏 ${cantadas[Math.floor(Math.random() * cantadas.length)]}`);
    }

    if (command === 'piada') {
        const piadas = ["Por que o jacaré tirou o jacarezinho da escola? Porque ele ré-ptil de ano.", "O que o tomate foi fazer no banco? Tirar o extrato."];
        message.reply(`🤡 ${piadas[Math.floor(Math.random() * piadas.length)]}`);
    }

    if (command === 'atacar') {
        const alvo = message.mentions.users.first();
        if (!alvo) return message.reply('Quem você vai atacar?');
        message.channel.send(`⚔️ ${message.author} atacou ${alvo} e causou **${Math.floor(Math.random() * 100)}** de dano!`);
    }

    if (command === 'elogiar') {
        const alvo = message.mentions.users.first();
        if (!alvo) return message.reply('Mencione alguém para elogiar.');
        message.channel.send(`✨ ${alvo}, ${message.author} te disse: Seu estilo é sensacional!`);
    }

    if (command === 'reverso') {
        const texto = args.join(' ');
        if (!texto) return message.reply('Escreva algo.');
        message.reply(texto.split('').reverse().join(''));
    }

    if (command === 'ship') {
        const user2 = message.mentions.users.first();
        if (!user2) return message.reply('Mencione o segundo alvo do cupido.');
        message.reply(`❤️ **SHIP:** ${message.author.username} + ${user2.username} = **${Math.floor(Math.random() * 101)}%**!`);
    }

    if (command === 'chances') {
        if (!args.length) return message.reply('Chances de que?');
        message.reply(`📊 A chance disso acontecer é de **${Math.floor(Math.random() * 101)}%**.`);
    }

    if (command === 'gado') {
        const alvo = message.mentions.users.first() || message.author;
        message.reply(`🐂 ${alvo.username} é **${Math.floor(Math.random() * 101)}%** gado.`);
    }

    if (command === 'inteligencia' || command === 'qi') {
        const alvo = message.mentions.users.first() || message.author;
        message.reply(`🧠 O QI de ${alvo.username} é de **${Math.floor(Math.random() * 200)}**.`);
    }

    if (command === 'dolar') {
        message.reply('💵 O dólar hoje está alto. Vá trabalhar!');
    }

    if (command === 'escolha') {
        if (args.length < 2) return message.reply('Coloque duas opções separadas por espaço.');
        message.reply(`🤔 Eu escolho com certeza: **${args[Math.floor(Math.random() * args.length)]}**`);
    }

    if (command === 'diga') {
        message.reply('Opa! Digite `!ajuda` para ver o que sei fazer.');
    }

    if (command === 'votar') {
        const enquete = args.join(' ');
        if (!enquete) return message.reply('Digite o tema da votação.');
        const msg = await message.channel.send(`📊 **VOTAÇÃO:** ${enquete}`);
        await msg.react('👍');
        await msg.react('👎');
    }

    // --- MINI ECONOMIA ---
    const iniciarConta = (id) => {
        if (!banco.has(id)) banco.set(id, { carteira: 100 });
    };

    if (command === 'saldo' || command === 'bal') {
        iniciarConta(message.author.id);
        message.reply(`💰 Você tem **$${banco.get(message.author.id).carteira}** dinheiros na carteira.`);
    }

    if (command === 'daily') {
        iniciarConta(message.author.id);
        banco.get(message.author.id).carteira += 200;
        message.reply('📆 Você resgatou seus **$200** dinheiros diários!');
    }

    if (command === 'trabalhar' || command === 'work') {
        iniciarConta(message.author.id);
        const ganho = Math.floor(Math.random() * 80) + 20;
        banco.get(message.author.id).carteira += ganho;
        message.reply(`💼 Você trabalhou e ganhou **$${ganho}**.`);
    }

    if (command === 'apostar' || command === 'gamble') {
        iniciarConta(message.author.id);
        const conta = banco.get(message.author.id);
        const valor = parseInt(args[0]);
        if (isNaN(valor) || valor <= 0 || valor > conta.carteira) return message.reply('Coloque um valor válido.');
        
        if (Math.random() > 0.5) {
            conta.carteira += valor;
            message.reply(`🎉 Ganhou **$${valor}**!`);
        } else {
            conta.carteira -= valor;
            message.reply(`😭 Perdeu **$${valor}**.`);
        }
    }

    if (command === 'doar') {
        iniciarConta(message.author.id);
        const alvo = message.mentions.users.first();
        const valor = parseInt(args[1]);
        if (!alvo || isNaN(valor) || valor <= 0) return message.reply('Uso: `!doar @membro 50`');
        iniciarConta(alvo.id);
        
        if (banco.get(message.author.id).carteira < valor) return message.reply('Saldo insuficiente.');
        banco.get(message.author.id).carteira -= valor;
        banco.get(alvo.id).carteira += valor;
        message.reply(`💸 Você doou **$${valor}** para ${alvo}.`);
    }

    // --- MINI GAMES ---
    if (command === 'jokenpo') {
        const opcoes = ['pedra', 'papel', 'tesoura'];
        const escolhaBot = opcoes[Math.floor(Math.random() * 3)];
        const escolhaUser = args[0]?.toLowerCase();
        if (!opcoes.includes(escolhaUser)) return message.reply('Escolha `pedra`, `papel` ou `tesoura`.');
        
        if (escolhaUser === escolhaBot) message.reply(`Empate! Escolhi ${escolhaBot}.`);
        else if ((escolhaUser === 'pedra' && escolhaBot === 'tesoura') || (escolhaUser === 'papel' && escolhaBot === 'pedra') || (escolhaUser === 'tesoura' && escolhaBot === 'papel')) {
            message.reply(`Você ganhou! Escolhi ${escolhaBot}.`);
        } else {
            message.reply(`Perdeu! Eu escolhi ${escolhaBot}.`);
        }
    }

    if (command === 'adivinhe') {
        const segredo = Math.floor(Math.random() * 10) + 1;
        if (parseInt(args[0]) === segredo) message.reply('🎯 Acertou em cheio!');
        else message.reply(`Errou! O número era **${segredo}**.`);
    }

    if (command === 'ppt') message.reply('Use `!jokenpo pedra/papel/tesoura`.');
    if (command === 'fps') message.reply(`🎮 Rodando a **${Math.floor(Math.random() * 60) + 180} FPS**.`);
    
    if (command === 'hackear') {
        const alvo = message.mentions.users.first();
        if (!alvo) return message.reply('Quem vamos hackear?');
        message.reply(`💻 Injetando vírus em ${alvo.username}... Senha do e-mail: \`batatinha123\``);
    }

    if (command === 'roleta') {
        if (Math.random() < 0.16) message.reply('💥 MORREU!');
        else message.reply('🏳️ O tambor girou e a arma falhou. Sobreviveu!');
    }

    if (command === 'soco') {
        const alvo = message.mentions.users.first();
        if (!alvo) return message.reply('Mencione alguém.');
        message.channel.send(`🥊 ${message.author} meteu um soco em ${alvo}!`);
    }

    if (command === 'morder') {
        const alvo = message.mentions.users.first();
        if (!alvo) return message.reply('Mencione alguém.');
        message.channel.send(`😬 ${message.author} deu uma mordida em ${alvo}!`);
    }

    if (command === 'matar') {
        const alvo = message.mentions.users.first();
        if (!alvo) return message.reply('Mencione alguém.');
        message.channel.send(`💀 ${message.author} derrubou ${alvo}!`);
    }

    if (command === 'correr') message.reply('🏃💨 Você saiu correndo!');

    // ==================== AJUDA ATUALIZADO ====================
    if (command === 'ajuda' || command === 'comandos') {
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🔥 BLUUDUD BOT - COMANDOS')
            .setDescription('O bot mais completo e zoeiro do pedaço!')
            .addFields(
                { name: '⚙️ Configurações (Apenas Admins)', value: '`!config-boasvindas <nome-canal>`\n`!config-mensagem <mensagem>`\n`!config-cargo <nome-cargo>`' },
                { name: '🛡️ Moderação Básica & Avançada', value: '`!clear` `!kick` `!ban` `!lock` `!unlock` `!slowmode` `!warn` `!setnick`' },
                { name: '📊 Utilidades', value: '`!ping` `!serverinfo` `!avatar` `!userinfo` `!uptime` `!say` `!sorteio` `!convite` `!calc` `!regras` `!links`' },
                { name: '😂 Diversão & Interação', value: '`!meme` `!dado` `!moeda` `!biscoito` `!8ball` `!abracar` `!beijar` `!tapa` `!cantada` `!piada` `!atacar` `!elogiar` `!reverso` `!ship` `!chances` `!gado` `!qi` `!dolar` `!escolha` `!diga` `!votar`' },
                { name: '💰 Economia', value: '`!saldo` `!daily` `!trabalhar` `!apostar` `!doar`' },
                { name: '🎮 Mini Games & Ações', value: '`!jokenpo` `!adivinhe` `!ppt` `!fps` `!hackear` `!roleta` `!soco` `!morder` `!matar` `!correr`' }
            );
        message.reply({ embeds: [embed] });
    }
});

client.login(process.env.TOKEN);

// ==================== SERVIDOR PARA RENDER ====================
const express = require('express');
const app = report || express();

app.get('/', (req, res) => {
    res.send('Bluudud Bot está online com Boas-Vindas! 🔥');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Servidor rodando na porta ${PORT}`);
});