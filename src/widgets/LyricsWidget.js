// src/widgets/LyricsWidget.js
import BaseWidget from "./BaseWidget.js";

export default class LyricsWidget extends BaseWidget {
    constructor() {
        super('live_lyrics', 'Canlı Şarkı Sözleri');
    }

    async renderToESP32(config, sharedData) {
        // 1. Kullanıcının web arayüzünden seçtiği (DB'den gelen) ayarlar
        // Eğer ayar yoksa estetik varsayılanlar kullanıyoruz
        const themeColor = config.themeColor || "#1DB954"; // Spotify Yeşili
        const alignment = config.alignment || "CENTER";    // Seçenekler: LEFT, CENTER, RIGHT
        const fontSize = config.fontSize || "NORMAL";      // Seçenekler: SMALL, NORMAL, LARGE

        // 2. Arka planda Spotify API'den toplanan canlı veriler
        const currentLyric = sharedData.current_lyric || "Sözler bekleniyor...";
        const trackName = sharedData.track_name || "-";

        // 3. Mantıksal Kontroller
        // Eğer hiçbir şey çalmıyorsa ESP32'ye boşuna sözleri çizdirmeye çalışmayalım
        if (trackName === "-" || trackName === "Paused") {
            return `TXT|#444444|Müzik Bekleniyor`; 
        }

        // 4. ESP32'ye Gidecek Nihai Komut
        // Protokol Formatı: WIDGET_TIPI | TEMA_RENGI | HIZALAMA | YAZI_BOYUTU | ŞARKI_SÖZÜ
        return `LYRICS|${themeColor}|${alignment}|${fontSize}|${currentLyric}`;
    }
}