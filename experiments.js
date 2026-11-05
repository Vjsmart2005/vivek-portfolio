const CONFIG = {
  lerp: 0.08,
  skewAmount: 0.85,
  maxSkew: 4,
  parallaxStrength: 10,
  revealStart: "top 85%",
  layoutDuration: 0.7,
};

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const gallery = document.querySelector(".gallery");
const items = Array.from(document.querySelectorAll("[data-gallery-item]"));
const layoutButtons = document.querySelectorAll("[data-layout]");
const progressLine = document.querySelector(".scroll-meter-line i");
const progressValue = document.querySelector(".scroll-meter-value");
const year = document.querySelector("#year");

if (year) year.textContent = new Date().getFullYear();

const updateViewportUI = () => {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
  if (progressLine) progressLine.style.transform = `scaleY(${progress})`;
  if (progressValue) progressValue.textContent = String(Math.round(progress * 100)).padStart(2, "0");

  const centerY = window.innerHeight / 2;
  let closestItem;
  let closestDistance = Infinity;
  items.forEach((item) => {
    const bounds = item.getBoundingClientRect();
    const distance = Math.abs((bounds.top + bounds.bottom) / 2 - centerY);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestItem = item;
    }
  });
  items.forEach((item) => item.classList.toggle("is-active", item === closestItem));
};

let viewportFrame = 0;
const scheduleViewportUI = () => {
  if (viewportFrame) return;
  viewportFrame = window.requestAnimationFrame(() => {
    viewportFrame = 0;
    updateViewportUI();
  });
};

window.addEventListener("scroll", scheduleViewportUI, { passive: true });
window.addEventListener("resize", scheduleViewportUI);

let gsap = window.gsap;
let ScrollTrigger = window.ScrollTrigger;
let Flip = gsap?.plugins?.Flip || window.Flip;
let lenis;
let skewControls = [];

if (gsap && ScrollTrigger && !reducedMotion.matches) {
  gsap.registerPlugin(ScrollTrigger);
  if (Flip) gsap.registerPlugin(Flip);

  items.forEach((item) => {
    item.querySelectorAll(".item-title > span").forEach((line) => {
      const lineContent = document.createElement("span");
      lineContent.className = "item-title-line";
      lineContent.textContent = line.textContent;
      line.replaceChildren(lineContent);
    });

    const titleLines = item.querySelectorAll(".item-title-line");
    gsap.to(titleLines, {
      yPercent: 0,
      duration: 0.8,
      ease: "power3.out",
      stagger: 0.09,
      scrollTrigger: {
        trigger: item,
        start: CONFIG.revealStart,
        once: true,
      },
    });

    const artwork = item.querySelector(".gallery-artwork");
    if (artwork) {
      gsap.fromTo(artwork, { yPercent: -CONFIG.parallaxStrength }, {
        yPercent: CONFIG.parallaxStrength,
        ease: "none",
        scrollTrigger: {
          trigger: item,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    }

    const visual = item.querySelector(".gallery-visual");
    if (visual) skewControls.push({
      current: 0,
      setSkew: gsap.quickTo(visual, "skewY", {
        duration: 0.35,
        ease: "power3.out",
      }),
    });
  });
  document.documentElement.classList.add("motion-ready");

  if (typeof window.Lenis === "function") {
    lenis = new window.Lenis({
      lerp: CONFIG.lerp,
      smoothWheel: true,
      syncTouch: false,
    });
    document.body.classList.add("is-lenis");
    lenis.on("scroll", () => {
      ScrollTrigger.update();
      scheduleViewportUI();
    });
    gsap.ticker.add((time) => {
      if (document.hidden) return;
      lenis.raf(time * 1000);
      const velocity = lenis.velocity || 0;
      const skew = Math.max(-CONFIG.maxSkew, Math.min(CONFIG.maxSkew, velocity * CONFIG.skewAmount));
      skewControls.forEach((control) => {
        if (Math.abs(skew - control.current) < 0.02) return;
        control.current = skew;
        control.setSkew(skew);
      });
    });
    gsap.ticker.lagSmoothing(0);
  }
}

document.addEventListener("visibilitychange", () => {
  if (!lenis) return;
  if (document.hidden) lenis.stop();
  else {
    lenis.start();
    scheduleViewportUI();
  }
});

layoutButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!gallery) return;
    const nextLayout = button.dataset.layout;
    if (gallery.classList.contains(`gallery--${nextLayout}`)) return;

    const canAnimate = !reducedMotion.matches && gsap && Flip;
    const state = canAnimate ? Flip.getState(items) : null;
    gallery.classList.toggle("gallery--list", nextLayout === "list");
    gallery.classList.toggle("gallery--grid", nextLayout === "grid");
    layoutButtons.forEach((choice) => {
      choice.setAttribute("aria-pressed", String(choice === button));
    });

    const refresh = () => {
      if (ScrollTrigger) ScrollTrigger.refresh();
      if (lenis) lenis.resize();
      scheduleViewportUI();
    };

    if (state) {
      Flip.from(state, {
        duration: CONFIG.layoutDuration,
        ease: "power2.inOut",
        absolute: true,
        nested: true,
        onComplete: refresh,
      });
    } else {
      refresh();
    }
  });
});

updateViewportUI();
if (ScrollTrigger) ScrollTrigger.refresh();
