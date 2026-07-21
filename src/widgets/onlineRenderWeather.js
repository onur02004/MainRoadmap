// src/widgets/onlineRenderWeather.js
const { getWeatherData } = require('../services/weatherService'); 

module.exports = {
    id: 'weather',
    supportedDrivers: ['network', 'local'], // Backend'de de validasyon yapabilirsin
    
    // Matrix API route'undan çağırılacak ana fonksiyon
    async render(config) {
        const { location, unit, animatedIcons } = config;
        
        // 1. Veriyi çek
        const data = await getWeatherData(location, unit);
        
        // 2. Python/C++ Network driver'ına gönderilecek formatı hazırla
        const payload = {
            type: 'weather_render',
            temp: data.temp,
            icon: animatedIcons ? data.gif_path : data.static_icon,
            city: location
        };

        return payload;
    }
}