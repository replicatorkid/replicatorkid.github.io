(function() {
    // 1. Automatically inject the stylesheet into the page header
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    // Change this line inside your tracker.js file:
    link.href = '/treasurehunt/tracker.css'; 
    document.head.appendChild(link);

    // 2. Wait for the page structure to load, then build the interface
    document.addEventListener("DOMContentLoaded", () => {
        // Find the placeholder target element on the webpage
        const targetContainer = document.getElementById('team-tracker-target');
        if (!targetContainer) return;

        // Inject the universal structure seamlessly
        targetContainer.innerHTML = `
            <div class="universal-tracker-box">
                <button class="start-btn" id="universalStartBtn">START</button>
                <div class="input-group">
                    <label for="universalTeamInput">Team Name :</label>
                    <input type="text" id="universalTeamInput" class="team-input" placeholder="______">
                </div>
            </div>
        `;

        // 3. Attach the exact working click logic you just tested
        document.getElementById('universalStartBtn').addEventListener('click', () => {
            const teamName = document.getElementById('universalTeamInput').value.trim();
            
            if (!teamName) {
                alert('Please enter your Team Name first!');
                return;
            }

            const payload = {
                name: teamName,
                page: window.location.href,
                time: new Date().toLocaleTimeString()
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
                    // OPTIONAL: Define what happens next natively (e.g., hide the button)
                    document.getElementById('universalStartBtn').innerText = "STARTED ✔";
                    document.getElementById('universalStartBtn').disabled = true;
                }
            })
            .catch(err => console.error("Error:", err));
        });
    });
})();
