const powerBtn = document.getElementById('powerBtn');
const usePerSiteSpeedToggle = document.getElementById('usePerSiteSpeed');
const stepSizeSelect = document.getElementById('stepSize');
const defaultSpeedSelect = document.getElementById('defaultSpeed');
const widgetLockedToggle = document.getElementById('widgetLocked');
const restoreWidgetPositionBtn = document.getElementById('restoreWidgetPosition');
const statusText = document.getElementById('status');
const DEFAULT_WIDGET_POSITION = { left: 20, top: 20 };
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

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', applySystemTheme);
// Apply immediately
applySystemTheme();

function updateDisabledState() {
  const isOff = !powerBtn.classList.contains('active');
  powerBtn.setAttribute('aria-pressed', (!isOff).toString());
  usePerSiteSpeedToggle.disabled = isOff;
  stepSizeSelect.disabled = isOff;
  defaultSpeedSelect.disabled = isOff;
  widgetLockedToggle.disabled = isOff;
  restoreWidgetPositionBtn.disabled = isOff;
  
  const items = document.querySelectorAll('.setting-item');
  items.forEach((item) => {
    item.classList.toggle('is-disabled', isOff);
    item.setAttribute('aria-disabled', isOff.toString());
  });
}

// Load existing settings
chrome.storage.local.get({
  powerOn: true,
  usePerSiteSpeed: false,
  stepSize: 0.25,
  defaultSpeed: 1.0,
  widgetLocked: false
}, (data) => {
  if (data.powerOn) {
    powerBtn.classList.add('active');
  } else {
    powerBtn.classList.remove('active');
  }
  usePerSiteSpeedToggle.checked = data.usePerSiteSpeed;
  // Validate select values — if stored value doesn't match any option, keep the default
  if ([...stepSizeSelect.options].some(o => o.value === data.stepSize.toString())) {
    stepSizeSelect.value = data.stepSize.toString();
  }
  if ([...defaultSpeedSelect.options].some(o => o.value === data.defaultSpeed.toString())) {
    defaultSpeedSelect.value = data.defaultSpeed.toString();
  }
  widgetLockedToggle.checked = !!data.widgetLocked;
  updateDisabledState();
});

// Save settings when changed
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
    statusText.textContent = 'Settings saved successfully!';
    statusText.className = 'status success';
    setTimeout(() => {
      statusText.textContent = 'Settings saved automatically.';
      statusText.className = 'status';
    }, 2000);
  });
}

powerBtn.addEventListener('click', () => {
  powerBtn.classList.toggle('active');
  updateDisabledState();
  saveSettings();
});
usePerSiteSpeedToggle.addEventListener('change', saveSettings);
stepSizeSelect.addEventListener('change', saveSettings);
defaultSpeedSelect.addEventListener('change', saveSettings);
widgetLockedToggle.addEventListener('change', saveSettings);
restoreWidgetPositionBtn.addEventListener('click', () => {
  // Unlock widget when restoring position
  widgetLockedToggle.checked = false;
  chrome.storage.local.set({ widgetPosition: DEFAULT_WIDGET_POSITION, widgetLocked: false }, () => {
    statusText.textContent = 'Widget position restored & unlocked.';
    statusText.className = 'status success';
    setTimeout(() => {
      statusText.textContent = 'Settings saved automatically.';
      statusText.className = 'status';
    }, 2000);
  });
});
