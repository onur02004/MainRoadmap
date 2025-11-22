// wishlistHelper.js (googleImageSearch.js)
import 'dotenv/config';

const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_SEARCH_CX;

export async function searchImages(query, count = 10) {
  if (!GOOGLE_API_KEY || !GOOGLE_CX) {
    throw new Error('Google API key or CX is not set');
  }

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', GOOGLE_API_KEY);
  url.searchParams.set('cx', GOOGLE_CX);
  url.searchParams.set('q', query);
  url.searchParams.set('searchType', 'image');
  url.searchParams.set('num', String(Math.min(count, 10))); // 1–10 only

  console.log('Google CSE URL:', url.toString());

  const res = await fetch(url);

  const text = await res.text(); // read raw text for easier debugging
  if (!res.ok) {
    console.error('Google CSE error:', res.status, text);
    throw new Error('Google image search failed');
  }

  const data = JSON.parse(text);

  const items = data.items || [];
  return items.map(item => ({
    title: item.title,
    link: item.link,                       // image URL
    contextLink: item.image?.contextLink,  // page URL
    thumbnail: item.image?.thumbnailLink,
  }));
}
