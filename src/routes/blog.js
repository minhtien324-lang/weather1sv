const express = require('express');
const multer = require('multer');
const path = require('path');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Multer storage config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
            return cb(new Error('Chỉ hỗ trợ ảnh JPEG/PNG/WEBP'));
        }
        cb(null, true);
    }
});

// Helpers
const isAdmin = (req) => req.user && req.user.role === 'admin';

// List comments for a post (public)
router.get('/:id/comments', async (req, res) => {
    try {
        const postId = req.params.id;
        const [rows] = await pool.execute(
            `SELECT c.id, c.content, c.created_at, u.username AS author_username, u.full_name AS author_name
             FROM comments c JOIN users u ON u.id = c.author_id
             WHERE c.post_id = ?
             ORDER BY c.created_at ASC`,
            [postId]
        );
        res.json({ items: rows, total: rows.length });
    } catch (error) {
        console.error('Lấy bình luận lỗi:', error.message);
        res.status(500).json({ error: 'Không thể lấy bình luận' });
    }
});

// Add comment (auth required)
router.post('/:id/comments', authenticateToken, async (req, res) => {
    try {
        const postId = req.params.id;
        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Nội dung bình luận không được để trống' });
        }
        // Ensure post exists
        const [posts] = await pool.execute('SELECT id FROM posts WHERE id = ?', [postId]);
        if (posts.length === 0) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

        const [result] = await pool.execute(
            'INSERT INTO comments (post_id, author_id, content) VALUES (?, ?, ?)',
            [postId, req.user.id, content.trim()]
        );

        res.status(201).json({
            id: result.insertId,
            post_id: Number(postId),
            author_id: req.user.id,
            content: content.trim()
        });
    } catch (error) {
        console.error('Thêm bình luận lỗi:', error.message);
        res.status(500).json({ error: 'Không thể thêm bình luận' });
    }
});

// Update comment (author or admin)
router.put('/:id/comments/:commentId', authenticateToken, async (req, res) => {
    try {
        const { commentId } = req.params;
        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Nội dung bình luận không được để trống' });
        }

        const [rows] = await pool.execute('SELECT author_id FROM comments WHERE id = ?', [commentId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy bình luận' });
        const comment = rows[0];

        if (!isAdmin(req) && comment.author_id !== req.user.id) {
            return res.status(403).json({ error: 'Bạn không có quyền sửa bình luận này' });
        }

        await pool.execute(
            'UPDATE comments SET content = ? WHERE id = ?',
            [content.trim(), commentId]
        );

        res.json({ message: 'Cập nhật bình luận thành công' });
    } catch (error) {
        console.error('Cập nhật bình luận lỗi:', error.message);
        res.status(500).json({ error: 'Không thể cập nhật bình luận' });
    }
});

// Delete comment (author or admin)
router.delete('/:id/comments/:commentId', authenticateToken, async (req, res) => {
    try {
        const { commentId } = req.params;

        const [rows] = await pool.execute('SELECT author_id FROM comments WHERE id = ?', [commentId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy bình luận' });
        const comment = rows[0];

        if (!isAdmin(req) && comment.author_id !== req.user.id) {
            return res.status(403).json({ error: 'Bạn không có quyền xóa bình luận này' });
        }

        await pool.execute('DELETE FROM comments WHERE id = ?', [commentId]);
        res.json({ message: 'Đã xóa bình luận' });
    } catch (error) {
        console.error('Xóa bình luận lỗi:', error.message);
        res.status(500).json({ error: 'Không thể xóa bình luận' });
    }
});

// Create post
router.post('/', authenticateToken, upload.single('cover_image'), async (req, res) => {
    try {
        const { title, content, status } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: 'Thiếu tiêu đề hoặc nội dung' });
        }

        const coverImage = req.file ? `/uploads/${req.file.filename}` : null;
        const [result] = await pool.execute(
            'INSERT INTO posts (author_id, title, content, cover_image, status) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, title, content, coverImage, status || 'published']
        );

        res.status(201).json({
            id: result.insertId,
            author_id: req.user.id,
            title,
            content,
            cover_image: coverImage,
            status: status || 'published'
        });
    } catch (error) {
        console.error('Tạo bài viết lỗi:', error.message);
        res.status(500).json({ error: 'Không thể tạo bài viết' });
    }
});

// List posts (public: only published)
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        const [rows] = await pool.execute(
            `SELECT 
                p.id,
                p.title,
                SUBSTRING(p.content, 1, 300) AS excerpt,
                p.cover_image,
                p.status,
                p.created_at,
                u.username AS author_username,
                u.full_name AS author_name,
                (
                    SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id
                ) AS comment_count
             FROM posts p
             JOIN users u ON u.id = p.author_id
             WHERE p.status = 'published'
             ORDER BY p.created_at DESC
             LIMIT ? OFFSET ?`,
            [Number(limit), offset]
        );

        const [countRows] = await pool.execute(
            `SELECT COUNT(*) AS total FROM posts WHERE status = 'published'`
        );

        res.json({ items: rows, total: countRows[0].total, page: Number(page), limit: Number(limit) });
    } catch (error) {
        console.error('Lấy danh sách bài viết lỗi:', error.message);
        res.status(500).json({ error: 'Không thể lấy danh sách bài viết' });
    }
});

// Admin list (all statuses)
router.get('/admin', authenticateToken, async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Chỉ admin được phép' });

        const [rows] = await pool.execute(
            `SELECT 
                p.*,
                u.username AS author_username,
                u.full_name AS author_name,
                (
                    SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id
                ) AS comment_count
             FROM posts p JOIN users u ON u.id = p.author_id
             ORDER BY p.created_at DESC`
        );
        res.json({ items: rows, total: rows.length });
    } catch (error) {
        console.error('Lấy danh sách (admin) lỗi:', error.message);
        res.status(500).json({ error: 'Không thể lấy danh sách bài viết' });
    }
});

// Get post detail
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT p.*, u.username AS author_username, u.full_name AS author_name
             FROM posts p JOIN users u ON u.id = p.author_id
             WHERE p.id = ? AND p.status = 'published'`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        res.json(rows[0]);
    } catch (error) {
        console.error('Lấy chi tiết bài viết lỗi:', error.message);
        res.status(500).json({ error: 'Không thể lấy bài viết' });
    }
});

// Update post (author or admin)
router.put('/:id', authenticateToken, upload.single('cover_image'), async (req, res) => {
    try {
        const postId = req.params.id;
        const { title, content, status } = req.body;

        // Cần lấy đầy đủ các cột để dùng giá trị cũ khi field không được gửi lên
        const [rows] = await pool.execute(
            'SELECT author_id, title, content, status, cover_image FROM posts WHERE id = ?',
            [postId]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        const post = rows[0];

        if (!isAdmin(req) && post.author_id !== req.user.id) {
            return res.status(403).json({ error: 'Bạn không có quyền sửa bài này' });
        }

        let coverImage = post.cover_image;
        if (req.file) {
            coverImage = `/uploads/${req.file.filename}`;
        }

        await pool.execute(
            'UPDATE posts SET title = ?, content = ?, cover_image = ?, status = ? WHERE id = ?',
            [title || post.title, content || post.content, coverImage, status || post.status, postId]
        );

        res.json({ message: 'Cập nhật thành công' });
    } catch (error) {
        console.error('Cập nhật bài viết lỗi:', error.message);
        res.status(500).json({ error: 'Không thể cập nhật bài viết' });
    }
});

// Delete post (author or admin)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const postId = req.params.id;
        const [rows] = await pool.execute('SELECT author_id FROM posts WHERE id = ?', [postId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        const post = rows[0];

        if (!isAdmin(req) && post.author_id !== req.user.id) {
            return res.status(403).json({ error: 'Bạn không có quyền xóa bài này' });
        }

        await pool.execute('DELETE FROM posts WHERE id = ?', [postId]);
        res.json({ message: 'Đã xóa bài viết' });
    } catch (error) {
        console.error('Xóa bài viết lỗi:', error.message);
        res.status(500).json({ error: 'Không thể xóa bài viết' });
    }
});

module.exports = router;



