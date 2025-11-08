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
        brightnessInput: document.getElementById("brightnessInputNEW"),
        sendBrightness: document.getElementById("sendBrightness"),

        usernameLabel: document.getElementById("usernameLabel"),
        realnameLabel: document.getElementById("realnameLabel"),
        roleLabel: document.getElementById("roleLabel"),
        authLabel: document.getElementById("authLabel"),
    };

    // --- Switch helpers ---
    const modeToIndex = { rgb: 0, wave: 1, hue: 2 };
    const indexToMode = ["rgb", "wave", "hue"];

    const switchEls = {
        container: document.querySelector(".switch-container"),
        slider: document.getElementById("switch-slider"),
        options: Array.from(document.querySelectorAll(".switch-option")),
        msg: document.getElementById("message-output"),
    };

    function moveSliderToIndex(index) {
        const containerWidth = switchEls.container.offsetWidth;
        const per = containerWidth / 3;
        const newPos = per * index + 4; // your 4px padding from earlier
        // prevent jank during resize auto-fix
        switchEls.slider.style.transform = `translateX(${newPos}px)`;
    }

    function setActiveIndex(index) {
        switchEls.options.forEach(o => o.classList.remove("active"));
        const btn = switchEls.options[index];
        if (btn) btn.classList.add("active");
        moveSliderToIndex(index);
    }

    function currentParamsForMode(mode) {
        if (mode === "rgb") {
            const hex = els.colorPicker.value || "#ffffff";
            return {
                r: parseInt(hex.slice(1, 3), 16),
                g: parseInt(hex.slice(3, 5), 16),
                b: parseInt(hex.slice(5, 7), 16),
                brightness: Number(els.brightnessInput.value) || undefined,
            };
        }
        if (mode === "wave") {
            return { speed: 0.5, brightness: Number(els.brightnessInput.value) || undefined };
        }
        // hue: you’ll implement later
        return {};
    }

    function applyModeUI(mode) {
        // Show/hide controls to match mode
        const isRgb = mode === "rgb";
        const hasBrightness = (mode === "rgb" || mode === "wave"); // both support brightness if you want
        els.colorPickerWrap.style.display = isRgb ? "grid" : "none";
        els.brightnessWrap.style.display = hasBrightness ? "block" : "none";
        switchEls.msg.textContent = `Mode: ${mode.toUpperCase()}`;
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

        // INIT switch from server mode
        const initIndex = modeToIndex[currentMode] ?? 0;
        setActiveIndex(initIndex);
        applyModeUI(currentMode);

        // Hook up option clicks → PATCH state
        switchEls.options.forEach(opt => {
            opt.addEventListener("click", async () => {
                const idx = Number(opt.dataset.index || 0);
                const mode = indexToMode[idx];

                setActiveIndex(idx);
                applyModeUI(mode);

                // Build params from current UI and PATCH
                const params = currentParamsForMode(mode);
                els.execResult.textContent = "Applying…";
                try {
                    const r = await fetch(`/api/devices/${encodeURIComponent(d.id)}/state`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ mode, params, execute: true }),
                    });
                    const j = await r.json().catch(() => ({}));
                    if (!r.ok) throw new Error(j.error || "Failed");
                    els.execResult.textContent = `Mode set to ${mode}`;
                    // reflect in subtitle too
                    els.deviceSub.textContent = `${d.kind_label}${d.is_smart ? " • smart" : ""} • ${mode.toUpperCase()}`;
                } catch (e) {
                    els.execResult.textContent = e.message || String(e);
                }
            });
        });

        // Keep slider aligned on resize
        window.addEventListener("resize", () => {
            const active = document.querySelector(".switch-option.active");
            const idx = active ? Number(active.dataset.index || 0) : 0;
            // briefly disable transition if you set one in CSS
            const prev = switchEls.slider.style.transition;
            switchEls.slider.style.transition = "none";
            moveSliderToIndex(idx);
            setTimeout(() => { switchEls.slider.style.transition = prev || "transform 0.3s ease-in-out"; }, 50);
        });

        // Existing controls (color/brightness/on/off) remain:
        const hasSetColor = d.actions?.some(a => a.action === "set_color");
        const hasBrightness = d.actions?.some(a => a.action === "set_brightness");
        if (hasSetColor) els.colorPickerWrap.style.display = "grid";
        if (hasBrightness) els.brightnessWrap.style.display = "block";

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
            }, 150); // waits 150ms after you stop moving
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





const options = document.querySelectorAll('.switch-option');
const slider = document.getElementById('switch-slider');
const messageOutput = document.getElementById('message-output');
const container = document.querySelector('.switch-container');

// Add a click event listener to each option button
options.forEach(option => {
    option.addEventListener('click', () => {
        // Get the index (0, 1, or 2) from the data-index attribute
        const index = parseInt(option.dataset.index, 10);

        // Calculate the horizontal position for the slider
        // We divide the container width by 3 and multiply by the index
        const containerWidth = container.offsetWidth;
        const sliderWidth = slider.offsetWidth;

        // Calculate position for the slider.
        // We add a small 4px padding on the left, and (4px * index) for padding between elements
        const newPosition = (containerWidth / 3) * index + 4;

        // Move the slider
        slider.style.transform = `translateX(${newPosition}px)`;

        // Update the 'active' class
        // 1. Remove 'active' from all options
        options.forEach(opt => opt.classList.remove('active'));
        // 2. Add 'active' to the one that was clicked
        option.classList.add('active');

        // --- THIS IS THE TRIGGER ---
        // You can replace this with any function you want to call
        handleTrigger(option.textContent);
    });
});

/**
 * This function is called when a switch option is pressed.
 * @param {string} optionName - The text content of the clicked option.
 */
function handleTrigger(optionName) {
    console.log(`Trigger activated for: ${optionName}`);

    // Update the message on the page
    messageOutput.textContent = `Trigger: ${optionName} Activated!`;

    // ---
    // Example: You could put a switch statement here
    // ---
    // switch(optionName.trim()) {
    //     case 'Option 1':
    //         // doSomethingForOption1();
    //         break;
    //     case 'Option 2':
    //         // doSomethingForOption2();
    //         break;
    //     case 'Option 3':
    //         // doSomethingForOption3();
    //         break;
    // }
}

// Adjust slider on window resize to keep it aligned
window.addEventListener('resize', () => {
    const activeOption = document.querySelector('.switch-option.active');
    if (activeOption) {
        const index = parseInt(activeOption.dataset.index, 10);
        const containerWidth = container.offsetWidth;
        const newPosition = (containerWidth / 3) * index + 4;

        // Set transition to 'none' during resize to avoid janky movement
        slider.style.transition = 'none';
        slider.style.transform = `translateX(${newPosition}px)`;

        // Re-enable transition after a short delay
        setTimeout(() => {
            slider.style.transition = 'transform 0.3s ease-in-out';
        }, 50);
    }
});