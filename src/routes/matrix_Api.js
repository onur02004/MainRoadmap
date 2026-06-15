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


router.get("/matrix/resize", async (req, res) => {
    const imageUrl = req.query.url;

    if (!imageUrl) {
        return res.status(400).json({ error: "URL query parameter is required" });
    }

    try {
        // 1. Orijinal resmi internetten indir
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const inputBuffer = Buffer.from(response.data);

        // 2. LED Matris Donanımı İçin Agresif Kontrast ve Renk Kombinasyonu
        const outputBuffer = await sharp(inputBuffer)
            // Detayları korumak için Lanczos3 interpolasyonu ile küçültme
            .resize(64, 64, { 
                fit: 'cover',
                kernel: sharp.kernel.lanczos3 
            })
            // Saydamlık katmanını kaldır ve arkaya saf siyah (#000000) koy
            .removeAlpha()
            
            // --- AGRESİF RENK VE KONTRAST AYARLARI ---
            .modulate({
                brightness: 1.15,  // AM kapağındaki gibi soluk beyaz çizgileri parlatmak için %15 artış
                saturation: 2.2,   // Daft Punk'ın altın tonlarını canlandırmak için doygunluğu %120 artırdık!
            })
            
            // GAMA DÜZELTMESİ: Koyu renk pikselleri saf siyaha çeker, orta tonları belirginleştirir.
            // AM kapağındaki o çamurlu lacivert arka planı tamamen kapatıp çizgileri öne fırlatır.
            .gamma(2.2) 
            
            // DOĞRUSAL KONTRAST (Linear Contrast): Siyahları daha siyah, beyazları daha parlak yapar.
            // (a * piksel + b) -> Kontrastı artırırken parlaklık tabanını dengeler.
            .linear(1.3, -0.15) 
            
            // KESKİNLEŞTİRME (Unsharp Mask): İnce çizgileri ve Daft Punk yazısını matris piksellerine oturtur.
            .sharpen({
                sigma: 1.8,
                flat: 3.0,
                jagged: 3.5
            })
            
            // DONANIMSAL RENK PALETİ
            .png({
                palette: true,
                colors: 48,       // Renk sayısını 48'e düşürdük: Matrisin renk karmaşasını azaltıp saf renkleri basmasını sağlar
                dither: 0.0       // Dither kesinlikle kapalı (Noktalanma ve gürültü sıfırlandı)
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