// src/widgets/ClockWidget.js
import BaseWidget from "./BaseWidget.js";

export default class ClockWidget extends BaseWidget {
    constructor() {
        super('simple_clock', 'Modern Matrix Saat');
    }

    async renderToESP32(config, sharedData) {
        // Kullanıcının ayarları (Yoksa varsayılanları kullan)
        const textColor = config.textColor || "#00FFFF"; // Turkuaz varsayılan
        const bgColor = config.bgColor || "#000000";     // Siyah arka plan
        const showSeconds = config.showSeconds !== undefined ? config.showSeconds : true;
        
        // Saati Node.js üzerinde hesaplıyoruz. ESP32 saat hesaplamaz!
        const now = new Date();
        const tz = 'Europe/Berlin'; // Kullanıcı profiline göre DB'den de gelebilir
        const timeOptions = { 
            timeZone: tz, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: showSeconds ? '2-digit' : undefined,
            hour12: false
        };
        const timeStr = now.toLocaleTimeString('tr-TR', timeOptions);

        // Protokol formatı: WIDGET_TIPI | YAZI_RENGI | ARKA_PLAN | METIN
        return `CLOCK|${textColor}|${bgColor}|${timeStr}`;
    }
}