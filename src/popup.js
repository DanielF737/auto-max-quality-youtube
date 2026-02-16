const SETTINGS_KEY = 'ytQualitySettings';
const MODE_MAX = 'max';
const MODE_PRIORITY = 'priority';

const QUALITY_OPTIONS = [
  { id: '4320p', label: '4320p' },
  { id: '2880p', label: '2880p' },
  { id: '2160p', label: '2160p' },
  { id: '1440p', label: '1440p' },
  { id: '1080p_hbr', label: '1080p (High bitrate)' },
  { id: '1080p', label: '1080p' },
  { id: '720p_hbr', label: '720p (High bitrate)' },
  { id: '720p', label: '720p' },
  { id: '480p', label: '480p' },
  { id: '360p', label: '360p' },
  { id: '240p', label: '240p' },
  { id: '144p', label: '144p' }
];

const QUALITY_LABELS = Object.fromEntries(QUALITY_OPTIONS.map((option) => [option.id, option.label]));
const QUALITY_ID_SET = new Set(QUALITY_OPTIONS.map((option) => option.id));

const DEFAULT_PRIORITY_ORDER = ['1080p_hbr', '1080p', '720p_hbr', '720p'];
const DEFAULT_SETTINGS = {
  mode: MODE_MAX,
  priorityOrder: DEFAULT_PRIORITY_ORDER
};

let state = {
  mode: MODE_MAX,
  priorityOrder: DEFAULT_PRIORITY_ORDER.slice()
};

let statusTimeout = null;

const elements = {
  modeMax: null,
  modePriority: null,
  prioritySection: null,
  priorityList: null,
  qualitySelect: null,
  addButton: null,
  saveButton: null,
  statusText: null
};

function sanitizeSettings(raw) {
  const mode = raw && raw.mode === MODE_PRIORITY ? MODE_PRIORITY : MODE_MAX;

  const deduped = [];
  const seen = new Set();
  const incoming = Array.isArray(raw && raw.priorityOrder) ? raw.priorityOrder : DEFAULT_PRIORITY_ORDER;
  incoming.forEach((qualityId) => {
    if (QUALITY_ID_SET.has(qualityId) && !seen.has(qualityId)) {
      deduped.push(qualityId);
      seen.add(qualityId);
    }
  });

  if (deduped.length === 0) {
    deduped.push(DEFAULT_PRIORITY_ORDER[0]);
  }

  return { mode, priorityOrder: deduped };
}

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([SETTINGS_KEY], (result) => {
      if (chrome.runtime.lastError) {
        resolve(DEFAULT_SETTINGS);
        return;
      }

      resolve(sanitizeSettings(result[SETTINGS_KEY]));
    });
  });
}

function saveSettings() {
  return new Promise((resolve, reject) => {
    const payload = {
      mode: state.mode,
      priorityOrder: state.priorityOrder.slice()
    };

    chrome.storage.sync.set({ [SETTINGS_KEY]: payload }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      resolve();
    });
  });
}

function setStatus(message, type) {
  if (statusTimeout) {
    clearTimeout(statusTimeout);
  }

  elements.statusText.textContent = message;
  elements.statusText.className = `status ${type}`;

  statusTimeout = setTimeout(() => {
    elements.statusText.textContent = '';
    elements.statusText.className = 'status';
  }, 2500);
}

function renderMode() {
  elements.modeMax.checked = state.mode === MODE_MAX;
  elements.modePriority.checked = state.mode === MODE_PRIORITY;
  elements.prioritySection.classList.toggle('disabled', state.mode !== MODE_PRIORITY);
}

function renderAddOptions() {
  const available = QUALITY_OPTIONS.filter((option) => !state.priorityOrder.includes(option.id));
  elements.qualitySelect.innerHTML = '';

  available.forEach((option) => {
    const optionElement = document.createElement('option');
    optionElement.value = option.id;
    optionElement.textContent = option.label;
    elements.qualitySelect.appendChild(optionElement);
  });

  const hasAvailable = available.length > 0;
  elements.qualitySelect.disabled = !hasAvailable;
  elements.addButton.disabled = !hasAvailable;
}

function renderPriorityList() {
  elements.priorityList.innerHTML = '';

  state.priorityOrder.forEach((qualityId) => {
    const listItem = document.createElement('li');
    listItem.className = 'priority-item';
    listItem.draggable = true;
    listItem.dataset.id = qualityId;

    const labelWrap = document.createElement('span');
    labelWrap.className = 'priority-label';

    const dragTag = document.createElement('span');
    dragTag.className = 'drag-tag';
    dragTag.textContent = '[drag]';

    const labelText = document.createElement('span');
    labelText.textContent = QUALITY_LABELS[qualityId] || qualityId;

    labelWrap.appendChild(dragTag);
    labelWrap.appendChild(labelText);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'remove-btn';
    removeButton.dataset.removeId = qualityId;
    removeButton.textContent = 'Remove';

    listItem.appendChild(labelWrap);
    listItem.appendChild(removeButton);
    elements.priorityList.appendChild(listItem);
  });
}

function render() {
  renderMode();
  renderPriorityList();
  renderAddOptions();
}

function ensurePriorityHasAtLeastOne() {
  if (state.priorityOrder.length === 0) {
    state.priorityOrder.push(DEFAULT_PRIORITY_ORDER[0]);
  }
}

function syncStateFromDomOrder() {
  const reorderedIds = Array.from(elements.priorityList.querySelectorAll('.priority-item'))
    .map((item) => item.dataset.id)
    .filter((qualityId) => QUALITY_ID_SET.has(qualityId));

  if (reorderedIds.length > 0) {
    state.priorityOrder = reorderedIds;
  }
}

function getDragAfterElement(container, mouseY) {
  const draggableItems = Array.from(container.querySelectorAll('.priority-item:not(.dragging)'));
  let closestOffset = Number.NEGATIVE_INFINITY;
  let closestElement = null;

  draggableItems.forEach((item) => {
    const box = item.getBoundingClientRect();
    const offset = mouseY - box.top - box.height / 2;
    if (offset < 0 && offset > closestOffset) {
      closestOffset = offset;
      closestElement = item;
    }
  });

  return closestElement;
}

function bindEvents() {
  document.getElementById('modeGroup').addEventListener('change', (event) => {
    if (event.target.name !== 'qualityMode') {
      return;
    }

    state.mode = event.target.value === MODE_PRIORITY ? MODE_PRIORITY : MODE_MAX;
    ensurePriorityHasAtLeastOne();
    renderMode();
  });

  elements.addButton.addEventListener('click', () => {
    const qualityId = elements.qualitySelect.value;
    if (!qualityId || state.priorityOrder.includes(qualityId)) {
      return;
    }

    state.priorityOrder.push(qualityId);
    renderPriorityList();
    renderAddOptions();
  });

  elements.priorityList.addEventListener('click', (event) => {
    const qualityId = event.target.dataset.removeId;
    if (!qualityId) {
      return;
    }

    if (state.priorityOrder.length === 1) {
      setStatus('Priority mode must include at least one quality.', 'error');
      return;
    }

    state.priorityOrder = state.priorityOrder.filter((id) => id !== qualityId);
    renderPriorityList();
    renderAddOptions();
  });

  elements.priorityList.addEventListener('dragstart', (event) => {
    const item = event.target.closest('.priority-item');
    if (!item) {
      return;
    }

    item.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', item.dataset.id);
  });

  elements.priorityList.addEventListener('dragover', (event) => {
    event.preventDefault();
    const draggingItem = elements.priorityList.querySelector('.priority-item.dragging');
    if (!draggingItem) {
      return;
    }

    const afterElement = getDragAfterElement(elements.priorityList, event.clientY);
    if (!afterElement) {
      elements.priorityList.appendChild(draggingItem);
      return;
    }

    elements.priorityList.insertBefore(draggingItem, afterElement);
  });

  elements.priorityList.addEventListener('dragend', (event) => {
    const item = event.target.closest('.priority-item');
    if (!item) {
      return;
    }

    item.classList.remove('dragging');
    syncStateFromDomOrder();
    renderPriorityList();
  });

  elements.saveButton.addEventListener('click', async () => {
    ensurePriorityHasAtLeastOne();

    try {
      await saveSettings();
      setStatus('Saved.', 'success');
    } catch (error) {
      setStatus('Save failed.', 'error');
    }
  });
}

function initializeElements() {
  elements.modeMax = document.getElementById('modeMax');
  elements.modePriority = document.getElementById('modePriority');
  elements.prioritySection = document.getElementById('prioritySection');
  elements.priorityList = document.getElementById('priorityList');
  elements.qualitySelect = document.getElementById('qualitySelect');
  elements.addButton = document.getElementById('addButton');
  elements.saveButton = document.getElementById('saveButton');
  elements.statusText = document.getElementById('statusText');
}

document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  bindEvents();

  const savedSettings = await loadSettings();
  state = sanitizeSettings(savedSettings);
  render();
});
