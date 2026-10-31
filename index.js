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
    StringSelectMenuOptionBuilder,
    SlashCommandBuilder,
    REST,
    Routes
} = require('discord.js');
const dayjs = require('dayjs');

// ==========================================
// CẤU HÌNH DANH SÁCH PHÁI (CUSTOM EMOJI ID)
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
        endTime: null
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
// ĐĂNG KÝ SLASH COMMANDS (Dùng CLIENT_ID)
// ==========================================
const commands = [
    new SlashCommandBuilder()
        .setName('setup-vote')
        .setDescription('Tạo bảng khảo sát đổi phái (Admin)')
        .addIntegerOption(option => 
            option.setName('thoi-gian')
                .setDescription('Số giờ mở vote tính từ lúc gõ lệnh (VD: 24, 48, 72...)')
                .setRequired(true)
                .setMinValue(1))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
    console.log(`🤖 Bot ${client.user.tag} đã online!`);
    
    // Đăng ký lệnh toàn cầu (Global) bằng CLIENT_ID
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
            return interaction.reply({ content: '❌ Bạn cần quyền Admin để dùng lệnh này!', ephemeral: true });
        }

        const hours = interaction.options.getInteger('thoi-gian');
        
        // Lấy thời gian hiện tại (lúc gõ lệnh) làm mốc bắt đầu
        const start = dayjs(); 
        const end = start.add(hours, 'hour');

        db.config.startTime = start.toISOString();
        db.config.endTime = end.toISOString();

        const embed = new EmbedBuilder()
            .setTitle('📊 BẢNG KHẢO SÁT ĐỔI PHÁI - NGHỊCH THỦY HÀN')
            .setDescription(
                `Chào các hiệp khách! BQT muốn thăm dò ý kiến của mọi người về việc chuyển đổi phái.\n\n` +
                `👉 Bấm nút bên dưới, chọn phái muốn đổi và điền thông tin.\n\n` +
                `⏳ **Thời gian khảo sát:** Từ <t:${Math.floor(start.valueOf() / 1000)}:f> đến <t:${Math.floor(end.valueOf() / 1000)}:f> (Kéo dài ${hours} tiếng)`
            )
            .setColor('#2b2d31')
            .setFooter({ text: 'Nghịch Thủy Hàn - Thăm dò chuyển phái' });

        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_vote').setLabel('Bỏ Phiếu Đổi Phái').setEmoji('📝').setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [embed], components: [btn] });
    }

    // ==========================================
    // XỬ LÝ TƯƠNG TÁC (Nút, Menu, Modal)
    // ==========================================
    
    // BƯỚC 1: BẤM NÚT "BỎ PHIẾU"
    if (interaction.isButton() && interaction.customId === 'start_vote') {
        const now = dayjs();
        const start = dayjs(db.config.startTime);
        const end = dayjs(db.config.endTime);

        // Kiểm tra thời gian
        if (!start.isValid() || !end.isValid()) {
            return interaction.reply({ content: `❌ Chưa có đợt khảo sát nào được mở!`, ephemeral: true });
        }

        if (now.isBefore(start)) return interaction.reply({ content: `⏳ Chưa tới giờ! Mở lúc <t:${Math.floor(start.valueOf() / 1000)}:f>.`, ephemeral: true });
        if (now.isAfter(end)) return interaction.reply({ content: `🔒 Đã hết hạn đăng ký!`, ephemeral: true });
        
        // Kiểm tra chống spam (1 user/1 vote)
        if (db.votes.has(interaction.user.id)) return interaction.reply({ content: `❌ Bạn đã đăng ký rồi!`, ephemeral: true });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_faction')
            .setPlaceholder('Chọn phái mà bạn muốn chuyển sang...')
            .addOptions(
                FACTIONS.map(faction => 
                    new StringSelectMenuOptionBuilder()
                        .setLabel(faction.label)
                        .setValue(faction.value)
                        .setEmoji(faction.emoji) 
                )
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        await interaction.reply({ content: '👇 Hãy chọn phái bạn muốn đổi sang:', components: [row], ephemeral: true });
    }

    // BƯỚC 2: CHỌN PHÁI TỪ MENU -> HIỆN FORM
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_faction') {
        const selectedFaction = interaction.values[0];

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

    // BƯỚC 3: SUBMIT FORM
    if (interaction.isModalSubmit() && interaction.customId.startsWith('vote_modal_')) {
        // Rất quan trọng: deferReply để tránh lỗi "Ứng dụng không phản hồi kịp thời"
        await interaction.deferReply({ ephemeral: true });

        const newFaction = interaction.customId.replace('vote_modal_', '');
        const ingame = interaction.fields.getTextInputValue('ingame');
        const oldFaction = interaction.fields.getTextInputValue('old_faction');
        let timeOptionRaw = interaction.fields.getTextInputValue('time_option').toLowerCase();

        // Chuẩn hóa thời gian hiển thị
        let timeOption = 'Chưa xác định';
        if (timeOptionRaw.includes('vinh')) timeOption = 'Vĩnh viễn';
        else if (timeOptionRaw.includes('3')) timeOption = 'Thử vài ba ngày';
        else if (timeOptionRaw.includes('vai')) timeOption = 'Thử vài ngày thấy hợp sẽ đổi hẳn';

        // Lưu Database tạm
        db.votes.set(interaction.user.id, {
            userId: interaction.user.id,
            ingame,
            oldFaction,
            newFaction,
            timeOption,
            timestamp: dayjs().format('HH:mm - DD/MM/YYYY')
        });

        // Báo thành công ẩn cho user (Vì không có kênh log)
        await interaction.editReply({ 
            content: `✅ **Đăng ký thành công!**\nHệ thống ghi nhận: **${ingame}** chuyển từ **${oldFaction}** sang **${newFaction}** (${timeOption}).` 
        });
    }
});

client.login(process.env.DISCORD_TOKEN);
