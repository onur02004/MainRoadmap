// Total images and pagination settings
const totalImages = 116;
const perPage = 6;
let currentPage = 1;
const totalPages = Math.ceil(totalImages / perPage);

  document.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('bg-audio');
    const btn   = document.getElementById('audio-toggle');

    btn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        btn.textContent = '⏸️';
      } else {
        audio.pause();
        btn.textContent = '▶️';
      }
    });

    // Optional: initialize button state
    audio.paused
      ? btn.textContent = '▶️'
      : btn.textContent = '⏸️';
  });

// Helper: get filename by index
const filename = i => `${i + 1}.jpg`; // we’ll override the extension later

// Render the gallery items using the correct markup per type
function renderPage(page) {
  const galleryRow = document.getElementById('gallery-row');
  galleryRow.innerHTML = '';

  const start = (page - 1) * perPage;
  const end = Math.min(start + perPage, totalImages);

  for (let idx = start; idx < end; idx++) {
    const base = idx + 1;
    let fileExt = '.jpg';
    // Add all your video file numbers here
    const videos = [11, 23, 39, 110, 111, 112, 113];
    if (videos.includes(base)) {
      fileExt = '.mp4';
    }

    const fullName = `${base}${fileExt}`;
    const div = document.createElement('div');
    div.className = 'responsive';

    if (fileExt === '.mp4') {
      div.innerHTML = `
        <div class="gallery" data-aos="fade-up">
          <video width="600" controls>
            <source src="../media/features/ensedgko/${fullName}" type="video/mp4">
            Your browser does not support the video tag.
          </video>
          <div class="desc">Mart 2025 - Motke</div>
        </div>
      `;
    } else {
      div.innerHTML = `
        <div class="gallery" data-aos="fade-up">
          <img
            src="../media/features/ensedgko/${fullName}"
            alt="Image ${base}"
            width="600"
            height="400"
            style="border-radius:10px;"
          >
          <div class="desc">#${base}</div>
        </div>
      `;
    }

    galleryRow.appendChild(div);
  }
}

// (Re)build Bootstrap pagination (Prev / numbered / Next)
function buildPagination() {
  const pag = document.getElementById('pagination');
  pag.innerHTML = '';

  // Previous
  pag.appendChild(createPageItem('Prev', currentPage > 1, () => gotoPage(currentPage - 1)));

  // Numbers
  for (let i = 1; i <= totalPages; i++) {
    pag.appendChild(createPageItem(i, true, () => gotoPage(i), i === currentPage));
  }

  // Next
  pag.appendChild(createPageItem('Next', currentPage < totalPages, () => gotoPage(currentPage + 1)));
}

function createPageItem(label, enabled, onClick, active = false) {
  const li = document.createElement('li');
  li.className = `page-item ${!enabled ? 'disabled' : ''} ${active ? 'active' : ''}`;
  li.innerHTML = `<a class="page-link" href="#">${label}</a>`;
  li.onclick = e => {
    e.preventDefault();
    if (enabled) onClick();
  };
  return li;
}

function gotoPage(page) {
  window.scrollTo(0, 300);
  currentPage = page;
  renderPage(page); 
  buildPagination();
  recordVisit();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderPage(currentPage);
  buildPagination();
  recordVisit();
});


// 1) Firebase initialization
const firebaseConfig = {
  databaseURL: "https://dgkoense-default-rtdb.europe-west1.firebasedatabase.app"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

function recordVisit() {
  const nowTs = Date.now();
  const nowHuman = new Date(nowTs).toLocaleString(); // e.g. "6/28/2025, 3:45:12 PM"

  const visitData = {
    timestamp: nowTs,
    datetime: nowHuman,
    page: currentPage,
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  };

  // Overwrite /lastseenindex/ with the latest visit object
  db.ref('/lastseengallery/').set(visitData)
    .then(() => console.log('Recorded visit:', visitData))
    .catch(err => console.error('Failed to record visit:', err));
}


