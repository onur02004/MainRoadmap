/** * Full Page Layouts 
 */

const PageBuilders = {
    // Layout for the Search tab
    search: () => `
        <div class="search-container">
            <h1>Search Titles</h1>
            <div class="search-box">
                <input 
                    type="text" 
                    id="movie-search-input" 
                    placeholder="Search for a movie or show..." 
                    onkeyup="handleSearch(event)"
                >
            </div>
            <div id="search-results-grid" class="movie-grid">
                <p class="placeholder-text">Type at least 3 characters to search...</p>
            </div>
        </div>
    `,

    // Layout for the Home tab (expects data from backend)
    home: (data) => `
        <h1>Welcome Back</h1>
        <section class="shelf">
            <h2>Featured</h2>
            <div class="movie-grid">
                ${data.saved ? data.saved.map(item => MovieCard(item)).join('') : '<p>No saved items.</p>'}
            </div>
        </section>
    `,

    // Generic layout for text-based pages
    simple: (title, content) => `
        <h1>${title}</h1>
        <div class="content-body">${content}</div>
    `
};