/* Tacinf project page — small, dependency-free enhancements. */
(function () {
  "use strict";

  /* ---------------------------- top bar shadow ---------------------------- */
  var topbar = document.getElementById("topbar");
  function onScroll() {
    if (topbar) topbar.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------------------------- active nav link ---------------------------- */
  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll('.nav a[href^="#"]')
  );
  var sections = navLinks
    .map(function (a) {
      var id = a.getAttribute("href");
      return id && id.length > 1 ? document.querySelector(id) : null;
    })
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    var visible = new Set();
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        });
        // Keep the last section highlighted while scrolling through it.
        var current = null;
        sections.forEach(function (section) {
          if (visible.has(section.id)) current = section.id;
        });
        if (!current) return;
        navLinks.forEach(function (a) {
          a.classList.toggle("is-active", a.getAttribute("href") === "#" + current);
        });
      },
      { rootMargin: "-40% 0px -52% 0px", threshold: 0 }
    );
    sections.forEach(function (section) { observer.observe(section); });
  }

  /* ---------------------------- toast ---------------------------- */
  var toast = document.getElementById("toast");
  var toastTimer = null;
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("show");
    }, 1800);
  }

  /* ---------------------------- BibTeX copy ---------------------------- */
  var bib = document.getElementById("bibtex-code");

  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
    document.body.removeChild(area);
    return ok;
  }

  function copyBib() {
    if (!bib) return;
    var text = bib.innerText;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        function () { showToast("BibTeX copied"); },
        function () {
          showToast(fallbackCopy(text) ? "BibTeX copied" : "Copy failed");
        }
      );
    } else {
      showToast(fallbackCopy(text) ? "BibTeX copied" : "Copy failed");
    }
  }

  Array.prototype.forEach.call(
    document.querySelectorAll("[data-copy-bib]"),
    function (button) {
      button.addEventListener("click", copyBib);
    }
  );

  /* ---------------------------- figure lightbox ---------------------------- */
  var dialog = document.getElementById("lightbox");
  var dialogImg = document.getElementById("lightbox-img");
  var dialogCaption = document.getElementById("lightbox-caption");
  var closeButton = dialog ? dialog.querySelector(".lightbox-close") : null;
  var prevButton = dialog ? dialog.querySelector(".lightbox-prev") : null;
  var nextButton = dialog ? dialog.querySelector(".lightbox-next") : null;
  var zoomButtons = Array.prototype.slice.call(document.querySelectorAll(".zoom"));
  var currentIndex = 0;

  if (!dialog || !dialogImg || typeof dialog.showModal !== "function") return;

  function render(index) {
    if (!zoomButtons.length) return;
    currentIndex = (index + zoomButtons.length) % zoomButtons.length;
    var button = zoomButtons[currentIndex];
    var source = button.querySelector("img");
    dialogImg.src = button.getAttribute("data-full") || (source && source.src) || "";
    dialogImg.alt = (source && source.alt) || "Figure";
    dialogCaption.textContent = button.getAttribute("data-caption") || "";
  }

  function openAt(index) {
    render(index);
    if (!dialog.open) dialog.showModal();
    document.documentElement.style.overflow = "hidden";
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  zoomButtons.forEach(function (button, index) {
    button.addEventListener("click", function () { openAt(index); });
  });

  if (closeButton) closeButton.addEventListener("click", closeDialog);
  if (prevButton) prevButton.addEventListener("click", function () { render(currentIndex - 1); });
  if (nextButton) nextButton.addEventListener("click", function () { render(currentIndex + 1); });

  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) closeDialog();
  });

  dialog.addEventListener("close", function () {
    document.documentElement.style.overflow = "";
    dialogImg.removeAttribute("src");
  });

  dialog.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      render(currentIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      render(currentIndex + 1);
    }
  });
})();
