// deviceremotescript.js
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
        //controlPanel: document.getElementById("controlPanel"),
        execResult: document.getElementById("execResult"),

        colorPickerWrap: document.getElementById("colorPickerWrap"),
        colorPicker: document.getElementById("colorPicker"),
        sendColor: document.getElementById("sendColor"),

        brightnessWrap: document.getElementById("brightnessWrap"),
        brightnessInput: document.getElementById("brightnessInput"),
        sendBrightness: document.getElementById("sendBrightness"),

        usernameLabel: document.getElementById("usernameLabel"),
        realnameLabel: document.getElementById("realnameLabel"),
        roleLabel: document.getElementById("roleLabel"),
        authLabel: document.getElementById("authLabel"),
    };

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
        els.deviceSub.textContent = `${d.kind_label}${d.is_smart ? " • smart" : ""}`;
        els.statusBadge.textContent = d.status;
        els.statusBadge.className = `status-badge ${d.status === "online" ? "online" : "offline"}`;
        els.lastSeen.textContent = fmtDate(d.last_seen);
        els.caps.innerHTML = (d.capabilities || []).map(c => `<span class="cap-badge"> ${c}</span>`).join(", ");

        // After els.caps...
        const modeRow = document.createElement("div");
        modeRow.className = "device-remote-row";
        modeRow.innerHTML = `
  <span class="muted">Mode:</span>
  <div style="display:inline-flex;gap:.4rem;margin-left:.5rem;">
    <button class="chip-btn" data-mode="rgb">RGB</button>
    <button class="chip-btn" data-mode="wave">Wave</button>
    <button class="chip-btn" data-mode="hue">Hue</button>
  </div>
`;
        document.querySelector(".device-remote").prepend(modeRow);

        modeRow.querySelectorAll("[data-mode]").forEach(b => {
            b.addEventListener("click", async () => {
                const mode = b.dataset.mode;
                // collect params from current UI controls
                let params = {};
                if (mode === "rgb") {
                    const hex = els.colorPicker.value;
                    params = {
                        r: parseInt(hex.slice(1, 3), 16),
                        g: parseInt(hex.slice(3, 5), 16),
                        b: parseInt(hex.slice(5, 7), 16),
                        brightness: Number(els.brightnessInput.value) || undefined
                    };
                } else if (mode === "wave") {
                    // you can add a speed slider later; default 0.5 for now
                    params = { speed: 0.5, brightness: Number(els.brightnessInput.value) || undefined };
                } else if (mode === "hue") {
                    params = {}; // placeholder future custom mode
                }

                els.execResult.textContent = "Applying…";
                const r = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/state`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ mode, params, execute: true })
                });
                const j = await r.json().catch(() => ({}));
                els.execResult.textContent = r.ok ? `Mode set to ${mode}` : (j.error || "Failed");
            });
        });


        // Controls
        //els.controlPanel.innerHTML = "";
        const hasSetColor = d.actions?.some(a => a.action === "set_color");
        const hasBrightness = d.actions?.some(a => a.action === "set_brightness");

        if (hasSetColor) els.colorPickerWrap.style.display = "block";
        if (hasBrightness) els.brightnessWrap.style.display = "block";

        console.log(d.actions);
        (d.actions || []).forEach(a => {
            console.log("rendering actions: " + a.action);
            const btn = document.createElement("button");
            btn.className = "chip-btn";
            btn.textContent = actionLabel(a.action);
            btn.addEventListener("click", () => execAction(d.id, a.action));
            //els.controlPanel.appendChild(btn);
        });

        els.sendColor.addEventListener("click", () => {
            const hex = els.colorPicker.value; // #rrggbb
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            execAction(d.id, "set_color", { r, g, b });
        });

        els.sendBrightness.addEventListener("click", () => {
            const value = Number(els.brightnessInput.value);
            execAction(d.id, "set_brightness", { value });
        });
    }

    function actionLabel(key) {
        const map = {
            on: "Turn On",
            off: "Turn Off",
            set_color: "Set Color",
            set_brightness: "Brightness",
            vibrate: "Vibrate",
            notify: "Notify",
            read_value: "Read Value",
            open_url: "Open URL",
            write: "Write",
            read: "Read",
        };
        return map[key] || key;
    }

    async function execAction(id, action, params = {}) {
        els.execResult.textContent = "Working…";
        console.log("Action: " + (action) + " with param: " + params);
        try {
            const r = await fetch(`/api/device-actions/${encodeURIComponent(id)}/${(action)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ params }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error || "Failed");
            els.execResult.textContent = j.ok ? "OK. It worked aq" : JSON.stringify(j);
        } catch (e) {
            els.execResult.textContent = e.message || String(e);
        }
    }

    (async function init() {
        await loadSession();
        await loadDevice();
    })();
})();