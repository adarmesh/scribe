// Session state
let isCapturing = false;
let sessionCaptures = [];

// Sync isCapturing with storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.isCapturing) {
        isCapturing = changes.isCapturing.newValue;
    }
});

// Initialize isCapturing from storage
chrome.storage.local.get(['isCapturing'], (result) => {
    isCapturing = result.isCapturing || false;
});

// DOM elements
const startBtn = document.getElementById('startBtn');
const completeBtn = document.getElementById('completeBtn');
const downloadButtons = document.getElementById('downloadButtons');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const downloadPptxBtn = document.getElementById('downloadPptxBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const footerButtons = document.getElementById('footerButtons');
const footer = document.getElementById('footer');
const container = document.getElementById('capturesContainer');
const statsEl = document.getElementById('stats');
const recordingIndicator = document.getElementById('recordingIndicator');
const emptyState = document.getElementById('emptyState');

// Format timestamp to readable time
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Start capture session
function startSession() {
    isCapturing = true;
    sessionCaptures = [];

    // Update UI
    startBtn.classList.add('hidden');
    footer.classList.remove('hidden');
    recordingIndicator.classList.remove('hidden');
    statsEl.classList.add('hidden');

    // Clear container and show hint
    container.innerHTML = `
        <div class="session-hint" id="sessionHint">
            <p>Click anywhere on the page to capture screenshots</p>
        </div>
    `;

    // Notify content scripts that session started
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "session_started" }).catch(() => { });
        }
    });

    // Store session state
    chrome.storage.local.set({ isCapturing: true });
}

// Add capture to the session
function addCapture(imageBlob, url) {
    const capture = {
        id: Date.now(),
        timestamp: Date.now(),
        image: imageBlob,
        url: url,
        number: sessionCaptures.length + 1
    };

    sessionCaptures.push(capture);

    // Remove hint if this is the first capture
    const hint = document.getElementById('sessionHint');
    if (hint) {
        hint.remove();
    }

    // Create capture card
    const card = document.createElement('div');
    card.className = 'capture-card';
    card.dataset.id = capture.id;

    const imageUrl = URL.createObjectURL(imageBlob);

    card.innerHTML = `
        <img src="${imageUrl}" alt="Capture #${capture.number}" title="Click to open full size">
        <div class="capture-info">
            <div class="capture-meta">
                <div class="capture-number">Capture #${capture.number}</div>
                <div class="capture-time">${formatTime(capture.timestamp)}</div>
            </div>
            <div class="capture-actions">
                <button class="btn-icon delete" title="Remove">
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

    // Delete button
    card.querySelector('.delete').addEventListener('click', () => {
        const index = sessionCaptures.findIndex(c => c.id === capture.id);
        if (index > -1) {
            sessionCaptures.splice(index, 1);
        }
        card.style.transition = 'all 0.3s ease';
        card.style.opacity = '0';
        card.style.transform = 'translateX(100%)';
        setTimeout(() => {
            card.remove();
            updateStats();
            renumberCaptures();
        }, 300);
    });

    container.appendChild(card);
    updateStats();

    // Auto-scroll to bottom after image loads (so scrollHeight is accurate)
    const img = card.querySelector('img');
    img.onload = () => {
        container.scrollTop = container.scrollHeight;
    };
}

// Update capture numbers after deletion
function renumberCaptures() {
    sessionCaptures.forEach((capture, index) => {
        capture.number = index + 1;
    });

    const cards = container.querySelectorAll('.capture-card');
    cards.forEach((card, index) => {
        const numberEl = card.querySelector('.capture-number');
        if (numberEl) {
            numberEl.textContent = `Capture #${index + 1}`;
        }
    });
}

// Update stats display
function updateStats() {
    statsEl.textContent = `${sessionCaptures.length} capture${sessionCaptures.length !== 1 ? 's' : ''}`;
    if (sessionCaptures.length > 0) {
        statsEl.classList.remove('hidden');
    } else {
        statsEl.classList.add('hidden');
    }
}

// Clear all captures but keep session going
function clearAllCaptures() {
    sessionCaptures = [];

    // Clear container and show hint again
    container.innerHTML = `
        <div class="session-hint" id="sessionHint">
            <p>Click anywhere on the page to capture screenshots</p>
        </div>
    `;

    updateStats();
}

// Complete session - stop capturing and show download buttons
function completeSession() {
    // If no captures, just reset the session
    if (sessionCaptures.length === 0) {
        resetSession();
        return;
    }

    // Stop capturing
    isCapturing = false;
    chrome.storage.local.set({ isCapturing: false });

    // Update UI - hide footer buttons, show download buttons
    footerButtons.classList.add('hidden');
    downloadButtons.classList.remove('hidden');
    recordingIndicator.classList.add('hidden');

    // Notify content scripts that session ended
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { action: "session_ended" }).catch(() => { });
        });
    });
}

// Download as ZIP
async function downloadZip() {
    downloadZipBtn.disabled = true;
    downloadZipBtn.textContent = 'Saving...';

    try {
        const zip = new JSZip();
        const folder = zip.folder("scribe-captures");

        // Add each capture to the ZIP
        for (let i = 0; i < sessionCaptures.length; i++) {
            const capture = sessionCaptures[i];
            const filename = `capture-${String(i + 1).padStart(3, '0')}.png`;
            folder.file(filename, capture.image);
        }

        // Add a simple manifest/info file
        const manifest = {
            captureDate: new Date().toISOString(),
            totalCaptures: sessionCaptures.length,
            captures: sessionCaptures.map((c, i) => ({
                number: i + 1,
                timestamp: new Date(c.timestamp).toISOString(),
                url: c.url
            }))
        };
        folder.file("manifest.json", JSON.stringify(manifest, null, 2));

        // Generate the ZIP file
        const zipBlob = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 6 }
        });

        // Create download link
        const zipUrl = URL.createObjectURL(zipBlob);
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        const filename = `scribe-captures-${timestamp}.zip`;

        // Trigger download
        const a = document.createElement('a');
        a.href = zipUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Reset session after successful download
        resetSession();

    } catch (error) {
        console.error('Error creating ZIP:', error);
        alert('Error creating ZIP file: ' + error.message);
        downloadZipBtn.disabled = false;
        downloadZipBtn.textContent = 'ZIP';
    }
}

// Download as PDF (placeholder - needs implementation)
async function downloadPdf() {
    alert('PDF export coming soon!');
}

// Download as PPTX (placeholder - needs implementation)
async function downloadPptx() {
    alert('PPTX export coming soon!');
}

// Reset session to initial state
function resetSession() {
    isCapturing = false;
    sessionCaptures = [];

    // Update UI
    startBtn.classList.remove('hidden');
    footer.classList.add('hidden');
    recordingIndicator.classList.add('hidden');
    statsEl.classList.add('hidden');

    // Reset buttons visibility
    footerButtons.classList.remove('hidden');
    downloadButtons.classList.add('hidden');
    downloadZipBtn.disabled = false;
    downloadZipBtn.textContent = 'ZIP';

    // Show empty state
    container.innerHTML = `
        <div class="empty-state" id="emptyState">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <h2>Ready to Capture</h2>
            <p>Click "Start Capture Session" to begin recording your screen clicks</p>
        </div>
    `;

    // Store session state
    chrome.storage.local.set({ isCapturing: false });

    // Notify content scripts that session ended
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { action: "session_ended" }).catch(() => { });
        });
    });
}

// Event listeners
startBtn.addEventListener('click', startSession);
completeBtn.addEventListener('click', completeSession);
clearAllBtn.addEventListener('click', clearAllCaptures);
downloadZipBtn.addEventListener('click', downloadZip);
downloadPdfBtn.addEventListener('click', downloadPdf);
downloadPptxBtn.addEventListener('click', downloadPptx);

// Listen for new captures from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "capture_added" && isCapturing) {
        // Convert base64 to blob
        fetch(request.dataUrl)
            .then(res => res.blob())
            .then(blob => {
                addCapture(blob, request.url);
            });
    }
    if (request.action === "get_session_state") {
        sendResponse({ isCapturing });
    }
});

// Check for existing session state on load
chrome.storage.local.get(['isCapturing'], (result) => {
    if (result.isCapturing) {
        // Resume session UI (but captures are lost on sidepanel close)
        startSession();
    }
});

// Add CSS for spinner animation
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    .spin {
        animation: spin 1s linear infinite;
    }
`;
document.head.appendChild(style);
