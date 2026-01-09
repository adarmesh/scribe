// Cleanup function to remove listeners when orphaned
function cleanup() {
    window.removeEventListener('click', handleClick);
    chrome.storage.onChanged.removeListener(handleStorageChange);
}

// Handle storage changes
function handleStorageChange(changes, namespace) {
    if (namespace === 'local' && changes.isCapturing) {
        // Session state changed - handled automatically via storage
    }
}

// Handle click events - check storage for current session state
async function handleClick() {
    try {
        const result = await chrome.storage.local.get(['isCapturing']);
        if (result.isCapturing) {
            await chrome.runtime.sendMessage({
                action: "capture_window",
                originUrl: window.location.href
            });
        }
    } catch (error) {
        // Extension was reloaded - clean up orphaned listeners
        if (error.message?.includes('Extension context invalidated')) {
            console.log('Extension context invalidated, cleaning up listeners');
            cleanup();
        }
    }
}

// Register listeners
chrome.storage.onChanged.addListener(handleStorageChange);
window.addEventListener('click', handleClick);
