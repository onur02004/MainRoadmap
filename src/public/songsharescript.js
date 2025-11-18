document.addEventListener('DOMContentLoaded', () => {
    // ----- NAVIGATION BETWEEN PAGES -----
    const navLinks = document.querySelectorAll('.nav-option a');
    const pages = document.querySelectorAll('.page');

    function showPage(pageName) {
        pages.forEach(p => {
            const isTarget = p.classList.contains(`page-${pageName}`);
            p.classList.toggle('is-active', isTarget);
        });
    }

    function handleNavigation(event) {
        event.preventDefault();

        const link = event.currentTarget;
        const page = link.getAttribute('data-page');

        // active class on nav links
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // show correct page
        showPage(page);

        // optional: update hash
        // history.pushState(null, '', link.getAttribute('href'));
    }

    navLinks.forEach(link => {
        link.addEventListener('click', handleNavigation);
    });

    const initial = location.hash.replace('#', '') || 'home';
    showPage(initial);
    navLinks.forEach(link => {
        if (link.getAttribute('data-page') === initial) {
            link.classList.add('active');
        }
    });


    // ----- SUGGEST PAGE: SPOTIFY SEARCH -----
    const openSearchModalBtn = document.getElementById('openSearchModalBtn');
    const songSearchModal = document.getElementById('songSearchModal');
    const modalCloseBtn = songSearchModal ? songSearchModal.querySelector('.close-button') : null;

    const searchInput = document.getElementById('songSearchInput');
    const searchButton = document.getElementById('songSearchButton');
    const searchStatus = document.getElementById('searchStatus');
    const searchResults = document.getElementById('searchResults');

    const coverImg = document.getElementById('suggestCover');
    const selectedSongNameInput = document.getElementById('selectedSongName');
    const selectedSongArtistInput = document.getElementById('selectedSongArtist');
    const selectedSongImageUrlInput = document.getElementById('selectedSongImageUrl');
    const sendSuggestionButton = document.getElementById('sendSuggestionButton');
    const selectedSongTitle = document.getElementById('selectedSongTitle');
    const selectedSongArtistName = document.getElementById('selectedSongArtistName');
    const selectedSongUriInput = document.getElementById('selectedSongUriInput');

    const suggestionVisibilityToggle = document.getElementById('suggestionVisibility');
    const targetUsersDisplay = document.getElementById('targetUsersDisplay');
    const targetUsersList = document.getElementById('targetUsersList');
    const editTargetUsersBtn = document.getElementById('editTargetUsersBtn');

    const userSearchModal = document.getElementById('userSearchModal');
    const userSearchCloseBtn = userSearchModal.querySelector('.close-button');
    const userSearchDoneBtn = document.getElementById('userSearchDoneBtn');
    const userSearchInput = document.getElementById('userSearchInput');
    const userSearchButton = document.getElementById('userSearchButton');
    const userSearchStatus = document.getElementById('userSearchStatus');
    const userSearchResults = document.getElementById('userSearchResults');

    const feedContainer = document.getElementById('suggestionFeed');
    const feedSpinner = document.getElementById('feedLoadingSpinner');
    const feedEndMessage = document.getElementById('feedEndMessage');
    const mainScrollSection = document.querySelector('section[style*="overflow-y: scroll"]');

    const spotifyPreviewContainer = document.getElementById('spotifyPreviewContainer');
    let currentResults = [];
    let selectedTargetUsers = [];
    let feedPage = 1;
    let isLoadingFeed = false;
    let hasMoreSuggestions = true;
    let artistImageUrl = null;
    let artistGenres = [];

    function openUserSearchModal() {
        userSearchModal.classList.add('is-active');
        userSearchInput.focus();
    }

    function closeUserSearchModal() {
        userSearchModal.classList.remove('is-active');
    }

    // 3. Event listener for the "Make Public" toggle
    suggestionVisibilityToggle.addEventListener('change', () => {
        const isPublic = suggestionVisibilityToggle.checked;
        if (isPublic) {
            // It's public, hide the user list
            targetUsersDisplay.style.display = 'none';
            selectedTargetUsers = []; // Clear selection
            renderSelectedUsers(); // Update UI (clears it)
        } else {
            // It's private, show the user list and open the modal to select users
            targetUsersDisplay.style.display = 'block';
            openUserSearchModal();
        }
    });

    // 4. Event listeners for the new modal
    editTargetUsersBtn.addEventListener('click', openUserSearchModal);
    userSearchCloseBtn.addEventListener('click', closeUserSearchModal);
    userSearchDoneBtn.addEventListener('click', closeUserSearchModal);

    // Close modal if user clicks outside of it
    window.addEventListener('click', (event) => {
        if (event.target === userSearchModal) {
            closeUserSearchModal();
        }
    });

    // 5. Function to search for users
    async function searchUsers() {
        const query = userSearchInput.value.trim();
        if (query.length < 2) {
            userSearchStatus.textContent = 'Type at least 2 characters.';
            userSearchResults.innerHTML = '';
            return;
        }

        userSearchStatus.textContent = 'Searching users...';
        userSearchResults.innerHTML = '';

        try {
            const res = await fetch(`api/searchUsers?q=${encodeURIComponent(query)}`, {
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Search failed');

            const users = await res.json();

            if (users.length === 0) {
                userSearchStatus.textContent = 'No users found.';
                return;
            }

            userSearchStatus.textContent = `Found ${users.length} user(s).`;
            renderUserResults(users);

        } catch (err) {
            console.error(err);
            userSearchStatus.textContent = 'Error searching for users.';
        }
    }

    // 6. Function to render the user search results
    function renderUserResults(users) {
        userSearchResults.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            li.className = 'search-result-item'; // You can reuse your existing CSS

            console.log('user profile pic: ' + user.profile_pic_path);
            // Check if user is already selected
            const isSelected = selectedTargetUsers.some(su => su.id === user.id);
            if (isSelected) {
                li.classList.add('active'); // 'active' class to show selection
            }

            li.innerHTML = `
                <img src="media/${user.profile_pic_path || './content/default.jpg'}" alt="Avatar" class="search-result-cover">
                <div class="search-result-info">
                    <div class="search-result-title">${user.user_name}</div>
                    <div class="search-result-artist">${user.real_name || ''}</div>
                </div>
            `;

            li.addEventListener('click', () => {
                toggleUserSelection(user, li);
            });

            userSearchResults.appendChild(li);
        });
    }

    // 7. Function to add/remove a user from the selection
    function toggleUserSelection(user, liElement) {
        const index = selectedTargetUsers.findIndex(su => su.id === user.id);

        if (index > -1) {
            // User is already selected, so remove them
            selectedTargetUsers.splice(index, 1);
            liElement.classList.remove('active');
        } else {
            // User is not selected, so add them
            selectedTargetUsers.push({ id: user.id, user_name: user.user_name });
            liElement.classList.add('active');
        }
        // Update the display list outside the modal
        renderSelectedUsers();
    }

    // 8. Function to update the list of selected users (outside the modal)
    function renderSelectedUsers() {
        if (selectedTargetUsers.length === 0) {
            targetUsersList.innerHTML = '<i>No users selected.</i>';
            return;
        }

        targetUsersList.innerHTML = '';
        selectedTargetUsers.forEach(user => {
            // You can style this better with CSS (e.g., as "pills" or "tags")
            const userTag = document.createElement('span');
            userTag.className = 'user-tag'; // Add a class for styling
            userTag.textContent = user.user_name;
            targetUsersList.appendChild(userTag);
        });
    }

    // 9. Add event listeners for user search
    userSearchButton.addEventListener('click', searchUsers);
    userSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchUsers();
        }
    });

    // === END OF NEW LOGIC ===


    // --- MODIFICATION TO YOUR EXISTING 'sendSuggestionButton' LISTENER ---

    function openModal() {
        if (songSearchModal) {
            songSearchModal.classList.add('is-active');
            // Optional: Clear previous search state when opening
            searchInput.value = '';
            searchResults.innerHTML = '';
            searchStatus.textContent = 'Type a song or artist to search.';
        }
    }

    function closeModal() {
        if (songSearchModal) {
            songSearchModal.classList.remove('is-active');
        }
    }

    // Modal Event Listeners
    if (openSearchModalBtn) {
        openSearchModalBtn.addEventListener('click', openModal);
    }
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
    }
    // Close modal if user clicks outside of it
    window.addEventListener('click', (event) => {
        if (event.target === songSearchModal) {
            closeModal();
        }
    });

    function selectTrack(index) {
        console.log('Selecting Track: ' + index);
        const track = currentResults[index];
        if (!track || !track.uri) {
            console.log('Track bos');
            return;
        }

        // --- Generate Spotify Embed URL ---
        // Spotify URI: "spotify:track:1GwuB8Vq48Q82kXzV1Lw0Q"
        // Correct embed URL: "https://open.spotify.com/embed/track/1GwuB8Vq48Q82kXzV1Lw0Q?utm_source=generator&theme=0"

        // Extract the track ID from the URI
        const trackId = track.uri.split(':')[2]; // Gets "1GwuB8Vq48Q82kXzV1Lw0Q"

        const iframeSrc = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;

        const iframeHTML = `
    <iframe 
        data-testid="embed-iframe" 
        style="border-radius:12px" 
        src="${iframeSrc}&theme=0" 
        width="100%" 
        height="352"
        frameBorder="0" 
        allowfullscreen="true" 
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
        loading="lazy">
    </iframe>
    `;
        // --- End Iframe Generation ---
        console.log(iframeHTML);

        // Highlight selected item
        const allItems = searchResults.querySelectorAll('.search-result-item');
        allItems.forEach(i => i.classList.remove('active'));
        const selectedLi = searchResults.querySelector(`.search-result-item[data-index="${index}"]`);
        if (selectedLi) {
            selectedLi.classList.add('active');
        }

        // Update visible UI
        //SPOTIFY kendi seyini kullan coverImg.src = track.imageUrl;
        //SPOTIFY kendi seyini kullan selectedSongTitle.textContent = track.name;
        //SPOTIFY kendi seyini kullan selectedSongArtistName.textContent = track.artist;

        // Inject the Iframe into the container
        spotifyPreviewContainer.innerHTML = iframeHTML;

        // Save to hidden inputs
        selectedSongNameInput.value = track.name;
        selectedSongArtistInput.value = track.artist;
        selectedSongImageUrlInput.value = track.imageUrl;
        selectedSongUriInput.value = track.uri;

        // Enable "Suggest this song" button
        sendSuggestionButton.disabled = false;

        fetchArtistImage(track);

        // Close the modal after selecting the track!
        closeModal();
    }

    async function fetchArtistImage(track) {
    try {
        // Check if we have artist IDs from the search results
        if (track.artistIds && track.artistIds.length > 0) {
            // Use the first artist ID to get the image
            const artistId = track.artistIds[0];
            
            const res = await fetch(`/api/music/artist-image?artistId=${encodeURIComponent(artistId)}`, {
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json();
                artistImageUrl = data.artist.imageUrl;
                artistGenres = data.artist.genres;
                console.log('Artist Image URL:', data.artist.imageUrl);
                console.log('Artist Details:', data.artist);
            } else {
                console.log('Failed to fetch artist image:', res.status);
                
                artistImageUrl = null;
                artistGenres = [];
            }
        } else {
            console.log('No artist IDs available for this track');
            console.log('Track object:', track);
        }
    } catch (error) {
        console.error('Error fetching artist image:', error);
    }
}

    async function searchSpotify() {
    const query = searchInput.value.trim();
    if (!query) {
        searchStatus.textContent = 'Type a song or artist to search.';
        searchResults.innerHTML = '';
        selectedSongTitle.textContent = 'No song selected';
        selectedSongArtistName.textContent = 'Search for a song!';
        spotifyPreviewContainer.innerHTML = ''; // Clear preview (New!)
        return;
    }

    searchStatus.textContent = 'Searching...';
    searchResults.innerHTML = '';
    sendSuggestionButton.disabled = true;
    spotifyPreviewContainer.innerHTML = '';

    try {
        const res = await fetch(`/api/music/search?track=${encodeURIComponent(query)}`, {
            credentials: 'include'
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
        }

        const tracks = data.tracks || [];
        currentResults = tracks;

        if (tracks.length === 0) {
            searchStatus.textContent = 'No results found.';
            searchResults.innerHTML = '';
            return;
        }

        searchStatus.textContent = `Found ${tracks.length} result${tracks.length > 1 ? 's' : ''}. Click one to select.`;
        renderResults(tracks);

        // NEW: Log artist IDs for debugging
        tracks.forEach((track, index) => {
            if (track.artistIds) {
                console.log(`Track ${index}: ${track.name} - Artist IDs:`, track.artistIds);
            }
        });

    } catch (err) {
        console.error(err);
        searchStatus.textContent = 'Error searching Spotify. Please try again.';
    }
}

    function renderResults(tracks) {
        searchResults.innerHTML = '';


        tracks.forEach((track, index) => {
            const li = document.createElement('li');
            li.className = 'search-result-item';
            li.dataset.index = index;

            li.innerHTML = `
                <img src="${track.imageUrl}" alt="Cover" class="search-result-cover">
                <div class="search-result-info">
                    <div class="search-result-title">${track.name}</div>
                    <div class="search-result-artist">${track.artist}</div>
                </div>
            `;

            li.addEventListener('click', () => {
                selectTrack(index);
            });

            searchResults.appendChild(li);
        });
    }


    // Trigger search
    if (searchButton && searchInput) {
        searchButton.addEventListener('click', searchSpotify);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchSpotify();
            }
        });
    }

    // For now, just log the selected song when suggesting
    if (sendSuggestionButton) {
        sendSuggestionButton.addEventListener('click', async () => {

            // 1. Get the core song data from hidden inputs
            const payload = {
                name: selectedSongNameInput.value,
                artist: selectedSongArtistInput.value,
                imageUrl: selectedSongImageUrlInput.value,
                uri: document.getElementById('selectedSongUriInput')?.value,

            };

            // Check if a song is selected
            console.log('payload name: ' + payload.name);
            console.log('payload artist: ' + payload.artist);
            console.log('payload imgurl: ' + payload.imageUrl);
            console.log('payload uri: ' + payload.uri);
            if (!payload.name || !payload.uri) {
                alert('Please search for and select a song first.');
                return;
            }

            // 2. Get the additional user inputs
            payload.importance = importanceSelector.querySelector('.imp-btn.active')?.getAttribute('data-value') || 'neutral';
            payload.rating = songRatingInput.value;
            payload.bestTime = bestTimeInput.value;
            payload.comment = document.getElementById('suggestionComment').value;
            payload.isPublic = document.getElementById('suggestionVisibility').checked;
            payload.song_artist_cover_url =  artistImageUrl;
            payload.song_artist_genre =  artistGenres;
            

            console.log('Sending suggestion:', payload);

            // 3. Send to backend
            sendSuggestionButton.textContent = 'Sending...';
            sendSuggestionButton.disabled = true;

            try {
                const response = await fetch('/api/music/suggestions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',     // 👈 moved here, correct place
                    body: JSON.stringify(payload)
                });


                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || `Error ${response.status}`);
                }

                // Success!
                sendSuggestionButton.textContent = 'Suggested';
                setTimeout(() => {
                    sendSuggestionButton.textContent = 'Suggest this song';
                    sendSuggestionButton.disabled = false;
                    // TODO: You could clear the form here if you want
                }, 2000);

            } catch (err) {
                console.error('Suggestion failed:', err);
                alert(`Error submitting suggestion: ${err.message}`);
                sendSuggestionButton.textContent = 'Suggest this song';
                sendSuggestionButton.disabled = false;
            }
        });

    }


    const importanceSelector = document.getElementById('suggestionImportance');
    const importanceButtons = importanceSelector.querySelectorAll('.imp-btn');

    // Set the default active state for "Neutral" on load
    const defaultBtn = importanceSelector.querySelector('[data-default="true"]');
    if (defaultBtn) {
        defaultBtn.classList.add('active');
    }

    importanceButtons.forEach(button => {
        button.addEventListener('click', function () {
            // Remove 'active' from all buttons
            importanceButtons.forEach(btn => btn.classList.remove('active'));
            // Add 'active' to the clicked button
            this.classList.add('active');
            // Optional: Store the value
            // let selectedImportance = this.getAttribute('data-value');
            // console.log('Importance:', selectedImportance);
        });
    });

    // 2. Rating Slider Logic
    const songRatingInput = document.getElementById('songRating');
    const ratingValueDisplay = document.getElementById('ratingValue');

    songRatingInput.addEventListener('input', function () {
        ratingValueDisplay.textContent = this.value;
    });

    // 3. Best Time Input (MM:SS to Seconds conversion logic - optional, but useful)
    const bestTimeInput = document.getElementById('bestTimeInput');

    // Simple validation/conversion example
    bestTimeInput.addEventListener('change', function () {
        let value = this.value.trim();
        let totalSeconds = 0;

        if (value.includes(':')) {
            // Assumes MM:SS format
            const parts = value.split(':').map(p => parseInt(p.trim(), 10) || 0);
            if (parts.length === 2) {
                totalSeconds = parts[0] * 60 + parts[1];
            }
        } else {
            // Assumes seconds
            totalSeconds = parseInt(value, 10) || 0;
        }

        // To keep the display consistent, you could re-format it back to MM:SS
        // Example: If user types '90', it shows '1:30'
        if (totalSeconds > 0) {
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            this.value = formattedTime;
            // Optional: Store the seconds value
            // console.log('Best Time (seconds):', totalSeconds);
        } else if (value !== '') {
            // Clear or warn if input is invalid/zero
            this.value = '';
        }
    });

    async function fetchSuggestions(page) {
        if (isLoadingFeed || !hasMoreSuggestions) return;

        isLoadingFeed = true;
        feedSpinner.style.display = 'flex';

        try {
            const res = await fetch(`/api/music/feed?page=${page}&limit=10`, {
                credentials: 'include'
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to fetch feed");
            }

            const data = await res.json();
            const suggestions = data.suggestions;

            if (suggestions.length === 0) {
                hasMoreSuggestions = false;
                feedEndMessage.style.display = 'block';
            } else {
                renderSuggestions(suggestions);
                feedPage++; // Increment page for the next fetch
            }

        } catch (err) {
            console.error("Error fetching feed:", err);
            // Optionally show an error message to the user in the feed
            feedContainer.innerHTML += `<p style="color: #ef4444;">Error loading feed. Please refresh.</p>`;
        } finally {
            isLoadingFeed = false;
            feedSpinner.style.display = 'none';
        }
    }

    function renderSuggestions(suggestions) {
        const placeholder = 'https://placehold.co/150x150/000000/FFFFFF?text=No+Cover';

        suggestions.forEach(s => {
            const card = document.createElement('div');
            card.className = 'suggestion-card';

            // Sanitize comment to prevent HTML injection
            const safeComment = s.comment_by_user ? 
                s.comment_by_user.replace(/</g, "&lt;").replace(/>/g, "&gt;") : 
                '';
            
            // Format rating and importance
            const rating = s.rating_by_user ? `<b>${s.rating_by_user}/10</b>` : 'No rating';
            const importance = s.importance || 'neutral';
            
            // Simple date formatting
            const date = new Date(s.date_added).toLocaleDateString();

            card.innerHTML = `

                <div class="mainPrefab">
            <div class="albumCover">
                <img class="albumCoverMAIN" src="${s.song_cover_url || placeholder}" alt="Song Cover">
            </div>
            <img class="artistCover"
                src="${s.song_artist_cover_url}">
            <img class="playBtn" src="./content/playIcon.svg">
            <div class="SongInfoContainer">
                <p    style="font-size: 2rem; text-overflow: ellipsis;" class="titleElement">${s.song_name}</p>
                <p class="artistElement">${s.song_artist}</p>
            </div>
            <div class="importanceHolder">
                <img src="./content/Highimportance.svg">
            </div>
            <div class="ratingHolder">
                <svg class="star-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"
                    stroke-linejoin="round">
                    <polygon
                        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2">
                    </polygon>
                </svg>

                <span id="rating-number">${s.rating_by_user}</span>
            </div>
            <img class="userProfilePic" src="media/${s.suggester_avatar || './content/default.jpg'}" alt="Avatar">
            <div class="userInfo">
                <p>${date}</p>
                <p>${s.suggester_username}</p>
            </div>
            <img class="commentsIcon" src="./content/commentsIcon.svg">
            <img class="addIcon" src="./content/addIcon.svg">
            <img class="likeIcon" src="./content/likeIcon.svg">
            <p class="meh">MEH</p>
            <img class="dislikeIcon" src="./content/dislikeIcon.svg">
            <div class="highlightTimeContainer">
                <p>Highlight time:</p>
                <p>${s.recommended_time_by_user}</p>
            </div>
            <div class="publisherCommentHolder">
                <p>Publisher Comment:</p>
                <p>${s.comment_by_user}</p>
            </div>
            <div class="publicStatusHolder">
                <p>Is Pubic:</p>
                <p>${s.visibility_public}</p>
            </div>
        </div>
            `;
            feedContainer.appendChild(card);
        });
    }

    function handleFeedScroll() {
        if (!mainScrollSection) return;

        const { scrollTop, scrollHeight, clientHeight } = mainScrollSection;

        // Check if user is ~300px from the bottom
        if (scrollTop + clientHeight >= scrollHeight - 300) {
            fetchSuggestions(feedPage);
        }
    }

    // Attach scroll listener
    if (mainScrollSection) {
        mainScrollSection.addEventListener('scroll', handleFeedScroll);
    }

    // Initial load of the first page of suggestions
    fetchSuggestions(feedPage);

});
