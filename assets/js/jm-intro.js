(() => {
  "use strict";

  const JM_INTRO = Object.freeze({
    ENABLED: true,
    PLAY_ONCE_PER_SESSION: true,
    SKIP_IF_HASH: true,
    SKIP_BUTTON_AFTER: 0.6,
    TIMELINE: Object.freeze({
      FADE_IN: 0.4,
      MATERIALIZE: 3,
      HOLD: 1,
      SCAN: 1.5,
      LOGO: 1.2,
      OPEN: 1,
    }),
    COLOR: [0.22, 0.84, 0.7],
    BRAND_GREEN: "#738B4D",
    LOGO_SRC: "assets/logo-redondo_claro.png",
    LOGO_VISIBLE_RATIO: 0.6094,
    WATCHDOG_SECONDS: 20,
  });

  function shouldPlay() {
    if (!JM_INTRO.ENABLED) return false;
    const query = new URLSearchParams(window.location.search);
    if (query.get("intro") === "1") return true;
    if (query.get("intro") === "0") return false;
    if (JM_INTRO.SKIP_IF_HASH && window.location.hash) return false;
    if (!JM_INTRO.PLAY_ONCE_PER_SESSION) return true;

    try {
      return window.sessionStorage.getItem("jm-intro-seen") !== "1";
    } catch (error) {
      console.error("Não foi possível consultar o estado da abertura.", error);
      return true;
    }
  }

  function start(options) {
    const root = document.documentElement;
    const overlay = document.getElementById("jm-intro");
    if (
      !JM_INTRO.ENABLED ||
      !root.classList.contains("jm-intro-on") ||
      !overlay ||
      !shouldPlay()
    ) {
      return;
    }

    const canvas = document.getElementById("jm-intro-canvas");
    const skipButton = document.getElementById("jm-skip");
    const scan = document.getElementById("jm-scan");
    const hud = document.getElementById("jm-hud");
    const logoWrap = document.getElementById("jm-logo-wrap");
    const logo = document.getElementById("jm-logo");
    const liveRegion = overlay.querySelector("[aria-live]");
    const atlas = options && options.atlas;
    if (
      !canvas ||
      !skipButton ||
      !scan ||
      !hud ||
      !logoWrap ||
      !logo
    ) {
      console.error("Não foi possível iniciar a abertura da Jovem Matilha.");
      root.classList.remove("jm-intro-on");
      overlay.remove();
      return;
    }

    const timeline = JM_INTRO.TIMELINE;
    const scanStart = timeline.FADE_IN + timeline.MATERIALIZE + timeline.HOLD;
    const logoStart = scanStart + timeline.SCAN;
    const openStart = logoStart + timeline.LOGO;
    const inertElements = Array.from(document.body.children)
      .filter((element) => element !== overlay && element.tagName !== "SCRIPT")
      .map((element) => ({
        element,
        wasInert: element.hasAttribute("inert"),
      }));
    const previousScrollRestoration = history.scrollRestoration;
    const pointer = { x: -2000, y: -2000 };
    const prefersReducedMotion = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
    logoWrap.style.setProperty(
      "--jm-logo-visible-ratio",
      String(JM_INTRO.LOGO_VISIBLE_RATIO),
    );
    logo.src = JM_INTRO.LOGO_SRC;

    let engine = null;
    let active = true;
    let opened = false;
    let simpleLogoStarted = false;
    let elapsed = 0;
    let previousFrameTime = 0;
    let frameId = 0;
    let openTimer = 0;
    let fallbackTimer = 0;
    let watchdogTimer = 0;
    let hologramReleased = false;
    let scanStarted = false;
    let logoStarted = false;
    let lastWidth = 0;
    let lastHeight = 0;

    function resize() {
      if (!engine) return;
      lastWidth = window.innerWidth;
      lastHeight = window.innerHeight;
      engine.resize(
        lastWidth,
        lastHeight,
        Math.min(window.devicePixelRatio || 1, 2),
      );
    }

    const brandRgb = [
      parseInt(JM_INTRO.BRAND_GREEN.slice(1, 3), 16),
      parseInt(JM_INTRO.BRAND_GREEN.slice(3, 5), 16),
      parseInt(JM_INTRO.BRAND_GREEN.slice(5, 7), 16),
    ];
    const hologramRgb = JM_INTRO.COLOR.map((channel) =>
      Math.round(channel * 255),
    );

    function setScanColor(progress) {
      const rgb = hologramRgb.map((channel, index) =>
        Math.round(channel + (brandRgb[index] - channel) * progress),
      );
      scan.style.setProperty("--jm-scan-rgb", rgb.join(", "));
    }

    function releaseHologram() {
      if (!engine || hologramReleased) return;
      hologramReleased = true;
      canvas.removeEventListener("webglcontextlost", onContextLost);
      engine.destroy();
    }

    function startScan() {
      if (scanStarted) return;
      scanStarted = true;
      overlay.classList.add("jm-intro-scanning");
      if (liveRegion) {
        liveRegion.textContent = "Escaneamento da marca em andamento.";
      }
    }

    function revealLogo() {
      if (logoStarted) return;
      logoStarted = true;
      overlay.classList.remove("jm-intro-scanning");
      overlay.classList.add("jm-intro-logo-visible");
      canvas.style.visibility = "hidden";
      releaseHologram();
      if (liveRegion) liveRegion.textContent = "Logo Jovem Matilha.";
    }

    function easeInOutCubic(progress) {
      return progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    }

    function updateScan(progress) {
      const bandHeight = Math.min(240, Math.max(120, lastHeight * 0.22));
      const frontY =
        easeInOutCubic(progress) * (lastHeight + bandHeight * 2) - bandHeight;
      scan.style.setProperty("--jm-scan-top", `${frontY - bandHeight}px`);
      canvas.style.clipPath = `inset(${Math.max(
        0,
        Math.min(lastHeight, frontY),
      )}px 0 0 0)`;

      const logoRect = logo.getBoundingClientRect();
      const revealHeight = Math.max(
        0,
        Math.min(logoRect.height, frontY - logoRect.top),
      );
      logo.style.clipPath = `inset(0 0 ${logoRect.height - revealHeight}px 0)`;
      setScanColor(progress);
    }

    function showLogoOnly() {
      if (!active || simpleLogoStarted) return;
      simpleLogoStarted = true;
      cancelAnimationFrame(frameId);
      releaseHologram();
      canvas.style.visibility = "hidden";
      logo.style.clipPath = "none";
      overlay.classList.remove("jm-intro-scanning", "jm-intro-logo-visible");
      overlay.classList.add("jm-intro-simple-logo");
      if (liveRegion) liveRegion.textContent = "Logo Jovem Matilha.";
      fallbackTimer = window.setTimeout(() => openDoors(0.6), 1000);
    }

    function showLogoOnlyWhenReady() {
      logo
        .decode()
        .then(showLogoOnly)
        .catch((error) => {
          console.info("Logo da abertura indisponível; seguindo sem a marca.", error);
          cancelAnimationFrame(frameId);
          canvas.style.visibility = "hidden";
          releaseHologram();
          openDoors(0.6);
        });
    }

    function updatePointer(event) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }

    function resetPointer() {
      pointer.x = -2000;
      pointer.y = -2000;
    }

    function restorePage() {
      inertElements.forEach(({ element, wasInert }) => {
        if (!wasInert) element.removeAttribute("inert");
      });
      history.scrollRestoration = previousScrollRestoration;
      root.classList.remove("jm-intro-on");
    }

    function finish() {
      if (!active) return;
      active = false;
      cancelAnimationFrame(frameId);
      window.clearTimeout(openTimer);
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(watchdogTimer);
      window.removeEventListener("resize", resize);
      overlay.removeEventListener("pointermove", updatePointer);
      overlay.removeEventListener("pointerdown", updatePointer);
      overlay.removeEventListener("pointerleave", resetPointer);
      overlay.removeEventListener("pointercancel", resetPointer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pageshow", onPageShow);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      skipButton.removeEventListener("click", skipOpening);
      releaseHologram();
      restorePage();
      overlay.remove();

      try {
        window.sessionStorage.setItem("jm-intro-seen", "1");
      } catch (error) {
        console.error("Não foi possível salvar o estado da abertura.", error);
      }

      const pageStart = document.querySelector("main") || document.body;
      if (!pageStart.hasAttribute("tabindex")) {
        pageStart.setAttribute("tabindex", "-1");
      }
      pageStart.focus({ preventScroll: true });
    }

    function openDoors(duration) {
      if (opened || !active) return;
      opened = true;
      if (liveRegion) liveRegion.textContent = "Abertura concluída.";
      overlay.style.setProperty(
        "--jm-open-duration",
        `${duration === undefined ? timeline.OPEN : duration}s`,
      );
      overlay.classList.add("jm-intro-opening");
      openTimer = window.setTimeout(
        finish,
        (duration === undefined ? timeline.OPEN : duration) * 1000,
      );
    }

    function skipOpening() {
      openDoors(0.6);
    }

    function onKeyDown(event) {
      if (event.key === "Escape" && active) {
        event.preventDefault();
        openDoors(0.6);
      }
    }

    function onContextLost(event) {
      event.preventDefault();
      console.info("Contexto WebGL indisponível; usando abertura com logo estático.");
      showLogoOnlyWhenReady();
    }

    function onPageShow(event) {
      if (event.persisted) finish();
    }

    function frame(timestamp) {
      if (!active || opened) return;
      frameId = requestAnimationFrame(frame);
      if (previousFrameTime === 0) {
        previousFrameTime = timestamp;
        return;
      }

      const dt = Math.min((timestamp - previousFrameTime) / 1000, 0.05);
      previousFrameTime = timestamp;
      elapsed += dt;
      const materializeDt = Math.max(
        0,
        Math.min(dt, elapsed - timeline.FADE_IN),
      );
      if (engine && !hologramReleased) {
        engine.update(materializeDt, pointer.x > -1000 ? pointer : null);
        engine.render();
      }

      if (elapsed >= JM_INTRO.SKIP_BUTTON_AFTER) {
        skipButton.disabled = false;
        overlay.classList.add("jm-intro-skip-visible");
      }
      if (elapsed < timeline.FADE_IN + timeline.MATERIALIZE) {
        const progress = Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((elapsed - timeline.FADE_IN) / timeline.MATERIALIZE) * 100,
            ),
          ),
        );
        hud.textContent = `INICIALIZANDO HOLOGRAMA ${String(progress).padStart(3, "0")}%`;
      } else if (elapsed < scanStart) {
        hud.textContent = "SCAN COMPLETO";
      }

      if (elapsed >= scanStart && elapsed < logoStart) {
        startScan();
        updateScan(Math.min(1, (elapsed - scanStart) / timeline.SCAN));
      } else if (elapsed >= logoStart && !logoStarted) {
        updateScan(1);
        revealLogo();
      }

      if (elapsed >= openStart) {
        openDoors();
      }
    }

    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    inertElements.forEach(({ element }) => element.setAttribute("inert", ""));
    overlay.tabIndex = -1;
    overlay.focus({ preventScroll: true });
    skipButton.disabled = true;
    skipButton.addEventListener("click", skipOpening);
    window.addEventListener("resize", resize);
    overlay.addEventListener("pointermove", updatePointer);
    overlay.addEventListener("pointerdown", updatePointer);
    overlay.addEventListener("pointerleave", resetPointer);
    overlay.addEventListener("pointercancel", resetPointer);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pageshow", onPageShow);
    canvas.addEventListener("webglcontextlost", onContextLost);
    watchdogTimer = window.setTimeout(() => {
      if (!active) return;
      console.error("A abertura excedeu o tempo máximo e será encerrada.");
      openDoors(0.6);
    }, JM_INTRO.WATCHDOG_SECONDS * 1000);

    if (prefersReducedMotion) {
      showLogoOnlyWhenReady();
      return;
    }
    if (!atlas || !window.JMHologram) {
      console.info("Atlas ou motor WebGL indisponível; usando abertura com logo estático.");
      showLogoOnlyWhenReady();
      return;
    }

    try {
      engine = window.JMHologram.create(canvas, {
        atlas,
        color: JM_INTRO.COLOR,
        intro: true,
        introSeconds: timeline.MATERIALIZE,
        dogH: (width, height) => Math.min(height * 0.52, width * 0.95),
        cy: (width, height) => height * 0.46,
      });
    } catch (error) {
      console.info("WebGL indisponível; usando abertura com logo estático.", error);
      showLogoOnlyWhenReady();
      return;
    }

    Promise.all([engine.ready, logo.decode()])
      .then(() => {
        if (!active || simpleLogoStarted) return;
        resize();
        frameId = requestAnimationFrame(frame);
      })
      .catch((error) => {
        console.info("Elementos holográficos indisponíveis; usando abertura com logo estático.", error);
        showLogoOnlyWhenReady();
      });
  }

  window.JMIntro = { shouldPlay, start };
})();
