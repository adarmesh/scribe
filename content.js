// Guard against duplicate injections (after extension reload/re-inject)
if (window.__scribeInjected) {
    // Already injected, stop execution
} else {
    window.__scribeInjected = true;

    // Helper function to create circle overlay at click position
    function createCircleOverlay(x, y) {
        // Create canvas element
        const canvas = document.createElement('canvas');
        canvas.id = '__scribe_circle_overlay__';
        canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 2147483647;
        `;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Get canvas context and draw circle
        const ctx = canvas.getContext('2d');
        
        // Circle specifications (Style A: Subtle)
        const radius = 20;
        const fillColor = 'rgba(99, 102, 241, 0.3)'; // Indigo, 30% opacity
        const strokeColor = 'rgba(99, 102, 241, 1)'; // Solid indigo
        const lineWidth = 3;

        // Draw filled circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = fillColor;
        ctx.fill();

        // Draw border
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        // Append to document
        document.body.appendChild(canvas);
        
        return canvas;
    }

    // Helper function to remove any existing overlays
    function removeExistingOverlays() {
        const existing = document.getElementById('__scribe_circle_overlay__');
        if (existing) {
            existing.remove();
        }
    }

    // Handle mousedown events - use capture phase for early interception
    document.addEventListener('mousedown', async (event) => {
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
                // Remove any existing overlay from rapid clicks
                removeExistingOverlays();

                // Create circle overlay at click position
                const overlay = createCircleOverlay(event.clientX, event.clientY);

                // Wait for browser to render the circle (100ms)
                await new Promise(resolve => setTimeout(resolve, 100));

                // Fire-and-forget message to background script
                await chrome.runtime.sendMessage({
                    action: "capture_window",
                    originUrl: window.location.href
                });

                // Small delay to ensure screenshot is captured
                await new Promise(resolve => setTimeout(resolve, 50));

                // Remove the overlay
                overlay.remove();
            }
        } catch (error) {
            // Extension context invalidated or other error
            // Fail silently - new content script will take over after re-injection
            // Clean up any lingering overlays
            removeExistingOverlays();
        }
    }, true); // true = capture phase
}
