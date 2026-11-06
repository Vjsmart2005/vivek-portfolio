const menuToggle = document.querySelector(".menu-toggle");
const menuDialog = document.querySelector("#site-menu");
const portfolioNavs = [...document.querySelectorAll(".site-header .site-nav")];
const reelDialog = document.querySelector(".reel-dialog");
const reelTitle = document.querySelector("#reel-title");
const reelVideo = reelDialog?.querySelector("video");
const introLoader = document.querySelector("#intro-loader");
const scrollProgress = document.querySelector(".scroll-progress");
const scrollStory = document.querySelector("[data-scroll-story]");
const homeStoryHeader = document.querySelector(".home-story-header");
const storyOpening = scrollStory?.querySelector("[data-story-opening]");
const storyOpeningVideo = storyOpening?.querySelector("video");
const storyDepth = scrollStory?.querySelector("[data-story-depth]");
const storyPhotos = storyDepth?.querySelectorAll("[data-story-photo]") ?? [];
const storyScrollCue = scrollStory?.querySelector(".story-scroll-cue");
const storyProgressBar = scrollStory?.querySelector("[data-story-progress-bar]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const ambientTextureVideos = document.querySelectorAll("[data-ambient-texture]");
const projectPreviewVideos = document.querySelectorAll("[data-project-preview]");
const pointerTiltTargets = document.querySelectorAll(".home-project, .project-image, .about-image img, .home-about-portrait");
const pointerLight = document.createElement("div");
pointerLight.className = "pointer-light";
pointerLight.setAttribute("aria-hidden", "true");
document.body.append(pointerLight);

const positionNavLens = (nav, link) => {
  if (!link) {
    nav.classList.remove("has-nav-lens");
    return;
  }
  const navBounds = nav.getBoundingClientRect();
  const linkBounds = link.getBoundingClientRect();
  nav.style.setProperty("--nav-lens-x", `${linkBounds.left - navBounds.left}px`);
  nav.style.setProperty("--nav-lens-width", `${linkBounds.width}px`);
  nav.classList.add("has-nav-lens");
};

portfolioNavs.forEach((nav) => {
  const navItems = [...nav.querySelectorAll("a, .menu-toggle")];
  const currentLink = nav.querySelector('a[aria-current="page"]');
  const resetLens = () => positionNavLens(nav, currentLink);

  positionNavLens(nav, currentLink);
  navItems.forEach((item) => {
    item.addEventListener("pointerenter", () => positionNavLens(nav, item));
    item.addEventListener("focus", () => positionNavLens(nav, item));
  });
  nav.addEventListener("pointerleave", resetLens);
  nav.addEventListener("focusout", (event) => {
    if (!nav.contains(event.relatedTarget)) resetLens();
  });
  if ("ResizeObserver" in window) {
    new ResizeObserver(resetLens).observe(nav);
  }
});

window.addEventListener("resize", () => {
  portfolioNavs.forEach((nav) => positionNavLens(nav, nav.querySelector('a[aria-current="page"]')));
}, { passive: true });
document.fonts?.ready.then(() => {
  portfolioNavs.forEach((nav) => positionNavLens(nav, nav.querySelector('a[aria-current="page"]')));
});

const effectPreferences = {
  glow: true,
  grain: true,
  motion: !prefersReducedMotion.matches,
};
const canUsePointerEffects = () => finePointer.matches && !prefersReducedMotion.matches && effectPreferences.motion;

if (introLoader instanceof HTMLDialogElement) {
  const progressBar = introLoader.querySelector(".intro-loader-track");
  const progressFill = introLoader.querySelector(".intro-loader-fill");
  const progressPercent = introLoader.querySelector(".intro-loader-percent");
  const duration = 5_000;
  const exitDuration = 500;
  const startedAt = performance.now();
  let animationFrame;
  let finishTimer;
  let finished = false;

  const finishIntro = () => {
    if (finished) return;
    finished = true;
    window.cancelAnimationFrame(animationFrame);
    window.clearTimeout(finishTimer);
    if (introLoader.open) introLoader.close();
    introLoader.remove();
    document.documentElement.classList.remove("is-intro-loading");
  };

  const updateIntroProgress = (timestamp) => {
    const progress = Math.min(1, (timestamp - startedAt) / (duration - exitDuration));
    const percent = Math.floor(progress * 100);
    progressFill.style.width = `${percent}%`;
    progressPercent.textContent = `${String(percent).padStart(2, "0")}%`;
    const announcedPercent = Math.floor(percent / 10) * 10;
    if (announcedPercent !== Number(progressBar.getAttribute("aria-valuenow"))) {
      progressBar.setAttribute("aria-valuenow", String(announcedPercent));
    }

    if (progress < 1) {
      animationFrame = window.requestAnimationFrame(updateIntroProgress);
      return;
    }

    progressBar.setAttribute("aria-valuenow", "100");
    progressPercent.textContent = "100%";
    introLoader.classList.add("is-exiting");
    finishTimer = window.setTimeout(finishIntro, Math.max(0, duration - (timestamp - startedAt)));
  };

  introLoader.showModal();
  document.documentElement.classList.add("is-intro-loading");
  animationFrame = window.requestAnimationFrame(updateIntroProgress);
  introLoader.querySelector(".intro-loader-skip").addEventListener("click", finishIntro);
  introLoader.addEventListener("cancel", (event) => {
    event.preventDefault();
    finishIntro();
  });
}

const applyEffectPreferences = () => {
  document.documentElement.dataset.effectGlow = String(effectPreferences.glow);
  document.documentElement.dataset.effectGrain = String(effectPreferences.grain);
  document.documentElement.dataset.effectMotion = String(effectPreferences.motion && !prefersReducedMotion.matches);
  const pointerEffectsEnabled = canUsePointerEffects();
  document.body.classList.toggle("has-pointer-light", pointerEffectsEnabled);
  pointerTiltTargets.forEach((target) => {
    target.toggleAttribute("data-pointer-tilt", pointerEffectsEnabled);
    if (!pointerEffectsEnabled) {
      target.classList.remove("is-pointer-tilting");
      target.style.removeProperty("--pointer-tilt-x");
      target.style.removeProperty("--pointer-tilt-y");
    }
  });
  storyPhotos.forEach((photo) => {
    photo.style.removeProperty("--pointer-pitch");
    photo.style.removeProperty("--pointer-yaw");
  });
};

applyEffectPreferences();

pointerTiltTargets.forEach((target) => {
  target.addEventListener("pointermove", (event) => {
    if (!canUsePointerEffects()) return;
    const bounds = target.getBoundingClientRect();
    const offsetX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const offsetY = (event.clientY - bounds.top) / bounds.height - 0.5;
    target.style.setProperty("--pointer-tilt-x", `${(-offsetY * 7).toFixed(2)}deg`);
    target.style.setProperty("--pointer-tilt-y", `${(offsetX * 9).toFixed(2)}deg`);
    target.classList.add("is-pointer-tilting");
  });

  const resetPointerTilt = () => {
    target.classList.remove("is-pointer-tilting");
    target.style.removeProperty("--pointer-tilt-x");
    target.style.removeProperty("--pointer-tilt-y");
  };
  target.addEventListener("pointerleave", resetPointerTilt);
  target.addEventListener("pointercancel", resetPointerTilt);
});

document.addEventListener("pointermove", (event) => {
  if (!canUsePointerEffects()) return;
  pointerLight.style.setProperty("--pointer-x", `${event.clientX}px`);
  pointerLight.style.setProperty("--pointer-y", `${event.clientY}px`);

  if (!storyDepth || storyDepth.classList.contains("is-disabled")) return;
  const bounds = storyDepth.getBoundingClientRect();
  const offsetX = (event.clientX - bounds.left) / bounds.width - 0.5;
  const offsetY = (event.clientY - bounds.top) / bounds.height - 0.5;
  storyPhotos.forEach((photo) => {
    photo.style.setProperty("--pointer-pitch", `${(-offsetY * 5).toFixed(2)}deg`);
    photo.style.setProperty("--pointer-yaw", `${(offsetX * 7).toFixed(2)}deg`);
  });
});

storyDepth?.addEventListener("pointerleave", () => {
  storyPhotos.forEach((photo) => {
    photo.style.removeProperty("--pointer-pitch");
    photo.style.removeProperty("--pointer-yaw");
  });
});

finePointer.addEventListener("change", applyEffectPreferences);
const syncProjectPreview = (video, isVisible) => {
  if (isVisible) {
    const source = video.querySelector("source[data-src]");
    if (source && !source.hasAttribute("src")) {
      source.src = source.dataset.src;
      video.load();
    }
  }
  if (!isVisible || prefersReducedMotion.matches || !effectPreferences.motion) {
    video.pause();
    return;
  }
  video.play().catch((error) => console.warn("Could not play a featured project preview.", error));
};

prefersReducedMotion.addEventListener("change", applyEffectPreferences);
prefersReducedMotion.addEventListener("change", () => {
  projectPreviewVideos.forEach((video) => {
    const bounds = video.getBoundingClientRect();
    syncProjectPreview(video, bounds.bottom >= -160 && bounds.top <= window.innerHeight + 160);
  });
});

const playAmbientTexture = (video) => {
  video.play().catch((error) => console.warn("Could not play an ambient texture.", error));
};

if (projectPreviewVideos.length && "IntersectionObserver" in window) {
  const projectPreviewObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => syncProjectPreview(entry.target, entry.isIntersecting));
  }, { rootMargin: "160px" });
  projectPreviewVideos.forEach((video) => projectPreviewObserver.observe(video));
} else {
  projectPreviewVideos.forEach((video) => syncProjectPreview(video, true));
}

if (ambientTextureVideos.length && "IntersectionObserver" in window) {
  const textureObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (prefersReducedMotion.matches || !effectPreferences.motion || !entry.isIntersecting) {
        entry.target.pause();
      } else {
        playAmbientTexture(entry.target);
      }
    });
  }, { rootMargin: "160px" });

  ambientTextureVideos.forEach((video) => textureObserver.observe(video));
} else if (!prefersReducedMotion.matches && effectPreferences.motion) {
  ambientTextureVideos.forEach(playAmbientTexture);
}

prefersReducedMotion.addEventListener("change", (event) => {
  ambientTextureVideos.forEach((video) => {
    if (event.matches) {
      video.pause();
    } else {
      const bounds = video.getBoundingClientRect();
      if (bounds.bottom >= -160 && bounds.top <= window.innerHeight + 160) playAmbientTexture(video);
    }
  });
});

if (prefersReducedMotion.matches) storyOpeningVideo?.pause();

document.documentElement.classList.add("motion-ready");

const revealItems = document.querySelectorAll("[data-reveal]");
if ("IntersectionObserver" in window && !prefersReducedMotion.matches && effectPreferences.motion) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -36px 0px" });

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

let scrollFrame = 0;
const clampProgress = (value) => Math.min(1, Math.max(0, value));
const easeProgress = (value, start, end) => {
  const progress = clampProgress((value - start) / (end - start));
  return progress * progress * (3 - 2 * progress);
};

const updateStoryScrollCue = () => {
  if (!scrollStory || !storyScrollCue) return;
  const storyStart = scrollStory.getBoundingClientRect().top + window.scrollY;
  const scrollDistance = Math.max(1, scrollStory.offsetHeight - scrollStory.querySelector(".story-pin").offsetHeight);
  const progress = clampProgress((window.scrollY - storyStart) / scrollDistance);
  storyScrollCue.style.setProperty("--story-cue-opacity", String(1 - easeProgress(progress, 0.04, 0.2)));
  storyScrollCue.style.visibility = progress > 0.2 ? "hidden" : "visible";
};

const updateScrollStory = () => {
  if (!scrollStory) return;

  const storyStart = scrollStory.getBoundingClientRect().top + window.scrollY;
  const scrollDistance = Math.max(1, scrollStory.offsetHeight - scrollStory.querySelector(".story-pin").offsetHeight);
  const progress = clampProgress((window.scrollY - storyStart) / scrollDistance);
  document.body.classList.toggle("story-entered", progress > 0.01);
  const reducedStoryMotion = prefersReducedMotion.matches || !effectPreferences.motion;
  const showHomeNav = reducedStoryMotion
    ? window.scrollY >= storyStart + scrollStory.offsetHeight
    : progress >= 0.98;
  document.body.classList.toggle("story-nav-visible", showHomeNav);
  if (homeStoryHeader) {
    homeStoryHeader.inert = !showHomeNav;
    homeStoryHeader.toggleAttribute("aria-hidden", !showHomeNav);
  }
  updateStoryScrollCue();
  if (!storyOpening) return;
  if (prefersReducedMotion.matches || !effectPreferences.motion) {
    storyOpening.style.opacity = "1";
    storyOpening.style.visibility = "visible";
    storyOpening.style.setProperty("--opening-scale", "1");
    storyDepth?.classList.add("is-disabled");
    storyPhotos.forEach((photo) => photo.removeAttribute("style"));
    return;
  }

  storyDepth?.classList.remove("is-disabled");
  const openingOpacity = 1 - easeProgress(progress, 0.64, 0.98);

  storyOpening.style.opacity = String(openingOpacity);
  storyOpening.style.visibility = openingOpacity > 0.01 ? "visible" : "hidden";
  storyOpening.style.setProperty("--opening-scale", String(1 + progress * 0.22));
  storyPhotos.forEach((photo, index) => {
    const phase = easeProgress(progress, 0.4 + index * 0.025, 0.84 + index * 0.025);
    const data = photo.dataset;
    const startX = Number(data.startX);
    const endX = Number(data.endX);
    const startY = Number(data.startY);
    const endY = Number(data.endY);
    const startRotate = Number(data.startRotate);
    const endRotate = Number(data.endRotate);
    const startYaw = Number(data.startYaw);
    const endYaw = Number(data.endYaw);
    const interpolate = (start, end) => start + (end - start) * phase;

    photo.style.setProperty("--story-photo-x", `${interpolate(startX, endX)}vw`);
    photo.style.setProperty("--story-photo-y", `${interpolate(startY, endY)}vh`);
    photo.style.setProperty("--story-photo-z", `${-180 + phase * 150 + index * 9}px`);
    photo.style.setProperty("--story-photo-pitch", `${(1 - phase) * (index % 2 ? -12 : 12)}deg`);
    photo.style.setProperty("--story-photo-yaw", `${interpolate(startYaw, endYaw)}deg`);
    photo.style.setProperty("--story-photo-roll", `${interpolate(startRotate, endRotate)}deg`);
    photo.style.setProperty("--story-photo-scale", String(0.72 + phase * 0.28));
    photo.style.setProperty("--story-photo-opacity", String(easeProgress(progress, 0.42 + index * 0.015, 0.62 + index * 0.015)));
  });
  if (storyOpeningVideo) {
    if (progress > 0.98) {
      storyOpeningVideo.pause();
    } else if (storyOpeningVideo.paused) {
      storyOpeningVideo.play().catch((error) => console.warn("Could not resume the opening showreel.", error));
    }
  }

  if (storyProgressBar) storyProgressBar.parentElement.style.setProperty("--story-progress", String(progress));
};

const updateScrollProgress = () => {
  scrollFrame = 0;
  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
  if (scrollProgress) scrollProgress.style.transform = `scaleX(${progress})`;
  updateScrollStory();
  revealItems.forEach((item) => {
    if (item.getBoundingClientRect().top < window.innerHeight + 40) item.classList.add("is-visible");
  });
};

window.addEventListener("scroll", () => {
  updateStoryScrollCue();
  if (scrollFrame) return;
  scrollFrame = window.requestAnimationFrame(updateScrollProgress);
}, { passive: true });
window.addEventListener("resize", updateScrollProgress);
updateScrollProgress();

prefersReducedMotion.addEventListener("change", (event) => {
  if (event.matches) {
    updateScrollStory();
  }
});

if (menuToggle && menuDialog) {
  menuToggle.addEventListener("click", () => {
    if (menuDialog.open) {
      menuDialog.close();
      return;
    }
    menuDialog.showModal();
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Close full-screen menu");
  });

  menuDialog.addEventListener("close", () => {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open full-screen menu");
  });
  document.querySelector(".menu-close")?.addEventListener("click", () => menuDialog.close());
  menuDialog.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", () => menuDialog.close());
  });
  menuDialog.addEventListener("click", (event) => {
    if (event.target === menuDialog) menuDialog.close();
  });
}

if (reelDialog && reelVideo && reelTitle) {
  const reelSource = reelVideo.querySelector("source");
  document.querySelectorAll(".js-play-reel").forEach((button) => {
    button.addEventListener("click", () => {
      reelTitle.textContent = button.dataset.title || "A little taste of the process";
      if (button.dataset.video && reelSource) {
        reelSource.src = button.dataset.video;
        reelVideo.load();
      }
      reelDialog.showModal();
      reelVideo.currentTime = 0;
      reelVideo.play().catch((error) => console.warn("Could not play the selected project video.", error));
    });
  });

  document.querySelector(".dialog-close")?.addEventListener("click", () => reelDialog.close());
  reelDialog.addEventListener("close", () => reelVideo.pause());
  reelDialog.addEventListener("click", (event) => {
    if (event.target === reelDialog) reelDialog.close();
  });
}

const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

const filmstrip = document.querySelector("[data-filmstrip]");
let setFilmstripAutoScroll = () => {};
if (filmstrip) {
  const track = document.createElement("div");
  track.className = "filmstrip-track";
  const group = document.createElement("div");
  group.className = "filmstrip-group";
  Array.from(filmstrip.children).forEach((figure) => group.append(figure));
  const duplicateGroup = group.cloneNode(true);
  duplicateGroup.setAttribute("aria-hidden", "true");
  duplicateGroup.querySelectorAll("img").forEach((image) => {
    image.alt = "";
  });
  track.append(group, duplicateGroup);
  track.querySelectorAll("img").forEach((image) => {
    image.loading = "eager";
  });
  filmstrip.replaceChildren(track);
  const sizeFilmstripGroups = () => {
    const gap = Number.parseFloat(getComputedStyle(group).gap) || 0;
    const groupWidth = Array.from(group.children).reduce(
      (width, frame) => width + frame.getBoundingClientRect().width,
      0,
    ) + gap * Math.max(0, group.children.length - 1);
    group.style.width = `${groupWidth}px`;
    duplicateGroup.style.width = `${groupWidth}px`;
  };
  sizeFilmstripGroups();
  window.addEventListener("resize", sizeFilmstripGroups);
  window.addEventListener("load", sizeFilmstripGroups, { once: true });

  const duration = 140_000;
  let autoScrollEnabled = !prefersReducedMotion.matches && effectPreferences.motion;
  let resumeAutoScrollTimer;
  let pointerStartX = 0;
  let animationStartTime = 0;
  let pointerId;
  let dragging = false;

  const getFilmstripAnimation = () => track.getAnimations()[0];
  const pauseFilmstrip = () => getFilmstripAnimation()?.pause();
  const resumeFilmstrip = () => {
    if (autoScrollEnabled && !document.hidden) getFilmstripAnimation()?.play();
  };
  const resumeFilmstripAfterInteraction = () => {
    pauseFilmstrip();
    window.clearTimeout(resumeAutoScrollTimer);
    resumeAutoScrollTimer = window.setTimeout(resumeFilmstrip, 1800);
  };
  const advanceFilmstrip = (distance) => {
    const animation = getFilmstripAnimation();
    if (!animation) {
      filmstrip.scrollBy({ left: distance, behavior: "smooth" });
      return;
    }
    const groupWidth = group.getBoundingClientRect().width;
    if (!groupWidth) return;
    animation.pause();
    const currentTime = Number(animation.currentTime) || 0;
    animation.currentTime = currentTime + (distance / groupWidth) * duration;
    window.clearTimeout(resumeAutoScrollTimer);
    resumeAutoScrollTimer = window.setTimeout(resumeFilmstrip, 1800);
  };

  setFilmstripAutoScroll = (enabled) => {
    autoScrollEnabled = enabled && !prefersReducedMotion.matches;
    filmstrip.classList.toggle("is-auto-scrolling", autoScrollEnabled);
    if (autoScrollEnabled) resumeFilmstrip();
    else {
      window.clearTimeout(resumeAutoScrollTimer);
      pauseFilmstrip();
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseFilmstrip();
    else resumeFilmstrip();
  });
  filmstrip.addEventListener("pointerenter", pauseFilmstrip);
  filmstrip.addEventListener("pointerleave", resumeFilmstrip);
  filmstrip.addEventListener("focusin", pauseFilmstrip);
  filmstrip.addEventListener("focusout", (event) => {
    if (!filmstrip.contains(event.relatedTarget)) resumeFilmstrip();
  });
  filmstrip.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") advanceFilmstrip(group.getBoundingClientRect().width * 0.15);
    if (event.key === "ArrowLeft") advanceFilmstrip(group.getBoundingClientRect().width * -0.15);
  });
  prefersReducedMotion.addEventListener("change", (event) => {
    setFilmstripAutoScroll(!event.matches && effectPreferences.motion);
  });
  setFilmstripAutoScroll(autoScrollEnabled);

  filmstrip.addEventListener("wheel", (event) => {
    event.preventDefault();
    advanceFilmstrip(Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX);
  }, { passive: false });

  document.querySelectorAll("[data-rail-direction]").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = Number(button.dataset.railDirection);
      advanceFilmstrip(direction * Math.min(window.innerWidth * 0.72, 560));
    });
  });

  filmstrip.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pauseFilmstrip();
    dragging = true;
    pointerId = event.pointerId;
    pointerStartX = event.clientX;
    animationStartTime = Number(getFilmstripAnimation()?.currentTime) || 0;
    filmstrip.classList.add("is-dragging");
    filmstrip.setPointerCapture(event.pointerId);
  });
  filmstrip.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    const animation = getFilmstripAnimation();
    const groupWidth = group.getBoundingClientRect().width;
    if (animation && groupWidth) {
      animation.currentTime = animationStartTime - ((event.clientX - pointerStartX) / groupWidth) * duration;
    }
  });

  const endFilmstripDrag = () => {
    if (!dragging) return;
    dragging = false;
    filmstrip.classList.remove("is-dragging");
    resumeFilmstripAfterInteraction();
  };
  filmstrip.addEventListener("pointerup", endFilmstripDrag);
  filmstrip.addEventListener("pointercancel", endFilmstripDrag);
  filmstrip.addEventListener("lostpointercapture", endFilmstripDrag);
}
