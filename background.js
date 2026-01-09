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
            // 1. Capture the tab as a DataURL (Base64 string)
            const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });

            // 2. Convert DataURL to Blob for better storage efficiency
            const response = await fetch(dataUrl);
            const blob = await response.blob();

            // 3. Save to IndexedDB
            const db = await getDB();
            const transaction = db.transaction(STORE_NAME, "readwrite");
            const store = transaction.objectStore(STORE_NAME);

            store.add({
                timestamp: Date.now(),
                image: blob,
                url: request.originUrl
            });

            console.log("Capture stored successfully in IndexedDB.");

            // 4. Notify side panel to refresh (if open)
            chrome.runtime.sendMessage({ action: "capture_saved" }).catch(() => {
                // Side panel might not be open, ignore error
            });

        } catch (error) {
            console.error("Error capturing screenshot:", error);
        }
    }
});
