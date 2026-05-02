/** * State & Orchestration 
 */

const State = {
    activeTab: 'home',
    searchTimeout: null
};

//Navigation:
// Swaps the page content
async function navigate(tabId) {
    State.activeTab = tabId;
    const main = document.getElementById('app-container');
    
    // Close detail views when switching tabs
    closeDetails();

    // CASE A: Search Page (Starts empty, no API fetch needed yet)
    if (tabId === 'search') {
        main.innerHTML = PageBuilders.search();
        return;
    }

    // CASE B: Data Pages (Fetch from backend)
    main.innerHTML = `<div class="loader">Loading...</div>`;
    try {
        const response = await fetch(`/api/pages/${tabId}`);
        const data = await response.json();
        main.innerHTML = PageBuilders[tabId](data);
    } catch (err) {
        // Fallback for pages not yet in the backend
        main.innerHTML = PageBuilders.simple(tabId, `Content for ${tabId} is coming soon.`);
    }
}







//#region search page

//Search Logic: 
//Talks to your /api/movies/search endpoint
async function handleSearch(event) {
    const query = event.target.value.trim();
    const resultsContainer = document.getElementById('search-results-grid');

    if (query.length < 3) return;

    clearTimeout(State.searchTimeout);
    State.searchTimeout = setTimeout(async () => {
        resultsContainer.innerHTML = '<div class="loader">Searching...</div>';
        try {
            const res = await fetch(`/api/movies/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            
            resultsContainer.innerHTML = data.content.length > 0 
                ? data.content.map(movie => MovieCard(movie)).join('')
                : '<p>No results found.</p>';
        } catch (err) {
            resultsContainer.innerHTML = '<p>Error connecting to search server.</p>';
        }
    }, 400); // 400ms delay to save API calls
}

// 3. Detail View: Opens the "glass" overlay
async function openDetails(movieId) {
    const detailLayer = document.getElementById('subpage-container');
    detailLayer.classList.add('active');
    detailLayer.innerHTML = '<div class="loader">Loading details...</div>';

    try {
        //sonra yarat bu endpointi
        const res = await fetch(`/api/movies/details/${movieId}`);
        const data = await res.json();
        detailLayer.innerHTML = DetailPageTemplate(data);
    } catch (err) {
        detailLayer.innerHTML = '<button onclick="closeDetails()">Back</button><p>Could not load details.</p>';
    }
}

function closeDetails() {
    document.getElementById('subpage-container').classList.remove('active');
}

//#endregion
























// Initialize the app on load
navigate('home');