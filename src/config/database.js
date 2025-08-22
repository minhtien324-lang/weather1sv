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
    queueLimit: 0
};

// Tạo connection pool
const pool = mysql.createPool(dbConfig);

// Test kết nối
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Kết nối database thành công!');
        connection.release();
    } catch (error) {
        console.error('❌ Lỗi kết nối database:', error.message);
        process.exit(1);
    }
};

module.exports = {
    pool,
    testConnection
};
