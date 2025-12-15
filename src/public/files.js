// Basic state
let currentFolderId = null;        
let currentFolderName = "Root";
let pathStack = [];                

let destFolderId = null;           
let destFolderName = "Root";

// Modal picker state
let pickerFolderId = null;
let pickerStack = [];              

// Preview State
let previewableItems = []; // List of files in current folder
let currentPreviewIndex = -1;

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
const shareTabs = document.querySelectorAll(".tab-btn");

// Preview Modal Elements
const previewModal = document.getElementById("previewModal");
const closePreviewModal = document.getElementById("closePreviewModal");
const previewTitle = document.getElementById("previewTitle");
const previewContent = document.getElementById("previewContent");
const previewDownloadBtn = document.getElementById("previewDownloadBtn");
const prevFileBtn = document.getElementById("prevFileBtn");
const nextFileBtn = document.getElementById("nextFileBtn");


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
    return j; 
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

let ctxTarget = null; 

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
        if (action === "share-public") openPublicShareModal(target);
        if (action === "share-user") alert("Share with User functionality coming soon!");
        if (action === "delete") {
            const ok = confirm(`Delete "${target.name}"? This cannot be undone.`);
            if (!ok) return;
            await apiDelete(target.id);
            toast("ok", "Deleted.");
            await openFolder(currentFolderId, currentFolderName, pathStack);
        }
    } catch (err) {
        toast("err", err.message);
    }
});

// --- Modals ---
function openPublicShareModal(item) {
    if (!shareModal) return;
    shareModal.classList.remove("hidden");
    document.getElementById("tab-public")?.classList.remove("hidden");
    document.getElementById("tab-internal")?.classList.add("hidden");
    document.getElementById("tab-user-select")?.classList.add("hidden");
    
    shareTabs.forEach(t => {
        if(t.dataset.tab === 'public') t.classList.add('active');
        else t.classList.remove('active');
    });

    shareLinkInput.value = "Generating link...";

    apiShare(item.id).then(({ url }) => {
        const fullUrl = new URL(url, window.location.origin).toString();
        shareLinkInput.value = fullUrl;
    }).catch(err => {
        shareLinkInput.value = "Error generating link";
        toast("err", err.message);
    });

    let stopBtn = document.getElementById("stopSharingBtn");
    if(!stopBtn) {
        const container = document.getElementById("tab-public");
        stopBtn = document.createElement("button");
        stopBtn.id = "stopSharingBtn";
        stopBtn.className = "danger";
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
            shareLinkInput.value = "";
            toast("ok", "Link removed (API update required for full revoke)");
            closeShareModal.click();
        };
    }
}

if(closeShareModal) closeShareModal.addEventListener("click", () => shareModal.classList.add("hidden"));
if(copyLinkBtn) {
    copyLinkBtn.addEventListener("click", async () => {
        if (!shareLinkInput.value || shareLinkInput.value.startsWith("Error")) return;
        await navigator.clipboard.writeText(shareLinkInput.value);
        toast("ok", "Copied!");
    });
}

// --- Preview Modal Logic ---
function openPreview(item) {
    if (!previewModal) return;

    // Synchronize index
    if (previewableItems.length > 0) {
        currentPreviewIndex = previewableItems.findIndex(x => x.id === item.id);
    } else {
        previewableItems = [item];
        currentPreviewIndex = 0;
    }
    
    renderPreviewContent(item);
    previewModal.classList.remove("hidden");
}

function renderPreviewContent(item) {
    previewTitle.textContent = item.name;
    const fileUrl = "/api/storage/file/" + item.id;
    const previewUrl = fileUrl + "?preview=1"; 
    const mime = item.mime_type || "";

    // Set download link
    previewDownloadBtn.href = fileUrl;

    let html = "";
    if (mime.startsWith('image/')) {
        html = `<img src="${previewUrl}" class="preview-media" alt="Preview">`;
    } else if (mime.startsWith('video/')) {
        html = `<video controls src="${previewUrl}" class="preview-media" autoplay muted></video>`;
    } else if (mime.startsWith('audio/')) {
        html = `<audio controls src="${previewUrl}" class="preview-audio"></audio>`;
    } else if (mime === 'application/pdf') {
        html = `<iframe src="${previewUrl}" class="preview-pdf"></iframe>`;
    } else {
        html = `<div class="preview-fallback"><i class="fas fa-file-alt"></i><p>Preview not available for this file type.</p></div>`;
    }

    previewContent.innerHTML = html;
}

function navigatePreview(direction) {
    if (!previewableItems || previewableItems.length === 0) return;

    let newIndex = currentPreviewIndex + direction;

    if (newIndex < 0) {
        newIndex = previewableItems.length - 1;
    } else if (newIndex >= previewableItems.length) {
        newIndex = 0;
    }

    currentPreviewIndex = newIndex;
    renderPreviewContent(previewableItems[currentPreviewIndex]);
}

function closePreview() {
    previewModal.classList.add("hidden");
    previewContent.innerHTML = ""; // Stop media playback
}

// Preview Event Listeners
if(closePreviewModal) closePreviewModal.addEventListener("click", closePreview);
if(prevFileBtn) prevFileBtn.addEventListener("click", () => navigatePreview(-1));
if(nextFileBtn) nextFileBtn.addEventListener("click", () => navigatePreview(1));

if(previewModal) {
    previewModal.addEventListener("click", (e) => {
        if(e.target === previewModal) closePreview();
    });
}
document.addEventListener("keydown", (e) => {
    if(!previewModal.classList.contains("hidden")) {
        if(e.key === "Escape") closePreview();
        if(e.key === "ArrowLeft") navigatePreview(-1);
        if(e.key === "ArrowRight") navigatePreview(1);
    }
});


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

        let iconHtml;
        if (it.is_folder) {
            iconHtml = '<div class="storage-icon">📁</div>';
        } else if (it.mime_type && it.mime_type.startsWith('image/')) {
             // Request optimized thumbnail (width=64)
             iconHtml = `<img src="/api/storage/file/${it.id}?preview=1&w=64" class="storage-icon-img" alt="icon" loading="lazy" />`;
        } else {
             iconHtml = '<div class="storage-icon">📄</div>';
        }

        const meta = it.is_folder ? "Folder" : fmtSize(it.size_bytes);

        row.innerHTML = `
      <div class="storage-left">
        ${iconHtml}
        <div class="storage-name" title="${it.name}">${it.name}</div>
      </div>
      <div class="storage-meta">${meta}</div>
    `;

        row.onclick = () => {
            if (it.is_folder) {
                const newStack = [...pathStack, { id: it.id, name: it.name }];
                openFolder(it.id, it.name, newStack);
            } else {
                openPreview(it);
            }
        };

        row.addEventListener("contextmenu", (ev) => {
            ev.preventDefault();
            ctxTarget = { id: it.id, name: it.name, is_folder: it.is_folder };
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
        
        // populate previewable items list (exclude folders)
        previewableItems = items.filter(i => !i.is_folder);
        
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

async function loadProfile() {
  try {
    const res = await fetch("/meinfo", { method: "GET", credentials: "include" });
    const profile = await res.json();

    const pic = document.querySelector('.profilepic');
    if (pic) {
        if (profile.profilePic){
            pic.src = `/media/${profile.profilePic}`;
        }
        else{
            pic.src = 'content/deafult.jpg';
        } 
    } else {
        window.location.pathname = "/login/";
    }
    
    document.getElementById("usernameLabel").textContent = profile.username;
  } catch (err) {
    console.error("Failed to load profile:", err);
  }
}
loadProfile();
// --- Initialize ---
openFolder(null, "Root", []);