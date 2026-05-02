/** * Smallest UI Units 
 */


/**
 * Component: Back Button
 * Used inside subpages to return to main view.
 */
const BackButton = () => `
    <button onclick="closeSubpage()" style="background:#333; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; margin-bottom:20px;">
        ← Back
    </button>
`;

// Simple card for text-based content
const Card = (title, description, subpageId) => `
    <div class="card" onclick="openSubpage('${subpageId}')">
        <h3>${title}</h3>
        <p>${description}</p>
        <small style="color: #666">Click to view details</small>
    </div>
`;

// Movie card for search results and grids
const MovieCard = (movie) => `
    <div class="movie-card" onclick="openDetails('${movie.id}')">
        <img src="${movie.poster}" loading="lazy" alt="${movie.title}">
        ${movie.watched ? '<div class="watched-badge">✓</div>' : ''}
    </div>
`;

// Full-screen detail view template
const DetailPageTemplate = (m) => `
    <div class="detail-wrapper" style="background-image: url('${m.backdrop || ''}')">
        <button class="back-btn" onclick="closeDetails()">← Back</button>
        <div class="detail-glass-card">
            <img src="${m.poster}" class="main-poster">
            <div class="meta">
                <h1>${m.title}</h1>
                <p>${m.description || 'No description available.'}</p>
                <div class="stats-row">
                    <span>${m.year}</span> | <span>${m.type}</span>
                </div>
            </div>
        </div>
    </div>
`;