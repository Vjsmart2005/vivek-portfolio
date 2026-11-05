(() => {
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
const videos = Array.from(document.querySelectorAll("[data-preview-video]"));
const layoutButtons = document.querySelectorAll("[data-layout]");
const progressLine = document.querySelector(".scroll-meter-line i");
const progressValue = document.querySelector(".scroll-meter-value");
const year = document.querySelector("#year");

if (year) year.textContent = new Date().getFullYear();

let gsap = window.gsap;
let ScrollTrigger = window.ScrollTrigger;
let Flip = gsap?.plugins?.Flip || window.Flip;
let lenis;
let viewportFrame = 0;
let skewControls = [];
const visibleVideos = new Set();
const loadPreview = (video) => {
  if (video.dataset.loaded) return;
  video.dataset.loaded = "true";
  video.poster = video.dataset.poster;
  video.src = video.dataset.src;
  video.load();
};
const previewObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (entry.isIntersecting) {
        visibleVideos.add(video);
        loadPreview(video);
        if (!document.hidden) video.play().catch(() => {});
      } else {
        visibleVideos.delete(video);
        video.pause();
      }
    });
  }, { threshold: 0.01 })
  : null;

const updateViewportUI = () => {
  if (!previewObserver) {
    videos.forEach((video) => {
      const bounds = video.getBoundingClientRect();
      const inView = bounds.bottom > 0 && bounds.top < window.innerHeight;
      if (inView) {
        visibleVideos.add(video);
        loadPreview(video);
        if (!document.hidden) video.play().catch(() => {});
      } else {
        visibleVideos.delete(video);
        video.pause();
      }
    });
  }

  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const scroll = lenis ? lenis.scroll : window.scrollY;
  const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scroll / maxScroll)) : 0;
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

const scheduleViewportUI = () => {
  if (viewportFrame) return;
  viewportFrame = window.requestAnimationFrame(() => {
    viewportFrame = 0;
    updateViewportUI();
  });
};

window.addEventListener("scroll", scheduleViewportUI, { passive: true });
window.addEventListener("resize", scheduleViewportUI);
if (previewObserver) videos.forEach((video) => previewObserver.observe(video));

if (gsap && ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  if (Flip) gsap.registerPlugin(Flip);

  if (!reducedMotion.matches) {
    document.documentElement.classList.add("experiments-motion-ready");
    items.forEach((item) => {
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

      const media = item.querySelector(".gallery-media");
      if (media) {
        gsap.fromTo(media, { yPercent: -CONFIG.parallaxStrength }, {
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
      if (visual) {
        skewControls.push({
          current: 0,
          setSkew: gsap.quickTo(visual, "skewY", {
            duration: 0.35,
            ease: "power3.out",
          }),
        });
      }
    });
  }

  if (!reducedMotion.matches && typeof window.Lenis === "function") {
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
  if (document.hidden) {
    lenis?.stop();
    videos.forEach((video) => video.pause());
    gsap?.ticker.sleep();
    return;
  }
  lenis?.start();
  gsap?.ticker.wake();
  visibleVideos.forEach((video) => video.play().catch(() => {}));
  scheduleViewportUI();
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
})();
