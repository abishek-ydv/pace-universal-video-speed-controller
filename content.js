// ====== SPEED ENFORCEMENT LOGIC (Runs in all frames) ======
let currentSpeed = 1.0;

function getShadowRoots(root) {
    let nodes = [];
    let walk = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
    let node;
    while ((node = walk.nextNode())) {
        if (node.shadowRoot) {
            nodes.push(node.shadowRoot);
            nodes = nodes.concat(getShadowRoots(node.shadowRoot));
        }
    }
    return nodes;
}

let videoReported = false;
const FRAME_SIGNAL = 'PACE_VIDEO_FOUND';
const FRAME_SOURCE = 'PACE_EXTENSION';
const FRAME_HELLO = 'PACE_HELLO';
const FRAME_HELLO_ACK = 'PACE_HELLO_ACK';
let frameNonce = null;
let topFrameNonce = null;
let helloRequested = false;
function reportVideoFound() {
    if (videoReported) return;
    if (window === window.top) {
        videoReported = true;
        if (!topFrameNonce) topFrameNonce = Math.random().toString(36).slice(2);
        if (typeof window.tryShowUI === 'function') window.tryShowUI();
    } else {
        if (!frameNonce) {
            if (!helloRequested) {
                helloRequested = true;
                window.top.postMessage({ type: FRAME_HELLO, source: FRAME_SOURCE }, '*');
            }
            return;
        }
        videoReported = true;
        window.top.postMessage({ type: FRAME_SIGNAL, source: FRAME_SOURCE, nonce: frameNonce }, '*');
    }
}

function findAllVideos() {
    let videos = Array.from(document.querySelectorAll('video'));
    const shadows = getShadowRoots(document);
    for (const sr of shadows) {
        videos = videos.concat(Array.from(sr.querySelectorAll('video')));
    }

    if (videos.length > 0) {
        reportVideoFound();
    }

    return videos;
}

function findVideosInNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return [];
    const root = node;
    let videos = [];
    if (root.tagName === 'VIDEO') videos.push(root);
    videos = videos.concat(Array.from(root.querySelectorAll('video')));
    const shadows = getShadowRoots(root);
    for (const sr of shadows) {
        videos = videos.concat(Array.from(sr.querySelectorAll('video')));
    }
    return videos;
}

function maybeEnforceVideo(v) {
    if (!v) return;
    if (isControllerActive() && typeof window.__ybmTargetSpeed === 'number' && v.playbackRate !== window.__ybmTargetSpeed) {
        v.__ybmSettingSpeed = true;
        v.playbackRate = window.__ybmTargetSpeed;
        setTimeout(() => { v.__ybmSettingSpeed = false; }, 10);
    }
}

function attachVideoHandlers(v) {
    if (!v || v.__ybmRateEnforcerAdded) return;
    v.__ybmRateEnforcerAdded = true;
    v.addEventListener('ratechange', () => {
        if (!isControllerActive()) return;
        if (v.playbackRate !== window.__ybmTargetSpeed && !v.__ybmSettingSpeed) {
            v.__ybmSettingSpeed = true;
            v.playbackRate = window.__ybmTargetSpeed;
            setTimeout(() => { v.__ybmSettingSpeed = false; }, 10);
        }
    });
    v.addEventListener('play', () => {
        reportVideoFound();
        maybeEnforceVideo(v);
    });
    v.addEventListener('playing', () => {
        reportVideoFound();
    });
}

function enforceSpeed(targetSpeed) {
    currentSpeed = targetSpeed;
    window.__ybmTargetSpeed = isControllerActive() ? targetSpeed : null;

    const videos = findAllVideos();
    videos.forEach(v => {
        attachVideoHandlers(v);
        maybeEnforceVideo(v);
    });

    if (!window.__ybmObserverAdded) {
        window.__ybmObserverAdded = true;
        let pendingNodes = [];
        let scheduled = false;
        const observer = new MutationObserver((mutations) => {
            if (!isControllerActive()) return;
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((n) => pendingNodes.push(n));
            });
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                const visited = new Set();
                pendingNodes.forEach((node) => {
                    const vids = findVideosInNode(node);
                    vids.forEach((v) => {
                        if (visited.has(v)) return;
                        visited.add(v);
                        attachVideoHandlers(v);
                        maybeEnforceVideo(v);
                    });
                });
                pendingNodes = [];
                scheduled = false;
            });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }
}

let usePerSiteSpeed = false;
let currentHostname = window.location.hostname;
let powerOn = true;
let siteExcluded = false;

function normalizeHostname(hostname) {
    return (hostname || '').toLowerCase();
}

function getExclusionHostCandidates() {
    const candidates = [normalizeHostname(currentHostname)];
    if (window !== window.top && document.referrer) {
        try {
            candidates.push(normalizeHostname(new URL(document.referrer).hostname));
        } catch (error) {
            // Ignore non-standard referrers.
        }
    }
    return [...new Set(candidates.filter(Boolean))];
}

function isCurrentSiteExcluded(excludedSites) {
    if (!Array.isArray(excludedSites)) return false;
    const excluded = new Set(excludedSites.map(normalizeHostname));
    return getExclusionHostCandidates().some((site) => excluded.has(site));
}

function isControllerActive() {
    return powerOn && !siteExcluded;
}

function getSpeedKey() {
    return usePerSiteSpeed ? `siteSpeed_${currentHostname}` : 'lastSpeed';
}

chrome.storage.local.get(['usePerSiteSpeed', 'defaultSpeed', 'powerOn', 'enableWidget', 'excludedSites'], (data) => {
    usePerSiteSpeed = !!data.usePerSiteSpeed;
    powerOn = data.powerOn !== false;
    if (data.enableWidget === false && data.powerOn === undefined) powerOn = false; // migration
    siteExcluded = isCurrentSiteExcluded(data.excludedSites);
    let defaultSpeed = data.defaultSpeed || 1.0;
    let key = getSpeedKey();
    chrome.storage.local.get([key], (d) => {
        let speed = d[key] || defaultSpeed;
        enforceSpeed(speed);
    });
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.usePerSiteSpeed || changes.powerOn !== undefined || changes.excludedSites !== undefined) {
            if (changes.usePerSiteSpeed) usePerSiteSpeed = changes.usePerSiteSpeed.newValue;
            if (changes.powerOn !== undefined) powerOn = changes.powerOn.newValue;
            if (changes.excludedSites !== undefined) siteExcluded = isCurrentSiteExcluded(changes.excludedSites.newValue);
            let key = getSpeedKey();
            chrome.storage.local.get([key, 'defaultSpeed'], (d) => {
                let sp = d[key] || d.defaultSpeed || 1.0;
                enforceSpeed(sp);
                if (typeof updateContentUI === 'function') {
                    updateContentUI(sp);
                }
            });
        }

        let key = getSpeedKey();
        if (changes[key]) {
            enforceSpeed(changes[key].newValue);
            if (typeof updateContentUI === 'function') {
                updateContentUI(changes[key].newValue);
                if (typeof showSpeedBriefly === 'function') showSpeedBriefly(changes[key].newValue);
            }
        }

        if (typeof updateSettings === 'function') {
            updateSettings(changes);
        }
    }
});

if (window !== window.top) {
    window.addEventListener('message', (e) => {
        if (!e.data || e.data.source !== FRAME_SOURCE) return;
        if (e.data.type === FRAME_HELLO_ACK && e.data.nonce) {
            frameNonce = e.data.nonce;
            reportVideoFound();
        }
    });
}


// ====== UI LOGIC (Floating widget in top frame) ======
if (window === window.top) {
    const isTopFrame = window === window.top;
    const DEFAULT_WIDGET_POSITION = { left: 20, top: 20 };
    // Create UI container
    const container = document.createElement('div');
    container.id = 'ybm-speed-controller-container';
    container.className = 'ybm-minimized'; // Start minimized

    // Add Shadow DOM to prevent page styling from interfering
    const shadow = container.attachShadow({ mode: 'open' });

    // Add Styles
    const style = document.createElement('style');
    style.textContent = `
        :host {
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 2147483647; /* Maximum z-index */
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .wrapper {
            box-sizing: border-box;
            background: rgba(17, 24, 39, 0.42);
            background-image: linear-gradient(145deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05));
            backdrop-filter: blur(18px) saturate(160%);
            -webkit-backdrop-filter: blur(18px) saturate(160%);
            border: 1px solid rgba(255,255,255,0.22);
            border-radius: 12px;
            color: #E5E7EB; /* --text-primary */
            display: flex;
            align-items: center;
            padding: 8px;
            box-shadow: 0 12px 34px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.20);
            user-select: none;
            overflow: hidden;
            max-width: 280px;
            height: 40px;
            width: max-content;
            pointer-events: auto;
            transition: max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease, border-color 0.3s ease, border-radius 0.3s ease, box-shadow 0.3s ease;
        }

        :host(.ybm-minimized) .wrapper {
            width: 40px;
            max-width: 40px;
            cursor: pointer;
            justify-content: center;
            background: rgba(17, 24, 39, 0.36);
            background-image: linear-gradient(145deg, rgba(255,255,255,0.20), rgba(255,255,255,0.06));
            border-color: rgba(255,255,255,0.24);
            border-radius: 10px;
            box-shadow: 0 10px 28px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.22);
            transition: all 0.3s ease;
        }

        :host(.ybm-minimized) .wrapper:hover {
            background: rgba(26, 34, 51, 0.54);
            border-color: rgba(79,93,255,0.68);
            box-shadow: 0 0 18px rgba(59,72,242,0.42), 0 12px 34px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.24);
        }

        :host(.ybm-locked) .wrapper {
            cursor: default;
            border-color: rgba(59,72,242,0.25);
        }

        .toggle-btn {
            background: none;
            border: none;
            color: #E5E7EB; /* --text-primary */
            font-size: 16px;
            cursor: pointer;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            flex-shrink: 0;
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .toggle-btn:hover {
            background: rgba(255,255,255,0.10);
        }
        .toggle-btn:focus-visible {
            outline: 2px solid #4F5DFF; /* --primary-400 */
            outline-offset: 2px;
        }

        .toggle-icon {
            width: 18px;
            height: 18px;
            object-fit: contain;
            pointer-events: none;
            content: url("${chrome.runtime.getURL('pop-light.png')}");
            filter: drop-shadow(0 0 3px rgba(0,0,0,0.5));
            transition: all 0.2s ease;
        }

        :host(.ybm-minimized) .toggle-btn {
            transform: scale(1.1);
        }

        .controls {
            display: flex;
            align-items: center;
            overflow: hidden;
            max-width: 300px;
            margin-left: 10px;
            opacity: 1;
            visibility: visible;
            transition: max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, visibility 0.3s ease, margin-left 0.3s ease;
            white-space: nowrap;
        }

        :host(.ybm-minimized) .controls {
            opacity: 0;
            max-width: 0;
            margin-left: 0;
            visibility: hidden;
            pointer-events: none;
        }

        .speed-btn {
            background: rgba(26, 34, 51, 0.58);
            border: 1px solid rgba(255,255,255,0.14);
            color: #E5E7EB; /* --text-primary */
            width: 28px;
            height: 28px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            transition: background 0.2s ease;
        }
        
        .speed-btn:hover {
            background: rgba(255,255,255,0.10);
            border-color: rgba(255,255,255,0.28);
        }
        .speed-btn:focus-visible {
            outline: 2px solid #4F5DFF; /* --primary-400 */
            outline-offset: 2px;
        }

        .speed-display {
            font-size: 14px;
            font-weight: 600;
            margin: 0 10px;
            min-width: 45px;
            text-align: center;
            cursor: default;
        }
        



    `;

    const wrapper = document.createElement('div');
    wrapper.className = 'wrapper';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-btn';
    toggleBtn.innerHTML = '<img class="toggle-icon" alt="" role="presentation">';
    toggleBtn.title = 'Expand/Collapse Speed Controller';

    const controls = document.createElement('div');
    controls.className = 'controls';

    const decBtn = document.createElement('button');
    decBtn.className = 'speed-btn';
    decBtn.textContent = '-';
    decBtn.title = 'Decrease Speed ([)';
    decBtn.setAttribute('aria-label', 'Decrease playback speed');

    const speedDisplay = document.createElement('span');
    speedDisplay.className = 'speed-display';
    speedDisplay.textContent = '1.00x';

    const incBtn = document.createElement('button');
    incBtn.className = 'speed-btn';
    incBtn.textContent = '+';
    incBtn.title = 'Increase Speed (])';
    incBtn.setAttribute('aria-label', 'Increase playback speed');

    const resetBtn = document.createElement('button');
    resetBtn.className = 'speed-btn';
    resetBtn.innerHTML = '↺';
    resetBtn.title = 'Reset Speed (R)';
    resetBtn.setAttribute('aria-label', 'Reset playback speed');
    resetBtn.style.marginLeft = '5px';
    resetBtn.style.fontSize = '16px';
    toggleBtn.setAttribute('aria-label', 'Expand or collapse speed controller');


    controls.appendChild(decBtn);
    controls.appendChild(speedDisplay);
    controls.appendChild(incBtn);
    controls.appendChild(resetBtn);


    wrapper.appendChild(toggleBtn);
    wrapper.appendChild(controls);

    shadow.appendChild(style);
    shadow.appendChild(wrapper);

    let uiAdded = false;
    let currentStepSize = 0.25;
    let currentDefaultSpeed = 1.0;
    let widgetPosition = { ...DEFAULT_WIDGET_POSITION };
    let widgetLocked = false;

    function appendContainerTo(parent) {
        if (!parent) return false;
        if (container.parentNode !== parent) parent.appendChild(container);
        uiAdded = true;
        return true;
    }

    function removeContainer() {
        if (container.parentNode) container.parentNode.removeChild(container);
        uiAdded = false;
    }

    function showFloatingWidget() {
        if (!isTopFrame || !isControllerActive() || !document.body) return;
        container.style.maxWidth = '';
        container.style.position = 'fixed';
        appendContainerTo(document.fullscreenElement || document.body);
        applyWidgetPosition();
    }

    function hideWidget() {
        removeContainer();
    }

    function getWidgetBounds() {
        const rect = container.getBoundingClientRect();
        const width = Math.max(40, Math.round(rect.width || 170));
        const height = Math.max(40, Math.round(rect.height || 40));
        return { width, height };
    }

    function getClampedPosition(pos) {
        const { width, height } = getWidgetBounds();
        const maxLeft = Math.max(0, window.innerWidth - width - 8);
        const maxTop = Math.max(0, window.innerHeight - height - 8);
        return {
            left: Math.min(maxLeft, Math.max(0, Math.round(pos.left))),
            top: Math.min(maxTop, Math.max(0, Math.round(pos.top)))
        };
    }

    function applyWidgetPosition() {
        const clamped = getClampedPosition(widgetPosition);
        if (clamped.left !== widgetPosition.left || clamped.top !== widgetPosition.top) {
            widgetPosition = clamped;
            persistWidgetPosition();
        }
        container.style.left = `${widgetPosition.left}px`;
        container.style.top = `${widgetPosition.top}px`;
        container.style.right = 'auto';
        container.style.bottom = 'auto';
    }

    function clampAfterTransition() {
        setTimeout(() => applyWidgetPosition(), 420);
    }

    function persistWidgetPosition() {
        if (!chrome.runtime?.id) return;
        chrome.storage.local.set({ widgetPosition });
    }

    function applyWidgetLockState() {
        container.classList.toggle('ybm-locked', widgetLocked);
    }

    function setWidgetLocked(nextLocked) {
        widgetLocked = !!nextLocked;
        applyWidgetLockState();
        if (!chrome.runtime?.id) return;
        if (widgetLocked) {
            chrome.storage.local.set({ widgetLocked: true, widgetPosition });
        } else {
            chrome.storage.local.set({ widgetLocked: false });
        }
    }
    function updateShortcutTitles() {
        decBtn.title = 'Decrease Speed ([)';
        incBtn.title = 'Increase Speed (])';
        resetBtn.title = 'Reset Speed (R)';
        toggleBtn.title = 'Expand/Collapse Speed Controller (H hides widget)';
    }

    window.tryShowUI = function () {
        if (!isControllerActive()) {
            hideWidget();
            return;
        }
        if (videoReported) showFloatingWidget();
    };

    window.updateSettings = function (changes) {
        if (changes.excludedSites !== undefined) {
            siteExcluded = isCurrentSiteExcluded(changes.excludedSites.newValue);
        }
        if (changes.powerOn !== undefined || changes.excludedSites !== undefined) {
            if (isControllerActive()) {
                window.tryShowUI();
            } else {
                hideWidget();
            }
        }
        if (changes.stepSize !== undefined) currentStepSize = changes.stepSize.newValue;
        if (changes.defaultSpeed !== undefined) currentDefaultSpeed = changes.defaultSpeed.newValue;
        if (changes.widgetLocked !== undefined) {
            setWidgetLocked(changes.widgetLocked.newValue);
        }
        if (changes.widgetPosition !== undefined && changes.widgetPosition.newValue) {
            widgetPosition = changes.widgetPosition.newValue;
            applyWidgetPosition();
        }
    };

    if (isTopFrame) {
        window.addEventListener('message', (e) => {
            if (e.source === window) return;
            if (!e.data || e.data.source !== FRAME_SOURCE) return;
            if (e.data.type === FRAME_HELLO && e.source && e.source !== window) {
                if (!topFrameNonce) topFrameNonce = Math.random().toString(36).slice(2);
                e.source.postMessage({ type: FRAME_HELLO_ACK, source: FRAME_SOURCE, nonce: topFrameNonce }, '*');
                return;
            }
            if (e.data.type === FRAME_SIGNAL && e.data.nonce && e.data.nonce === topFrameNonce) {
                videoReported = true;
                window.tryShowUI();
            }
        });
    }

    let speedShowTimeout;
    let wasHidden = false;
    let wasMinimized = true;
    let brieflyShowing = false;

    window.showSpeedBriefly = function (speed) {
        if (!isControllerActive()) return;
        if (!isTopFrame || !uiAdded) {
            return;
        }

        if (!container.classList.contains('ybm-minimized') && container.style.display !== 'none') {
            return;
        }

        brieflyShowing = true;

        if (container.style.display === 'none') {
            wasHidden = true;
            container.style.display = 'block';
        }

        if (container.classList.contains('ybm-minimized')) {
            wasMinimized = true;
            container.classList.remove('ybm-minimized');
        } else {
            wasMinimized = false;
        }

        // Hide extra controls
        decBtn.style.display = 'none';
        incBtn.style.display = 'none';
        resetBtn.style.display = 'none';

        clearTimeout(speedShowTimeout);
        speedShowTimeout = setTimeout(() => {
            if (!brieflyShowing) return;
            brieflyShowing = false;
            // Restore extra controls
            decBtn.style.display = '';
            incBtn.style.display = '';
            resetBtn.style.display = '';

            if (wasMinimized) {
                container.classList.add('ybm-minimized');
            }
            if (wasHidden) {
                container.style.display = 'none';
                wasHidden = false;
            }
        }, 1200);
    };

    function forceRestoreFullUI() {
        clearTimeout(speedShowTimeout);
        brieflyShowing = false;
        decBtn.style.display = '';
        incBtn.style.display = '';
        resetBtn.style.display = '';
        wasHidden = false;
    }

    // Drag Logic
    let isDragging = false;
    let hasDragged = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 20;
    let initialTop = 20;

    wrapper.addEventListener('mousedown', (e) => {
        hasDragged = false;
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
        if (widgetLocked) return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = container.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        if (e.buttons === 0) {
            if (hasDragged && !widgetLocked) persistWidgetPosition();
            isDragging = false;
            return;
        }
        if (widgetLocked) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged = true;
        if (hasDragged) {
            widgetPosition = {
                left: Math.max(0, Math.round(initialLeft + dx)),
                top: Math.max(0, Math.round(initialTop + dy))
            };
            applyWidgetPosition();
        }
    });

    window.addEventListener('mouseup', () => {
        if (hasDragged && !widgetLocked) {
            persistWidgetPosition();
        }
        isDragging = false;
    });

    // Event Listeners
    wrapper.addEventListener('click', (e) => {
        if (hasDragged) {
            e.stopPropagation();
            return;
        }
        forceRestoreFullUI();
        if (container.classList.contains('ybm-minimized')) {
            container.classList.remove('ybm-minimized');
            clampAfterTransition();
            e.stopPropagation();
        }
    });

    toggleBtn.addEventListener('click', (e) => {
        if (hasDragged) return;
        forceRestoreFullUI();
        if (container.classList.contains('ybm-minimized')) {
            container.classList.remove('ybm-minimized');
        } else {
            container.classList.add('ybm-minimized');
        }
        clampAfterTransition();
        e.stopPropagation();
    });



    // Close button removed in favor of toggle minimize

    function changeSpeedBy(direction) {
        if (!chrome.runtime?.id) {
            console.warn("PACE: Extension updated. Please refresh the page.");
            return;
        }
        let delta = direction > 0 ? currentStepSize : -currentStepSize;
        let newSpeed = currentSpeed + delta;
        newSpeed = Math.max(0.05, Math.min(newSpeed, 16.0));
        newSpeed = Math.round(newSpeed * 100) / 100;
        let key = usePerSiteSpeed ? `siteSpeed_${currentHostname}` : 'lastSpeed';
        chrome.storage.local.set({ [key]: newSpeed });
    }

    decBtn.addEventListener('click', () => changeSpeedBy(-1));
    incBtn.addEventListener('click', () => changeSpeedBy(1));
    resetBtn.addEventListener('click', () => {
        if (!chrome.runtime?.id) return;
        let key = usePerSiteSpeed ? `siteSpeed_${currentHostname}` : 'lastSpeed';
        chrome.storage.local.set({ [key]: currentDefaultSpeed });
    });

    window.updateContentUI = function (speed) {
        speedDisplay.textContent = speed.toFixed(2) + 'x';
    };

    // Initialize UI and settings
    chrome.storage.local.get({
        powerOn: true,
        enableWidget: true,
        stepSize: 0.25,
        defaultSpeed: 1.0,
        usePerSiteSpeed: false,
        widgetPosition: { ...DEFAULT_WIDGET_POSITION },
        widgetLocked: false
    }, (data) => {
        powerOn = data.powerOn !== false;
        if (data.enableWidget === false && data.powerOn === undefined) powerOn = false;
        currentStepSize = data.stepSize;
        currentDefaultSpeed = data.defaultSpeed;
        usePerSiteSpeed = data.usePerSiteSpeed;
        widgetPosition = data.widgetPosition || widgetPosition;
        widgetLocked = !!data.widgetLocked;
        applyWidgetPosition();
        applyWidgetLockState();
        updateShortcutTitles();

        let key = usePerSiteSpeed ? `siteSpeed_${currentHostname}` : 'lastSpeed';
        chrome.storage.local.get([key], (d) => {
            updateContentUI(d[key] || currentDefaultSpeed);
        });

        window.tryShowUI();
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (!isControllerActive() || !uiAdded) return;
        // Ignore if typing in an input or contenteditable element
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
            e.target.isContentEditable || e.target.closest('[contenteditable="true"]')) {
            return;
        }
        if (e.key.toLowerCase() === 'r') {
            if (!chrome.runtime?.id) return;
            let key = usePerSiteSpeed ? `siteSpeed_${currentHostname}` : 'lastSpeed';
            chrome.storage.local.set({ [key]: currentDefaultSpeed });
            e.preventDefault();
            return;
        }

        if (e.key.toLowerCase() === 'h') {
            if (container.style.display === 'none') {
                container.style.display = 'block';
                wasHidden = false;
            } else {
                container.style.display = 'none';
            }
            e.preventDefault();
            return;
        }

        if (e.key === '[') {
            changeSpeedBy(-1);
            e.preventDefault();
        } else if (e.key === ']') {
            changeSpeedBy(1);
            e.preventDefault();
        }
    });

    // Handle Fullscreen - move the container into the fullscreen element so it stays visible
    document.addEventListener('fullscreenchange', () => {
        if (!isControllerActive()) return;
        if (!uiAdded || !isTopFrame) return;
        const fsElement = document.fullscreenElement;
        if (fsElement) {
            fsElement.appendChild(container);
        } else if (document.body) {
            document.body.appendChild(container);
        }
        applyWidgetPosition();
    });

    window.addEventListener('resize', () => {
        applyWidgetPosition();
    });
}
