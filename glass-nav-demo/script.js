// Navigation and theme controls for the standalone glass-nav demo.
(() => {
  const nav = document.querySelector(".glass-nav");
  const themeToggle = document.querySelector(".theme-toggle");
  const links = [...(nav?.querySelectorAll(".nav-link") ?? [])];
  const activeLens = nav?.querySelector(".active-lens");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!nav || !activeLens || links.length === 0) return;

  // Resolve the current item from the URL, falling back to Home.
  const linkForHash = (hash) => links.find((link) => link.hash === hash);
  const currentLink = linkForHash(window.location.hash) ?? links[0];

  // Keep the active lens exactly under its link and update semantic current-page state.
  const setActive = (link) => {
    if (!link) return;
    links.forEach((item) => {
      if (item === link) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });

    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    activeLens.style.width = `${linkRect.width}px`;
    activeLens.style.transform = `translateX(${linkRect.left - navRect.left}px)`;
  };

  // Initialize the active item after layout and fonts settle.
  setActive(currentLink);
  window.addEventListener("load", () => setActive(linkForHash(window.location.hash) ?? currentLink), { once: true });
  window.addEventListener("resize", () => setActive(linkForHash(window.location.hash) ?? currentLink), { passive: true });

  // Follow navigation clicks and browser back/forward hash changes.
  links.forEach((link) => {
    link.addEventListener("click", () => setActive(link));
  });
  window.addEventListener("hashchange", () => {
    const link = linkForHash(window.location.hash);
    if (link) setActive(link);
  });

  // Support familiar left/right, Home, and End keyboard movement inside the nav.
  nav.addEventListener("keydown", (event) => {
    const currentIndex = links.indexOf(document.activeElement);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % links.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + links.length) % links.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = links.length - 1;
    else return;

    event.preventDefault();
    links[nextIndex].focus();
    links[nextIndex].click();
  });

  // Toggle an explicit light/dark override while leaving system preference as the default.
  const updateThemeButton = () => {
    const root = document.documentElement;
    const light = root.dataset.theme
      ? root.dataset.theme === "light"
      : getComputedStyle(root).colorScheme === "light";
    themeToggle?.setAttribute("aria-pressed", String(light));
    themeToggle?.setAttribute("aria-label", `Switch to ${light ? "dark" : "light"} theme`);
  };

  updateThemeButton();
  themeToggle?.addEventListener("click", () => {
    const isLight = getComputedStyle(document.documentElement).colorScheme === "light";
    document.documentElement.dataset.theme = isLight ? "dark" : "light";
    updateThemeButton();
  });

  // Reduced motion still updates the active state immediately without a sliding transition.
  const updateMotionPreference = () => {
    activeLens.style.transition = reducedMotion.matches ? "none" : "";
  };
  updateMotionPreference();
  reducedMotion.addEventListener?.("change", updateMotionPreference);
})();
