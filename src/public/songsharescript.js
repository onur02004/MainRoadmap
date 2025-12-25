document.addEventListener('DOMContentLoaded', () => {
    // ----- NAVIGATION BETWEEN PAGES -----
    const navLinks = document.querySelectorAll('.nav-option a');
    const pages = document.querySelectorAll('.page');


    // Around line 6 in songsharescript.js
    function showPage(pageName) {
        pages.forEach(p => {
            const isTarget = p.classList.contains(`page-${pageName}`);
            p.classList.toggle('is-active', isTarget);
        });

        // FIX: Force the main section to scroll back to the top
        const mainScrollSection = document.querySelector('section[style*="overflow-y: scroll"]');
        if (mainScrollSection) {
            mainScrollSection.scrollTop = 0;
        }
    }

    function handleNavigation(event) {
        const link = event.currentTarget;
        const page = link.getAttribute('data-page');

        // If this link has NO data-page, let the browser do a normal navigation
        if (!page) {
            return; // do not preventDefault
        }

        // Internal tab navigation
        event.preventDefault();

        // active class on nav links
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // show correct page
        showPage(page);
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
    const selectedSongDurationInput = document.getElementById('selectedSongDuration');
    const selectedSongArtistInput = document.getElementById('selectedSongArtist');
    const selectedSongImageUrlInput = document.getElementById('selectedSongImageUrl');
    const sendSuggestionButton = document.getElementById('sendSuggestionButton');
    const selectedSongTitle = document.getElementById('selectedSongTitle');
    const selectedSongArtistName = document.getElementById('selectedSongArtistName');
    const selectedSongUriInput = document.getElementById('selectedSongUriInput');

    const targetUsersDisplay = document.getElementById('targetUsersDisplay');
    const targetUsersList = document.getElementById('selectedPillsContainer');
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

    const playbackModal = document.getElementById('playbackModal');
    const playbackCloseButton = document.getElementById('playbackCloseButton');
    const playbackTitle = document.getElementById('playbackTitle');
    const playbackArtist = document.getElementById('playbackArtist');
    const playbackSpotifyPreview = document.getElementById('playbackSpotifyPreview');
    const openSpotifyBtn = document.getElementById('openSpotifyBtn');
    const openYoutubeBtn = document.getElementById('openYoutubeBtn');

    const lyricsModal = document.getElementById('lyricsModal');
    const lyricsCloseButton = document.getElementById('lyricsCloseButton');
    const lyricsSongTitle = document.getElementById('lyricsSongTitle');
    const lyricsSongArtist = document.getElementById('lyricsSongArtist');
    const lyricsContent = document.getElementById('lyricsContent');

    const commentsModal = document.getElementById('commentsModal');
    const commentsCloseButton = document.getElementById('commentsCloseButton');
    const commentSongTitleArtist = document.getElementById('commentSongTitleArtist');
    const commentsList = document.getElementById('commentsList');
    const newCommentInput = document.getElementById('newCommentInput');
    const submitCommentBtn = document.getElementById('submitCommentBtn');

    const editModal = document.getElementById('editSuggestionModal');
    const editCloseBtn = document.getElementById('editSuggestionCloseBtn');
    const editIdInput = document.getElementById('editSuggestionId');
    const editRatingInput = document.getElementById('editSongRating');
    const editRatingVal = document.getElementById('editRatingValue');
    const editCommentInput = document.getElementById('editSuggestionComment');
    const saveEditBtn = document.getElementById('saveEditBtn');
    const deleteSuggestionBtn = document.getElementById('deleteSuggestionBtn');

    const reactionsListModal = document.getElementById('reactionsListModal');
    const reactionsList = document.getElementById('reactionsList');
    const reactionsListCloseBtn = document.getElementById('reactionsListCloseBtn');
    const suggestionVisibilityToggle = document.getElementById('suggestionVisibility');

    const btnPublic = document.getElementById('btnPublic');
    const pill = document.getElementById('pill');
    const pubUI = document.getElementById('publicUI');
    const specUI = document.getElementById('specificUI');
    const btnSpecific = document.getElementById('btnSpecific');
    const visibilityCheckbox = document.getElementById('suggestionVisibility');
    const finalUserInput = document.getElementById('finalUserSearchInput');
    const finalResults = document.getElementById('finalUserSearchResults');
    const pillsContainer = document.getElementById('selectedPillsContainer');

    const triggerUserSearchBtn = document.getElementById('triggerUserSearchBtn');

    const importanceCards = document.querySelectorAll('.imp-card');


    let currentSuggestionId = null;
    window.currentLoggedInUserId = null;
    window.isAdmin = false;


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
    // Replace the block at line 144 with this:
    const updateToggleVisibility = () => {
        const isPublic = suggestionVisibilityToggle.checked;
        if (isPublic) {
            // It's public, hide the user list
            if (targetUsersDisplay) targetUsersDisplay.style.display = 'none';
            selectedTargetUsers = [];
            renderSelectedUsers();
        } else {
            // It's private, show the list
            if (targetUsersDisplay) targetUsersDisplay.style.display = 'block';
        }
    };

    // Listen for clicks on your new segmented buttons to trigger the visibility logic
    btnPublic?.addEventListener('click', () => {
        suggestionVisibilityToggle.checked = true;
        updateToggleVisibility();
    });

    btnSpecific?.addEventListener('click', () => {
        suggestionVisibilityToggle.checked = false;
        updateToggleVisibility();
        openUserSearchModal(); // Automatically open search when 'Specific' is clicked
    });

    editTargetUsersBtn?.addEventListener('click', openUserSearchModal);
    userSearchCloseBtn?.addEventListener('click', closeUserSearchModal);
    userSearchDoneBtn?.addEventListener('click', closeUserSearchModal);

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
                //alert("Not Yet implemented, sabir pls tekim burda");
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
        // Check if the container exists to prevent the 'null' error
        if (!pillsContainer) return;

        if (selectedTargetUsers.length === 0) {
            pillsContainer.innerHTML = '<i>No users selected.</i>';
            return;
        }

        pillsContainer.innerHTML = '';
        selectedTargetUsers.forEach((user, index) => {
            const pill = document.createElement('div');
            pill.className = 'user-pill';
            pill.innerHTML = `
            <span>${user.user_name}</span>
            <span class="remove-user" onclick="removeSelectedUser(${index})">×</span>
        `;
            pillsContainer.appendChild(pill);
        });

        updateVisibilityUI();
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

        if (selectedSongDurationInput) {
            selectedSongDurationInput.value = track.duration_ms;
        }

        // Enable "Suggest this song" button
        sendSuggestionButton.disabled = false;

        fetchArtistImage(track);

        // Close the modal after selecting the track!
        closeModal();

        const nextBtn = document.getElementById('nextStep');
        if (nextBtn) {
            nextBtn.click();
        }
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
                    console.log(`Track ${index}: ${track.name} - Artist IDs: ${track.artistIds} - duration: `, formatDuration(track.duration_ms));
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

            // 1. Validate Input
            const payload = {
                name: selectedSongNameInput.value,
                artist: selectedSongArtistInput.value,
                imageUrl: selectedSongImageUrlInput.value,
                uri: document.getElementById('selectedSongUriInput')?.value,
            };

            if (!payload.name || !payload.uri) {
                alert('Please search for and select a song first.');
                return;
            }

            // 2. Gather remaining data
            payload.importance = importanceSelector.querySelector('.imp-card.active')?.getAttribute('data-value') || 'neutral';
            payload.rating = songRatingInput.value;
            payload.bestTime = bestTimeInput.value;
            payload.comment = document.getElementById('suggestionComment').value;
            payload.isPublic = document.getElementById('suggestionVisibility').checked;
            payload.song_artist_cover_url = artistImageUrl;
            payload.song_artist_genre = artistGenres;

            payload.targetUsers = payload.isPublic
                ? null
                : selectedTargetUsers.map(u => u.id);

            // 3. Prevent Double Posting (Disable Button Immediately)
            sendSuggestionButton.textContent = 'Sending...';
            sendSuggestionButton.disabled = true;

            try {
                const response = await fetch('/api/music/suggestions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || `Error ${response.status}`);
                }

                // --- SUCCESS HANDLING ---

                // A. Visual Feedback
                sendSuggestionButton.textContent = 'Success! Redirecting...';
                sendSuggestionButton.style.background = '#22c55e'; // Green color

                // B. Wait a moment so user sees the "Success" message
                setTimeout(() => {
                    // C. Clear the Form Data
                    resetSuggestionForm();

                    // D. Switch to Home Tab automatically
                    document.querySelector('a[data-page="home"]').click();

                    // E. Refresh the Feed to show the new song
                    resetAndReloadFeed();

                    // F. Reset button state (for next time)
                    sendSuggestionButton.disabled = false;
                    sendSuggestionButton.textContent = 'Suggest this song';
                    sendSuggestionButton.style.background = ''; // Reset color
                }, 1000);

            } catch (err) {
                console.error('Suggestion failed:', err);
                alert(`Error submitting suggestion: ${err.message}`);

                // Re-enable button so they can try again if it failed
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

    importanceCards.forEach(card => {
        card.addEventListener('click', function () {
            // Remove 'active' from all cards
            importanceCards.forEach(c => c.classList.remove('active'));
            // Add 'active' to the clicked card
            this.classList.add('active');
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

    function renderSuggestions(suggestions, containerElement = feedContainer) {
        const placeholder = 'https://placehold.co/150x150/000000/FFFFFF?text=No+Cover';

        if (containerElement !== feedContainer) {
            containerElement.innerHTML = '';
        }

        suggestions.forEach(s => {
            const card = document.createElement('div');
            card.className = 'suggestion-card';

            // 1. Determine Importance SVG
            let importanceSvgFile = 'LightningIconYellow.png'; // Default
            switch (s.importance) {
                case 'low':
                    importanceSvgFile = 'iceCubeIcon.png';
                    break;
                case 'high':
                    importanceSvgFile = 'fireIcon.png';
                    break;
                case 'extreme':
                    importanceSvgFile = 'explosionIcon.png';
                    break;
                // 'neutral' case is handled by the default
            }

            // Sanitize comment to prevent HTML injection
            const safeComment = s.comment_by_user ?
                s.comment_by_user.replace(/</g, "&lt;").replace(/>/g, "&gt;") : // Correct sanitization
                '';

            const suggestionUserId = s.user_id || s.suggester_id;

            const isOwner = String(suggestionUserId) === String(currentLoggedInUserId);
            const isPublic = s.visibility_public;
            console.log("Checking owner:" + s.user_id + "==>" + (currentLoggedInUserId) + "|");

            if (isOwner) {
                card.classList.add('is-owner');
            }

            let topBarDisplay = '';      // Controls the holder (visible by default)
            let optionsDisplay = '';     // Controls edit/seen icons (visible by default)
            let targetText = '';         // The text to show

            if (isPublic && !isOwner) {
                // Scenario 1: Public & Not Owner -> Hide everything
                topBarDisplay = 'display: none !important;';
                targetText = '';
            }
            else if (isPublic && isOwner) {
                // Scenario 2: Public & Owner -> "Created by you", options visible
                targetText = 'Created by you';
                optionsDisplay = '';
                console.log("Created By Us");
            }
            else if (!isPublic && !isOwner) {
                // Scenario 3: Private & Not Owner -> "Addressed for YOU!", options HIDDEN
                targetText = 'Addressed for YOU!';
                optionsDisplay = 'display: none !important;';
                console.log("Created FOR Us");
            }
            else if (!isPublic && isOwner) {
                // Scenario 4: Private & Owner -> "Sent Privately", options visible
                targetText = 'Sent Privately';
                optionsDisplay = '';
                console.log("SENT by us");
            }

            // Simple date formatting
            const date = new Date(s.date_added).toLocaleDateString();

            // 2. Updated Card InnerHTML
            const commentIconHTML = `
    <div class="icon-wrapper" style="grid-area: commentsIcon; position: relative;">
        <img class="commentsIcon" data-action="comment" data-id="${s.id}" src="./content/commentsIcon.svg">
        ${s.comment_count > 0 ? `<span class="notification-bubble">${s.comment_count}</span>` : ''}
    </div>`;

            // 2. Prepare HTML for Reaction Count Bubble
            const reactionsHolderHTML = `
    <div class="reatcionsHolder" style="grid-area: reatcionsHolder; position: relative; cursor: pointer;">
        <img class="reactionsIcon" data-id="${s.id}" src="./content/reactionsIcon.svg">
        ${s.reaction_count > 0 ? `<span class="notification-bubble">${s.reaction_count}</span>` : ''}
    </div>`;

            // 3. Inject variables into the template
            card.innerHTML = `
<div class="mainPrefab">
    <div class="targetInformationHolder" style="${topBarDisplay}">
        <p class="tragetInfoText">${targetText}</p>
    </div>
    
    <div class="seenByHolder" style="${topBarDisplay} ${optionsDisplay}">
        <svg class="eyeIcon" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M2.5 12C3.8 8.8 7 6 12 6C17 6 20.2 8.8 21.5 12C20.2 15.2 17 18 12 18C7 18 3.8 15.2 2.5 12Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.6" fill="none"/>
            <circle cx="12" cy="12" r="1.2" fill="currentColor"/>
        </svg>
    </div>

    <div class="editHolder" style="${topBarDisplay} ${optionsDisplay}">
        <svg class="editIcon" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 15.5L14.5 6L18 9.5L8.5 19H5V15.5Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M13.8 6.7L17.3 10.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M4 20H20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
    </div>

    <div class="albumCover">
        <img class="albumCoverMAIN" src="${s.song_cover_url || placeholder}" alt="Song Cover">
    </div>
    <img class="artistCover" src="${s.song_artist_cover_url}">
    <img class="playBtn" src="./content/playIcon.svg">
    
    <div class="SongInfoContainer" style="background-color:${s.overall_dominant_color}">
        <p class="titleElement">${s.song_name}</p>
        <p class="artistElement">${s.song_artist}</p>
    </div>
    
    <div class="importanceHolder" title="${getImportanceText(s.importance)}">
        <img src="./content/${importanceSvgFile}" alt="${s.importance}">
    </div>
    
    <div class="ratingHolder" data-rating="${s.rating_by_user}">
        <svg class="rating-star" viewBox="0 0 24 24">
            <defs>
                <linearGradient id="star-fill-${s.id}" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="${s.rating_by_user * 10}%" stop-color="#FFC107" />
                    <stop offset="${s.rating_by_user * 10}%" stop-color="#334155" />
                </linearGradient>
            </defs>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                fill="url(#star-fill-${s.id})" stroke="#FFC107" stroke-width="1.5" class="star-polygon" style="opacity: 0.3" />
        </svg>
        <span id="rating-number">${s.rating_by_user}</span>
    </div>
    
    <img class="userProfilePic" src="media/${s.suggester_avatar || './content/default.jpg'}" alt="Avatar">
    <div class="userInfo">
        <p>${date}</p>
        <p>${s.suggester_username}</p>
    </div>

    ${commentIconHTML}
    <img class="addIcon" src="./content/addIcon.svg">
    <img class="likeIcon" data-action="like" data-id="${s.id}" src="./content/likeIcon.svg">
    <p class="meh" data-action="meh" data-id="${s.id}">MEH</p>
    <img class="dislikeIcon" data-action="dislike" data-id="${s.id}" src="./content/dislikeIcon.svg">
    ${reactionsHolderHTML}

    <div class="highlightTimeContainer">
        <p>Highlight time:</p>
        <p>${s.recommended_time_by_user || 'N/A'}</p>
    </div>
    <div class="publisherCommentHolder">
        <p>Publisher Comment:</p>
        <p>${safeComment || 'No comment.'}</p>
    </div>
    <div class="publicStatusHolder" data-private="${!s.visibility_public}" data-id="${s.id}">
        <p>Visibility:</p>
        <p>${s.visibility_public ? 'Public' : 'Private'}</p>
    </div>
    <div class="LyricsBtnHolder">
        <p>Lyrics:</p>
        <img class="lyricsIcon" src="./content/lyricsicon.svg">
    </div>
</div>`;

            const mainPrefab = card.querySelector('.mainPrefab');
            let points = s.dominant_colors_points || [];
            if (!Array.isArray(points) && typeof points === 'string') {
                points = points
                    .replace(/[{}]/g, '')
                    .split(',')
                    .map(v => v.trim())
                    .filter(Boolean);
            }

            if (mainPrefab && points.length >= 5) {
                const fallback = s.overall_dominant_color || '#111827';
                const [tlRaw, trRaw, blRaw, brRaw, cRaw] = points;
                const tl = tlRaw || fallback;
                const tr = trRaw || fallback;
                const bl = blRaw || fallback;
                const br = brRaw || fallback;
                const c = cRaw || fallback;

                mainPrefab.style.backgroundColor = fallback;
                mainPrefab.style.backgroundImage = `
                radial-gradient(circle at 0% 0%,     ${tl} 0, transparent 55%),
                radial-gradient(circle at 100% 0%,   ${tr} 0, transparent 55%),
                radial-gradient(circle at 0% 100%,   ${bl} 0, transparent 55%),
                radial-gradient(circle at 100% 100%, ${br} 0, transparent 55%),
                radial-gradient(circle at 50% 50%,   ${c}  0, transparent 70%)
            `;
            }

            if (mainPrefab) {
                const baseColor = s.overall_dominant_color
                    || (Array.isArray(points) && points[4])  // center color as fallback
                    || '#111827';

                const textColor = getReadableTextColor(baseColor);

                // Let all text inside the card inherit this by default
                mainPrefab.style.color = textColor;

                // Add a theme class for finer tuning in CSS
                if (textColor === '#ffffff') {
                    mainPrefab.classList.add('card-on-dark');
                    mainPrefab.classList.remove('card-on-light');
                } else {
                    mainPrefab.classList.add('card-on-light');
                    mainPrefab.classList.remove('card-on-dark');
                }
            }


            const playButton = card.querySelector('.playBtn');
            if (playButton) {
                playButton.addEventListener('click', (e) => {
                    e.preventDefault();

                    // Trigger the backend notification
                    fetch(`/api/music/suggestions/${s.id}/play-notify`, {
                        method: 'POST',
                        credentials: 'include'
                    }).catch(err => console.error("Notification trigger failed", err));

                    showPlaybackModal(s); //
                });
            }

            const lyricsBtn = card.querySelector('.LyricsBtnHolder');
            if (lyricsBtn) {
                lyricsBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    openLyricsForSuggestion(s);
                });
            }

            const commentsIcon = card.querySelector('.commentsIcon');
            if (commentsIcon) {
                commentsIcon.addEventListener('click', (e) => {
                    e.preventDefault();
                    showCommentsModal(s);
                });
            }

            const reactionElements = card.querySelectorAll('[data-action="like"], [data-action="meh"], [data-action="dislike"]');
            reactionElements.forEach(el => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    const action = el.getAttribute('data-action');
                    handleReaction(s.id, action);
                });
            });

            const editHolder = card.querySelector('.editHolder');
            if (editHolder) {
                editHolder.addEventListener('click', (e) => {
                    e.preventDefault();
                    openEditModal(s); // We will define this function below
                });
            }

            // 2. HANDLE REACTIONS LIST CLICK (New)
            const reactionsHolder = card.querySelector('.reatcionsHolder');
            if (reactionsHolder) {
                reactionsHolder.addEventListener('click', (e) => {
                    e.preventDefault();
                    openReactionsModal(s.id); // We will define this function below
                });
            }

            // 3. HANDLE ADD BUTTON WARNING (New)
            const addIcon = card.querySelector('.addIcon');
            if (addIcon) {
                addIcon.addEventListener('click', (e) => {
                    e.preventDefault();
                    alert("⚠️ This feature is still in development! Coming soon.");
                });
            }

            //feedContainer.appendChild(card);
            containerElement.appendChild(card);

            // [NEW] Handle click on Private Visibility status
            const statusHolder = card.querySelector('.publicStatusHolder');
            if (statusHolder && !s.visibility_public) {
                statusHolder.style.cursor = 'pointer';
                statusHolder.title = "See who this was shared with";
                statusHolder.addEventListener('click', (e) => {
                    e.preventDefault();
                    showSharedUsers(s.id);
                });
            }

            // Inside the loop where you create cards
            const impHolder = card.querySelector('.importanceHolder');
            if (impHolder) {
                impHolder.addEventListener('click', (e) => {
                    e.stopPropagation();

                    // Remove any existing bubbles first
                    document.querySelectorAll('.importance-bubble').forEach(b => b.remove());

                    // Create the bubble
                    const bubble = document.createElement('div');
                    bubble.className = 'importance-bubble';
                    bubble.innerText = getImportanceDescription(s.importance);

                    // Append to the holder so it positions relative to it
                    impHolder.appendChild(bubble);

                    // Auto-remove after 3 seconds
                    setTimeout(() => bubble.remove(), 3000);
                });
            }

            // Inside renderSuggestions loop in songsharescript.js
            const ratingHolder = card.querySelector('.ratingHolder');
            if (ratingHolder) {
                ratingHolder.addEventListener('click', (e) => {
                    e.stopPropagation();

                    // Remove existing bubbles
                    document.querySelectorAll('.importance-bubble').forEach(b => b.remove());

                    // Create the bubble
                    const bubble = document.createElement('div');
                    bubble.className = 'importance-bubble';
                    // Get the rating value from the data attribute or inner text
                    const ratingVal = ratingHolder.getAttribute('data-rating') || s.rating_by_user;
                    bubble.innerText = getRatingDescription(ratingVal);

                    ratingHolder.appendChild(bubble);

                    // Auto-remove after 3 seconds
                    setTimeout(() => bubble.remove(), 3000);
                });
            }

            updateReactionUI(s.id, s.current_user_reaction || null);
        });
    }

    function handleFeedScroll() {
        if (!mainScrollSection) return;

        const { scrollTop, scrollHeight, clientHeight } = mainScrollSection;

        // Check if user is ~300px from the bottom
        if (scrollTop + clientHeight >= scrollHeight - 300) {
            startup();
        }
    }

    // Attach scroll listener
    if (mainScrollSection) {
        mainScrollSection.addEventListener('scroll', handleFeedScroll);
    }

    async function startup() {
        await checkLogin(); // Wait for this to finish completely
        fetchSuggestions(feedPage);
    }

    startup();

    function getReadableTextColor(hex) {
        if (!hex || typeof hex !== 'string') return '#ffffff';
        const clean = hex.replace('#', '');
        if (clean.length !== 6) return '#ffffff';

        const r = parseInt(clean.substring(0, 2), 16);
        const g = parseInt(clean.substring(2, 4), 16);
        const b = parseInt(clean.substring(4, 6), 16);

        // YIQ brightness formula
        const yiq = (r * 299 + g * 587 + b * 114) / 1000;

        // threshold ~ 150: tweak if needed
        return yiq >= 150 ? '#000000' : '#ffffff';
    }

    // Add these functions near your existing openModal/closeModal functions
    function openPlaybackModal() {
        playbackModal.classList.add('is-active');
    }

    function closePlaybackModal() {
        playbackModal.classList.remove('is-active');
        playbackSpotifyPreview.innerHTML = ''; // Clear the iframe
    }

    function openLyricsModal() {
        if (!lyricsModal) return;
        lyricsModal.classList.add('is-active');
    }

    function closeLyricsModal() {
        if (!lyricsModal) return;
        lyricsModal.classList.remove('is-active');
        if (lyricsContent) {
            lyricsContent.textContent = '';
        }
    }

    if (lyricsCloseButton) {
        lyricsCloseButton.addEventListener('click', closeLyricsModal);
    }

    // Close lyrics modal if user clicks outside of it
    window.addEventListener('click', (event) => {
        if (event.target === lyricsModal) {
            closeLyricsModal();
        }
    });


    if (playbackCloseButton) {
        playbackCloseButton.addEventListener('click', closePlaybackModal);
    }

    // Close modal if user clicks outside of it
    window.addEventListener('click', (event) => {
        if (event.target === playbackModal) {
            closePlaybackModal();
        }
    });

    window.openCommentsModal = function openCommentsModal() {
        if (!commentsModal) return;
        commentsModal.classList.add('is-active');
    }

    function closeCommentsModal() {
        if (!commentsModal) return;
        commentsModal.classList.remove('is-active');
        commentsList.innerHTML = '';
        newCommentInput.value = '';
    }

    if (commentsCloseButton) {
        commentsCloseButton.addEventListener('click', closeCommentsModal);
    }

    window.addEventListener('click', (event) => {
        if (event.target === commentsModal) {
            closeCommentsModal();
        }
    });


    window.showPlaybackModal = function showPlaybackModal(suggestion) {
        // 1. **CRITICAL FIX**: Use the correct property: 'spotify_uri'
        const songUri = suggestion.spotify_uri;

        // 2. Updated conditional check using the correct variable
        if (!songUri || typeof songUri !== 'string') {
            console.error("Cannot open playback modal: Spotify URI is missing or invalid.", suggestion);
            return;
        }

        fetch(`/api/music/suggestions/${suggestion.id}/play-notify`, {
            method: 'POST',
            credentials: 'include'
        }).catch(err => console.error("Could not notify sharer:", err));

        const trackId = songUri.split(':')[2]; // Gets "1GwuB8Vq48Q82kXzV1Lw0Q"

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


        // 5. Populate the modal content
        playbackTitle.textContent = suggestion.song_name;
        playbackArtist.textContent = `by ${suggestion.song_artist}`;
        playbackSpotifyPreview.innerHTML = iframeHTML;

        // 6. Set the button links
        const spotifyWebUrl = `https://open.spotify.com/track/${trackId}`; // Use standard Spotify Web URL

        const youtubeQuery = `${suggestion.song_name} ${suggestion.song_artist} official audio`;
        const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(youtubeQuery)}`;

        openSpotifyBtn.href = spotifyWebUrl;
        openYoutubeBtn.href = youtubeSearchUrl;

        // 7. Open the modal
        openPlaybackModal();
    }

    async function openLyricsForSuggestion(suggestion) {
        if (!suggestion) return;

        const trackName = suggestion.song_name || '';
        const artistName = suggestion.song_artist || '';

        if (!trackName || !artistName) {
            console.error('Missing song name or artist for lyrics:', suggestion);
            return;
        }

        // Set header + placeholder text
        lyricsSongTitle.textContent = trackName;
        lyricsSongArtist.textContent = `by ${artistName}`;
        lyricsContent.textContent = 'Loading lyrics...';

        openLyricsModal();

        try {
            const res = await fetch(
                `/api/lyrics?artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(trackName)}`,
                { credentials: 'include' }
            );

            let data = null;
            try {
                data = await res.json();
            } catch {
                data = null;
            }

            if (!res.ok) {
                throw new Error(data?.error || `Error ${res.status}`);
            }

            const lyricsText = data?.lyrics || data?.lyrics_text || null;

            if (!lyricsText) {
                lyricsContent.textContent = 'Lyrics not found for this track.';
            } else {
                lyricsContent.textContent = lyricsText;
            }
        } catch (err) {
            console.error('Error fetching lyrics:', err);
            lyricsContent.textContent = 'Error loading lyrics. Please try again later.';
        }
    }

    async function showCommentsModal(suggestion) {
        currentSuggestionId = suggestion.id; // Store the ID
        commentSongTitleArtist.textContent = `${suggestion.song_name} by ${suggestion.song_artist}`;
        openCommentsModal();
        await fetchAndRenderComments(suggestion.id);
    }

    // Function to fetch and render comments
    window.fetchAndRenderComments = async function fetchAndRenderComments(suggestionId) {
        commentsList.innerHTML = '<li>Loading comments...</li>';

        try {
            const res = await fetch(`/api/music/suggestions/${suggestionId}/comments`, {
                credentials: 'include'
            });

            if (!res.ok) throw new Error('Failed to fetch comments');

            const data = await res.json();
            const comments = data.comments;

            if (comments.length === 0) {
                commentsList.innerHTML = '<li>No comments yet. Be the first!</li>';
                return;
            }

            commentsList.innerHTML = '';

            comments.reverse().forEach(c => {
                const li = document.createElement('li');

                li.className = 'search-result-item comment-item';
                li.style.flexDirection = 'column';
                li.style.alignItems = 'flex-start';

                // REQUIRED data for context menu
                li.dataset.commentId = c.id;
                // li.dataset.songId = c.song_id;        // optional; do not rely on it
                li.dataset.suggestionId = suggestionId;   // REQUIRED
                li.dataset.authorId = c.commenter_id;
                li.dataset.authorName = c.commenter_username;


                li.innerHTML = `
    <div style="display:flex; gap:0.5rem; width:100%; align-items:center;">
      <img
        src="media/${c.commenter_avatar || './content/default.jpg'}"
        alt="Avatar"
        class="search-result-cover"
        style="width:25px; height:25px;"
      >
      <span
        class="search-result-title"
        style="font-size:1rem; color:#22d3ee; margin-right:auto;"
      >
        ${escapeHtml(c.commenter_username)}
      </span>
      <span style="font-size:0.8rem; color:#64748b;">
        ${new Date(c.date_added).toLocaleDateString()}
      </span>
    </div>

    <p
      class="comment-text"
      style="margin:0.5rem 0 0 0; font-size:0.95rem; line-height:1.4;"
    >
      ${escapeHtml(c.comment_text)}
    </p>
  `;

                commentsList.appendChild(li);
            });


        } catch (err) {
            console.error('Error fetching comments:', err);
            commentsList.innerHTML = '<li>Error loading comments.</li>';
        }
    }

    // Function to submit a new comment
    if (submitCommentBtn) {
        submitCommentBtn.addEventListener('click', async () => {
            const commentText = newCommentInput.value.trim();
            if (!commentText || !currentSuggestionId) return;

            submitCommentBtn.textContent = 'Posting...';
            submitCommentBtn.disabled = true;

            try {
                const res = await fetch(`/api/music/suggestions/${currentSuggestionId}/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ commentText })
                });

                if (!res.ok) throw new Error('Failed to post comment');

                newCommentInput.value = ''; // Clear input
                submitCommentBtn.textContent = 'Posted!';

                // Re-fetch comments to update the list
                await fetchAndRenderComments(currentSuggestionId);

                setTimeout(() => {
                    submitCommentBtn.textContent = 'Post Comment';
                    submitCommentBtn.disabled = false;
                }, 1500);

            } catch (err) {
                console.error('Error posting comment:', err);
                alert('Failed to post comment.');
                submitCommentBtn.textContent = 'Post Comment';
                submitCommentBtn.disabled = false;
            }
        });
    }

    async function handleReaction(suggestionId, action) {
        console.log(`Reacting to ${suggestionId} with ${action}`);

        try {
            const res = await fetch(`/api/music/suggestions/${suggestionId}/react`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ action })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to submit reaction');
            }

            console.log('New reaction state:', data.currentReaction);
            updateReactionUI(suggestionId, data.currentReaction || null);

        } catch (err) {
            console.error('Error with reaction:', err);
            alert(`Could not process reaction: ${err.message}`);
        }
    }


    function updateReactionUI(suggestionId, currentReaction) {
        // Get the 3 reaction elements for this suggestion
        const likeEl = document.querySelector(`.likeIcon[data-id="${suggestionId}"]`);
        const mehEl = document.querySelector(`.meh[data-id="${suggestionId}"]`);
        const dislikeEl = document.querySelector(`.dislikeIcon[data-id="${suggestionId}"]`);

        // Clear previous state
        [likeEl, mehEl, dislikeEl].forEach(el => el && el.classList.remove('active'));

        // Highlight the new one (if any)
        if (currentReaction === 'like' && likeEl) likeEl.classList.add('active');
        if (currentReaction === 'meh' && mehEl) mehEl.classList.add('active');
        if (currentReaction === 'dislike' && dislikeEl) dislikeEl.classList.add('active');
    }

    async function checkLogin() {
        try {
            console.log('Checking authentication status...');
            const res = await fetch('/api/session', { credentials: 'include' });
            const data = await res.json();

            if (data.authenticated) {
                // FIXED: Store user ID in the dedicated variable
                currentLoggedInUserId = data.user.id;
                isAdmin = (data.user.role == 'admin');
                console.log("Logged in as: " + data.user.uname + " (ID: " + data.user.id + ")");
                console.log("checking again id: " + currentLoggedInUserId);
            } else {
                console.log('User is not authenticated');
            }
        } catch (err) {
            console.error('Auth check failed:', err);
        }
    }


    reactionsListCloseBtn.onclick = () => reactionsListModal.classList.remove('is-active');
    window.onclick = (e) => { if (e.target == reactionsListModal) reactionsListModal.classList.remove('is-active'); }

    async function openReactionsModal(suggestionId) {
        reactionsListModal.classList.add('is-active');
        reactionsList.innerHTML = '<li>Loading reactions...</li>';

        try {
            const res = await fetch(`/api/music/suggestions/${suggestionId}/reactions-list`, { credentials: 'include' });
            const data = await res.json();

            if (!data.reactions || data.reactions.length === 0) {
                reactionsList.innerHTML = '<li style="justify-content:center; color:#ccc;">No reactions yet.</li>';
                return;
            }

            reactionsList.innerHTML = '';
            data.reactions.forEach(r => {
                let iconSrc = '';
                if (r.song_reaction_type === 'like') iconSrc = './content/likeIcon.svg';
                else if (r.song_reaction_type === 'dislike') iconSrc = './content/dislikeIcon.svg';
                else if (r.song_reaction_type === 'meh') iconSrc = null; // Text based

                const li = document.createElement('li');
                li.className = 'search-result-item';
                li.innerHTML = `
                <img src="media/${r.profile_pic_path || './content/default.jpg'}" class="search-result-cover" style="width:30px;height:30px;">
                <span class="search-result-title" style="font-size:1rem;">${r.user_name}</span>
                <div style="margin-left:auto;">
                    ${iconSrc ? `<img src="${iconSrc}" style="width:24px;">` : '<span style="font-weight:bold; color:#0199c2;">MEH</span>'}
                </div>
            `;
                reactionsList.appendChild(li);
            });

        } catch (err) {
            console.error(err);
            reactionsList.innerHTML = '<li>Error loading reactions.</li>';
        }
    }

    editCloseBtn.onclick = () => editModal.classList.remove('is-active');

    // Handle Rating Slider in Edit Modal
    editRatingInput.addEventListener('input', function () {
        editRatingVal.textContent = this.value;
    });

    // Handle Importance Selection in Edit Modal
    const editImpSelector = document.getElementById('editImportanceSelector');
    const editImpBtns = editImpSelector.querySelectorAll('.imp-btn');
    editImpBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            editImpBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    function openEditModal(s) {
        editModal.classList.add('is-active');

        // Populate Data
        editIdInput.value = s.id;
        editRatingInput.value = s.rating_by_user || 5;
        editRatingVal.textContent = s.rating_by_user || 5;
        editCommentInput.value = s.comment_by_user || '';

        // Set Importance
        editImpBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.value === s.importance) btn.classList.add('active');
        });
        // Default to neutral if none matches (fallback)
        if (!s.importance) editImpSelector.querySelector('[data-value="neutral"]').classList.add('active');
    }

    // SAVE CHANGES
    saveEditBtn.addEventListener('click', async () => {
        const id = editIdInput.value;
        const rating = editRatingInput.value;
        const comment = editCommentInput.value;
        const activeImp = editImpSelector.querySelector('.imp-btn.active');
        const importance = activeImp ? activeImp.dataset.value : 'neutral';

        saveEditBtn.textContent = 'Saving...';
        saveEditBtn.disabled = true;

        try {
            const res = await fetch(`/api/music/suggestions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ rating, comment, importance })
            });

            if (res.ok) {
                alert("Suggestion updated!");
                editModal.classList.remove('is-active');
                location.reload(); // Simplest way to refresh feed
            } else {
                throw new Error("Update failed");
            }
        } catch (err) {
            alert("Error updating: " + err.message);
        } finally {
            saveEditBtn.textContent = 'Save Changes';
            saveEditBtn.disabled = false;
        }
    });

    // DELETE SUGGESTION
    deleteSuggestionBtn.addEventListener('click', async () => {
        if (!confirm("Are you sure you want to delete this suggestion? This cannot be undone.")) return;

        const id = editIdInput.value;
        deleteSuggestionBtn.textContent = 'Deleting...';
        deleteSuggestionBtn.disabled = true;

        try {
            const res = await fetch(`/api/music/suggestions/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                //alert("Suggestion deleted.");
                editModal.classList.remove('is-active');
                location.reload(); // Refresh feed
            } else {
                throw new Error("Delete failed");
            }
        } catch (err) {
            alert("Error deleting: " + err.message);
            deleteSuggestionBtn.textContent = 'Delete';
            deleteSuggestionBtn.disabled = false;
        }
    });

    function resetSuggestionForm() {
        // 1. Clear text/comment inputs
        const commentInput = document.getElementById('suggestionComment');
        if (commentInput) commentInput.value = '';

        // 2. Reset the Dynamic Rating (Step 2)
        const ratingSlider = document.getElementById('rating-slider');
        const ratingDisplay = document.getElementById('rating-value'); // Updated ID
        const hiddenRating = document.getElementById('songRating');

        if (ratingSlider) ratingSlider.value = '5';
        if (ratingDisplay) ratingDisplay.textContent = '5.0'; // Fixes the textContent error
        if (hiddenRating) hiddenRating.value = '5';

        // 3. Reset the Highlight Picker (Step 4)
        const highlightSlider = document.getElementById('highlightSlider');
        const highlightDisplay = document.getElementById('highlightDisplay');
        const hiddenBestTime = document.getElementById('bestTimeInput');

        if (highlightSlider) highlightSlider.value = '0';
        if (highlightDisplay) highlightDisplay.textContent = '0:00';
        if (hiddenBestTime) hiddenBestTime.value = '0:00';

        // 4. Clear hidden song data
        if (selectedSongNameInput) selectedSongNameInput.value = '';
        if (selectedSongArtistInput) selectedSongArtistInput.value = '';
        if (selectedSongImageUrlInput) selectedSongImageUrlInput.value = '';
        if (selectedSongUriInput) selectedSongUriInput.value = '';
        if (selectedSongDurationInput) selectedSongDurationInput.value = '';

        // 5. Reset UI Elements
        if (coverImg) {
            coverImg.style.display = 'none';
            coverImg.src = './content/song-placeholder.svg';
        }
        if (spotifyPreviewContainer) spotifyPreviewContainer.innerHTML = '';

        // 6. Reset Importance Cards
        importanceCards.forEach(card => card.classList.remove('active'));
        const neutralCard = document.querySelector('.imp-card.neutral');
        if (neutralCard) neutralCard.classList.add('active');

        updateSharingMode('public');

        // 8. Return to Step 1
        if (typeof setStep === "function") {
            setStep(0);
        }

        selectedTargetUsers = [];
        renderSelectedUsers();
    }

    function resetAndReloadFeed() {
        // 1. Reset feed state variables
        feedPage = 1;
        hasMoreSuggestions = true;
        isLoadingFeed = false; // Ensure lock is released

        // 2. Clear existing cards
        const feedContainer = document.getElementById('suggestionFeed');
        feedContainer.innerHTML = '';

        // 3. Hide "End of Feed" message if it was visible
        const feedEndMessage = document.getElementById('feedEndMessage');
        if (feedEndMessage) feedEndMessage.style.display = 'none';

        // 4. Fetch fresh data
        fetchSuggestions(feedPage);
    }


    // ----- PROFILE PAGE LOGIC (READ ONLY) -----

    const profileUsername = document.getElementById('profilePageUsername');
    const profileRealName = document.getElementById('profilePageRealName');
    const profileAvatar = document.getElementById('profilePageAvatar');
    const profileSongCount = document.getElementById('profileSongCount');
    const profileLikeCount = document.getElementById('profileLikeCount');
    const logoutBtn = document.getElementById('logoutBtn');
    const profileFeedContainer = document.getElementById('profileFeed');

    // 1. Load Profile Data (Aligned with account.html endpoints)
    async function loadUserProfile() {
        try {
            // ERROR FIX: Use '/meinfo' instead of '/api/user/me'
            const res = await fetch('/meinfo', { credentials: 'include' });

            if (!res.ok) {
                if (res.status === 401) {
                    window.location.href = '/login.html'; // Redirect if not logged in
                    return;
                }
                throw new Error("Failed to load profile");
            }

            const profile = await res.json();

            // ERROR FIX: Map correct fields from /meinfo response
            // (account.html uses: username, realName, profilePic)
            profileUsername.textContent = profile.username || "User";
            profileRealName.textContent = profile.realName || "Music Enthusiast";

            // ERROR FIX: Handle Image Path and Typo
            // Your system seems to have a typo 'deafult.jpg' based on account.html
            if (profile.profilePic) {
                profileAvatar.src = `media/${profile.profilePic}`;
            } else {
                profileAvatar.src = 'content/deafult.jpg'; // Matches the file in account.html
            }

            // NOTE: /meinfo does not return stats (song count/likes). 
            // We set them to '-' or 0 for now to prevent errors.
            profileSongCount.textContent = profile.stats?.songs_shared || "-";
            profileLikeCount.textContent = profile.stats?.total_likes_received || "-";

            // Load User's History immediately after profile data
            loadUserHistory();

        } catch (err) {
            console.error(err);
            if (profileUsername) profileUsername.textContent = "Error loading profile";
        }
    }

    // 2. Load User's Song History (Kept the same)
    async function loadUserHistory() {
        if (!profileFeedContainer) return;

        profileFeedContainer.innerHTML = '<div class="spinner"></div>';
        try {
            const res = await fetch('/api/user/my-suggestions', { credentials: 'include' });
            if (!res.ok) throw new Error("Failed to load history");

            const data = await res.json();
            if (data.suggestions.length === 0) {
                profileFeedContainer.innerHTML = '<p style="text-align:center; margin-top:20px; color:#aaa;">You haven\'t suggested any songs yet.</p>';
            } else {
                renderSuggestions(data.suggestions, profileFeedContainer);
            }
        } catch (err) {
            console.error(err);
            profileFeedContainer.innerHTML = '<p style="text-align:center;">Error loading history.</p>';
        }
    }

    // 3. Navigation Listener
    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            if (link.getAttribute('data-page') === 'profile') {
                loadUserProfile();
            }
        });
    });

    // 4. Logout Logic (Aligned with account.html endpoint)
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (!confirm("Are you sure you want to log out?")) return;

            logoutBtn.disabled = true;
            logoutBtn.textContent = '...';

            try {
                // ERROR FIX: Use '/logout' instead of '/api/auth/logout'
                const response = await fetch('/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({})
                });

                if (response.ok || response.status === 401) {
                    window.location.href = '/login.html';
                } else {
                    alert("Logout failed");
                    logoutBtn.disabled = false;
                }
            } catch (err) {
                console.error("Logout failed", err);
                logoutBtn.disabled = false;
            }
        });
    }


    // [NEW] Shared Users Modal Logic
    const sharedUsersModal = document.getElementById('sharedUsersModal');
    const sharedUsersList = document.getElementById('sharedUsersList');
    const sharedUsersCloseBtn = document.getElementById('sharedUsersCloseBtn');

    if (sharedUsersCloseBtn) {
        sharedUsersCloseBtn.addEventListener('click', () => {
            sharedUsersModal.classList.remove('is-active');
        });
    }

    window.addEventListener('click', (event) => {
        if (event.target === sharedUsersModal) {
            sharedUsersModal.classList.remove('is-active');
        }
    });

    async function showSharedUsers(suggestionId) {
        sharedUsersModal.classList.add('is-active');
        sharedUsersList.innerHTML = '<li>Loading users...</li>';

        try {
            const res = await fetch(`/api/music/suggestions/${suggestionId}/targets`, {
                credentials: 'include'
            });
            const data = await res.json();

            if (data.users.length === 0) {
                sharedUsersList.innerHTML = '<li>No specific users found (or user list is empty).</li>';
                return;
            }

            sharedUsersList.innerHTML = '';
            data.users.forEach(user => {
                const li = document.createElement('li');
                li.className = 'search-result-item';
                li.innerHTML = `
                    <img src="media/${user.profile_pic_path || './content/default.jpg'}" class="search-result-cover" style="width: 40px; height: 40px;">
                    <div class="search-result-info">
                        <div class="search-result-title">${user.user_name}</div>
                        <div class="search-result-artist" style="font-size: 0.8rem;">${user.real_name || ''}</div>
                    </div>
                `;
                sharedUsersList.appendChild(li);
            });

        } catch (err) {
            console.error("Error fetching shared users", err);
            sharedUsersList.innerHTML = '<li>Error loading info.</li>';
        }
    }

    // 1. Generate Bars
    // songsharescript.js

    // songsharescript.js - Inside DOMContentLoaded

    // 1. Initialize Rating Bars
    const barsWrapper = document.getElementById('bars-wrapper');
    const totalBars = 20;

    if (barsWrapper && barsWrapper.children.length === 0) {
        for (let i = 0; i < totalBars; i++) {
            const bar = document.createElement('div');
            bar.classList.add('bar');
            // Initial height progression
            bar.style.height = `${30 + (i * 3.5)}%`;
            barsWrapper.appendChild(bar);
        }
    }

    // 2. Define Slider Elements
    const bars = document.querySelectorAll('.bar');
    const ratingSlider = document.getElementById('rating-slider');
    const ratingValDisplay = document.getElementById('rating-value');
    const actualRatingInput = document.getElementById('songRating'); // Hidden field for payload

    /**
     * Updates the visual state of the rating bars and glow based on slider value.
     */
    function updateDynamicRating() {
        if (!ratingSlider) return;

        const val = parseFloat(ratingSlider.value);
        ratingValDisplay.textContent = val.toFixed(1);
        if (actualRatingInput) actualRatingInput.value = val;

        // Help bubble logic
        let bubble = document.getElementById('suggestRatingBubble');
        if (!bubble) {
            bubble = document.createElement('div');
            bubble.id = 'suggestRatingBubble';
            bubble.className = 'importance-bubble';
            const container = document.getElementById('suggestRatingContainer');
            if (container) container.appendChild(bubble);
        }
        if (bubble) bubble.innerText = getRatingDescription(val);

        // Color logic from your example
        let currentColor = '#3b82f6'; // Blue
        if (val > 3 && val <= 6) currentColor = '#4eba6b';      // Green
        else if (val > 6 && val <= 8.5) currentColor = '#f59e0b'; // Orange
        else if (val > 8.5) currentColor = '#ef4444';             // Red

        // Update global glow variable
        document.documentElement.style.setProperty('--primary-glow', currentColor);

        // Animate Bars
        const percentActive = val / 10;
        const activeIndex = Math.floor(percentActive * totalBars);

        bars.forEach((bar, index) => {
            if (index <= activeIndex && val > 0) {
                bar.style.background = 'var(--primary-glow)';
                bar.style.boxShadow = `0 0 15px ${currentColor}66`;
                bar.style.transform = 'scaleY(1.2)';
            } else {
                bar.style.background = '#2d3748';
                bar.style.boxShadow = 'none';
                bar.style.transform = 'scaleY(1)';
            }
        });

        // Auto-remove bubble
        clearTimeout(window.ratingBubbleTimeout);
        window.ratingBubbleTimeout = setTimeout(() => {
            const b = document.getElementById('suggestRatingBubble');
            if (b) b.remove();
        }, 2000);
    }

    // 3. Attach Listener inside the scope
    if (ratingSlider) {
        ratingSlider.addEventListener('input', updateDynamicRating);
        // Initial call to set state
        updateDynamicRating();
    }

    // 2. Importance Card Selection
    // Locate this block in your DOMContentLoaded listener
    const impCards = document.querySelectorAll('.imp-card');
    impCards.forEach(card => {
        card.addEventListener('click', function () {
            // Remove 'active' from all cards
            impCards.forEach(c => c.classList.remove('active'));

            // Add 'active' to the clicked card (triggers the white border)
            this.classList.add('active');

            // Ensure the hidden input or state is updated for your payload
            console.log("Importance Selected:", this.dataset.value);
        });
    });


    // --- HIGHLIGHT PICKER LOGIC ---
    const highlightSlider = document.getElementById('highlightSlider');
    const highlightDisplay = document.getElementById('highlightDisplay');
    const visualizer = document.getElementById('visualizer');
    const totalDurationLabel = document.getElementById('totalDurationLabel');
    const actualBestTimeInput = document.getElementById('bestTimeInput'); // Hidden field
    const totalBarsCount = 40;

    // 1. Create the Visualizer Bars
    for (let i = 0; i < totalBarsCount; i++) {
        const bar = document.createElement('div');
        bar.classList.add('bar');
        const height = 20 + Math.random() * 60;
        bar.style.height = `${height}%`;
        visualizer.appendChild(bar);
    }
    const visualizerBars = visualizer.querySelectorAll('.bar');

    // 2. Formatting Function
    function formatSecondsSimple(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }

    // 3. Update Visuals
    function updateHighlightUI() {
        const val = parseInt(highlightSlider.value);
        const max = parseInt(highlightSlider.max) || 1;
        const percent = val / max;
        const timeStr = formatSecondsSimple(val);

        highlightDisplay.textContent = timeStr;
        actualBestTimeInput.value = timeStr; // Keep hidden input updated for payload

        let color = '#3b82f6';
        if (percent > 0.3) color = '#10b981';
        if (percent > 0.7) color = '#f59e0b';
        if (percent > 0.9) color = '#ef4444';

        document.documentElement.style.setProperty('--primary-glow', color);

        const activeThreshold = Math.floor(percent * totalBarsCount);
        visualizerBars.forEach((bar, index) => {
            if (index <= activeThreshold) {
                bar.style.background = color;
                bar.style.boxShadow = `0 0 8px ${color}aa`;
                bar.style.transform = 'scaleY(1.1)';
            } else {
                bar.style.background = '#334155';
                bar.style.boxShadow = 'none';
                bar.style.transform = 'scaleY(1)';
            }
        });
    }

    highlightSlider.addEventListener('input', updateHighlightUI);

    // 4. Connect to Song Selection
    // Update this inside your existing selectTrack(index) function
    const originalSelectTrack = selectTrack;
    selectTrack = function (index) {
        originalSelectTrack(index); // Run existing logic

        const track = currentResults[index];
        if (track && track.duration_ms) {
            const seconds = Math.floor(track.duration_ms / 1000);
            highlightSlider.max = seconds;
            highlightSlider.value = 0;
            totalDurationLabel.textContent = formatSecondsSimple(seconds);
            updateHighlightUI();
        }
    };


    // --- STEP 5: MODE SWITCHING & MULTI-SELECT ---


    // 1. Corrected Sharing Mode Toggle
    function updateSharingMode(mode) {
        const isPublic = (mode === 'public');

        // Toggle active classes on the buttons
        btnPublic?.classList.toggle('active', isPublic);
        btnSpecific?.classList.toggle('active', !isPublic);

        // Explicitly hide/show the specific search UI
        if (isPublic) {
            pubUI?.classList.remove('hidden');
            specUI?.classList.add('hidden'); // This hides the "Find Users" button
            pillsContainer?.classList.add('hidden');
            selectedTargetUsers = [];
            renderSelectedUsers();
        } else {
            pubUI?.classList.add('hidden');
            specUI?.classList.remove('hidden'); // This shows the "Find Users" button
            pillsContainer?.classList.remove('hidden');
        }

        // Move the pill indicator background
        if (pill) {
            pill.style.transform = isPublic ? 'translateX(0%)' : 'translateX(100%)';
            pill.style.background = isPublic ? 'var(--m-blue)' : 'var(--m-purple)';
        }
    }

    // 2. Attach the search trigger to the new button
    triggerUserSearchBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        openUserSearchModal(); // This opens your existing user selection modal
    });

    btnPublic.addEventListener('click', () => updateSharingMode('public'));
    btnSpecific.addEventListener('click', () => updateSharingMode('specific'));

    // --- MULTI-SELECT SEARCH LOGIC ---
    if (finalUserInput && finalResults) {
        finalUserInput.addEventListener('input', async () => {
            const query = finalUserInput.value.trim();
            if (query.length < 2) {
                finalResults.innerHTML = '';
                return;
            }

            try {
                const res = await fetch(`api/searchUsers?q=${encodeURIComponent(query)}`);
                const users = await res.json();

                finalResults.innerHTML = '';
                users.forEach(user => {
                    const li = document.createElement('div');
                    li.className = 'search-result-item';
                    li.innerHTML = `<span>${user.user_name}</span>`;
                    li.onclick = () => {
                        if (!selectedTargetUsers.some(u => u.id === user.id)) {
                            selectedTargetUsers.push({ id: user.id, user_name: user.user_name });
                            renderSelectedPills();
                        }
                        finalUserInput.value = '';
                        finalResults.innerHTML = '';
                    };
                    finalResults.appendChild(li);
                });
            } catch (err) {
                console.error("Search error", err);
            }
        });
    }

    function renderSelectedPills() {
        if (!pillsContainer) return;
        pillsContainer.innerHTML = '';
        selectedTargetUsers.forEach((user, index) => {
            const pill = document.createElement('div');
            pill.className = 'user-pill';
            pill.innerHTML = `
            <span>${user.user_name}</span>
            <span class="remove-user" onclick="removeSelectedUser(${index})">&times;</span>
        `;
            pillsContainer.appendChild(pill);
        });
    }


    // Global helper for the 'x' button
    window.removeSelectedUser = (index) => {
        selectedTargetUsers.splice(index, 1);
        renderSelectedPills();
    };



    // Locate and replace the navigation block at the bottom of songsharescript.js
    const form = document.getElementById('multiStepSuggestForm');
    if (form) {
        const steps = Array.from(form.querySelectorAll('.suggest-step'));
        const dots = Array.from(document.querySelectorAll('.step-dot'));
        const prev = document.getElementById('prevStep');
        const next = document.getElementById('nextStep');

        let currentIdx = 0;

        const setStep = (i) => {
            currentIdx = Math.min(Math.max(i, 0), steps.length - 1);

            steps.forEach((s, k) => s.classList.toggle('active', k === currentIdx));
            dots.forEach((d, k) => d.classList.toggle('active', k === currentIdx));

            // Manage button visibility
            prev.style.visibility = currentIdx === 0 ? 'hidden' : 'visible';

            if (currentIdx === steps.length - 1) {
                next.style.display = 'none'; // Hide next on last step, let 'Finalize' show
            } else {
                next.style.display = 'block';
                next.textContent = 'Next';
            }
        };

        next.addEventListener('click', (e) => {
            e.preventDefault();
            // Step 1 Validation: Check if URI is present
            if (currentIdx === 0 && !document.getElementById('selectedSongUriInput')?.value) {
                alert("Please search and select a song first!");
                return;
            }
            setStep(currentIdx + 1);
        });

        prev.addEventListener('click', (e) => {
            e.preventDefault();
            setStep(currentIdx - 1);
        });

        // Initialize UI
        setStep(0);
    }
});


// ===== Global Search Modal (Users / Songs) =====
const globalSearchModal = document.getElementById('globalSearchModal');
const openGlobalSearchBtn = document.getElementById('openGlobalSearchBtn');
const globalSearchCloseBtn = document.getElementById('globalSearchCloseBtn');

const globalSearchInput = document.getElementById('globalSearchInput');
const globalSearchBtn = document.getElementById('globalSearchBtn');
const globalSearchStatus = document.getElementById('globalSearchStatus');
const globalSearchResults = document.getElementById('globalSearchResults');
const globalSearchLabel = document.getElementById('globalSearchLabel');

const gsTabs = globalSearchModal ? globalSearchModal.querySelectorAll('.gs-tab') : [];
let globalSearchMode = 'users';

function openGlobalSearchModal() {
    globalSearchModal.classList.add('is-active');
    globalSearchInput.value = '';
    globalSearchResults.innerHTML = '';
    globalSearchStatus.textContent = 'Type at least 2 characters.';
    globalSearchInput.focus();
}

function closeGlobalSearchModal() {
    globalSearchModal.classList.remove('is-active');
}

if (openGlobalSearchBtn) {
    openGlobalSearchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openGlobalSearchModal();
    });
}

if (globalSearchCloseBtn) {
    globalSearchCloseBtn.addEventListener('click', closeGlobalSearchModal);
}

window.addEventListener('click', (event) => {
    if (event.target === globalSearchModal) closeGlobalSearchModal();
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && globalSearchModal.classList.contains('is-active')) {
        closeGlobalSearchModal();
    }
});

// Tabs
gsTabs.forEach(btn => {
    btn.addEventListener('click', () => {
        gsTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        globalSearchMode = btn.dataset.mode;

        globalSearchResults.innerHTML = '';
        globalSearchStatus.textContent = 'Type at least 2 characters.';

        if (globalSearchMode === 'users') {
            globalSearchLabel.textContent = 'Search for a user';
            globalSearchInput.placeholder = 'Type a username...';
        } else {
            globalSearchLabel.textContent = 'Search shared songs';
            globalSearchInput.placeholder = 'Type a song name or artist...';
        }

        globalSearchInput.focus();
    });
});

async function runGlobalSearch() {
    const q = globalSearchInput.value.trim();
    if (q.length < 2) {
        globalSearchStatus.textContent = 'Type at least 2 characters.';
        globalSearchResults.innerHTML = '';
        return;
    }

    globalSearchStatus.textContent = 'Searching...';
    globalSearchResults.innerHTML = '';

    try {
        if (globalSearchMode === 'users') {
            const res = await fetch(`/api/searchUsers?q=${encodeURIComponent(q)}`, { credentials: 'include' });
            if (!res.ok) throw new Error('User search failed');
            const users = await res.json();

            if (!users.length) {
                globalSearchStatus.textContent = 'No users found.';
                return;
            }

            globalSearchStatus.textContent = `Found ${users.length} user(s).`;
            renderGlobalUserResults(users);
        } else {
            const res = await fetch(`/api/music/search-shared?q=${encodeURIComponent(q)}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Song search failed');
            const data = await res.json();
            const songs = data.suggestions || [];

            if (!songs.length) {
                globalSearchStatus.textContent = 'No songs found.';
                return;
            }

            globalSearchStatus.textContent = `Found ${songs.length} song(s).`;
            renderGlobalSongResults(songs);
        }
    } catch (err) {
        console.error(err);
        globalSearchStatus.textContent = 'Search error. Please try again.';
    }
}

function renderGlobalUserResults(users) {
    globalSearchResults.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.className = 'search-result-item';

        li.innerHTML = `
      <img src="media/${user.profile_pic_path || './content/default.jpg'}" alt="Avatar" class="search-result-cover">
      <div class="search-result-info">
        <div class="search-result-title">${user.user_name}</div>
        <div class="search-result-artist">${user.real_name || ''}</div>
      </div>
    `;

        li.addEventListener('click', () => {
            alert("Not Yet implementd, Bi yavas tek basima yetisemiyom");
            closeGlobalSearchModal();
        });

        globalSearchResults.appendChild(li);
    });
}

function renderGlobalSongResults(suggestions) {
    globalSearchResults.innerHTML = '';
    const placeholder = 'https://placehold.co/150x150/000000/FFFFFF?text=No+Cover';

    suggestions.forEach(s => {
        const li = document.createElement('li');
        li.className = 'search-result-item';

        li.innerHTML = `
      <img src="${s.song_cover_url || placeholder}" alt="Cover" class="search-result-cover">
      <div class="search-result-info">
        <div class="search-result-title">${s.song_name}</div>
        <div class="search-result-artist">${s.song_artist}</div>
        <div>Suggested By: ${s.suggester_username}</div>
      </div>
    `;
        li.addEventListener('click', () => {
            closeGlobalSearchModal();
            showSharedSongModal(s);
        });

        globalSearchResults.appendChild(li);
    });
}

if (globalSearchBtn) globalSearchBtn.addEventListener('click', runGlobalSearch);
if (globalSearchInput) {
    globalSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            runGlobalSearch();
        }
    });
}


const commentCtxMenu = document.createElement("div");
commentCtxMenu.id = "commentCtxMenu";
commentCtxMenu.className = "ctx hidden";
commentCtxMenu.innerHTML = `
  <button data-action="share">Share To "Social Point"</button>
  <hr/>
  <button data-action="delete" class="danger">Delete</button>
`;
document.body.appendChild(commentCtxMenu);

let commentCtxTarget = null;

function hideCommentCtx() {
    commentCtxMenu.classList.add("hidden");
    commentCtxTarget = null;
}

document.addEventListener("click", hideCommentCtx);
document.addEventListener("scroll", hideCommentCtx, true);
window.addEventListener("resize", hideCommentCtx);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideCommentCtx(); });


document.addEventListener("contextmenu", (e) => {
    const item = e.target.closest(".comment-item");
    if (!item) return;

    e.preventDefault();

    commentCtxTarget = {
        commentId: item.dataset.commentId,
        suggestionId: item.dataset.suggestionId || String(window.currentSuggestionId || ""),
        authorId: item.dataset.authorId,
        authorName: item.dataset.authorName,
        text: item.querySelector(".comment-text")?.textContent?.trim() || ""
    };


    showCommentCtxAt(e.clientX, e.clientY, commentCtxTarget, item);
});


let pressTimer = null;

document.addEventListener("touchstart", (e) => {
    const item = e.target.closest(".comment-item");
    if (!item) return;

    pressTimer = setTimeout(() => {
        const touch = e.touches[0];
        commentCtxTarget = {
            commentId: item.dataset.commentId,
            suggestionId: item.dataset.suggestionId || String(window.currentSuggestionId || ""),
            authorId: item.dataset.authorId,
            authorName: item.dataset.authorName,
            text: item.querySelector(".comment-text")?.textContent?.trim() || ""
        };
        showCommentCtxAt(touch.clientX, touch.clientY, commentCtxTarget, item);
    }, 550);
}, { passive: true });

document.addEventListener("touchend", () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
});
document.addEventListener("touchmove", () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
});


function showCommentCtxAt(x, y, target, itemEl) {
    const canDelete = (target.authorId === currentLoggedInUserId) || isAdmin;

    const delBtn = commentCtxMenu.querySelector('button[data-action="delete"]');
    if (delBtn) delBtn.style.display = canDelete ? "block" : "none";

    commentCtxMenu.classList.remove("hidden");

    // measure after visible
    const rect = commentCtxMenu.getBoundingClientRect();
    const pad = 8;

    let left = x;
    let top = y;

    if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
    if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;

    commentCtxMenu.style.left = `${Math.max(pad, left)}px`;
    commentCtxMenu.style.top = `${Math.max(pad, top)}px`;
}


commentCtxMenu.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn || !commentCtxTarget) return;

    const t = commentCtxTarget;
    const action = btn.dataset.action;

    hideCommentCtx();

    try {
        if (action === "share") {
            const url = makeCommentShareUrl(t.songId, t.commentId);
            await navigator.clipboard.writeText(url);
            return;
        }

        if (action === "delete") {
            const ok = confirm(`Delete this comment? This cannot be undone.`);
            if (!ok) return;

            await apiDeleteComment(t.commentId);     // implement below

            await fetchAndRenderComments(t.suggestionId);
            return;
        }
    } catch (err) {
        alert("err-> " + err?.message || " Action failed.");
    }
});

async function apiDeleteComment(commentId) {
    const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
        method: "DELETE",
        credentials: "include"
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}


function escapeHtml(str) {
    return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}




// ---- Shared Song Modal ----
const sharedSongModal = document.getElementById('sharedSongModal');
const sharedSongCover = document.getElementById('sharedSongCover');
const sharedSongTitle = document.getElementById('sharedSongTitle');
const sharedSongArtist = document.getElementById('sharedSongArtist');
const sharedSongMeta = document.getElementById('sharedSongMeta');
const sharedSongText = document.getElementById('sharedSongText');
const sharedSongPlayBtn = document.getElementById('sharedSongPlayBtn');
const sharedSongCommentsBtn = document.getElementById('sharedSongCommentsBtn');

let lastSharedSuggestion = null;

function openSharedSongModal() {
    if (!sharedSongModal) return;
    sharedSongModal.classList.add('is-active');
}

function closeSharedSongModal() {
    if (!sharedSongModal) return;
    sharedSongModal.classList.remove('is-active');
    lastSharedSuggestion = null;
}

// Close handlers (click backdrop + close button)
if (sharedSongModal) {
    sharedSongModal.querySelectorAll('[data-close]').forEach(el => {
        el.addEventListener('click', closeSharedSongModal);
    });

    window.addEventListener('click', (e) => {
        if (e.target === sharedSongModal) closeSharedSongModal();
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sharedSongModal.classList.contains('is-active')) {
            closeSharedSongModal();
        }
    });
}

function getSuggestionId(s) {
    return s?.id ?? s?.suggestion_id ?? s?.songId ?? s?.song_id ?? null;
}

function showSharedSongModal(s) {
    lastSharedSuggestion = s;

    const placeholder = '/content/default.jpg';
    const cover = s?.song_cover_url || s?.cover_url || s?.image_url || placeholder;

    sharedSongCover.src = cover;
    sharedSongTitle.textContent = s?.song_name || 'Unknown song';
    sharedSongArtist.textContent = s?.song_artist || '';

    const by = s?.shared_by_username || s?.username || s?.user_name || 'Unknown';
    const when = s?.date_added ? new Date(s.date_added).toLocaleString() : '';
    sharedSongMeta.textContent = `Shared by ${by}${when ? ' • ' + when : ''}`;

    // text/caption (depends on your backend field name)
    sharedSongText.textContent = s?.suggestion_text || s?.text || s?.caption || '';

    openSharedSongModal();
}

if (sharedSongPlayBtn) {
    sharedSongPlayBtn.addEventListener('click', () => {
        if (!lastSharedSuggestion) return;
        // Reuse your existing playback modal :contentReference[oaicite:2]{index=2}
        showPlaybackModal(lastSharedSuggestion);
        closeSharedSongModal();
    });
}

if (sharedSongCommentsBtn) {
    sharedSongCommentsBtn.addEventListener('click', async () => {
        if (!lastSharedSuggestion) return;

        const sid = getSuggestionId(lastSharedSuggestion);
        if (!sid) {
            console.warn('No suggestion id on search result:', lastSharedSuggestion);
            return;
        }

        closeSharedSongModal();

        // Use your existing comments workflow (you already use currentSuggestionId globally) :contentReference[oaicite:3]{index=3}
        currentSuggestionId = sid;

        // If your function is named differently, call the one you actually use to render comments.
        await fetchAndRenderComments(sid);
        openCommentsModal();
    });
}


function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

/**
 * Updates the UI based on whether the suggestion is public or private.
 */
function updateVisibilityUI() {
    // Re-select if not globally available
    const toggle = document.getElementById('suggestionVisibility');
    const displayArea = document.getElementById('specificUI');
    const pills = document.getElementById('selectedPillsContainer');

    if (!toggle) return;

    const isPublic = toggle.checked;

    if (isPublic) {
        if (displayArea) displayArea.classList.add('hidden');
        if (pills) pills.classList.add('hidden');
        // Clear recipients if switching back to public
        selectedTargetUsers = [];
        renderSelectedUsers();
    } else {
        if (displayArea) displayArea.classList.remove('hidden');
        if (pills) pills.classList.remove('hidden');
    }
}

// Ensure the listener at the bottom uses the correct ID and scope:
const visibilityCheckbox = document.getElementById('suggestionVisibility');
if (visibilityCheckbox) {
    visibilityCheckbox.addEventListener('change', updateVisibilityUI);
}

function getImportanceText(level) {
    switch (level) {
        case 'low':
            return "Low: Just a casual share. No rush to listen.";
        case 'neutral':
            return "Natural: A solid recommendation worth checking out.";
        case 'high':
            return "High: This song is fire! You should definitely listen soon.";
        case 'extreme':
            return "Extreme: Life-changing track. Listen to this immediately!";
        default:
            return "Song Importance";
    }
}

function getImportanceDescription(level) {
    const descriptions = {
        'low': "Low: A casual share for when you have extra time.",
        'neutral': "Natural: A solid track that fits the vibe.",
        'high': "High: Seriously good. Don't skip this one!",
        'extreme': "Extreme: Absolute masterpiece. Listen NOW."
    };
    return descriptions[level] || "Song Importance";
}

function getRatingDescription(rating) {
    const val = parseFloat(rating);
    if (val >= 9) return "Masterpiece: A must-listen for everyone.";
    if (val >= 7) return "Great: High quality and very enjoyable.";
    if (val >= 5) return "Good: A solid track worth a play.";
    if (val >= 3) return "Okay: It has its moments, but not for everyone.";
    return "Poor: Not recommended unless you're a die-hard fan.";
}