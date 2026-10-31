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
    Routes,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
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
// XỬ LÝ LỆNH SLASH & TƯƠNG TÁC
// ==========================================
client.on('interactionCreate', async interaction => {
    
    // 1. LỆNH SETUP VOTE CỦA ADMIN
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
        
        // Tạo tin nhắn Log rỗng
        if (process.env.LOG_CHANNEL_ID) {
            const logChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                const initialLog = await logChannel.send('Đang khởi tạo bảng log...');
                db.config.logMessageId = initialLog.id;
            }
        }
    }

    // 2. BẤM NÚT "BỎ PHIẾU" -> HIỆN MENU CHỌN PHÁI (Thay vì gõ Form)
    if (interaction.isButton() && interaction.customId === 'register_vote') {
        const now = dayjs();
        const start = dayjs(db.config.startTime);
        const end = dayjs(db.config.endTime);

        if (!start.isValid() || !end.isValid()) return interaction.reply({ content: `❌ Chưa có đợt khảo sát nào được mở!`, ephemeral: true });
        if (now.isBefore(start)) return interaction.reply({ content: `⏳ Chưa tới giờ!`, ephemeral: true });
        if (now.isAfter(end)) return interaction.reply({ content: `🔒 Đã hết hạn đăng ký!`, ephemeral: true });

        // Tạo Menu chọn phái
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_faction_to_change')
            .setPlaceholder('Chọn phái mà bạn muốn đổi sang...')
            .addOptions(
                FACTIONS.map(faction => 
                    new StringSelectMenuOptionBuilder()
                        .setLabel(faction.label)
                        .setValue(faction.value)
                        .setEmoji(faction.emoji) 
                )
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        // Hiển thị menu ẩn
        await interaction.reply({ content: '👇 Hãy chọn phái bạn muốn đổi sang:', components: [row], ephemeral: true });
    }

    // 3. CHỌN PHÁI TỪ MENU -> HIỆN FORM ĐIỀN THÔNG TIN
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_faction_to_change') {
        const selectedFaction = interaction.values[0];

        const modal = new ModalBuilder().setCustomId(`vote_modal_${selectedFaction}`).setTitle(`Đổi sang phái: ${selectedFaction}`);

        const ingameInput = new TextInputBuilder().setCustomId('ingame').setLabel('Ingame của bạn').setStyle(TextInputStyle.Short).setRequired(true);
        const oldFactionInput = new TextInputBuilder().setCustomId('old_faction').setLabel('Phái hiện tại').setStyle(TextInputStyle.Short).setRequired(true);
        const timeInput = new TextInputBuilder()
            .setCustomId('time_option')
            .setLabel('Thời gian (VinhVien / Thu3Ngay / ThuVaiNgay)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        // Nếu đã từng vote, tự điền lại cho nhanh
        if (db.votes.has(interaction.user.id)) {
            const oldData = db.votes.get(interaction.user.id);
            ingameInput.setValue(oldData.ingame);
            oldFactionInput.setValue(oldData.oldFaction);
            timeInput.setValue(oldData.timeOptionRaw || oldData.timeOption);
        }

        modal.addComponents(
            new ActionRowBuilder().addComponents(ingameInput),
            new ActionRowBuilder().addComponents(oldFactionInput),
            new ActionRowBuilder().addComponents(timeInput)
        );

        await interaction.showModal(modal);
    }

    // 4. SUBMIT FORM (Lưu DB & Cập nhật Log)
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

        // Lưu hoặc ghi đè DB
        db.votes.set(interaction.user.id, {
            userId: interaction.user.id,
            ingame,
            oldFaction,
            newFaction,
            timeOption,
            timeOptionRaw: interaction.fields.getTextInputValue('time_option')
        });

        // TẠO NÚT HỦY ĐK RIÊNG CHO USER NÀY
        const cancelBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`user_cancel_${interaction.user.id}`)
                .setLabel('Hủy Đăng Ký')
                .setEmoji('🗑️')
                .setStyle(ButtonStyle.Danger)
        );

        // Gửi tin nhắn ẩn kèm nút Hủy
        await interaction.editReply({ 
            content: `✅ **Cập nhật thành công!**\nHệ thống ghi nhận: **${ingame}** đổi sang **${newFaction}** (${timeOption}).\n*(Nếu muốn đổi lại hoặc hủy, hãy bấm nút bên dưới).*`,
            components: [cancelBtn]
        });

        await updateLogChannel(interaction.client);
    }

    // 5. USER TỰ BẤM NÚT HỦY ĐK CỦA MÌNH
    if (interaction.isButton() && interaction.customId.startsWith('user_cancel_')) {
        const targetId = interaction.customId.replace('user_cancel_', '');
        
        // Đảm bảo chỉ chính chủ mới bấm được nút này
        if (interaction.user.id !== targetId) {
            return interaction.reply({ content: `❌ Bạn không thể hủy phiếu của người khác!`, ephemeral: true });
        }

        if (db.votes.has(targetId)) {
            db.votes.delete(targetId);
            await updateLogChannel(interaction.client);
            
            // Cập nhật lại tin nhắn ẩn, xóa nút đi
            await interaction.update({ 
                content: `✅ **Đã hủy đăng ký thành công!** Bạn có thể bấm nút "Bỏ Phiếu Đổi Phái" bên ngoài để vote lại.`, 
                components: [] 
            });
        } else {
            await interaction.update({ content: `❌ Không tìm thấy dữ liệu đăng ký của bạn (có thể đã bị Admin xóa).`, components: [] });
        }
    }

    // 6. ADMIN BẤM NÚT XÓA TRÊN KÊNH LOG (Dự phòng)
    if (interaction.isButton() && interaction.customId.startsWith('admin_cancel_')) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Bạn không có quyền Admin!', ephemeral: true });
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

    try {
        const logMsg = await channel.messages.fetch(db.config.logMessageId);
        await logMsg.edit({ content: logContent });
    } catch (error) {
        console.error('Lỗi cập nhật log:', error);
    }
}

client.login(process.env.DISCORD_TOKEN);
