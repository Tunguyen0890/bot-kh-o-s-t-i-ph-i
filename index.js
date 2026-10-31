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
    PermissionFlagsBits
} = require('discord.js');
const dayjs = require('dayjs');

// ==========================================
// 1. CẤU HÌNH & DATABASE TẠM THỜI
// ==========================================
const PREFIX = '!'; // Bạn có thể đổi thành ký tự khác tùy thích

const db = {
    config: {
        startTime: dayjs().subtract(1, 'day').toISOString(), 
        endTime: dayjs().add(7, 'day').toISOString(),
        logChannelId: null, // Sẽ được set bằng lệnh !set-log
        logMessageId: null 
    },
    votes: new Map() 
};

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages, // Cần thiết để đọc lệnh chữ
        GatewayIntentBits.MessageContent // BẮT BUỘC PHẢI BẬT TRONG PORTAL
    ] 
});

client.once('ready', () => {
    console.log(`🤖 Bot ${client.user.tag} đã online!`);
    console.log(`💡 Gõ ${PREFIX}set-log tại kênh muốn làm log để thiết lập.`);
    console.log(`💡 Gõ ${PREFIX}setup-vote YYYY-MM-DD HH:mm YYYY-MM-DD HH:mm để tạo bảng vote.`);
});

// ==========================================
// 2. XỬ LÝ LỆNH CHỮ (PREFIX COMMANDS)
// ==========================================
client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // --- LỆNH SET KÊNH LOG ---
    if (command === 'set-log') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Bạn cần quyền Admin để dùng lệnh này!');
        }

        db.config.logChannelId = message.channel.id;
        db.config.logMessageId = null; // Reset tin nhắn log cũ nếu có
        
        return message.reply(`✅ Đã thiết lập kênh này làm kênh Log! Mọi đăng ký mới sẽ được cập nhật tại đây.`);
    }

    // --- LỆNH TẠO BẢNG VOTE ---
    if (command === 'setup-vote') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Bạn cần quyền Admin để dùng lệnh này!');
        }

        // Cú pháp: !setup-vote 2026-11-01 08:00 2026-11-10 23:59
        const timeString = args.join(' '); 
        const match = timeString.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2})/);

        if (!match) {
            return message.reply('❌ Sai cú pháp! Vui lòng nhập: `!setup-vote YYYY-MM-DD HH:mm YYYY-MM-DD HH:mm`\nVí dụ: `!setup-vote 2026-11-01 08:00 2026-11-10 23:59`');
        }

        const start = dayjs(match[1], 'YYYY-MM-DD HH:mm');
        const end = dayjs(match[2], 'YYYY-MM-DD HH:mm');

        if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
            return message.reply('❌ Thời gian không hợp lệ hoặc ngày kết thúc trước ngày bắt đầu!');
        }

        db.config.startTime = start.toISOString();
        db.config.endTime = end.toISOString();

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

        await message.channel.send({ embeds: [embed], components: [btn] });
        
        // Xóa lệnh của admin cho gọn kênh
        message.delete().catch(() => {});
    }
});

// ==========================================
// 3. XỬ LÝ NÚT BẤM & MODAL (Giữ nguyên logic cũ)
// ==========================================
client.on('interactionCreate', async interaction => {
    
    // --- KHI USER BẤM NÚT "BỎ PHIẾU" ---
    if (interaction.isButton() && interaction.customId === 'register_vote') {
        const now = dayjs();
        const start = dayjs(db.config.startTime);
        const end = dayjs(db.config.endTime);

        // Kiểm tra thời gian
        if (now.isBefore(start)) {
            return interaction.reply({ content: `⏳ Đợt khảo sát chưa bắt đầu. Vui lòng quay lại vào lúc <t:${Math.floor(start.valueOf() / 1000)}:f>.`, ephemeral: true });
        }
        if (now.isAfter(end)) {
            return interaction.reply({ content: `🔒 Đợt khảo sát đã kết thúc. Hệ thống không nhận thêm phiếu.`, ephemeral: true });
        }

        // Kiểm tra xem đã vote chưa
        if (db.votes.has(interaction.user.id)) {
            return interaction.reply({ content: `❌ Bạn đã đăng ký rồi! Mỗi tài khoản chỉ được đăng ký 1 lần.`, ephemeral: true });
        }

        // Mở Form
        const modal = new ModalBuilder().setCustomId('vote_modal').setTitle('Đăng Ký Đổi Phái');

        const ingameInput = new TextInputBuilder().setCustomId('ingame').setLabel('Tên Ingame của bạn').setStyle(TextInputStyle.Short).setRequired(true);
        const oldFactionInput = new TextInputBuilder().setCustomId('old_faction').setLabel('Phái hiện tại').setStyle(TextInputStyle.Short).setRequired(true);
        const newFactionInput = new TextInputBuilder().setCustomId('new_faction').setLabel('Phái muốn đổi sang').setStyle(TextInputStyle.Short).setRequired(true);
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

    // --- KHI USER SUBMIT FORM ---
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
// 4. HÀM CẬP NHẬT LOG (Tự động lấy kênh từ DB)
// ==========================================
async function updateLogChannel(client) {
    // Nếu Admin chưa set kênh log thì bỏ qua
    if (!db.config.logChannelId) return; 

    const channel = await client.channels.fetch(db.config.logChannelId).catch(() => null);
    if (!channel) return console.log('⚠️ Không tìm thấy kênh log!');

    const groupedVotes = {};
    for (const [key, value] of db.votes) {
        if (!groupedVotes[value.newFaction]) groupedVotes[value.newFaction] = [];
        groupedVotes[value.newFaction].push(value);
    }

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

    try {
        if (db.config.logMessageId) {
            const oldMsg = await channel.messages.fetch(db.config.logMessageId).catch(() => null);
            if (oldMsg) {
                await oldMsg.edit(logContent);
                return;
            }
        }
        const newMsg = await channel.send(logContent);
        db.config.logMessageId = newMsg.id;
    } catch (error) {
        console.error('Lỗi cập nhật log:', error);
    }
}

client.login(process.env.DISCORD_TOKEN);
