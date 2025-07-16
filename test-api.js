const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function testAPI() {
    console.log('🧪 Testing Weather API...\n');

    try {
        // Test health check
        console.log('1. Testing Health Check...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Health Check:', healthResponse.data);
        console.log('');

        // Test weather by city
        console.log('2. Testing Weather by City...');
        const weatherResponse = await axios.get(`${BASE_URL}/weather/city?city=Hanoi`);
        console.log('✅ Weather Data:', {
            city: weatherResponse.data.name,
            temperature: `${weatherResponse.data.main.temp}°C`,
            description: weatherResponse.data.weather[0].description,
            humidity: `${weatherResponse.data.main.humidity}%`
        });
        console.log('');

        // Test city search
        console.log('3. Testing City Search...');
        const searchResponse = await axios.get(`${BASE_URL}/search?q=Hanoi`);
        console.log('✅ Search Results:', searchResponse.data.map(city => ({
            name: city.name,
            country: city.country,
            lat: city.lat,
            lon: city.lon
        })));
        console.log('');

        console.log('🎉 All tests passed!');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Make sure the server is running with: npm run dev');
        }
    }
}

// Chạy test nếu file được thực thi trực tiếp
if (require.main === module) {
    testAPI();
}

module.exports = { testAPI }; 