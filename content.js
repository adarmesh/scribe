// Guard against duplicate injections (after extension reload/re-inject)
if (window.__scribeInjected) {
    // Already injected, stop execution
} else {
    window.__scribeInjected = true;

    // Handle mousedown events - use capture phase for early interception
    document.addEventListener('mousedown', async () => {
        // Wrap everything in try-catch to handle context invalidation
        // When extension reloads, even accessing chrome.runtime can throw
        try {
            // Check if chrome.runtime is still valid
            if (!chrome.runtime?.id) {
                return; // Extension context invalidated, exit silently
            }

            // One-shot read from storage (event-only model, no persistent listeners)
            const { isCapturing } = await chrome.storage.local.get(['isCapturing']);

            if (isCapturing) {
                // Fire-and-forget message to background script
                await chrome.runtime.sendMessage({
                    action: "capture_window",
                    originUrl: window.location.href
                });
            }
        } catch (error) {
            // Extension context invalidated or other error
            // Fail silently - new content script will take over after re-injection
        }
    }, true); // true = capture phase
}
