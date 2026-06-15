import express from "express";
import sharp from "sharp";
import axios from "axios";
import path from "node:path";

const router = express.Router();

router.get("/matrix/resizeOld", async (req, res) => {
    const imageUrl = req.query.url;

    if (!imageUrl) {
        return res.status(400).json({ error: "URL query parameter is required" });
    }

    try {
        // 1. Orijinal resmi internetten indir
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const inputBuffer = Buffer.from(response.data);

        // 2. Sharp ile 64x64 yap ve renk paletini optimize et
        // PNG formatı hem sıkıştırma hem de kalite açısından iyidir
        const outputBuffer = await sharp(inputBuffer)
            .resize(64, 64, { fit: 'cover' })
            .removeAlpha()
            .modulate({
                brightness: 1.0,
                saturation: 1.2 // Renkleri biraz canlandırır
            })
            .png({
                palette: true,
                colors: 256, // 256 renkli palete zorla
                dither: 1.0  // En önemli kısım burası!
            })
            .toBuffer();

        // 3. Yanıtı gönder
        res.set('Content-Type', 'image/png');
        res.send(outputBuffer);

    } catch (error) {
        console.error("Matrix resize error:", error.message);
        res.status(500).json({ error: "Failed to process image" });
    }
});

import express from "express";
import sharp from "sharp";
import axios from "axios";

const router = express.Router();

router.get("/matrix/resize", async (req, res) => {
    const imageUrl = req.query.url;

    if (!imageUrl) {
        return res.status(400).json({ error: "URL query parameter is required" });
    }

    try {
        // 1. Orijinal resmi internetten indir
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const inputBuffer = Buffer.from(response.data);

        // 2. Sharp ile Matris Donanımına Özel Gelişmiş Filtreleme
        const outputBuffer = await sharp(inputBuffer)
            // Küçültürken detayların kaybolmaması için en keskin interpolasyon algoritmasını (lanczos3) kullanıyoruz
            .resize(64, 64, { 
                fit: 'cover',
                kernel: sharp.kernel.lanczos3 
            })
            // Saydamlık katmanını kaldır (arkaya siyah fon koyarak)
            .removeAlpha()
            // LED'lerde patlayan renkler için doygunluğu artır ve matrisin siyah dengesi için lineer kontrast ekle
            .modulate({
                brightness: 1.05,  // Solukluğu önlemek için çok hafif parlaklık artışı
                saturation: 1.6,   // Renkleri LED'lerde canlandırmak için doygunluğu %60 artırdık
            })
            // Keskinliği artırma (Unsharp Mask): Kontrast sınırlarını belirginleştirir, yazıları/logoları keskinleştirir
            .sharpen({
                sigma: 1.5,
                flat: 2.0,
                jagged: 2.5
            })
            // Donanımsal renk paleti optimizasyonu (En kritik kısım)
            .png({
                palette: true,
                colors: 64,       // 256 yerine 64 renk: CircuitPython / Adafruit_imageload'un paleti daha az renk ile daha kararlı işler
                dither: 0.0       // DITHER'I KAPATTIK: Noktalama/gürültü bitti, pikseller net renk blokları haline geldi
            })
            .toBuffer();

        // 3. Yanıtı gönder
        res.set('Content-Type', 'image/png');
        res.send(outputBuffer);

    } catch (error) {
        console.error("Matrix resize error:", error.message);
        res.status(500).json({ error: "Failed to process image" });
    }
});

export default router;

export default router;