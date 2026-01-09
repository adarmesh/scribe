// Re-inject content script into all existing tabs on extension install/update/reload
chrome.runtime.onInstalled.addListener(async (details) => {
    // Re-inject on install, update, or reload (during development)
    if (details.reason === 'install' || details.reason === 'update') {
        const tabs = await chrome.tabs.query({});

        for (const tab of tabs) {
            // Skip non-http pages (chrome://, chrome-extension://, etc.)
            if (!tab.url?.startsWith('http')) continue;

            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
            } catch (e) {
                // Tab might be closed or restricted, ignore
            }
        }
    }
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
    await chrome.sidePanel.open({ tabId: tab.id });
});

// Set side panel behavior - open on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Handle capture requests from content script
chrome.runtime.onMessage.addListener(async (request, sender) => {
    if (request.action === "capture_window") {
        try {
            // Capture the tab as a DataURL (Base64 string)
            const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });

            // Send to side panel for display
            chrome.runtime.sendMessage({
                action: "capture_added",
                dataUrl: dataUrl,
                url: request.originUrl,
                timestamp: Date.now()
            }).catch(() => {
                // Side panel might not be open
            });

        } catch (error) {
            console.error("Error capturing screenshot:", error);
        }
    }
});
