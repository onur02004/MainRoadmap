document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. GENİŞLETİLMİŞ WIDGET VERİ MODELİ (MatrixOS v3.0)
    // ==========================================
    const WIDGET_DEFS = [
        // --- SPOTIFY GROUP ---
        {
            id: 'spot-album', name: 'Album Cover', icon: '🎵', category: 'Spotify',
            defaultDuration: 15, defaults: { source: 'Spotify', showProgress: true, blurBackground: false },
            props: [
                { key: 'source', label: 'Source Platform', type: 'select', options: ['Spotify', 'Apple Music', 'Local'] },
                { key: 'showProgress', label: 'Show Progress Bar', type: 'toggle' },
                { key: 'blurBackground', label: 'Ambient Glow Effect', type: 'toggle' }
            ],
            supportedDrivers: ['local', 'network']
        },
        {
            id: 'spot-info', name: 'Song Info', icon: 'ℹ️', category: 'Spotify',
            defaultDuration: 8, defaults: { scrollSpeed: 4, fontSize: 'medium', marqueeMode: true },
            supportedDrivers: ['local', 'network'],
            props: [
                { key: 'scrollSpeed', label: 'Scroll Speed (Pixels/f)', type: 'slider', min: 1, max: 10 },
                { key: 'fontSize', label: 'Font Size', type: 'select', options: ['small', 'medium', 'large'] },
                { key: 'marqueeMode', label: 'Continuous Loop (Marquee)', type: 'toggle' }
            ]
        },
        {
            id: 'spot-lyrics', name: 'Lyrics Sync', icon: '🎤', category: 'Spotify',
            defaultDuration: 12, defaults: { alignment: 'Center', lyricColor: '#1DB954', animate: true },
            supportedDrivers: ['local', 'network'],
            props: [
                { key: 'alignment', label: 'Text Alignment', type: 'select', options: ['Left', 'Center', 'Right'] },
                { key: 'lyricColor', label: 'Highlight Color (HEX)', type: 'text' },
                { key: 'animate', label: 'Smooth Scroll Transitions', type: 'toggle' }
            ]
        },
        // --- TIME GROUP ---
        {
            id: 'time-old', name: 'Old Clock', icon: '🕰️', category: 'Time',
            defaultDuration: 10, defaults: { style: 'Roman', showTicks: true, handsColor: '#d4af37' },
            supportedDrivers: ['local', 'media'],
            props: [
                { key: 'style', label: 'Dial Style', type: 'select', options: ['Roman', 'Classic Numbers', 'Minimalist Dots'] },
                { key: 'showTicks', label: 'Show Minute Marks', type: 'toggle' },
                { key: 'handsColor', label: 'Hands Color', type: 'text' }
            ]
        },
        {
            id: 'time-mod', name: 'Modern Clock', icon: '🕐', category: 'Time',
            defaultDuration: 10, defaults: { format: '24h', showSeconds: true, theme: 'Neon' },
            supportedDrivers: ['local', 'media'],
            props: [
                { key: 'format', label: 'Time Format', type: 'select', options: ['12h', '24h'] },
                { key: 'showSeconds', label: 'Render Seconds Ring', type: 'toggle' },
                { key: 'theme', label: 'Color Theme', type: 'select', options: ['Neon', 'Minimal', 'Retro Black', 'Cyberpunk'] }
            ]
        },
        {
            id: 'time-digi', name: 'Digital Clock', icon: '🔢', category: 'Time',
            defaultDuration: 8, defaults: { fontStyle: '7-Segment', blinkingColon: true },
            supportedDrivers: ['local', 'media'],
            props: [
                { key: 'fontStyle', label: 'Font Matrix Type', type: 'select', options: ['7-Segment', 'Bold Pixel', 'Glow Italic'] },
                { key: 'blinkingColon', label: 'Blinking Separator (:)', type: 'toggle' }
            ]
        },
        // --- PETS GROUP (YENİ) ---
        {
            id: 'matrix-pet', name: 'Virtual Pet', icon: '👾', category: 'Pets',
            defaultDuration: 12, defaults: { petType: 'Piksel Kedi', mood: 'Happy', accessory: 'Hat' },
            supportedDrivers: ['network', 'media'],
            props: [
                { key: 'petType', label: 'Pet Species', type: 'select', options: ['Piksel Kedi', 'Neon Slime', 'Cyber Dino'] },
                { key: 'mood', label: 'Default State', type: 'select', options: ['Happy', 'Sleeping', 'Dancing'] },
                { key: 'accessory', label: 'Wearable Accessory', type: 'select', options: ['None', 'Hat', 'Glasses'] }
            ]
        },
        // --- RETRO GAMES GROUP (YENİ) ---
        {
            id: 'retro-game', name: 'Autoplay Game', icon: '🕹️', category: 'Games',
            defaultDuration: 15, defaults: { gameType: 'Snake AI', speedMultiplier: 2 },
            supportedDrivers: ['local', 'media'],
            props: [
                { key: 'gameType', label: 'Select Arcade Game', type: 'select', options: ['Snake AI', 'Pong Simulation'] },
                { key: 'speedMultiplier', label: 'Simulation Speed', type: 'slider', min: 1, max: 4 }
            ]
        },
        // --- SIMULATION GROUP (YENİ - CONWAY'S LIFE) ---
        {
            id: 'game-of-life', name: 'Game of Life', icon: '🧬', category: 'Simulation',
            defaultDuration: 20, defaults: { cellColor: '#00F5FF', gridDensity: 'Medium' },
            supportedDrivers: ['local', 'media'],
            props: [
                { key: 'cellColor', label: 'Cell Color (HEX)', type: 'text' },
                { key: 'gridDensity', label: 'Initial Generation Density', type: 'select', options: ['Low', 'Medium', 'High'] }
            ]
        },
        // --- AVIATION GROUP ---
        {
            id: 'flight-radar', name: 'Flight Radar', icon: '✈️', category: 'Aviation',
            defaultDuration: 12, defaults: { radius: 50, showAltitude: false, trackingFilter: 'All' },
            supportedDrivers: ['network', 'media'],
            props: [
                { key: 'radius', label: 'Search Radius (km)', type: 'slider', min: 10, max: 200 },
                { key: 'showAltitude', label: 'Render Altitude Metric', type: 'toggle' },
                { key: 'trackingFilter', label: 'Aircraft Filter', type: 'select', options: ['All', 'Commercial', 'Military', 'Private'] }
            ]
        },
        {
            id: 'closest-plane', name: 'Closest Plane', icon: '🛬', category: 'Aviation',
            defaultDuration: 10, defaults: { alertOnSquawk: true, minAltitude: 1000, apiEndpoint: 'https://opensky' },
            supportedDrivers: ['network', 'media'],
            props: [
                { key: 'apiEndpoint', label: 'ADS-B Target URL', type: 'text' },
                { key: 'minAltitude', label: 'Ignore Below (Feet)', type: 'slider', min: 0, max: 10000 },
                { key: 'alertOnSquawk', label: 'Flash Screen on Emergency Squawk', type: 'toggle' }
            ]
        },
        // --- SPACE GROUP ---
        {
            id: 'iss', name: 'ISS Location', icon: '🛰️', category: 'Space',
            defaultDuration: 15, defaults: { mapStyle: 'Vector Grid', showCoordinates: true, refreshRate: 5 },
            supportedDrivers: ['network', 'media'],
            props: [
                { key: 'mapStyle', label: 'Background Earth Render', type: 'select', options: ['Vector Grid', 'Outline Map'] },
                { key: 'refreshRate', label: 'Telemetry Fetch Interval (s)', type: 'slider', min: 1, max: 30 },
                { key: 'showCoordinates', label: 'Draw Lat / Long Text', type: 'toggle' }
            ]
        },
        // --- WEATHER GROUP ---
        {
            id: 'weather', name: 'Weather Info', icon: '🌤️', category: 'Weather',
            defaultDuration: 10, defaults: { location: 'Ravensburg', unit: 'C', detailedForecast: true, animatedIcons: true },
            supportedDrivers: ['network', 'media'],
            props: [
                { key: 'location', label: 'City Target', type: 'text' },
                { key: 'unit', label: 'Temperature Scale', type: 'select', options: ['C', 'F'] },
                { key: 'animatedIcons', label: 'Animate Weather Particles', type: 'toggle' }
            ]
        },
        // --- GRADIENT GROUP ---
        {
            id: 'gradient1', name: 'Basic Gradient', icon: '🌈', category: 'Gradient',
            defaultDuration: 10, defaults: { speed: 3, palette: 'Cyberpunk', angle: 45 },
            supportedDrivers: ['local', 'media'],
            props: [
                { key: 'palette', label: 'Color Map', type: 'select', options: ['Cyberpunk', 'Neon Fire', 'Ocean Waves', 'Forest Glow', 'Monochrome'] },
                { key: 'speed', label: 'Shift Animation Speed', type: 'slider', min: 1, max: 10 },
                { key: 'angle', label: 'Gradient Vector Angle (°)', type: 'slider', min: 0, max: 360 }
            ]
        },
        // --- MEDIA GROUP ---
        {
            id: 'static-image', name: 'Static Image', icon: '🖼️', category: 'Media',
            defaultDuration: 10, defaults: { imageData: null },
            supportedDrivers: ['local', 'media'],
            props: [
                { key: 'imageData', label: 'Upload System Image (64x64 Matrix)', type: 'image' }
            ]
        }
    ];

    // ==========================================
    // 2. GLOBAL STATE KONTROLLERİ & STORAGE
    // ==========================================
    let timelineStates = {
        'timeline-normal': [],
        'timeline-song': [],
        'timeline-custom': []
    };

    function saveState() {
        localStorage.setItem('matrix_studio_sequences', JSON.stringify(timelineStates));
    }

    if (localStorage.getItem('matrix_studio_sequences')) {
        try {
            timelineStates = JSON.parse(localStorage.getItem('matrix_studio_sequences'));
        } catch (e) { console.error("Hafıza yükleme hatası", e); }
    }

    let activeMode = 'timeline-normal';
    let selectedWidgetId = null;
    let uniqueCounter = Date.now();

    let isPlaying = false;
    let sequenceTotalTime = 0;
    let globalTimeElapsed = 0;
    let playbackInterval = null;
    let draggedItemIdx = null;

    // Oyun ve Simülasyon State Bellekleri (Döngülerde sıfırlanmaması için persist tutuluyor)
    let snakeState = { body: [{ x: 32, y: 32 }, { x: 32, y: 33 }, { x: 32, y: 34 }], dir: { x: 0, y: -1 }, food: { x: 12, y: 15 } };
    let pongState = { p1: 24, p2: 24, ballX: 32, ballY: 32, ballDirX: 1, ballDirY: 0.5 };
    let conwayGrid = [];

    const menuContainer = document.getElementById('widget-menu-container');
    const propsContainer = document.getElementById('properties-container');
    const globalScrubber = document.getElementById('global-scrubber');
    const currentTimeText = document.getElementById('current-time-text');

    // ==========================================
    // 3. HARDWARE EMÜLATÖR MOTORU (P3.0 SMD LED)
    // ==========================================
    const MatrixPanel = {
        canvas: null, ctx: null, currentDriver: 'local', pixelSize: 4, imgCache: null,

        init() {
            this.canvas = document.getElementById('matrix-canvas');
            if (!this.canvas) return;
            this.ctx = this.canvas.getContext('2d');
            this.imgCache = new Image();

            const selector = document.getElementById('sim-driver-select');
            if (selector) {
                selector.addEventListener('change', (e) => {
                    this.currentDriver = e.target.value;
                    renderWidgetMenu(); // YENİ: Sürücü değişince menüyü yeniden çiz
                    this.renderCurrentState();
                });
            }
            this.clearGrid();
        },

        drawLED(x, y, colorStr) {
            if (!this.ctx || x < 0 || x >= 64 || y < 0 || y >= 64) return;
            const centerX = (x * this.pixelSize) + (this.pixelSize / 2);
            const centerY = (y * this.pixelSize) + (this.pixelSize / 2);
            const ledRadius = 1.1;

            this.ctx.save();
            if (colorStr !== '#111115' && colorStr !== '#020202') {
                this.ctx.shadowColor = colorStr;
                this.ctx.shadowBlur = 4;
            }
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, ledRadius, 0, 2 * Math.PI);
            this.ctx.fillStyle = colorStr;
            this.ctx.fill();
            this.ctx.restore();
        },

        clearGrid() {
            if (!this.ctx) return;
            this.ctx.fillStyle = '#020202';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            if (this.currentDriver !== 'disabled') {
                for (let x = 0; x < 64; x++) {
                    for (let y = 0; y < 64; y++) {
                        this.drawLED(x, y, '#111115');
                    }
                }
            }
        },

        renderCurrentState() {
            const currentSequence = timelineStates[activeMode];
            if (currentSequence.length === 0) {
                this.clearGrid();
                return;
            }

            let accumulatedTime = 0;
            let targetWidget = null;
            let localElapsed = 0;

            for (let widget of currentSequence) {
                if (globalTimeElapsed >= accumulatedTime && globalTimeElapsed <= accumulatedTime + widget.duration) {
                    targetWidget = widget;
                    localElapsed = globalTimeElapsed - accumulatedTime;
                    break;
                }
                accumulatedTime += widget.duration;
            }

            if (!targetWidget && currentSequence.length > 0) {
                targetWidget = currentSequence[currentSequence.length - 1];
                localElapsed = targetWidget.duration;
            }

            this.updateFrame(targetWidget, localElapsed);
        },

        updateFrame(activeWidget, elapsed) {
            if (this.currentDriver === 'disabled') {
                this.ctx.fillStyle = '#111'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.fillStyle = '#666'; this.ctx.font = '12px monospace';
                this.ctx.fillText("PANEL DISABLED", 80, 130); return;
            }


            this.clearGrid();
            if (!activeWidget) return;

            // YENİ: Widget'ın bu driver'ı destekleyip desteklemediğini kontrol et
            const def = WIDGET_DEFS.find(d => d.id === activeWidget.defId);
            if (def && def.supportedDrivers && !def.supportedDrivers.includes(this.currentDriver)) {
                this.ctx.fillStyle = '#ff0055';
                this.ctx.font = '8px monospace';
                this.ctx.fillText("UNSUPPORTED", 4, 30);
                this.ctx.fillText("DRIVER", 14, 45);
                return;
            }

            if (this.currentDriver === 'local') {
                this.drivers.local(activeWidget, elapsed);
            } else {
                this.drivers.drawStatusText(`[${this.currentDriver.toUpperCase()}] PIPE ACTIVE`);
            }
        },

        drivers: {
            local(widget, elapsed) {
                const pulse = Math.floor(elapsed * 10);

                // ==========================================
                // YENİ: VIRTUAL PET DRIVER (Piksel Evcil Hayvan)
                // ==========================================
                if (widget.defId === 'matrix-pet') {
                    let pet = widget.config.petType || 'Piksel Kedi';
                    let mood = widget.config.mood || 'Happy';
                    let acc = widget.config.accessory || 'None';

                    // Animasyon offsets
                    let bounce = mood === 'Dancing' ? (pulse % 4 < 2 ? 1 : -1) : (pulse % 12 < 6 ? 0 : 1);
                    let eyeClose = mood === 'Sleeping' || (pulse % 20 > 18); // Kırpma efekti

                    let baseColor = '#ff4d8d';
                    if (pet === 'Neon Slime') baseColor = '#00ffaa';
                    if (pet === 'Cyber Dino') baseColor = '#ff9800';

                    // Gövde Çizimi (Merkez 32,32 etrafında 12x12 piksel blok)
                    for (let x = 26; x <= 38; x++) {
                        for (let y = 30 + bounce; y <= 40 + bounce; y++) {
                            MatrixPanel.drawLED(x, y, baseColor);
                        }
                    }
                    // Kulaklar / Dinozor kemikleri özel çizim hatları
                    if (pet === 'Piksel Kedi') {
                        MatrixPanel.drawLED(26, 28 + bounce, baseColor); MatrixPanel.drawLED(38, 28 + bounce, baseColor);
                    }
                    // Gözler
                    let eyeColor = eyeClose ? '#222' : '#ffffff';
                    MatrixPanel.drawLED(29, 33 + bounce, eyeColor); MatrixPanel.drawLED(35, 33 + bounce, eyeColor);

                    // Aksesuarlar
                    if (acc === 'Hat') {
                        for (let hx = 28; hx <= 36; hx++) MatrixPanel.drawLED(hx, 27 + bounce, '#ff0055');
                        MatrixPanel.drawLED(32, 26 + bounce, '#ffffff');
                    } else if (acc === 'Glasses') {
                        for (let gx = 28; gx <= 36; gx++) MatrixPanel.drawLED(gx, 33 + bounce, '#00f5ff');
                    }

                    this.drawStatusText(`PET: ${pet.toUpperCase()} [${mood}]`, 12);
                }

                // ==========================================
                // YENİ: AUTOPLAY ARCADE GAMES DRIVER (Snake / Pong)
                // ==========================================
                else if (widget.defId === 'retro-game') {
                    let game = widget.config.gameType || 'Snake AI';

                    if (game === 'Snake AI') {
                        // Basit Kendi Kendine Karar Veren Yapay Zeka Yılan Mekaniği
                        if (pulse % Math.max(1, 5 - (widget.config.speedMultiplier || 2)) === 0) {
                            let head = snakeState.body[0];
                            // Yiyeceğe doğru yönlenme algoritması
                            if (head.x < snakeState.food.x) snakeState.dir = { x: 1, y: 0 };
                            else if (head.x > snakeState.food.x) snakeState.dir = { x: -1, y: 0 };
                            else if (head.y < snakeState.food.y) snakeState.dir = { x: 0, y: 1 };
                            else if (head.y > snakeState.food.y) snakeState.dir = { x: 0, y: -1 };

                            let newHead = { x: (head.x + snakeState.dir.x + 64) % 64, y: (head.y + snakeState.dir.y + 64) % 64 };
                            snakeState.body.unshift(newHead);

                            if (newHead.x === snakeState.food.x && newHead.y === snakeState.food.y) {
                                snakeState.food = { x: Math.floor(Math.random() * 50) + 5, y: Math.floor(Math.random() * 50) + 5 };
                            } else {
                                snakeState.body.pop();
                            }
                        }
                        // Çizim
                        MatrixPanel.drawLED(snakeState.food.x, snakeState.food.y, '#ff0055'); // Yem
                        snakeState.body.forEach((pt, i) => {
                            MatrixPanel.drawLED(pt.x, pt.y, i === 0 ? '#00f5ff' : '#00a8aa'); // Yılan
                        });
                    } else {
                        // Pong Simülasyonu
                        if (pulse % 1 === 0) {
                            pongState.ballX += pongState.ballDirX;
                            pongState.ballY += pongState.ballDirY;

                            if (pongState.ballY <= 2 || pongState.ballY >= 62) pongState.ballDirY *= -1;

                            // Otomatik raket takibi
                            pongState.p1 += (pongState.ballY - pongState.p1) * 0.2;
                            pongState.p2 += (pongState.ballY - pongState.p2) * 0.2;

                            if (pongState.ballX <= 4) { pongState.ballDirX *= -1; }
                            if (pongState.ballX >= 60) { pongState.ballDirX *= -1; }
                        }
                        // Sol/Sağ raketler ve top çizimi
                        for (let i = -4; i <= 4; i++) {
                            MatrixPanel.drawLED(3, Math.floor(pongState.p1 + i), '#ffffff');
                            MatrixPanel.drawLED(61, Math.floor(pongState.p2 + i), '#ffffff');
                        }
                        MatrixPanel.drawLED(Math.floor(pongState.ballX), Math.floor(pongState.ballY), '#ffcc00');
                    }
                    this.drawStatusText(`GAME: ${game.toUpperCase()}`, 12);
                }

                // ==========================================
                // YENİ: CONWAY'S GAME OF LIFE (Hücresel Otomat)
                // ==========================================
                else if (widget.defId === 'game-of-life') {
                    let color = widget.config.cellColor || '#00F5FF';

                    // Izgara boyutu optimizasyonu (Hız koruması için 32x32 küçültüp, 64x64'e ölçekleyelim)
                    if (conwayGrid.length === 0 || elapsed < 0.2) {
                        conwayGrid = Array(32).fill().map(() => Array(32).fill(0));
                        let density = widget.config.gridDensity === 'High' ? 0.5 : (widget.config.gridDensity === 'Low' ? 0.15 : 0.3);
                        for (let x = 0; x < 32; x++) for (let y = 0; y < 32; y++) if (Math.random() < density) conwayGrid[x][y] = 1;
                    }

                    // Her 3 karede bir yeni nesil hesapla
                    if (pulse % 3 === 0) {
                        let nextGrid = conwayGrid.map(arr => [...arr]);
                        for (let x = 0; x < 32; x++) {
                            for (let y = 0; y < 32; y++) {
                                // Komşu sayma
                                let neighbors = 0;
                                for (let i = -1; i <= 1; i++) {
                                    for (let j = -1; j <= 1; j++) {
                                        if (i === 0 && j === 0) continue;
                                        let nx = (x + i + 32) % 32;
                                        let ny = (y + j + 32) % 32;
                                        neighbors += conwayGrid[nx][ny];
                                    }
                                }
                                // Conway kuralları
                                if (conwayGrid[x][y] === 1 && (neighbors < 2 || neighbors > 3)) nextGrid[x][y] = 0;
                                else if (conwayGrid[x][y] === 0 && neighbors === 3) nextGrid[x][y] = 1;
                            }
                        }
                        conwayGrid = nextGrid;
                    }

                    // Matrise 2x2 ölçekle basma
                    for (let x = 0; x < 32; x++) {
                        for (let y = 0; y < 32; y++) {
                            if (conwayGrid[x][y] === 1) {
                                MatrixPanel.drawLED(x * 2, y * 2, color); MatrixPanel.drawLED(x * 2 + 1, y * 2, color);
                                MatrixPanel.drawLED(x * 2, y * 2 + 1, color); MatrixPanel.drawLED(x * 2 + 1, y * 2 + 1, color);
                            }
                        }
                    }
                    this.drawStatusText("CONWAY'S GAME OF LIFE", 12);
                }

                // --- ESKİ AKTİF MODÜLLER ---
                else if (widget.defId === 'static-image' && widget.config.imageData) {
                    if (MatrixPanel.imgCache.src !== widget.config.imageData) MatrixPanel.imgCache.src = widget.config.imageData;
                    if (MatrixPanel.imgCache.complete) {
                        const offscreen = document.createElement('canvas'); offscreen.width = 64; offscreen.height = 64;
                        const oCtx = offscreen.getContext('2d'); oCtx.drawImage(MatrixPanel.imgCache, 0, 0, 64, 64);
                        const imgData = oCtx.getImageData(0, 0, 64, 64).data;
                        for (let y = 0; y < 64; y++) {
                            for (let x = 0; x < 64; x++) {
                                const idx = (y * 64 + x) * 4;
                                if (imgData[idx + 3] > 30) MatrixPanel.drawLED(x, y, `rgb(${imgData[idx]},${imgData[idx + 1]},${imgData[idx + 2]})`);
                            }
                        }
                    }
                }
                else if (widget.defId === 'spot-album') {
                    const color = widget.config.source === 'Spotify' ? '#1DB954' : '#FA243C';
                    for (let x = 4; x < 28; x++) for (let y = 18; y < 42; y++) MatrixPanel.drawLED(x, y, color);
                    if (widget.config.showProgress) {
                        let barLength = Math.floor((elapsed / widget.duration) * 24);
                        for (let i = 0; i < barLength; i++) MatrixPanel.drawLED(4 + i, 48, '#ffffff');
                    }
                    this.drawStatusText("NOW PLAYING", 12);
                }
                else if (widget.defId === 'spot-info') {
                    let speed = widget.config.scrollSpeed || 4;
                    let shift = Math.floor(elapsed * speed * 4) % 64;
                    for (let x = 0; x < 64; x++) {
                        let formula = Math.sin((x + shift) * 0.3) * 4 + 32;
                        MatrixPanel.drawLED(x, Math.floor(formula), '#1DB954');
                    }
                    this.drawStatusText("TRACK INFO", 12);
                }
                else if (widget.defId === 'time-old') {
                    let color = widget.config.handsColor || '#d4af37';
                    for (let i = 0; i < 12; i++) {
                        let rad = (i * 30) * Math.PI / 180;
                        MatrixPanel.drawLED(Math.floor(32 + 22 * Math.cos(rad)), Math.floor(32 + 22 * Math.sin(rad)), '#33333d');
                    }
                    let hrRad = (elapsed * 6) * Math.PI / 180;
                    let minRad = (elapsed * 45) * Math.PI / 180;
                    for (let i = 0; i < 12; i++) MatrixPanel.drawLED(Math.floor(32 + i * Math.cos(hrRad)), Math.floor(32 + i * Math.sin(hrRad)), color);
                    for (let i = 0; i < 18; i++) MatrixPanel.drawLED(Math.floor(32 + i * Math.cos(minRad)), Math.floor(32 + i * Math.sin(minRad)), '#ffffff');
                }
                else if (widget.defId === 'time-mod') {
                    let color = widget.config.theme === 'Cyberpunk' ? '#ff0055' : '#00f5ff';
                    let secAngle = (elapsed * 360 / widget.duration) * Math.PI / 180;
                    if (widget.config.showSeconds) {
                        for (let r = 0; r < 360; r += 6) {
                            let rad = r * Math.PI / 180;
                            MatrixPanel.drawLED(Math.floor(32 + 24 * Math.cos(rad)), Math.floor(32 + 24 * Math.sin(rad)), '#151520');
                        }
                        MatrixPanel.drawLED(Math.floor(32 + 24 * Math.cos(secAngle)), Math.floor(32 + 24 * Math.sin(secAngle)), color);
                    }
                    this.drawStatusText("10:42", 34);
                }
                else if (widget.defId === 'gradient1') {
                    let palette = widget.config.palette || 'Cyberpunk';
                    let speed = widget.config.speed || 3;
                    let angleRad = (widget.config.angle || 45) * Math.PI / 180;
                    for (let y = 0; y < 64; y++) {
                        for (let x = 0; x < 64; x++) {
                            let factor = (x * Math.sin(angleRad) + y * Math.cos(angleRad)) + (pulse * speed);
                            let r = Math.floor(128 + 127 * Math.sin(factor * 0.05)), b = Math.floor(128 + 127 * Math.cos(factor * 0.03));
                            MatrixPanel.drawLED(x, y, `rgb(${r},40,${b})`);
                        }
                    }
                }
                else {
                    this.drawStatusText(`${widget.name.toUpperCase()}`, 32);
                }
            },
            drawStatusText(msg, posY = 130) {
                if (!MatrixPanel.ctx) return;
                MatrixPanel.ctx.fillStyle = '#ffffff'; MatrixPanel.ctx.font = '7px monospace';
                MatrixPanel.ctx.fillText(msg, 6, posY);
            }
        }
    };

    // ==========================================
    // 4. CORE MENU VE FILTER ENGINE
    // ==========================================
    function renderWidgetMenu(filterKeyword = '') {
        if (!menuContainer) return;
        menuContainer.innerHTML = '';
        const categories = [...new Set(WIDGET_DEFS.map(d => d.category))];

        const currentDriver = MatrixPanel.currentDriver;

        categories.forEach(cat => {
            const filteredWidgets = WIDGET_DEFS.filter(d =>
                d.category === cat &&
                d.name.toLowerCase().includes(filterKeyword) &&
                (!d.supportedDrivers || d.supportedDrivers.includes(currentDriver))
            );
            if (filteredWidgets.length === 0) return;

            const groupDiv = document.createElement('div');
            groupDiv.className = 'widget-group';
            const title = document.createElement('div');
            title.className = 'widget-group-title'; title.textContent = cat;
            groupDiv.appendChild(title);

            filteredWidgets.forEach(def => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'widget-item'; itemDiv.textContent = `${def.icon} ${def.name}`;
                itemDiv.dataset.defId = def.id; itemDiv.setAttribute('draggable', 'true');
                itemDiv.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ source: 'library', defId: def.id }));
                });
                groupDiv.appendChild(itemDiv);
            });
            menuContainer.appendChild(groupDiv);
        });
    }

    // ==========================================
    // 5. TIMELINE & DRAG-DROP DRIVER
    // ==========================================
    const timelineViews = document.querySelectorAll('.timeline-view');

    timelineViews.forEach(zone => {
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => { zone.classList.remove('drag-over'); });
        zone.addEventListener('drop', (e) => {
            e.preventDefault(); zone.classList.remove('drag-over');
            try {
                const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
                if (dragData.source === 'library') {
                    addWidgetToSequence(dragData.defId);
                } else if (dragData.source === 'timeline' && draggedItemIdx !== null) {
                    const currentSequence = timelineStates[activeMode];
                    const targetIdx = getDropPositionIndex(zone, e.clientX);
                    const [movedItem] = currentSequence.splice(draggedItemIdx, 1);
                    const adjustedTargetIdx = targetIdx > draggedItemIdx ? targetIdx - 1 : targetIdx;
                    currentSequence.splice(adjustedTargetIdx, 0, movedItem);
                    draggedItemIdx = null; saveState(); renderActiveSequence(); updateTimelineMetrics();
                }
            } catch (err) { console.error(err); }
        });
    });

    function getDropPositionIndex(zone, clientX) {
        const items = Array.from(zone.querySelectorAll('.timeline-item'));
        for (let i = 0; i < items.length; i++) {
            const rect = items[i].getBoundingClientRect();
            if (clientX < rect.left + rect.width / 2) return i;
        }
        return items.length;
    }

    function addWidgetToSequence(defId) {
        const def = WIDGET_DEFS.find(d => d.id === defId);
        if (!def) return;
        const newInstance = {
            id: uniqueCounter++, defId: def.id, name: def.name, icon: def.icon,
            duration: def.defaultDuration, config: JSON.parse(JSON.stringify(def.defaults))
        };
        timelineStates[activeMode].push(newInstance);
        saveState(); renderActiveSequence(); selectWidget(newInstance.id); updateTimelineMetrics();
    }

    function renderActiveSequence() {
        const activeZone = document.getElementById(activeMode);
        if (!activeZone) return;
        const currentSequence = timelineStates[activeMode];

        if (currentSequence.length === 0) {
            activeZone.innerHTML = `<p>Drag widgets here to build your sequence.</p>`;
            return;
        }
        activeZone.innerHTML = '';

        let accumulatedTime = 0;
        currentSequence.forEach((item, index) => {
            const block = document.createElement('div');
            block.className = 'timeline-item';
            block.style.position = 'relative';
            block.style.width = `${item.duration * 12}px`;
            block.setAttribute('draggable', 'true');

            let progressFillHtml = '';
            if (globalTimeElapsed >= accumulatedTime && globalTimeElapsed < accumulatedTime + item.duration) {
                const localElapsed = globalTimeElapsed - accumulatedTime;
                const percent = (localElapsed / item.duration) * 100;
                progressFillHtml = `<div style="position:absolute; bottom:0; left:0; height:4px; width:${percent}%; background:#00F5FF;"></div>`;
                block.style.borderColor = '#00F5FF';
                if (!isPlaying) block.classList.add('active-scrub');
            }

            block.innerHTML = `<span>${item.icon} ${item.name}</span><span style="position:absolute; right:6px; top:2px; font-size:0.7rem; color:rgba(255,255,255,0.6);">${item.duration}s</span>${progressFillHtml}`;
            if (selectedWidgetId === item.id) block.classList.add('selected');

            block.addEventListener('click', (e) => { e.stopPropagation(); selectWidget(item.id); });
            block.addEventListener('dragstart', (e) => {
                draggedItemIdx = index;
                e.dataTransfer.setData('application/json', JSON.stringify({ source: 'timeline', id: item.id }));
            });

            activeZone.appendChild(block);
            accumulatedTime += item.duration;
        });
    }

    // ==========================================
    // 6. SAĞ PANEL: PARAMETRE EDİTÖRÜ & SEÇEREK BAŞLATMA
    // ==========================================
    function selectWidget(id) {
        selectedWidgetId = id;
        const currentSequence = timelineStates[activeMode];
        const item = currentSequence.find(i => i.id === id);

        if (!item) {
            propsContainer.innerHTML = `<p>Select a dropped widget.</p>`;
            return;
        }

        let accumulatedTime = 0;
        for (let widget of currentSequence) {
            if (widget.id === id) {
                globalTimeElapsed = accumulatedTime;
                break;
            }
            accumulatedTime += widget.duration;
        }

        if (globalScrubber && currentTimeText) {
            globalScrubber.value = globalTimeElapsed;
            currentTimeText.textContent = `${globalTimeElapsed.toFixed(1)}s`;
        }
        renderActiveSequence();
        MatrixPanel.renderCurrentState();

        const def = WIDGET_DEFS.find(d => d.id === item.defId);
        let propsHtml = `<h4>${item.icon} ${item.name}</h4><div class="prop-group"><label>Duration (Seconds)</label><div style="display:flex; align-items:center; gap:10px;"><input type="range" id="edit-duration-slider" min="1" max="60" value="${item.duration}" style="flex:1;"><input type="number" id="edit-duration-num" value="${item.duration}" min="1" max="60" style="width:50px; text-align:center;"></div></div><hr style="margin:15px 0; border:0; border-top:1px solid #ccc;"><h5>Parameters</h5>`;

        def.props.forEach(prop => {
            const currentVal = item.config[prop.key];
            propsHtml += `<div class="prop-group" style="margin-top:12px;"><label style="font-size:0.85rem; font-weight:bold;">${prop.label}</label>`;
            if (prop.type === 'select') {
                propsHtml += `<select class="dynamic-input" data-key="${prop.key}">`;
                prop.options.forEach(opt => propsHtml += `<option value="${opt}" ${currentVal === opt ? 'selected' : ''}>${opt}</option>`);
                propsHtml += `</select>`;
            } else if (prop.type === 'text') {
                propsHtml += `<input type="text" class="dynamic-input" data-key="${prop.key}" value="${currentVal || ''}">`;
            } else if (prop.type === 'slider') {
                propsHtml += `<div style="display:flex; align-items:center; gap:10px;"><input type="range" class="dynamic-input" data-key="${prop.key}" min="${prop.min}" max="${prop.max}" value="${currentVal || 5}" style="flex:1;"><span class="slider-val" style="font-family:monospace; font-weight:bold; color:#0d6efd;">${currentVal || 5}</span></div>`;
            } else if (prop.type === 'toggle') {
                propsHtml += `<label style="font-weight:normal; cursor:pointer;"><input type="checkbox" class="dynamic-input" data-key="${prop.key}" ${currentVal ? 'checked' : ''}> Active Status</label>`;
            } else if (prop.type === 'image') {
                propsHtml += `<input type="file" class="image-upload-input" data-key="${prop.key}" accept="image/*"><div style="width:64px; height:64px; background:#111; margin-top:5px; border:1px solid #444; display:flex; align-items:center; justify-content:center; overflow:hidden;">${currentVal ? `<img src="${currentVal}" style="width:100%; height:100%; object-fit:contain; image-rendering:pixelated;">` : '<span style="font-size:0.7rem; color:#666;">Empty</span>'}</div>`;
            }
            propsHtml += `</div>`;
        });

        propsHtml += `<hr style="margin:20px 0; border:0; border-top:1px solid #ccc;"><div style="display:flex; flex-direction:column; gap:8px;"><button id="duplicate-widget" style="padding:6px; background:#198754; color:white; border:none; border-radius:4px; cursor:pointer;">✨ Duplicate</button><button id="delete-widget" style="padding:6px; background:#dc3545; color:white; border:none; border-radius:4px; cursor:pointer;">✕ Delete</button></div>`;
        propsContainer.innerHTML = propsHtml;

        const slider = document.getElementById('edit-duration-slider');
        const numInput = document.getElementById('edit-duration-num');
        function changeDur(val) {
            item.duration = Math.max(1, Math.min(60, parseInt(val) || 1));
            slider.value = item.duration; numInput.value = item.duration;
            renderActiveSequence(); updateTimelineMetrics(); saveState();
        }
        slider.addEventListener('input', (e) => changeDur(e.target.value));
        numInput.addEventListener('input', (e) => changeDur(e.target.value));

        propsContainer.querySelectorAll('.dynamic-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const key = e.target.dataset.key; let val = e.target.value;
                if (e.target.type === 'checkbox') val = e.target.checked;
                else if (e.target.type === 'range') { val = parseInt(e.target.value); e.target.nextElementSibling.textContent = val; }
                item.config[key] = val; saveState();
                MatrixPanel.renderCurrentState();
            });
        });

        document.getElementById('duplicate-widget').addEventListener('click', () => {
            const idx = currentSequence.findIndex(i => i.id === item.id);
            if (idx !== -1) {
                const clone = { id: uniqueCounter++, defId: item.defId, name: `${item.name} (Copy)`, icon: item.icon, duration: item.duration, config: JSON.parse(JSON.stringify(item.config)) };
                currentSequence.splice(idx + 1, 0, clone); saveState(); renderActiveSequence(); selectWidget(clone.id); updateTimelineMetrics();
            }
        });

        document.getElementById('delete-widget').addEventListener('click', () => {
            const idx = currentSequence.findIndex(i => i.id === item.id);
            if (idx !== -1) {
                currentSequence.splice(idx, 1); saveState(); selectedWidgetId = null; propsContainer.innerHTML = `<p>Select a dropped widget.</p>`; renderActiveSequence(); updateTimelineMetrics();
            }
        });
    }

    if (propsContainer) {
        propsContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('image-upload-input')) {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64Data = event.target.result;
                    const currentSequence = timelineStates[activeMode];
                    const item = currentSequence.find(i => i.id === selectedWidgetId);
                    if (item) {
                        item.config[e.target.dataset.key] = base64Data;
                        saveState();
                        e.target.nextElementSibling.innerHTML = `<img src="${base64Data}" style="width:100%; height:100%; object-fit:contain; image-rendering:pixelated;">`;
                        MatrixPanel.renderCurrentState();
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // ==========================================
    // 7. SCRUBBING VE PLAYBACK ENGINE (0.1s Hassasiyet)
    // ==========================================
    function updateTimelineMetrics() {
        const currentSequence = timelineStates[activeMode];
        sequenceTotalTime = currentSequence.reduce((sum, item) => sum + item.duration, 0);
        document.getElementById('total-duration').textContent = `${sequenceTotalTime}s`;

        if (globalScrubber && currentTimeText) {
            globalScrubber.max = sequenceTotalTime;
            if (globalTimeElapsed > sequenceTotalTime) globalTimeElapsed = 0;
            globalScrubber.value = globalTimeElapsed;
            currentTimeText.textContent = `${globalTimeElapsed.toFixed(1)}s`;
        }
    }

    if (globalScrubber) {
        globalScrubber.addEventListener('input', (e) => {
            globalTimeElapsed = parseFloat(e.target.value);
            if (currentTimeText) currentTimeText.textContent = `${globalTimeElapsed.toFixed(1)}s`;
            renderActiveSequence();
            MatrixPanel.renderCurrentState();
        });
    }

    function tickPlayback() {
        if (sequenceTotalTime === 0) return;
        globalTimeElapsed += 0.1;
        if (globalTimeElapsed >= sequenceTotalTime) globalTimeElapsed = 0;

        if (globalScrubber && currentTimeText) {
            globalScrubber.value = globalTimeElapsed;
            currentTimeText.textContent = `${globalTimeElapsed.toFixed(1)}s`;
        }
        renderActiveSequence();
        MatrixPanel.renderCurrentState();
    }

    function togglePlayback() {
        const playBtn = document.getElementById('timeline-play-btn');
        if (!playBtn) return;
        isPlaying = !isPlaying;

        if (isPlaying) {
            playBtn.innerHTML = `<span class="icon">⏸</span> Durdur`;
            playBtn.classList.add('playing');
            playbackInterval = setInterval(tickPlayback, 100);
        } else {
            clearInterval(playbackInterval);
            playBtn.innerHTML = `<span class="icon">▶</span> Oynat`;
            playBtn.classList.remove('playing');
            renderActiveSequence();
        }
    }

    if (document.getElementById('timeline-play-btn')) {
        document.getElementById('timeline-play-btn').addEventListener('click', togglePlayback);
    }

    if (document.getElementById('timeline-mode-dropdown')) {
        document.getElementById('timeline-mode-dropdown').addEventListener('change', (e) => {
            activeMode = e.target.value;
            timelineViews.forEach(v => v.classList.remove('active-view'));
            if (document.getElementById(activeMode)) document.getElementById(activeMode).classList.add('active-view');
            globalTimeElapsed = 0;
            if (isPlaying) togglePlayback();
            selectedWidgetId = null; propsContainer.innerHTML = `<p>Select a dropped widget.</p>`;
            renderWidgetMenu(); renderActiveSequence(); updateTimelineMetrics(); MatrixPanel.renderCurrentState();
        });
    }

    // BOOTSTRAP INITIALIZE
    MatrixPanel.init();
    renderWidgetMenu();
    renderActiveSequence();
    updateTimelineMetrics();
    MatrixPanel.renderCurrentState();
});