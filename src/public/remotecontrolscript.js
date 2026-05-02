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

    const kindIcon = (kindKey) => {
        const map = {
            "led_strip": "../content/iotIconWhite.png",
            "laptop": "../content/laptopIconWhite.png",
            "phone": "../content/phoneIconWhite.png",
            "tablet": "../content/tabletIconWhite.png",
            "watch": "../content/watchIconWhite.png",
        };
        return map[kindKey] || "../content/iotIconWhite.png";
    };

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

    // Add these to the `els` object at the top of the file:
    const pairEls = {
        openPairBtn: document.getElementById("openPairModal"),
        cancelPairBtn: document.getElementById("cancelPairModal"),
        modal: document.getElementById("pairModal"),
        form: document.getElementById("pairForm"),
        kindKey: document.getElementById("pairKindKey"),
        code: document.getElementById("pairCode"),
        displayName: document.getElementById("pairDisplayName"),
        error: document.getElementById("pairModalError")
    };

    // Add to your current `loadKinds` function to populate the pairing dropdown:
    async function loadKinds() {
        const r = await fetch("/api/device-kinds", { credentials: "include" });
        if (!r.ok) return;
        deviceKinds = await r.json();

        els.filterKind.innerHTML = `<option value="">All kinds</option>`;
        els.kindKey.innerHTML = ``;
        pairEls.kindKey.innerHTML = ``; // Populate the pair modal select

        for (const k of deviceKinds) {
            const o1 = document.createElement("option");
            o1.value = k.key;
            o1.textContent = k.label;
            els.filterKind.appendChild(o1);

            const o2 = document.createElement("option");
            o2.value = k.key;
            o2.textContent = `${k.label}${k.is_smart ? " (smart)" : ""}`;
            els.kindKey.appendChild(o2);

            // Pair modal option
            const o3 = o2.cloneNode(true);
            pairEls.kindKey.appendChild(o3);
        }
    }

    // Modal Toggle Handlers
    pairEls.openPairBtn?.addEventListener("click", () => {
        if (pairEls.modal) {
            pairEls.error.textContent = "";
            pairEls.modal.showModal();
        }
    });

    pairEls.cancelPairBtn?.addEventListener("click", () => {
        if (pairEls.modal) pairEls.modal.close();
    });

    // Form submission handler
    pairEls.form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        pairEls.error.textContent = "";

        try {
            const code = pairEls.code.value.trim();
            const displayName = pairEls.displayName.value.trim();
            const kindKey = pairEls.kindKey.value;

            const r = await fetch("/api/pairing/claim-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ code, displayName, kindKey })
            });

            if (!r.ok) {
                const j = await r.json().catch(() => ({}));
                throw new Error(j.error || "Failed to pair device");
            }

            await loadDevices();
            if (pairEls.modal) pairEls.modal.close();
            pairEls.form.reset();
        } catch (err) {
            pairEls.error.textContent = err.message || String(err);
        }
    });

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

    function render() {
        const list = applyFilters(allDevices);
        els.deviceGrid.innerHTML = "";
        els.emptyState.style.display = list.length ? "none" : "flex";

        for (const d of list) {
            const card = document.createElement("article");
            card.className = "device-card";
            card.style.cursor = "pointer";

            card.addEventListener("click", (ev) => {
                if (ev.target.closest("[data-action]")) return;
                window.location.href = `/deviceremote.html?id=${encodeURIComponent(d.id)}`;
            });

            card.innerHTML = `
                <div class="device-card-head">
                  <img src="${kindIcon(d.kind_key)}" alt="${d.kind_label}" />
                  <div class="title-wrap">
                    <h2 title="${d.display_name}">${d.display_name}</h2>
                    <div class="muted" style="font-size:1.2rem;">${d.kind_label}${d.is_smart ? " • smart" : ""}</div>
                  </div>
                  <span class="status-badge ${d.status === "online" ? "online" : "offline"}">
                    ${d.status}
                  </span>
                  <div style="font-size:1.2rem;"><span class="muted">Last seen:</span> ${fmtDate(d.last_seen)}</div>
                </div>
            `;
            els.deviceGrid.appendChild(card);
        }
    }

    function openModal() {
        if (els.modal) {
            els.modalError.textContent = "";
            els.modal.showModal();
        }
    }
    function closeModal() {
        if (els.modal) els.modal.close();
    }

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

            await loadDevices();
            closeModal();
            els.deviceForm.reset();
        } catch (err) {
            els.modalError.textContent = err.message || String(err);
        }
    });

    els.filterKind?.addEventListener("change", render);
    els.filterStatus?.addEventListener("change", render);
    els.searchInput?.addEventListener("input", render);

    (async function init() {
        await loadSession();
        await loadKinds();
        await loadDevices();
    })();
})();