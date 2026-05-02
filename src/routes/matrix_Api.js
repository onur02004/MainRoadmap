import express from "express";
import sharp from "sharp";
import axios from "axios";
import path from "node:path";

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

        // 2. Sharp ile 64x64 yap ve renk paletini optimize et
        // PNG formatı hem sıkıştırma hem de kalite açısından iyidir
        const outputBuffer = await sharp(inputBuffer)
            .resize(64, 64, {
                fit: 'cover',
                kernel: sharp.kernel.nearest // Yumuşatmak yerine pikselleri keskin tutar
            })
            .removeAlpha()
            .modulate({
                brightness: 1.1,   // Biraz parlaklık
                saturation: 1.5,   // Renkleri iyice patlat (LED'lerde soluk renk ölür)
            })
            .linear(1.5, -0.2)     // Manuel Kontrast: (slope, intercept) -> Renkleri birbirinden ayırır
            .sharpen({
                sigma: 1.5,        // Kenarları belirginleştirir
                m1: 2,
                m2: 5
            })
            .png({ palette: true, colors: 64 }) // Renk sayısını azaltmak bazen daha temiz görüntü verir
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