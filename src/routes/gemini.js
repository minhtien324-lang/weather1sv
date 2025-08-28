const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Khởi tạo Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Middleware để validate request
const validateChatRequest = [
    body('message').isString().notEmpty().withMessage('Tin nhắn không được để trống'),
    body('context').optional().isObject().withMessage('Context phải là object'),
    body('weatherData').optional().isObject().withMessage('Weather data phải là object'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Dữ liệu không hợp lệ', 
                details: errors.array() 
            });
        }
        next();
    }
];

// Endpoint để chat với Gemini
router.post('/chat', validateChatRequest, async (req, res) => {
    try {
        const { message, context = {}, weatherData = null } = req.body;

        // Tạo prompt context cho Gemini
        let systemPrompt = `Bạn là một trợ lý thời tiết thông minh và thân thiện. Bạn có thể:

1. Trả lời các câu hỏi về thời tiết bằng tiếng Việt
2. Giải thích các thuật ngữ thời tiết một cách dễ hiểu
3. Đưa ra lời khuyên về trang phục và hoạt động dựa trên thời tiết
4. Cảnh báo về thời tiết xấu
5. Trả lời các câu hỏi chung về khí tượng học

Hãy trả lời ngắn gọn, hữu ích và thân thiện. Nếu có dữ liệu thời tiết cụ thể, hãy sử dụng để đưa ra lời khuyên chính xác.`;

        // Thêm context nếu có
        if (weatherData) {
            systemPrompt += `\n\nDữ liệu thời tiết hiện tại:
- Nhiệt độ: ${weatherData.temp}°C
- Mô tả: ${weatherData.description}
- Độ ẩm: ${weatherData.humidity}%
- Tốc độ gió: ${weatherData.windSpeed} km/h
- Áp suất: ${weatherData.pressure} hPa`;
        }

        // Thêm context từ conversation
        if (context.conversationHistory && context.conversationHistory.length > 0) {
            systemPrompt += `\n\nLịch sử trò chuyện gần đây:`;
            context.conversationHistory.slice(-5).forEach((msg, index) => {
                systemPrompt += `\n${msg.sender === 'user' ? 'Người dùng' : 'Bạn'}: ${msg.text}`;
            });
        }

        // Khởi tạo model
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Tạo chat session
        const chat = model.startChat({
            generationConfig: {
                maxOutputTokens: 500,
                temperature: 0.7,
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        });

        // Gửi tin nhắn đầu tiên với system prompt
        await chat.sendMessage(systemPrompt);

        // Gửi tin nhắn của user
        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();

        res.json({
            success: true,
            message: text,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Lỗi Gemini API:', error);
        
        if (error.message.includes('API_KEY')) {
            return res.status(500).json({
                error: 'Lỗi cấu hình API key Gemini'
            });
        }
        
        if (error.message.includes('quota')) {
            return res.status(429).json({
                error: 'Đã vượt quá giới hạn API, vui lòng thử lại sau'
            });
        }

        res.status(500).json({
            error: 'Có lỗi xảy ra khi xử lý tin nhắn'
        });
    }
});

// Endpoint để lấy thông tin về Gemini
router.get('/info', (req, res) => {
    res.json({
        model: 'gemini-1.5-flash',
        capabilities: [
            'Trả lời câu hỏi về thời tiết',
            'Giải thích thuật ngữ khí tượng',
            'Đưa ra lời khuyên trang phục',
            'Cảnh báo thời tiết xấu',
            'Hỗ trợ tiếng Việt'
        ],
        maxTokens: 500,
        temperature: 0.7
    });
});

module.exports = router;
