(() => {
  const CHECK_DELAY = 150;
  let checking = false;

  function detectAdBlocker() {
    return new Promise(resolve => {
      const bait = document.createElement("div");

      bait.className = "adsbox ad-banner ad-unit";
      bait.setAttribute("aria-hidden", "true");

      bait.style.cssText =
        "position:absolute!important;left:-10000px!important;" +
        "top:-10000px!important;width:10px!important;" +
        "height:10px!important;pointer-events:none!important;";

      document.body.appendChild(bait);

      setTimeout(() => {
        const blocked =
          bait.offsetWidth === 0 ||
          bait.offsetHeight === 0 ||
          getComputedStyle(bait).display === "none" ||
          getComputedStyle(bait).visibility === "hidden";

        bait.remove();
        resolve(blocked);
      }, CHECK_DELAY);
    });
  }

  function showWarning() {
    if (document.getElementById("adblock-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "adblock-overlay";

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      background: "#080808",
      color: "#fff",
      display: "grid",
      placeItems: "center",
      padding: "24px",
      fontFamily: "Arial, sans-serif",
      textAlign: "center"
    });

    overlay.innerHTML = `
      <div style="max-width:420px">
        <h2>Advertising Required</h2>
        <p>
          Ads help support this website.
          Please allow ads for this site, then retry.
        </p>
        <button id="adblock-retry"
          style="background:#e50914;color:white;border:0;
          border-radius:8px;padding:12px 22px;cursor:pointer">
          Check Again
        </button>
        <p style="color:#aaa;font-size:13px">
          If you don't use an ad blocker, check your
          connection and try again.
        </p>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector("#adblock-retry")
      .addEventListener("click", async () => {
        const button = overlay.querySelector("#adblock-retry");

        button.disabled = true;
        button.textContent = "Checking...";

        const blocked = await detectAdBlocker();

        if (blocked) {
          button.disabled = false;
          button.textContent = "Check Again";
        } else {
          overlay.remove();
        }
      });
  }

  async function runCheck() {
    if (checking || !document.body) return;

    checking = true;

    try {
      if (await detectAdBlocker()) {
        showWarning();
      }
    } finally {
      checking = false;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runCheck, {
      once: true
    });
  } else {
    runCheck();
  }
})();
