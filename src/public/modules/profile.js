export async function loadProfilePicture() {
    try {
        const me = await fetch('/meinfo', { credentials: 'include' }).then(r => r.json());
        const pics = document.querySelectorAll('.profilepic');
        
        pics.forEach(pic => {
            if (me.profilePic) {
                pic.src = `/media/${me.profilePic}`;
            } else {
                pic.src = 'content/deafult.jpg';
            }
        });
    } catch (error) {
        console.error('Failed to load profile picture:', error);
        // Set all to default on error
        document.querySelectorAll('.profilepic').forEach(pic => {
            pic.src = 'content/deafult.jpg';
        });
    }
}

loadProfilePicture();