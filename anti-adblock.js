
(function () {
  'use strict';

  const TIMING_THRESHOLD_MS = 5; // Brave Shields: <5ms = blocked
  const OVERLAY_ID = 'adblock-overlay';

  // ---------- 1. Brave browser detect karo (multiple signals) ----------
  async function isBraveBrowser() {
    // Signal A: navigator.brave.isBrave() (agar available ho)
    if (navigator.brave && typeof navigator.brave.isBrave === 'function') {
      try {
        if (await navigator.brave.isBrave()) return true;
      } catch (e) { /* ignore */ }
    }
    // Signal B: User-Agent Client Hints
    if (navigator.userAgentData?.brands) {
      return navigator.userAgentData.brands.some(b => b.brand === 'Brave');
    }
    return false;
  }

  // ---------- 2. Timing check: Brave Shields ka core signal ----------
  async function checkBraveShieldsByTiming() {
    const testDomains = [
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
      'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/123456789/',
      'https://tpc.googlesyndication.com/simgad/123456789'
    ];

    let blockedCount = 0;
    const results = [];

    for (const domain of testDomains) {
      try {
        const start = performance.now();
        await fetch(`${domain}?t=${Date.now()}`, {
          method: 'GET', // HEAD ke bajaye GET zyada reliable ho sakta hai
          mode: 'no-cors',
          cache: 'no-store'
        });
        const elapsed = performance.now() - start;

        const blocked = elapsed < TIMING_THRESHOLD_MS;
        if (blocked) blockedCount++;

        results.push({ domain, elapsed, blocked });
      } catch (err) {
        // Request fail => blocked (DNS, network, ya Shields)
        blockedCount++;
        results.push({ domain, error: true, blocked: true });
      }
    }

    // Majority blocked => Shields up
    const shieldsUp = blockedCount >= Math.ceil(testDomains.length / 2);
    return { shieldsUp, blockedCount, total: testDomains.length, results };
  }

  // ---------- 3. Bait element check (extension-based blockers) ----------
  function checkDomBait() {
    const bait = document.createElement('div');
    bait.className = 'adsbox ad-banner ad-unit';
    bait.style.cssText =
      'position:absolute!important;left:-10000px!important;' +
      'top:-10000px!important;width:10px!important;height:10px!important;';
    document.body.appendChild(bait);

    const blocked =
      bait.offsetWidth === 0 ||
      bait.offsetHeight === 0 ||
      getComputedStyle(bait).display === 'none' ||
      getComputedStyle(bait).visibility === 'hidden';

    bait.remove();
    return blocked;
  }

  // ---------- 4. Main detection ----------
  async function detectAdBlock() {
    const brave = await isBraveBrowser();

    // Brave ke liye timing check sabse important hai
    if (brave) {
      const timingResult = await checkBraveShieldsByTiming();
      if (timingResult.shieldsUp) {
        return { blocked: true, reason: 'Brave Shields active (timing)' };
      }
      // Agar timing se confirm nahi hua, toh DOM bait bhi check kar lo
      if (checkDomBait()) {
        return { blocked: true, reason: 'Brave DOM blocking' };
      }
      return { blocked: false };
    }

    // Non-Brave browsers: DOM bait + timing (optional)
    if (checkDomBait()) {
      return { blocked: true, reason: 'DOM ad-blocker' };
    }

    // Timing check sirf tab jab Brave na ho (false positive se bachne ke liye)
    return { blocked: false };
  }

  // ---------- 5. Overlay dikhao ----------
  function showWarning() {
    if (document.getElementById(OVERLAY_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <div style="position:fixed;inset:0;z-index:2147483647;
        background:#080808;color:#fff;display:grid;place-items:center;
        padding:24px;font-family:Arial,sans-serif;text-align:center;">
        <div style="max-width:460px">
          <h2>Ad Blocker / Brave Shields Detected</h2>
          <p>
            Is website ko ads se support milta hai. Kripya apna ad blocker
            band karein ya Brave Shields ko is site ke liye lower karein,
            phir dobara try karein.
          </p>
          <button id="adblock-retry"
            style="background:#e50914;color:#fff;border:0;border-radius:8px;
            padding:12px 22px;cursor:pointer;font-size:16px;margin-top:12px;">
            Maine Band Kar Diya – Dobara Check Karein
          </button>
          <p style="color:#aaa;font-size:13px;margin-top:16px;">
            Brave user hain? Address bar mein lion icon par click karke
            "Shields Down" karein. DNS blocker use kar rahe hain? Is domain
            ko whitelist karein.
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('adblock-retry').addEventListener('click', async () => {
      const btn = document.getElementById('adblock-retry');
      btn.disabled = true;
      btn.textContent = 'Checking...';

      const result = await detectAdBlock();

      if (result.blocked) {
        btn.disabled = false;
        btn.textContent = 'Maine Band Kar Diya – Dobara Check Karein';
      } else {
        overlay.remove();
      }
    });
  }

  // ---------- 6. Run ----------
  async function run() {
    if (!document.body) return;
    const result = await detectAdBlock();
    if (result.blocked) showWarning();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
