const STYLE_ID = 'reravel-filter';
const TYPO_STYLE_ID = 'reravel-typography';
const OVERLAY_ID = 'reravel-interstitial';
const VIGNETTE_ID = 'reravel-vignette';
const DEFAULT_MESSAGE = 'Take a deep breath.';

const DEFAULTS = {
  grayscale: 100,
  contrast: 70,
  opacity: 60,
  vignette: 70,
  timerSeconds: 12,
};

// Track whether interstitial has been shown this page load
let interstitialShown = false;

// --- Filters ---

function buildFilterCSS(settings, bizarro) {
  const g = settings.grayscale ?? DEFAULTS.grayscale;
  const c = settings.contrast ?? DEFAULTS.contrast;
  const o = settings.opacity ?? DEFAULTS.opacity;

  if (bizarro) {
    return `html { filter: invert(0.95) hue-rotate(200deg) saturate(2.5) contrast(${c / 100}) opacity(${o / 100}) !important; }`;
  }
  return `html { filter: grayscale(${g}%) contrast(${c / 100}) opacity(${o / 100}) !important; }`;
}

function buildVignetteCSS(settings) {
  const v = settings.vignette ?? DEFAULTS.vignette;
  // Map 0-100 slider to vignette parameters
  // Higher value = more pronounced: smaller clear center, darker edges
  const clearEnd = Math.round(50 - v * 0.4); // 50 at 0, 10 at 100
  const edgeDark = (v * 0.7 / 100).toFixed(2); // 0 at 0, 0.70 at 100

  return `
#${VIGNETTE_ID} {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent ${clearEnd}%, rgba(0,0,0,${edgeDark}) 100%);
}`;
}

function buildTypographyCSS(settings) {
  const rules = [];

  if (settings.monospaceFont) {
    rules.push('font-family: "Courier New", Courier, monospace !important;');
  }
  if (settings.flattenWeight) {
    rules.push('font-weight: 400 !important;');
  }
  if (settings.denseLineHeight) {
    rules.push('line-height: 1.15 !important;');
  }

  if (rules.length === 0) return '';
  return `* { ${rules.join(' ')} }`;
}

function applyTypography(settings) {
  let style = document.getElementById(TYPO_STYLE_ID);
  const css = buildTypographyCSS(settings);

  if (!css) {
    style?.remove();
    return;
  }

  if (!style) {
    style = document.createElement('style');
    style.id = TYPO_STYLE_ID;
    document.documentElement.appendChild(style);
  }
  style.textContent = css;
}

function applyFilter(bizarro, settings) {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.documentElement.appendChild(style);
  }
  style.textContent = buildFilterCSS(settings, bizarro);
  applyVignette(settings);
  applyTypography(settings);
}

function applyVignette(settings) {
  // Always re-create to pick up new settings
  document.getElementById(VIGNETTE_ID + '-style')?.remove();

  const style = document.createElement('style');
  style.id = VIGNETTE_ID + '-style';
  style.textContent = buildVignetteCSS(settings);
  document.documentElement.appendChild(style);

  function insert() {
    if (document.getElementById(VIGNETTE_ID)) return;
    const div = document.createElement('div');
    div.id = VIGNETTE_ID;
    document.body.appendChild(div);
  }

  if (document.body) {
    insert();
  } else {
    const observer = new MutationObserver(() => {
      if (document.body) {
        observer.disconnect();
        insert();
      }
    });
    observer.observe(document.documentElement, { childList: true });
  }
}

function removeFilter() {
  document.getElementById(STYLE_ID)?.remove();
  document.getElementById(TYPO_STYLE_ID)?.remove();
  document.getElementById(VIGNETTE_ID)?.remove();
  document.getElementById(VIGNETTE_ID + '-style')?.remove();
}

// --- Interstitial ---

function showInterstitial(timerSeconds) {
  if (interstitialShown) return;
  if (document.getElementById(OVERLAY_ID)) return;
  interstitialShown = true;

  const duration = timerSeconds || DEFAULTS.timerSeconds;

  // Hide the page immediately
  const hideStyle = document.createElement('style');
  hideStyle.id = 'reravel-hide';
  hideStyle.textContent = 'body { visibility: hidden !important; }';
  document.documentElement.appendChild(hideStyle);

  // Pick a random quote and read custom message
  const quote = RERAVEL_QUOTES[Math.floor(Math.random() * RERAVEL_QUOTES.length)];

  chrome.storage.sync.get('interstitialMessage', ({ interstitialMessage }) => {
    const message = interstitialMessage || DEFAULT_MESSAGE;

    function insertOverlay() {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;

      let remaining = duration;

      const container = document.createElement('div');
      Object.assign(container.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483647',
        background: '#F5F5F5',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: '#1A1A1A',
        visibility: 'visible',
      });

      // Quote
      const quoteEl = document.createElement('p');
      Object.assign(quoteEl.style, {
        fontSize: '20px',
        fontWeight: '400',
        fontStyle: 'italic',
        marginBottom: '8px',
        textAlign: 'center',
        padding: '0 60px',
        lineHeight: '1.4',
        color: '#333333',
      });
      quoteEl.textContent = `\u201C${quote.text}\u201D`;

      const authorEl = document.createElement('p');
      Object.assign(authorEl.style, {
        fontSize: '13px',
        fontWeight: '500',
        color: '#888888',
        marginBottom: '32px',
      });
      authorEl.textContent = quote.author;

      // Custom message
      const messageEl = document.createElement('p');
      Object.assign(messageEl.style, {
        fontSize: '16px',
        fontWeight: '500',
        marginBottom: '12px',
        textAlign: 'center',
        padding: '0 40px',
        color: '#1A1A1A',
      });
      messageEl.textContent = message;

      // Countdown
      const countdownEl = document.createElement('p');
      Object.assign(countdownEl.style, {
        fontSize: '14px',
        color: '#AAAAAA',
        fontVariantNumeric: 'tabular-nums',
      });
      countdownEl.textContent = `${remaining}s`;

      container.appendChild(quoteEl);
      container.appendChild(authorEl);
      container.appendChild(messageEl);
      container.appendChild(countdownEl);
      overlay.appendChild(container);
      document.body.appendChild(overlay);

      const timer = setInterval(() => {
        remaining--;
        countdownEl.textContent = `${remaining}s`;
        if (remaining <= 0) {
          clearInterval(timer);
          overlay.remove();
          document.getElementById('reravel-hide')?.remove();
        }
      }, 1000);
    }

    if (document.body) {
      insertOverlay();
    } else {
      const observer = new MutationObserver(() => {
        if (document.body) {
          observer.disconnect();
          insertOverlay();
        }
      });
      observer.observe(document.documentElement, { childList: true });
    }
  });
}

// --- State sync ---

function activate(bizarro, settings) {
  applyFilter(bizarro, settings);
  showInterstitial(settings.timerSeconds);
}

function deactivate() {
  removeFilter();
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById('reravel-hide')?.remove();
}

const ALL_SETTINGS_KEYS = ['grayscale', 'contrast', 'opacity', 'vignette', 'timerSeconds', 'flattenWeight', 'monospaceFont', 'denseLineHeight'];

function syncState() {
  chrome.storage.local.get(['enabled', 'bizarro'], ({ enabled, bizarro }) => {
    if (!enabled) return deactivate();
    chrome.storage.sync.get(ALL_SETTINGS_KEYS, (settings) => {
      activate(!!bizarro, settings);
    });
  });
}

// Listen for toggle messages from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SET_STATE') {
    if (!msg.enabled) return deactivate();
    chrome.storage.sync.get(ALL_SETTINGS_KEYS, (settings) => {
      activate(!!msg.bizarro, settings);
    });
  }
  if (msg.type === 'SET_BIZARRO') {
    chrome.storage.local.get('enabled', ({ enabled }) => {
      if (!enabled) return;
      chrome.storage.sync.get(ALL_SETTINGS_KEYS, (settings) => {
        applyFilter(msg.bizarro, settings);
      });
    });
  }
  if (msg.type === 'UPDATE_SETTINGS') {
    chrome.storage.local.get(['enabled', 'bizarro'], ({ enabled, bizarro }) => {
      if (enabled) {
        applyFilter(!!bizarro, msg.settings);
      }
    });
  }
});

// YouTube SPA: re-sync after in-app navigation
if (location.hostname.includes('youtube.com')) {
  window.addEventListener('yt-navigate-finish', () => {
    interstitialShown = false;
    syncState();
  });
}

// Discord SPA: DOM isn't ready at document_start, poll for app shell
if (location.hostname.includes('discord.com')) {
  const poll = setInterval(() => {
    if (document.getElementById('app-mount')) {
      clearInterval(poll);
      syncState();
    }
  }, 200);
} else {
  syncState();
}
