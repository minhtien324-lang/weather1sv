const { body, validationResult } = require('express-validator');

// Validation cho đăng ký
const registerValidation = [
    body('username')
        .isLength({ min: 3, max: 50 })
        .withMessage('Tên đăng nhập phải từ 3-50 ký tự')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới'),
    
    body('email')
        .isEmail()
        .withMessage('Email không hợp lệ')
        .normalizeEmail(),
    
    body('password')
        .isLength({ min: 6 })
        .withMessage('Mật khẩu phải có ít nhất 6 ký tự')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số'),
    
    body('full_name')
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage('Họ tên phải từ 2-100 ký tự')
        .trim()
];

// Validation cho đăng nhập
const loginValidation = [
    body('username')
        .notEmpty()
        .withMessage('Tên đăng nhập không được để trống')
        .trim(),
    
    body('password')
        .notEmpty()
        .withMessage('Mật khẩu không được để trống')
];

// Validation cho đổi mật khẩu
const changePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Mật khẩu hiện tại không được để trống'),
    
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('Mật khẩu mới phải có ít nhất 6 ký tự')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Mật khẩu mới phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số')
];

// Middleware xử lý lỗi validation
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Dữ liệu không hợp lệ',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

module.exports = {
    registerValidation,
    loginValidation,
    changePasswordValidation,
    handleValidationErrors
};
