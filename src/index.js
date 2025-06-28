require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const OPENWEATHER_API_URL = 'https://api.openweathermap.org/data/2.5';

app.use(cors());
app.use(express.json());
