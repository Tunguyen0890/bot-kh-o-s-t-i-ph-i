// Giả lập database lưu trữ
const db = {
    // Cấu hình thời gian vote
    config: {
        startTime: dayjs().subtract(1, 'day').toISOString(), // Mặc định mở từ hôm qua
        endTime: dayjs().add(7, 'day').toISOString(),        // Đóng sau 7 ngày
    },
    // Lưu danh sách phiếu bầu: Key là User ID, Value là data
    votes: new Map() 
};
