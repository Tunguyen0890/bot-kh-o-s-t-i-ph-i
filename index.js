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

// ID Emoji của các phái
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
    { name: 'Thần Tương', emoji: EMOJIS.ThanTuong }, 
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

    // BỔ SUNG: Thêm tùy chọn chọn kênh Log
    const khaoSatCommand = new SlashCommandBuilder()
        .setName('khaosat')
        .setDescription('Gửi bảng khảo sát đổi phái vào một kênh chỉ định')
        .addChannelOption(option => 
            option.setName('kenh')
                .setDescription('Chọn kênh (room) bạn muốn gửi bảng khảo sát vào')
                .addChannelTypes(ChannelType.GuildText) 
                .setRequired(true)
        )
        .addChannelOption(option => 
            option.setName('kenh_log')
                .setDescription('Chọn kênh để xem ai đã bình chọn (kênh Log)')
                .addChannelTypes(ChannelType.GuildText) 
                .setRequired(true) // Bắt buộc phải chọn kênh log để dễ quản lý
        )
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator); 

    try {
        // Đăng ký lệnh
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

        // LÀM ĐẸP LẠI GIAO DIỆN: Bỏ ảnh đám mây, sửa lại ngày tháng
        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('📊 BẢNG KHẢO SÁT ĐỔI PHÁI - NGHỊCH THỦY HÀN')
            .setDescription(
                'Chào các hiệp khách! BQT muốn thăm dò ý kiến của mọi người về việc chuyển đổi phái.\n\n' +
                '👉 **Hãy bấm vào nút bên dưới** và chọn phái mà bạn đang muốn chuyển sang.\n' +
                '*Ví dụ: Bạn đang chơi Toái Mộng, muốn đổi sang Huyền Cơ, hãy bấm nút và chọn Huyền Cơ.*\n\n' +
                '🕒 **Thời gian khảo sát:** Đến hết ngày 10/11/2026' // Sửa lại ngày tại đây
            )
            // .setImage('https://link_anh_cua_ban.png') // Nếu muốn có ảnh bìa đẹp, hãy mở comment dòng này và dán link ảnh vào
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

        // 1. Phản hồi ẩn cho người dùng (như cũ)
        const confirmEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setDescription(`✅ Bạn đã đăng ký nguyện vọng chuyển sang phái **${phaiInfo.name}** <:${phaiInfo.name.replace(/\s/g, '')}:${phaiInfo.emoji}> thành công!`)
            .setFooter({ text: 'Hệ thống đã ghi nhận phiếu của bạn.' });

        await interaction.update({
            content: '', 
            embeds: [confirmEmbed], 
            components: [] 
        });

        // ==========================================
        // 2. GỬI TIN NHẮN LOG CHO ADMIN
        // Lấy ID kênh log từ tin nhắn gốc
        // ==========================================
        try {
            // Lấy tin nhắn gốc chứa nút bấm (để tìm kênh log)
            const message = interaction.message;
            // Lấy thông tin lệnh từ interaction.message (chỉ áp dụng nếu bạn dùng cách lưu biến, ở đây mình lấy đại kênh log qua ID nếu có)
            
            // CÁCH TỐT NHẤT: Lưu ID kênh log vào đâu đó, hoặc đơn giản là tìm kênh có tên "log-khao-sat"
            const logChannel = interaction.guild.channels.cache.find(channel => channel.name === 'log-khao-sat');

            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#FEE75C') // Màu vàng
                    .setTitle('📢 CÓ NGƯỜI VỪA BÌNH CHỌN ĐỔI PHÁI')
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .addFields(
                        { name: '👤 Người chơi:', value: `<@${interaction.user.id}> (${interaction.user.username})`, inline: true },
                        { name: '🔄 Phái muốn chuyển sang:', value: `**${phaiInfo.name}** <:${phaiInfo.name.replace(/\s/g, '')}:${phaiInfo.emoji}>`, inline: true }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            } else {
                console.log('Không tìm thấy kênh tên là "log-khao-sat" để gửi log.');
            }
        } catch (error) {
            console.error('Lỗi khi gửi log:', error);
        }
    }
});

client.login(process.env.TOKEN);
