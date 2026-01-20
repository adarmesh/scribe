# Safari Web Extension Compatibility Analysis

This document outlines compatibility considerations when converting the Stepify Chrome extension to Safari using Xcode's web extension converter.

---

## 🔴 Critical Incompatibilities

### 1. Side Panel API (`chrome.sidePanel`) — NOT SUPPORTED

**Files affected:** `background.js`, `manifest.json`

Safari does not support the Side Panel API. The following code will not work:

```javascript
// background.js
chrome.sidePanel.open({ tabId: tab.id });
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
```

```json
// manifest.json
"permissions": ["sidePanel"],
"side_panel": { "default_path": "sidepanel.html" }
```

**Solution:** Replace with a **popup** (`default_popup`) or a detached window via `chrome.windows.create()`.

---

### 2. `chrome.tabs.captureVisibleTab()` — LIMITED SUPPORT

**File affected:** `background.js`

Safari supports this API but:
- Requires explicit `activeTab` permission granted by user interaction
- May fail silently on Apple domains and App Store pages
- Behavior can be inconsistent in Safari's sandbox

> ⚠️ Test extensively and add fallback error handling.

---

### 3. Service Worker Lifecycle

**File affected:** `manifest.json`

Safari supports service workers in Manifest V3, but:
- Terminates service workers more aggressively than Chrome
- `chrome.runtime.onInstalled` may behave differently
- Persistent connections are less reliable

---

## 🟡 Moderate Compatibility Issues

### 4. `chrome.scripting.executeScript()`

**File affected:** `background.js`

Safari supports this but:
- Requires explicit `"scripting"` permission
- May require user to enable the extension per-website in Safari preferences
- Will fail on more restricted pages than Chrome

---

### 5. `<all_urls>` Host Permissions

**File affected:** `manifest.json`

Safari handles this differently:
- Users must explicitly grant permissions per-website
- Safari may prompt users repeatedly
- Consider more specific match patterns if possible

---

### 6. `chrome.storage.local`

**Files affected:** `content.js`, `sidepanel.js`

Works in Safari, but:
- Storage sync between content script and background may have timing differences
- `chrome.storage.onChanged` may fire with slight delays

---

## 🟢 APIs That Should Work

| API | Status |
|-----|--------|
| `chrome.runtime.sendMessage()` | ✅ Works |
| `chrome.runtime.onMessage` | ✅ Works |
| `chrome.tabs.query()` | ✅ Works |
| `chrome.tabs.sendMessage()` | ✅ Works |
| `chrome.tabs.create()` | ✅ Works |
| `chrome.action.onClicked` | ✅ Works |
| Content script injection via manifest | ✅ Works |
| Canvas API | ✅ Works |
| jsPDF / JSZip (bundled libs) | ✅ Works |
| FileReader / Blob APIs | ✅ Works |

---

## 📋 Required Changes Summary

| Priority | Issue | Action |
|----------|-------|--------|
| 🔴 Critical | Side Panel API | Replace with popup or detached window |
| 🔴 Critical | `sidePanel` permission | Remove from manifest |
| 🟡 Medium | Tab capture reliability | Add error handling |
| 🟡 Medium | Service worker lifecycle | Add reconnection logic |
| 🟡 Medium | Permission model | Inform users about per-site permissions |
| 🟢 Low | API namespace | Xcode converter handles `chrome.*` → `browser.*` |

---

## 🛠️ Xcode Conversion Steps

1. Open Xcode → File → New → Project → Safari Extension App
2. Run converter: `xcrun safari-web-extension-converter /path/to/stepify`
3. The converter will flag incompatible APIs
4. Handle the side panel replacement manually
5. Test extensively in Safari

---

## 💡 Side Panel Replacement Options

1. **Popup Window** — Use `chrome.action` with `default_popup`
2. **Detached Window** — Use `chrome.windows.create()` for a floating window
3. **Safari App Extension** — Use native Swift UI (more complex)
