// Utility: Remove all DNR rules (for debugging or full reset)
function clearAllDnrRules(callback) {
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
        const ids = rules.map(r => r.id);
        if (ids.length === 0) {
            if (callback) callback();
            return;
        }
        chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: ids,
            addRules: []
        }, () => {
            console.log('All DNR rules cleared:', ids);
            if (callback) callback();
        });
    });
}
// Valid resource types for DNR API
const VALID_RESOURCE_TYPES = new Set([
    "csp_report", "font", "image", "main_frame", "media", "object",
    "other", "ping", "script", "stylesheet", "sub_frame",
    "webbundle", "websocket", "webtransport", "xmlhttprequest"
]);

function sanitizeResourceTypes(types = []) {
    return types.filter(type => VALID_RESOURCE_TYPES.has(type));
}


function updateBlockRules(blockedSites = [], allowedSites = [], mode = 'block', focusActive = false) {
    console.log('updateBlockRules called with:', { blockedSites, allowedSites, mode, focusActive });

    let rules = [];
    let ruleId = 1;

    if (focusActive) {
        if (mode === 'allow' && allowedSites.length > 0) {
            // Whitelist mode: block everything except allowed
            const allowedDomains = allowedSites.map(site =>
                site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
            );
            rules.push({
                id: ruleId++,
                priority: 1,
                action: {
                    type: 'redirect',
                    redirect: { url: chrome.runtime.getURL('blocked.html') }
                },
                condition: {
                    urlFilter: '*',
                    excludedRequestDomains: allowedDomains,
                    resourceTypes: ['main_frame']
                }
            });
        } else if (mode === 'block' && blockedSites.length > 0) {
            // Blocklist mode: block only listed
            const socialMediaMappings = {
                'x.com': ['www.x.com', 't.co'],
                'twitter.com': ['www.twitter.com', 't.co'],
                'instagram.com': ['www.instagram.com', 'instagr.am'],
                'facebook.com': ['www.facebook.com', 'fb.com', 'www.fb.com', 'm.facebook.com'],
                'youtube.com': ['www.youtube.com', 'youtu.be', 'm.youtube.com'],
                'tiktok.com': ['www.tiktok.com', 'vm.tiktok.com'],
                'reddit.com': ['www.reddit.com', 'old.reddit.com', 'new.reddit.com'],
                'linkedin.com': ['www.linkedin.com', 'lnkd.in']
            };
            for (const site of blockedSites) {
                const cleanDomain = site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
                const variations = [cleanDomain];
                if (!cleanDomain.startsWith('www.')) {
                    variations.push(`www.${cleanDomain}`);
                }
                if (socialMediaMappings[cleanDomain]) {
                    variations.push(...socialMediaMappings[cleanDomain].filter(alias => {
                        return !blockedSites.some(site => {
                            const s = site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
                            return s === alias;
                        });
                    }));
                }
                for (const domain of variations) {
                    rules.push({
                        id: ruleId++,
                        priority: 3,
                        action: {
                            type: 'redirect',
                            redirect: { url: chrome.runtime.getURL('blocked.html') }
                        },
                        condition: {
                            requestDomains: [domain],
                            resourceTypes: ['main_frame']
                        }
                    });
                    rules.push({
                        id: ruleId++,
                        priority: 3,
                        action: { type: 'block' },
                        condition: {
                            requestDomains: [domain],
                            resourceTypes: ['sub_frame']
                        }
                    });
                }
            }
        }
    } else {
        // Not in focus mode: no blocking
        console.log('[DNR] No blocking: focus mode is not active');
    }

    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: Array.from({ length: 1000 }, (_, i) => i + 1),
        addRules: rules
    }, () => {
        if (chrome.runtime.lastError) {
            console.error('DNR update error:', chrome.runtime.lastError.message);
        } else {
            console.log('DNR rules updated. Active rules:', rules.length);
        }
    });
}

// Fetch from storage and update rules
function refreshRulesFromStorage() {
    // Always clear all DNR rules before updating, to avoid persistence issues
    clearAllDnrRules(() => {
        chrome.storage.sync.get(['blockedSites', 'allowedSites', 'mode', 'focusActive'], (data) => {
            updateBlockRules(
                data.blockedSites || [],
                data.allowedSites || [],
                data.mode || 'block',
                !!data.focusActive
            );
        });
    });
}

// React to changes
chrome.storage.onChanged.addListener((changes) => {
    console.log('Storage changed:', changes);
    refreshRulesFromStorage();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('Alarm triggered:', alarm.name);
    if (alarm.name === 'focusEnd') {
        chrome.storage.sync.set({ focusEnd: 0 }, refreshRulesFromStorage);
    } else if (alarm.name === 'breakEnd') {
        chrome.storage.sync.set({ breakEnd: 0 }, refreshRulesFromStorage);
    } else {
        refreshRulesFromStorage();
    }
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Extension startup');
    refreshRulesFromStorage();
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
    refreshRulesFromStorage();
});

// Periodic refresh
setInterval(refreshRulesFromStorage, 60000);
