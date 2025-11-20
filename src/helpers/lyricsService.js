export async function getFreeLyrics(artist, track) {
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(track)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API returned ${res.status}`);
  }

  const data = await res.json();

  if (!data.lyrics) {
    return null; // lyrics not found
  }

  console.log("LYRICS FOUND");
  return data.lyrics.trim();
}


// freeLyrics.js

function cleanTrackTitle(raw) {
  if (!raw) return "";
  let title = raw;

  // Remove content in parentheses/brackets
  title = title.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "");

  // Split by " - " and keep the first part that doesn't look like metadata
  const parts = title.split(/\s*-\s*/);
  if (parts.length > 1) {
    const main = parts.find(p =>
      !/remaster|remix|version|edit|karaoke|instrumental|from /i.test(p)
    );
    title = main || parts[0];
  }

  // Collapse spaces
  title = title.replace(/\s{2,}/g, " ").trim();
  return title;
}

function cleanArtistName(raw) {
  if (!raw) return "";
  let artist = raw;

  // Remove "feat. X", "featuring X", "with X" etc.
  artist = artist.replace(/\(feat.*?\)/i, "");
  artist = artist.replace(/feat\..*/i, "");
  artist = artist.replace(/featuring.*/i, "");
  artist = artist.replace(/with.*/i, "");

  // Also strip parentheses/brackets
  artist = artist.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "");

  artist = artist.replace(/\s{2,}/g, " ").trim();
  return artist;
}

async function callLyricsAPI(artist, track) {
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(
    artist
  )}/${encodeURIComponent(track)}`;

  const res = await fetch(url);
  if (!res.ok) {
    return null; // 404 etc.
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return null;
  }

  if (!data || !data.lyrics) return null;
  return data.lyrics.trim();
}

// Main exported helper
export async function getFreeLyricsSmart(artistRaw, trackRaw) {
  const artist = artistRaw || "";
  const track = trackRaw || "";

  // 1) Try original
  let lyrics = await callLyricsAPI(artist, track);
  if (lyrics) return lyrics;

  // 2) Try cleaned versions
  const cleanedTrack = cleanTrackTitle(track);
  const cleanedArtist = cleanArtistName(artist);

  // Try: cleaned track + original artist
  if (cleanedTrack !== track) {
    lyrics = await callLyricsAPI(artist, cleanedTrack);
    if (lyrics) return lyrics;
  }

  // Try: cleaned track + cleaned artist
  if (cleanedTrack !== track || cleanedArtist !== artist) {
    lyrics = await callLyricsAPI(cleanedArtist, cleanedTrack);
    if (lyrics) return lyrics;
  }

  // Last resort: cleaned track only with cleaned artist
  return null;
}
