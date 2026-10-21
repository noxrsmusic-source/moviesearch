
(function () {
  'use strict';

  const OVERLAY_ID = 'adblock-overlay-host';
  const CHECK_TIMEOUT = 2000; 
  let overlayHost = null;
  let observer = null;
  let reAddInterval = null;
  let detectionRunning = false;

  /* ============================================================
     TRANSLATIONS (Hindi & English)
  ============================================================ */
  const translations = {
    hi: {
      title: "Ad Blocker Detected",
      body: "Kripya apna <b>Ad Blocker</b> band karein, <b>Brave Shields</b> ko is site ke liye disable karein, ya kisi anya browser mein try karein.",
      btnCheck: "Maine Ad Blocker Band Kar Diya – Check Karein",
      btnWait: "Checking...",
      btnStillBlocked: "Abhi bhi block hai! Check Again",
      hint1: "<b>Brave use kar rahe hain?</b> Address bar mein Lion icon par click karke \"Shields Down\" karein.",
      hint2: "<b>DNS Blocker?</b> Kripya is domain ko whitelist karein.",
      toggleLabel: "English"
    },
    en: {
      title: "Ad Blocker Detected",
      body: "Please disable your <b>Ad Blocker</b>, lower <b>Brave Shields</b> for this site, or try using a different browser.",
      btnCheck: "I've Disabled It – Check Again",
      btnWait: "Checking...",
      btnStillBlocked: "Still blocked! Check Again",
      hint1: "<b>Using Brave?</b> Click the Lion icon in the address bar and select \"Shields Down\".",
      hint2: "<b>Using a DNS Blocker?</b> Please whitelist our domain.",
      toggleLabel: "हिंदी"
    }
  };

  // Get saved language or default to Hindi
  let currentLang = localStorage.getItem('adblock_lang') || 'hi';

  /* ============================================================
     1. BRAVE & ADBLOCK DETECTION
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

  function checkNetworkBlocks() {
    return new Promise((resolve) => {
      let blockedSignals = 0;
      let completed = 0;
      const totalTests = 2;

      const finish = () => {
        completed++;
        if (completed >= totalTests) resolve(blockedSignals > 0);
      };

      const script = document.createElement('script');
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?cb=' + Math.random();
      script.async = true;
      script.onload = () => finish();
      script.onerror = () => { blockedSignals++; finish(); };
      document.head.appendChild(script);
      setTimeout(() => { script.remove(); }, CHECK_TIMEOUT);

      const img = new Image();
      img.src = 'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/123456789/?cb=' + Math.random();
      img.onload = () => finish();
      img.onerror = () => { blockedSignals++; finish(); };
      
      setTimeout(() => { if (completed < totalTests) { blockedSignals++; resolve(true); } }, CHECK_TIMEOUT);
    });
  }

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

    if (brave && networkBlocked) return { blocked: true, reason: 'Brave Shields' };
    if (domBlocked || networkBlocked) return { blocked: true, reason: 'AdBlocker' };
    return { blocked: false };
  }

  /* ============================================================
     2. SHADOW DOM OVERLAY (With Language Toggle)
  ============================================================ */
  function createOverlayHost() {
    const host = document.createElement('div');
    host.id = OVERLAY_ID;
    host.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:auto!important;display:block!important;visibility:visible!important;opacity:1!important;';

    const shadow = host.attachShadow({ mode: 'open' });
    
    // Initial HTML setup
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .wrap { 
          position: fixed; inset: 0; background: #0f0f11; color: #fff; 
          display: flex; align-items: center; justify-content: center; 
          padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; 
          text-align: center; z-index: 2147483647; 
        }
        .box { 
          position: relative; max-width: 480px; background: #1c1c1f; padding: 40px 30px; 
          border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          border: 1px solid #333;
        }
        h2 { margin: 0 0 16px; font-size: 24px; color: #fff; font-weight: 700; letter-spacing: 0.5px;}
        p { margin: 0 0 24px; line-height: 1.6; font-size: 16px; color: #b3b3b3; }
        button.main-btn { 
          background: #e50914; color: #fff; border: 0; border-radius: 8px; 
          padding: 14px 24px; cursor: pointer; font-size: 16px; font-weight: bold; 
          transition: 0.2s; width: 100%; max-width: 320px; 
        }
        button.main-btn:hover { background: #f40612; transform: translateY(-2px); }
        button.main-btn:disabled { opacity: 0.6; cursor: wait; transform: none; }
        
        .lang-toggle {
          position: absolute; top: 12px; right: 16px; 
          background: transparent; border: 1px solid #444; color: #aaa; 
          padding: 4px 10px; border-radius: 6px; cursor: pointer; 
          font-size: 12px; font-weight: bold; transition: 0.2s;
        }
        .lang-toggle:hover { background: #333; color: #fff; }
        
        .hint { color: #777; font-size: 13px; margin-top: 24px; line-height: 1.5; }
        .hint b { color: #aaa; }
      </style>
      <div class="wrap">
        <div class="box">
          <button class="lang-toggle" id="lang-toggle">${translations[currentLang].toggleLabel}</button>
          
          <h2 id="ad-title">${translations[currentLang].title}</h2>
          <p id="ad-body">${translations[currentLang].body}</p>
          
          <button class="main-btn" id="adblock-retry">${translations[currentLang].btnCheck}</button>
          
          <p class="hint" id="ad-hint">
            ${translations[currentLang].hint1}<br>
            ${translations[currentLang].hint2}
          </p>
        </div>
      </div>
    `;
    return host;
  }

  function showWarning() {
    if (overlayHost) return; 

    overlayHost = createOverlayHost();
    document.documentElement.appendChild(overlayHost);

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

    const shadowRoot = overlayHost.shadowRoot;
    const retryBtn = shadowRoot.getElementById('adblock-retry');
    const langToggleBtn = shadowRoot.getElementById('lang-toggle');
    const titleEl = shadowRoot.getElementById('ad-title');
    const bodyEl = shadowRoot.getElementById('ad-body');
    const hintEl = shadowRoot.getElementById('ad-hint');

    // Language Toggle Logic
    langToggleBtn.addEventListener('click', () => {
      currentLang = currentLang === 'hi' ? 'en' : 'hi';
      localStorage.setItem('adblock_lang', currentLang);

      // Update texts
      titleEl.innerHTML = translations[currentLang].title;
      bodyEl.innerHTML = translations[currentLang].body;
      hintEl.innerHTML = `${translations[currentLang].hint1}<br>${translations[currentLang].hint2}`;
      langToggleBtn.textContent = translations[currentLang].toggleLabel;

      // Update button text if not currently checking
      if (!retryBtn.disabled) {
        retryBtn.textContent = translations[currentLang].btnCheck;
      }
    });

    // Retry Button Logic
    retryBtn.addEventListener('click', async () => {
      retryBtn.disabled = true;
      retryBtn.textContent = translations[currentLang].btnWait;

      setTimeout(async () => {
        const result = await detectAdBlock();
        if (result.blocked) {
          retryBtn.disabled = false;
          retryBtn.textContent = translations[currentLang].btnStillBlocked;
        } else {
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
