const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'weather_app',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
};

// Tạo connection pool
const pool = mysql.createPool(dbConfig);

// Test kết nối với retry logic
const testConnection = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const connection = await pool.getConnection();
            console.log('✅ Kết nối database thành công!');
            connection.release();
            return true;
        } catch (error) {
            console.error(`❌ Lỗi kết nối database (lần thử ${i + 1}/${retries}):`, error.message);
            
            if (i === retries - 1) {
                console.error('❌ Không thể kết nối database sau nhiều lần thử. Vui lòng kiểm tra cấu hình.');
                console.error('💡 Đảm bảo MySQL đang chạy và thông tin kết nối trong .env file là chính xác.');
                process.exit(1);
            }
            
            // Chờ 2 giây trước khi thử lại
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
};

module.exports = {
    pool,
    testConnection
};
