const DEFAULT_MESSAGE = 'Take a deep breath.';

const TOGGLE_KEYS = ['flattenWeight', 'denseLineHeight'];
const SLIDER_KEYS = ['grayscale', 'contrast', 'opacity', 'blur', 'vignette', 'timerSeconds'];
const SLIDER_DEFAULTS = {
  grayscale: 100,
  contrast: 70,
  opacity: 60,
  blur: 25,
  vignette: 70,
  timerSeconds: 12,
};

const siteInput = document.getElementById('site-input');
const addBtn = document.getElementById('add-btn');
const siteListEl = document.getElementById('site-list');
const statusMsg = document.getElementById('status-msg');
const messageInput = document.getElementById('message-input');
const saveMessageBtn = document.getElementById('save-message-btn');
const resetMessageBtn = document.getElementById('reset-message-btn');
const showQuotesToggle = document.getElementById('toggle-show-quotes');

// Slider elements
const sliders = {
  grayscale: document.getElementById('slider-grayscale'),
  contrast: document.getElementById('slider-contrast'),
  opacity: document.getElementById('slider-opacity'),
  blur: document.getElementById('slider-blur'),
  vignette: document.getElementById('slider-vignette'),
  timerSeconds: document.getElementById('slider-timer'),
};

const sliderValues = {
  grayscale: document.getElementById('val-grayscale'),
  contrast: document.getElementById('val-contrast'),
  opacity: document.getElementById('val-opacity'),
  blur: document.getElementById('val-blur'),
  vignette: document.getElementById('val-vignette'),
  timerSeconds: document.getElementById('val-timer'),
};

// Toggle elements
const toggles = {
  flattenWeight: document.getElementById('toggle-flatten-weight'),
  denseLineHeight: document.getElementById('toggle-line-height'),
};

const fontOverrideSelect = document.getElementById('font-override');

let sites = [];

// --- Status toast ---

function showStatus(msg) {
  statusMsg.textContent = msg;
  setTimeout(() => { statusMsg.textContent = ''; }, 3000);
}

// --- Sliders ---

function formatSliderValue(key, value) {
  if (key === 'timerSeconds') return `${value}s`;
  return `${value}%`;
}

function updateSliderDisplay(key) {
  sliderValues[key].textContent = formatSliderValue(key, sliders[key].value);
}

function getSliderSettings() {
  const settings = {};
  for (const key of SLIDER_KEYS) {
    settings[key] = parseInt(sliders[key].value, 10);
  }
  return settings;
}

async function saveSliders() {
  const settings = getSliderSettings();
  await chrome.storage.sync.set(settings);
  chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: { ...settings, ...getToggleSettings(), fontOverride: fontOverrideSelect.value } });
}

// Wire up each slider
for (const key of SLIDER_KEYS) {
  sliders[key].addEventListener('input', () => {
    updateSliderDisplay(key);
    saveSliders();
  });
}

// --- Toggles ---

function getToggleSettings() {
  const settings = {};
  for (const key of TOGGLE_KEYS) {
    settings[key] = toggles[key].checked;
  }
  return settings;
}

async function saveToggles() {
  const settings = getToggleSettings();
  await chrome.storage.sync.set(settings);
  chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: { ...getSliderSettings(), ...settings, fontOverride: fontOverrideSelect.value } });
}

for (const key of TOGGLE_KEYS) {
  toggles[key].addEventListener('change', saveToggles);
}

async function loadToggles() {
  const stored = await chrome.storage.sync.get([...TOGGLE_KEYS, 'fontOverride']);
  for (const key of TOGGLE_KEYS) {
    // Default to true for flattenWeight and denseLineHeight
    toggles[key].checked = stored[key] !== false;
  }
  fontOverrideSelect.value = stored.fontOverride ?? 'serif';
}

fontOverrideSelect.addEventListener('change', async () => {
  await chrome.storage.sync.set({ fontOverride: fontOverrideSelect.value });
  chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: { ...getSliderSettings(), ...getToggleSettings(), fontOverride: fontOverrideSelect.value } });
});

document.getElementById('reset-effects-btn').addEventListener('click', async () => {
  for (const key of SLIDER_KEYS) {
    sliders[key].value = SLIDER_DEFAULTS[key];
    updateSliderDisplay(key);
  }
  for (const key of TOGGLE_KEYS) {
    toggles[key].checked = true;
  }
  fontOverrideSelect.value = 'serif';
  await chrome.storage.sync.set({ fontOverride: 'serif' });
  await saveSliders();
  await saveToggles();
  showStatus('Effects reset to defaults');
});

async function loadSliders() {
  const stored = await chrome.storage.sync.get(SLIDER_KEYS);
  for (const key of SLIDER_KEYS) {
    const val = stored[key] ?? SLIDER_DEFAULTS[key];
    sliders[key].value = val;
    updateSliderDisplay(key);
  }
}

// --- Interstitial message ---

async function loadMessage() {
  const { interstitialMessage, showQuotes } = await chrome.storage.sync.get(['interstitialMessage', 'showQuotes']);
  messageInput.value = interstitialMessage || DEFAULT_MESSAGE;
  showQuotesToggle.checked = showQuotes !== false; // default to true
}

showQuotesToggle.addEventListener('change', async () => {
  await chrome.storage.sync.set({ showQuotes: showQuotesToggle.checked });
  showStatus(showQuotesToggle.checked ? 'Quotes enabled' : 'Quotes disabled');
});

saveMessageBtn.addEventListener('click', async () => {
  const msg = messageInput.value.trim();
  if (!msg) {
    showStatus('Message cannot be empty');
    return;
  }
  await chrome.storage.sync.set({ interstitialMessage: msg });
  showStatus('Message saved');
});

resetMessageBtn.addEventListener('click', async () => {
  messageInput.value = DEFAULT_MESSAGE;
  await chrome.storage.sync.set({ interstitialMessage: DEFAULT_MESSAGE });
  showStatus('Message reset to default');
});

// --- Site list ---

function normalizeHostname(input) {
  let cleaned = input.trim().toLowerCase();
  cleaned = cleaned.replace(/^https?:\/\//, '');
  cleaned = cleaned.split('/')[0];
  cleaned = cleaned.replace(/^www\./, '');
  return cleaned;
}

function isValidHostname(hostname) {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(hostname);
}

function renderList() {
  siteListEl.innerHTML = '';
  sites.forEach((site) => {
    const li = document.createElement('li');

    const label = document.createElement('span');
    label.textContent = site;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '\u00D7';
    removeBtn.setAttribute('aria-label', `Remove ${site}`);
    removeBtn.addEventListener('click', () => removeSite(site));

    li.appendChild(label);
    li.appendChild(removeBtn);
    siteListEl.appendChild(li);
  });
}

async function saveSites() {
  await chrome.storage.sync.set({ sites });
  chrome.runtime.sendMessage({ type: 'SITES_UPDATED' });
}

// Sites that have static host_permissions in manifest.json
const BUILTIN_SITES = [
  'reddit.com', 'youtube.com', 'discord.com', 'twitter.com', 'x.com',
  'instagram.com', 'tiktok.com', 'facebook.com', 'threads.net', 'snapchat.com',
  'pinterest.com', 'tumblr.com', 'bsky.app', 'twitch.tv',
  'imgur.com', 'quora.com', 'mastodon.social', 'news.ycombinator.com',
];

async function addSite() {
  const hostname = normalizeHostname(siteInput.value);
  if (!hostname) return;

  if (!isValidHostname(hostname)) {
    showStatus('Enter a valid domain like "twitter.com"');
    return;
  }

  if (sites.includes(hostname)) {
    showStatus(`${hostname} is already in the list`);
    siteInput.value = '';
    return;
  }

  // Request permission for non-builtin sites
  if (!BUILTIN_SITES.includes(hostname)) {
    const granted = await chrome.permissions.request({
      origins: [`https://*.${hostname}/*`]
    });
    if (!granted) {
      showStatus(`Permission denied for ${hostname}`);
      return;
    }
  }

  sites.push(hostname);
  sites.sort();
  await saveSites();
  renderList();
  siteInput.value = '';
  showStatus(`Added ${hostname}`);
}

async function removeSite(hostname) {
  sites = sites.filter((s) => s !== hostname);
  await saveSites();

  // Revoke permission for non-builtin sites
  if (!BUILTIN_SITES.includes(hostname)) {
    chrome.permissions.remove({ origins: [`https://*.${hostname}/*`] }).catch(() => {});
  }

  renderList();
  showStatus(`Removed ${hostname}`);
}

// --- Initialize ---

document.addEventListener('DOMContentLoaded', async () => {
  const result = await chrome.storage.sync.get('sites');
  sites = result.sites || [];
  renderList();
  loadMessage();
  loadSliders();
  loadToggles();
});

addBtn.addEventListener('click', addSite);

siteInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addSite();
});
