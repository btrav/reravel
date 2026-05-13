const DEFAULT_SITES = [
  'reddit.com',
  'youtube.com',
  'discord.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'tiktok.com',
  'facebook.com',
  'threads.net',
  'snapchat.com',
  'pinterest.com',
  'tumblr.com',
  'bsky.app',
  'twitch.tv',
  'imgur.com',
  'quora.com',
  'mastodon.social',
  'news.ycombinator.com',
];
const CONTENT_SCRIPT_ID = 'reravel-content';
const SNOOZE_ALARM = 'reravel-snooze';

// Convert hostname to match pattern for chrome.scripting
function toMatchPattern(hostname) {
  return `https://*.${hostname}/*`;
}

// Serialize registration calls to prevent race conditions
let registrationQueue = Promise.resolve();

function registerContentScript() {
  registrationQueue = registrationQueue.then(doRegister).catch(() => {});
  return registrationQueue;
}

async function doRegister() {
  // Wipe all dynamically registered scripts to avoid duplicate ID errors
  try {
    await chrome.scripting.unregisterContentScripts();
  } catch (_) {}

  const { sites } = await chrome.storage.sync.get('sites');
  const siteList = sites || DEFAULT_SITES;

  if (siteList.length === 0) return;

  await chrome.scripting.registerContentScripts([{
    id: CONTENT_SCRIPT_ID,
    matches: siteList.map(toMatchPattern),
    js: ['quotes.js', 'content.js'],
    runAt: 'document_start'
  }]);
}

// Initialize on install/update — enabled by default
chrome.runtime.onInstalled.addListener(async () => {
  const { sites } = await chrome.storage.sync.get('sites');
  if (!sites) {
    await chrome.storage.sync.set({ sites: DEFAULT_SITES });
  }
  // Default to enabled
  const { enabled } = await chrome.storage.local.get('enabled');
  if (enabled === undefined) {
    await chrome.storage.local.set({ enabled: true });
  }
  await registerContentScript();
});

// Re-register on startup
chrome.runtime.onStartup.addListener(() => {
  registerContentScript();
});

// Toggle enabled state
async function toggle() {
  // Clear any active snooze
  await chrome.alarms.clear(SNOOZE_ALARM);
  await chrome.storage.local.remove('snoozeUntil');

  const { enabled } = await chrome.storage.local.get('enabled');
  const next = !enabled;
  await chrome.storage.local.set({ enabled: next });
  if (next) {
    await chrome.storage.local.remove('disabledSince');
  } else {
    await chrome.storage.local.set({ disabledSince: Date.now() });
  }
  await broadcastState(next);
}

// Snooze: temporarily disable for N minutes
async function snooze(minutes) {
  const until = Date.now() + minutes * 60 * 1000;
  await chrome.storage.local.set({ enabled: false, snoozeUntil: until });
  await chrome.alarms.create(SNOOZE_ALARM, { delayInMinutes: minutes });
  await broadcastState(false);
}

// When snooze alarm fires, re-enable
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SNOOZE_ALARM) {
    await chrome.storage.local.set({ enabled: true });
    await chrome.storage.local.remove('snoozeUntil');
    await chrome.storage.local.remove('disabledSince');
    await broadcastState(true);
  }
});

// Broadcast state to all tabs on monitored sites
async function broadcastState(enabled) {
  const { sites } = await chrome.storage.sync.get('sites');
  const { bizarro } = await chrome.storage.local.get('bizarro');
  const siteList = sites || DEFAULT_SITES;

  if (siteList.length === 0) return;

  const urlPatterns = siteList.map((h) => `https://*.${h}/*`);
  const tabs = await chrome.tabs.query({ url: urlPatterns });
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'SET_STATE', enabled, bizarro: !!bizarro });
    } catch (_) {
      // Content script not ready yet
    }
  }
}

// Broadcast bizarro mode change without toggling enabled state
async function broadcastBizarro(bizarro) {
  const { sites } = await chrome.storage.sync.get('sites');
  const siteList = sites || DEFAULT_SITES;

  if (siteList.length === 0) return;

  const urlPatterns = siteList.map((h) => `https://*.${h}/*`);
  const tabs = await chrome.tabs.query({ url: urlPatterns });
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'SET_BIZARRO', bizarro });
    } catch (_) {}
  }
}

// Keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-grayscale') {
    const { keyboardShortcut } = await chrome.storage.sync.get('keyboardShortcut');
    if (keyboardShortcut === false) return;
    toggle();
  }
});

// Messages from popup and options
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'POPUP_TOGGLE') {
    // Clear snooze on manual toggle
    chrome.alarms.clear(SNOOZE_ALARM);
    chrome.storage.local.remove('snoozeUntil');
    broadcastState(msg.enabled);
  }
  if (msg.type === 'SNOOZE') {
    snooze(msg.minutes).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'BIZARRO_TOGGLE') {
    chrome.storage.local.set({ bizarro: msg.bizarro });
    broadcastBizarro(msg.bizarro);
  }
  if (msg.type === 'SETTINGS_UPDATED') {
    // Forward slider changes to all content scripts on monitored sites
    chrome.storage.sync.get('sites').then(({ sites }) => {
      const siteList = sites || DEFAULT_SITES;
      if (siteList.length === 0) return;
      const urlPatterns = siteList.map((h) => `https://*.${h}/*`);
      chrome.tabs.query({ url: urlPatterns }).then((tabs) => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_SETTINGS', settings: msg.settings }).catch(() => {});
        }
      });
    });
  }
  if (msg.type === 'SITES_UPDATED') {
    registerContentScript().then(() => sendResponse({ ok: true }));
    return true;
  }
});

// Re-register when sites change from options page
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.sites) {
    registerContentScript();
  }
});

// Finalize "Watch this site" flow when the user grants permission.
// The popup writes pendingAdd before requesting; we pick it up here because
// the popup typically closes during the native permission prompt.
chrome.permissions.onAdded.addListener(async (perms) => {
  const { pendingAdd } = await chrome.storage.local.get('pendingAdd');
  if (!pendingAdd) return;

  // Drop stale entries (>10 min)
  if (Date.now() - pendingAdd.timestamp > 10 * 60 * 1000) {
    await chrome.storage.local.remove('pendingAdd');
    return;
  }

  const expected = `https://*.${pendingAdd.hostname}/*`;
  if (!perms.origins?.includes(expected)) return;

  // Push hostname to user's site list (re-registration happens via onChanged listener)
  const { sites } = await chrome.storage.sync.get('sites');
  const updated = sites ? [...sites] : [];
  if (!updated.includes(pendingAdd.hostname)) {
    updated.push(pendingAdd.hostname);
    updated.sort();
    await chrome.storage.sync.set({ sites: updated });
  }

  // Inject content script into the originating tab so user doesn't have to refresh
  if (pendingAdd.tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: pendingAdd.tabId },
        files: ['quotes.js', 'content.js']
      });
    } catch (_) {
      // Tab may have closed or navigated; new visits will pick up via registration
    }
  }

  await chrome.storage.local.remove('pendingAdd');
});
