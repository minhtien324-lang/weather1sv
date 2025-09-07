require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { testConnection } = require('./config/database');
const authRoutes = require('./routes/auth');
const geminiRoutes = require('./routes/gemini');
const blogRoutes = require('./routes/blog');
const { optionalAuth } = require('./middleware/auth');

const app = express();
const port = process.env.PORT || 3000;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const OPENWEATHER_API_URL = 'https://api.openweathermap.org/data/2.5';

// Kiểm tra API key
if (!WEATHER_API_KEY) {
    console.error('❌ WEATHER_API_KEY không được cấu hình trong file .env');
    console.error('💡 Vui lòng thêm WEATHER_API_KEY vào file .env');
    process.exit(1);
}

app.use(cors());
app.use(express.json());

// Static serve for uploads
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Test kết nối database khi khởi động
testConnection();

// Auth routes
app.use('/api/auth', authRoutes);

// Gemini AI routes
app.use('/api/gemini', geminiRoutes);

// Blog routes
app.use('/api/blog', blogRoutes);

// API endpoint để lấy thời tiết theo tọa độ
app.get('/api/weather/coordinates', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        
        if (!lat || !lon) {
            return res.status(400).json({ 
                error: 'Thiếu thông tin tọa độ (lat, lon)' 
            });
        }

        // Validate tọa độ
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);
        
        if (isNaN(latNum) || isNaN(lonNum)) {
            return res.status(400).json({ 
                error: 'Tọa độ không hợp lệ' 
            });
        }

        if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
            return res.status(400).json({ 
                error: 'Tọa độ nằm ngoài phạm vi hợp lệ' 
            });
        }

        const response = await axios.get(`${OPENWEATHER_API_URL}/weather`, {
            params: {
                lat: latNum,
                lon: lonNum,
                appid: WEATHER_API_KEY,
                units: 'metric',
                lang: 'vi'
            },
            timeout: 10000 // 10 giây timeout
        });

        res.json(response.data);
    } catch (error) {
        console.error('Lỗi khi lấy thời tiết theo tọa độ:', error.message);
        
        if (error.response) {
            // Lỗi từ OpenWeather API
            if (error.response.status === 401) {
                return res.status(500).json({ 
                    error: 'API key không hợp lệ' 
                });
            }
            if (error.response.status === 429) {
                return res.status(429).json({ 
                    error: 'Quá nhiều yêu cầu, vui lòng thử lại sau' 
                });
            }
        }
        
        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({ 
                error: 'Yêu cầu hết thời gian chờ' 
            });
        }
        
        res.status(500).json({ 
            error: 'Không thể lấy thông tin thời tiết' 
        });
    }
});

// API endpoint để lấy thời tiết theo tên thành phố
app.get('/api/weather/city', async (req, res) => {
    try {
        const { city } = req.query;
        
        if (!city) {
            return res.status(400).json({ 
                error: 'Thiếu tên thành phố' 
            });
        }

        // Validate tên thành phố
        if (typeof city !== 'string' || city.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Tên thành phố không hợp lệ' 
            });
        }

        const response = await axios.get(`${OPENWEATHER_API_URL}/weather`, {
            params: {
                q: city.trim(),
                appid: WEATHER_API_KEY,
                units: 'metric',
                lang: 'vi'
            },
            timeout: 10000
        });

        res.json(response.data);
    } catch (error) {
        console.error('Lỗi khi lấy thời tiết theo thành phố:', error.message);
        
        if (error.response) {
            if (error.response.status === 404) {
                return res.status(404).json({ 
                    error: 'Không tìm thấy thành phố' 
                });
            }
            if (error.response.status === 401) {
                return res.status(500).json({ 
                    error: 'API key không hợp lệ' 
                });
            }
            if (error.response.status === 429) {
                return res.status(429).json({ 
                    error: 'Quá nhiều yêu cầu, vui lòng thử lại sau' 
                });
            }
        }
        
        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({ 
                error: 'Yêu cầu hết thời gian chờ' 
            });
        }
        
        res.status(500).json({ 
            error: 'Không thể lấy thông tin thời tiết' 
        });
    }
});

// API endpoint để lấy dự báo thời tiết 5 ngày
app.get('/api/forecast', async (req, res) => {
    try {
        const { lat, lon, city } = req.query;
        
        let params = {
            appid: WEATHER_API_KEY,
            units: 'metric',
            lang: 'vi'
        };

        if (lat && lon) {
            // Validate tọa độ
            const latNum = parseFloat(lat);
            const lonNum = parseFloat(lon);
            
            if (isNaN(latNum) || isNaN(lonNum)) {
                return res.status(400).json({ 
                    error: 'Tọa độ không hợp lệ' 
                });
            }

            if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
                return res.status(400).json({ 
                    error: 'Tọa độ nằm ngoài phạm vi hợp lệ' 
                });
            }

            params.lat = latNum;
            params.lon = lonNum;
        } else if (city) {
            // Validate tên thành phố
            if (typeof city !== 'string' || city.trim().length === 0) {
                return res.status(400).json({ 
                    error: 'Tên thành phố không hợp lệ' 
                });
            }
            params.q = city.trim();
        } else {
            return res.status(400).json({ 
                error: 'Cần cung cấp tọa độ (lat, lon) hoặc tên thành phố' 
            });
        }

        const response = await axios.get(`${OPENWEATHER_API_URL}/forecast`, {
            params,
            timeout: 10000
        });

        res.json(response.data);
    } catch (error) {
        console.error('Lỗi khi lấy dự báo thời tiết:', error.message);
        
        if (error.response) {
            if (error.response.status === 404) {
                return res.status(404).json({ 
                    error: 'Không tìm thấy địa điểm' 
                });
            }
            if (error.response.status === 401) {
                return res.status(500).json({ 
                    error: 'API key không hợp lệ' 
                });
            }
            if (error.response.status === 429) {
                return res.status(429).json({ 
                    error: 'Quá nhiều yêu cầu, vui lòng thử lại sau' 
                });
            }
        }
        
        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({ 
                error: 'Yêu cầu hết thời gian chờ' 
            });
        }
        
        res.status(500).json({ 
            error: 'Không thể lấy dự báo thời tiết' 
        });
    }
});

// API endpoint để tìm kiếm thành phố
app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({ 
                error: 'Thiếu từ khóa tìm kiếm' 
            });
        }

        // Validate từ khóa tìm kiếm
        if (typeof q !== 'string' || q.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Từ khóa tìm kiếm không hợp lệ' 
            });
        }

        const response = await axios.get('http://api.openweathermap.org/geo/1.0/direct', {
            params: {
                q: q.trim(),
                limit: 5,
                appid: WEATHER_API_KEY
            },
            timeout: 10000
        });

        res.json(response.data);
    } catch (error) {
        console.error('Lỗi khi tìm kiếm thành phố:', error.message);
        
        if (error.response) {
            if (error.response.status === 401) {
                return res.status(500).json({ 
                    error: 'API key không hợp lệ' 
                });
            }
            if (error.response.status === 429) {
                return res.status(429).json({ 
                    error: 'Quá nhiều yêu cầu, vui lòng thử lại sau' 
                });
            }
        }
        
        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({ 
                error: 'Yêu cầu hết thời gian chờ' 
            });
        }
        
        res.status(500).json({ 
            error: 'Không thể tìm kiếm thành phố' 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Weather API đang hoạt động',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Lỗi server:', err.stack);
    res.status(500).json({ 
        error: 'Có lỗi xảy ra trên server' 
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'API endpoint không tồn tại' 
    });
});

app.listen(port, () => {
    console.log(`Server đang chạy tại http://localhost:${port}`);
    console.log(`API Health check: http://localhost:${port}/api/health`);
});
