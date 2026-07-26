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


router.get("/matrix/resizeold2", async (req, res) => {
    const imageUrl = req.query.url;
    const brightnessParam = req.query.brightness;

    if (!imageUrl) {
        return res.status(400).json({ error: "URL query parameter is required" });
    }

    try {
        // 1. URL'den gelen parlaklık değerini güvenli bir şekilde sayıya dönüştür
        // Eğer değer gönderilmediyse veya geçersizse varsayılan olarak 1.15 (Gündüz modu) kullan
        let finalBrightness = 1.15;
        if (brightnessParam) {
            const parsed = parseFloat(brightnessParam);
            if (!isNaN(parsed) && parsed >= 0.0 && parsed <= 2.0) {
                finalBrightness = parsed;
            }
        }

        // 2. Parlaklığa göre doğrusal kontrast (linear) çarpanını dinamik ayarla
        // Parlaklık düştükçe beyazların gözü alan patlamasını engellemek için kontrast çarpanını da yumuşatıyoruz
        let contrastMultiplier = 1.3;
        if (finalBrightness < 1.0) {
            contrastMultiplier = 1.05; // Gece modu için yumuşatılmış kontrast
        }

        // 3. Orijinal resmi internetten indir
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const inputBuffer = Buffer.from(response.data);

        // 4. Sharp ile Matris Donanımına Özel Gelişmiş Filtreleme Pipeline'ı
        const outputBuffer = await sharp(inputBuffer)
            .resize(64, 64, { 
                fit: 'cover',
                kernel: sharp.kernel.lanczos3 
            })
            .removeAlpha()
            
            // --- DİNAMİK RENK VE PARLAKLIK AYARLARI ---
            .modulate({
                brightness: finalBrightness, // URL'den gelen dinamik değer basılıyor (?brightness=0.65 gibi)
                saturation: finalBrightness < 1.0 ? 1.4 : 1.7, // Gece modunda sarıların çamurlaşmaması için dengeli doygunluk
            })
            
            // RENK MATRİSİ RECOMBİNATION
            // Altın sarısı tonlarının kırmızıya/turuncuya kaçmasını engelleyen yeşil takviye formülün
            .recomb([
                [ 1.0,  0.0,  0.0 ], 
                [ 0.05, 1.1,  0.0 ], 
                [ 0.0,  0.0,  1.0 ]  
            ])
            
            // GAMA DÜZELTMESİ (Arka planı simsiyah tutan kusursuz ayarın)
            .gamma(2.2) 
            
            // DOĞRUSAL KONTRAST (Derin siyah dengesini koruyan formülün)
            .linear(contrastMultiplier, -0.15) 
            
            // KESKİNLEŞTİRME (Çizgilerin ve Daft Punk yazısının okunabilirliği için)
            .sharpen({
                sigma: 1.8,
                flat: 3.0,
                jagged: 3.5
            })
            
            // DONANIMSAL RENK PALETİ
            .png({
                palette: true,
                colors: 48,       
                dither: 0.0       
            })
            .toBuffer();

        // 5. Yanıtı gönder
        res.set('Content-Type', 'image/png');
        res.send(outputBuffer);

    } catch (error) {
        console.error("Matrix dynamic resize error:", error.message);
        res.status(500).json({ error: "Failed to process image" });
    }
});

router.get("/matrix/resize", async (req, res) => {
    const imageUrl = req.query.url;
    const brightnessParam = req.query.brightness;

    if (!imageUrl) {
        return res.status(400).json({ error: "URL query parameter is required" });
    }

    try {
        // 1. Parlaklık parametresi kontrolü
        let finalBrightness = 1.15;
        if (brightnessParam) {
            const parsed = parseFloat(brightnessParam);
            if (!isNaN(parsed) && parsed >= 0.0 && parsed <= 2.0) {
                finalBrightness = parsed;
            }
        }

        // 2. Resmi indir
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const inputBuffer = Buffer.from(response.data);

        // 3. GELİŞMİŞ RENK VE DETAY ANALİZİ
        const stats = await sharp(inputBuffer).stats();
        
        // Genel parlaklık seviyesi (0 = Siyah, 255 = Beyaz)
        const averageLightness = (stats.channels[0].mean + stats.channels[1].mean + stats.channels[2].mean) / 3;
        
        // Renklilik / Canlılık düzeyi
        const chromaVibrancy = (stats.channels[0].stdev + stats.channels[1].stdev + stats.channels[2].stdev) / 3;
        
        // --- DİNAMİK PARAMETRE AYARLARI ---
        let gammaValue = 2.2;
        let contrastMultiplier = 1.2;
        let linearOffset = -0.12;
        let targetColors = 48;
        let ditherValue = 0.3; // Tamamen kapatmak yerine alt eşikte tutuyoruz
        let saturationValue = finalBrightness < 1.0 ? 1.3 : 1.5;
        let useRecomb = true;

        // SENARYO 1: AGRESİF RENKLİ RESİMLER (Tame Impala vb.)
        if (chromaVibrancy >= 58) {
            gammaValue = 1.4;         
            linearOffset = -0.02;     
            contrastMultiplier = finalBrightness < 1.0 ? 0.9 : 1.05; 
            targetColors = 64;        
            ditherValue = 1.0;        
            saturationValue = finalBrightness < 1.0 ? 1.1 : 1.25; 
            useRecomb = false;        
        } 
        // SENARYO 2: KOYU ARKA PLANLI VE BELİRGİN SİYAH ALANLARI OLAN RESİMLER (Umut Kaya, Agents of Fortune vb.)
        else if (averageLightness < 105) {
            // S-Curve mantığı: Gamayı çok yükseltmeden siyah offsetini kontrollü kırpıyoruz
            gammaValue = 2.0;         // Detaylar (yüz hatları) kaybolmasın diye yumuşak tuttuk
            linearOffset = -0.20;     // Gerçek siyahları tamamen söndürmek için eşiği aşağı çektik
            contrastMultiplier = 1.4; // Siyah ile ara tonların (yüzün) arasını açmak için kontrastı bindirdik
            targetColors = 48;        // Paleti çok daraltmıyoruz ki yüzdeki geçişler bloklaşmasın
            
            // Burası kritik: Eğer resim Umut Kaya gibi aşırı kontrastlı bir siyahsa dither ekleyerek
            // o kirli gri geçişleri matriste pürüzsüzce dağıtıyoruz.
            ditherValue = chromaVibrancy < 40 ? 0.5 : 0.2; 
            
            saturationValue = finalBrightness < 1.0 ? 1.4 : 1.75;
            useRecomb = true;
        }

        // 4. Sharp Pipeline
        let pipeline = sharp(inputBuffer)
            .resize(64, 64, { 
                fit: 'cover',
                kernel: sharp.kernel.lanczos3 
            })
            .removeAlpha()
            
            .modulate({
                brightness: finalBrightness,
                saturation: saturationValue
            });
            
        if (useRecomb) {
            pipeline = pipeline.recomb([
                [ 1.0,  0.0,  0.0 ], 
                [ 0.05, 1.1,  0.0 ], 
                [ 0.0,  0.0,  1.0 ]  
            ]);
        }
            
        const outputBuffer = await pipeline
            .gamma(gammaValue) 
            .linear(contrastMultiplier, linearOffset) 
            
            // Keskinleştirmeyi dinamik yaptık; siyah ağırlıklı resimlerde fontlar patlamasın
            .sharpen({
                sigma: averageLightness < 105 ? 1.0 : 1.4,
                flat: 3.0,
                jagged: 3.5
            })
            
            .png({
                palette: true,
                colors: targetColors,       
                dither: ditherValue       
            })
            .toBuffer();

        // 5. Yanıtı gönder
        res.set('Content-Type', 'image/png');
        res.send(outputBuffer);

    } catch (error) {
        console.error("Matrix dynamic resize error:", error.message);
        res.status(500).json({ error: "Failed to process image" });
    }
});

router.get("/api/time", (_req, res) => {
    const now = new Date();
    // Almanya/Türkiye saati gibi özel bir zaman dilimi veya doğrudan yerel saat:
    // UTC offsetsiz saf ISO verisi veya doğrudan obje
    res.json({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds(),
        unix: Math.floor(now.getTime() / 1000)
    });
});


export default router;