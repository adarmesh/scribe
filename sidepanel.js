// Session state
let isCapturing = false;
let sessionCaptures = [];
let sessionTitle = 'Stepify';

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

const clearAllBtn = document.getElementById('clearAllBtn');
const footerButtons = document.getElementById('footerButtons');
const footer = document.getElementById('footer');
const container = document.getElementById('capturesContainer');
const statsEl = document.getElementById('stats');
const emptyState = document.getElementById('emptyState');
const sessionTitleInput = document.getElementById('sessionTitle');
const sessionIcon = document.getElementById('sessionIcon');

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
    statsEl.classList.add('hidden');

    // Swap camera icon with recording dot
    sessionIcon.innerHTML = '<div class="recording-dot"></div>';

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
        caption: 'Click'
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
        <div class="capture-caption-container">
            <input type="text" class="capture-caption" value="${capture.caption}" placeholder="Enter caption...">
        </div>
        <img src="${imageUrl}" alt="${capture.caption}" title="Click to open full size">
        <div class="capture-info">
            <div class="capture-meta">
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

    // Update caption on input change
    card.querySelector('.capture-caption').addEventListener('input', (e) => {
        capture.caption = e.target.value;
    });

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

// Renumber captures after deletion (legacy, no longer updates display)
function renumberCaptures() {
    // Captions are now independent, no renumbering needed
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

    // Swap recording dot back to camera icon
    sessionIcon.innerHTML = '📸';

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
        const folderName = sessionTitle || 'Stepify';
        const folder = zip.folder(folderName);

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
        const sanitizedTitle = (sessionTitle || 'Stepify').replace(/[^a-z0-9_-]/gi, '_');
        const filename = `${sanitizedTitle}-${timestamp}.zip`;

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

// Helper: Convert blob to base64 data URL
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Download as PDF
async function downloadPdf() {
    downloadPdfBtn.disabled = true;
    downloadPdfBtn.textContent = 'Saving...';

    try {
        const { jsPDF } = window.jspdf;

        // Landscape A4: 297mm x 210mm
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = 297;
        const pageHeight = 210;
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);

        // === COVER PAGE ===
        pdf.setFillColor(26, 26, 46); // Dark background
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');

        // Title - dynamically adjust font size based on length
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        const pdfTitle = sessionTitle || 'Stepify';

        // Calculate appropriate font size based on title length
        let titleFontSize = 36;
        if (pdfTitle.length > 50) {
            titleFontSize = 20;
        } else if (pdfTitle.length > 30) {
            titleFontSize = 28;
        } else if (pdfTitle.length > 20) {
            titleFontSize = 32;
        }

        pdf.setFontSize(titleFontSize);

        // Split title into multiple lines if necessary
        const maxWidth = pageWidth - (margin * 4); // Leave extra margin for title
        const titleLines = pdf.splitTextToSize(pdfTitle, maxWidth);

        // Calculate starting Y position to center the title block
        const lineHeight = titleFontSize * 0.35; // Approximate line height in mm
        const totalTitleHeight = titleLines.length * lineHeight;
        let titleY = 70 - (totalTitleHeight / 2) + lineHeight;

        // Draw each line of the title
        titleLines.forEach((line, index) => {
            pdf.text(line, pageWidth / 2, titleY + (index * lineHeight), { align: 'center' });
        });

        // Capture date
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(150, 150, 150);
        const captureDate = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        pdf.text(captureDate, pageWidth / 2, 85, { align: 'center' });

        // Stats
        pdf.setFontSize(18);
        pdf.setTextColor(99, 102, 241); // Indigo accent
        pdf.text(`${sessionCaptures.length} Capture${sessionCaptures.length !== 1 ? 's' : ''}`, pageWidth / 2, 105, { align: 'center' });

        // Table of Contents header
        pdf.setFontSize(14);
        pdf.setTextColor(200, 200, 200);
        pdf.text('Table of Contents', margin, 130);

        // TOC items
        pdf.setFontSize(11);
        pdf.setTextColor(150, 150, 150);
        let tocY = 140;
        for (let i = 0; i < Math.min(sessionCaptures.length, 10); i++) {
            const capture = sessionCaptures[i];
            const tocText = `${i + 1}. ${capture.caption || 'Untitled'}`;
            pdf.text(tocText, margin + 5, tocY);
            tocY += 6;
        }
        if (sessionCaptures.length > 10) {
            pdf.text(`... and ${sessionCaptures.length - 10} more`, margin + 5, tocY);
        }

        // === CAPTURE PAGES ===
        for (let i = 0; i < sessionCaptures.length; i++) {
            pdf.addPage();

            const capture = sessionCaptures[i];
            const pageNum = i + 2; // Cover is page 1

            // White background for content pages
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageWidth, pageHeight, 'F');

            // Caption as title (left-aligned)
            pdf.setTextColor(30, 30, 30);
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            const caption = capture.caption || 'Untitled';
            pdf.text(caption, margin, margin + 8);

            // Timestamp below caption
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(120, 120, 120);
            const timestamp = new Date(capture.timestamp).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'medium'
            });
            pdf.text(timestamp, margin, margin + 15);

            // Convert image blob to base64
            const imgData = await blobToBase64(capture.image);

            // Calculate image dimensions to fit page width
            const img = new Image();
            await new Promise((resolve) => {
                img.onload = resolve;
                img.src = imgData;
            });

            const imgAspect = img.width / img.height;
            let imgWidth = contentWidth;
            let imgHeight = imgWidth / imgAspect;

            // Available height for image (accounting for title, footer)
            const titleAreaHeight = 25;
            const footerAreaHeight = 15;
            const availableHeight = pageHeight - margin - titleAreaHeight - margin - footerAreaHeight;

            // If image is too tall, scale by height instead
            if (imgHeight > availableHeight) {
                imgHeight = availableHeight;
                imgWidth = imgHeight * imgAspect;
            }

            // Center image horizontally
            const imgX = (pageWidth - imgWidth) / 2;
            const imgY = margin + titleAreaHeight;

            // Add image with border
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.5);
            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth, imgHeight);
            pdf.rect(imgX, imgY, imgWidth, imgHeight, 'S');

            // Footer: URL and page number
            pdf.setFontSize(8);
            pdf.setTextColor(150, 150, 150);

            // URL (truncated if too long)
            const url = capture.url || '';
            const maxUrlLength = 80;
            const displayUrl = url.length > maxUrlLength ? url.substring(0, maxUrlLength) + '...' : url;
            pdf.text(displayUrl, margin, pageHeight - margin);

            // Page number (right-aligned)
            pdf.text(`Page ${pageNum} of ${sessionCaptures.length + 1}`, pageWidth - margin, pageHeight - margin, { align: 'right' });
        }

        // Save the PDF
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        const sanitizedTitle = (sessionTitle || 'Stepify').replace(/[^a-z0-9_-]/gi, '_');
        const filename = `${sanitizedTitle}-${timestamp}.pdf`;
        pdf.save(filename);

        // Reset session after successful download
        resetSession();

    } catch (error) {
        console.error('Error creating PDF:', error);
        alert('Error creating PDF file: ' + error.message);
        downloadPdfBtn.disabled = false;
        downloadPdfBtn.textContent = 'PDF';
    }
}



// Reset session to initial state
function resetSession() {
    isCapturing = false;
    sessionCaptures = [];

    // Update UI
    startBtn.classList.remove('hidden');
    footer.classList.add('hidden');
    statsEl.classList.add('hidden');

    // Swap recording dot back to camera icon
    sessionIcon.innerHTML = '📸';

    // Reset buttons visibility
    footerButtons.classList.remove('hidden');
    downloadButtons.classList.add('hidden');
    downloadZipBtn.disabled = false;
    downloadZipBtn.textContent = 'ZIP';
    downloadPdfBtn.disabled = false;
    downloadPdfBtn.textContent = 'PDF';

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

// Session title event listener
sessionTitleInput.addEventListener('input', (e) => {
    sessionTitle = e.target.value || 'Stepify';
    chrome.storage.local.set({ sessionTitle });
});


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
chrome.storage.local.get(['isCapturing', 'sessionTitle'], (result) => {
    if (result.isCapturing) {
        // Resume session UI (but captures are lost on sidepanel close)
        startSession();
    }
    if (result.sessionTitle) {
        sessionTitle = result.sessionTitle;
        sessionTitleInput.value = sessionTitle;
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
