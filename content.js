// Content script to handle sites that partially load

(function () {
    'use strict';

    const currentDomain = window.location.hostname.replace(/^www\./, '');

    const socialMediaDomains = {
        'x.com': ['twitter.com', 't.co'],
        'twitter.com': ['x.com', 't.co'],
        'instagram.com': ['instagr.am'],
        'facebook.com': ['fb.com', 'm.facebook.com'],
        'youtube.com': ['youtu.be', 'm.youtube.com'],
        'tiktok.com': ['vm.tiktok.com'],
        'reddit.com': ['old.reddit.com', 'new.reddit.com'],
        'linkedin.com': ['lnkd.in']
    };

    let observer = null;

    function blockPage() {
        try {
            observer?.disconnect();
        } catch (e) {
            console.warn('Observer cleanup failed:', e);
        }
        document.documentElement.style.display = 'none';
        document.body.style.display = 'none';

        // Remove all existing scripts
        const scripts = document.querySelectorAll('script');
        scripts.forEach(script => script.remove());

        // Redirect to blocked page after a short delay
        setTimeout(() => {
            const blockedUrl = encodeURIComponent(window.location.href);
            window.location.href = chrome.runtime.getURL('blocked.html') + '?url=' + blockedUrl;
        }, 100);

        // Fallback in case redirect fails
        setTimeout(() => {
            const fallbackUrl = chrome.runtime.getURL('blocked.html');
            if (window.location.href !== fallbackUrl) {
                const currentUrl = window.location.hostname;
                document.documentElement.innerHTML = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>This site can't be reached</title>
            <style>
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #ffffff;
                color: #202124;
                max-width: 600px;
                margin: 0 auto;
                margin-top: -40px;
                padding: 0px 20px;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                justify-content: center;
              }
              .error-icon {
                width: 80px;
                height: 80px;
                margin-bottom: 20px;
                background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="%235f6368" stroke-width="3"/><path d="M35 35l30 30M35 65l30-30" stroke="%235f6368" stroke-width="3" stroke-linecap="round"/></svg>');
                background-size: contain;
                background-repeat: no-repeat;
              }
              h1 { font-size: 32px; font-weight: 400; margin-bottom: 16px; }
              .url { font-size: 16px; color: #5f6368; margin-bottom: 24px; font-family: monospace; }
              .error-message { font-size: 16px; margin-bottom: 32px; color: #5f6368; }
              .sarcastic { background: #f8f9fa; border: 1px solid #e8eaed; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-style: italic; color: #5f6368; }
            </style>
          </head>
          <body>
            <div class="error-icon"></div>
            <h1>This site can't be reached</h1>
            <div class="url">${currentUrl}</div>
            <div class="error-message"><strong>${currentUrl}</strong> unexpectedly closed the connection.</div>
            <div class="sarcastic">Plot twist: Your productivity doesn't actually depend on checking this site every 30 seconds. 😱</div>
            <div style="color: #5f6368; font-size: 12px; font-family: monospace;">ERR_DEEPTIME_FOCUS_MODE_ACTIVE</div>
          </body>
          </html>
        `;
            }
        }, 500);
    }

    function shouldBlockSite(data) {
        const {
            blockedSites = [],
            allowedSites = [],
            mode = 'block',
            focusActive = false
        } = data;

        if (!focusActive) return false;

        if (mode === 'allow' && allowedSites.length > 0) {
            const isAllowed = allowedSites.some(site => {
                const clean = site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
                return currentDomain === clean || currentDomain === `www.${clean}`;
            });
            return !isAllowed;
        } else if (mode === 'block' && blockedSites.length > 0) {
            return blockedSites.some(site => {
                const clean = site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
                return currentDomain === clean || currentDomain === `www.${clean}`;
            });
        }
        return false;
    }

    // Initial check
    try {
        chrome.storage.sync.get(['blockedSites', 'allowedSites', 'mode', 'focusActive'], (data) => {
            if (shouldBlockSite(data)) {
                blockPage();
            }
        });
    } catch (e) {
        // Ignore extension context invalidation errors
    }

    // Mutation observer logic
    observer = new MutationObserver(() => {
        if (document.readyState === 'unloading') return;
        try {
            chrome.storage.sync.get(['blockedSites', 'allowedSites', 'mode', 'focusActive'], (data) => {
                if (shouldBlockSite(data)) {
                    blockPage();
                }
            });
        } catch (e) {
            // Ignore extension context invalidation errors
        }
    });

    // Wait for body to be available before observing
    function waitForBodyAndObserve() {
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            requestAnimationFrame(waitForBodyAndObserve);
        }
    }
    waitForBodyAndObserve();

})();
