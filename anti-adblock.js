
(function () {
  'use strict';

  /* ============================================================
     CONFIG
  ============================================================ */
  const OVERLAY_ID = 'adblock-overlay-host';
  const TIMING_THRESHOLD_MS = 5;   // Brave Shields: <5ms = blocked
  const RE_ADD_INTERVAL = 300;     // agar overlay hataya jaaye
  const CHECK_TIMEOUT = 2500;

  let overlayHost = null;
  let observer = null;
  let reAddInterval = null;
  let detectionRunning = false;

  /* ============================================================
     BRAVE BROWSER DETECTION
  ============================================================ */
  async function isBraveBrowser() {
    try {
      if (navigator.brave && typeof navigator.brave.isBrave === 'function') {
        if (await navigator.brave.isBrave()) return true;
      }
    } catch (e) { /* ignore */ }

    try {
      if (navigator.userAgentData && navigator.userAgentData.brands) {
        return navigator.userAgentData.brands.some(
          (b) => b.brand === 'Brave'
        );
      }
    } catch (e) { /* ignore */ }

    return false;
  }

  /* ============================================================
     TIMING-BASED SHIELDS CHECK (Brave Shields core signal)
  ============================================================ */
  function checkShieldsByTiming() {
    const testDomains = [
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
      'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/123456789/',
      'https://tpc.googlesyndication.com/simgad/123456789'
    ];

    return new Promise((resolve) => {
      let blockedCount = 0;
      let completed = 0;
      let resolved = false;

      const finish = () => {
        if (resolved) return;
        resolved = true;
        const shieldsUp = blockedCount >= Math.ceil(testDomains.length / 2);
        resolve(shieldsUp);
      };

      const timer = setTimeout(finish, CHECK_TIMEOUT);

      testDomains.forEach((domain) => {
        const start = performance.now();
        fetch(domain + '?t=' + Date.now(), {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store',
          credentials: 'omit'
        })
          .then(() => {
            const elapsed = performance.now() - start;
            if (elapsed < TIMING_THRESHOLD_MS) blockedCount++;
          })
          .catch(() => {
            blockedCount++;
          })
          .finally(() => {
            completed++;
            if (completed === testDomains.length) {
              clearTimeout(timer);
              finish();
            }
          });
      });
    });
  }

  /* ============================================================
     DOM BAIT CHECK (extension blockers)
  ============================================================ */
  function checkDomBait() {
    const bait = document.createElement('div');
    bait.className = 'adsbox ad-banner ad-unit';
    bait.setAttribute('aria-hidden', 'true');
    bait.style.cssText =
      'position:absolute!important;left:-10000px!important;' +
      'top:-10000px!important;width:10px!important;' +
      'height:10px!important;pointer-events:none!important;';
    document.body.appendChild(bait);

    const style = getComputedStyle(bait);
    const blocked =
      bait.offsetWidth === 0 ||
      bait.offsetHeight === 0 ||
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0';

    bait.remove();
    return blocked;
  }

  /* ============================================================
     MAIN DETECTION
  ============================================================ */
  async function detectAdBlock() {
    const brave = await isBraveBrowser();

    if (brave) {
      const shieldsUp = await checkShieldsByTiming();
      if (shieldsUp) {
        return { blocked: true, reason: 'Brave Shields active' };
      }
      if (checkDomBait()) {
        return { blocked: true, reason: 'Brave DOM blocking' };
      }
      return { blocked: false };
    }

    // Non-Brave: bait + timing (but require bait OR strong timing)
    const baitBlocked = checkDomBait();
    if (baitBlocked) {
      return { blocked: true, reason: 'DOM ad-blocker' };
    }

    const shieldsUp = await checkShieldsByTiming();
    if (shieldsUp) {
      return { blocked: true, reason: 'Network-level blocking' };
    }

    return { blocked: false };
  }

  /* ============================================================
     OVERLAY (Shadow DOM, persistent)
  ============================================================ */
  function createOverlayHost() {
    const host = document.createElement('div');
    host.id = OVERLAY_ID;
    host.style.cssText =
      'position:fixed!important;inset:0!important;' +
      'z-index:2147483647!important;pointer-events:auto!important;' +
      'margin:0!important;padding:0!important;border:0!important;' +
      'display:block!important;visibility:visible!important;' +
      'opacity:1!important;transform:none!important;';

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .wrap {
          position: fixed;
          inset: 0;
          background: #080808;
          color: #ffffff;
          display: grid;
          place-items: center;
          padding: 24px;
          font-family: Arial, sans-serif;
          text-align: center;
          z-index: 2147483647;
        }
        .box { max-width: 460px; }
        h2 { margin: 0 0 16px; font-size: 22px; }
        p { margin: 0 0 14px; line-height: 1.5; font-size: 15px; }
        button {
          background: #e50914;
          color: #ffffff;
          border: 0;
          border-radius: 8px;
          padding: 12px 22px;
          cursor: pointer;
          font-size: 16px;
          margin-top: 8px;
        }
        button:disabled { opacity: 0.6; cursor: wait; }
        .hint {
          color: #aaaaaa;
          font-size: 13px;
          margin-top: 18px;
          line-height: 1.5;
        }
      </style>
      <div class="wrap">
        <div class="box">
          <h2>Ad Blocker / Brave Shields Detected</h2>
          <p>
            Is website ko ads se support milta hai.
            Kripya apna ad blocker band karein ya Brave Shields
            ko is site ke liye lower karein, phir dobara try karein.
          </p>
          <button id="adblock-retry">Maine Band Kar Diya – Dobara Check Karein</button>
          <p class="hint">
            Brave user hain? Address bar mein lion icon par click
            karke <strong>Shields Down</strong> karein.<br>
            DNS blocker use kar rahe hain? Is domain ko whitelist karein.
          </p>
        </div>
      </div>
    `;
    return host;
  }

  function attachOverlayPersistence() {
    // 1) MutationObserver: agar koi overlay hata de, turant wapas lagao
    observer = new MutationObserver(() => {
      if (!document.getElementById(OVERLAY_ID) && overlayHost) {
        try {
          document.documentElement.appendChild(overlayHost);
        } catch (e) { /* ignore */ }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    // 2) Interval fallback
    reAddInterval = setInterval(() => {
      if (!document.getElementById(OVERLAY_ID) && overlayHost) {
        try {
          document.documentElement.appendChild(overlayHost);
        } catch (e) { /* ignore */ }
      }
    }, RE_ADD_INTERVAL);
  }

  function destroyOverlay() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (reAddInterval) {
      clearInterval(reAddInterval);
      reAddInterval = null;
    }
    if (overlayHost && overlayHost.parentNode) {
      overlayHost.parentNode.removeChild(overlayHost);
    }
    overlayHost = null;
  }

  function showWarning() {
    if (overlayHost) return; // already shown

    overlayHost = createOverlayHost();
    document.documentElement.appendChild(overlayHost);
    attachOverlayPersistence();

    // Button handler (shadow root ke andar)
    const retryBtn = overlayHost.shadowRoot.getElementById('adblock-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', async () => {
        retryBtn.disabled = true;
        retryBtn.textContent = 'Checking...';

        const result = await detectAdBlock();

        if (result.blocked) {
          retryBtn.disabled = false;
          retryBtn.textContent =
            'Maine Band Kar Diya – Dobara Check Karein';
        } else {
          destroyOverlay();
        }
      });
    }
  }

  /* ============================================================
     RUN
  ============================================================ */
  async function runCheck() {
    if (detectionRunning) return;
    if (!document.body) return;

    detectionRunning = true;
    try {
      const result = await detectAdBlock();
      if (result.blocked) {
        showWarning();
      }
    } catch (e) {
      // Silent fail — site block na kare
      console.warn('[AdBlockDetect] error', e);
    } finally {
      detectionRunning = false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runCheck, { once: true });
  } else {
    runCheck();
  }
})();
