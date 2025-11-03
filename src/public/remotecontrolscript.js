const mq = window.matchMedia("(min-width: 800px)");
if (mq.matches) {
    // 1. remove data-aos attributes so AOS won't animate
    document.querySelectorAll("[data-aos]").forEach(el => {
        el.removeAttribute("data-aos");
        el.style.opacity = ""; // optional: let it use normal styles
        el.style.transform = ""; // optional cleanup in case AOS touched it
    });

    // 2. stop AOS from doing anything else
    AOS.refreshHard = () => { };
    AOS.init = () => { };
}


// remotecontrolscript.js
(() => {
    AOS.init();

    const els = {
        deviceGrid: document.getElementById("deviceGrid"),
        emptyState: document.getElementById("emptyState"),
        emptyAddBtn: document.getElementById("emptyAddBtn"),
        filterKind: document.getElementById("filterKind"),
        filterStatus: document.getElementById("filterStatus"),
        searchInput: document.getElementById("searchInput"),
        modal: document.getElementById("deviceModal"),
        openModalBtn: document.getElementById("openDeviceModal"),
        cancelModal: document.getElementById("cancelModal"),
        deviceForm: document.getElementById("deviceForm"),
        kindKey: document.getElementById("kindKey"),
        displayName: document.getElementById("displayName"),
        meta: document.getElementById("meta"),
        modalError: document.getElementById("modalError"),
        usernameLabel: document.getElementById("usernameLabel"),
        realnameLabel: document.getElementById("realnameLabel"),
        roleLabel: document.getElementById("roleLabel"),
        authLabel: document.getElementById("authLabel")
    };

    // Map kind_key -> icon path (fallback to iot)
    const kindIcon = (kindKey) => {
        const map = {
            "led_strip": "../content/iotIconWhite.png",
            "motor": "../content/iotIconWhite.png",
            "sensor.temp": "../content/iotIconWhite.png",
            "sensor.motion": "../content/iotIconWhite.png",
            "laptop": "../content/laptopIconWhite.png",
            "phone": "../content/phoneIconWhite.png",
            "tablet": "../content/tabletIconWhite.png",
            "watch": "../content/watchIconWhite.png",
        };
        return map[kindKey] || "../content/iotIconWhite.png";
    };

    // Formatters
    const fmtDate = (iso) => {
        if (!iso) return "never";
        const d = new Date(iso);
        return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
    };

    let deviceKinds = [];
    let allDevices = [];

    async function loadSession() {
        try {
            const r = await fetch("/api/session", { credentials: "include" });
            if (!r.ok) throw 0;
            const s = await r.json();
            els.authLabel.textContent = s?.user ? "Logged in" : "Guest";
            els.usernameLabel.textContent = s?.user?.uname || s?.user?.name || "User";
            els.realnameLabel.textContent = s?.user?.realname || "";
            els.roleLabel.textContent = s?.user?.role || "";
        } catch {
            els.authLabel.textContent = "Guest";
        }
    }

    async function loadKinds() {
        const r = await fetch("/api/device-kinds", { credentials: "include" });
        if (!r.ok) return;
        deviceKinds = await r.json();

        // Fill kind filters
        for (const k of deviceKinds) {
            const o1 = document.createElement("option");
            o1.value = k.key;
            o1.textContent = k.label;
            els.filterKind.appendChild(o1);

            const o2 = document.createElement("option");
            o2.value = k.key;
            o2.textContent = `${k.label}${k.is_smart ? " (smart)" : ""}`;
            els.kindKey.appendChild(o2);
        }
    }

    async function loadDevices() {
        const r = await fetch("/api/devices", { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load devices");
        const data = await r.json();
        allDevices = data.items || [];
        render();
    }

    function applyFilters(devs) {
        const kind = els.filterKind.value.trim();
        const status = els.filterStatus.value.trim();
        const q = els.searchInput.value.trim().toLowerCase();

        return devs.filter(d => {
            if (kind && d.kind_key !== kind) return false;
            if (status && d.status !== status) return false;
            if (q && !d.display_name.toLowerCase().includes(q)) return false;
            return true;
        });
    }

    function capabilityBadges(caps) {
        if (!caps || !caps.length) return "";
        return caps.map(c => `<span class="cap-badge">${c}</span>`).join("");
    }

    function render() {
        const list = applyFilters(allDevices);

        els.deviceGrid.innerHTML = "";
        els.emptyState.style.display = list.length ? "none" : "flex";

        for (const d of list) {
            const card = document.createElement("article");
            card.className = "device-card";
            card.dataset.kind = d.kind_key;
            card.dataset.status = d.status;

            card.style.cursor = "pointer";
            card.addEventListener("click", (ev) => {
                // avoid interfering with future inner buttons if you add them back
                const target = ev.target;
                if (target.closest("[data-action]")) return; // let action buttons work if present
                // navigate to device-remote page with id param
                window.location.href = `/deviceremote.html?id=${encodeURIComponent(d.id)}`;
            });

            card.innerHTML = `
        <div class="device-card-head">
          <img src="${kindIcon(d.kind_key)}" alt="${d.kind_label}" />
          <div class="title-wrap">
            <h2 title="${d.display_name}">${d.display_name}</h2>
            <div class="muted">${d.kind_label}${d.is_smart ? " • smart" : ""}</div>
          </div>
          <span class="status-badge ${d.status === "online" ? "online" : "offline"}">
            ${d.status}
          </span>
          <div><span class="muted">Last seen:</span> ${fmtDate(d.last_seen)}</div>
        </div>
      `;

            //iptal: 
            //<div class="caps">${capabilityBadges(d.capabilities)}</div>
            //ve
            //<div class="device-actions">
            //  ${buildActionButtons(d.actions)}
            //  </div>

            // Attach demo handlers (no-op unless you add action endpoint)
            const btns = card.querySelectorAll("[data-action]");
            btns.forEach(b => {
                b.addEventListener("click", () => {
                    // Placeholder: wire to your executor endpoint later (e.g., /api/device-actions/:id/:action)
                    const action = b.dataset.action;
                    alert(`Action "${action}" clicked for ${d.display_name}`);
                });
            });

            els.deviceGrid.appendChild(card);
        }
    }

    function buildActionButtons(actions) {
        if (!actions || !actions.length) return `<div class="muted">No actions</div>`;
        return actions
            .map(a => {
                const label = actionLabel(a.action);
                return `<button class="chip-btn" data-action="${a.action}" title="${a.handlerKey}">${label}</button>`;
            })
            .join("");
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
            read: "Read"
        };
        return map[key] || key;
    }

    // Modal
    function openModal() { els.modal.showModal(); }
    function closeModal() { els.modal.close(); }

    els.openModalBtn?.addEventListener("click", openModal);
    els.emptyAddBtn?.addEventListener("click", openModal);
    els.cancelModal?.addEventListener("click", closeModal);

    els.deviceForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        els.modalError.textContent = "";

        try {
            const kindKey = els.kindKey.value;
            const displayName = els.displayName.value.trim();
            const metaText = els.meta.value.trim();
            let meta = {};

            if (!kindKey || !displayName) {
                els.modalError.textContent = "Kind and Display name are required.";
                return;
            }
            if (metaText) {
                try { meta = JSON.parse(metaText); }
                catch { els.modalError.textContent = "Meta must be valid JSON."; return; }
            }

            const r = await fetch("/api/devices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ kindKey, displayName, meta })
            });

            if (!r.ok) {
                const j = await r.json().catch(() => ({}));
                throw new Error(j.error || "Failed to create device");
            }

            // Refresh list and close
            await loadDevices();
            closeModal();
            els.deviceForm.reset();
        } catch (err) {
            els.modalError.textContent = err.message || String(err);
        }
    });

    // Filters
    els.filterKind?.addEventListener("change", render);
    els.filterStatus?.addEventListener("change", render);
    els.searchInput?.addEventListener("input", render);

    // Init
    (async function init() {
        await loadSession();
        await loadKinds();
        await loadDevices();
    })();
})();
