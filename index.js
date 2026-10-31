require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    PermissionsBitField,
    ChannelType,
    SlashCommandBuilder
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ==========================================
// CẬP NHẬT ID EMOJI THEO ẢNH MỚI NHẤT
// Thứ tự: Huyền Cơ, Thần Tương, Cửu Linh, Thiết Y, Huyết Hà, Tố Vấn, Toái Mộng, Long Ngâm
// ==========================================
const EMOJIS = {
    HuyenCo: '1566154772120076371',
    ThanTuong: '1554525281396719696',
    CuuLinh: '1554525279215419412',
    ThietY: '1554525277340831794',
    HuyetHa: '1554525275402797177',
    ToVan: '1554525273192534107',
    ToaiMong: '1554525271259095130',
    LongNgam: '1554525268981321888'
};

const PHÁI = [
    { name: 'Huyền Cơ', emoji: EMOJIS.HuyenCo },
    { name: 'Thần Tương', emoji: EMOJIS.ThanTuong }, // Giữ đúng tên bạn yêu cầu
    { name: 'Cửu Linh', emoji: EMOJIS.CuuLinh },
    { name: 'Thiết Y', emoji: EMOJIS.ThietY },
    { name: 'Huyết Hà', emoji: EMOJIS.HuyetHa },
    { name: 'Tố Vấn', emoji: EMOJIS.ToVan },
    { name: 'Toái Mộng', emoji: EMOJIS.ToaiMong },
    { name: 'Long Ngâm', emoji: EMOJIS.LongNgam }
];

// Đăng ký Slash Command khi Bot khởi động
client.once('ready', async () => {
    console.log(`🤖 Bot đã online: ${client.user.tag}`);

    // Tạo lệnh /khaosat
    const khaoSatCommand = new SlashCommandBuilder()
        .setName('khaosat')
        .setDescription('Gửi bảng khảo sát đổi phái vào một kênh chỉ định')
        .addChannelOption(option => 
            option.setName('kenh')
                .setDescription('Chọn kênh (room) bạn muốn gửi bảng khảo sát vào')
                .addChannelTypes(ChannelType.GuildText) 
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator); 

    try {
        await client.application.commands.create(khaoSatCommand);
        console.log('✅ Đã đăng ký lệnh /khaosat thành công!');
    } catch (error) {
        console.error('❌ Lỗi đăng ký lệnh:', error);
    }
});

// Xử lý tương tác
client.on('interactionCreate', async (interaction) => {
    
    // --- XỬ LÝ LỆNH SLASH /khaosat ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'khaosat') {
        const targetChannel = interaction.options.getChannel('kenh');

        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('📊 BẢNG KHẢO SÁT ĐỔI PHÁI - NGHỊCH THỦY HÀN')
            .setDescription(
                'Chào các hiệp khách! BQT muốn thăm dò ý kiến của mọi người về việc chuyển đổi phái.\n\n' +
                '👉 **Hãy bấm vào nút bên dưới** và chọn phái mà bạn đang muốn chuyển sang.\n' +
                '*Ví dụ: Bạn đang chơi Toái Mộng, muốn đổi sang Huyền Cơ, hãy bấm nút và chọn Huyền Cơ.*\n\n' +
                '🕒 **Thời gian khảo sát:** Đến hết [Điền Ngày]'
            )
            .setImage('https://i.imgur.com/your_banner_image.png') // Nhớ thay ảnh bìa nếu có
            .setFooter({ text: 'Nghịch Thủy Hàn - Thăm dò chuyển phái', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        const button = new ButtonBuilder()
            .setCustomId('btn_mo_khaosat')
            .setLabel('Bỏ Phiếu Đổi Phái')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝');

        const row = new ActionRowBuilder().addComponents(button);

        try {
            await targetChannel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: `✅ Đã gửi bảng khảo sát vào kênh ${targetChannel}`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: `❌ Bot không có quyền gửi tin nhắn vào kênh ${targetChannel}.`, ephemeral: true });
        }
    }

    // --- XỬ LÝ KHI BẤM NÚT "BỎ PHIẾU ĐỔI PHÁI" ---
    if (interaction.isButton() && interaction.customId === 'btn_mo_khaosat') {
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('menu_chon_phai')
            .setPlaceholder('Bạn muốn chuyển sang phái nào?')
            .addOptions(
                PHÁI.map(p => 
                    new StringSelectMenuOptionBuilder()
                        .setLabel(p.name)
                        .setValue(p.name)
                        .setEmoji({ id: p.emoji }) 
                )
            );

        const rowMenu = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: '👇 **Vui lòng chọn phái bạn mong muốn chuyển sang trong danh sách dưới đây:**',
            components: [rowMenu],
            ephemeral: true 
        });
    }

    // --- XỬ LÝ KHI CHỌN PHÁI TRONG MENU ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'menu_chon_phai') {
        const phaiDaChon = interaction.values[0]; 
        const phaiInfo = PHÁI.find(p => p.name === phaiDaChon);

        const confirmEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setDescription(`✅ Bạn đã đăng ký nguyện vọng chuyển sang phái **${phaiInfo.name}** <:${phaiInfo.name.replace(/\s/g, '')}:${phaiInfo.emoji}> thành công!`)
            .setFooter({ text: 'Hệ thống đã ghi nhận phiếu của bạn.' });

        await interaction.update({
            content: '', 
            embeds: [confirmEmbed], 
            components: [] 
        });
    }
});

client.login(process.env.TOKEN);
