# Reravel

Chrome extension (Manifest V3) that degrades social media visually to reduce mindless browsing.

## File structure

```
manifest.json      # Extension config, permissions, dynamic registration support
background.js      # Service worker: toggle, snooze, bizarro, message routing, script registration
content.js         # Injected into target sites: filters, vignette, interstitial
popup.html/css/js  # Extension popup: toggle, snooze, bizarro, settings link
options.html/css/js # Settings page: effect sliders, message editor, site list
quotes.js          # 30 quote objects loaded before content.js
icons/             # Yarn spool icons (16, 32, 48, 128px)
```

No build step. No dependencies. No framework.

## Testing

1. Go to `chrome://extensions`, enable Developer Mode
2. Click "Load unpacked", select this directory
3. After code changes, click the reload button on the extension card
4. For `manifest.json` changes, remove and re-add the extension

## Storage layout

**`chrome.storage.local`** (ephemeral/device-specific):
- `enabled` (boolean) - whether filters are active
- `bizarro` (boolean) - bizarro mode flag
- `snoozeUntil` (timestamp) - when current snooze expires

**`chrome.storage.sync`** (persistent/cross-device):
- `sites` (string[]) - hostnames to monitor
- `grayscale`, `contrast`, `opacity`, `vignette`, `timerSeconds` (numbers) - effect sliders
- `interstitialMessage` (string) - custom pause message

## Architecture constraints

- Service worker suspends at any time. Never store state in module-level variables in background.js. Always read from `chrome.storage`.
- Content script registration is dynamic (not declared in manifest) to support custom site lists. Registration calls are serialized through a promise queue to prevent duplicate ID errors.
- All user-provided content must use `textContent` (never `innerHTML`) to prevent XSS.
- CSS injection via `<style>` tags works under Discord's strict CSP. Avoid `element.style` for filter application (gets overridden by site CSS).

## Message types

| Type | From | To | Purpose |
|------|------|----|---------|
| `POPUP_TOGGLE` | popup | background | User toggled on/off |
| `SNOOZE` | popup | background | Start snooze timer |
| `BIZARRO_TOGGLE` | popup | background | Toggle bizarro mode |
| `SETTINGS_UPDATED` | options | background | Slider values changed |
| `SITES_UPDATED` | options | background | Site list changed |
| `SET_STATE` | background | content | Enable/disable with bizarro flag |
| `SET_BIZARRO` | background | content | Bizarro mode changed |
| `UPDATE_SETTINGS` | background | content | Slider settings changed |
