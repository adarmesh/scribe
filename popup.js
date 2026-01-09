const DB_NAME = "CaptureDB";
const STORE_NAME = "screenshots";

// Initialize IndexedDB
function getDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Get all captures from IndexedDB
async function getAllCaptures() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Clear all captures from IndexedDB
async function clearAllCaptures() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Format timestamp to readable date
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Render captures to the popup
async function renderCaptures() {
    const container = document.getElementById('capturesContainer');
    const statsEl = document.getElementById('stats');

    try {
        const captures = await getAllCaptures();

        // Sort by timestamp, newest first
        captures.sort((a, b) => b.timestamp - a.timestamp);

        // Update stats
        statsEl.textContent = `${captures.length} capture${captures.length !== 1 ? 's' : ''}`;

        if (captures.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <p>No captures yet</p>
                    <small>Click anywhere on a page to capture</small>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        for (const capture of captures) {
            const card = document.createElement('div');
            card.className = 'capture-card';

            // Convert blob to URL
            const imageUrl = URL.createObjectURL(capture.image);

            card.innerHTML = `
                <img src="${imageUrl}" alt="Capture from ${capture.url}" title="Click to open in new tab">
                <div class="capture-info">
                    <div class="capture-time">${formatDate(capture.timestamp)}</div>
                    <div class="capture-url" title="${capture.url}">${capture.url}</div>
                </div>
            `;

            // Open image in new tab on click
            card.querySelector('img').addEventListener('click', () => {
                chrome.tabs.create({ url: imageUrl });
            });

            container.appendChild(card);
        }
    } catch (error) {
        console.error('Error loading captures:', error);
        container.innerHTML = `
            <div class="empty-state">
                <p>Error loading captures</p>
                <small>${error.message}</small>
            </div>
        `;
    }
}

// Clear all button handler
document.getElementById('clearBtn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete all captures?')) {
        await clearAllCaptures();
        renderCaptures();
    }
});

// Initial render
renderCaptures();
