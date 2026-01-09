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

// Delete a single capture by ID
async function deleteCapture(id) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
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
    const now = new Date();
    const diff = now - date;

    // If less than 24 hours ago, show relative time
    if (diff < 86400000) {
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
        return `${Math.floor(diff / 3600000)} hours ago`;
    }

    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Download image
function downloadImage(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Render captures to the side panel
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
                    <h2>No captures yet</h2>
                    <p>Click anywhere on a page to capture a screenshot</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        for (const capture of captures) {
            const card = document.createElement('div');
            card.className = 'capture-card';
            card.dataset.id = capture.id;

            // Convert blob to URL
            const imageUrl = URL.createObjectURL(capture.image);
            const filename = `scribe-${new Date(capture.timestamp).toISOString().slice(0, 19).replace(/[T:]/g, '-')}.png`;

            card.innerHTML = `
                <img src="${imageUrl}" alt="Capture from ${capture.url}" title="Click to open full size">
                <div class="capture-info">
                    <div class="capture-meta">
                        <div class="capture-time">${formatDate(capture.timestamp)}</div>
                        <div class="capture-url" title="${capture.url}">${capture.url}</div>
                    </div>
                    <div class="capture-actions">
                        <button class="btn-icon download" title="Download">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                            </svg>
                        </button>
                        <button class="btn-icon delete" title="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;

            // Open image in new tab on click
            card.querySelector('img').addEventListener('click', () => {
                chrome.tabs.create({ url: imageUrl });
            });

            // Download button
            card.querySelector('.download').addEventListener('click', () => {
                downloadImage(capture.image, filename);
            });

            // Delete button
            card.querySelector('.delete').addEventListener('click', async () => {
                await deleteCapture(capture.id);
                card.style.transition = 'all 0.3s ease';
                card.style.opacity = '0';
                card.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    renderCaptures();
                }, 300);
            });

            container.appendChild(card);
        }
    } catch (error) {
        console.error('Error loading captures:', error);
        container.innerHTML = `
            <div class="empty-state">
                <h2>Error loading captures</h2>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Clear all button handler
document.getElementById('clearBtn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete all captures? This cannot be undone.')) {
        await clearAllCaptures();
        renderCaptures();
    }
});

// Listen for new captures from background script
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "capture_saved") {
        renderCaptures();
    }
});

// Initial render
renderCaptures();

// Refresh captures periodically to update relative times
setInterval(renderCaptures, 60000);
