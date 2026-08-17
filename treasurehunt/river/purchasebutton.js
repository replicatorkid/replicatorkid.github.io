(function(){
    // Inject stylesheet for the purchase button
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/treasurehunt/river/purchasebutton.css';
    document.head.appendChild(link);

    // Helper to build the time string
    function formatTimestamp(d) {
        return d.toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            month: 'numeric',
            day: 'numeric',
            year: 'numeric'
        });
    }

    function createButtonArea() {
        // Find the marquee's container (viewport) so we can insert under it.
        const marqueeEl = document.getElementById('marquee');
        let insertAfter = null;
        if (marqueeEl && marqueeEl.parentElement) {
            insertAfter = marqueeEl.parentElement; // .viewport
        } else {
            // fallback to end of body
            insertAfter = document.body.lastElementChild;
        }

        // Build container & button
        const container = document.createElement('div');
        container.className = 'purchase-button-container';

        const btn = document.createElement('button');
        btn.id = 'purchaseAcquireBtn';
        btn.type = 'button';
        btn.textContent = 'ITEM ACQUIRED';

        const note = document.createElement('div');
        note.className = 'purchase-button-note';
        note.textContent = 'Click once when your team has acquired the item';

        container.appendChild(btn);
        container.appendChild(note);

        // Insert after the determined element
        if (insertAfter && insertAfter.parentNode) {
            insertAfter.parentNode.insertBefore(container, insertAfter.nextSibling);
        } else {
            document.body.appendChild(container);
        }

        return btn;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const btn = createButtonArea();

        // Reuse same Cloudflare Worker endpoint used by tracker.js
        const cloudflareWorkerUrl = "https://swinging-frogs-rrrin.nickandsarah2018.workers.dev/";

        btn.addEventListener('click', () => {
            if (btn.disabled) return;

            // Try to obtain team name in several ways, then prompt if necessary
            let teamName = null;

            try {
                teamName = localStorage.getItem('treasureTeamName');
            } catch (e) {
                // ignore storage errors
                teamName = null;
            }

            // If the tracker overlay input still exists on the page, prefer that value
            const overlayInput = document.getElementById('universalTeamInput');
            if ((!teamName || teamName.trim() === '') && overlayInput) {
                teamName = overlayInput.value && overlayInput.value.trim();
            }

            // If still missing, prompt the user once
            if (!teamName || teamName.trim() === '') {
                teamName = window.prompt('Please enter your Team Name for the acquisition notification:');
                if (!teamName) {
                    // user cancelled or left blank — do nothing
                    return;
                }
            }

            teamName = teamName.trim();

            // Persist team name for future button presses on this device
            try {
                localStorage.setItem('treasureTeamName', teamName);
            } catch (e) {
                // ignore quota or privacy-mode errors
            }

            const now = new Date();
            const timeString = formatTimestamp(now);
            const filename = (window.location.pathname || '').split('/').filter(Boolean).pop() || '';

            const messageText = `${teamName} acquired item at ${timeString}.`;

            const payload = {
                message: messageText,
                team: teamName,
                filename: filename,
                time: timeString,
                event: 'item_acquired'
            };

            // Send POST to Cloudflare Worker
            fetch(cloudflareWorkerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(res => {
                if (res.ok) {
                    // visually disable the button to prevent repeat sends
                    btn.disabled = true;
                    btn.textContent = 'ITEM ACQUIRED';
                    // optional minor visual feedback
                    btn.style.opacity = '0.7';
                    console.log('Acquisition notification sent:', messageText);
                } else {
                    return res.text().then(t => { throw new Error(t || res.statusText); });
                }
            })
            .catch(err => {
                console.error('Error sending acquisition notification:', err);
                alert('Error sending acquisition notification. Please try again.');
            });
        });
    });
})();
