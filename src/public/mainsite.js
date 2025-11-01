(async function () {
    try {
        console.log('Checking authentication status...');
        const res = await fetch('/api/session', { credentials: 'include' });
        const data = await res.json();

        const label = document.getElementById('authLabel');
        if (!label) return;

        const loggedInInfos = document.getElementsByClassName('logged-in-infos');
        const holder = document.querySelector('.featuresHolder');

        if (data.authenticated) {
            loggedInInfos[0].style.display = 'block';

            //label.textContent = data.user.name?.trim() || data.user.uname;
            document.getElementById('usernameLabel').textContent = `${data.user.uname}`;
            document.getElementById('realnameLabel').textContent = `${data.user.name || 'N/A'}`;
            document.getElementById('roleLabel').textContent = `${data.user.role}`;

            console.log('User is authenticated:', data.user);
            console.log('User specific features:', data.user.features);

            const rawFeatures = (data.features ?? data.user?.features ?? []) || [];

            // normalize to { key, label }
            const features = rawFeatures.map(f => ({
                key: f.key ?? f.feature_key ?? f.id ?? String(f),
                label: f.label ?? f.feature_label ?? String(f.label ?? f.key ?? f)
            }));

            // de-duplicate by key
            const seen = new Set();
            const uniq = features.filter(f => {
                const k = String(f.key);
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            });

            // render tiles
            holder.innerHTML = '';
            uniq.forEach(f => {
                const card = document.createElement('div');
                card.className = 'routeoption';
                card.setAttribute('data-aos', 'fade-up');

                card.addEventListener('click', () => {
                    const target = '/' + (f.key || '').toLowerCase();
                    console.log('Navigating to', target);
                    window.location.href = target;
                });

                const h1 = document.createElement('h1');
                h1.textContent = f.label || 'Untitled';

                card.appendChild(h1);
                holder.appendChild(card);
            });

            // refresh AOS so new nodes animate
            if (window.AOS && typeof AOS.refresh === 'function') AOS.refresh();

            console.log('User features (from /api/session):', uniq);

        } else {
            loggedInInfos[0].style.display = 'none';
            label.innerHTML = `<a href="/login.html" style="text-decoration:underline">Login</a>`;
            console.log('User is not authenticated');
        }
    } catch (err) {
        console.error('Auth check failed:', err);
        const label = document.getElementById('authLabel');
        if (label) label.innerHTML = `<a href="/login.html">Login</a>`;
        const loggedInInfos = document.getElementsByClassName('logged-in-infos');
        loggedInInfos[0].style.display = 'none';
    }
})();

