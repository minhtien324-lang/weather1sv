require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { testConnection } = require('./config/database');
const authRoutes = require('./routes/auth');
const { optionalAuth } = require('./middleware/auth');

const app = express();
const port = process.env.PORT || 3000;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const OPENWEATHER_API_URL = 'https://api.openweathermap.org/data/2.5';

app.use(cors());
app.use(express.json());

// Test kết nối database khi khởi động
testConnection();

// Auth routes
app.use('/api/auth', authRoutes);

// API endpoint để lấy thời tiết theo tọa độ
app.get('/api/weather/coordinates', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        
        if (!lat || !lon) {
            return res.status(400).json({ 
                error: 'Thiếu thông tin tọa độ (lat, lon)' 
            });
        }

        const response = await axios.get(`${OPENWEATHER_API_URL}/weather`, {
            params: {
                lat,
                lon,
                appid: WEATHER_API_KEY,
                units: 'metric',
                lang: 'vi'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Lỗi khi lấy thời tiết theo tọa độ:', error.message);
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

        const response = await axios.get(`${OPENWEATHER_API_URL}/weather`, {
            params: {
                q: city,
                appid: WEATHER_API_KEY,
                units: 'metric',
                lang: 'vi'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Lỗi khi lấy thời tiết theo thành phố:', error.message);
        if (error.response && error.response.status === 404) {
            return res.status(404).json({ 
                error: 'Không tìm thấy thành phố' 
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
            params.lat = lat;
            params.lon = lon;
        } else if (city) {
            params.q = city;
        } else {
            return res.status(400).json({ 
                error: 'Cần cung cấp tọa độ (lat, lon) hoặc tên thành phố' 
            });
        }

        const response = await axios.get(`${OPENWEATHER_API_URL}/forecast`, {
            params
        });

        res.json(response.data);
    } catch (error) {
        console.error('Lỗi khi lấy dự báo thời tiết:', error.message);
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

        const response = await axios.get('http://api.openweathermap.org/geo/1.0/direct', {
            params: {
                q,
                limit: 5,
                appid: WEATHER_API_KEY
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Lỗi khi tìm kiếm thành phố:', error.message);
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
