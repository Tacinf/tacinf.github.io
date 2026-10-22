/* TACINF — module switching, videos, lightbox, citation copy. */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const panels = new Map(
    tabs.map((tab) => [tab.dataset.tab, document.getElementById(tab.getAttribute("aria-controls"))])
  );
  const deck = document.getElementById("deck");
  const switcher = document.querySelector(".switcher");
  const tabIndicator = document.querySelector(".tab-indicator");
  const readout = document.getElementById("tab-readout");
  const toast = document.getElementById("toast");
  const masthead = document.getElementById("masthead");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxCap = document.getElementById("lightbox-cap");

  const ACCENTS = {
    tacumi: "var(--green)",
    tabero: "var(--yellow)",
    vtla: "var(--blue)",
    taco: "var(--white)",
  };
  let activeKey = "tacumi";
  let switching = false;

  /* ---------------- header ---------------- */
  const onScroll = () => {
    masthead.classList.toggle("is-scrolled", window.scrollY > 12);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------------- tabs ---------------- */
  function moveTabIndicator(tab, animate = true) {
    if (!tabIndicator || !tab) return;
    if (!animate) tabIndicator.style.transition = "none";
    tabIndicator.style.width = `${tab.offsetWidth}px`;
    tabIndicator.style.height = `${tab.offsetHeight}px`;
    tabIndicator.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`;
    if (!animate) {
      void tabIndicator.offsetWidth;
      tabIndicator.style.transition = "";
    }
  }

  function setTabState(key) {
    tabs.forEach((tab) => {
      const selected = tab.dataset.tab === key;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    const activeTab = tabs.find((tab) => tab.dataset.tab === key);
    if (activeTab && readout) {
      readout.textContent = activeTab.dataset.readout || "";
      if (!reduceMotion.matches) {
        readout.animate(
          [
            { opacity: 0.2, transform: "translateY(3px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
        );
      }
    }
    window.requestAnimationFrame(() => moveTabIndicator(activeTab));
  }

  function repositionIndicator() {
    const activeTab = tabs.find((tab) => tab.dataset.tab === activeKey);
    window.requestAnimationFrame(() => moveTabIndicator(activeTab, false));
  }
  window.addEventListener("resize", repositionIndicator);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(repositionIndicator);
  }
  window.addEventListener("load", repositionIndicator);

  function syncVideos() {
    document.querySelectorAll("video[data-auto]").forEach((video) => {
      const panel = video.closest(".panel");
      const visible = !panel || !panel.hidden;
      const rect = video.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < window.innerHeight;
      if (visible && inView && !reduceMotion.matches) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }

  function setDeckAccent(key) {
    const accent = ACCENTS[key] || "var(--green)";
    if (deck) deck.style.setProperty("--deck-accent", accent);
    if (switcher) switcher.style.setProperty("--tab-accent", accent);
  }

  function swapPanel(key) {
    if (deck) {
      deck.style.height = "";
      deck.classList.remove("is-switching");
    }
    setDeckAccent(key);
    panels.forEach((panel, panelKey) => {
      const isNext = panelKey === key;
      panel.hidden = !isNext;
      panel.classList.toggle("is-active", isNext);
      panel.classList.remove("is-entering", "is-leaving");
      if (isNext) {
        void panel.offsetWidth;
        panel.classList.add("is-entering");
        window.setTimeout(() => panel.classList.remove("is-entering"), 700);
      }
    });
    setTabState(key);
    activeKey = key;
    syncVideos();
  }

  function immersiveSwap(key) {
    return new Promise((resolve) => {
      const oldPanel = panels.get(activeKey);
      const newPanel = panels.get(key);
      switching = true;
      setTabState(key);
      setDeckAccent(key);

      let oldHeight = 0;
      if (deck) {
        oldHeight = deck.offsetHeight;
        deck.style.transition = "none";
        deck.style.height = `${oldHeight}px`;
        void deck.offsetHeight;
        deck.classList.add("is-switching");
      }

      oldPanel.classList.add("is-leaving");

      window.setTimeout(() => {
        oldPanel.hidden = true;
        oldPanel.classList.remove("is-active", "is-leaving");
        newPanel.hidden = false;
        newPanel.classList.add("is-active");
        activeKey = key;

        if (deck) {
          deck.style.height = "auto";
          const newHeight = deck.offsetHeight;
          deck.style.height = `${oldHeight}px`;
          void deck.offsetHeight;
          deck.style.transition = "";
          window.requestAnimationFrame(() => {
            deck.style.height = `${newHeight}px`;
          });
        }

        newPanel.classList.add("is-entering");
        syncVideos();

        window.setTimeout(() => {
          if (deck) {
            deck.style.height = "";
            deck.classList.remove("is-switching");
          }
          newPanel.classList.remove("is-entering");
          switching = false;
          resolve();
        }, 620);
      }, 260);
    });
  }

  function activate(key, options = {}) {
    const { animate = true, updateHash = true } = options;
    if (!panels.has(key)) return Promise.resolve();
    if (key === activeKey && !panels.get(key).hidden) return Promise.resolve();
    if (switching) return Promise.resolve();

    if (updateHash && window.location.hash !== `#${key}`) {
      history.replaceState(null, "", `#${key}`);
    }

    if (!animate || reduceMotion.matches) {
      swapPanel(key);
      return Promise.resolve();
    }
    return immersiveSwap(key);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activate(tab.dataset.tab));
    tab.addEventListener("keydown", (event) => {
      const index = tabs.indexOf(tab);
      let next = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next === null) return;
      event.preventDefault();
      tabs[next].focus();
      activate(tabs[next].dataset.tab);
    });
  });

  document.querySelectorAll("[data-jump-tab]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const key = link.dataset.jumpTab;
      if (!panels.has(key)) return;
      event.preventDefault();
      const target = link.getAttribute("href");
      const scrollToTarget = () => {
        const el = target && document.querySelector(target);
        if (el) el.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
      };
      if (switching) return;
      if (key !== activeKey) {
        activate(key).then(scrollToTarget);
      } else {
        scrollToTarget();
      }
    });
  });

  function activateFromHash() {
    let hash = window.location.hash.replace("#", "");
    if (hash.startsWith("panel-")) hash = hash.slice(6);
    if (hash === "tacinf-vtla") hash = "vtla";
    const key = panels.has(hash) ? hash : null;
    if (key) activate(key, { animate: false, updateHash: false });
  }
  window.addEventListener("hashchange", activateFromHash);
  activateFromHash();

  // With JS available, only one panel is live. Without JS the CSS keeps all
  // four panels visible (see the .js rule in the stylesheet).
  panels.forEach((panel, key) => {
    panel.hidden = key !== activeKey;
    panel.classList.toggle("is-active", key === activeKey);
  });
  setDeckAccent(activeKey);
  setTabState(activeKey);

  /* ---------------- videos ---------------- */
  const videoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        const panel = video.closest(".panel");
        if (entry.isIntersecting && (!panel || !panel.hidden) && !reduceMotion.matches) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
    { threshold: 0.25 }
  );

  document.querySelectorAll("video[data-auto]").forEach((video) => {
    videoObserver.observe(video);
    const card = video.closest(".video-card");
    const toggle = card && card.querySelector(".video-toggle");

    const paint = () => {
      if (!card || !toggle) return;
      const playing = !video.paused && !video.ended;
      card.classList.toggle("is-playing", playing);
      toggle.textContent = playing ? "❚❚" : "▶";
      toggle.setAttribute("aria-label", playing ? "Pause video" : "Play video");
    };

    video.addEventListener("play", paint);
    video.addEventListener("pause", paint);
    paint();

    if (toggle) {
      toggle.addEventListener("click", () => {
        if (video.paused || video.ended) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }
  });

  /* ---------------- lightbox ---------------- */
  let zoomList = [];
  let zoomIndex = 0;

  function renderZoom() {
    const button = zoomList[zoomIndex];
    if (!button) return;
    const img = button.querySelector("img");
    lightboxImg.src = button.dataset.full || (img && img.src) || "";
    lightboxImg.alt = (img && img.alt) || "";
    lightboxCap.textContent = button.dataset.caption || "";
  }

  function openLightbox(button) {
    const scope = button.closest(".panel") || button.closest("section") || document;
    zoomList = Array.from(scope.querySelectorAll(".zoom"));
    zoomIndex = Math.max(0, zoomList.indexOf(button));
    renderZoom();
    lightbox.showModal();
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.close();
    document.body.style.overflow = "";
  }

  document.querySelectorAll(".zoom").forEach((button) => {
    button.addEventListener("click", () => openLightbox(button));
  });

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  lightbox.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
  lightbox.querySelector(".lightbox-prev").addEventListener("click", () => {
    if (!zoomList.length) return;
    zoomIndex = (zoomIndex - 1 + zoomList.length) % zoomList.length;
    renderZoom();
  });
  lightbox.querySelector(".lightbox-next").addEventListener("click", () => {
    if (!zoomList.length) return;
    zoomIndex = (zoomIndex + 1) % zoomList.length;
    renderZoom();
  });
  lightbox.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      lightbox.querySelector(".lightbox-prev").click();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      lightbox.querySelector(".lightbox-next").click();
    }
  });
  lightbox.addEventListener("close", () => {
    document.body.style.overflow = "";
  });

  /* ---------------- bibtex copy ---------------- */
  const bibNode = document.getElementById("bibtex-code");
  const bibText = bibNode ? bibNode.textContent.trim() : "";
  let toastTimer = 0;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-show"), 1800);
  }

  function fallbackCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  async function copyBib() {
    if (!bibText) return;
    let ok = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(bibText);
        ok = true;
      } catch (error) {
        ok = fallbackCopy(bibText);
      }
    } else {
      ok = fallbackCopy(bibText);
    }
    showToast(ok ? "BibTeX copied" : "Copy failed — select the BibTeX manually");
  }

  document.querySelectorAll("[data-copy-bib]").forEach((button) => {
    const label = button.querySelector(".util-label") || button;
    const original = label.textContent;
    button.addEventListener("click", async () => {
      await copyBib();
      label.textContent = "Copied ✓";
      window.setTimeout(() => {
        label.textContent = original;
      }, 1600);
    });
  });

  /* ---------------- reveal on scroll ---------------- */
  const revealNodes = document.querySelectorAll(".reveal");
  // Added only after the observer is about to be installed, so a script error
  // can never leave the abstract/citation invisible.
  document.documentElement.classList.add("js-ready");
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealNodes.forEach((el) => revealObserver.observe(el));
  } else {
    revealNodes.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------------- misc ---------------- */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      document.querySelectorAll("video[data-auto]").forEach((video) => video.pause());
    } else {
      syncVideos();
    }
  });

  reduceMotion.addEventListener("change", syncVideos);

  // The initial panel should not keep the entering animation class.
  const initialPanel = panels.get("tacumi");
  if (initialPanel) initialPanel.classList.remove("is-entering");
})();
