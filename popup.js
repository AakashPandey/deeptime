document.addEventListener('DOMContentLoaded', () => {
    // Reset focus timer if browser was restarted (focusActive false, but focusElapsed > 0)
    chrome.storage.sync.get(['focusActive', 'focusElapsed'], (data) => {
        if (!data.focusActive && data.focusElapsed > 0) {
            chrome.storage.sync.set({ focusElapsed: 0, focusStart: 0 });
        }
    });

    // New UI elements

    // Header elements
    const productivityClock = document.getElementById('productivityClock');
    const toggleFocusBtn = document.getElementById('toggleFocus');
    const focusIcon = document.getElementById('focusIcon');
    const playSvg = document.getElementById('playSvg');
    const playSvgd = document.getElementById('playSvgd');
    const pauseSvg = document.getElementById('pauseSvg');
    const pauseSvgd = document.getElementById('pauseSvgd');

    // Mode section
    const modeToggle = document.getElementById('modeToggle');
    const modeLabel = document.getElementById('modeLabel');
    const modeDesc = document.getElementById('modeDesc');

    // Site list and input
    const siteList = document.getElementById('siteList');
    const siteInput = document.getElementById('siteInput');
    const addSiteBtn = document.getElementById('addSite');
    const addCurrentSiteBtn = document.getElementById('addCurrentSite');
    const status = document.getElementById('status');


    // State
    let mode = 'block'; // 'block' or 'allow'
    let sites = [];
    let focusActive = false;
    let focusStart = 0;
    let focusElapsed = 0; // ms
    let focusTimer = null;

    // Load settings and update UI
    function loadSettings() {
        chrome.storage.sync.get(['blockedSites', 'allowedSites', 'mode', 'focusActive', 'focusStart', 'focusElapsed'], (data) => {
            // Default to blocklist mode if not set
            mode = (typeof data.mode === 'string') ? data.mode : 'block';
            sites = (mode === 'block' ? data.blockedSites : data.allowedSites) || [];
            focusActive = !!data.focusActive;
            focusStart = data.focusStart || 0;
            focusElapsed = data.focusElapsed || 0;
            // Switch ON (checked) for allowlist mode, OFF for blocklist
            modeToggle.checked = (mode === 'allow');
            updateModeUI();
            updateSiteList();
            updateFocusUI();
        });
    }
    // Update blocklist/whitelist label and description
    function updateModeUI() {
        if (mode === 'block') {
            modeLabel.textContent = 'Blocklist Mode';
            modeDesc.textContent = 'Block a list of websites';
        } else {
            modeLabel.textContent = 'Allowlist Mode';
            modeDesc.textContent = 'Only allow these websites';
        }
    }

    // Add accordion and count for site list
    // Insert this after mode section and before siteList
    const accordionWrap = document.createElement('div');
    accordionWrap.className = 'wrap';
    accordionWrap.style.padding = '0 20px';
    accordionWrap.style.marginBottom = '10px';
    accordionWrap.innerHTML = `
        <div id="siteAccordionHeader" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-weight: 500; font-size: 1.08em; padding: 6px 0; padding-right: 5px;user-select: none;padding-bottom: 6px;">
            <span id="siteCount"></span>
            <span id="accordionIcon" style="font-size: 1.2em; transition: transform 0.2s; user-select:none; display: flex; align-items: center;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <polyline points="6 9 12 15 18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>
            </span>
        </div>
    `;
    // Insert accordionWrap before siteList
    siteList.parentNode.insertBefore(accordionWrap, siteList);
    // Move siteList into accordionWrap
    accordionWrap.appendChild(siteList);
    // Accordion logic
    const siteAccordionHeader = document.getElementById('siteAccordionHeader');
    const siteCount = document.getElementById('siteCount');
    const accordionIcon = document.getElementById('accordionIcon');
    let listOpen = false; // Collapsed by default
    siteList.style.display = 'none';
    accordionIcon.style.transform = 'rotate(-90deg)';
    siteAccordionHeader.onclick = () => {
        listOpen = !listOpen;
        siteList.style.display = listOpen ? '' : 'none';
        accordionIcon.style.transform = listOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
    };
    // Ensure #siteList is always scrollable when open
    siteList.style.overflowY = 'auto';
    siteList.style.maxHeight = '140px';
    siteList.style.minHeight = '0';
    siteList.style.transition = 'max-height 0.2s';

    // Update the unified site list UI
    function updateSiteList() {
        siteList.innerHTML = '';
        // Show most recent first (top): reverse the array for display
        sites.slice().reverse().forEach(site => {
            const li = document.createElement('li');
            // Clean display: remove protocol and www.
            let displaySite = site.replace(/^https?:\/\//, '').replace(/^www\./, '');
            li.textContent = displaySite;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="6" y1="18" x2="18" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            `;
            removeBtn.onclick = () => {
                const updatedSites = sites.filter(s => s !== site);
                const key = (mode === 'block') ? 'blockedSites' : 'allowedSites';
                chrome.storage.sync.set({ [key]: updatedSites }, loadSettings);
            };
            li.appendChild(removeBtn);
            siteList.appendChild(li);
        });
        // Update count
        siteCount.textContent = `${sites.length} website${sites.length === 1 ? '' : 's'} added`;
    }

    // Add site to the current list
    function addSite(site) {
        site = site.trim();
        if (!site) return;
        if (sites.includes(site)) return;
        const updatedSites = [...sites, site];
        const key = (mode === 'block') ? 'blockedSites' : 'allowedSites';
        chrome.storage.sync.set({ [key]: updatedSites }, () => {
            siteInput.value = '';
            loadSettings();
        });
    }

    // Add current tab's site
    function addCurrentSite() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) {
                try {
                    const url = new URL(tabs[0].url);
                    const domain = url.hostname.replace(/^www\./, '');
                    addSite(domain);
                } catch (e) { }
            }
        });
    }

    // Toggle block/allow mode
    modeToggle.addEventListener('change', () => {
        // Switch ON (checked) means allowlist, OFF means blocklist
        mode = modeToggle.checked ? 'allow' : 'block';
        chrome.storage.sync.set({ mode }, loadSettings);
        updateModeUI();
    });

    // Add site button
    addSiteBtn.addEventListener('click', () => {
        addSite(siteInput.value);
    });

    // Add current site button
    addCurrentSiteBtn.addEventListener('click', addCurrentSite);

    // Productivity clock and focus mode logic
    function updateFocusUI() {
    if (focusActive) {
        playSvg.style.display = 'none';
        playSvgd.style.display = 'none';
        pauseSvg.style.display = 'block';           // Explicitly set to block
        pauseSvgd.style.display = 'flex';           // Keep flex for centering
        toggleFocusBtn.title = 'Pause Focus Session';
        startFocusClock();
    } else {
        playSvg.style.display = 'block';            // Explicitly set to block
        playSvgd.style.display = 'flex';            // Keep flex for centering
        pauseSvg.style.display = 'none';
        pauseSvgd.style.display = 'none';
        toggleFocusBtn.title = 'Start Focus Session';
        stopFocusClock();
        productivityClock.textContent = msToClock(focusElapsed);
    }
}

    function startFocusClock() {
        stopFocusClock();
        let start = focusStart || Date.now();
        let elapsed = focusElapsed || 0;
        function tick() {
            const now = Date.now();
            const total = elapsed + (now - start);
            productivityClock.textContent = msToClock(total);
            focusTimer = setTimeout(tick, 1000);
        }
        tick();
    }

    function stopFocusClock() {
        if (focusTimer) clearTimeout(focusTimer);
        focusTimer = null;
    }

    function msToClock(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const s = String(totalSeconds % 60).padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    // Play/pause focus mode (stopwatch style)
    toggleFocusBtn.addEventListener('click', () => {
        if (focusActive) {
            // Pause: store elapsed time
            const now = Date.now();
            chrome.storage.sync.get(['focusStart', 'focusElapsed'], (data) => {
                const start = data.focusStart || now;
                const elapsed = (data.focusElapsed || 0) + (now - start);
                chrome.storage.sync.set({ focusActive: false, focusElapsed: elapsed, focusStart: 0 }, loadSettings);
            });
        } else {
            // Start: set start time
            chrome.storage.sync.set({ focusActive: true, focusStart: Date.now() }, loadSettings);
        }
    });

    // Initial load
    loadSettings();

    // Listen for storage changes (sync UI if changed elsewhere)
    chrome.storage.onChanged.addListener(loadSettings);

});