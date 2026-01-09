window.addEventListener('click', () => {
    chrome.runtime.sendMessage({
        action: "capture_window",
        originUrl: window.location.href
    });
});
