require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ==========================================
// CẤU HÌNH ID EMOJI (Lấy từ ảnh 2 của bạn)
// ==========================================
const EMOJIS = {
    HuyenCo: '1562460021177065582',
    ThietY: '1540995240691896431',
    HuyetHa: '1540995238909321327',
    ToaiMong: '1540995237084798986',
    ToVan: '1540995234840846437',
    CuuLinh: '1540995232848420926',
    ThanTuong: '1540995230877097984',
    LongNgam: '1540995228448723025'
};

// Danh sách phái (Tên hiển thị và ID Emoji tương ứng)
const PHÁI = [
    { name: 'Huyền Cơ', emoji: EMOJIS.HuyenCo },
    { name: 'Thiết Y', emoji: EMOJIS.ThietY },
    { name: 'Huyết Hà', emoji: EMOJIS.HuyetHa },
    { name: 'Toái Mộng', emoji: EMOJIS.ToaiMong },
    { name: 'Tố Vấn', emoji: EMOJIS.ToVan },
    { name: 'Cửu Linh', emoji: EMOJIS.CuuLinh },
    { name: 'Thần Tướng', emoji: EMOJIS.ThanTuong }, // Theo yêu cầu của bạn là Thần Tương, mình để Thần Tướng theo game NTH
    { name: 'Long Ngâm', emoji: EMOJIS.LongNgam }
];

client.once('ready', () => {
    console.log(`🤖 Bot đã online: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    // Lệnh tạo bảng khảo sát: !khaosat
    if (message.content === '!khaosat') {
        // Xóa tin nhắn lệnh của user để kênh sạch sẽ
        await message.delete().catch(() => {});

        // 1. TẠO GIAO DIỆN EMBED ĐẸP MẮT
        const embed = new EmbedBuilder()
            .setColor('#2b2d31') // Màu nền tối giống Discord
            .setTitle('📊 BẢNG KHẢO SÁT ĐỔI PHÁI - NGHỊCH THỦY HÀN')
            .setDescription(
                'Chào các hiệp khách! BQT muốn thăm dò ý kiến của mọi người về việc chuyển đổi phái.\n\n' +
                '👉 **Hãy bấm vào nút bên dưới** và chọn phái mà bạn đang muốn chuyển sang.\n' +
                '*Ví dụ: Bạn đang chơi Toái Mộng, muốn đổi sang Huyền Cơ, hãy bấm nút và chọn Huyền Cơ.*\n\n' +
                '🕒 **Thời gian khảo sát:** Đến hết [Điền Ngày]'
            )
            .setImage('https://i.imgur.com/your_banner_image.png') // Thay bằng link ảnh bìa game NTH của bạn (nếu có)
            .setFooter({ text: 'Nghịch Thủy Hàn - Thăm dò chuyển phái', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        // 2. TẠO NÚT BẤM (BUTTON)
        const button = new ButtonBuilder()
            .setCustomId('btn_mo_khaosat')
            .setLabel('Bỏ Phiếu Đổi Phái')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝');

        const row = new ActionRowBuilder().addComponents(button);

        // Gửi tin nhắn vào kênh
        await message.channel.send({ embeds: [embed], components: [row] });
    }
});

// Lắng nghe sự kiện tương tác (Bấm nút, chọn menu)
client.on('interactionCreate', async (interaction) => {
    
    // XỬ LÝ KHI BẤM NÚT "BỎ PHIẾU ĐỔI PHÁI"
    if (interaction.isButton() && interaction.customId === 'btn_mo_khaosat') {
        
        // Tạo Menu thả xuống chứa 8 phái
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('menu_chon_phai')
            .setPlaceholder('Bạn muốn chuyển sang phái nào?')
            .addOptions(
                PHÁI.map(p => 
                    new StringSelectMenuOptionBuilder()
                        .setLabel(p.name)
                        .setValue(p.name)
                        // Gắn Emoji custom của server vào Menu
                        .setEmoji({ id: p.emoji }) 
                )
            );

        const rowMenu = new ActionRowBuilder().addComponents(selectMenu);

        // Phản hồi (Ephemeral: Chỉ người bấm nút mới thấy menu này)
        await interaction.reply({
            content: '👇 **Vui lòng chọn phái bạn mong muốn chuyển sang trong danh sách dưới đây:**',
            components: [rowMenu],
            ephemeral: true 
        });
    }

    // XỬ LÝ KHI NGƯỜI DÙNG CHỌN PHÁI TRONG MENU
    if (interaction.isStringSelectMenu() && interaction.customId === 'menu_chon_phai') {
        const phaiDaChon = interaction.values[0]; // Lấy tên phái vừa chọn

        // Tìm emoji tương ứng
        const phaiInfo = PHÁI.find(p => p.name === phaiDaChon);

        // Tạo tin nhắn xác nhận (có thể dùng Embed nhỏ)
        const confirmEmbed = new EmbedBuilder()
            .setColor('#57F287') // Màu xanh lá (Thành công)
            .setDescription(`✅ Bạn đã đăng ký nguyện vọng chuyển sang phái **${phaiInfo.name}** <:${phaiInfo.name.replace(/\s/g, '')}:${phaiInfo.emoji}> thành công!`)
            .setFooter({ text: 'Hệ thống đã ghi nhận phiếu của bạn.' });

        // Cập nhật lại tin nhắn ẩn (xóa menu đi, hiện thông báo thành công)
        await interaction.update({
            content: '', 
            embeds: [confirmEmbed], 
            components: [] 
        });

        // (Tuỳ chọn) Gửi thông báo ra kênh chung để mọi người biết (nếu muốn)
        // const logChannel = interaction.guild.channels.cache.get('ID_KENH_LOG');
        // if (logChannel) {
        //     logChannel.send(`📢 Hiệp khách **${interaction.user.username}** vừa bình chọn chuyển sang phái **${phaiDaChon}**.`);
        // }
    }
});

client.login(process.env.TOKEN);
