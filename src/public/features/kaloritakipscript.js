let currentRange = 30;
let editState = null;
let existingEntryDates = new Set(); 

// ---------- helpers ----------
function getLocalISODate(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
}

async function safeFetchJSON(input, init) {
  const res = await fetch(input, init);
  const text = await res.text();
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    console.error('Expected JSON but got:', ct, '\nPayload:\n', text.slice(0, 500));
    throw new Error(`${res.status} ${res.statusText} (non-JSON response)`);
  }
  const data = JSON.parse(text);
  if (!res.ok) throw new Error(data?.error || `${res.status} ${res.statusText}`);
  return data;
}

function formatDateShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function formatDateLong(iso) {
  const d = new Date(iso);
  // e.g. "Sat, 01 Nov 2025"
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  });
}

function toYMD(input) {
  if (!input) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    console.error('Invalid date input:', input);
    return null;
  }
  
  return getLocalISODate(d);
}


// ---------- modal open/close (single source of truth) ----------
function openWeightModalAdd() {
  editState = null;

  const m = document.getElementById('weightModal');
  m.classList.add('show');
  document.body.classList.add('body--lock');

  const title = document.getElementById('weightModalTitle');
  if (title) title.textContent = 'Add Weight';

  const wDate = document.getElementById('wDate');
  const readout = document.getElementById('wDateReadout');
  const opts = document.querySelector('.dateOptionsHolder');

  if (wDate) {
    wDate.removeAttribute('disabled');
    wDate.style.display = '';
    wDate.removeAttribute('aria-hidden');
    if (!wDate.value) wDate.value = getLocalISODate(new Date());
  }
  if (readout) {
    readout.hidden = true;
    readout.textContent = '';
  }
  if (opts) opts.style.display = '';

  document.getElementById('suggestionsholder').style.display = 'grid';
  document.getElementById('wKg').value = '';
  document.getElementById('wNote').value = '';
  setTimeout(() => document.getElementById('wKg')?.focus(), 60);
}


function openWeightModalEdit(entry) {
  // Normalize entry.entry_date to 'YYYY-MM-DD'
  const ymd = toYMD(entry.entry_date) || String(entry.entry_date).slice(0, 10);

  editState = ymd; // <— this is what goes into /api/weight/:date

  const m = document.getElementById('weightModal');
  m.classList.add('show');
  document.body.classList.add('body--lock');

  const title = document.getElementById('weightModalTitle');
  if (title) title.textContent = 'Edit Weight';

  const wDate = document.getElementById('wDate');
  const readout = document.getElementById('wDateReadout');
  const opts = document.querySelector('.dateOptionsHolder');

  if (wDate) {
    wDate.value = ymd;                 // keep input holding date-only
    wDate.setAttribute('disabled', 'disabled');
    wDate.style.display = 'none';
    wDate.setAttribute('aria-hidden', 'true');
  }
  if (readout) {
    readout.textContent = formatDateLong(ymd);
    readout.hidden = false;
  }
  if (opts) opts.style.display = 'none';

  const wKg = document.getElementById('wKg');
  const wNote = document.getElementById('wNote');
  if (wKg) wKg.value = Number(entry.weight_kg).toFixed(1);
  if (wNote) wNote.value = entry.note ?? '';

  setTimeout(() => wKg?.focus(), 60);
}


function closeWeightModal() {
  const m = document.getElementById('weightModal');
  if (!m) return;
  m.classList.remove('show');
  document.body.classList.remove('body--lock');

  // reset mode bits
  editState = null;

  const wDate = document.getElementById('wDate');
  const readout = document.getElementById('wDateReadout');
  const opts = document.querySelector('.dateOptionsHolder');

  if (wDate) {
    wDate.removeAttribute('disabled');
    wDate.style.display = '';
    wDate.removeAttribute('aria-hidden');
  }
  if (readout) {
    readout.hidden = true;
    readout.textContent = '';
  }
  if (opts) opts.style.display = '';

  const title = document.getElementById('weightModalTitle');
  if (title) title.textContent = 'Add Weight';
}


// ---------- API ----------
async function uploadWeight({ weightKg, date = null, note = '', source = 'manual' }) {
  if (typeof weightKg !== 'number' || !isFinite(weightKg)) {
    throw new Error('Please enter a valid number for weight.');
  }
  const entry_date = date;
  return safeFetchJSON('/api/weight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ weightKg, entry_date, note, source })
  });
}

async function patchWeight(date, { weightKg, note, source = 'manual' } = {}) {
  const ymd = toYMD(date);
  if (!ymd) throw new Error('Invalid date');

  const body = {};
  if (weightKg !== undefined && weightKg !== null) body.weightKg = Number(weightKg);
  if (note !== undefined) body.note = String(note);
  if (source !== undefined) body.source = String(source);

  console.log('PATCH sending:', { ymd, body }); // Add this for debugging

  return safeFetchJSON(`/api/weight/${ymd}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
}

async function fetchAndRender(days = currentRange) {
  currentRange = days;
  try {
    const data = await safeFetchJSON(`/api/weights?days=${days}`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    // Build fast lookup for duplicate date check
    existingEntryDates = new Set(
      (data.items ?? []).map(r => toYMD(r.entry_date)).filter(Boolean)
    );

    renderWeightChartFromItems(data.items);
    renderWeightsList(data.items);

    const label = document.querySelector('.chart-controls label');
    if (label && data?.range?.start && data?.range?.end) {
      label.title = `From ${data.range.start} to ${data.range.end}`;
    }
  } catch (err) {
    console.error(err);
    showChartEmptyState(err.message || 'Failed to load data');
  }
}


// ---------- chart & list ----------
function renderWeightChartFromItems(items = []) {
  const wrap = document.querySelector('.chart-wrap');
  const canvas = document.getElementById('weightChart');
  if (!wrap || !canvas) return;

  if (!Array.isArray(items) || items.length === 0) {
    showChartEmptyState('No data in this range yet.');
    if (window.weightChartInstance) {
      window.weightChartInstance.destroy();
      window.weightChartInstance = null;
    }
    return;
  }

  const labels = items.map(r => {
    const d = new Date(r.entry_date);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  });
  const weights = items.map(r => Number(r.weight_kg));

  const ctx = canvas.getContext('2d');
  if (window.weightChartInstance) window.weightChartInstance.destroy();

  window.weightChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Weight (kg)',
        data: weights,
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 0,
        borderColor: '#52c471',
        // FIX: green when weight DROPS, red when it RISES
        segment: {
          borderColor: c => {
            const i0 = c.p0DataIndex, i1 = c.p1DataIndex;
            const prev = weights[i0], next = weights[i1];
            if (next < prev) return 'rgb(0,200,0)';   // down = green
            if (next > prev) return 'rgb(220,0,0)';   // up   = red
            return '#aaa';
          }
        }
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: { ticks: { maxRotation: 0, autoSkip: true, color: '#ccc' }, grid: { display: false } },
        y: { beginAtZero: false, ticks: { color: '#ccc' }, grid: { color: 'rgba(255,255,255,.08)' } }
      },
      plugins: {
        legend: { labels: { color: '#fff' } },
        tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} kg` } }
      },
      animation: { duration: 260 },
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2)
    }
  });

  const oldEmpty = wrap.querySelector('.chart-empty');
  if (oldEmpty) oldEmpty.remove();
}

function showChartEmptyState(message) {
  const wrap = document.querySelector('.chart-wrap');
  if (!wrap) return;
  let empty = wrap.querySelector('.chart-empty');
  if (!empty) {
    empty = document.createElement('div');
    empty.className = 'chart-empty';
    Object.assign(empty.style, {
      position: 'absolute', inset: '0', display: 'grid', placeItems: 'center',
      color: '#bbb', fontSize: '0.95rem', textAlign: 'center', pointerEvents: 'none', padding: '1rem'
    });
    wrap.style.position = 'relative';
    wrap.appendChild(empty);
  }
  empty.textContent = message;
}

function renderWeightsList(items = []) {
  const lower = document.querySelector('.mainfglowerholder');
  if (!lower) return;

  lower.innerHTML = '';
  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'routeoption';
    empty.textContent = 'No entries in this range yet.';
    lower.appendChild(empty);
    return;
  }

  const reversed = [...items].reverse(); // newest first

  for (let i = 0; i < reversed.length; i++) {
    const cur = reversed[i];
    const prev = i > 0 ? reversed[i - 1] : null;

    const kg = Number(cur.weight_kg);
    const delta = prev ? kg - Number(prev.weight_kg) : 0;
    const deltaStr = prev ? (delta > 0 ? `+${delta.toFixed(1)} kg` : `${delta.toFixed(1)} kg`) : '—';

    // FIX: up = red chip, down = green chip
    let chipClass = 'chip-flat';
    if (prev) chipClass = delta > 0 ? 'chip-down' : (delta < 0 ? 'chip-up' : 'chip-flat');

    const card = document.createElement('div');
    card.className = 'routeoption';
    card.setAttribute('data-aos', 'fade-up');
    card.innerHTML = `
      <div class="weight-row">
        <div class="date">${formatDateShort(cur.entry_date)}</div>
        <div class="kg">${kg.toFixed(1)} kg</div>
      </div>
      <div class="meta-row">
        <span class="chip ${chipClass}">${deltaStr}</span>
        ${cur.note ? `<span class="note">• ${cur.note}</span>` : ''}
        ${cur.source ? `<span class="source">• ${cur.source}</span>` : ''}
        <button class="btn btn--ghost btn--sm edit-btn" style="margin-left:auto; min-height:10px">Edit</button>
      </div>
    `;
    lower.appendChild(card);
    card.querySelector('.edit-btn')?.addEventListener('click', () => openWeightModalEdit(cur));
    card.addEventListener('dblclick', () => openWeightModalEdit(cur));
  }

  if (window.AOS?.refreshHard) AOS.refreshHard();

  const mq = window.matchMedia("(min-width: 800px)");
  if (mq.matches) {
    document.querySelectorAll("[data-aos]").forEach(el => {
      el.removeAttribute("data-aos");
      el.style.opacity = "";
      el.style.transform = "";
    });
    AOS.refreshHard = () => {};
    AOS.init = () => {};
  }
}

// ---------- profile fill ----------
async function loadProfile() {
  try {
    const res = await fetch("/meinfo", { method: "GET", credentials: "include" });
    if (!res.ok) {
      if (res.status === 401) window.location.href = "/login";
      return;
    }
    const profile = await res.json();
    document.getElementById("usernameLabel").textContent = profile.username;
    document.getElementById("roleLabel").textContent = profile.role;
    document.getElementById("realnameLabel").textContent = profile.realName;
    // optional: mirror into big title if you want
    const titleName = document.getElementById("titleRealName");
    if (titleName) titleName.textContent = "Weights";
  } catch (err) {
    console.error("Failed to load profile:", err);
  }
}

// ---------- bootstrap (single DOMContentLoaded) ----------
window.addEventListener('DOMContentLoaded', () => {
  // AOS & reduced animations on desktop
  AOS.init();
  const mq = window.matchMedia("(min-width: 800px)");
  if (mq.matches) {
    document.querySelectorAll("[data-aos]").forEach(el => {
      el.removeAttribute("data-aos");
      el.style.opacity = "";
      el.style.transform = "";
    });
    AOS.refreshHard = () => {};
    AOS.init = () => {};
  }

  // open/close hooks
  document.getElementById('openWeightModal')?.addEventListener('click', openWeightModalAdd);
  document.querySelectorAll('#weightModal [data-close]').forEach(el => el.addEventListener('click', closeWeightModal));
  document.querySelector('#weightModal .modal__backdrop')?.addEventListener('click', closeWeightModal, { passive: true });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeWeightModal(); });

  // date shifters
  const holder = document.querySelector('.dateOptionsHolder');
  const wDate = document.getElementById('wDate');
  if (holder && wDate) {
    holder.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const shift = parseInt(btn.dataset.shift ?? '0', 10);
      let base = wDate.value ? new Date(wDate.value) : new Date();
      if (Number.isNaN(base.getTime())) base = new Date();
      if (shift === 0) {
        wDate.value = getLocalISODate(new Date());
      } else {
        base.setDate(base.getDate() + shift);
        wDate.value = getLocalISODate(base);
      }
    });
  }

  // suggestions → note field
  const weightNoteInput = document.getElementById('wNote');
  document.querySelectorAll('.suggestionsholder button').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (weightNoteInput) weightNoteInput.value = btn.textContent;
    });
  });

  // range select
  const select = document.getElementById('rangeSelect');
  if (select) {
    currentRange = parseInt(select.value, 10) || 30;
    select.addEventListener('change', (e) => {
      const days = parseInt(e.target.value, 10) || 30;
      fetchAndRender(days);
    });
  }

  // single form submit handler
document.getElementById('weightForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const weightKg = parseFloat(document.getElementById('wKg').value);
    const dateRaw  = document.getElementById('wDate').value || null;
    const note     = document.getElementById('wNote').value || '';
    const ymd      = toYMD(dateRaw);

    if (!ymd) throw new Error('Invalid date');

    if (!editState) {
      // ADD mode: warn if there is an entry for that exact date in the loaded range
      //if (existingEntryDates.has(ymd)) {
      //  const proceed = confirm(
      //    `You already have an entry for ${formatDateLong(ymd)}.\n` +
      //    `Adding again may overwrite/duplicate depending on server rules.\n\n` +
      //    `Do you want to continue?`
      //  );
       // if (!proceed) return; // stop submission
      ///}
      await uploadWeight({ weightKg, date: ymd, note, source: 'manual' });
    } else {
      // EDIT mode
      await patchWeight(editState, { weightKg, note, source: 'manual' });
    }

    closeWeightModal();
    await fetchAndRender(currentRange);
  } catch (err) {
    console.error('Save failed:', err);
    alert(err.message || 'Failed to save weight entry');
  }
});


  // first load
  loadProfile();
  fetchAndRender(currentRange);
});


