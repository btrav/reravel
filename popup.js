const toggle = document.getElementById('toggle');
const statusLabel = document.getElementById('status-label');
const siteLabel = document.getElementById('site-label');
const optionsLink = document.getElementById('options-link');
const snoozeButtons = document.getElementById('snooze-buttons');
const snoozeStatus = document.getElementById('snooze-status');
const snooze1 = document.getElementById('snooze-1');
const snooze5 = document.getElementById('snooze-5');
const snoozeCustom = document.getElementById('snooze-custom');
const bizarroCheckbox = document.getElementById('bizarro');

let snoozeInterval = null;
let offTickInterval = null;
let currentHostname = null;

function updateUI(enabled, snoozeUntil) {
  toggle.setAttribute('aria-checked', String(enabled));

  if (snoozeUntil && Date.now() < snoozeUntil) {
    showActiveControls();
    statusLabel.textContent = 'Snoozed';
    snoozeButtons.hidden = true;
    snoozeStatus.hidden = false;
    startSnoozeCountdown(snoozeUntil);
    clearOffTick();
  } else if (enabled) {
    showActiveControls();
    statusLabel.textContent = bizarroCheckbox.checked ? 'Bizarro mode' : 'Focus mode on';
    snoozeButtons.hidden = false;
    snoozeStatus.hidden = true;
    clearSnoozeCountdown();
    clearOffTick();
  } else {
    clearSnoozeCountdown();
    renderOffState();
  }
}

function showActiveControls() {
  document.getElementById('toggle-area').hidden = false;
  document.getElementById('snooze-area').hidden = false;
  document.getElementById('bizarro-area').hidden = false;
  document.getElementById('off-state').hidden = true;
}

function formatElapsed(ms) {
  if (ms < 60000) return 'Off for less than a minute';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `Off for ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 24) {
    return remMin === 0 ? `Off for ${hours}h` : `Off for ${hours}h ${remMin}m`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours === 0 ? `Off for ${days}d` : `Off for ${days}d ${remHours}h`;
}

async function renderOffState() {
  const offState = document.getElementById('off-state');
  const headline = document.getElementById('off-headline');
  const quoteText = document.getElementById('off-quote-text');
  const quoteAuthor = document.getElementById('off-quote-author');
  const elapsedEl = document.getElementById('off-elapsed');

  document.getElementById('toggle-area').hidden = true;
  document.getElementById('snooze-area').hidden = true;
  document.getElementById('bizarro-area').hidden = true;
  offState.hidden = false;

  headline.textContent = currentHostname ? `Off for ${currentHostname}` : 'Off';

  const quote = RERAVEL_QUOTES[Math.floor(Math.random() * RERAVEL_QUOTES.length)];
  quoteText.textContent = quote.text;
  quoteAuthor.textContent = `— ${quote.author}`;

  const { disabledSince } = await chrome.storage.local.get('disabledSince');
  if (disabledSince) {
    const tick = () => { elapsedEl.textContent = formatElapsed(Date.now() - disabledSince); };
    tick();
    clearOffTick();
    offTickInterval = setInterval(tick, 60000);
  } else {
    elapsedEl.textContent = '';
  }
}

function clearOffTick() {
  if (offTickInterval) {
    clearInterval(offTickInterval);
    offTickInterval = null;
  }
}

function startSnoozeCountdown(until) {
  clearSnoozeCountdown();
  function tick() {
    const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    if (remaining <= 0) {
      snoozeStatus.textContent = '';
      chrome.storage.local.get(['enabled', 'snoozeUntil'], (result) => {
        updateUI(!!result.enabled, result.snoozeUntil);
      });
      clearSnoozeCountdown();
      return;
    }
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    snoozeStatus.textContent = `Resumes in ${min}:${String(sec).padStart(2, '0')}`;
  }
  tick();
  snoozeInterval = setInterval(tick, 1000);
}

function clearSnoozeCountdown() {
  if (snoozeInterval) {
    clearInterval(snoozeInterval);
    snoozeInterval = null;
  }
}

function isTargetSite(hostname, sites) {
  return sites.some((target) => hostname === target || hostname.endsWith('.' + target));
}

function classifyTab(tab, sites) {
  if (!tab?.url) return { state: 'unsupported', hostname: null };
  let url;
  try {
    url = new URL(tab.url);
  } catch (_) {
    return { state: 'unsupported', hostname: null };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { state: 'unsupported', hostname: null };
  }
  const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
  if (!hostname) return { state: 'unsupported', hostname: null };
  if (isTargetSite(hostname, sites)) {
    return { state: 'monitored', hostname };
  }
  return { state: 'addable', hostname };
}

function renderState(state, hostname) {
  const popup = document.querySelector('.popup');
  const toggleArea = document.getElementById('toggle-area');
  const snoozeArea = document.getElementById('snooze-area');
  const bizarroArea = document.getElementById('bizarro-area');
  const emptyState = document.getElementById('empty-state');
  const offState = document.getElementById('off-state');
  const headline = document.getElementById('empty-headline');
  const subhead = document.getElementById('empty-subhead');
  const cta = document.getElementById('watch-site-btn');

  popup.classList.toggle('is-empty', state !== 'monitored');
  currentHostname = hostname;

  if (state === 'monitored') {
    toggleArea.hidden = false;
    bizarroArea.hidden = false;
    emptyState.hidden = true;
    siteLabel.textContent = `Active on ${hostname}`;
    return;
  }

  offState.hidden = true;

  toggleArea.hidden = true;
  snoozeArea.hidden = true;
  bizarroArea.hidden = true;
  emptyState.hidden = false;
  siteLabel.textContent = '';

  if (state === 'addable') {
    headline.textContent = 'Not watching this site';
    subhead.textContent = `Reravel only degrades sites on your list. Add ${hostname} to start.`;
    cta.textContent = 'Watch this site';
    cta.hidden = false;
    cta.onclick = () => addThisSite(hostname);
  } else {
    headline.textContent = "Reravel can't run here";
    subhead.textContent = 'Chrome blocks extensions on internal pages.';
    cta.hidden = true;
  }
}

async function addThisSite(hostname) {
  const cta = document.getElementById('watch-site-btn');
  cta.disabled = true;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.storage.local.set({
    pendingAdd: { hostname, tabId: tab?.id, timestamp: Date.now() }
  });

  try {
    const granted = await chrome.permissions.request({
      origins: [`https://*.${hostname}/*`]
    });
    if (!granted) {
      await chrome.storage.local.remove('pendingAdd');
      cta.disabled = false;
      const subhead = document.getElementById('empty-subhead');
      subhead.textContent = 'Permission denied. You can add this site from Settings.';
      return;
    }
    // Background will finalize via permissions.onAdded.
    // If popup is still alive, reload to reflect new state.
    setTimeout(() => window.location.reload(), 150);
  } catch (_) {
    await chrome.storage.local.remove('pendingAdd');
    cta.disabled = false;
  }
}

// Initialize popup state
document.addEventListener('DOMContentLoaded', async () => {
  // Clear stale pendingAdd from previous popup sessions
  const { pendingAdd } = await chrome.storage.local.get('pendingAdd');
  if (pendingAdd && Date.now() - pendingAdd.timestamp > 30000) {
    await chrome.storage.local.remove('pendingAdd');
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { enabled, snoozeUntil, bizarro } = await chrome.storage.local.get(['enabled', 'snoozeUntil', 'bizarro']);
  const { sites, customSnoozeMinutes } = await chrome.storage.sync.get(['sites', 'customSnoozeMinutes']);
  const siteList = sites || [];

  const { state, hostname } = classifyTab(tab, siteList);
  renderState(state, hostname);

  if (state !== 'monitored') return;

  bizarroCheckbox.checked = !!bizarro;

  // Configure custom snooze button if a duration is set
  const customMin = Number.isInteger(customSnoozeMinutes) && customSnoozeMinutes > 0 && customSnoozeMinutes <= 60
    ? customSnoozeMinutes
    : null;
  if (customMin) {
    const label = customMin >= 60 ? `Snooze 1 hr` : `Snooze ${customMin} min`;
    snoozeCustom.textContent = label;
    snoozeCustom.setAttribute('aria-label', `Snooze for ${customMin} minutes`);
    snoozeCustom.hidden = false;
    snoozeCustom.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'SNOOZE', minutes: customMin });
      const until = Date.now() + customMin * 60 * 1000;
      updateUI(false, until);
    });
  }

  updateUI(!!enabled, snoozeUntil);
});

// Toggle handler
toggle.addEventListener('click', async () => {
  const current = toggle.getAttribute('aria-checked') === 'true';
  const next = !current;

  await chrome.storage.local.set({ enabled: next });
  await chrome.storage.local.remove('snoozeUntil');
  if (next) {
    await chrome.storage.local.remove('disabledSince');
  } else {
    await chrome.storage.local.set({ disabledSince: Date.now() });
  }
  chrome.runtime.sendMessage({ type: 'POPUP_TOGGLE', enabled: next });
  updateUI(next, null);
});

// Turn-on button in off-state
document.getElementById('turn-on-btn').addEventListener('click', async () => {
  await chrome.storage.local.set({ enabled: true });
  await chrome.storage.local.remove('snoozeUntil');
  await chrome.storage.local.remove('disabledSince');
  chrome.runtime.sendMessage({ type: 'POPUP_TOGGLE', enabled: true });
  updateUI(true, null);
});

// Bizarro toggle
bizarroCheckbox.addEventListener('change', () => {
  const bizarro = bizarroCheckbox.checked;
  chrome.runtime.sendMessage({ type: 'BIZARRO_TOGGLE', bizarro });
  // Update status label if enabled
  const enabled = toggle.getAttribute('aria-checked') === 'true';
  if (enabled) {
    statusLabel.textContent = bizarro ? 'Bizarro mode' : 'Focus mode on';
  }
});

// Snooze handlers
snooze1.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'SNOOZE', minutes: 1 });
  const until = Date.now() + 1 * 60 * 1000;
  updateUI(false, until);
});

snooze5.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'SNOOZE', minutes: 5 });
  const until = Date.now() + 5 * 60 * 1000;
  updateUI(false, until);
});

// Options link
optionsLink.addEventListener('click', (e) => {
  e.preventDefault();
  // chrome.runtime.openOptionsPage() fails silently in some Chromium forks (Arc, Brave)
  // when manifest sets open_in_tab: true. Using chrome.tabs.create is more reliable.
  chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
});
