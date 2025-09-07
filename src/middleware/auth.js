const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware xác thực token
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ 
            error: 'Token không được cung cấp' 
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Kiểm tra user có tồn tại trong database không
        const [users] = await pool.execute(
            'SELECT id, username, email, full_name, role, is_active FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({ 
                error: 'Token không hợp lệ' 
            });
        }

        if (!users[0].is_active) {
            return res.status(401).json({ 
                error: 'Tài khoản đã bị khóa' 
            });
        }

        req.user = users[0];
        next();
    } catch (error) {
        console.error('Lỗi xác thực token:', error.message);
        return res.status(403).json({ 
            error: 'Token không hợp lệ' 
        });
    }
};

// Middleware tùy chọn - không bắt buộc xác thực
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const [users] = await pool.execute(
            'SELECT id, username, email, full_name, role FROM users WHERE id = ? AND is_active = 1',
            [decoded.userId]
        );

        if (users.length > 0) {
            req.user = users[0];
        }
        next();
    } catch (error) {
        req.user = null;
        next();
    }
};

module.exports = {
    authenticateToken,
    optionalAuth,
    JWT_SECRET
};
