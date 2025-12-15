// Basic state
let currentFolderId = null;        // what you're currently viewing
let currentFolderName = "Root";
let pathStack = [];                // breadcrumbs for main view [{id,name}...]

let destFolderId = null;           // destination for upload; null = Root
let destFolderName = "Root";

// Modal picker state
let pickerFolderId = null;
let pickerStack = [];              // breadcrumbs inside modal

// --- DOM Elements ---
const storageList = document.getElementById("storageList");
const breadcrumbsEl = document.getElementById("breadcrumbs"); 
const storageBreadcrumbs = document.getElementById("storageBreadcrumbs");
const toastHost = document.getElementById("toastHost");
const dropZone = document.getElementById("dropZone");

const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const newFolderBtn = document.getElementById("newFolderBtn");

const destLabelEl = document.getElementById("destLabel");
const chooseDestBtn = document.getElementById("chooseDestBtn");

// Folder Picker Elements
const folderModal = document.getElementById("folderModal");
const closeFolderModal = document.getElementById("closeFolderModal");
const pickerBreadcrumbsEl = document.getElementById("folderPickerBreadcrumbs");
const pickerListEl = document.getElementById("folderPickerList");
const selectThisFolderBtn = document.getElementById("selectThisFolderBtn");

// Share Modal Elements
const shareModal = document.getElementById("shareModal");
const closeShareModal = document.getElementById("closeShareModal");
const shareLinkInput = document.getElementById("shareLinkInput");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const shareTabs = document.querySelectorAll(".tab-btn"); // To hide/show tabs

// --- Helpers ---
function setDestination(folderId, folderName) {
    destFolderId = folderId;
    destFolderName = folderName || "Root";
    if(destLabelEl) destLabelEl.textContent = destFolderName;
}

function sameId(a, b) {
    return (a || null) === (b || null);
}

function toast(type, message) {
    const el = document.createElement("div");
    el.className = `toast ${type === "ok" ? "ok" : "err"}`;
    el.textContent = message;
    toastHost.appendChild(el);

    setTimeout(() => {
        el.style.opacity = "0";
        el.style.transform = "translateY(6px)";
        setTimeout(() => el.remove(), 250);
    }, 2500);
}

function fmtSize(bytes) {
    if (bytes == null) return "";
    const u = ["B", "KB", "MB", "GB"];
    let i = 0;
    let v = Number(bytes);
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return (i === 0 ? v : v.toFixed(1)) + " " + u[i];
}

// --- API Wrappers ---

async function apiShare(itemId) {
    const r = await fetch("/api/storage/share/" + itemId, {
        method: "POST",
        credentials: "include",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "share failed");
    return j; // {url, token}
}

async function apiDelete(itemId) {
    const r = await fetch("/api/storage/item/" + itemId, {
        method: "DELETE",
        credentials: "include",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "delete failed");
    return j;
}

async function apiList(parentId) {
    const url = new URL("/api/storage/list", window.location.origin);
    if (parentId) url.searchParams.set("parentId", parentId);

    const r = await fetch(url, { credentials: "include" });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "list failed");
    return j.items;
}

async function apiCreateFolder(parentId, name) {
    const r = await fetch("/api/storage/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ parentId: parentId || null, name }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "create folder failed");
    return j.folder;
}

async function apiUpload(parentId, files) {
    const fd = new FormData();
    fd.append("parentId", parentId || "");
    for (const f of files) fd.append("files", f);

    const r = await fetch("/api/storage/upload", {
        method: "POST",
        credentials: "include",
        body: fd,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "upload failed");
    return j.uploaded;
}

// --- Context Menu ---
const ctxMenu = document.createElement("div");
ctxMenu.id = "ctxMenu";
ctxMenu.className = "ctx hidden";
ctxMenu.innerHTML = `
  <button data-action="share-public">Share Publicly</button>
  <button data-action="share-user">Share with User</button>
  <hr/>
  <button data-action="delete" class="danger">Delete</button>
`;
document.body.appendChild(ctxMenu);

let ctxTarget = null; // {id, name, is_folder}

function hideCtx() {
    ctxMenu.classList.add("hidden");
    ctxTarget = null;
}

document.addEventListener("click", hideCtx);
document.addEventListener("scroll", hideCtx, true);
window.addEventListener("resize", hideCtx);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideCtx(); });

ctxMenu.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn || !ctxTarget) return;

    const target = ctxTarget;
    const action = btn.dataset.action;
    
    hideCtx(); 

    try {
        if (action === "share-public") {
            openPublicShareModal(target);
        }

        if (action === "share-user") {
            // Functionality to be implemented later
            alert("Share with User functionality coming soon!");
        }

        if (action === "delete") {
            const ok = confirm(`Delete "${target.name}"? This cannot be undone.`);
            if (!ok) return;

            await apiDelete(target.id);
            toast("ok", "Deleted.");
            // Refresh current folder
            await openFolder(currentFolderId, currentFolderName, pathStack);
        }
    } catch (err) {
        toast("err", err.message);
    }
});

// --- Modal Logic ---

function openPublicShareModal(item) {
    if (!shareModal) return;
    shareModal.classList.remove("hidden");
    
    // Hide other tabs, show only public
    document.getElementById("tab-public")?.classList.remove("hidden");
    document.getElementById("tab-internal")?.classList.add("hidden");
    document.getElementById("tab-user-select")?.classList.add("hidden");
    
    // Visually update tabs if present
    shareTabs.forEach(t => {
        if(t.dataset.tab === 'public') t.classList.add('active');
        else t.classList.remove('active');
    });

    shareLinkInput.value = "Generating link...";

    // Generate Link Immediately
    apiShare(item.id).then(({ url }) => {
        const fullUrl = new URL(url, window.location.origin).toString();
        shareLinkInput.value = fullUrl;
    }).catch(err => {
        shareLinkInput.value = "Error generating link";
        toast("err", err.message);
    });

    // Inject "Stop Sharing" button logic if not already present
    // (We check if we already added it to avoid duplicates)
    let stopBtn = document.getElementById("stopSharingBtn");
    if(!stopBtn) {
        const container = document.getElementById("tab-public");
        stopBtn = document.createElement("button");
        stopBtn.id = "stopSharingBtn";
        stopBtn.className = "danger"; // Apply danger styling
        stopBtn.style.marginTop = "10px";
        stopBtn.style.width = "100%";
        stopBtn.style.padding = "10px";
        stopBtn.style.background = "rgba(255, 80, 80, 0.2)";
        stopBtn.style.border = "1px solid rgba(255, 80, 80, 0.5)";
        stopBtn.style.color = "#fff";
        stopBtn.style.cursor = "pointer";
        stopBtn.textContent = "Stop Sharing";
        container.appendChild(stopBtn);

        stopBtn.onclick = () => {
            // NOTE: Currently just clears UI. 
            // Needs backend API update to actually revoke token in DB.
            shareLinkInput.value = "";
            toast("ok", "Link removed (API update required for full revoke)");
            closeShareModal.click();
        };
    }
}

// Modal Event Listeners
if(closeShareModal) closeShareModal.addEventListener("click", () => shareModal.classList.add("hidden"));

if(copyLinkBtn) {
    copyLinkBtn.addEventListener("click", async () => {
        if (!shareLinkInput.value || shareLinkInput.value.startsWith("Error")) return;
        await navigator.clipboard.writeText(shareLinkInput.value);
        toast("ok", "Copied!");
    });
}


// --- Main View Rendering ---
function renderBreadcrumbs(stack) {
    const targets = [breadcrumbsEl, storageBreadcrumbs].filter(el => el);

    targets.forEach(el => {
        el.innerHTML = "";
        
        const rootBtn = document.createElement("button");
        rootBtn.type = "button";
        rootBtn.textContent = "Root";
        rootBtn.onclick = () => openFolder(null, "Root", []);
        el.appendChild(rootBtn);

        for (let i = 0; i < stack.length; i++) {
            const sep = document.createElement("span");
            sep.textContent = " / ";
            sep.className = "sep";
            el.appendChild(sep);

            const b = document.createElement("button");
            b.type = "button";
            b.textContent = stack[i].name;
            b.onclick = () => {
                const newStack = stack.slice(0, i + 1);
                openFolder(stack[i].id, stack[i].name, newStack);
            };
            el.appendChild(b);
        }
    });
}

function renderList(items) {
    if (!storageList) return;

    storageList.innerHTML = "";

    // Up navigation
    if (currentFolderId) {
        const upRow = document.createElement("div");
        upRow.className = "storage-row";
        upRow.innerHTML = `
      <div class="storage-left">
        <div class="storage-icon">↩</div>
        <div class="storage-name">..</div>
      </div>
      <div class="storage-meta">Up</div>
    `;
        upRow.onclick = () => {
            const newStack = pathStack.slice(0, -1);
            const parent = newStack.length ? newStack[newStack.length - 1] : null;
            openFolder(parent ? parent.id : null, parent ? parent.name : "Root", newStack);
        };
        storageList.appendChild(upRow);
    }

    if (!items || items.length === 0) {
        const empty = document.createElement("div");
        empty.style.opacity = "0.6";
        empty.style.padding = "12px 4px";
        empty.textContent = "Empty folder.";
        storageList.appendChild(empty);
        return;
    }

    for (const it of items) {
        const row = document.createElement("div");
        row.className = "storage-row";

        const icon = it.is_folder ? "📁" : "📄";
        const meta = it.is_folder ? "Folder" : fmtSize(it.size_bytes);

        row.innerHTML = `
      <div class="storage-left">
        <div class="storage-icon">${icon}</div>
        <div class="storage-name" title="${it.name}">${it.name}</div>
      </div>
      <div class="storage-meta">${meta}</div>
    `;

        row.onclick = () => {
            if (it.is_folder) {
                const newStack = [...pathStack, { id: it.id, name: it.name }];
                openFolder(it.id, it.name, newStack);
            } else {
                window.location.href = "/api/storage/file/" + it.id;
            }
        };

        row.addEventListener("contextmenu", (ev) => {
            ev.preventDefault();
            ctxTarget = { id: it.id, name: it.name, is_folder: it.is_folder };

            // Position menu
            ctxMenu.style.left = ev.pageX + "px";
            ctxMenu.style.top = ev.pageY + "px";
            ctxMenu.classList.remove("hidden");
        });

        storageList.appendChild(row);
    }
}

async function openFolder(folderId, folderName, stack) {
    currentFolderId = folderId || null;
    currentFolderName = folderName || "Root";
    pathStack = stack || [];

    renderBreadcrumbs(pathStack);

    if (sameId(destFolderId, currentFolderId) || (destFolderId === null && currentFolderId === null)) {
        setDestination(currentFolderId, currentFolderName);
    }

    try {
        const items = await apiList(currentFolderId);
        renderList(items);
    } catch (e) {
        toast("err", e.message);
    }
}


// --- Folder Picker & Upload Events ---
function openFolderModal() {
    folderModal.classList.remove("hidden");
    pickerFolderId = null;
    pickerStack = [];
    renderPickerBreadcrumbs();
    loadPickerFolder(null);
}

function closeModal() {
    folderModal.classList.add("hidden");
}

function renderPickerBreadcrumbs() {
    pickerBreadcrumbsEl.innerHTML = "";
    const rootBtn = document.createElement("button");
    rootBtn.type = "button";
    rootBtn.textContent = "Root";
    rootBtn.onclick = () => {
        pickerFolderId = null;
        pickerStack = [];
        renderPickerBreadcrumbs();
        loadPickerFolder(null);
    };
    pickerBreadcrumbsEl.appendChild(rootBtn);

    for (let i = 0; i < pickerStack.length; i++) {
        const sep = document.createElement("span");
        sep.textContent = " / ";
        pickerBreadcrumbsEl.appendChild(sep);
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = pickerStack[i].name;
        b.onclick = () => {
            pickerStack = pickerStack.slice(0, i + 1);
            pickerFolderId = pickerStack[i].id;
            renderPickerBreadcrumbs();
            loadPickerFolder(pickerFolderId);
        };
        pickerBreadcrumbsEl.appendChild(b);
    }
}

async function loadPickerFolder(folderId) {
    const items = await apiList(folderId);
    const folders = items.filter((x) => x.is_folder);
    pickerListEl.innerHTML = "";
    for (const f of folders) {
        const row = document.createElement("div");
        row.className = "row folder";
        row.textContent = "📁 " + f.name;
        row.onclick = () => {
            pickerFolderId = f.id;
            pickerStack.push({ id: f.id, name: f.name });
            renderPickerBreadcrumbs();
            loadPickerFolder(f.id);
        };
        pickerListEl.appendChild(row);
    }
    if (!folders.length) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "No subfolders here.";
        pickerListEl.appendChild(empty);
    }
}

if(chooseDestBtn) chooseDestBtn.addEventListener("click", openFolderModal);
if(closeFolderModal) closeFolderModal.addEventListener("click", closeModal);

if(selectThisFolderBtn) {
    selectThisFolderBtn.addEventListener("click", () => {
        const chosenId = pickerStack.length ? pickerStack[pickerStack.length - 1].id : null;
        const chosenName = pickerStack.length ? pickerStack[pickerStack.length - 1].name : "Root";
        setDestination(chosenId, chosenName);
        closeModal();
    });
}

if(uploadBtn) uploadBtn.addEventListener("click", () => fileInput.click());

if(fileInput) {
    fileInput.addEventListener("change", async () => {
        if (!fileInput.files?.length) return;
        await doUpload(fileInput.files);
        fileInput.value = "";
    });
}

if(newFolderBtn) {
    newFolderBtn.addEventListener("click", async () => {
        const name = prompt("Folder name:");
        if (!name) return;
        try {
            await apiCreateFolder(currentFolderId, name.trim());
            toast("ok", "Folder created.");
            await openFolder(currentFolderId, currentFolderName, pathStack);
        } catch (e) {
            toast("err", e.message);
        }
    });
}

if(dropZone) {
    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", async (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        const files = e.dataTransfer.files;
        if (!files || !files.length) return;
        await doUpload(files);
    });
}

async function doUpload(fileList) {
    try {
        const uploaded = await apiUpload(currentFolderId, fileList);
        toast("ok", `Uploaded ${uploaded.length} file(s).`);
        await openFolder(currentFolderId, currentFolderName, pathStack);
    } catch (e) {
        toast("err", e.message);
    }
}

// --- Initialize ---
openFolder(null, "Root", []);