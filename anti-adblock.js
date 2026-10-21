
(function () {
  'use strict';

  const OVERLAY_ID = 'adblock-overlay-host';
  const CHECK_TIMEOUT = 2000; 
  let overlayHost = null;
  let observer = null;
  let reAddInterval = null;
  let detectionRunning = false;

  /* ============================================================
     1. BRAVE & ADBLOCK DETECTION (ULTRA ROBUST)
  ============================================================ */
  async function isBraveBrowser() {
    try {
      if (navigator.brave && typeof navigator.brave.isBrave === 'function') {
        if (await navigator.brave.isBrave()) return true;
      }
    } catch (e) {}
    try {
      if (navigator.userAgentData && navigator.userAgentData.brands) {
        return navigator.userAgentData.brands.some(b => b.brand === 'Brave');
      }
    } catch (e) {}
    return false;
  }

  // Robust Network Check (Script + Image tag approach)
  function checkNetworkBlocks() {
    return new Promise((resolve) => {
      let blockedSignals = 0;
      let completed = 0;
      const totalTests = 2;

      const finish = () => {
        completed++;
        if (completed >= totalTests) {
          resolve(blockedSignals > 0); // Agar 1 bhi block hua toh true
        }
      };

      // Test 1: Script Tag Injection (Google Ads)
      const script = document.createElement('script');
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?cb=' + Math.random();
      script.async = true;
      script.onload = () => finish(); // Loaded = Not blocked
      script.onerror = () => { blockedSignals++; finish(); }; // Error = Blocked
      document.head.appendChild(script);
      setTimeout(() => { script.remove(); }, CHECK_TIMEOUT);

      // Test 2: Image Pixel Injection (DoubleClick)
      const img = new Image();
      img.src = 'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/123456789/?cb=' + Math.random();
      img.onload = () => finish();
      img.onerror = () => { blockedSignals++; finish(); };
      
      // Timeout fallback
      setTimeout(() => { if (completed < totalTests) { blockedSignals++; resolve(true); } }, CHECK_TIMEOUT);
    });
  }

  // DOM Bait Check (Extension blockers)
  function checkDomBait() {
    const bait = document.createElement('div');
    bait.className = 'adsbox ad-banner ad-unit';
    bait.style.cssText = 'position:absolute!important;left:-10000px!important;top:-10000px!important;width:10px!important;height:10px!important;';
    document.body.appendChild(bait);
    const blocked = bait.offsetWidth === 0 || bait.offsetHeight === 0 || getComputedStyle(bait).display === 'none';
    bait.remove();
    return blocked;
  }

  async function detectAdBlock() {
    const brave = await isBraveBrowser();
    const networkBlocked = await checkNetworkBlocks();
    const domBlocked = checkDomBait();

    // Agar Brave hai aur Network block hai, toh pakka Shields ON hai
    if (brave && networkBlocked) return { blocked: true, reason: 'Brave Shields' };
    
    // Agar koi bhi adblocker hai
    if (domBlocked || networkBlocked) return { blocked: true, reason: 'AdBlocker' };

    return { blocked: false };
  }

  /* ============================================================
     2. SHADOW DOM OVERLAY (Jo kabhi gayab nahi hoga)
  ============================================================ */
  function createOverlayHost() {
    const host = document.createElement('div');
    host.id = OVERLAY_ID;
    // Force inline styles taaki site CSS isko hide na kar sake
    host.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:auto!important;display:block!important;visibility:visible!important;opacity:1!important;';

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .wrap { position: fixed; inset: 0; background: #080808; color: #fff; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; text-align: center; z-index: 2147483647; }
        .box { max-width: 480px; }
        h2 { margin: 0 0 16px; font-size: 24px; color: #ff4d4d; }
        p { margin: 0 0 16px; line-height: 1.6; font-size: 16px; color: #e0e0e0; }
        button { background: #e50914; color: #fff; border: 0; border-radius: 8px; padding: 14px 24px; cursor: pointer; font-size: 16px; font-weight: bold; margin-top: 10px; transition: 0.2s; width: 100%; max-width: 300px; }
        button:hover { background: #f40612; }
        button:disabled { opacity: 0.6; cursor: wait; }
        .hint { color: #888; font-size: 13px; margin-top: 20px; line-height: 1.5; }
      </style>
      <div class="wrap">
        <div class="box">
          <h2>Ad Blocker Detected!</h2>
          <p>Is website ko chalane ke liye ads zaroori hain. Kripya apna <b>Ad Blocker</b> band karein ya <b>Brave Shields</b> ko is site ke liye lower karein.</p>
          <button id="adblock-retry">Maine Block Band Kar Diya – Check Karein</button>
          <p class="hint">Brave User? Address bar mein <b>Lion Icon</b> par click karke "Shields Down" karein.</p>
        </div>
      </div>
    `;
    return host;
  }

  function showWarning() {
    if (overlayHost) return; 

    overlayHost = createOverlayHost();
    document.documentElement.appendChild(overlayHost);

    // Overlay ko forcefully zinda rakhne ke liye
    observer = new MutationObserver(() => {
      if (!document.getElementById(OVERLAY_ID) && overlayHost) {
        document.documentElement.appendChild(overlayHost);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    reAddInterval = setInterval(() => {
      if (!document.getElementById(OVERLAY_ID) && overlayHost) {
        document.documentElement.appendChild(overlayHost);
      }
    }, 300);

    // Retry Button
    const retryBtn = overlayHost.shadowRoot.getElementById('adblock-retry');
    retryBtn.addEventListener('click', async () => {
      retryBtn.disabled = true;
      retryBtn.textContent = 'Checking...';

      // Thoda wait karein user ko blocker off karne ka time dene ke liye
      setTimeout(async () => {
        const result = await detectAdBlock();
        if (result.blocked) {
          retryBtn.disabled = false;
          retryBtn.textContent = 'Abhi bhi block hai! Check Again';
        } else {
          // Blocker off ho gaya, overlay hatao
          observer.disconnect();
          clearInterval(reAddInterval);
          overlayHost.remove();
          overlayHost = null;
        }
      }, 800);
    });
  }

  /* ============================================================
     3. INITIALIZATION
  ============================================================ */
  async function runCheck() {
    if (detectionRunning || !document.body) return;
    detectionRunning = true;
    try {
      const result = await detectAdBlock();
      if (result.blocked) {
        console.log("Blocked detected via:", result.reason);
        showWarning();
      }
    } catch (e) {
      console.warn("Detection error:", e);
    } finally {
      detectionRunning = false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runCheck);
  } else {
    runCheck();
  }
})();
