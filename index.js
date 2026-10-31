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
    SlashCommandBuilder,
    REST,
    Routes
} = require('discord.js');
const dayjs = require('dayjs');

// ==========================================
// 1. GIẢ LẬP DATABASE (Bạn thay bằng MongoDB/SQLite sau này)
// ==========================================
const db = {
    // Thời gian mặc định: Mở từ hôm qua, đóng sau 7 ngày
    config: {
        startTime: dayjs().subtract(1, 'day').toISOString(),
        endTime: dayjs().add(7, 'day').toISOString(),
        logMessageId: null // Lưu ID tin nhắn log để edit
    },
    votes: new Map() // Lưu vote: Key = UserId
};

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ==========================================
// 2. ĐĂNG KÝ SLASH COMMANDS
// ==========================================
const commands = [
    new SlashCommandBuilder()
        .setName('setup-vote')
        .setDescription('Tạo bảng khảo sát đổi phái (Chỉ Admin)')
        .addStringOption(option => 
            option.setName('ngay-bat-dau')
                .setDescription('Định dạng: YYYY-MM-DD HH:mm (VD: 2026-11-01 08:00)')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('ngay-ket-thuc')
                .setDescription('Định dạng: YYYY-MM-DD HH:mm')
                .setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
    console.log(`🤖 Bot ${client.user.tag} đã online!`);
    try {
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );
        console.log('✅ Đã đăng ký lệnh Slash thành công!');
    } catch (error) {
        console.error('❌ Lỗi đăng ký lệnh:', error);
    }
});

// ==========================================
// 3. XỬ LÝ INTERACTION (Lệnh, Nút bấm, Modal)
// ==========================================
client.on('interactionCreate', async interaction => {
    
    // --- A. LỆNH SETUP CỦA ADMIN ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup-vote') {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ Bạn không có quyền Admin để dùng lệnh này!', ephemeral: true });
        }

        const startStr = interaction.options.getString('ngay-bat-dau');
        const endStr = interaction.options.getString('ngay-ket-thuc');

        // Parse thời gian (Format: YYYY-MM-DD HH:mm)
        const start = dayjs(startStr, 'YYYY-MM-DD HH:mm');
        const end = dayjs(endStr, 'YYYY-MM-DD HH:mm');

        if (!start.isValid() || !end.isValid()) {
            return interaction.reply({ content: '❌ Sai định dạng thời gian! Vui lòng nhập đúng: `YYYY-MM-DD HH:mm`', ephemeral: true });
        }
        if (end.isBefore(start)) {
            return interaction.reply({ content: '❌ Ngày kết thúc không thể trước ngày bắt đầu!', ephemeral: true });
        }

        // Lưu config
        db.config.startTime = start.toISOString();
        db.config.endTime = end.toISOString();
        db.config.logMessageId = null; // Reset log cũ

        // Tạo Embed hiển thị
        const embed = new EmbedBuilder()
            .setTitle('📊 BẢNG KHẢO SÁT ĐỔI PHÁI - NGHỊCH THỦY HÀN')
            .setDescription(
                `Chào các hiệp khách! BQT muốn thăm dò ý kiến của mọi người về việc chuyển đổi phái.\n\n` +
                `👉 Hãy bấm vào nút bên dưới và điền thông tin.\n` +
                `*Ví dụ: Đang chơi Toái Mộng, muốn đổi sang Huyền Cơ...*\n\n` +
                `⏳ **Thời gian khảo sát:** Từ <t:${Math.floor(start.valueOf() / 1000)}:f> đến <t:${Math.floor(end.valueOf() / 1000)}:f>`
            )
            .setColor('#2b2d31')
            .setFooter({ text: 'Nghịch Thủy Hàn - Thăm dò chuyển phái' })
            .setTimestamp();

        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('register_vote')
                .setLabel('Bỏ Phiếu Đổi Phái')
                .setEmoji('📝')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [embed], components: [btn] });
    }

    // --- B. KHI USER BẤM NÚT "BỎ PHIẾU" ---
    if (interaction.isButton() && interaction.customId === 'register_vote') {
        const now = dayjs();
        const start = dayjs(db.config.startTime);
        const end = dayjs(db.config.endTime);

        // 1. Kiểm tra thời gian
        if (now.isBefore(start)) {
            return interaction.reply({ content: `⏳ Đợt khảo sát chưa bắt đầu. Vui lòng quay lại vào lúc <t:${Math.floor(start.valueOf() / 1000)}:f>.`, ephemeral: true });
        }
        if (now.isAfter(end)) {
            return interaction.reply({ content: `🔒 Đợt khảo sát đã kết thúc. Hệ thống không nhận thêm phiếu.`, ephemeral: true });
        }

        // 2. Kiểm tra xem đã vote chưa (Chống Spam)
        if (db.votes.has(interaction.user.id)) {
            return interaction.reply({ content: `❌ Bạn đã đăng ký rồi! Mỗi tài khoản chỉ được đăng ký 1 lần. Nếu muốn đổi, hãy liên hệ Admin để Hủy ĐK.`, ephemeral: true });
        }

        // 3. Hiển thị Form (Modal)
        const modal = new ModalBuilder().setCustomId('vote_modal').setTitle('Đăng Ký Đổi Phái');

        const ingameInput = new TextInputBuilder().setCustomId('ingame').setLabel('Tên Ingame của bạn').setStyle(TextInputStyle.Short).setRequired(true);
        const oldFactionInput = new TextInputBuilder().setCustomId('old_faction').setLabel('Phái hiện tại').setStyle(TextInputStyle.Short).setRequired(true);
        const newFactionInput = new TextInputBuilder().setCustomId('new_faction').setLabel('Phái muốn đổi sang').setStyle(TextInputStyle.Short).setRequired(true);
        
        // Discord Modal không hỗ trợ thả xuống, nên dùng TextInput và yêu cầu gõ đúng
        const timeInput = new TextInputBuilder()
            .setCustomId('time_option')
            .setLabel('Thời gian (Gõ: VinhVien / Thu3Ngay / ThuVaiNgay)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('VinhVien / Thu3Ngay / ThuVaiNgay')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(ingameInput),
            new ActionRowBuilder().addComponents(oldFactionInput),
            new ActionRowBuilder().addComponents(newFactionInput),
            new ActionRowBuilder().addComponents(timeInput)
        );

        await interaction.showModal(modal);
    }

    // --- C. KHI USER SUBMIT FORM ---
    if (interaction.isModalSubmit() && interaction.customId === 'vote_modal') {
        // Tránh lỗi "Ứng dụng không phản hồi kịp thời"
        await interaction.deferReply({ ephemeral: true });

        const ingame = interaction.fields.getTextInputValue('ingame');
        const oldFaction = interaction.fields.getTextInputValue('old_faction');
        const newFaction = interaction.fields.getTextInputValue('new_faction');
        let timeOptionRaw = interaction.fields.getTextInputValue('time_option').toLowerCase();

        // Chuẩn hóa thời gian hiển thị
        let timeOption = 'Chưa xác định';
        if (timeOptionRaw.includes('vinh')) timeOption = 'Vĩnh viễn';
        else if (timeOptionRaw.includes('3')) timeOption = 'Thử vài ba ngày';
        else if (timeOptionRaw.includes('vai')) timeOption = 'Thử vài ngày thấy hợp sẽ đổi hẳn';

        // Lưu Database
        db.votes.set(interaction.user.id, {
            userId: interaction.user.id,
            ingame,
            oldFaction,
            newFaction,
            timeOption,
            timestamp: dayjs().format('HH:mm - DD/MM/YYYY')
        });

        await interaction.editReply({ 
            content: `✅ **Đăng ký thành công!**\nHệ thống đã ghi nhận bạn muốn chuyển sang phái **${newFaction}** (${timeOption}).` 
        });

        // Cập nhật kênh Log
        await updateLogChannel(interaction.client);
    }
});

// ==========================================
// 4. HÀM CẬP NHẬT KÊNH LOG (Gom nhóm như ảnh 2)
// ==========================================
async function updateLogChannel(client) {
    const logChannelId = process.env.LOG_CHANNEL_ID;
    const channel = await client.channels.fetch(logChannelId).catch(() => null);
    if (!channel) return console.log('⚠️ Không tìm thấy kênh log!');

    // 1. Phân loại phiếu bầu theo Phái muốn đổi
    const groupedVotes = {};
    for (const [key, value] of db.votes) {
        if (!groupedVotes[value.newFaction]) groupedVotes[value.newFaction] = [];
        groupedVotes[value.newFaction].push(value);
    }

    // 2. Tạo nội dung Log
    let logContent = `**📊 DANH SÁCH ĐĂNG KÝ ĐỔI PHÁI**\n`;
    logContent += `⏳ Thời gian: <t:${Math.floor(new Date(db.config.startTime).getTime() / 1000)}:f> - <t:${Math.floor(new Date(db.config.endTime).getTime() / 1000)}:f>\n\n`;

    if (db.votes.size === 0) {
        logContent += `*Chưa có ai đăng ký.*`;
    } else {
        for (const faction in groupedVotes) {
            logContent += `🔥 **${faction}** (${groupedVotes[faction].length})\n`;
            groupedVotes[faction].forEach((vote, index) => {
                logContent += `${index + 1}. <@${vote.userId}> (Ingame: ${vote.ingame}) - *${vote.timeOption}*\n`;
            });
            logContent += `\n`;
        }
    }

    logContent += `*Cập nhật lúc: ${dayjs().format('HH:mm:ss')}*`;

    // 3. Kiểm tra xem đã có tin nhắn log cũ chưa để Edit (tránh spam kênh)
    try {
        if (db.config.logMessageId) {
            const oldMsg = await channel.messages.fetch(db.config.logMessageId).catch(() => null);
            if (oldMsg) {
                await oldMsg.edit(logContent);
                return;
            }
        }
        
        // Nếu chưa có, gửi tin nhắn mới và lưu ID
        const newMsg = await channel.send(logContent);
        db.config.logMessageId = newMsg.id;
        
    } catch (error) {
        console.error('Lỗi cập nhật log:', error);
    }
}

client.login(process.env.DISCORD_TOKEN);
