// src/widgets/BaseWidget.js
export default class BaseWidget {
    constructor(key, name) {
        this.key = key;   // Veritabanındaki widget_key (örn: 'simple_clock')
        this.name = name; // UI'da görünecek isim
    }

    /**
     * @param {Object} config - DB'den gelen JSONB kullanıcı ayarları
     * @param {Object} sharedData - Spotify durumu, vb. genel veriler
     * @returns {String} ESP32'nin okuyacağı DÜZ METİN komutu
     */
    async renderToESP32(config, sharedData) {
        return "TXT|#FFFFFF|Def Test Widget";
    }
}