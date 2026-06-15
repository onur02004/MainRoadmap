(() => {
    AOS.init();

    const qs = new URLSearchParams(location.search);
    const deviceId = qs.get("id");

    if (!deviceId) {
        alert("Missing device id");
        location.href = "/remotecontrol.html";
        return;
    }

    const els = {
        deviceTitle: document.getElementById("deviceTitle"),
        deviceSub: document.getElementById("deviceSub"),
        statusBadge: document.getElementById("statusBadge"),
        lastSeen: document.getElementById("lastSeen"),
        execResult: document.getElementById("execResult"),
        
        // Ortak
        btnTurnOn: document.getElementById("turnon"),
        btnTurnOff: document.getElementById("turnoff"),

        // Kapsayıcılar
        uiLedStrip: document.getElementById("ui_led_strip"),
        uiMatrix: document.getElementById("ui_matrix"),
    };

    const fmtDate = (iso) => {
        if (!iso) return "never";
        const d = new Date(iso);
        return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
    };

    async function loadSession() {
        try {
            const r = await fetch("/api/session", { credentials: "include" });
            const s = await r.json();
            document.getElementById("authLabel").textContent = s?.user ? "Logged in" : "Guest";
            document.getElementById("usernameLabel").textContent = s?.user?.uname || s?.user?.name || "User";
            document.getElementById("realnameLabel").textContent = s?.user?.realname || "";
            document.getElementById("roleLabel").textContent = s?.user?.role || "";
        } catch { }
    }

    async function loadDevice() {
        const r = await fetch(`/api/devices/${encodeURIComponent(deviceId)}`, { credentials: "include" });
        if (!r.ok) {
            alert("Device not found");
            location.href = "/remotecontrol.html";
            return;
        }
        const d = await r.json();
        
        // Ortak Başlıkları Doldur
        els.deviceTitle.textContent = d.display_name;
        els.deviceSub.textContent = `${d.kind_label} ${d.is_smart ? "• Smart" : ""}`;
        els.statusBadge.textContent = d.status.toUpperCase();
        els.statusBadge.className = `status-badge ${d.status === "online" ? "online" : "offline"}`;
        els.lastSeen.textContent = fmtDate(d.last_seen);

        // Ortak Güç Butonları (Node.js backend'deki action sistemine gönderir)
        els.btnTurnOn.addEventListener("click", () => execAction("on"));
        els.btnTurnOff.addEventListener("click", () => execAction("off"));

        // CİHAZ TÜRÜNE GÖRE ARAYÜZ YÜKLE
        // Not: DB'deki kind_key değerlerine göre burayı ayarla. Genelde "led_strip" ve "matrix"tir.
        if (d.kind_key === "led_strip") {
            initLedStripUI(d);
        } else {
            initMatrixUI(d); // Matrix, Laptop, vb default matrix arayüzü
        }
    }

    // ==========================================
    // ORTAK: ACTION ÇALIŞTIRICI (LED İçin)
    // ==========================================
    async function execAction(action, params = {}) {
        els.execResult.textContent = "İşleniyor…";
        try {
            const r = await fetch(`/api/device-actions/${encodeURIComponent(deviceId)}/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ params }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error || "İşlem başarısız");
            els.execResult.textContent = "✔ Komut başarıyla gönderildi";
            setTimeout(() => els.execResult.textContent = "", 3000);
        } catch (e) {
            els.execResult.textContent = e.message || String(e);
        }
    }

    // ==========================================
    // ORTAK: STATE GÜNCELLEYİCİ (Matrix İçin)
    // ==========================================
    async function updateState(mode, params = {}) {
        els.execResult.textContent = "Mod değiştiriliyor…";
        try {
            const r = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/state`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ mode, params, execute: true }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error || "Durum güncellenemedi");
            els.execResult.textContent = `✔ Mod aktif: ${mode.toUpperCase()}`;
            setTimeout(() => els.execResult.textContent = "", 3000);
        } catch (e) {
            els.execResult.textContent = e.message || String(e);
        }
    }

    // ==========================================
    // 1. LED STRIP MANTIĞI
    // ==========================================
    function initLedStripUI(d) {
        els.uiLedStrip.style.display = "block";
        
        const slider = document.getElementById("led-slider");
        const options = Array.from(els.uiLedStrip.querySelectorAll(".switch-option"));
        const colorPicker = document.getElementById("ledColorPicker");
        const btnSendColor = document.getElementById("ledSendColor");
        const brightnessInput = document.getElementById("ledBrightness");
        const colorWrapper = document.getElementById("ledColorWrapper");

        // Segmented Control (RGB / Wave / Hue)
        options.forEach((opt, index) => {
            opt.addEventListener("click", () => {
                // UI Güncelleme
                options.forEach(o => o.classList.remove("active"));
                opt.classList.add("active");
                
                const containerWidth = opt.parentElement.offsetWidth;
                slider.style.transform = `translateX(${ (containerWidth / 3) * index + 4 }px)`;

                const mode = opt.dataset.mode;
                
                // Color Picker sadece RGB modunda açık kalsın
                colorWrapper.style.display = (mode === "rgb") ? "block" : "none";

                // Backend'e gönder
                if (mode === "wave") execAction("wave", { speed: 0.5 });
                if (mode === "hue") execAction("hue", {});
            });
        });

        // Renk Gönderme
        btnSendColor.addEventListener("click", () => {
            const hex = colorPicker.value;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            execAction("set_color", { r, g, b });
        });

        // Parlaklık (Debounce ile çok fazla istek atmayı engelliyoruz)
        let bTimer;
        brightnessInput.addEventListener("input", (e) => {
            clearTimeout(bTimer);
            bTimer = setTimeout(() => {
                execAction("set_brightness", { value: Number(e.target.value) });
            }, 200);
        });
    }

    // ==========================================
    // 2. MATRIX EKRAN MANTIĞI
    // ==========================================
    function initMatrixUI(d) {
        els.uiMatrix.style.display = "block";

        const appCards = document.querySelectorAll(".app-card");
        const subPanels = document.querySelectorAll(".mode-subpanel");
        const brightnessInput = document.getElementById("matrixBrightness");
        
        let currentMatrixMode = (d.state_mode || "rgb").toLowerCase();

        // Sub-panel Gösterici
        const showPanel = (mode) => {
            subPanels.forEach(p => p.style.display = "none");
            const targetPanel = document.getElementById(`panel_${mode}`);
            if (targetPanel) targetPanel.style.display = "block";
        };

        // Başlangıç Durumunu Ayarla
        appCards.forEach(card => {
            if (card.dataset.mode === currentMatrixMode) {
                card.classList.add("active");
                showPanel(currentMatrixMode);
            } else {
                card.classList.remove("active");
            }
        });

        // Tıklama Olayları (App Grid)
        appCards.forEach(card => {
            card.addEventListener("click", () => {
                const mode = card.dataset.mode;
                
                // UI Güncelle
                appCards.forEach(c => c.classList.remove("active"));
                card.classList.add("active");
                showPanel(mode);

                // Eğer ek parametre gerektirmeyen bir modsa direkt API'ye yolla
                if (["rgb", "spotify_album", "spotify_lyrics", "calendar", "auto"].includes(mode)) {
                    updateState(mode, { brightness: Number(brightnessInput.value) });
                }
            });
        });

        // Özel Form Gönderimleri (Metin, Hava Durumu vs.)
        document.getElementById("saveWeather").addEventListener("click", () => {
            const city = document.getElementById("weatherCity").value || "Istanbul";
            updateState("weather", { city, brightness: Number(brightnessInput.value) });
        });

        document.getElementById("saveText").addEventListener("click", () => {
            const text = document.getElementById("customText").value;
            const hex = document.getElementById("textColorPicker").value;
            updateState("text", {
                text,
                r: parseInt(hex.slice(1, 3), 16),
                g: parseInt(hex.slice(3, 5), 16),
                b: parseInt(hex.slice(5, 7), 16),
                brightness: Number(brightnessInput.value)
            });
        });

        // Resim Yükleme Formu
        const imgInput = document.getElementById("matrixImageInput");
        document.getElementById("triggerImageUpload").addEventListener("click", () => imgInput.click());
        imgInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            document.getElementById("imageFileName").textContent = file.name;
            const formData = new FormData();
            formData.append("matrix_image", file);

            try {
                els.execResult.textContent = "Resim yükleniyor… Matrix'e aktarılıyor.";
                const r = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/upload-image`, {
                    method: "POST",
                    body: formData,
                    credentials: "include"
                });
                if (!r.ok) throw new Error("Yükleme başarısız");
                els.execResult.textContent = "✔ Resim Matrix'e yansıtıldı!";
                updateState("image", { brightness: Number(brightnessInput.value) });
            } catch (err) {
                els.execResult.textContent = err.message || String(err);
            }
        });

        // Matrix Parlaklık
        let mTimer;
        brightnessInput.addEventListener("input", (e) => {
            clearTimeout(mTimer);
            mTimer = setTimeout(() => {
                const activeCard = document.querySelector(".app-card.active");
                const mode = activeCard ? activeCard.dataset.mode : "rgb";
                // State'e parlaklığı sadece parametre olarak gönder
                updateState(mode, { brightness: Number(e.target.value) });
            }, 300);
        });
    }

    (async function init() {
        await loadSession();
        await loadDevice();
    })();
})();