const powerBtn = document.getElementById('powerBtn');
const usePerSiteSpeedToggle = document.getElementById('usePerSiteSpeed');
const stepSizeSelect = document.getElementById('stepSize');
const defaultSpeedSelect = document.getElementById('defaultSpeed');
const widgetLockedToggle = document.getElementById('widgetLocked');
const restoreWidgetPositionBtn = document.getElementById('restoreWidgetPosition');
const toggleExcludeSiteBtn = document.getElementById('toggleExcludeSite');
const currentSiteLabel = document.getElementById('currentSiteLabel');
const excludedSitesList = document.getElementById('excludedSitesList');
const toggleExcludedSitesListBtn = document.getElementById('toggleExcludedSitesList');
const togglePerSiteSpeedsListBtn = document.getElementById('togglePerSiteSpeedsList');
const perSiteSpeedsList = document.getElementById('perSiteSpeedsList');
const statusText = document.getElementById('status');
const DEFAULT_WIDGET_POSITION = { left: 20, top: 20 };
let currentHostname = '';
let excludedSites = [];
let perSiteSpeedEntries = [];
let excludedSitesVisible = false;
let perSiteSpeedsVisible = false;

function normalizeHostname(hostname) {
  return (hostname || '').toLowerCase();
}

function uniqueSortedSites(sites) {
  return [...new Set((sites || []).map(normalizeHostname).filter(Boolean))].sort();
}

function getHostnameFromUrl(url) {
  try {
    const parsed = new URL(url);
    return normalizeHostname(parsed.hostname);
  } catch (error) {
    return '';
  }
}

function setStatus(message, type = 'success') {
  statusText.textContent = message;
  statusText.className = `status ${type}`;
  setTimeout(() => {
    statusText.textContent = 'Settings saved automatically.';
    statusText.className = 'status';
  }, 2000);
}

function applySystemTheme() {
  const isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const logo = document.getElementById('heroLogo');
  if (isLight) {
    document.body.classList.add('light-theme');
    if (logo) logo.src = 'icon-fill-light.png';
  } else {
    document.body.classList.remove('light-theme');
    if (logo) logo.src = 'icon-fill-dark.png';
  }
}

window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', applySystemTheme);
applySystemTheme();

function updateDisabledState() {
  const isOff = !powerBtn.classList.contains('active');
  powerBtn.setAttribute('aria-pressed', (!isOff).toString());
  usePerSiteSpeedToggle.disabled = isOff;
  stepSizeSelect.disabled = isOff;
  defaultSpeedSelect.disabled = isOff;
  widgetLockedToggle.disabled = isOff;
  restoreWidgetPositionBtn.disabled = isOff;
  toggleExcludeSiteBtn.disabled = isOff || !currentHostname || excludedSites.includes(currentHostname);
  toggleExcludedSitesListBtn.disabled = isOff;
  togglePerSiteSpeedsListBtn.disabled = isOff || !usePerSiteSpeedToggle.checked;

  const items = document.querySelectorAll('.setting-item');
  items.forEach((item) => {
    item.classList.toggle('is-disabled', isOff);
    item.setAttribute('aria-disabled', isOff.toString());
  });
}

function renderExcludedSites() {
  const isOff = !powerBtn.classList.contains('active');
  const currentExcluded = currentHostname && excludedSites.includes(currentHostname);
  currentSiteLabel.textContent = currentHostname || 'No website detected';
  toggleExcludeSiteBtn.disabled = !currentHostname || isOff || currentExcluded;
  toggleExcludeSiteBtn.classList.toggle('is-added', !!currentExcluded);
  toggleExcludeSiteBtn.title = currentExcluded ? 'Current site is already excluded' : 'Exclude current site';
  toggleExcludeSiteBtn.setAttribute('aria-label', currentExcluded ? 'Current site is already excluded' : 'Exclude current site');
  toggleExcludedSitesListBtn.classList.toggle('is-open', excludedSitesVisible);
  toggleExcludedSitesListBtn.setAttribute('aria-expanded', excludedSitesVisible.toString());
  toggleExcludedSitesListBtn.setAttribute('aria-label', excludedSitesVisible ? 'Hide excluded sites' : 'Show excluded sites');
  toggleExcludedSitesListBtn.title = excludedSitesVisible ? 'Hide excluded sites' : 'Show excluded sites';
  excludedSitesList.hidden = !excludedSitesVisible;

  excludedSitesList.textContent = '';
  if (!excludedSitesVisible) return;

  if (excludedSites.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-list';
    empty.textContent = 'No excluded sites.';
    excludedSitesList.appendChild(empty);
    return;
  }

  excludedSites.forEach((site) => {
    const row = document.createElement('div');
    row.className = 'site-row';
    const label = document.createElement('span');
    label.className = 'site-host';
    label.textContent = site;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'icon-action-btn remove-site-btn';
    removeBtn.type = 'button';
    removeBtn.title = `Remove ${site}`;
    removeBtn.setAttribute('aria-label', `Remove ${site}`);
    removeBtn.dataset.site = site;
    removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>';
    row.append(label, removeBtn);
    excludedSitesList.appendChild(row);
  });
}

function renderPerSiteSpeeds() {
  const enabled = usePerSiteSpeedToggle.checked;
  if (!enabled) perSiteSpeedsVisible = false;
  togglePerSiteSpeedsListBtn.hidden = !enabled;
  togglePerSiteSpeedsListBtn.classList.toggle('is-open', perSiteSpeedsVisible);
  togglePerSiteSpeedsListBtn.setAttribute('aria-expanded', perSiteSpeedsVisible.toString());
  togglePerSiteSpeedsListBtn.setAttribute('aria-label', perSiteSpeedsVisible ? 'Hide saved per-site speeds' : 'Show saved per-site speeds');
  togglePerSiteSpeedsListBtn.title = perSiteSpeedsVisible ? 'Hide saved speeds' : 'Show saved speeds';
  perSiteSpeedsList.hidden = !enabled || !perSiteSpeedsVisible;
  perSiteSpeedsList.textContent = '';
  if (!enabled || !perSiteSpeedsVisible) return;

  if (perSiteSpeedEntries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-list';
    empty.textContent = 'No per-site speeds saved yet.';
    perSiteSpeedsList.appendChild(empty);
    return;
  }

  perSiteSpeedEntries.forEach(({ site, speed }) => {
    const row = document.createElement('div');
    row.className = 'site-row';
    const label = document.createElement('span');
    label.className = 'site-host';
    label.textContent = site;
    const value = document.createElement('strong');
    value.className = 'speed-pill';
    value.textContent = `${Number(speed).toFixed(2)}x`;
    row.append(label, value);
    perSiteSpeedsList.appendChild(row);
  });
}

function loadActiveHostname() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    currentHostname = getHostnameFromUrl(tabs && tabs[0] ? tabs[0].url : '');
    renderExcludedSites();
    updateDisabledState();
  });
}

function loadSiteLists() {
  chrome.storage.local.get(null, (data) => {
    excludedSites = uniqueSortedSites(data.excludedSites || []);
    perSiteSpeedEntries = Object.keys(data)
      .filter((key) => key.startsWith('siteSpeed_'))
      .map((key) => ({ site: key.replace('siteSpeed_', ''), speed: data[key] }))
      .filter((entry) => typeof entry.speed === 'number')
      .sort((a, b) => a.site.localeCompare(b.site));
    renderExcludedSites();
    renderPerSiteSpeeds();
  });
}

chrome.storage.local.get({
  powerOn: true,
  usePerSiteSpeed: false,
  stepSize: 0.25,
  defaultSpeed: 1.0,
  widgetLocked: false
}, (data) => {
  powerBtn.classList.toggle('active', !!data.powerOn);
  usePerSiteSpeedToggle.checked = data.usePerSiteSpeed;
  if ([...stepSizeSelect.options].some(o => o.value === data.stepSize.toString())) {
    stepSizeSelect.value = data.stepSize.toString();
  }
  if ([...defaultSpeedSelect.options].some(o => o.value === data.defaultSpeed.toString())) {
    defaultSpeedSelect.value = data.defaultSpeed.toString();
  }
  widgetLockedToggle.checked = !!data.widgetLocked;
  renderPerSiteSpeeds();
  updateDisabledState();
});

function saveSettings() {
  const powerOn = powerBtn.classList.contains('active');
  const usePerSiteSpeed = usePerSiteSpeedToggle.checked;
  const stepSize = parseFloat(stepSizeSelect.value);
  const defaultSpeed = parseFloat(defaultSpeedSelect.value);
  const widgetLocked = widgetLockedToggle.checked;

  chrome.storage.local.set({
    powerOn,
    usePerSiteSpeed,
    stepSize,
    defaultSpeed,
    widgetLocked
  }, () => {
    setStatus('Settings saved successfully!');
  });
}

function setExcludedSites(nextSites, message) {
  excludedSites = uniqueSortedSites(nextSites);
  chrome.storage.local.set({ excludedSites }, () => {
    renderExcludedSites();
    setStatus(message);
  });
}

powerBtn.addEventListener('click', () => {
  powerBtn.classList.toggle('active');
  updateDisabledState();
  saveSettings();
});
usePerSiteSpeedToggle.addEventListener('change', () => {
  if (!usePerSiteSpeedToggle.checked) perSiteSpeedsVisible = false;
  renderPerSiteSpeeds();
  updateDisabledState();
  saveSettings();
});
stepSizeSelect.addEventListener('change', saveSettings);
defaultSpeedSelect.addEventListener('change', saveSettings);
widgetLockedToggle.addEventListener('change', saveSettings);

togglePerSiteSpeedsListBtn.addEventListener('click', () => {
  perSiteSpeedsVisible = !perSiteSpeedsVisible;
  renderPerSiteSpeeds();
});

toggleExcludedSitesListBtn.addEventListener('click', () => {
  excludedSitesVisible = !excludedSitesVisible;
  renderExcludedSites();
});

toggleExcludeSiteBtn.addEventListener('click', () => {
  if (!currentHostname || excludedSites.includes(currentHostname)) return;
  setExcludedSites([...excludedSites, currentHostname], 'Current site excluded.');
});

excludedSitesList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-site]');
  if (!button) return;
  setExcludedSites(excludedSites.filter((site) => site !== button.dataset.site), 'Site removed from exclusions.');
});

restoreWidgetPositionBtn.addEventListener('click', () => {
  widgetLockedToggle.checked = false;
  chrome.storage.local.set({ widgetPosition: DEFAULT_WIDGET_POSITION, widgetLocked: false }, () => {
    setStatus('Widget position restored & unlocked.');
  });
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'local') return;
  if (changes.excludedSites || Object.keys(changes).some((key) => key.startsWith('siteSpeed_'))) {
    loadSiteLists();
  }
});

loadActiveHostname();
loadSiteLists();
