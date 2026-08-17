(function() {
    // 1. Automatically inject the stylesheet into the page header
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/treasurehunt/tracker.css'; 
    document.head.appendChild(link);

    // 2. Create a full-screen overlay that blocks access to the page
    const overlay = document.createElement('div');
    overlay.id = 'team-tracker-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: white;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;
    document.body.appendChild(overlay);

    // 3. Wait for the page structure to load, then build the interface
    document.addEventListener("DOMContentLoaded", () => {
        // Find the placeholder target element on the webpage
        const targetContainer = document.getElementById('team-tracker-target');
        if (!targetContainer) return;

        // Inject the universal structure into the overlay
        overlay.innerHTML = `
            <div class="universal-tracker-box">
                <button class="start-btn" id="universalStartBtn">START</button>
                <div class="input-group">
                    <label for="universalTeamInput">Team Name :</label>
                    <input type="text" id="universalTeamInput" class="team-input">
                </div>
            </div>
        `;

        // Focus the input field for better UX
        document.getElementById('universalTeamInput').focus();

        // 4. Attach the click logic
        document.getElementById('universalStartBtn').addEventListener('click', handleTeamSubmit);
        
        // Allow Enter key to submit
        document.getElementById('universalTeamInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleTeamSubmit();
            }
        });

        function handleTeamSubmit() {
            const teamName = document.getElementById('universalTeamInput').value.trim();
            
            if (!teamName) {
                alert('Please enter your Team Name first!');
                return;
            }

            // Persist the team name immediately so other scripts (e.g., purchasebutton)
            // can read it even if the worker response hasn't returned yet.
            try {
                localStorage.setItem('treasureTeamName', teamName);
            } catch (e) {
                // Ignore storage errors (private mode, quotas)
            }

            // Extract the filename without extension
            const pathParts = window.location.pathname.split('/');
            const filename = pathParts[pathParts.length - 1].replace(/\.[^/.]+$/, '');

            // Format time as non-military (e.g., "2:35 PM")
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });

            const payload = {
                name: teamName,
                filename: filename,
                time: timeString
            };

            // Replace with your verified Cloudflare Worker link
            const cloudflareWorkerUrl = "https://swinging-frogs-rrrin.nickandsarah2018.workers.dev/";

            fetch(cloudflareWorkerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(response => {
                if (response.ok) {
                    console.log("Progress logged!");
                    // Remove the overlay completely to reveal the page
                    overlay.remove();
                    // Clean up the target container
                    targetContainer.innerHTML = '';
                }
            })
            .catch(err => {
                console.error("Error:", err);
                alert('Error logging progress. Please try again.');
            });
        }
    });
})();
