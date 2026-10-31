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
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const dayjs = require('dayjs');

const PREFIX = '!'; 

// ==========================================
// CẤU HÌNH DANH SÁCH PHÁI (SỬ DỤNG CUSTOM EMOJI ID)
// Lưu ý: Tên tiếng Anh (VD: HuyenCo) phải viết liền, không dấu, không cách.
// Nếu sai tên, Discord sẽ không hiện được icon.
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
        startTime: dayjs().subtract(1, 'day').toISOString(), 
        endTime: dayjs().add(7, 'day').toISOString(),
        logChannelId: null, 
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

client.once('ready', () => {
    console.log(`🤖 Bot ${client.user.tag} đã online!`);
    console.log(`💡 Gõ ${PREFIX}set-log tại kênh muốn làm log.`);
    console.log(`💡 Gõ ${PREFIX}setup-vote YYYY-MM-DD HH:mm YYYY-MM-DD HH:mm để tạo bảng vote.`);
});

// ==========================================
// XỬ LÝ LỆNH CHỮ (PREFIX)
// ==========================================
client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'set-log') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ Cần quyền Admin!');
        db.config.logChannelId = message.channel.id;
        db.config.logMessageId = null; 
        return message.reply(`✅ Đã thiết lập kênh này làm kênh Log!`);
    }

    if (command === 'setup-vote') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ Cần quyền Admin!');

        const timeString = args.join(' '); 
        const match = timeString.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2})/);

        if (!match) return message.reply('❌ Sai cú pháp! VD: `!setup-vote 2026-11-01 08:00 2026-11-10 23:59`');

        const start = dayjs(match[1], 'YYYY-MM-DD HH:mm');
        const end = dayjs(match[2], 'YYYY-MM-DD HH:mm');

        if (!start.isValid() || !end.isValid() || end.isBefore(start)) return message.reply('❌ Thời gian không hợp lệ!');

        db.config.startTime = start.toISOString();
        db.config.endTime = end.toISOString();

        const embed = new EmbedBuilder()
            .setTitle('📊 BẢNG KHẢO SÁT ĐỔI PHÁI - NGHỊCH THỦY HÀN')
            .setDescription(
                `Chào các hiệp khách! BQT muốn thăm dò ý kiến của mọi người về việc chuyển đổi phái.\n\n` +
                `👉 Bấm nút bên dưới, chọn phái muốn đổi và điền thông tin.\n\n` +
                `⏳ **Thời gian khảo sát:** Từ <t:${Math.floor(start.valueOf() / 1000)}:f> đến <t:${Math.floor(end.valueOf() / 1000)}:f>`
            )
            .setColor('#2b2d31')
            .setFooter({ text: 'Nghịch Thủy Hàn - Thăm dò chuyển phái' });

        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_vote').setLabel('Bỏ Phiếu Đổi Phái').setEmoji('📝').setStyle(ButtonStyle.Primary)
        );

        await message.channel.send({ embeds: [embed], components: [btn] });
        message.delete().catch(() => {});
    }
});

// ==========================================
// XỬ LÝ TƯƠNG TÁC (Nút, Menu, Modal)
// ==========================================
client.on('interactionCreate', async interaction => {
    
    // --- BƯỚC 1: BẤM NÚT "BỎ PHIẾU" -> HIỆN MENU CHỌN PHÁI ---
    if (interaction.isButton() && interaction.customId === 'start_vote') {
        const now = dayjs();
        const start = dayjs(db.config.startTime);
        const end = dayjs(db.config.endTime);

        if (now.isBefore(start)) return interaction.reply({ content: `⏳ Chưa tới giờ! Mở lúc <t:${Math.floor(start.valueOf() / 1000)}:f>.`, ephemeral: true });
        if (now.isAfter(end)) return interaction.reply({ content: `🔒 Đã hết hạn đăng ký!`, ephemeral: true });
        if (db.votes.has(interaction.user.id)) return interaction.reply({ content: `❌ Bạn đã đăng ký rồi!`, ephemeral: true });

        // Tạo Menu thả xuống 8 phái theo đúng thứ tự (Có kèm Emoji ID)
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_faction')
            .setPlaceholder('Chọn phái mà bạn muốn chuyển sang...')
            .addOptions(
                FACTIONS.map(faction => 
                    new StringSelectMenuOptionBuilder()
                        .setLabel(faction.label)
                        .setValue(faction.value)
                        .setEmoji(faction.emoji) // Nạp Custom Emoji vào đây
                )
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({ content: '👇 Hãy chọn phái bạn muốn đổi sang:', components: [row], ephemeral: true });
    }

    // --- BƯỚC 2: CHỌN PHÁI XONG -> HIỆN FORM NHẬP LIỆU ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_faction') {
        const selectedFaction = interaction.values[0]; // Phái user vừa chọn

        const modal = new ModalBuilder().setCustomId(`vote_modal_${selectedFaction}`).setTitle(`Đổi sang phái: ${selectedFaction}`);

        const ingameInput = new TextInputBuilder().setCustomId('ingame').setLabel('Tên Ingame của bạn').setStyle(TextInputStyle.Short).setRequired(true);
        const oldFactionInput = new TextInputBuilder().setCustomId('old_faction').setLabel('Phái hiện tại đang chơi').setStyle(TextInputStyle.Short).setRequired(true);
        const timeInput = new TextInputBuilder()
            .setCustomId('time_option')
            .setLabel('Thời gian (Gõ: VinhVien / Thu3Ngay / ThuVaiNgay)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('VinhVien / Thu3Ngay / ThuVaiNgay')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(ingameInput),
            new ActionRowBuilder().addComponents(oldFactionInput),
            new ActionRowBuilder().addComponents(timeInput)
        );

        await interaction.showModal(modal);
    }

    // --- BƯỚC 3: SUBMIT FORM ---
    if (interaction.isModalSubmit() && interaction.customId.startsWith('vote_modal_')) {
        await interaction.deferReply({ ephemeral: true });

        const newFaction = interaction.customId.replace('vote_modal_', '');
        
        const ingame = interaction.fields.getTextInputValue('ingame');
        const oldFaction = interaction.fields.getTextInputValue('old_faction');
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
            content: `✅ **Đăng ký thành công!**\nHệ thống ghi nhận: **${ingame}** chuyển từ **${oldFaction}** sang **${newFaction}** (${timeOption}).` 
        });

        await updateLogChannel(interaction.client);
    }
});

// ==========================================
// HÀM CẬP NHẬT LOG (TỰ ĐỘNG IN RA THEO THỨ TỰ)
// ==========================================
async function updateLogChannel(client) {
    if (!db.config.logChannelId) return; 
    const channel = await client.channels.fetch(db.config.logChannelId).catch(() => null);
    if (!channel) return;

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
        // Vòng lặp duyệt qua mảng FACTIONS để in ra đúng thứ tự từ trên xuống dưới
        for (const faction of FACTIONS) {
            if (groupedVotes[faction.value]) {
                // In Emoji chuẩn của phái
                logContent += `**${faction.emoji} ${faction.label}** (${groupedVotes[faction.value].length})\n`;
                groupedVotes[faction.value].forEach((vote, index) => {
                    logContent += `${index + 1}. <@${vote.userId}> (Ingame: ${vote.ingame}) - *${vote.timeOption}*\n`;
                });
                logContent += `\n`;
            }
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
