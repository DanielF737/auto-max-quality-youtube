const SETTINGS_KEY = 'ytQualitySettings';
const MODE_MAX = 'max';
const MODE_PRIORITY = 'priority';
const HBR_KEYWORDS = ['premium', 'enhanced bitrate', 'high bitrate', 'higher picture quality'];
const CANONICAL_IDS = new Set([
  '4320p',
  '2880p',
  '2160p',
  '1440p',
  '1080p_hbr',
  '1080p',
  '720p_hbr',
  '720p',
  '480p',
  '360p',
  '240p',
  '144p'
]);

const DEFAULT_SETTINGS = {
  mode: MODE_MAX,
  priorityOrder: ['1080p_hbr', '1080p', '720p_hbr', '720p']
};

let isApplyingQuality = false;
let pendingSelectionTimer = null;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeSettings(rawSettings) {
  if (!rawSettings || typeof rawSettings !== 'object') {
    return {
      mode: DEFAULT_SETTINGS.mode,
      priorityOrder: DEFAULT_SETTINGS.priorityOrder.slice()
    };
  }

  const mode = rawSettings.mode === MODE_PRIORITY ? MODE_PRIORITY : MODE_MAX;
  const priorityOrder = [];

  if (Array.isArray(rawSettings.priorityOrder)) {
    const seen = new Set();
    rawSettings.priorityOrder.forEach((qualityId) => {
      if (CANONICAL_IDS.has(qualityId) && !seen.has(qualityId)) {
        priorityOrder.push(qualityId);
        seen.add(qualityId);
      }
    });
  } else {
    priorityOrder.push(...DEFAULT_SETTINGS.priorityOrder);
  }

  return { mode, priorityOrder };
}

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([SETTINGS_KEY], (result) => {
      if (chrome.runtime.lastError) {
        console.log('Failed loading settings, using defaults.');
        resolve({
          mode: DEFAULT_SETTINGS.mode,
          priorityOrder: DEFAULT_SETTINGS.priorityOrder.slice()
        });
        return;
      }

      resolve(sanitizeSettings(result[SETTINGS_KEY]));
    });
  });
}

async function findQualityMenuItem(maxAttempts = 8, waitMs = 120) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const qualityMenuItem = Array.from(document.querySelectorAll('.ytp-menuitem')).find((item) => {
      const text = (item.innerText || '').toLowerCase();
      return text.includes('quality');
    });

    if (qualityMenuItem) {
      return qualityMenuItem;
    }

    await wait(waitMs);
  }

  return null;
}

async function openQualityMenu() {
  const settingsButton = document.querySelector('.ytp-settings-button');
  if (!settingsButton) {
    return null;
  }

  if (settingsButton.getAttribute('aria-expanded') !== 'true') {
    settingsButton.click();
    await wait(120);
  }

  const qualityMenuItem = await findQualityMenuItem();
  if (!qualityMenuItem) {
    return { settingsButton, qualityOpened: false };
  }

  qualityMenuItem.click();
  await wait(120);
  return { settingsButton, qualityOpened: true };
}

function parseQualityOption(item, menuIndex) {
  const label = (item.innerText || '').trim().replace(/\s+/g, ' ');
  const lowerLabel = label.toLowerCase();
  const resolutionMatch = lowerLabel.match(/(\d{3,4})p/);
  const resolution = resolutionMatch ? parseInt(resolutionMatch[1], 10) : -1;
  const isHighBitrate = HBR_KEYWORDS.some((keyword) => lowerLabel.includes(keyword));
  const isSelected = item.getAttribute('aria-checked') === 'true' || item.classList.contains('ytp-menuitem-active');

  let id = resolution > 0 ? `${resolution}p` : `unknown_${menuIndex}`;
  if ((resolution === 1080 || resolution === 720) && isHighBitrate) {
    id = `${resolution}p_hbr`;
  }

  return {
    id,
    resolution,
    isHighBitrate,
    isSelected,
    label,
    element: item,
    menuIndex
  };
}

function collectQualityOptions() {
  const menuItems = document.querySelectorAll('.ytp-quality-menu .ytp-menuitem');
  return Array.from(menuItems).map((item, index) => parseQualityOption(item, index));
}

function compareQualityOptions(a, b) {
  if (a.resolution !== b.resolution) {
    return b.resolution - a.resolution;
  }

  if (a.isHighBitrate !== b.isHighBitrate) {
    return Number(b.isHighBitrate) - Number(a.isHighBitrate);
  }

  return a.menuIndex - b.menuIndex;
}

function chooseBestOption(options) {
  if (!options || options.length === 0) {
    return null;
  }

  return options.slice().sort(compareQualityOptions)[0];
}

function selectOption(option) {
  if (!option) {
    return false;
  }

  if (option.isSelected) {
    console.log(`Target quality already selected: ${option.label}`);
    return true;
  }

  console.log(`Selecting quality: ${option.label}`);
  option.element.click();
  return true;
}

function selectMax(options) {
  return selectOption(chooseBestOption(options));
}

function selectPriority(priorityOrder, options) {
  for (const qualityId of priorityOrder) {
    const matchingOptions = options.filter((option) => option.id === qualityId);
    if (matchingOptions.length > 0) {
      return selectOption(chooseBestOption(matchingOptions));
    }
  }

  return false;
}

function selectByMode(settings, options) {
  if (settings.mode === MODE_PRIORITY && settings.priorityOrder.length > 0) {
    const prioritySelected = selectPriority(settings.priorityOrder, options);
    if (prioritySelected) {
      return true;
    }
  }

  return selectMax(options);
}

function closeSettingsMenu(settingsButton) {
  if (!settingsButton) {
    return;
  }

  const closeIfOpen = () => {
    if (settingsButton.getAttribute('aria-expanded') === 'true') {
      settingsButton.click();
    }
  };

  setTimeout(closeIfOpen, 100);
  setTimeout(closeIfOpen, 300);
}

async function applyQualitySelection() {
  if (isApplyingQuality) {
    return;
  }

  const video = document.querySelector('video');
  if (!video) {
    return;
  }

  isApplyingQuality = true;
  let menuContext = null;

  try {
    const settings = await loadSettings();
    menuContext = await openQualityMenu();
    if (!menuContext || !menuContext.qualityOpened) {
      return;
    }

    const qualityOptions = collectQualityOptions();
    if (qualityOptions.length === 0) {
      return;
    }

    selectByMode(settings, qualityOptions);
  } catch (error) {
    console.log('Quality selection failed:', error);
  } finally {
    closeSettingsMenu(menuContext && menuContext.settingsButton);
    isApplyingQuality = false;
  }
}

function scheduleQualitySelection(delayMs = 1000) {
  if (pendingSelectionTimer) {
    clearTimeout(pendingSelectionTimer);
  }

  pendingSelectionTimer = setTimeout(() => {
    pendingSelectionTimer = null;
    applyQualitySelection();
  }, delayMs);
}

function observeVideoChanges() {
  const targetNode = document.body;
  const config = { childList: true, subtree: true };

  const callback = (mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type !== 'childList') {
        continue;
      }

      for (const addedNode of mutation.addedNodes) {
        if (addedNode.nodeType !== Node.ELEMENT_NODE) {
          continue;
        }

        if (addedNode.nodeName === 'VIDEO' || addedNode.querySelector('video')) {
          scheduleQualitySelection(800);
          return;
        }
      }
    }
  };

  new MutationObserver(callback).observe(targetNode, config);
}

function observeUrlChanges() {
  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      scheduleQualitySelection(1000);
    }
  }).observe(document, { subtree: true, childList: true });
}

scheduleQualitySelection(1000);
observeVideoChanges();
observeUrlChanges();
