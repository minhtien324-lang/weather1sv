const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { 
    registerValidation, 
    loginValidation, 
    changePasswordValidation,
    handleValidationErrors 
} = require('../middleware/validation');

const router = express.Router();

// Đăng ký tài khoản
router.post('/register', registerValidation, handleValidationErrors, async (req, res) => {
    try {
        const { username, email, password, full_name } = req.body;

        // Kiểm tra username đã tồn tại chưa
        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUsers.length > 0) {
            // Kiểm tra cụ thể username hay email đã tồn tại
            const [existingUsername] = await pool.execute(
                'SELECT id FROM users WHERE username = ?',
                [username]
            );
            
            const [existingEmail] = await pool.execute(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );

            if (existingUsername.length > 0) {
                return res.status(400).json({
                    error: 'Tên đăng nhập đã tồn tại'
                });
            }

            if (existingEmail.length > 0) {
                return res.status(400).json({
                    error: 'Email đã tồn tại'
                });
            }
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Tạo user mới
        const [result] = await pool.execute(
            'INSERT INTO users (username, email, password_hash, full_name) VALUES (?, ?, ?, ?)',
            [username, email, passwordHash, full_name || null]
        );

        // Tạo JWT token
        const token = jwt.sign(
            { userId: result.insertId, username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Đăng ký thành công',
            user: {
                id: result.insertId,
                username,
                email,
                full_name: full_name || null
            },
            token
        });

    } catch (error) {
        console.error('Lỗi đăng ký:', error.message);
        res.status(500).json({
            error: 'Có lỗi xảy ra khi đăng ký'
        });
    }
});

// Đăng nhập
router.post('/login', loginValidation, handleValidationErrors, async (req, res) => {
    try {
        const { username, password } = req.body;

        // Tìm user theo username hoặc email
        const [users] = await pool.execute(
            'SELECT id, username, email, password_hash, full_name, is_active FROM users WHERE username = ? OR email = ?',
            [username, username]
        );

        if (users.length === 0) {
            return res.status(401).json({
                error: 'Tên đăng nhập hoặc mật khẩu không đúng'
            });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(401).json({
                error: 'Tài khoản đã bị khóa'
            });
        }

        // Kiểm tra password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Tên đăng nhập hoặc mật khẩu không đúng'
            });
        }

        // Cập nhật last_login
        await pool.execute(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id]
        );

        // Tạo JWT token
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Đăng nhập thành công',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                full_name: user.full_name
            },
            token
        });

    } catch (error) {
        console.error('Lỗi đăng nhập:', error.message);
        res.status(500).json({
            error: 'Có lỗi xảy ra khi đăng nhập'
        });
    }
});

// Lấy thông tin user hiện tại
router.get('/me', authenticateToken, async (req, res) => {
    try {
        res.json({
            user: {
                id: req.user.id,
                username: req.user.username,
                email: req.user.email,
                full_name: req.user.full_name
            }
        });
    } catch (error) {
        console.error('Lỗi lấy thông tin user:', error.message);
        res.status(500).json({
            error: 'Có lỗi xảy ra khi lấy thông tin user'
        });
    }
});

// Đổi mật khẩu
router.put('/change-password', authenticateToken, changePasswordValidation, handleValidationErrors, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Lấy thông tin user hiện tại
        const [users] = await pool.execute(
            'SELECT password_hash FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                error: 'Không tìm thấy user'
            });
        }

        // Kiểm tra mật khẩu hiện tại
        const isValidPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
        if (!isValidPassword) {
            return res.status(400).json({
                error: 'Mật khẩu hiện tại không đúng'
            });
        }

        // Hash mật khẩu mới
        const saltRounds = 12;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        // Cập nhật mật khẩu
        await pool.execute(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [newPasswordHash, req.user.id]
        );

        res.json({
            message: 'Đổi mật khẩu thành công'
        });

    } catch (error) {
        console.error('Lỗi đổi mật khẩu:', error.message);
        res.status(500).json({
            error: 'Có lỗi xảy ra khi đổi mật khẩu'
        });
    }
});

// Cập nhật thông tin profile
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { full_name, email } = req.body;

        // Kiểm tra email đã tồn tại chưa (nếu thay đổi email)
        if (email && email !== req.user.email) {
            const [existingUsers] = await pool.execute(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, req.user.id]
            );

            if (existingUsers.length > 0) {
                return res.status(400).json({
                    error: 'Email đã được sử dụng bởi tài khoản khác'
                });
            }
        }

        // Cập nhật thông tin
        await pool.execute(
            'UPDATE users SET full_name = ?, email = ? WHERE id = ?',
            [full_name || req.user.full_name, email || req.user.email, req.user.id]
        );

        res.json({
            message: 'Cập nhật thông tin thành công',
            user: {
                id: req.user.id,
                username: req.user.username,
                email: email || req.user.email,
                full_name: full_name || req.user.full_name
            }
        });

    } catch (error) {
        console.error('Lỗi cập nhật profile:', error.message);
        res.status(500).json({
            error: 'Có lỗi xảy ra khi cập nhật thông tin'
        });
    }
});

// Đăng xuất (tùy chọn - có thể xử lý ở frontend)
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        // Có thể thêm logic để blacklist token nếu cần
        res.json({
            message: 'Đăng xuất thành công'
        });
    } catch (error) {
        console.error('Lỗi đăng xuất:', error.message);
        res.status(500).json({
            error: 'Có lỗi xảy ra khi đăng xuất'
        });
    }
});

module.exports = router;
