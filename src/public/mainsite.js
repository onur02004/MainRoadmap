(async function () {
    try {
        console.log('Checking authentication status...');
        const res = await fetch('/api/session', { credentials: 'include' });
        const data = await res.json();

        const label = document.getElementById('authLabel');
        if (!label) return;

        const loggedInInfos = document.getElementsByClassName('logged-in-infos');
        const holder = document.querySelector('.mainfglowerholder');

        if (data.authenticated) {
            loggedInInfos[0].style.display = 'block';

            //label.textContent = data.user.name?.trim() || data.user.uname;
            document.getElementById('usernameLabel').textContent = `${data.user.uname}`;
            document.getElementById('realnameLabel').textContent = `${data.user.name || 'N/A'}`;
            document.getElementById('roleLabel').textContent = `${data.user.role}`;

            console.log('User is authenticated:', data.user);
            console.log('User specific features:', data.user.features);

            const rawFeatures = (data.features ?? data.user?.features ?? []) || [];

            if (!Array.isArray(rawFeatures) || rawFeatures.length === 0) {
                console.warn("⚠️ No features found in API response:", data);
                document.getElementById('featuresyazisi').style.display = 'none';
            }

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
            //holder.innerHTML = '';
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


            const updateWebNotifications = async () => {
                try {
                    const res = await fetch('/api/notifications/latest');
                    const data = await res.json();
                    const holder = document.querySelector('.notificationMainHolder');

                    if (data.notifications && data.notifications.length > 0) {
                        const last = data.notifications[0];

                        // Populate the holder with the latest message and a bell icon
                        holder.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; padding: 10px; width: 100%;">
                    <span style="font-size: 1.5rem; max-width: 90vw";>🔔</span>
                    <div style="overflow: hidden;">
                        <p style="margin: 0; font-weight: bold; color: #52c471;">${last.title}</p>
                        <p style="margin: 0; font-size: 0.9rem; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                            ${last.body}
                        </p>
                    </div>
                </div>
            `;

                        // Visual indicator for unread
                        if (!last.is_read) {
                            holder.style.borderLeft = "4px solid #52c471";
                            holder.style.backgroundColor = "rgba(82, 196, 113, 0.1)";
                        }
                    } else {
                        holder.innerHTML = `<p style="padding: 15px; opacity: 0.5;">No new notifications</p>`;
                    }
                } catch (err) {
                    console.error("Web notif error:", err);
                }
            };

            // Initial check and set interval for every 60 seconds
            updateWebNotifications();
            setInterval(updateWebNotifications, 60000);



            const me = await fetch('/meinfo', { credentials: 'include' }).then(r => r.json());
            const pic = document.querySelector('.profilepic');
            if (pic) {
                if (me.profilePic) pic.src = `/media/${me.profilePic}`;
                else pic.src = 'content/deafult.jpg';
            }

            if (!me.profilePic) {
                console.log('No profil pix');
                const dialog = document.getElementById('profileWarning');
                dialog.hidden = false;
                document.getElementById('profileWarning').style.display = 'flex';
                document.getElementById('closeDialog').addEventListener('click', () => {
                    dialog.hidden = true;
                    document.getElementById('profileWarning').style.display = 'none';
                });
            } else {
                console.log("has profile pic");
                document.getElementById('profileWarning').style.display = 'none';
            }


            // ... inside if (data.authenticated) block ...

            const userEmailStatus = async () => {
                // Check if the user has opted out of seeing these prompts
                const hidePrompt = localStorage.getItem('hideEmailPrompt');
                if (hidePrompt === 'true') return;

                const notificationHolder = document.querySelector('.notificationMainHolder');

                if(me.email && me.email_verified){
                    console.log("has email and verified");
                }
                // SCENARIO 1: No email exists
                else if (!me.email) {
                    showEmailPrompt(
                        "Add email for roadmap updates?",
                        "Get notified about new features and activities.",
                        "Add Email",
                        "/account" // Redirect to account to add email
                    );
                }
                // SCENARIO 2: Email exists but is NOT verified AND NOT confirmed by user prompt
                else if (me.email && !me.email_verified) {
                    showEmailPrompt(
                        `Is ${me.email} correct?`,
                        "Confirm your email to receive important alerts.",
                        "Verify Now",
                        null, // Logic handled by button click
                        true  // isVerification flag
                    );
                    
                }
            };

            const showEmailPrompt = (title, body, actionText, actionLink, isVerification = false) => {
                const holder = document.querySelector('.notificationMainHolder');
                holder.style.height = "auto";
                holder.style.padding = "15px";
                holder.style.flexDirection = "column";
                holder.style.alignItems = "flex-start";

                holder.innerHTML = `
        <div style="width: 100%;">
            <p style="margin: 0; font-weight: bold; color: #52c471;">${title}</p>
            <p style="margin: 5px 0 15px 0; font-size: 0.9rem; opacity: 0.8;">${body}</p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="emailActionBtn" class="dialog-btn" style="margin:0; padding: 5px 15px; font-size: 1rem;">${actionText}</button>
                <button id="emailIgnoreBtn" style="background:transparent; color:#fff; border:1px solid #444; cursor:pointer; border-radius:8px; padding: 5px 15px;">Ignore</button>
                <button id="emailNeverBtn" style="padding: 10px; border-radius:11px; background:#ff4444; border:none; cursor:pointer; font-size: 0.8rem;">Never show again</button>
            </div>
        </div>
    `;

                // Handle "Add/Verify" Button
                document.getElementById('emailActionBtn').addEventListener('click', async () => {
                    if (isVerification) {
                        // Call the endpoint you created earlier to trigger the verification email
                        await fetch('/api/me/update-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ newEmail: me.email })
                        });
                        alert("Verification email sent!");
                        localStorage.removeItem('hideEmailPrompt');
                    } else {
                        window.location.href = actionLink;
                    }
                });

                // Handle "Ignore" (Closes it for this session)
                document.getElementById('emailIgnoreBtn').addEventListener('click', () => {
                    holder.style.display = 'none';
                });

                // Handle "Never show again" (Persistent)
                document.getElementById('emailNeverBtn').addEventListener('click', () => {
                    localStorage.setItem('hideEmailPrompt', 'true');
                    holder.style.display = 'none';
                });
            };

            // Trigger the check
            userEmailStatus();


        } else {
            const notifHolder = document.querySelector('.notificationMainHolder');
            if (notifHolder) notifHolder.style.display = 'none';

            // 2. Clear the internal content of the user info card
            const userInfoCard = document.querySelector('.userinfo');
            if (userInfoCard) {
                // Remove existing items like the profile pic and labels
                userInfoCard.innerHTML = `
            <a href="/login.html" class="full-space-login">
                <span>LOGIN TO ACCESS ROADMAP</span>
            </a>
        `;
                // Adjust padding to let the button fill the edges
                userInfoCard.style.padding = '0';
            }

            // 3. Hide other elements as before
            const featuresLabel = document.getElementById('featuresyazisi');
            if (featuresLabel) featuresLabel.style.display = 'none';

        }
    } catch (err) {
        console.error('Auth check failed:', err);
        const label = document.getElementById('authLabel');
        if (label) label.innerHTML = `<a href="/login.html">Login</a>`;
        const loggedInInfos = document.getElementsByClassName('logged-in-infos');
        loggedInInfos[0].style.display = 'none';
    }


    const mq = window.matchMedia("(min-width: 800px)");
    if (mq.matches) {
        // 1. remove data-aos attributes so AOS won't animate
        document.querySelectorAll("[data-aos]").forEach(el => {
            el.removeAttribute("data-aos");
            el.style.opacity = ""; // optional: let it use normal styles
            el.style.transform = ""; // optional cleanup in case AOS touched it
        });

        // 2. stop AOS from doing anything else
        AOS.refreshHard = () => { };
        AOS.init = () => { };
    }
})();

