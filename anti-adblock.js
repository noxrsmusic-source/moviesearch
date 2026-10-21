
(function () {
  'use strict';

  const CHECK_TIMEOUT = 2000; // 2 seconds max for network checks
  let overlayShown = false;

  // ---------- 1. Cosmetic check (bait element) ----------
  function checkCosmetic() {
    return new Promise((resolve) => {
      const bait = document.createElement('div');
      // Random class + common ad class names (EasyList bait)
      const randomClass = 'ad-' + Math.random().toString(36).slice(2, 8);
      bait.className = `adsbox ad-banner ad-unit ${randomClass}`;
      bait.setAttribute('aria-hidden', 'true');
      bait.style.cssText = `
        position: absolute !important;
        left: -10000px !important;
        top: -10000px !important;
        width: 10px !important;
        height: 10px !important;
        pointer-events: none !important;
      `;
      document.body.appendChild(bait);

      setTimeout(() => {
        const style = getComputedStyle(bait);
        const blocked =
          bait.offsetWidth === 0 ||
          bait.offsetHeight === 0 ||
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.opacity === '0';

        bait.remove();
        resolve(blocked);
      }, 100);
    });
  }

  // ---------- 2. Network check (DNS / Brave Shields) ----------
  function checkNetwork() {
    return new Promise((resolve) => {
      const testUrls = [
        'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
        'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/123456789/',
        'https://tpc.googlesyndication.com/simgad/123456789'
      ];

      let blockedCount = 0;
      let completed = 0;

      const timeout = setTimeout(() => {
        // If requests are hanging (DNS blocked / timeout), treat as blocked
        resolve(blockedCount > 0);
      }, CHECK_TIMEOUT);

      testUrls.forEach((url) => {
        const start = performance.now();
        fetch(url + '?t=' + Date.now(), {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store'
        })
          .then(() => {
            const elapsed = performance.now() - start;
            // Brave Shields: response too fast (< 5ms) = blocked
            if (elapsed < 5) {
              blockedCount++;
            }
          })
          .catch(() => {
            // Request failed = blocked (DNS, network, adblocker)
            blockedCount++;
          })
          .finally(() => {
            completed++;
            if (completed === testUrls.length) {
              clearTimeout(timeout);
              resolve(blockedCount >= 2); // at least 2 out of 3 blocked
            }
          });
      });
    });
  }

  // ---------- 3. Resource check (tracker pixel) ----------
  function checkResource() {
    return new Promise((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => resolve(false), CHECK_TIMEOUT);

      img.onload = () => {
        clearTimeout(timeout);
        resolve(false); // loaded successfully => not blocked
      };
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(true); // failed => blocked
      };

      img.src =
        'https://www.google-analytics.com/collect?v=1&t=pageview&tid=UA-000000-0&cid=123&t=' +
        Date.now();
    });
  }

  // ---------- Brave-specific quick check ----------
  function isBraveBrowser() {
    return (
      typeof navigator.brave !== 'undefined' &&
      typeof navigator.brave.isBrave === 'function'
    );
  }

  // ---------- Main detection ----------
  async function detectAdBlocker() {
    const results = await Promise.all([
      checkCosmetic(),
      checkNetwork(),
      checkResource()
    ]);

    const blockedSignals = results.filter(Boolean).length;

    // Require at least 2 positive signals to avoid false positives
    // If Brave browser is detected, we are more lenient (1 signal enough)
    if (isBraveBrowser()) {
      return blockedSignals >= 1;
    }

    return blockedSignals >= 2;
  }

  // ---------- Show overlay ----------
  function showWarning() {
    if (overlayShown) return;
    overlayShown = true;

    const overlay = document.createElement('div');
    overlay.id = 'adblock-overlay';
    overlay.innerHTML = `
      <div style="position:fixed;inset:0;z-index:2147483647;
        background:#080808;color:#fff;display:grid;place-items:center;
        padding:24px;font-family:Arial,sans-serif;text-align:center;">
        <div style="max-width:420px">
          <h2>Ad Blocker Detected</h2>
          <p>This website is supported by ads. Please disable your ad blocker
          (or change your browser/DNS settings) and try again.</p>
          <button id="adblock-retry"
            style="background:#e50914;color:#fff;border:0;border-radius:8px;
            padding:12px 22px;cursor:pointer;font-size:16px;">
            I've Disabled It – Check Again
          </button>
          <p style="color:#aaa;font-size:13px;margin-top:16px;">
            If you are using Brave, please lower Shields for this site.
            If you use a DNS blocker, please whitelist this domain.
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('adblock-retry').addEventListener('click', async () => {
      const btn = document.getElementById('adblock-retry');
      btn.disabled = true;
      btn.textContent = 'Checking...';

      const stillBlocked = await detectAdBlocker();

      if (stillBlocked) {
        btn.disabled = false;
        btn.textContent = "I've Disabled It – Check Again";
      } else {
        overlay.remove();
        overlayShown = false;
      }
    });
  }

  // ---------- Run on page load ----------
  async function run() {
    if (!document.body) return;
    if (await detectAdBlocker()) {
      showWarning();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
