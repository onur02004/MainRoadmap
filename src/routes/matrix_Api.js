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

export default router;