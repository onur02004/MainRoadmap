let currentRange = 30;


function openWeightModal() {
    const m = document.getElementById('weightModal');
    m.classList.add('show');
    document.body.classList.add('body--lock');

    // Use the helper to set default date to *today local*
    const isoLocal = getLocalISODate(new Date());
    const wDate = document.getElementById('wDate');
    if (wDate && !wDate.value) wDate.value = isoLocal;

    // focus weight input after paint
    setTimeout(() => document.getElementById('wKg')?.focus(), 60);
}

function closeWeightModal() {
    const m = document.getElementById('weightModal');
    m.classList.remove('show');
    document.body.classList.remove('body--lock');
}

// open/close bindings
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openWeightModal')?.addEventListener('click', openWeightModal);
    document.querySelectorAll('#weightModal [data-close]').forEach(el => el.addEventListener('click', closeWeightModal));

    // close on backdrop tap
    document.querySelector('#weightModal .modal__backdrop')?.addEventListener('click', closeWeightModal, { passive: true });

    // ESC
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeWeightModal(); });

    // submit handler (uses your uploadWeight function from before)
    document.getElementById('weightForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const weightKg = parseFloat(document.getElementById('wKg').value);
            const date = document.getElementById('wDate').value || null;
            const note = document.getElementById('wNote').value || '';
            await uploadWeight({ weightKg, date, note }); // same as earlier
            closeWeightModal();
            await fetchAndRender(currentRange);
        } catch (err) {
            alert(err.message || 'Failed to save');
        }
    });
});


function closeWeightModal() {
    const m = document.getElementById('weightModal');
    if (!m) return;
    m.classList.remove('show');
    document.body.classList.remove('body--lock');
}

// Bind open/close on load
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openWeightModal')?.addEventListener('click', openWeightModal);

    // Close on backdrop or any [data-close]
    document.querySelectorAll('#weightModal [data-close]').forEach(el => {
        el.addEventListener('click', closeWeightModal);
    });

    // ESC to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeWeightModal();
    });

    // Submit form
    const form = document.getElementById('weightForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const weightKg = parseFloat(document.getElementById('wKg').value);
                const date = document.getElementById('wDate').value || null;
                const note = document.getElementById('wNote').value || '';

                await uploadWeight({ weightKg, date, note });  // <— defined below
                closeWeightModal();
                await renderWeightChart?.();                   // refresh chart if present
            } catch (err) {
                alert(err.message || 'Failed to save');
            }
        });
    }


    const select = document.getElementById('rangeSelect');
    if (select) {
        currentRange = parseInt(select.value, 10) || 30;
        select.addEventListener('change', (e) => {
            const days = parseInt(e.target.value, 10) || 30;
            fetchAndRender(days);
        });
    }
    // first paint
    fetchAndRender(currentRange);
});

// ===== Upload function (POST /api/weight) =====
async function uploadWeight({ weightKg, date = null, note = '', source = 'manual' }) {
    if (typeof weightKg !== 'number' || !isFinite(weightKg)) {
        throw new Error('Please enter a valid number for weight.');
    }

    // The 'date' param from the form handler is already 'YYYY-MM-DD' or null.
    // No re-parsing or normalization is needed.
    const entry_date = date;

    // safeFetchJSON returns parsed JSON data on success or throws an Error.
    // No need to check res.ok or call res.json() here.
    try {
        const data = await safeFetchJSON('/api/weight', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ weightKg, entry_date, note, source })
        });
        return data; // Return the parsed JSON directly
    } catch (err) {
        // Re-throw the error from safeFetchJSON
        throw new Error(err.message || 'Upload failed');
    }
}

async function renderWeightChart() {
    // demo data (replace with API data later)
    const today = new Date();
    const labels = [];
    const weights = [];
    let w = 75;
    for (let i = 14; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        labels.push(d.toISOString().slice(0, 10));
        w += (Math.random() - 0.5) * 0.6;
        weights.push(Math.round(w * 10) / 10);
    }

    const ctx = document.getElementById('weightChart').getContext('2d');
    if (window.weightChartInstance) window.weightChartInstance.destroy();

    window.weightChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Weight (kg)',
                data: weights,
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 3.5,
                pointHoverRadius: 5,
                fill: false,
                borderColor: '#52c471',
                backgroundColor: '#52c471',
                segment: {
                    borderColor: c => {
                        const i0 = c.p0DataIndex, i1 = c.p1DataIndex;
                        const prev = weights[i0], next = weights[i1];
                        if (next > prev) return 'rgb(0,200,0)';
                        if (next < prev) return 'rgb(220,0,0)';
                        return '#aaa';
                    }
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,  // <- fills parent .chart-wrap
            interaction: { mode: 'nearest', intersect: false },
            scales: {
                x: {
                    ticks: { maxRotation: 0, autoSkip: true, color: '#ccc' },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: false,
                    ticks: { color: '#ccc' },
                    grid: { color: 'rgba(255,255,255,.08)' }
                }
            },
            plugins: {
                legend: { labels: { color: '#fff' } },
                tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} kg` } }
            },
            // render crisp on high-DPI phones
            devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2)
        }
    });
}

async function safeFetchJSON(input, init) {
    const res = await fetch(input, init);
    const text = await res.text();
    const ct = res.headers.get('content-type') || '';

    if (!ct.includes('application/json')) {
        // helpful log during dev
        console.error('Expected JSON but got:', ct, '\nPayload:\n', text.slice(0, 500));
        throw new Error(`${res.status} ${res.statusText} (non-JSON response)`);
    }
    const data = JSON.parse(text);
    if (!res.ok) {
        const msg = data?.error || `${res.status} ${res.statusText}`;
        throw new Error(msg);
    }
    return data;
}


function getLocalISODate(date) {
    const d = new Date(date);
    if (isNaN(d)) return null;

    // Get the timestamp, subtract the *local* timezone offset,
    // then get the 'YYYY-MM-DD' part of the resulting ISO string.
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
}

async function fetchAndRender(days = currentRange) {
    try {
        currentRange = days;
        const data = await safeFetchJSON(`/api/weights?days=${days}`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        console.log("requesting days amount: " + currentRange);

        // data = { days, range: {start,end}, count, items:[{entry_date,weight_kg,note,source}] }
        renderWeightChartFromItems(data.items);
        renderWeightsList(data.items);

        // (nice-to-have) show exact range as a tooltip on the label
        const label = document.querySelector('.chart-controls label');
        if (label && data?.range?.start && data?.range?.end) {
            label.title = `From ${data.range.start} to ${data.range.end}`;
        }
    } catch (err) {
        console.error(err);
        showChartEmptyState(err.message || 'Failed to load data');
    }
}

function renderWeightChartFromItems(items = []) {
    const wrap = document.querySelector('.chart-wrap');
    const canvas = document.getElementById('weightChart');
    if (!wrap || !canvas) return;

    if (!Array.isArray(items) || items.length === 0) {
        showChartEmptyState('No data in this range yet.');
        // ensure any previous chart is destroyed
        if (window.weightChartInstance) {
            window.weightChartInstance.destroy();
            window.weightChartInstance = null;
        }
        return;
    }

    const labels = items.map(r => {
        const d = new Date(r.entry_date);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    }); const weights = items.map(r => Number(r.weight_kg));      // numeric

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
                // green if down, red if up, gray if equal
                segment: {
                    borderColor: c => {
                        const i0 = c.p0DataIndex, i1 = c.p1DataIndex;
                        const prev = weights[i0], next = weights[i1];
                        if (next > prev) return 'rgb(0,200,0)';
                        if (next < prev) return 'rgb(220,0,0)';
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
                x: {
                    ticks: { maxRotation: 0, autoSkip: true, color: '#ccc' },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: false,
                    ticks: { color: '#ccc' },
                    grid: { color: 'rgba(255,255,255,.08)' }
                }
            },
            plugins: {
                legend: { labels: { color: '#fff' } },
                tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} kg` } }
            },
            animation: { duration: 260 },
            devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2)
        }
    });

    // remove any empty-state overlay
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
            position: 'absolute',
            inset: '0',
            display: 'grid',
            placeItems: 'center',
            color: '#bbb',
            fontSize: '0.95rem',
            textAlign: 'center',
            pointerEvents: 'none',
            padding: '1rem'
        });
        wrap.style.position = 'relative';
        wrap.appendChild(empty);
    }
    empty.textContent = message;
}


AOS.init();

const mq = window.matchMedia("(min-width: 800px)");
if (mq.matches) {
    document.querySelectorAll("[data-aos]").forEach(el => {
        el.removeAttribute("data-aos");
        el.style.opacity = "";
        el.style.transform = "";
    });

    AOS.refreshHard = () => { };
    AOS.init = () => { };
}

async function loadProfile() {
    try {
        const res = await fetch("/meinfo", {
            method: "GET",
            credentials: "include"
        });

        if (!res.ok) {
            // e.g. 401, 404, 500...
            console.error("Profile fetch failed:", res.status);
            if (res.status === 401) {
                // not logged in -> back to login
                window.location.href = "/login";
            }
            return;
        }

        const profile = await res.json();
        console.log("profile:", profile);

        // Example: fill DOM
        document.getElementById("usernameLabel").innerHTML = profile.username;

        document.getElementById("roleLabel").innerHTML = profile.role;
        document.getElementById("realnameLabel").innerHTML = profile.realName;
    } catch (err) {
        console.error("Failed to load profile:", err);
    }
}

loadProfile();

function formatDateShort(iso) {
  // e.g. "2025-11-01" -> "01 Nov"
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}


function renderWeightsList(items = []) {
  const lower = document.querySelector('.mainfglowerholder');
  if (!lower) return;

  // clear old content
  lower.innerHTML = '';

  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'routeoption';
    empty.textContent = 'No entries in this range yet.';
    lower.appendChild(empty);
    return;
  }

  // reverse items so newest is first
  const reversed = [...items].reverse();

  for (let i = 0; i < reversed.length; i++) {
    const cur = reversed[i];
    const prev = i > 0 ? reversed[i - 1] : null;

    const kg = Number(cur.weight_kg);
    const delta = prev ? kg - Number(prev.weight_kg) : 0;
    const deltaStr = prev ? (delta > 0 ? `+${delta.toFixed(1)} kg` : `${delta.toFixed(1)} kg`) : '—';

    const card = document.createElement('div');
    card.className = 'routeoption';
    card.setAttribute('data-aos', 'fade-up');

    let chipClass = 'chip-flat';
    if (prev) {
      chipClass = delta > 0 ? 'chip-up' : (delta < 0 ? 'chip-down' : 'chip-flat');
    }

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

    card.querySelector('.edit-btn')?.addEventListener('click', () => openEditWeight(cur));
// (Optional): double-click anywhere on the card to edit
card.addEventListener('dblclick', () => openEditWeight(cur));

  }

  // refresh AOS animations
  if (window.AOS?.refreshHard) AOS.refreshHard();

  const mq = window.matchMedia("(min-width: 800px)");
  if (mq.matches) {
    // 1. remove data-aos attributes so AOS won't animate
    document.querySelectorAll("[data-aos]").forEach(el => {
      el.removeAttribute("data-aos");
      el.style.opacity = ""; // optional: let it use normal styles
      el.style.transform = ""; // optional cleanup in case AOS touched it
    });

    // 2. stop AOS from doing anything else
    AOS.refreshHard = () => {};
    AOS.init = () => {};
  }
}


// track whether we are editing an existing entry (by its date)
let editState = null;

/** PATCH /api/weight/:date */
async function patchWeight(date, { weightKg, note, source = 'manual' } = {}) {
  const body = {};
  if (weightKg !== undefined && weightKg !== null) body.weightKg = Number(weightKg);
  if (note !== undefined) body.note = String(note);
  if (source !== undefined) body.source = String(source);

  return safeFetchJSON(`/api/weight/${date}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
}



function openEditWeight(entry) {
  // entry = { entry_date, weight_kg, note, source }
  editState = entry.entry_date;                       // remember what we edit
  const m = document.getElementById('weightModal');
  m.classList.add('show');
  document.body.classList.add('body--lock');

  // Title -> Edit
  const title = document.getElementById('weightModalTitle');
  if (title) title.textContent = 'Edit Weight';

  // Prefill fields
  document.getElementById('wDate').value = entry.entry_date; // show the date (disabled below)
  document.getElementById('wKg').value = Number(entry.weight_kg).toFixed(1);
  document.getElementById('wNote').value = entry.note ?? '';

  // Don’t allow changing the date for edit (keeps PK stable)
  document.getElementById('wDate').setAttribute('disabled', 'disabled');

  setTimeout(() => document.getElementById('wKg')?.focus(), 60);
}

function openWeightModal() {
  // “Add” mode (original)
  editState = null;
  const m = document.getElementById('weightModal');
  m.classList.add('show');
  document.body.classList.add('body--lock');

  const title = document.getElementById('weightModalTitle');
  if (title) title.textContent = 'Add Weight';

  const isoLocal = getLocalISODate(new Date());
  const wDate = document.getElementById('wDate');
  if (wDate) {
    wDate.removeAttribute('disabled');
    if (!wDate.value) wDate.value = isoLocal;
  }

  document.getElementById('wKg').value = '';
  document.getElementById('wNote').value = '';

  setTimeout(() => document.getElementById('wKg')?.focus(), 60);
}

function closeWeightModal() {
  const m = document.getElementById('weightModal');
  if (!m) return;
  m.classList.remove('show');
  document.body.classList.remove('body--lock');
  // reset edit state when closing
  editState = null;
  document.getElementById('wDate')?.removeAttribute('disabled');
  const title = document.getElementById('weightModalTitle');
  if (title) title.textContent = 'Add Weight';
}


document.getElementById('weightForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const weightKg = parseFloat(document.getElementById('wKg').value);
    const date = document.getElementById('wDate').value || null;
    const note = document.getElementById('wNote').value || '';

    if (editState) {
      // EDIT existing row
      await patchWeight(editState, { weightKg, note, source: 'manual' });
    } else {
      // ADD new row
      await uploadWeight({ weightKg, date, note, source: 'manual' });
    }

    closeWeightModal();
    await fetchAndRender(currentRange);
  } catch (err) {
    alert(err.message || 'Failed to save');
  }
});



// Get the Note input field by its ID
const weightNoteInput = document.getElementById('wNote');

// Get all the suggestion buttons within the suggestionsholder
const suggestionButtons = document.querySelectorAll('.suggestionsholder button');

// Loop through each button and attach an event listener
suggestionButtons.forEach(button => {
    button.addEventListener('click', function(event) {
        // Prevent the button click from submitting the form and closing the modal
        event.preventDefault(); 
        
        // Get the text from the clicked button
        const buttonText = this.textContent;
        
        // Set the value of the note input field to the button's text
        weightNoteInput.value = buttonText;
        
        // Optional: You might want to close the modal or focus the input after selection
        // weightNoteInput.focus();
    });
});