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
    StringSelectMenuOptionBuilder,
    ChannelType // Cần import thêm cái này để giới hạn chỉ chọn kênh chat
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
// ĐĂNG KÝ SLASH COMMANDS (Thêm tuỳ chọn Kênh)
// ==========================================
const commands = [
    new SlashCommandBuilder()
        .setName('setup-vote')
        .setDescription('Tạo bảng khảo sát đổi phái (Admin)')
        .addChannelOption(option => 
            option.setName('kenh')
                .setDescription('Chọn kênh để gửi bảng khảo sát')
                .addChannelTypes(ChannelType.GuildText) // Chỉ cho chọn kênh chat chữ
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('thoi-gian')
                .setDescription('Số giờ mở vote (VD: 24, 48, 72...)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(8760)),
    new SlashCommandBuilder()
        .setName('check-vote')
        .setDescription('Xem nhanh danh sách đăng ký đổi phái hiện tại')
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
// HÀM TẠO NỘI DUNG LOG
// ==========================================
function generateLogContent() {
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
                    const oldFactionData = FACTIONS.find(f => f.value === vote.oldFaction);
                    const oldFactionIcon = oldFactionData ? oldFactionData.emoji : '💬';
                    logContent += `   └ Từ: ${oldFactionIcon} ${vote.oldFaction} | T/gian: *${vote.timeOption}*\n`;
                });
                logContent += `\n`;
            }
        }
    }
    logContent += `*Cập nhật lúc: ${dayjs().format('HH:mm:ss')}*`;
    return logContent;
}

// ==========================================
// XỬ LÝ LỆNH SLASH & TƯƠNG TÁC
// ==========================================
client.on('interactionCreate', async interaction => {
    
    // 1. LỆNH CHECK VOTE
    if (interaction.isChatInputCommand() && interaction.commandName === 'check-vote') {
        if (!db.config.startTime) {
            return interaction.reply({ content: '❌ Hiện chưa có đợt khảo sát nào!', ephemeral: true });
        }
        return interaction.reply({ content: generateLogContent(), ephemeral: true });
    }

    // 2. LỆNH SETUP VOTE (Admin)
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup-vote') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Bạn cần quyền Admin!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const targetChannel = interaction.options.getChannel('kenh'); // Lấy kênh được chọn
        const hours = interaction.options.getInteger('thoi-gian');
        const start = dayjs(); 
        const end = start.add(hours, 'hour');

        db.config.startTime = start.toISOString();
        db.config.endTime = end.toISOString();
        db.config.logMessageId = null; 

        const embed = new EmbedBuilder()
            .setTitle('📊 BẢNG KHẢO SÁT ĐỔI PHÁI - NGHỊCH THỦY HÀN')
            .setDescription(
                `Chào ae! Đông Hoa muốn thăm dò ý kiến của mọi người về việc chuyển đổi phái.\n\n` +
                `👉 Bấm nút bên dưới, chọn phái muốn đổi và điền thông tin.\n` +
                `*(Bạn có thể bấm lại để thay đổi lựa chọn bất cứ lúc nào).*\n\n` +
                `⏳ **Thời gian khảo sát:** Từ <t:${Math.floor(start.valueOf() / 1000)}:f> đến <t:${Math.floor(end.valueOf() / 1000)}:f> (Kéo dài ${hours} tiếng)`
            )
            .setColor('#2b2d31')
            .setFooter({ text: 'Nghịch Thủy Hàn - Thăm dò chuyển phái' });

        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('register_vote').setLabel('Bỏ Phiếu Đổi Phái').setEmoji('📝').setStyle(ButtonStyle.Primary)
        );

        try {
            // Gửi bảng khảo sát vào kênh Admin đã chọn
            await targetChannel.send({ embeds: [embed], components: [btn] });
        } catch (error) {
            return interaction.editReply({ content: `❌ Bot không có quyền gửi tin nhắn vào kênh <#${targetChannel.id}>. Vui lòng kiểm tra lại quyền!` });
        }

        // Tạo tin nhắn Log trên kênh Log (nếu có cấu hình)
        if (process.env.LOG_CHANNEL_ID) {
            const logChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                const btnCancelRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('cancel_my_vote').setLabel('Hủy Đăng Ký Của Tôi').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
                );
                const initialLog = await logChannel.send({ content: 'Đang khởi tạo bảng log...', components: [btnCancelRow] });
                db.config.logMessageId = initialLog.id;
            }
        }
        await interaction.editReply({ content: `✅ Đã tạo bảng khảo sát thành công tại kênh <#${targetChannel.id}>!` });
    }

    // 3. BẤM NÚT "BỎ PHIẾU" -> CHỌN PHÁI MỚI
    if (interaction.isButton() && interaction.customId === 'register_vote') {
        const now = dayjs();
        const start = dayjs(db.config.startTime);
        const end = dayjs(db.config.endTime);

        if (!start.isValid() || !end.isValid()) return interaction.reply({ content: `❌ Chưa có đợt khảo sát nào được mở!`, ephemeral: true });
        if (now.isBefore(start)) return interaction.reply({ content: `⏳ Chưa tới giờ!`, ephemeral: true });
        if (now.isAfter(end)) return interaction.reply({ content: `🔒 Đã hết hạn đăng ký!`, ephemeral: true });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_new_faction')
            .setPlaceholder('Bước 1: Chọn phái mà bạn MUỐN ĐỔI SANG...')
            .addOptions(FACTIONS.map(faction => new StringSelectMenuOptionBuilder().setLabel(faction.label).setValue(faction.value).setEmoji(faction.emoji)));

        const row = new ActionRowBuilder().addComponents(selectMenu);
        await interaction.reply({ content: '👇 **Bước 1:** Hãy chọn phái bạn muốn đổi sang:', components: [row], ephemeral: true });
    }

    // 4. CHỌN PHÁI MỚI -> CHỌN PHÁI CŨ
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_new_faction') {
        const newFaction = interaction.values[0];

        const oldFactionOptions = FACTIONS.filter(f => f.value !== newFaction).map(faction => 
            new StringSelectMenuOptionBuilder().setLabel(faction.label).setValue(faction.value).setEmoji(faction.emoji)
        );

        const selectMenuOld = new StringSelectMenuBuilder()
            .setCustomId(`select_old_faction_${newFaction}`)
            .setPlaceholder('Bước 2: Chọn phái HIỆN TẠI của bạn...')
            .addOptions(oldFactionOptions);

        const row = new ActionRowBuilder().addComponents(selectMenuOld);
        await interaction.update({ content: `✅ Đã chọn đổi sang: **${newFaction}**\n👇 **Bước 2:** Hãy chọn phái bạn đang chơi hiện tại:`, components: [row] });
    }

    // 5. CHỌN PHÁI CŨ -> HIỆN FORM
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_old_faction_')) {
        const newFaction = interaction.customId.replace('select_old_faction_', '');
        const oldFaction = interaction.values[0];

        const modal = new ModalBuilder().setCustomId(`vote_modal_${newFaction}_${oldFaction}`).setTitle('Hoàn tất đăng ký');

        const ingameInput = new TextInputBuilder().setCustomId('ingame').setLabel('Ingame của bạn').setStyle(TextInputStyle.Short).setRequired(true);
        const timeInput = new TextInputBuilder().setCustomId('time_option').setLabel('Thời gian (VinhVien / Thu3Ngay / ThuVaiNgay)').setStyle(TextInputStyle.Short).setRequired(true);

        if (db.votes.has(interaction.user.id)) {
            const oldData = db.votes.get(interaction.user.id);
            ingameInput.setValue(oldData.ingame);
            timeInput.setValue(oldData.timeOptionRaw || oldData.timeOption);
        }

        modal.addComponents(new ActionRowBuilder().addComponents(ingameInput), new ActionRowBuilder().addComponents(timeInput));
        await interaction.showModal(modal);
    }

    // 6. SUBMIT FORM
    if (interaction.isModalSubmit() && interaction.customId.startsWith('vote_modal_')) {
        await interaction.deferReply({ ephemeral: true });

        const idParts = interaction.customId.split('_'); 
        const newFaction = idParts[2];
        const oldFaction = idParts[3];

        const ingame = interaction.fields.getTextInputValue('ingame');
        let timeOptionRaw = interaction.fields.getTextInputValue('time_option').toLowerCase();

        let timeOption = 'Chưa xác định';
        if (timeOptionRaw.includes('vinh')) timeOption = 'Vĩnh viễn';
        else if (timeOptionRaw.includes('3')) timeOption = 'Thử vài ba ngày';
        else if (timeOptionRaw.includes('vai')) timeOption = 'Thử vài ngày thấy hợp sẽ đổi hẳn';

        db.votes.set(interaction.user.id, {
            userId: interaction.user.id, ingame, oldFaction, newFaction, timeOption, timeOptionRaw: interaction.fields.getTextInputValue('time_option')
        });

        await interaction.editReply({ content: `✅ **Cập nhật thành công!**\nHệ thống ghi nhận: **${ingame}** đổi từ **${oldFaction}** sang **${newFaction}** (${timeOption}).` });
        await updateLogChannel(interaction.client);
    }

    // 7. BẤM NÚT "HỦY ĐĂNG KÝ CỦA TÔI"
    if (interaction.isButton() && interaction.customId === 'cancel_my_vote') {
        const userId = interaction.user.id;

        if (!db.votes.has(userId)) {
            return interaction.reply({ content: `❌ Bạn chưa đăng ký đổi phái, không thể hủy!`, ephemeral: true });
        }

        const confirmBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_cancel_my_vote').setLabel('Xác Nhận Hủy').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('abort_cancel').setLabel('Không Hủy Nữa').setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ 
            content: `⚠️ **Bạn có chắc chắn muốn hủy đăng ký đổi phái không?**\nHành động này sẽ xóa phiếu của bạn khỏi hệ thống.`, 
            components: [confirmBtn], 
            ephemeral: true 
        });
    }

    // 8. XÁC NHẬN HỦY ĐĂNG KÝ
    if (interaction.isButton() && interaction.customId === 'confirm_cancel_my_vote') {
        const userId = interaction.user.id;

        if (db.votes.has(userId)) {
            db.votes.delete(userId);
            await updateLogChannel(interaction.client);
            
            await interaction.update({ 
                content: `✅ **Đã hủy đăng ký thành công!**\nBạn có thể bấm nút "Bỏ Phiếu Đổi Phái" để đăng ký lại nếu muốn.`, 
                components: [] 
            });
        } else {
            await interaction.update({ content: `❌ Không tìm thấy dữ liệu đăng ký của bạn.`, components: [] });
        }
    }

    // 9. HỦY THAO TÁC XÓA
    if (interaction.isButton() && interaction.customId === 'abort_cancel') {
        await interaction.update({ content: `✅ Đã hủy thao tác xóa. Phiếu của bạn vẫn được giữ nguyên.`, components: [] });
    }
});

// ==========================================
// HÀM CẬP NHẬT KÊNH LOG
// ==========================================
async function updateLogChannel(client) {
    if (!process.env.LOG_CHANNEL_ID || !db.config.logMessageId) return;

    const channel = await client.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    const btnCancelRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cancel_my_vote').setLabel('Hủy Đăng Ký Của Tôi').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    );

    try {
        const logMsg = await channel.messages.fetch(db.config.logMessageId);
        await logMsg.edit({ content: generateLogContent(), components: [btnCancelRow] });
    } catch (error) {
        console.error('Lỗi cập nhật log:', error);
    }
}

client.login(process.env.DISCORD_TOKEN);
