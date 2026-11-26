(() => {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const materialColor = (name) => {
    const material = name.toLowerCase();
    if (material.includes("black")) return [0.11, 0.1, 0.09];
    if (material.includes("glass")) return [0.19, 0.31, 0.39];
    if (material.includes("softbox") || material.includes("white")) return [0.91, 0.89, 0.84];
    if (material.includes("metal")) return [0.58, 0.6, 0.62];
    return [0.48, 0.43, 0.38];
  };

  const parseObj = (source, usePointerHotspot = false) => {
    const vertices = [];
    const normals = [];
    const surfaces = new Map();
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    let activeMaterial = "";

    const getSurface = () => {
      const color = materialColor(activeMaterial);
      const key = color.join(",");
      if (!surfaces.has(key)) surfaces.set(key, { color, positions: [], normals: [] });
      return surfaces.get(key);
    };
    const getIndex = (value, length) => {
      const index = Number(value);
      return index < 0 ? length + index : index - 1;
    };

    for (const rawLine of source.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const parts = line.split(/\s+/);

      if (parts[0] === "v") {
        const vertex = parts.slice(1, 4).map(Number);
        vertices.push(vertex);
        vertex.forEach((value, axis) => {
          min[axis] = Math.min(min[axis], value);
          max[axis] = Math.max(max[axis], value);
        });
      } else if (parts[0] === "vn") {
        normals.push(parts.slice(1, 4).map(Number));
      } else if (parts[0] === "usemtl") {
        activeMaterial = parts.slice(1).join(" ");
      } else if (parts[0] === "f") {
        const references = [];
        for (const part of parts.slice(1)) {
          if (part.startsWith("#")) break;
          const [vertex, , normal] = part.split("/");
          references.push({
            vertex: vertices[getIndex(vertex, vertices.length)],
            normal: normal ? normals[getIndex(normal, normals.length)] : null,
          });
        }
        if (references.length < 3 || references.some((reference) => !reference.vertex)) continue;

        const [a, b, c] = references;
        const ab = b.vertex.map((value, axis) => value - a.vertex[axis]);
        const ac = c.vertex.map((value, axis) => value - a.vertex[axis]);
        const faceNormal = [
          ab[1] * ac[2] - ab[2] * ac[1],
          ab[2] * ac[0] - ab[0] * ac[2],
          ab[0] * ac[1] - ab[1] * ac[0],
        ];
        const normalLength = Math.hypot(...faceNormal) || 1;
        const fallbackNormal = faceNormal.map((value) => value / normalLength);
        const surface = getSurface();

        for (let index = 1; index < references.length - 1; index += 1) {
          for (const reference of [references[0], references[index], references[index + 1]]) {
            surface.positions.push(...reference.vertex);
            surface.normals.push(...(reference.normal ?? fallbackNormal));
          }
        }
      }
    }

    const center = min.map((value, axis) => (value + max[axis]) / 2);
    const extent = Math.max(...max.map((value, axis) => value - min[axis]));
    if (!Number.isFinite(extent) || extent === 0) {
      throw new Error("The OBJ file does not contain renderable geometry.");
    }

    const scale = 2 / extent;
    const meshSurfaces = [...surfaces.values()].map((surface) => {
      for (let index = 0; index < surface.positions.length; index += 3) {
        for (let axis = 0; axis < 3; axis += 1) {
          surface.positions[index + axis] = (surface.positions[index + axis] - center[axis]) * scale;
        }
      }
      return {
        color: surface.color,
        positions: new Float32Array(surface.positions),
        normals: new Float32Array(surface.normals),
      };
    });
    const tip = [(min[0] - center[0]) * scale, (max[1] - center[1]) * scale, 0];

    return {
      surfaces: meshSurfaces,
      hotspot: usePointerHotspot ? tip.map((value) => -value) : [0, 0, 0],
    };
  };

  const createRenderer = (canvas) => {
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("WebGL is unavailable.");

    const vertexSource = `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      uniform vec2 uResolution;
      uniform vec2 uOrigin;
      uniform float uPixelScale;
      uniform vec3 uRotation;
      uniform vec3 uHotspot;
      varying vec3 vNormal;
      void main() {
        vec3 position = aPosition + uHotspot;
        vec3 normal = aNormal;
        float cx = cos(uRotation.x), sx = sin(uRotation.x);
        float cy = cos(uRotation.y), sy = sin(uRotation.y);
        float cz = cos(uRotation.z), sz = sin(uRotation.z);
        position = vec3(position.x, position.y * cx - position.z * sx, position.y * sx + position.z * cx);
        normal = vec3(normal.x, normal.y * cx - normal.z * sx, normal.y * sx + normal.z * cx);
        position = vec3(position.x * cy + position.z * sy, position.y, -position.x * sy + position.z * cy);
        normal = vec3(normal.x * cy + normal.z * sy, normal.y, -normal.x * sy + normal.z * cy);
        position = vec3(position.x * cz - position.y * sz, position.x * sz + position.y * cz, position.z);
        normal = vec3(normal.x * cz - normal.y * sz, normal.x * sz + normal.y * cz, normal.z);
        vec2 pixelToClip = vec2(2.0 / uResolution.x, 2.0 / uResolution.y);
        gl_Position = vec4(
          uOrigin + position.xy * uPixelScale * pixelToClip,
          -position.z * uPixelScale * pixelToClip.y * 0.7,
          1.0
        );
        vNormal = normalize(normal);
      }
    `;
    const fragmentSource = `
      precision mediump float;
      uniform vec3 uColor;
      varying vec3 vNormal;
      void main() {
        vec3 normal = normalize(vNormal);
        vec3 light = normalize(vec3(-0.45, 0.65, 1.0));
        float diffuse = max(dot(normal, light), 0.0);
        float specular = pow(max(dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0)), 0.0), 22.0);
        vec3 color = uColor * (0.36 + diffuse * 0.64) + vec3(1.0, 0.67, 0.4) * specular * 0.22;
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const compileShader = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Could not compile the 3D model shader: ${message}`);
      }
      return shader;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Could not link the 3D model renderer: ${gl.getProgramInfoLog(program)}`);
    }

    const attributes = {
      position: gl.getAttribLocation(program, "aPosition"),
      normal: gl.getAttribLocation(program, "aNormal"),
    };
    const uniforms = {
      resolution: gl.getUniformLocation(program, "uResolution"),
      origin: gl.getUniformLocation(program, "uOrigin"),
      pixelScale: gl.getUniformLocation(program, "uPixelScale"),
      rotation: gl.getUniformLocation(program, "uRotation"),
      hotspot: gl.getUniformLocation(program, "uHotspot"),
      color: gl.getUniformLocation(program, "uColor"),
    };

    const uploadModel = (mesh) => ({
      hotspot: mesh.hotspot,
      surfaces: mesh.surfaces.map((surface) => {
        const position = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, position);
        gl.bufferData(gl.ARRAY_BUFFER, surface.positions, gl.STATIC_DRAW);
        const normal = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normal);
        gl.bufferData(gl.ARRAY_BUFFER, surface.normals, gl.STATIC_DRAW);
        return { position, normal, color: surface.color, count: surface.positions.length / 3 };
      }),
    });

    const draw = (instances) => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(bounds.width * ratio));
      const height = Math.max(1, Math.round(bounds.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(program);
      gl.uniform2f(uniforms.resolution, width, height);

      for (const instance of instances) {
        if (!instance.model) continue;
        gl.uniform2f(uniforms.origin, (instance.x / bounds.width) * 2 - 1, 1 - (instance.y / bounds.height) * 2);
        gl.uniform1f(uniforms.pixelScale, instance.scale * ratio);
        gl.uniform3fv(uniforms.rotation, instance.rotation);
        gl.uniform3fv(uniforms.hotspot, instance.hotspot ?? instance.model.hotspot);

        for (const surface of instance.model.surfaces) {
          gl.bindBuffer(gl.ARRAY_BUFFER, surface.position);
          gl.enableVertexAttribArray(attributes.position);
          gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, surface.normal);
          gl.enableVertexAttribArray(attributes.normal);
          gl.vertexAttribPointer(attributes.normal, 3, gl.FLOAT, false, 0, 0);
          gl.uniform3fv(uniforms.color, surface.color);
          gl.drawArrays(gl.TRIANGLES, 0, surface.count);
        }
      }
    };

    return { draw, uploadModel };
  };

  const fetchObj = async (url, usePointerHotspot = false) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${url}: ${response.status} ${response.statusText}`);
    return parseObj(await response.text(), usePointerHotspot);
  };

  const pointerCanvas = document.createElement("canvas");
  pointerCanvas.className = "arrow-cursor-canvas";
  pointerCanvas.setAttribute("aria-hidden", "true");
  let pointerRenderer;
  let pointerModel;
  let pointerEnabled = false;
  let pointerSeen = false;
  let pointerFrame = 0;
  let pointer = { x: 0, y: 0, rotation: [0.12, -0.16, 0] };
  let pointerLoad;

  const canShowArrowCursor = () => finePointer.matches && !reducedMotion.matches;
  const hideArrowCursor = () => document.documentElement.classList.remove("has-arrow-cursor");
  const renderArrowCursor = () => {
    pointerFrame = 0;
    if (!pointerEnabled || !pointerSeen || !pointerRenderer || !pointerModel) return;
    document.documentElement.classList.add("has-arrow-cursor");
    pointerRenderer.draw([{
      model: pointerModel,
      x: pointer.x,
      y: pointer.y,
      scale: 28,
      rotation: pointer.rotation,
    }]);
  };
  const scheduleArrowCursor = () => {
    if (!pointerFrame) pointerFrame = window.requestAnimationFrame(renderArrowCursor);
  };
  const enableArrowCursor = () => {
    if (!canShowArrowCursor()) {
      pointerEnabled = false;
      hideArrowCursor();
      return;
    }
    pointerEnabled = true;
    if (!pointerLoad) {
      pointerLoad = fetchObj("assets/arrow-cursor.obj", true)
        .then((mesh) => {
          pointerRenderer = createRenderer(pointerCanvas);
          pointerModel = pointerRenderer.uploadModel(mesh);
          document.body.append(pointerCanvas);
          if (pointerSeen && pointerEnabled) scheduleArrowCursor();
        })
        .catch((error) => {
          pointerLoad = null;
          pointerEnabled = false;
          hideArrowCursor();
          console.error("The custom 3D cursor could not be initialized; the browser cursor remains enabled.", error);
        });
    }
  };

  window.addEventListener("pointermove", (event) => {
    if (!pointerEnabled) return;
    pointerSeen = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.rotation = [
      0.12 + Math.max(-0.2, Math.min(0.2, event.movementY * 0.004)),
      -0.16 - Math.max(-0.2, Math.min(0.2, event.movementX * 0.004)),
      0,
    ];
    scheduleArrowCursor();
  }, { passive: true });

  window.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) hideArrowCursor();
  });
  window.addEventListener("blur", hideArrowCursor);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hideArrowCursor();
  });
  window.addEventListener("resize", scheduleArrowCursor, { passive: true });
  finePointer.addEventListener("change", enableArrowCursor);
  reducedMotion.addEventListener("change", enableArrowCursor);
  enableArrowCursor();

  const gearStage = document.querySelector("[data-gear-stage]");
  const gearCanvas = gearStage?.querySelector("[data-gear-canvas]");
  if (gearStage && gearCanvas) {
    const status = gearStage.querySelector("[data-gear-status]");
    let gearRenderer;
    let cameraModel;
    let lensModel;
    let gearFrame = 0;
    let gearRotation = [0.2, -0.28, 0];

    const renderGear = () => {
      gearFrame = 0;
      if (!gearRenderer || !cameraModel || !lensModel) return;
      const bounds = gearCanvas.getBoundingClientRect();
      const scale = Math.min(128, bounds.width * 0.115);
      gearRenderer.draw([
        { model: cameraModel, x: bounds.width * 0.29, y: bounds.height * 0.5, scale, rotation: gearRotation },
        {
          model: lensModel,
          x: bounds.width * 0.71,
          y: bounds.height * 0.5,
          scale: scale * 0.82,
          rotation: [gearRotation[0] + 1.1, gearRotation[1], gearRotation[2]],
        },
      ]);
    };
    const scheduleGearRender = () => {
      if (!gearFrame) gearFrame = window.requestAnimationFrame(renderGear);
    };
    const loadGearModels = async () => {
      if (gearStage.dataset.loading === "true" || gearStage.dataset.modelsReady === "true") return;
      gearStage.dataset.loading = "true";
      if (status) status.textContent = "Loading the camera and lens models…";
      try {
        gearRenderer = createRenderer(gearCanvas);
        cameraModel = gearRenderer.uploadModel(await fetchObj("assets/camera.obj"));
        if (status) status.textContent = "Loading the lens model…";
        lensModel = gearRenderer.uploadModel(await fetchObj("assets/camera-lens.obj"));
        gearStage.dataset.loading = "false";
        gearStage.dataset.modelsReady = "true";
        if (status) status.textContent = "Move your pointer over the models to explore.";
        renderGear();
      } catch (error) {
        gearStage.dataset.loading = "error";
        if (status) status.textContent = "3D preview unavailable. The rest of the portfolio is ready.";
        console.error("The camera and lens 3D preview could not be loaded.", error);
      }
    };

    gearStage.addEventListener("pointermove", (event) => {
      if (!gearRenderer || reducedMotion.matches || event.pointerType === "touch") return;
      const bounds = gearStage.getBoundingClientRect();
      const offsetX = (event.clientX - bounds.left) / bounds.width - 0.5;
      const offsetY = (event.clientY - bounds.top) / bounds.height - 0.5;
      gearRotation = [0.2 + offsetY * 0.3, -0.28 + offsetX * 0.45, 0];
      scheduleGearRender();
    }, { passive: true });
    gearStage.addEventListener("pointerleave", () => {
      gearRotation = [0.2, -0.28, 0];
      scheduleGearRender();
    });
    window.addEventListener("resize", scheduleGearRender, { passive: true });

    if ("IntersectionObserver" in window) {
      const gearObserver = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        gearObserver.disconnect();
        loadGearModels();
      }, { rootMargin: "320px 0px" });
      gearObserver.observe(gearStage);
    } else {
      loadGearModels();
    }
  }
})();
