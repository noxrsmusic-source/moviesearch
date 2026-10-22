(function () {
  'use strict';

  const OVERLAY_ID = 'adblock-overlay-host';
  const CONTINUE_ID = 'adblock-continue-host';
  const CHECK_TIMEOUT = 2000; 
  let overlayHost = null;
  let observer = null;
  let reAddInterval = null;
  let detectionRunning = false;
  
  // AUDIO PRELOAD VARIABLE
  let bgAudio = null;
  const AUDIO_URL = 'https://res.cloudinary.com/du9nysbwl/video/upload/v1792581281/Silent_Partner_-_Space_Walk_Youtube_Premiere_Countdown_download_60_fps_jphhye.mp3';

  // Aapki site ke posters
  const posters1 = ['https://m.media-amazon.com/images/M/MV5BMTk2ZmFhYjctYWZiYy00N2IxLWEzMWItZGRiMDY4ZDQwZWFlXkEyXkFqcGc@._V1_QL75_UY281_CR11,0,190,281_.jpg', 'https://m.media-amazon.com/images/M/MV5BNzdkNjAxNWMtNWY3My00NTI1LTg2YWQtOGI3MDA0NzdhMjEyXkEyXkFqcGc@._V1_QL75_UY281_CR12,0,190,281_.jpg', 'https://m.media-amazon.com/images/M/MV5BOWNjYWM3NWItOGE0ZS00MWRjLThiZWEtYjc4ZmNmMmU5ZTVmXkEyXkFqcGc@._V1_QL75_UX190_CR0,0,190,281_.jpg'];
  const posters2 = ['https://m.media-amazon.com/images/M/MV5BMjEzMDAxOTUyMV5BMl5BanBnXkFtZTgwNzAxMzYzOTE@._V1_QL75_UX190_CR0,0,190,281_.jpg', 'https://m.media-amazon.com/images/M/MV5BMGUzOWE4NDItNzAxYy00M2VkLWFiNDEtNjczZTQ2Nzg5YmVhXkEyXkFqcGc@._V1_QL75_UY281_CR18,0,190,281_.jpg', 'https://m.media-amazon.com/images/M/MV5BYmEzYTQ2OTEtMGM4MS00MWE1LWI3MGYtMTIyN2IwYzlkYmI0XkEyXkFqcGc@._V1_QL75_UY281_CR18,0,190,281_.jpg'];
  const posters3 = ['https://m.media-amazon.com/images/M/MV5BMWU1OGEwNmQtNGM3MS00YTYyLThmYmMtN2FjYzQzNzNmNTE0XkEyXkFqcGc@._V1_QL75_UX190_CR0,2,190,281_.jpg', 'https://m.media-amazon.com/images/M/MV5BZTNjOWI0ZTAtOGY1OS00ZGU0LWEyOWYtMjhkYjdlYmVjMDk2XkEyXkFqcGc@._V1_QL75_UY281_CR1,0,190,281_.jpg'];

  /* ============================================================
     TRANSLATIONS
  ============================================================ */
  const translations = {
    en: {
      title: "Ad Blocker Detected",
      body: "Please disable your <b>Ad Blocker</b>, lower <b>Brave Shields</b> for this site, or try using a different browser.",
      btnCheck: "I've Disabled It – Check Again",
      btnWait: "Checking...",
      btnStillBlocked: "Still blocked! Check Again",
      hint1: "<b>Using Brave?</b> Click the Lion icon in the address bar and select \"Shields Down\".",
      hint2: "<b>Using a DNS Blocker?</b> Please whitelist our domain.",
      toggleLabel: "हिंदी"
    },
    hi: {
      title: "Ad Blocker Detected",
      body: "Kripya apna <b>Ad Blocker</b> band karein, <b>Brave Shields</b> ko is site ke liye disable karein, ya kisi anya browser mein try karein.",
      btnCheck: "Maine Ad Blocker Band Kar Diya – Check Karein",
      btnWait: "Checking...",
      btnStillBlocked: "Abhi bhi block hai! Check Again",
      hint1: "<b>Brave use kar rahe hain?</b> Address bar mein Lion icon par click karke \"Shields Down\" karein.",
      hint2: "<b>DNS Blocker?</b> Kripya is domain ko whitelist karein.",
      toggleLabel: "English"
    }
  };

  let currentLang = localStorage.getItem('adblock_lang') || 'en';

  /* ============================================================
     1. DETECTION LOGIC
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
     2. CONTINUE BUTTON UI (WITH PRELOADING)
  ============================================================ */
  function showContinueButton() {
    if (document.getElementById(CONTINUE_ID)) return;

    // 🚀 AUDIO PRELOAD START 🚀
    // User button dekhega aur click karega, tab tak audio background me load ho jayega
    if (!bgAudio) {
      bgAudio = new Audio(AUDIO_URL);
      bgAudio.loop = true;
      bgAudio.volume = 0.3;
      bgAudio.preload = 'auto'; // Force browser to download audio
      bgAudio.load(); 
    }

    const host = document.createElement('div');
    host.id = CONTINUE_ID;
    host.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483646!important;background:#050505!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;font-family:sans-serif!important;overflow:hidden!important;';

    const shadow = host.attachShadow({ mode: 'open' });
    
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        
        @keyframes scrollUp {
          0% { transform: translateY(0); }
          100% { transform: translateY(calc(-50% - 6px)); }
        }
        
        .wrap { 
          position: fixed; inset: 0; background: #050505;
          display: flex; flex-direction: column; align-items: center; justify-content: center; 
          padding: 24px; text-align: center; z-index: 10; overflow: hidden;
        }
        
        .overlay-bg-wrapper {
          position: absolute; inset: 0; display: flex; justify-content: center; gap: 12px;
          opacity: 0.45; z-index: 1; pointer-events: none; overflow: hidden;
        }
        
        .scroll-column { display: flex; flex-direction: column; gap: 12px; width: 30%; will-change: transform; }
        @media (min-width: 768px) { .scroll-column { width: 18%; } }
        
        .scroll-column-up-fast { animation: scrollUp 45s linear infinite; }
        .scroll-column-up-slow { animation: scrollUp 60s linear infinite; }
        .scroll-column-up-medium { animation: scrollUp 50s linear infinite; }
        
        .poster-card {
          border-radius: 12px; overflow: hidden; aspect-ratio: 2 / 3;
          background: #1c1c1e; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5); flex-shrink: 0;
        }
        .poster-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
        
        .overlay-gradient {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(15, 15, 15, 0.5) 0%, rgba(15, 15, 15, 0.9) 50%, #0f0f0f 100%);
          z-index: 2; pointer-events: none;
        }
        
        .btn-container {
           position: relative; z-index: 10;
           animation: popIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }

        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.8) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }

        .btn-continue {
            background: linear-gradient(135deg, #E50914 0%, #b20710 100%);
            color: #fff; border: none; padding: 18px 40px;
            font-size: 18px; font-weight: 900; border-radius: 30px; cursor: pointer;
            box-shadow: 0 10px 30px rgba(229, 9, 20, 0.6); transition: 0.3s;
            display: flex; align-items: center; gap: 12px;
            text-transform: uppercase; letter-spacing: 1px;
            font-family: 'Inter', -apple-system, sans-serif;
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .btn-continue:hover { 
            transform: translateY(-3px) scale(1.02); 
            box-shadow: 0 15px 40px rgba(229, 9, 20, 0.8); 
        }
        
        .btn-continue:active {
            transform: translateY(1px) scale(0.98);
        }

        .icon { 
            font-size: 22px; 
            animation: pulseIcon 2s infinite;
        }

        @keyframes pulseIcon {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
      </style>
      
      <div class="wrap">
        <div class="overlay-bg-wrapper" id="continue-bg-wrapper"></div>
        <div class="overlay-gradient"></div>
        
        <div class="btn-container">
            <button class="btn-continue" id="continue-btn">
               <span class="icon">▶</span> Continue to Player
            </button>
        </div>
      </div>
    `;
    
    document.documentElement.appendChild(host);
    
    const bgWrapper = shadow.getElementById('continue-bg-wrapper');
    function createPosterHTML(url) { 
      return `<div class="poster-card"><img src="${url}" alt="Poster"></div>`; 
    }
    function buildColumn(arr) { 
      let html = ''; 
      for(let i=0; i<5; i++) { arr.forEach(url => html += createPosterHTML(url)); } 
      return html; 
    }

    if(bgWrapper) {
      for(let i=0; i<6; i++) {
        const col = document.createElement('div');
        const speeds = ['fast', 'slow', 'medium'];
        const arrays = [posters1, posters2, posters3];
        col.className = `scroll-column scroll-column-up-${speeds[i % 3]}`;
        col.innerHTML = buildColumn(arrays[i % 3]);
        bgWrapper.appendChild(col);
      }
    }
    
    shadow.getElementById('continue-btn').addEventListener('click', () => {
        host.remove(); // Remove continue button screen
        showWarning(); // Show the actual warning + music
    });
  }

  /* ============================================================
     3. OVERLAY UI (WARNING + MUSIC)
  ============================================================ */
  function createOverlayHost() {
    const host = document.createElement('div');
    host.id = OVERLAY_ID;
    host.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:auto!important;display:block!important;visibility:visible!important;opacity:1!important;';

    const shadow = host.attachShadow({ mode: 'open' });
    
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        
        @keyframes scrollUp {
          0% { transform: translateY(0); }
          100% { transform: translateY(calc(-50% - 6px)); }
        }
        
        .wrap { 
          position: fixed; inset: 0; background: #050505;
          display: flex; align-items: center; justify-content: center; 
          padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; 
          text-align: center; z-index: 2147483647; overflow: hidden;
        }
        
        .overlay-bg-wrapper {
          position: absolute; inset: 0; display: flex; justify-content: center; gap: 12px;
          opacity: 0.65; z-index: 1; pointer-events: none; overflow: hidden;
        }
        
        .scroll-column { 
          display: flex; flex-direction: column; gap: 12px; 
          width: 30%;
          will-change: transform; 
        }
        
        @media (min-width: 768px) { .scroll-column { width: 18%; } }

        .scroll-column-up-fast { animation: scrollUp 45s linear infinite; }
        .scroll-column-up-slow { animation: scrollUp 60s linear infinite; }
        .scroll-column-up-medium { animation: scrollUp 50s linear infinite; }

        .poster-card {
          border-radius: 12px; overflow: hidden; aspect-ratio: 2 / 3;
          background: #1c1c1e; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5); flex-shrink: 0;
        }
        .poster-card img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .overlay-gradient {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(15, 15, 15, 0.6) 0%, rgba(15, 15, 15, 0.9) 45%, #0f0f0f 100%);
          z-index: 2; pointer-events: none;
        }

        .box { 
          position: relative; z-index: 10; max-width: 480px; background: rgba(28, 28, 31, 0.85); 
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          padding: 40px 30px; border-radius: 16px; 
          box-shadow: 0 15px 35px rgba(0,0,0,0.6);
          border: 1px solid rgba(255,255,255,0.1);
          animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.9) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        
        h2 { margin: 0 0 16px; font-size: 24px; color: #fff; font-weight: 700; letter-spacing: 0.5px;}
        p { margin: 0 0 24px; line-height: 1.6; font-size: 16px; color: #b3b3b3; }
        
        button.main-btn { 
          background: #e50914; color: #fff; border: 0; border-radius: 8px; 
          padding: 14px 24px; cursor: pointer; font-size: 16px; font-weight: bold; 
          transition: 0.2s; width: 100%; max-width: 320px; 
          box-shadow: 0 4px 15px rgba(229, 9, 20, 0.4);
        }
        button.main-btn:hover { background: #f40612; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(229, 9, 20, 0.6); }
        button.main-btn:disabled { opacity: 0.6; cursor: wait; transform: none; box-shadow: none; }
        
        .top-controls {
          position: absolute; top: 12px; left: 16px; right: 16px;
          display: flex; justify-content: flex-end; align-items: center;
        }
        
        .ctrl-btn {
          background: transparent; border: 1px solid #444; color: #aaa; 
          padding: 5px 12px; border-radius: 6px; cursor: pointer; 
          font-size: 12px; font-weight: bold; transition: 0.2s;
        }
        .ctrl-btn:hover { background: #333; color: #fff; border-color: #666; }
        
        .hint { color: #777; font-size: 13px; margin-top: 24px; line-height: 1.5; }
        .hint b { color: #aaa; }
      </style>

      <div class="wrap">
        <div class="overlay-bg-wrapper" id="overlay-bg-wrapper"></div>
        <div class="overlay-gradient"></div>

        <div class="box">
          <div class="top-controls">
            <button class="ctrl-btn" id="lang-toggle">${translations[currentLang].toggleLabel}</button>
          </div>
          
          <h2 id="ad-title" style="margin-top: 10px;">${translations[currentLang].title}</h2>
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

    const shadowRoot = overlayHost.shadowRoot;
    const bgWrapper = shadowRoot.getElementById('overlay-bg-wrapper');

    function createPosterHTML(url) { 
      return `<div class="poster-card"><img src="${url}" alt="Poster"></div>`; 
    }
    function buildColumn(arr) { 
      let html = ''; 
      for(let i=0; i<5; i++) { arr.forEach(url => html += createPosterHTML(url)); } 
      return html; 
    }

    if(bgWrapper) {
      for(let i=0; i<6; i++) {
        const col = document.createElement('div');
        const speeds = ['fast', 'slow', 'medium'];
        const arrays = [posters1, posters2, posters3];
        col.className = `scroll-column scroll-column-up-${speeds[i % 3]}`;
        col.innerHTML = buildColumn(arrays[i % 3]);
        bgWrapper.appendChild(col);
      }
    }

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

    const retryBtn = shadowRoot.getElementById('adblock-retry');
    const langToggleBtn = shadowRoot.getElementById('lang-toggle');
    const titleEl = shadowRoot.getElementById('ad-title');
    const bodyEl = shadowRoot.getElementById('ad-body');
    const hintEl = shadowRoot.getElementById('ad-hint');

    /* --- 🚀 MUSIC PLAY LOGIC (Instant Play) 🚀 --- */
    if (bgAudio) {
        // Audio pehle se load ho chuka hai, ab bas play karna hai
        bgAudio.play().catch(e => {
            console.log("Play failed (browser policy?):", e);
            // Fallback if browser blocks it
            const playOnInteraction = () => {
                if (bgAudio.paused) bgAudio.play().catch(err => console.log(err));
                overlayHost.removeEventListener('click', playOnInteraction);
                document.removeEventListener('click', playOnInteraction);
            };
            overlayHost.addEventListener('click', playOnInteraction);
            document.addEventListener('click', playOnInteraction);
        });
    }

    langToggleBtn.addEventListener('click', () => {
      currentLang = currentLang === 'en' ? 'hi' : 'en';
      localStorage.setItem('adblock_lang', currentLang);

      titleEl.innerHTML = translations[currentLang].title;
      bodyEl.innerHTML = translations[currentLang].body;
      hintEl.innerHTML = `${translations[currentLang].hint1}<br>${translations[currentLang].hint2}`;
      langToggleBtn.textContent = translations[currentLang].toggleLabel;

      if (!retryBtn.disabled) {
        retryBtn.textContent = translations[currentLang].btnCheck;
      }
    });

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
          if(bgAudio) bgAudio.pause(); // Pause the audio
          overlayHost.remove();
          overlayHost = null;
        }
      }, 800);
    });
  }

  /* ============================================================
     4. INITIALIZATION
  ============================================================ */
  async function runCheck() {
    if (detectionRunning || !document.body) return;
    detectionRunning = true;
    try {
      const result = await detectAdBlock();
      if (result.blocked) {
        showContinueButton(); 
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
