(() => {
    AOS.init();

    const qs = new URLSearchParams(location.search);
    const deviceId = qs.get("id");

    const els = {
        deviceTitle: document.getElementById("deviceTitle"),
        deviceSub: document.getElementById("deviceSub"),
        statusBadge: document.getElementById("statusBadge"),
        lastSeen: document.getElementById("lastSeen"),
        caps: document.getElementById("caps"),
        execResult: document.getElementById("execResult"),
        colorPickerWrap: document.getElementById("colorPickerWrap"),
        colorPicker: document.getElementById("colorPicker"),
        sendColor: document.getElementById("sendColor"),
        brightnessWrap: document.getElementById("brightnessWrap"),
        brightnessInput: document.getElementById("brightnessInputNEW"),
        usernameLabel: document.getElementById("usernameLabel"),
        realnameLabel: document.getElementById("realnameLabel"),
        roleLabel: document.getElementById("roleLabel"),
        authLabel: document.getElementById("authLabel"),
        matrixModeSelect: document.getElementById("matrixModeSelect"),
        matrixImageInput: document.getElementById("matrixImageInput"),
        triggerImageUpload: document.getElementById("triggerImageUpload"),
        imageFileName: document.getElementById("imageFileName")
    };

    const modeToIndex = { rgb: 0, wave: 1, hue: 2 };
    const indexToMode = ["rgb", "wave", "hue"];

    const switchEls = {
        container: document.querySelector(".switch-container"),
        slider: document.getElementById("switch-slider"),
        options: Array.from(document.querySelectorAll(".switch-option")),
        msg: document.getElementById("message-output"),
    };

    function moveSliderToIndex(index) {
        if (!switchEls.slider || !switchEls.container) return;
        const containerWidth = switchEls.container.offsetWidth;
        const per = containerWidth / 3;
        const newPos = per * index + 4;
        switchEls.slider.style.transform = `translateX(${newPos}px)`;
    }

    function setActiveIndex(index) {
        switchEls.options.forEach(o => o.classList.remove("active"));
        const btn = switchEls.options[index];
        if (btn) btn.classList.add("active");
        moveSliderToIndex(index);
    }

    function currentParamsForMode(mode) {
        const brightnessValue = Number(els.brightnessInput.value) || undefined;
        
        if (mode === "rgb") {
            const hex = els.colorPicker.value || "#ffffff";
            return {
                r: parseInt(hex.slice(1, 3), 16),
                g: parseInt(hex.slice(3, 5), 16),
                b: parseInt(hex.slice(5, 7), 16),
                brightness: brightnessValue,
            };
        }
        if (mode === "wave") {
            return { speed: 0.5, brightness: brightnessValue };
        }
        if (mode === "weather") {
            const city = document.getElementById("weatherCity")?.value || "Istanbul";
            return { city, brightness: brightnessValue };
        }
        if (mode === "countdown") {
            const target = document.getElementById("countdownTarget")?.value || "";
            return { target, brightness: brightnessValue };
        }
        if (mode === "text") {
            const text = document.getElementById("customText")?.value || "";
            const hex = document.getElementById("textColorPicker")?.value || "#00ff00";
            return {
                text,
                r: parseInt(hex.slice(1, 3), 16),
                g: parseInt(hex.slice(3, 5), 16),
                b: parseInt(hex.slice(5, 7), 16),
                brightness: brightnessValue
            };
        }
        return { brightness: brightnessValue };
    }

    function applyModeUI(mode) {
        document.querySelectorAll(".mode-subpanel").forEach(panel => {
            panel.style.display = "none";
        });

        const isRgb = mode === "rgb";
        const hasBrightness = ["rgb", "wave", "hue", "image", "weather", "text"].includes(mode);

        els.colorPickerWrap.style.display = isRgb ? "grid" : "none";
        els.brightnessWrap.style.display = hasBrightness ? "block" : "none";

        const specificPanel = document.getElementById(`panel_${mode}`);
        if (specificPanel) {
            specificPanel.style.display = "block";
        }

        switchEls.msg.textContent = `Mode: ${mode.toUpperCase()}`;
        if (els.matrixModeSelect) {
            els.matrixModeSelect.value = mode;
        }
    }

    async function sendUpdatedState(mode) {
        const params = currentParamsForMode(mode);
        els.execResult.textContent = "Applying Mode…";
        try {
            const r = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/state`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ mode, params, execute: true }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error || "Failed to update state");
            els.execResult.textContent = `Mode successfully set to ${mode.toUpperCase()}`;
            els.deviceSub.textContent = `${els.deviceSub.textContent.split(" • ")[0]} • smart • ${mode.toUpperCase()}`;
        } catch (e) {
            els.execResult.textContent = e.message || String(e);
        }
    }

    if (!deviceId) {
        alert("Missing device id");
        location.href = "/remotecontrol.html";
        return;
    }

    const fmtDate = (iso) => {
        if (!iso) return "never";
        const d = new Date(iso);
        return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
    };

    async function loadSession() {
        try {
            const r = await fetch("/api/session", { credentials: "include" });
            const s = await r.json();
            els.authLabel.textContent = s?.user ? "Logged in" : "Guest";
            els.usernameLabel.textContent = s?.user?.uname || s?.user?.name || "User";
            els.realnameLabel.textContent = s?.user?.realname || "";
            els.roleLabel.textContent = s?.user?.role || "";
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
        renderDevice(d);
    }

    function renderDevice(d) {
        els.deviceTitle.textContent = d.display_name;
        const currentMode = (d.state_mode || "rgb").toLowerCase();
        els.deviceSub.textContent = `${d.kind_label}${d.is_smart ? " • smart" : ""} • ${currentMode.toUpperCase()}`;
        els.statusBadge.textContent = d.status;
        els.statusBadge.className = `status-badge ${d.status === "online" ? "online" : "offline"}`;
        els.lastSeen.textContent = fmtDate(d.last_seen);
        els.caps.innerHTML = (d.capabilities || []).map(c => `<span class="cap-badge"> ${c}</span>`).join(", ");

        const initIndex = modeToIndex[currentMode] ?? 0;
        setActiveIndex(initIndex);
        applyModeUI(currentMode);

        switchEls.options.forEach(opt => {
            opt.addEventListener("click", async () => {
                const idx = Number(opt.dataset.index || 0);
                const mode = indexToMode[idx];
                setActiveIndex(idx);
                applyModeUI(mode);
                await sendUpdatedState(mode);
            });
        });

        els.matrixModeSelect?.addEventListener("change", async (e) => {
            const mode = e.target.value;
            const existingIndex = modeToIndex[mode];
            if (existingIndex !== undefined) {
                setActiveIndex(existingIndex);
            }
            applyModeUI(mode);
            await sendUpdatedState(mode);
        });

        window.addEventListener("resize", () => {
            const active = document.querySelector(".switch-option.active");
            const idx = active ? Number(active.dataset.index || 0) : 0;
            moveSliderToIndex(idx);
        });

        els.sendColor.addEventListener("click", () => {
            const hex = els.colorPicker.value;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            execAction(d.id, "set_color", { r, g, b });
        });
        document.getElementById('turnon').addEventListener("click", () => execAction(d.id, "on"));
        document.getElementById('turnoff').addEventListener("click", () => execAction(d.id, "off"));

        const brightnessInput = document.getElementById('brightnessInputNEW');
        let brightnessTimeout;
        brightnessInput.addEventListener("input", (e) => {
            clearTimeout(brightnessTimeout);
            const value = Number(e.target.value);
            brightnessTimeout = setTimeout(() => {
                execAction(d.id, "set_brightness", { value });
            }, 150);
        });

        document.getElementById("saveWeather")?.addEventListener("click", () => sendUpdatedState("weather"));
        document.getElementById("saveCountdown")?.addEventListener("click", () => sendUpdatedState("countdown"));
        document.getElementById("saveText")?.addEventListener("click", () => sendUpdatedState("text"));

        els.triggerImageUpload?.addEventListener("click", () => els.matrixImageInput.click());
        els.matrixImageInput?.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            els.imageFileName.textContent = file.name;
            const formData = new FormData();
            formData.append("matrix_image", file);

            try {
                els.execResult.textContent = "Uploading Image…";
                const r = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/upload-image`, {
                    method: "POST",
                    body: formData,
                    credentials: "include"
                });
                if (!r.ok) throw new Error("Upload failed");
                els.execResult.textContent = "Image loaded successfully!";
            } catch (err) {
                els.execResult.textContent = err.message || String(err);
            }
        });
    }

    async function execAction(id, action, params = {}) {
        els.execResult.textContent = "Working…";
        try {
            const r = await fetch(`/api/device-actions/${encodeURIComponent(id)}/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ params }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error || "Failed");
            els.execResult.textContent = j.ok ? "Action executed successfully" : JSON.stringify(j);
        } catch (e) {
            els.execResult.textContent = e.message || String(e);
        }
    }

    (async function init() {
        await loadSession();
        await loadDevice();
    })();
})();