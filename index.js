require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    EmbedBuilder, 
    PermissionFlagsBits,
    SlashCommandBuilder,
    REST,
    Routes
} = require('discord.js');
const dayjs = require('dayjs');

// ==========================================
// CẤU HÌNH DANH SÁCH PHÁI
// ==========================================
const FACTIONS = [
    { label: 'Huyền Cơ', value: 'Huyền Cơ', emoji: '<:HuyenCo:1566154772120076371>' },
    { label: 'Thần Tương', value: 'Thần Tương', emoji: '<:ThanTuong:1554525281396719696>' },
    { label: 'Cửu Linh', value: 'Cửu Linh', emoji: '<:CuuLinh:1554525279215419412>' },
    { label: 'Thiết Y', value: 'Thiết Y', emoji: '<:ThietY:1554525277340831794>' },
    { label: 'Huyết Hà', value: 'Huyết Hà', emoji: '<:HuyetHa:1554525275402797177>' },
    { label: 'Tố Vấn', value: 'Tố Vấn', emoji: '<:ToVan:1554525273192534107>' },
    { label: 'Toái Mộng', value: 'Toái Mộng', emoji: '<:ToaiMong:1554525271259095130>' },
    { label: 'Long Ngâm', value: 'Long Ngâm', emoji: '<:LongNgam:1554525268981321888>' }
];

const db = {
    config: {
        startTime: null, 
        endTime: null,
        logMessageId: null
    },
    votes: new Map() 
};

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

// ==========================================
// ĐĂNG KÝ SLASH COMMANDS
// ==========================================
const commands = [
    new SlashCommandBuilder()
        .setName('setup-vote')
        .setDescription('Tạo bảng khảo sát đổi phái (Admin)')
        .addIntegerOption(option => 
            option.setName('thoi-gian')
                .setDescription('Số giờ mở vote (VD: 24, 48, 72...)')
                .setRequired(true)
                .setMinValue(1))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
    console.log(`🤖 Bot ${client.user.tag} đã online!`);
    try {
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        console.log('✅ Đã đăng ký lệnh Slash thành công!');
    } catch (error) {
        console.error('❌ Lỗi đăng ký lệnh:', error);
    }
});

// ==========================================
// XỬ LÝ LỆNH SLASH
// ==========================================
client.on('interactionCreate', async interaction => {
    
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup-vote') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Bạn cần quyền Admin!', ephemeral: true });
        }

        const hours = interaction.options.getInteger('thoi-gian');
        const start = dayjs(); 
        const end = start.add(hours, 'hour');

        db.config.startTime = start.toISOString();
        db.config.endTime = end.toISOString();
        db.config.logMessageId = null; 

        const embed = new EmbedBuilder()
            .setTitle('📊 BẢNG KHẢO SÁT ĐỔI PHÁI - NGHỊCH THỦY HÀN')
            .setDescription(
                `Chào các hiệp khách! BQT muốn thăm dò ý kiến của mọi người về việc chuyển đổi phái.\n\n` +
                `👉 Bấm nút bên dưới, chọn phái muốn đổi và điền thông tin.\n` +
                `*(Bạn có thể bấm lại để thay đổi lựa chọn bất cứ lúc nào).*\n\n` +
                `⏳ **Thời gian khảo sát:** Từ <t:${Math.floor(start.valueOf() / 1000)}:f> đến <t:${Math.floor(end.valueOf() / 1000)}:f> (Kéo dài ${hours} tiếng)`
            )
            .setColor('#2b2d31')
            .setFooter({ text: 'Nghịch Thủy Hàn - Thăm dò chuyển phái' });

        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('register_vote').setLabel('Bỏ Phiếu Đổi Phái').setEmoji('📝').setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [embed], components: [btn] });
        
        if (process.env.LOG_CHANNEL_ID) {
            const logChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                const initialLog = await logChannel.send('Đang khởi tạo bảng log...');
                db.config.logMessageId = initialLog.id;
            }
        }
    }

    // ==========================================
    // XỬ LÝ BUTTON & MODAL
    // ==========================================
    
    // 1. BẤM NÚT "BỎ PHIẾU" (Đã bỏ chặn spam)
    if (interaction.isButton() && interaction.customId === 'register_vote') {
        const now = dayjs();
        const start = dayjs(db.config.startTime);
        const end = dayjs(db.config.endTime);

        if (!start.isValid() || !end.isValid()) return interaction.reply({ content: `❌ Chưa có đợt khảo sát nào được mở!`, ephemeral: true });
        if (now.isBefore(start)) return interaction.reply({ content: `⏳ Chưa tới giờ!`, ephemeral: true });
        if (now.isAfter(end)) return interaction.reply({ content: `🔒 Đã hết hạn đăng ký!`, ephemeral: true });

        // Không còn lệnh chặn user đã vote ở đây nữa
        const modal = new ModalBuilder().setCustomId('vote_modal').setTitle('Đăng Ký / Thay Đổi Phái');

        const ingameInput = new TextInputBuilder().setCustomId('ingame').setLabel('Ingame của bạn').setStyle(TextInputStyle.Short).setRequired(true);
        const oldFactionInput = new TextInputBuilder().setCustomId('old_faction').setLabel('Phái hiện tại').setStyle(TextInputStyle.Short).setRequired(true);
        const newFactionInput = new TextInputBuilder().setCustomId('new_faction').setLabel('Phái muốn đổi').setStyle(TextInputStyle.Short).setRequired(true);
        const timeInput = new TextInputBuilder()
            .setCustomId('time_option')
            .setLabel('Thời gian (VinhVien / Thu3Ngay / ThuVaiNgay)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        // Nếu user đã vote trước đó, tự động điền lại thông tin cũ vào Form cho tiện sửa
        if (db.votes.has(interaction.user.id)) {
            const oldData = db.votes.get(interaction.user.id);
            ingameInput.setValue(oldData.ingame);
            oldFactionInput.setValue(oldData.oldFaction);
            newFactionInput.setValue(oldData.newFaction);
            timeInput.setValue(oldData.timeOptionRaw || oldData.timeOption);
        }

        modal.addComponents(
            new ActionRowBuilder().addComponents(ingameInput),
            new ActionRowBuilder().addComponents(oldFactionInput),
            new ActionRowBuilder().addComponents(newFactionInput),
            new ActionRowBuilder().addComponents(timeInput)
        );

        await interaction.showModal(modal);
    }

    // 2. SUBMIT FORM (Ghi đè dữ liệu)
    if (interaction.isModalSubmit() && interaction.customId === 'vote_modal') {
        await interaction.deferReply({ ephemeral: true });

        const ingame = interaction.fields.getTextInputValue('ingame');
        const oldFaction = interaction.fields.getTextInputValue('old_faction');
        const newFaction = interaction.fields.getTextInputValue('new_faction');
        let timeOptionRaw = interaction.fields.getTextInputValue('time_option').toLowerCase();

        let timeOption = 'Chưa xác định';
        if (timeOptionRaw.includes('vinh')) timeOption = 'Vĩnh viễn';
        else if (timeOptionRaw.includes('3')) timeOption = 'Thử vài ba ngày';
        else if (timeOptionRaw.includes('vai')) timeOption = 'Thử vài ngày thấy hợp sẽ đổi hẳn';

        // Dùng .set() để ghi đè hoặc tạo mới
        db.votes.set(interaction.user.id, {
            userId: interaction.user.id,
            ingame,
            oldFaction,
            newFaction,
            timeOption,
            timeOptionRaw: interaction.fields.getTextInputValue('time_option'),
            updatedAt: dayjs().format('HH:mm:ss')
        });

        await interaction.editReply({ content: `✅ Cập nhật thành công! Lựa chọn của bạn đã được ghi nhận.` });

        await updateLogChannel(interaction.client);
    }

    // 3. NÚT HỦY ĐĂNG KÝ (Admin)
    if (interaction.isButton() && interaction.customId.startsWith('admin_cancel_')) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Bạn không có quyền!', ephemeral: true });
        }

        const targetId = interaction.customId.replace('admin_cancel_', '');
        if (db.votes.has(targetId)) {
            db.votes.delete(targetId); 
            await updateLogChannel(interaction.client); 
            return interaction.reply({ content: `✅ Đã xóa đăng ký của <@${targetId}>.`, ephemeral: true });
        } else {
            return interaction.reply({ content: `❌ Người này không có trong danh sách.`, ephemeral: true });
        }
    }
});

// ==========================================
// HÀM CẬP NHẬT KÊNH LOG
// ==========================================
async function updateLogChannel(client) {
    if (!process.env.LOG_CHANNEL_ID || !db.config.logMessageId) return;

    const channel = await client.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    const groupedVotes = {};
    for (const [key, value] of db.votes) {
        if (!groupedVotes[value.newFaction]) groupedVotes[value.newFaction] = [];
        groupedVotes[value.newFaction].push(value);
    }

    let logContent = `📊 **DANH SÁCH ĐĂNG KÝ ĐỔI PHÁI**\n`;
    logContent += `⏳ Thời gian: <t:${Math.floor(new Date(db.config.startTime).getTime() / 1000)}:f> - <t:${Math.floor(new Date(db.config.endTime).getTime() / 1000)}:f>\n`;
    logContent += `*(Mỗi người chỉ tính 1 phiếu - Có thể thay đổi phái tùy thích)*\n\n`;

    if (db.votes.size === 0) {
        logContent += `*Chưa có ai đăng ký.*`;
    } else {
        for (const faction of FACTIONS) {
            if (groupedVotes[faction.value]) {
                logContent += `**${faction.emoji} ${faction.label} (${groupedVotes[faction.value].length})**\n`;
                
                groupedVotes[faction.value].forEach((vote, index) => {
                    logContent += `${index + 1}. <@${vote.userId}> (Ingame: ${vote.ingame})\n`;
                    logContent += `   └ Từ: ${vote.oldFaction} | T/gian: *${vote.timeOption}*\n`;
                });
                logContent += `\n`;
            }
        }
    }

    logContent += `*Cập nhật lúc: ${dayjs().format('HH:mm:ss')}*`;

    const components = [];
    const lastVoter = Array.from(db.votes.values()).pop();
    
    // Tạo nút xóa cho Admin
    if (lastVoter) {
         const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`admin_cancel_${lastVoter.userId}`)
                .setLabel(`Hủy ĐK: ${lastVoter.ingame}`)
                .setStyle(ButtonStyle.Danger)
        );
        components.push(row);
    }

    try {
        const logMsg = await channel.messages.fetch(db.config.logMessageId);
        await logMsg.edit({ content: logContent, components: components });
    } catch (error) {
        console.error('Lỗi cập nhật log:', error);
    }
}

client.login(process.env.DISCORD_TOKEN);
