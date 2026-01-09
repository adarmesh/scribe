// Listen for storage changes to react to session state
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.isCapturing) {
        // Session state changed - handled automatically via storage
    }
});

// Handle click events - check storage for current session state
window.addEventListener('click', async () => {
    const result = await chrome.storage.local.get(['isCapturing']);
    if (result.isCapturing) {
        chrome.runtime.sendMessage({
            action: "capture_window",
            originUrl: window.location.href
        });
    }
});
