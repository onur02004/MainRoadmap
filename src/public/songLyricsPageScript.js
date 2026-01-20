let player;
let lyrics = [];
let lyricsInterval;

// 1. Parse the URL path: /listen-to/rihanna disturbia
const path = window.location.pathname;
const queryParts = path.split("/listen-to/");
const rawQuery = queryParts.length > 1 ? decodeURIComponent(queryParts[1]) : "";

// 2. YouTube API Init
window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('yt-player', {
        height: '0', width: '0',
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
};

async function onPlayerReady() {
    if (rawQuery) {
        await loadSongByPath(rawQuery);
    }
}

async function loadSongByPath(query) {
    let searchTrack = query;
    let searchArtist = "";

    // Split if user used a hyphen (e.g., Rihanna - Disturbia)
    if (query.includes("-")) {
        [searchArtist, searchTrack] = query.split("-").map(s => s.trim());
    }

    try {
        // Fetch Song Details (Spotify)
        const detailRes = await fetch(`/api/music/song-details?track=${encodeURIComponent(searchTrack)}&artist=${encodeURIComponent(searchArtist)}`);
        const details = await detailRes.json();

        // Update UI
        document.getElementById('album-art').src = details.imageUrl;
        document.getElementById('song-title').innerText = details.name;
        document.getElementById('artist-name').innerText = details.artist;

        // Set Background Colors
        if (details.colors?.overall) {
            document.getElementById('dynamic-bg').style.background =
                `radial-gradient(circle at bottom left, ${details.colors.overall}, #000000)`;
        }

        // Fetch Sync Data
        const syncRes = await fetch(`/api/auto-sync?track=${encodeURIComponent(details.name)}&artist=${encodeURIComponent(details.artist)}`);
        const syncData = await syncRes.json();

        lyrics = syncData.lyrics;
        renderLyrics();
        player.loadVideoById(syncData.videoId);

        if (player && player.playVideoById) {
            player.playVideoById(syncData.videoId);
        }
    } catch (err) {
        console.error("Error loading song data:", err);
    }
}

function renderLyrics() {
    const container = document.getElementById('lyrics-content');
    container.innerHTML = lyrics.map((l, i) => `
        <div class="lyric-line" id="line-${i}" onclick="seekTo(${l.time})">${l.words}</div>
    `).join('');
}

function onPlayerStateChange(event) {
    const playBtn = document.getElementById('play-pause-btn');

    // Enable the button if the video is Cued (5), Playing (1), or Paused (2)
    if ([YT.PlayerState.CUED, YT.PlayerState.PLAYING, YT.PlayerState.PAUSED].includes(event.data)) {
        playBtn.disabled = false;
    }

    if (event.data === YT.PlayerState.PLAYING) {
        startSync();
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        stopSync();
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
}

function startSync() {
    lyricsInterval = setInterval(() => {
        const time = player.getCurrentTime();
        updateLyricsUI(time);

        const timeline = document.getElementById('timeline');
        timeline.max = player.getDuration();
        timeline.value = time;
        document.getElementById('curr-time').innerText = formatTime(time);

        // Update duration once it's available
        const dur = player.getDuration();
        if (dur) document.getElementById('dur-time').innerText = formatTime(dur);
    }, 100);
}

function stopSync() { clearInterval(lyricsInterval); }

function updateLyricsUI(time) {
    const activeIndex = lyrics.findLastIndex(l => l.time <= time);
    if (activeIndex !== -1) {
        const lines = document.querySelectorAll('.lyric-line');
        lines.forEach(l => l.classList.remove('active'));

        const activeLine = document.getElementById(`line-${activeIndex}`);
        if (activeLine) {
            activeLine.classList.add('active');
            const content = document.getElementById('lyrics-content');
            const offset = activeLine.offsetTop - (window.innerHeight / 2);
            content.style.transform = `translateY(${-offset}px)`;
        }
    }
}

const playBtn = document.getElementById('play-pause-btn');

if (playBtn) {
    playBtn.onclick = () => {
        if (player && typeof player.getPlayerState === 'function') {
            const state = player.getPlayerState();
            
            // If the video is cued or paused, play it
            if (state === YT.PlayerState.CUED || state === YT.PlayerState.PAUSED || state === YT.PlayerState.NOT_STARTED) {
                player.playVideo();
            } 
            // If it's already playing, pause it
            else if (state === YT.PlayerState.PLAYING) {
                player.pauseVideo();
            }
        }
    };
}

const timeline = document.getElementById('timeline');
if (timeline) {
    timeline.oninput = (e) => {
        if (player && player.seekTo) {
            player.seekTo(e.target.value, true);
        }
    };
}

window.seekTo = (time) => player.seekTo(time, true);

function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}