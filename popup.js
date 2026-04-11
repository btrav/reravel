const toggle = document.getElementById('toggle');
const statusLabel = document.getElementById('status-label');
const siteLabel = document.getElementById('site-label');
const optionsLink = document.getElementById('options-link');
const snoozeButtons = document.getElementById('snooze-buttons');
const snoozeStatus = document.getElementById('snooze-status');
const snooze1 = document.getElementById('snooze-1');
const snooze5 = document.getElementById('snooze-5');
const bizarroCheckbox = document.getElementById('bizarro');

let snoozeInterval = null;

function updateUI(enabled, snoozeUntil) {
  toggle.setAttribute('aria-checked', String(enabled));

  if (snoozeUntil && Date.now() < snoozeUntil) {
    statusLabel.textContent = 'Snoozed';
    snoozeButtons.hidden = true;
    snoozeStatus.hidden = false;
    startSnoozeCountdown(snoozeUntil);
  } else if (enabled) {
    statusLabel.textContent = bizarroCheckbox.checked ? 'Bizarro mode' : 'Focus mode on';
    snoozeButtons.hidden = false;
    snoozeStatus.hidden = true;
    clearSnoozeCountdown();
  } else {
    statusLabel.textContent = 'Off';
    snoozeButtons.hidden = true;
    snoozeStatus.hidden = true;
    clearSnoozeCountdown();
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
  return sites.some((target) => hostname.endsWith(target));
}

// Initialize popup state
document.addEventListener('DOMContentLoaded', async () => {
  const { enabled, snoozeUntil, bizarro } = await chrome.storage.local.get(['enabled', 'snoozeUntil', 'bizarro']);
  const { sites } = await chrome.storage.sync.get('sites');
  const siteList = sites || [];

  bizarroCheckbox.checked = !!bizarro;
  updateUI(!!enabled, snoozeUntil);

  // Show current site context
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    try {
      const hostname = new URL(tab.url).hostname;
      if (isTargetSite(hostname, siteList)) {
        siteLabel.textContent = `Active on ${hostname}`;
      }
    } catch (_) {}
  }
});

// Toggle handler
toggle.addEventListener('click', async () => {
  const current = toggle.getAttribute('aria-checked') === 'true';
  const next = !current;

  await chrome.storage.local.set({ enabled: next });
  await chrome.storage.local.remove('snoozeUntil');
  chrome.runtime.sendMessage({ type: 'POPUP_TOGGLE', enabled: next });
  updateUI(next, null);
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
  chrome.runtime.openOptionsPage();
});
