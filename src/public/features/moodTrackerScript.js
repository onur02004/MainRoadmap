/**
 * Mood Tracker Core Logic - 2026 Edition
 * Handles: Calendar generation, structured data storage (Notes/Images),
 * Modal interactions, and real-time statistics.
 */

const calendarContainer = document.getElementById('calendar-wrapper');
const detailDate = document.getElementById('detail-date');
const detailStatus = document.getElementById('detail-status');
const detailNote = document.getElementById('detail-note');
const detailPane = document.getElementById('detail-pane');
const detailImg = document.getElementById('detail-image');
const editBtn = document.getElementById('edit-btn');
let currentActiveDate = null;
let paneImageBase64 = null;
let isProgrammaticScroll = false;


// --- DATA STRUCTURE ---
// We've moved from simple strings to objects to hold notes and images.
let backendData = {
    "2026-01-08": { rating: "blue", note: "Solid work day. Productivity was high.", image: null },
    "2026-01-07": { rating: "yellow", note: "A bit tired today, but managed to finish my book.", image: null },
    "2026-01-06": { rating: "red", note: "Rough sleep. Staying kind to myself.", image: null },
    "2026-01-05": { rating: "green", note: "Feeling fantastic! Morning run was great.", image: null }
};

let currentEditingDate = null;
let currentImageBase64 = null;

// --- CALENDAR LOGIC ---

/**
 * Generates the horizontal scrolling calendar cards.
 * Now looks for 'rating' inside the backendData object.
 */
function initCalendar() {
    const today = new Date();
    calendarContainer.innerHTML = '';

    for (let i = -1; i < 31; i++) {
        const date = new Date();
        date.setDate(today.getDate() - i);

        const dateKey = getLocalDateKey(date);
        const entry = backendData[dateKey];
        const rating = entry ? entry.rating : 'no-data';
        const isFuture = i < 0;

        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = date.getDate();
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });

        const card = document.createElement('div');
        card.className = `day-card rating-${rating} ${i === 0 ? 'is-today' : ''} ${isFuture ? 'is-future' : ''}`;

        card.innerHTML = `
            <span class="month">${monthName}</span>
            <span class="date">${dayNum}</span>
            <span class="day-name">${isFuture ? 'COMING' : dayName}</span>
            <div class="mood-dot"></div>
        `;

        card.setAttribute('data-date', dateKey);

        if (!isFuture) {
            card.addEventListener('click', () => {
                isProgrammaticScroll = true;

                currentActiveDate = dateKey;

                document.querySelectorAll('.day-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');

                updateDetailPane(dateKey);

                const containerRect = calendarContainer.getBoundingClientRect();
                const cardRect = card.getBoundingClientRect();

                const scrollLeft =
                    calendarContainer.scrollLeft +
                    (cardRect.left - containerRect.left);

                calendarContainer.scrollTo({
                    left: scrollLeft,
                    behavior: 'smooth'
                });

                // Re-enable scroll selection after animation finishes
                setTimeout(() => {
                    isProgrammaticScroll = false;
                }, 400);
            });

        }

        calendarContainer.appendChild(card);
        // Important: We keep the observer for scroll-based selection as well
        scrollObserver.observe(card);
    }
}

// --- DETAIL PANE & MODAL LOGIC ---

/**
 * Updates the display pane with the selected date's details.
 */
function updateDetailPane(dateKey) {
    const entry = backendData[dateKey];

    detailPane.classList.remove('content-fade');
    void detailPane.offsetWidth; // Trigger reflow for animation
    detailPane.classList.add('content-fade');

    const dateObj = new Date(dateKey);
    detailDate.innerText = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

    // Reset image display
    detailImg.style.display = 'none';
    editBtn.style.display = 'block';

    if (entry) {
        detailStatus.innerText = entry.rating.toUpperCase();
        detailStatus.style.backgroundColor = `var(--color-${entry.rating})`;
        detailNote.innerText = entry.note || "No notes for this day.";
        editBtn.innerText = "Edit Entry";

        if (entry.image) {
            detailImg.src = entry.image;
            detailImg.style.display = 'block';
        }
    } else {
        detailStatus.innerText = "No Data";
        detailStatus.style.color = 'white';
        detailNote.innerText = "Tap the button below to log your mood.";
        editBtn.innerText = "Add Entry";
    }

    editBtn.onclick = () => openModal(dateKey);


}

function openModal(dateKey) {
    currentEditingDate = dateKey;
    const entry = backendData[dateKey] || { rating: 'green', note: '', image: null };

    document.getElementById('modal-date-display').innerText = `Logging for ${dateKey}`;
    document.getElementById('entry-note').value = entry.note;

    // Set radio button
    const radio = document.querySelector(`input[name="mood"][value="${entry.rating}"]`);
    if (radio) radio.checked = true;

    // Handle existing image preview
    const preview = document.getElementById('image-preview');
    if (entry.image) {
        preview.innerHTML = `
    <div class="image-container">
        <img src="${entry.image}" class="preview-img">
        <button class="remove-img-btn" onclick="deleteImage('${dateKey}')">✕ Remove Photo</button>
    </div>
`; 
currentImageBase64 = entry.image;
    } else {
        preview.innerHTML = '';
        currentImageBase64 = null;
    }

    document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('entry-image').value = ''; // Reset file input
}


function getLocalDateKey(date) {
    const d = new Date(date);
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
    ].join('-');
}


/**
 * Processes the image upload into a Base64 string for storage.
 */
document.getElementById('entry-image').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            currentImageBase64 = reader.result;
            document.getElementById('image-preview').innerHTML = `<img src="${currentImageBase64}" style="width:100%; border-radius:8px; margin-top:10px;">`;
        };
        reader.readAsDataURL(file);
    }
});

function saveEntry() {
    const selectedRating = document.querySelector('input[name="mood"]:checked')?.value;
    const note = document.getElementById('entry-note').value;

    if (!selectedRating) return alert("Select a mood!");

    saveToDatabase(currentEditingDate, selectedRating, note, currentImageBase64);
}

function savePaneEntry() {
    const selectedRadio = document.querySelector('input[name="pane-mood"]:checked');
    if (!selectedRadio) return alert("Please select a mood color!");

    const rating = selectedRadio.value;
    const note = document.getElementById('pane-note').value;

    saveToDatabase(currentActiveDate, rating, note, paneImageBase64);
}

// --- STATISTICS & GRID LOGIC ---

function calculateDominantForRange(days) {
    const counts = { green: 0, blue: 0, yellow: 0, red: 0 };
    const today = new Date();
    let hasData = false;

    for (let i = 0; i < days; i++) {
        const checkDate = new Date();
        checkDate.setDate(today.getDate() - i);
        const key = checkDate.toISOString().split('T')[0];

        const entry = backendData[key];
        if (entry && entry.rating !== 'no-data') {
            counts[entry.rating]++;
            hasData = true;
        }
    }

    if (!hasData) return { label: '--', color: 'white' };
    const dominant = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    return { label: dominant, color: `var(--color-${dominant})` };
}

function initStatsAndGrid() {
    const gridContainer = document.getElementById('monthly-grid');
    if (!gridContainer) return;

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    gridContainer.innerHTML = '';

    // Update Streak
    let streak = 0;
    for (let i = 0; i < 365; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        if (backendData[getLocalDateKey(d)]) {
            streak++;
        } else {
            if (i > 0) break; // Break if we hit a gap (not counting today)
        }
    }
    document.getElementById('stat-streak').innerText = streak;

    // Monthly Grid Generation
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    let positiveMoods = 0;
    let loggedDays = 0;

    for (let i = 1; i <= daysInMonth; i++) {
        const dateKey = getLocalDateKey(new Date(currentYear, currentMonth, i));
        const entry = backendData[dateKey];

        const dayEl = document.createElement('div');
        dayEl.className = `grid-day ${entry ? 'has-' + entry.rating : ''}`;
        dayEl.innerText = i;
        gridContainer.appendChild(dayEl);

        if (entry) {
            loggedDays++;
            if (entry.rating === 'green' || entry.rating === 'blue') positiveMoods++;
        }
    }

    // Update Radiance Bar (Positive vibes %)
    const radiance = loggedDays > 0 ? Math.round((positiveMoods / loggedDays) * 100) : 0;
    document.getElementById('radiance-bar').style.width = radiance + '%';
}

// --- EVENT LISTENERS ---

calendarContainer.addEventListener('scroll', () => {
    if (isProgrammaticScroll) return;

    const cards = document.querySelectorAll('.day-card');
    if (!cards.length) return;

    const cardWidth = cards[0].offsetWidth + 15;
    const index = Math.round(calendarContainer.scrollLeft / cardWidth);
    const selectedCard = cards[index];

    if (selectedCard && !selectedCard.classList.contains('active')) {
        cards.forEach(c => c.classList.remove('active'));
        selectedCard.classList.add('active');
        updateDetailPane(selectedCard.getAttribute('data-date'));
    }
});




function updateDetailPane(dateKey) {
    currentActiveDate = dateKey;
    const entry = backendData[dateKey];
    const viewState = document.getElementById('detail-view-state');
    const entryState = document.getElementById('detail-entry-state');
    const editBtn = document.getElementById('edit-btn');

    // Animation trigger
    detailPane.classList.remove('content-fade');
    void detailPane.offsetWidth;
    detailPane.classList.add('content-fade');

    const dateObj = new Date(dateKey);
    detailDate.innerText = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

    if (entry) {
        // SHOW VIEW STATE
        viewState.style.display = 'block';
        entryState.style.display = 'none';
        editBtn.style.display = 'block';
        editBtn.innerText = "Edit";

        detailStatus.innerText = entry.rating.toUpperCase();
        detailStatus.style.backgroundColor = `var(--color-${entry.rating})`;
        detailNote.innerText = entry.note;

        if (entry.image) {
            detailImg.src = entry.image;
            detailImg.style.display = 'block';
        } else {
            detailImg.style.display = 'none';
        }

        editBtn.onclick = () => {
            toggleEntryState(entry); // Switch to edit mode
        };
    } else {
        // SHOW ENTRY STATE IMMEDIATELY
        toggleEntryState(null);
        detailStatus.innerText = "New Entry";
        detailStatus.style.color = 'white';
        editBtn.style.display = 'none';
    }
}

function toggleEntryState(existingData) {
    document.getElementById('detail-view-state').style.display = 'none';
    document.getElementById('detail-entry-state').style.display = 'block';

    const noteInput = document.getElementById('pane-note');
    const preview = document.getElementById('pane-image-preview');

    if (existingData) {
        noteInput.value = existingData.note;
        const radio = document.querySelector(`input[name="pane-mood"][value="${existingData.rating}"]`);
        if (radio) radio.checked = true;
        paneImageBase64 = existingData.image;
        preview.innerHTML = paneImageBase64 ? `<img src="${paneImageBase64}">` : '';
    } else {
        noteInput.value = '';
        document.querySelectorAll('input[name="pane-mood"]').forEach(r => r.checked = false);
        preview.innerHTML = '';
        paneImageBase64 = null;
    }
}

// Handle Image logic for the Pane
document.getElementById('pane-image').addEventListener('change', function (e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
        paneImageBase64 = reader.result;
        document.getElementById('pane-image-preview').innerHTML = `<img src="${paneImageBase64}">`;
    };
    if (file) reader.readAsDataURL(file);
});

let charts = {}; // Store chart instances to destroy/update them

function initModernCharts() {
    const today = new Date();
    const labels = [];
    const trendData = [];
    const moodCounts = { green: 0, blue: 0, yellow: 0, red: 0 };
    const weights = { green: 4, blue: 3, yellow: 2, red: 1 };

    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const key = getLocalDateKey(d);
        const entry = backendData[key];

        labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        if (entry) {
            trendData.push(weights[entry.rating]);
            moodCounts[entry.rating]++;
        } else {
            trendData.push(null);
        }
    }

    // 2. Destroy existing charts before re-render
    if (charts.doughnut) charts.doughnut.destroy();
    if (charts.line) charts.line.destroy();

    // 3. Mood Distribution (Doughnut)
    charts.doughnut = new Chart(document.getElementById('moodDoughnut'), {
        type: 'doughnut',
        data: {
            labels: ['Great', 'Good', 'Okay', 'Rough'],
            datasets: [{
                data: [moodCounts.green, moodCounts.blue, moodCounts.yellow, moodCounts.red],
                backgroundColor: ['#52c471', '#3498db', '#f1c40f', '#e74c3c'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: { plugins: { legend: { display: false } }, cutout: '70%' }
    });

    // 4. Mood Trend (Line)
    charts.line = new Chart(document.getElementById('moodLineChart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Mood Level',
                data: trendData,
                borderColor: '#52c471',
                backgroundColor: 'rgba(82, 196, 113, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            scales: {
                y: { min: 1, max: 4, ticks: { display: false }, grid: { display: false } },
                x: { grid: { display: false }, ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 10 } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

const observerOptions = {
    root: calendarContainer,
    threshold: 0.6, // Card must be 60% visible to be considered 'active'
    rootMargin: '0px'
};

const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        // Only trigger selection via scroll if the user is ACTUALLY scrolling manually
        // and not just as a result of a click-scroll.

        if (isProgrammaticScroll) return;

        if (entry.isIntersecting) {
            const card = entry.target;
            const dateKey = card.getAttribute('data-date');

            // Only update if the date has actually changed
            if (currentActiveDate !== dateKey) {
                document.querySelectorAll('.day-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                updateDetailPane(dateKey);
            }
        }
    });
}, {
    root: calendarContainer,
    threshold: 0.8, // Card must be almost entirely visible to trigger
    rootMargin: '0px'
});

async function initApp() {
    try {
        const response = await fetch('/api/moods');
        if (response.ok) {
            backendData = await response.json();

            // USE THIS TO GET THE COUNT:
            const count = Object.keys(backendData).length;
            console.log("Onceki veriler alindi. Toplam kayit: " + count);
            console.table(backendData);

        } else {
            console.error("Hata: Sunucudan veri alinamadi.");
        }
    } catch (err) {
        console.error("Initial load failed:", err);
    }

    initCalendar();
    initStatsAndGrid();
    initModernCharts();

    await fetchDashboardStats(); // Add this line
}

async function saveToDatabase(date, rating, note, image) {
    try {
        const response = await fetch('/api/moods', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, rating, note, image })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to save to database');
        }

        // Update local data so the UI refreshes
        backendData[date] = { rating, note, image };

        if (response.ok) {
            backendData[date] = { rating, note, image }; // Update local cache

            // RE-RUN ALL UI LOGIC
            initCalendar();
            initStatsAndGrid();
            initModernCharts();
            updateDetailPane(date);

            closeModal();
            if (typeof closeModal === "function") closeModal();
        }


    } catch (err) {
        console.error("Database Error:", err);
        alert("Server Error: " + err.message);
    }
}

function selectCardAsLeftmost(card) {
    if (!card) return;

    isProgrammaticScroll = true;

    const dateKey = card.getAttribute('data-date');
    currentActiveDate = dateKey;

    document.querySelectorAll('.day-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');

    updateDetailPane(dateKey);

    const containerRect = calendarContainer.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    const scrollLeft =
        calendarContainer.scrollLeft +
        (cardRect.left - containerRect.left);

    calendarContainer.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
    });

    setTimeout(() => {
        isProgrammaticScroll = false;
    }, 400);
}



// --- TOUR LOGIC ---
const tourSteps = [
    {
        title: "Track Your Days",
        desc: "Scroll horizontally through the calendar. Click any date to view or edit that day's entry."
    },
    {
        title: "Deep Dive",
        desc: "The Detail Pane shows your notes and photos. You can update your mood directly from there."
    }
];

let currentTourStep = 0;

function initTour() {
    const hasSeenTour = localStorage.getItem('skipMoodTour');
    if (hasSeenTour === 'true') return;

    document.getElementById('tour-overlay').style.display = 'flex';
    updateTourStep();
}

function updateTourStep() {
    const step = tourSteps[currentTourStep];
    document.getElementById('tour-title').innerText = step.title;
    document.getElementById('tour-description').innerText = step.desc;

    // Update Dots
    const dotsContainer = document.getElementById('tour-dots');
    dotsContainer.innerHTML = tourSteps.map((_, i) =>
        `<div class="tour-dot ${i === currentTourStep ? 'active' : ''}"></div>`
    ).join('');

    const nextBtn = document.getElementById('tour-next-btn');
    nextBtn.innerText = currentTourStep === tourSteps.length - 1 ? "Get Started!" : "Next";

    nextBtn.onclick = () => {
        if (currentTourStep < tourSteps.length - 1) {
            currentTourStep++;
            updateTourStep();
        } else {
            closeTour();
        }
    };
}

function closeTour() {
    const skipCheckbox = document.getElementById('skip-tour-checkbox');
    if (skipCheckbox.checked) {
        localStorage.setItem('skipMoodTour', 'true');
    }
    document.getElementById('tour-overlay').style.display = 'none';
}

function showScrollHint() {
    const hint = document.getElementById('scroll-hint');
    hint.style.display = 'flex';

    // Auto-hide after 4 seconds
    setTimeout(() => {
        hint.style.opacity = '0';
        setTimeout(() => { hint.style.display = 'none'; }, 500);
    }, 8000);
}

// Modify your existing closeTour function
function closeTour() {
    const skipCheckbox = document.getElementById('skip-tour-checkbox');
    if (skipCheckbox && skipCheckbox.checked) {
        localStorage.setItem('skipMoodTour', 'true');
    }
    document.getElementById('tour-overlay').style.display = 'none';

    // Trigger the scroll animation after closing/skipping
    showScrollHint();
}

async function fetchDashboardStats() {
    try {
        const response = await fetch('/api/moods/stats');
        if (!response.ok) return;

        const stats = await response.json();

        // Update UI Elements
        document.getElementById('stat-streak').innerText = stats.streak;
        document.getElementById('radiance-bar').style.width = `${stats.radiance}%`;

        // Dominant Moods Labels
        document.getElementById('mood-week').innerText = stats.dominant.week.toUpperCase();
        document.getElementById('mood-6mo').innerText = stats.dominant.sixMonth.toUpperCase();
        document.getElementById('mood-year').innerText = stats.dominant.year.toUpperCase();

        const weekLabel = document.getElementById('mood-week');
        weekLabel.style.color = `var(--color-${stats.dominant.week})`;

        document.getElementById('stat-peak-day').innerText = stats.peakDay;
        document.getElementById('stat-streak').innerText = stats.streak;

        // If you want to show volatility in your 'Dominant Mood' box:
        const subText = document.getElementById('stat-mood-perc');
        if (subText) subText.innerText = `Volatility: ${stats.volatility} (7-day avg)`;

    } catch (err) {
        console.error("Failed to load dashboard stats:", err);
    }
}

// Modify your existing DOMContentLoaded listener to trigger the tour
document.addEventListener('DOMContentLoaded', () => {
    initCalendar();
    initStatsAndGrid();
    initModernCharts();
    initApp();

    // Trigger Tour
    setTimeout(initTour, 1000); // Small delay for visual effect

    const todayCard = document.querySelector('.day-card.is-today');
    if (todayCard) {
        requestAnimationFrame(() => {
            selectCardAsLeftmost(todayCard);
        });
    }
});

// Add this to your moodTrackerScript.js to handle mobile touch-start
document.querySelectorAll('.info-trigger').forEach(trigger => {
    trigger.addEventListener('touchstart', (e) => {
        // Toggle the popup class for mobile tap instead of hover
        trigger.classList.toggle('active-popup');
    });
});

/**
 * Deletes the image for a specific date from the backend and local cache.
 */
async function deleteImage(dateKey) {
    if (!confirm("Are you sure you want to remove this photo?")) return;

    try {
        const response = await fetch('/api/moods/image', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: dateKey })
        });

        if (response.ok) {
            // Update local cache
            if (backendData[dateKey]) {
                backendData[dateKey].image = null;
            }

            // Refresh UI components
            updateDetailPane(dateKey);
            document.getElementById('image-preview').innerHTML = '';
            document.getElementById('pane-image-preview').innerHTML = '';

            // Re-render stats if they count memories
            if (typeof fetchDashboardStats === "function") fetchDashboardStats();
        } else {
            alert("Failed to delete image.");
        }
    } catch (err) {
        console.error("Error deleting image:", err);
    }
}