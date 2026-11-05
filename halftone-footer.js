(() => {
  const CONFIG = {
    wordmark: "vivek joshi",
    dotGap: 7,
    pointerRadius: 80,
    crop: 0.2,
    grainOpacity: 0.045,
    maxDpr: 2,
    footerHeight: 500,
  };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  const parseHex = (hex) => {
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
    if (!match) return null;
    const value = match[1].length === 3
      ? match[1].split("").map((character) => character + character).join("")
      : match[1];
    return [
      Number.parseInt(value.slice(0, 2), 16),
      Number.parseInt(value.slice(2, 4), 16),
      Number.parseInt(value.slice(4, 6), 16),
    ];
  };

  const fitTextSize = (measuredWidth, targetWidth) => (
    measuredWidth > 0 ? targetWidth / measuredWidth * 100 : 0
  );

  function createFooter(footer) {
    const sourceLinks = [...footer.querySelectorAll(".footer-links a")];
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;
    const exploreLinks = sourceLinks.map((link) => {
      const cloned = link.cloneNode(true);
      cloned.removeAttribute("class");
      return cloned;
    });

    footer.classList.add("hwf-footer");
    footer.replaceChildren();

    canvas.setAttribute("aria-hidden", "true");
    const accessibleWordmark = document.createElement("span");
    accessibleWordmark.className = "hwf-footer-sr";
    accessibleWordmark.textContent = CONFIG.wordmark;

    const content = document.createElement("div");
    content.className = "hwf-footer-content";
    content.innerHTML = `
      <div class="hwf-footer-top">
        <div class="hwf-footer-brand">
          <strong>Vivek Joshi · Video Editor</strong>
          <span>Made with intention, frame by frame.</span>
          <span>Dehradun, India · © <span data-footer-year></span></span>
        </div>
        <nav class="hwf-footer-column" aria-label="Explore the portfolio">
          <h2>Explore</h2>
          <ul data-footer-links></ul>
        </nav>
        <nav class="hwf-footer-column" aria-label="Contact Vivek">
          <h2>Get in touch</h2>
          <ul>
            <li><a href="mailto:vivekjoshi20jan2005@gmail.com">Email ↗</a></li>
            <li><a href="tel:+919389877893">Call · +91 93898 77893</a></li>
          </ul>
        </nav>
      </div>
      <div class="hwf-footer-rule">
        <button class="hwf-footer-back" type="button">Back to top ↑</button>
      </div>
    `;

    const linkList = content.querySelector("[data-footer-links]");
    exploreLinks.forEach((link) => {
      const item = document.createElement("li");
      item.append(link);
      linkList.append(item);
    });
    const year = content.querySelector("[data-footer-year]");
    year.textContent = String(new Date().getFullYear());

    footer.append(canvas, accessibleWordmark, content);
    content.querySelector(".hwf-footer-back").addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" });
    });

    const rootStyle = getComputedStyle(document.documentElement);
    const settings = {
      background: rootStyle.getPropertyValue("--ink").trim() || "#161316",
      ink: rootStyle.getPropertyValue("--paper").trim() || "#f0dfcb",
      warm: rootStyle.getPropertyValue("--accent").trim() || "#ff6d29",
      displayFont: rootStyle.getPropertyValue("--font-display").trim() || "sans-serif",
    };
    const inkRgb = parseHex(settings.ink) || [240, 223, 203];
    const warmRgb = parseHex(settings.warm) || [255, 109, 41];
    let width = 0;
    let height = CONFIG.footerHeight;
    let dpr = 1;
    let dots = new Float32Array(0);
    let dotCount = 0;
    let grainTile = null;
    let pointerX = -1e5;
    let pointerY = -1e5;
    let shock = { x: 0, y: 0, time: -1 };
    let frame = 0;
    let visible = true;
    let documentVisible = document.visibilityState === "visible";
    const interactive = finePointer.matches && !reducedMotion.matches;
    const hasMotion = () => interactive && document.documentElement.dataset.effectMotion !== "false";

    const buildGrain = () => {
      grainTile = document.createElement("canvas");
      grainTile.width = 128;
      grainTile.height = 128;
      const grainContext = grainTile.getContext("2d");
      if (!grainContext) return;
      const pixels = grainContext.createImageData(grainTile.width, grainTile.height);
      for (let index = 0; index < pixels.data.length; index += 4) {
        const value = Math.random() * 255;
        pixels.data[index] = value;
        pixels.data[index + 1] = value;
        pixels.data[index + 2] = value;
        pixels.data[index + 3] = Math.random() < 0.5 ? 0 : 255;
      }
      grainContext.putImageData(pixels, 0, 0);
    };

    const layout = () => {
      const rect = footer.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      const mask = document.createElement("canvas");
      mask.width = width;
      mask.height = height;
      const maskContext = mask.getContext("2d", { willReadFrequently: true });
      if (!maskContext) return;

      maskContext.font = `800 100px ${settings.displayFont}`;
      const measuredWidth = maskContext.measureText(CONFIG.wordmark).width;
      const fontSize = fitTextSize(measuredWidth, width * 1.02);
      maskContext.font = `800 ${fontSize}px ${settings.displayFont}`;
      maskContext.textBaseline = "alphabetic";
      const textMetrics = maskContext.measureText(CONFIG.wordmark);
      const capHeight = textMetrics.actualBoundingBoxAscent || fontSize * 0.72;
      maskContext.fillStyle = "#000";
      maskContext.fillText(
        CONFIG.wordmark,
        (width - textMetrics.width) / 2,
        height + capHeight * CONFIG.crop,
      );
      const pixels = maskContext.getImageData(0, 0, width, height).data;
      const gap = Math.max(4, CONFIG.dotGap);
      const points = [];

      for (let y = 0; y < height; y += gap) {
        for (let x = 0; x < width; x += gap) {
          let coverage = 0;
          for (let sampleY = 0; sampleY < 3; sampleY += 1) {
            for (let sampleX = 0; sampleX < 3; sampleX += 1) {
              const sampleXPosition = Math.min(width - 1, Math.floor(x + (sampleX + 0.5) * gap / 3));
              const sampleYPosition = Math.min(height - 1, Math.floor(y + (sampleY + 0.5) * gap / 3));
              coverage += pixels[(sampleYPosition * width + sampleXPosition) * 4 + 3];
            }
          }
          coverage /= 9 * 255;
          if (coverage < 0.06) continue;

          const homeX = x + gap / 2;
          const homeY = y + gap / 2;
          points.push(homeX, homeY, 0, 0, homeX, homeY, Math.sqrt(coverage) * gap * 0.56);
        }
      }
      dots = new Float32Array(points);
      dotCount = points.length / 7;
      buildGrain();
      wake();
    };

    const draw = (now) => {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.fillStyle = settings.background;
      context.fillRect(0, 0, width, height);
      const radius = hasMotion() ? CONFIG.pointerRadius : 0;
      const shockAge = shock.time < 0 ? Infinity : now - shock.time;
      const shockRadius = shockAge * 0.9;
      let moving = false;

      for (let index = 0; index < dotCount; index += 1) {
        const offset = index * 7;
        let x = dots[offset];
        let y = dots[offset + 1];
        let velocityX = dots[offset + 2];
        let velocityY = dots[offset + 3];
        const homeX = dots[offset + 4];
        const homeY = dots[offset + 5];

        if (hasMotion()) {
          if (shockAge < 900) {
            const dx = homeX - shock.x;
            const dy = homeY - shock.y;
            const distance = Math.hypot(dx, dy) + 0.001;
            const band = 1 - Math.min(1, Math.abs(distance - shockRadius) / 26);
            if (band > 0) {
              const force = band * 3.2 * (1 - shockAge / 900);
              velocityX += dx / distance * force;
              velocityY += dy / distance * force;
            }
          }
          const dx = x - pointerX;
          const dy = y - pointerY;
          const distanceSquared = dx * dx + dy * dy;
          if (radius > 0 && distanceSquared < radius * radius) {
            const distance = Math.sqrt(distanceSquared) + 0.001;
            const force = (1 - distance / radius) * 2.6;
            velocityX += dx / distance * force;
            velocityY += dy / distance * force;
          }
          velocityX = (velocityX + (homeX - x) * 0.05) * 0.84;
          velocityY = (velocityY + (homeY - y) * 0.05) * 0.84;
          x += velocityX;
          y += velocityY;
          if (Math.abs(velocityX) + Math.abs(velocityY) > 0.02 || Math.abs(x - homeX) + Math.abs(y - homeY) > 0.05) {
            moving = true;
          } else {
            x = homeX;
            y = homeY;
            velocityX = 0;
            velocityY = 0;
          }
          dots[offset] = x;
          dots[offset + 1] = y;
          dots[offset + 2] = velocityX;
          dots[offset + 3] = velocityY;
        }

        const warmth = Math.min(1, Math.hypot(x - homeX, y - homeY) / 28);
        context.fillStyle = warmth > 0.02
          ? `rgb(${Math.round(inkRgb[0] + (warmRgb[0] - inkRgb[0]) * warmth)},${Math.round(inkRgb[1] + (warmRgb[1] - inkRgb[1]) * warmth)},${Math.round(inkRgb[2] + (warmRgb[2] - inkRgb[2]) * warmth)})`
          : settings.ink;
        context.beginPath();
        context.arc(x, y, dots[offset + 6], 0, Math.PI * 2);
        context.fill();
      }

      if (grainTile && document.documentElement.dataset.effectGrain !== "false") {
        context.globalAlpha = CONFIG.grainOpacity;
        context.globalCompositeOperation = "overlay";
        const pattern = context.createPattern(grainTile, "repeat");
        if (pattern) {
          context.fillStyle = pattern;
          context.fillRect(0, 0, width, height);
        }
        context.globalAlpha = 1;
        context.globalCompositeOperation = "source-over";
      }

      return moving || shockAge < 900 || (hasMotion() && pointerX > -1e4);
    };

    const loop = (now) => {
      frame = 0;
      if (!visible || !documentVisible) return;
      if (draw(now)) frame = window.requestAnimationFrame(loop);
    };

    function wake() {
      if (!frame && visible && documentVisible) frame = window.requestAnimationFrame(loop);
    }

    const toLocal = (event) => {
      const rect = canvas.getBoundingClientRect();
      return [event.clientX - rect.left, event.clientY - rect.top];
    };
    const onPointerMove = (event) => {
      if (!hasMotion()) return;
      [pointerX, pointerY] = toLocal(event);
      wake();
    };
    const onPointerLeave = () => {
      pointerX = -1e5;
      pointerY = -1e5;
      wake();
    };
    const onPointerDown = (event) => {
      if (!hasMotion() || event.target.closest("a, button")) return;
      [shock.x, shock.y] = toLocal(event);
      shock.time = performance.now();
      wake();
    };
    const onVisibilityChange = () => {
      documentVisible = document.visibilityState === "visible";
      if (documentVisible) wake();
      else if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    layout();
    draw(performance.now());
    footer.addEventListener("pointermove", onPointerMove);
    footer.addEventListener("pointerleave", onPointerLeave);
    footer.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(footer);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible) wake();
      else if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    intersectionObserver.observe(footer);

    const themeObserver = new MutationObserver(() => {
      const style = getComputedStyle(document.documentElement);
      settings.background = style.getPropertyValue("--ink").trim() || settings.background;
      settings.ink = style.getPropertyValue("--paper").trim() || settings.ink;
      settings.warm = style.getPropertyValue("--accent").trim() || settings.warm;
      const nextInk = parseHex(settings.ink);
      const nextWarm = parseHex(settings.warm);
      if (nextInk) inkRgb.splice(0, 3, ...nextInk);
      if (nextWarm) warmRgb.splice(0, 3, ...nextWarm);
      wake();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-effect-motion", "data-effect-grain"],
    });

    if (document.fonts?.ready) {
      document.fonts.ready.then(layout);
    }
  }

  document.querySelectorAll(".site-footer").forEach(createFooter);
})();
