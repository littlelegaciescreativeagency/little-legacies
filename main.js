'use strict';
// ══════════════════════════════════════════════════
// LITTLE LEGACIES — main.js v6
// TRUE WebGL Fluid Simulation — Gold & White
// Central 3D molten gold splash, cursor-reactive,
// continuously animated like real liquid
// ══════════════════════════════════════════════════

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));

// ─────────────────────────────────────
// 1. GOLD CURSOR
// ─────────────────────────────────────
(function initCursor() {
  const outer = $('#cursor-outer');
  const inner = $('#cursor-inner');
  const trail = $('#trail-canvas');
  if (!outer || !inner || !trail) return;
  const tCtx = trail.getContext('2d');
  let mx = -300, my = -300, ox = -300, oy = -300;
  let trailPts = [];
  function resizeTrail() { trail.width = window.innerWidth; trail.height = window.innerHeight; }
  resizeTrail();
  window.addEventListener('resize', resizeTrail);
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    inner.style.left = mx + 'px'; inner.style.top = my + 'px';
  });
  let f = 0;
  (function animCursor() {
    f++;
    ox = lerp(ox, mx, 0.1); oy = lerp(oy, my, 0.1);
    outer.style.left = ox + 'px'; outer.style.top = oy + 'px';
    if (f % 3 === 0 && mx > -100) { trailPts.push({ x: mx, y: my }); if (trailPts.length > 30) trailPts.shift(); }
    tCtx.clearRect(0, 0, trail.width, trail.height);
    for (let i = 1; i < trailPts.length; i++) {
      const p0 = trailPts[i-1], p1 = trailPts[i], age = i / trailPts.length;
      tCtx.strokeStyle = `rgba(201,152,42,${age * 0.18})`; tCtx.lineWidth = age * 2.2; tCtx.lineCap = 'round';
      tCtx.beginPath(); tCtx.moveTo(p0.x, p0.y); tCtx.lineTo(p1.x, p1.y); tCtx.stroke();
    }
    requestAnimationFrame(animCursor);
  })();
  $$('a,button,.svc-card,.port-card,.price-card,.why-pt,.test-card,.stat-card,.pz-btn,.gallery-item').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
  });
})();

// ─────────────────────────────────────
// 2. WEBGL FLUID SIMULATION
// Real-time fluid dynamics on GPU
// Gold-colored, cursor-reactive, continuously moving
// ─────────────────────────────────────
(function initFluid() {
  const paintBg = $('#paint-bg');
  if (!paintBg) return;

  // Replace paint-bg with a WebGL canvas
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
  paintBg.parentNode.insertBefore(canvas, paintBg);
  paintBg.style.display = 'none'; // hide the old canvas

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

  if (!gl) {
    // WebGL not supported — fall back to Canvas2D
    paintBg.style.display = 'block';
    initCanvas2DFallback();
    return;
  }

  let W, H;
  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    gl.viewport(0, 0, W, H);
  }
  resize();
  window.addEventListener('resize', () => { resize(); initFBO(); });

  // ── SHADER SOURCES ──
  const vsBase = `
    precision highp float;
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  // Advection — moves the fluid
  const fsAdvect = `
    precision highp float;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 uTexelSize;
    uniform float uDt;
    uniform float uDissipation;
    varying vec2 vUv;
    void main() {
      vec2 vel = texture2D(uVelocity, vUv).xy;
      vec2 prevPos = vUv - vel * uDt * uTexelSize;
      gl_FragColor = uDissipation * texture2D(uSource, prevPos);
    }
  `;

  // Divergence
  const fsDivergence = `
    precision highp float;
    uniform sampler2D uVelocity;
    uniform vec2 uTexelSize;
    varying vec2 vUv;
    void main() {
      float L = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0)).x;
      float R = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0)).x;
      float T = texture2D(uVelocity, vUv + vec2(0, uTexelSize.y)).y;
      float B = texture2D(uVelocity, vUv - vec2(0, uTexelSize.y)).y;
      gl_FragColor = vec4(0.5 * (R - L + T - B), 0, 0, 1);
    }
  `;

  // Pressure (Jacobi iteration)
  const fsPressure = `
    precision highp float;
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;
    uniform vec2 uTexelSize;
    varying vec2 vUv;
    void main() {
      float L = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0)).x;
      float R = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0)).x;
      float T = texture2D(uPressure, vUv + vec2(0, uTexelSize.y)).x;
      float B = texture2D(uPressure, vUv - vec2(0, uTexelSize.y)).x;
      float div = texture2D(uDivergence, vUv).x;
      gl_FragColor = vec4((L + R + T + B - div) * 0.25, 0, 0, 1);
    }
  `;

  // Gradient subtraction (makes fluid incompressible)
  const fsGradient = `
    precision highp float;
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;
    uniform vec2 uTexelSize;
    varying vec2 vUv;
    void main() {
      float L = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0)).x;
      float R = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0)).x;
      float T = texture2D(uPressure, vUv + vec2(0, uTexelSize.y)).x;
      float B = texture2D(uPressure, vUv - vec2(0, uTexelSize.y)).x;
      vec2 vel = texture2D(uVelocity, vUv).xy;
      vel -= vec2(R - L, T - B) * 0.5;
      gl_FragColor = vec4(vel, 0, 1);
    }
  `;

  // Splat — add force/dye at a point
  const fsSplat = `
    precision highp float;
    uniform sampler2D uTarget;
    uniform vec2 uPoint;
    uniform vec3 uColor;
    uniform float uRadius;
    uniform float uAspect;
    varying vec2 vUv;
    void main() {
      vec2 p = vUv - uPoint;
      p.x *= uAspect;
      float splat = exp(-dot(p, p) / uRadius);
      vec3 base = texture2D(uTarget, vUv).xyz;
      gl_FragColor = vec4(base + splat * uColor, 1.0);
    }
  `;

  // Display — render dye as GOLD liquid on cream background
  const fsDisplay = `
    precision highp float;
    uniform sampler2D uDye;
    uniform float uTime;
    varying vec2 vUv;

    // Gold palette function — creates realistic gold shading
    vec3 goldColor(float intensity, vec2 uv, float time) {
      // Base gold colors
      vec3 darkGold   = vec3(0.55, 0.38, 0.08);
      vec3 midGold    = vec3(0.79, 0.60, 0.17);
      vec3 brightGold = vec3(0.94, 0.79, 0.29);
      vec3 shineGold  = vec3(1.0,  0.97, 0.75);
      vec3 specular   = vec3(1.0,  1.0,  0.95);

      // Animated light position (creates moving specular)
      vec2 lightDir = normalize(vec2(cos(time * 0.3), sin(time * 0.2)) + vec2(0.5));
      float spec = pow(max(dot(normalize(uv - 0.5), lightDir), 0.0), 8.0);

      // Layer the gold colors based on intensity
      vec3 col = darkGold;
      col = mix(col, midGold,    smoothstep(0.0, 0.3, intensity));
      col = mix(col, brightGold, smoothstep(0.2, 0.6, intensity));
      col = mix(col, shineGold,  smoothstep(0.5, 0.8, intensity));
      col = mix(col, specular,   smoothstep(0.75, 1.0, intensity) * 0.8);

      // Add specular highlight
      col += specular * spec * intensity * 0.4;

      return col;
    }

    void main() {
      // Cream/white background
      vec3 bgColor = mix(vec3(0.996, 0.988, 0.968), vec3(0.980, 0.965, 0.941), vUv.y * 0.4);

      vec4 dye = texture2D(uDye, vUv);

      // Fluid intensity from dye channels
      float intensity = length(dye.rgb);
      intensity = clamp(intensity * 1.2, 0.0, 1.0);

      // Gold shading
      vec3 gold = goldColor(intensity, vUv, uTime);

      // Inner depth shadow at fluid edges
      float edgeDark = smoothstep(0.05, 0.35, intensity) * (1.0 - smoothstep(0.65, 1.0, intensity));
      gold = mix(gold, gold * 0.5, edgeDark * 0.35);

      // Glossy inner highlight
      float innerSpec = smoothstep(0.4, 0.7, intensity) * 0.6;
      gold += vec3(1.0, 0.98, 0.85) * innerSpec;

      // Mix gold over background
      float alpha = smoothstep(0.02, 0.18, intensity);
      vec3 finalColor = mix(bgColor, gold, alpha);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  // ── COMPILE SHADERS ──
  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function createProgram(vsSrc, fsSrc) {
    const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('Program error:', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  // Build all programs
  const programs = {
    advect:    createProgram(vsBase, fsAdvect),
    diverge:   createProgram(vsBase, fsDivergence),
    pressure:  createProgram(vsBase, fsPressure),
    gradient:  createProgram(vsBase, fsGradient),
    splat:     createProgram(vsBase, fsSplat),
    display:   createProgram(vsBase, fsDisplay),
  };

  // ── FULLSCREEN QUAD ──
  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  function bindQuad(prog) {
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  // ── FRAMEBUFFERS ──
  const SIM_RES = 256; // simulation resolution
  let velocity, dye, pressure, divergence;

  function createFBO(w, h, filter = gl.LINEAR) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo, w, h };
  }

  function createDoubleFBO(w, h, filter) {
    return { read: createFBO(w, h, filter), write: createFBO(w, h, filter),
      swap() { [this.read, this.write] = [this.write, this.read]; } };
  }

  function initFBO() {
    velocity  = createDoubleFBO(SIM_RES, SIM_RES, gl.LINEAR);
    dye       = createDoubleFBO(W, H, gl.LINEAR);
    pressure  = createDoubleFBO(SIM_RES, SIM_RES, gl.NEAREST);
    divergence = createFBO(SIM_RES, SIM_RES, gl.NEAREST);
  }
  initFBO();

  // ── UNIFORM HELPERS ──
  function setUniforms(prog, uniforms) {
    gl.useProgram(prog);
    let texUnit = 0;
    for (const [name, val] of Object.entries(uniforms)) {
      const loc = gl.getUniformLocation(prog, name);
      if (loc === null) continue;
      if (typeof val === 'number') { gl.uniform1f(loc, val); }
      else if (val instanceof WebGLTexture || (val && val.tex)) {
        gl.activeTexture(gl.TEXTURE0 + texUnit);
        gl.bindTexture(gl.TEXTURE_2D, val.tex || val);
        gl.uniform1i(loc, texUnit++);
      } else if (val.length === 2) { gl.uniform2f(loc, ...val); }
      else if (val.length === 3) { gl.uniform3f(loc, ...val); }
    }
  }

  function blit(target) {
    if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); gl.viewport(0, 0, target.w, target.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ── SPLAT ──
  function addSplat(x, y, dx, dy, r, g, b, radius = 0.004) {
    const p = programs.splat;
    gl.useProgram(p); bindQuad(p);
    const aspect = W / H;

    // Velocity splat
    setUniforms(p, {
      uTarget: velocity.read, uPoint: [x / W, 1 - y / H],
      uColor: [dx * 0.003, -dy * 0.003, 0],
      uRadius: radius, uAspect: aspect,
    });
    blit(velocity.write); velocity.swap();

    // Dye splat
    setUniforms(p, {
      uTarget: dye.read, uPoint: [x / W, 1 - y / H],
      uColor: [r, g, b], uRadius: radius * 3, uAspect: aspect,
    });
    blit(dye.write); dye.swap();
  }

  // ── SIMULATION STEP ──
  const texelSize = [1 / SIM_RES, 1 / SIM_RES];
  const dyeTexelSize = () => [1 / W, 1 / H];
  const DT = 0.016;
  const VELOCITY_DISSIPATION = 0.995;
  const DYE_DISSIPATION = 0.985;
  const PRESSURE_ITERATIONS = 25;

  function step() {
    // Advect velocity
    const ap = programs.advect; gl.useProgram(ap); bindQuad(ap);
    setUniforms(ap, { uVelocity: velocity.read, uSource: velocity.read, uTexelSize: texelSize, uDt: DT, uDissipation: VELOCITY_DISSIPATION });
    blit(velocity.write); velocity.swap();

    // Advect dye
    setUniforms(ap, { uVelocity: velocity.read, uSource: dye.read, uTexelSize: dyeTexelSize(), uDt: DT, uDissipation: DYE_DISSIPATION });
    blit(dye.write); dye.swap();

    // Divergence
    const dp = programs.diverge; gl.useProgram(dp); bindQuad(dp);
    setUniforms(dp, { uVelocity: velocity.read, uTexelSize: texelSize });
    blit(divergence);

    // Pressure solve
    const pp = programs.pressure; gl.useProgram(pp); bindQuad(pp);
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      setUniforms(pp, { uPressure: pressure.read, uDivergence: divergence, uTexelSize: texelSize });
      blit(pressure.write); pressure.swap();
    }

    // Gradient subtract
    const gp = programs.gradient; gl.useProgram(gp); bindQuad(gp);
    setUniforms(gp, { uPressure: pressure.read, uVelocity: velocity.read, uTexelSize: texelSize });
    blit(velocity.write); velocity.swap();
  }

  // ── DISPLAY ──
  let t = 0;
  function display() {
    const disp = programs.display; gl.useProgram(disp); bindQuad(disp);
    setUniforms(disp, { uDye: dye.read, uTime: t });
    blit(null);
  }

  // ── AUTONOMOUS SPLATS (keeps the fluid always moving) ──
  const AUTO_SPLATS = [
    // Center burst — the main gold splash
    { x: 0.5,  y: 0.45, angle: 0,    speed: 1.8, r: 0.85, g: 0.58, b: 0.15 },
    { x: 0.5,  y: 0.45, angle: 1.2,  speed: 1.5, r: 0.95, g: 0.78, b: 0.28 },
    { x: 0.5,  y: 0.45, angle: 2.5,  speed: 1.6, r: 0.75, g: 0.50, b: 0.10 },
    { x: 0.5,  y: 0.45, angle: 3.8,  speed: 1.4, r: 0.90, g: 0.68, b: 0.22 },
    // Left-right flows
    { x: 0.25, y: 0.5,  angle: 0.3,  speed: 1.2, r: 0.80, g: 0.60, b: 0.18 },
    { x: 0.75, y: 0.5,  angle: 3.14, speed: 1.2, r: 0.85, g: 0.65, b: 0.20 },
    // Top-bottom
    { x: 0.5,  y: 0.25, angle: 1.57, speed: 1.0, r: 0.92, g: 0.72, b: 0.25 },
    { x: 0.5,  y: 0.75, angle: 4.71, speed: 1.0, r: 0.78, g: 0.55, b: 0.12 },
  ];

  let autoFrame = 0;
  function doAutoSplats() {
    autoFrame++;
    // Fire a different splat every 8 frames for continuous motion
    const idx = Math.floor(autoFrame / 8) % AUTO_SPLATS.length;
    if (autoFrame % 8 === 0) {
      const s = AUTO_SPLATS[idx];
      // Rotate the angle over time for swirling
      const angle = s.angle + autoFrame * 0.008;
      const vx = Math.cos(angle) * s.speed * W * 0.5;
      const vy = Math.sin(angle) * s.speed * H * 0.5;
      addSplat(s.x * W, s.y * H, vx, vy, s.r, s.g, s.b, 0.003);
    }

    // Occasional random burst for dynamism
    if (autoFrame % 60 === 0) {
      const cx = rand(0.3, 0.7) * W;
      const cy = rand(0.3, 0.6) * H;
      for (let i = 0; i < 4; i++) {
        const a = rand(0, Math.PI * 2);
        addSplat(cx, cy, Math.cos(a) * W * 0.8, Math.sin(a) * H * 0.8, 0.88, 0.67, 0.20, 0.002);
      }
    }
  }

  // ── MOUSE/TOUCH INPUT ──
  let lastMouseX = -1, lastMouseY = -1;
  const heroEl = $('#hero');

  function onPointerMove(x, y) {
    if (lastMouseX < 0) { lastMouseX = x; lastMouseY = y; return; }
    const dx = x - lastMouseX;
    const dy = y - lastMouseY;
    const speed = Math.hypot(dx, dy);
    if (speed < 0.5) return;

    // Gold color with slight variation
    const variation = rand(0, 0.3);
    addSplat(x, y, dx * 8, dy * 8,
      0.88 + variation * 0.1,
      0.65 + variation * 0.12,
      0.15 + variation * 0.08,
      Math.min(0.008, 0.003 + speed * 0.00015)
    );
    lastMouseX = x; lastMouseY = y;
  }

  if (heroEl) {
    heroEl.addEventListener('mousemove', e => {
      const rect = heroEl.getBoundingClientRect();
      onPointerMove(e.clientX - rect.left, e.clientY - rect.top);
    });
    heroEl.addEventListener('mouseleave', () => { lastMouseX = -1; lastMouseY = -1; });
    heroEl.addEventListener('touchmove', e => {
      e.preventDefault();
      const rect = heroEl.getBoundingClientRect();
      const touch = e.touches[0];
      onPointerMove(touch.clientX - rect.left, touch.clientY - rect.top);
    }, { passive: false });
  }

  // ── INITIAL SPLAT BURST (populate the fluid at load) ──
  function initialBurst() {
    const cx = W * 0.5, cy = H * 0.44;
    // Big central explosion
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const spd = rand(0.5, 2.0);
      addSplat(
        cx + Math.cos(a) * rand(0, 40),
        cy + Math.sin(a) * rand(0, 30),
        Math.cos(a) * W * spd,
        Math.sin(a) * H * spd,
        rand(0.75, 0.95), rand(0.55, 0.78), rand(0.12, 0.25),
        rand(0.003, 0.007)
      );
    }
    // Flowing arms
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      addSplat(cx, cy, Math.cos(a) * W * 1.5, Math.sin(a) * H * 1.2, 0.88, 0.65, 0.18, 0.005);
    }
    // Run extra steps to spread out initial dye
    for (let i = 0; i < 80; i++) step();
  }

  // ── MAIN LOOP ──
  let started = false;
  function loop() {
    if (!started) { initialBurst(); started = true; }
    t += 0.016;
    doAutoSplats();
    step();
    display();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Scroll effect — add swirl when scrolling
  window.addEventListener('scroll', () => {
    if (!heroEl || heroEl.getBoundingClientRect().bottom < 0) return;
    const sy = window.scrollY;
    if (sy > 0) {
      addSplat(rand(0.3,0.7)*W, rand(0.3,0.6)*H, rand(-1,1)*W*0.4, -sy*2, 0.88, 0.65, 0.18, 0.002);
    }
  }, { passive: true });

})(); // end WebGL fluid

// ── CANVAS 2D FALLBACK (if WebGL not supported) ──
function initCanvas2DFallback() {
  const canvas = $('#paint-bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;
  function resize() { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }
  resize(); window.addEventListener('resize', resize);
  let mouseX = W/2, mouseY = H/2, velX=0, velY=0, prevMX=mouseX, prevMY=mouseY;
  document.addEventListener('mousemove', e=>{velX=e.clientX-prevMX;velY=e.clientY-prevMY;prevMX=mouseX;prevMY=mouseY;mouseX=e.clientX;mouseY=e.clientY;});

  class Blob{constructor(){this.x=rand(W*0.2,W*0.8);this.y=rand(H*0.25,H*0.7);this.vx=rand(-.3,.3);this.vy=rand(-.2,.2);this.r=rand(80,200);this.phase=rand(0,Math.PI*2);this.spd=rand(.0003,.0008);this.isGold=Math.random()<.6;this.cp=rand(0,Math.PI*2);}
    update(t){this.vx+=Math.sin(t*this.spd+this.phase)*.02;this.vy+=Math.cos(t*this.spd*1.2+this.phase+1)*.015;const dx=mouseX-this.x,dy=mouseY-this.y,dist=Math.hypot(dx,dy)+1,f=Math.min(100/dist,2);this.vx+=(dx/dist)*f*.02;this.vy+=(dy/dist)*f*.02;this.vx+=velX*.004;this.vy+=velY*.004;this.vx*=.96;this.vy*=.96;this.x+=this.vx;this.y+=this.vy;this.x=Math.max(-50,Math.min(W+50,this.x));this.y=Math.max(-50,Math.min(H+50,this.y));this.currentR=this.r+Math.sin(t*this.spd*2+this.phase)*20;}
    draw(t){const pulse=.5+.5*Math.sin(t*.0004+this.cp);const grd=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.currentR);if(this.isGold){const ri=Math.floor(lerp(180,240,pulse)),gi=Math.floor(lerp(130,195,pulse)),bi=Math.floor(lerp(35,75,pulse));grd.addColorStop(0,`rgba(${ri},${gi},${bi},.5)`);grd.addColorStop(.35,`rgba(${ri},${gi},${bi},.3)`);grd.addColorStop(.7,`rgba(240,190,60,.1)`);grd.addColorStop(1,`rgba(240,190,60,0)`);}else{grd.addColorStop(0,`rgba(255,255,255,.7)`);grd.addColorStop(.4,`rgba(255,250,230,.4)`);grd.addColorStop(1,`rgba(253,245,216,0)`);}ctx.save();ctx.globalCompositeOperation='multiply';ctx.fillStyle=grd;ctx.beginPath();ctx.arc(this.x,this.y,this.currentR,0,Math.PI*2);ctx.fill();ctx.restore();}}
  const blobs=Array.from({length:16},()=>new Blob());
  function animFallback(t){ctx.clearRect(0,0,W,H);const bg=ctx.createRadialGradient(W*.4,H*.35,0,W*.5,H*.5,Math.max(W,H));bg.addColorStop(0,'#FEFCF7');bg.addColorStop(.5,'#FAF6EE');bg.addColorStop(1,'#F4EEE0');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);blobs.forEach(b=>{b.update(t);b.draw(t);});requestAnimationFrame(animFallback);}
  requestAnimationFrame(animFallback);
}

// ─────────────────────────────────────
// 3. GLITTER OVERLAY (on glitter canvas)
// ─────────────────────────────────────
(function initGlitter() {
  const canvas = $('#glitter-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;
  function resize() { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }
  resize(); window.addEventListener('resize', resize);
  const COLS = ['#C9982A','#F0C84A','#F7E08A','#FFF8DC','#fff'];
  const glitters = Array.from({ length: 200 }, () => ({
    x: rand(0, 2000), y: rand(0, 1500),
    vx: rand(-0.1, 0.1), vy: rand(-0.08, 0.08),
    r: rand(0.4, 2.4), alpha: rand(0.2, 0.9),
    tw: rand(0.012, 0.055), ph: rand(0, Math.PI * 2),
    col: COLS[randInt(0, COLS.length - 1)],
    isStar: Math.random() < 0.42,
  }));
  function animGlitter(t) {
    ctx.clearRect(0, 0, W, H);
    glitters.forEach(g => {
      g.x += g.vx; g.y += g.vy;
      if (g.x < 0) g.x = W; if (g.x > W) g.x = 0;
      if (g.y < 0) g.y = H; if (g.y > H) g.y = 0;
      const a = g.alpha * (0.3 + 0.7 * Math.abs(Math.sin(t * g.tw + g.ph)));
      ctx.save(); ctx.globalAlpha = a;
      if (g.isStar) {
        ctx.strokeStyle = g.col; ctx.lineWidth = g.r * 0.6;
        ctx.shadowColor = g.col; ctx.shadowBlur = g.r * 5;
        const s = g.r * 2.8;
        ctx.beginPath();
        ctx.moveTo(g.x-s,g.y); ctx.lineTo(g.x+s,g.y);
        ctx.moveTo(g.x,g.y-s); ctx.lineTo(g.x,g.y+s);
        ctx.moveTo(g.x-s*.65,g.y-s*.65); ctx.lineTo(g.x+s*.65,g.y+s*.65);
        ctx.moveTo(g.x+s*.65,g.y-s*.65); ctx.lineTo(g.x-s*.65,g.y+s*.65);
        ctx.stroke();
      } else {
        ctx.fillStyle = g.col; ctx.shadowColor = g.col; ctx.shadowBlur = g.r * 4;
        ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
    requestAnimationFrame(animGlitter);
  }
  requestAnimationFrame(animGlitter);
})();

// ─────────────────────────────────────
// 4. DRAMATIC LOGO
// ─────────────────────────────────────
(function initLogoInteraction() {
  const logo3d=$('#logo3d'), logoImg=$('#logo-img'), scene=$('#logo-scene'), hero=$('#hero');
  if (!logo3d || !hero) return;
  let tRX=0, tRY=0, cRX=0, cRY=0, tScale=1, cScale=1, isHovering=false, glowI=0, targetGlow=0;
  const pc=document.createElement('canvas');
  pc.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:10;';
  scene.style.position='relative'; scene.appendChild(pc);
  function resizePC(){const r=scene.getBoundingClientRect();pc.width=r.width||380;pc.height=r.height||380;}
  resizePC(); window.addEventListener('resize',resizePC);
  const pCtx=pc.getContext('2d'); let parts=[];
  class Particle{constructor(cx,cy,burst){const a=rand(0,Math.PI*2),spd=burst?rand(3,11):rand(.4,1.8);this.x=cx;this.y=cy;this.vx=Math.cos(a)*spd;this.vy=Math.sin(a)*spd;this.r=burst?rand(2,6):rand(1,2.5);this.life=1;this.decay=burst?rand(.02,.055):rand(.008,.022);this.col=['#C9982A','#F0C84A','#F7E08A','#fff','#FDF5D8'][randInt(0,4)];this.star=Math.random()<.45;}
    update(){this.x+=this.vx;this.y+=this.vy;this.vy+=.07;this.vx*=.97;this.life-=this.decay;}
    draw(){pCtx.save();pCtx.globalAlpha=Math.max(0,this.life);pCtx.fillStyle=this.col;pCtx.strokeStyle=this.col;pCtx.shadowColor=this.col;pCtx.shadowBlur=this.r*5;if(this.star){pCtx.lineWidth=1;const s=this.r*2.5;pCtx.beginPath();pCtx.moveTo(this.x-s,this.y);pCtx.lineTo(this.x+s,this.y);pCtx.moveTo(this.x,this.y-s);pCtx.lineTo(this.x,this.y+s);pCtx.stroke();}else{pCtx.beginPath();pCtx.arc(this.x,this.y,this.r,0,Math.PI*2);pCtx.fill();}pCtx.restore();}}
  function burst(cx,cy,n){for(let i=0;i<n;i++)parts.push(new Particle(cx,cy,true));}
  (function animParts(){pCtx.clearRect(0,0,pc.width,pc.height);parts=parts.filter(p=>p.life>0);parts.forEach(p=>{p.update();p.draw();});if(isHovering&&Math.random()<.4)parts.push(new Particle(pc.width/2+rand(-90,90),pc.height/2+rand(-90,90),false));requestAnimationFrame(animParts);})();
  hero.addEventListener('mousemove',e=>{const r=hero.getBoundingClientRect();tRY=((e.clientX-r.left-r.width/2)/r.width)*38;tRX=-((e.clientY-r.top-r.height/2)/r.height)*30;tScale=1.09;});
  hero.addEventListener('mouseleave',()=>{tRX=0;tRY=0;tScale=1;isHovering=false;targetGlow=0;});
  logo3d.addEventListener('mouseenter',()=>{isHovering=true;targetGlow=1;});
  logo3d.addEventListener('mouseleave',()=>{isHovering=false;targetGlow=0;});
  logo3d.addEventListener('click',()=>{burst(pc.width/2,pc.height/2,55);tScale=1.2;setTimeout(()=>{tScale=isHovering?1.09:1;},280);});
  (function animTilt(){cRX=lerp(cRX,tRX,.052);cRY=lerp(cRY,tRY,.052);cScale=lerp(cScale,tScale,.06);glowI=lerp(glowI,targetGlow,.055);logo3d.style.transform=`perspective(900px) rotateX(${cRX}deg) rotateY(${cRY}deg) scale(${cScale})`;if(logoImg){const g=glowI;logoImg.style.filter=`drop-shadow(0 ${8+g*24}px ${30+g*55}px rgba(201,152,42,${.48+g*.42})) drop-shadow(0 0 ${55+g*90}px rgba(201,152,42,${.22+g*.48})) drop-shadow(0 0 ${g*50}px rgba(240,200,74,${g*.65}))`;}requestAnimationFrame(animTilt);})();
})();

// ─────────────────────────────────────
// 5-14. ALL REMAINING SYSTEMS
// ─────────────────────────────────────
(function(){const btns=$$('.pf-btn'),cards=$$('.port-card');btns.forEach(btn=>{btn.addEventListener('click',()=>{btns.forEach(b=>b.classList.remove('active'));btn.classList.add('active');const f=btn.dataset.filter;cards.forEach(card=>{const match=f==='all'||card.dataset.category===f;card.style.display=match?'':'none';if(match){card.classList.remove('vis');void card.offsetHeight;card.classList.add('vis');}});});});})();
(function(){const lb=$('#lightbox'),lbImg=$('#lb-img'),lbCat=$('#lb-cat'),lbTitle=$('#lb-title'),lbClose=$('#lb-close'),lbBackdrop=$('#lb-backdrop'),lbPrev=$('#lb-prev'),lbNext=$('#lb-next');if(!lb)return;const items=$$('.gallery-item');let current=0;function openLb(idx){current=idx;const item=items[idx];lbImg.src=item.dataset.img;lbCat.textContent=item.dataset.cat;lbTitle.textContent=item.dataset.title;lb.classList.add('open');document.body.style.overflow='hidden';lbPrev.style.display=items.length>1?'flex':'none';lbNext.style.display=items.length>1?'flex':'none';}function closeLb(){lb.classList.remove('open');document.body.style.overflow='';setTimeout(()=>{lbImg.src='';},350);}items.forEach((item,idx)=>item.addEventListener('click',()=>openLb(idx)));lbClose.addEventListener('click',closeLb);lbBackdrop.addEventListener('click',closeLb);lbPrev.addEventListener('click',e=>{e.stopPropagation();current=(current-1+items.length)%items.length;openLb(current);});lbNext.addEventListener('click',e=>{e.stopPropagation();current=(current+1)%items.length;openLb(current);});document.addEventListener('keydown',e=>{if(!lb.classList.contains('open'))return;if(e.key==='Escape')closeLb();if(e.key==='ArrowLeft'){current=(current-1+items.length)%items.length;openLb(current);}if(e.key==='ArrowRight'){current=(current+1)%items.length;openLb(current);}});})();
(function(){const canvas=$('#why-canvas');if(!canvas)return;const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;const COLS=['#C9982A','#F0C84A','#2A8B8B','#C4748A','#7B4FA0','#F7E08A','#fff'];const strokes=Array.from({length:14},()=>({cx:rand(50,W-50),cy:rand(50,H-50),r:rand(28,95),col:COLS[randInt(0,COLS.length-1)],speed:rand(.003,.013),phase:rand(0,Math.PI*2),alpha:rand(.05,.17),sw:rand(6,28)}));function animWhy(t){ctx.clearRect(0,0,W,H);ctx.fillStyle='#FEF9EC';ctx.fillRect(0,0,W,H);for(let i=3;i>=1;i--){ctx.save();ctx.strokeStyle=`rgba(201,152,42,${.08/i})`;ctx.lineWidth=1;ctx.beginPath();ctx.arc(W/2,H/2,60*i,0,Math.PI*2);ctx.stroke();ctx.restore();}strokes.forEach(s=>{const a=t*s.speed+s.phase,x1=s.cx+Math.cos(a)*s.r,y1=s.cy+Math.sin(a)*s.r,x2=s.cx+Math.cos(a+.6)*s.r,y2=s.cy+Math.sin(a+.6)*s.r;ctx.save();ctx.globalAlpha=s.alpha;ctx.strokeStyle=s.col;ctx.lineWidth=s.sw;ctx.lineCap='round';ctx.shadowColor=s.col;ctx.shadowBlur=s.sw*.4;ctx.beginPath();ctx.moveTo(x1,y1);ctx.quadraticCurveTo(s.cx,s.cy,x2,y2);ctx.stroke();ctx.restore();});const size=80+Math.sin(t*.001)*8;ctx.save();ctx.translate(W/2,H/2);ctx.rotate(t*.0005);ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(size*.7,0);ctx.lineTo(0,size);ctx.lineTo(-size*.7,0);ctx.closePath();ctx.strokeStyle='rgba(201,152,42,.5)';ctx.lineWidth=2;ctx.stroke();ctx.font="bold 22px 'Cinzel',serif";ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(201,152,42,.9)';ctx.shadowColor='rgba(201,152,42,.5)';ctx.shadowBlur=12;ctx.fillText('LLC',0,-10);ctx.font="10px 'Raleway',sans-serif";ctx.fillStyle='rgba(30,24,16,.5)';ctx.shadowBlur=0;ctx.fillText('EST. 2023',0,14);ctx.restore();requestAnimationFrame(animWhy);}requestAnimationFrame(animWhy);})();
(function(){const canvas=$('#user-paint-canvas');if(!canvas)return;const ctx=canvas.getContext('2d');canvas.width=canvas.offsetWidth;canvas.height=420;let painting=false,lastX=0,lastY=0,currentColor='#C9982A',brushSize=12,isSplatter=false;ctx.fillStyle='#FEFCF7';ctx.fillRect(0,0,canvas.width,canvas.height);function getPos(e){const rect=canvas.getBoundingClientRect(),sx=canvas.width/rect.width,sy=canvas.height/rect.height;if(e.touches)return{x:(e.touches[0].clientX-rect.left)*sx,y:(e.touches[0].clientY-rect.top)*sy};return{x:(e.clientX-rect.left)*sx,y:(e.clientY-rect.top)*sy};}function paintStroke(x,y,px,py){ctx.save();ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.strokeStyle=currentColor;ctx.lineWidth=brushSize;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor=currentColor;ctx.shadowBlur=brushSize*.5;ctx.globalAlpha=.82;ctx.stroke();ctx.restore();}function splatter(x,y){for(let i=0;i<randInt(8,22);i++){const a=rand(0,Math.PI*2),d=rand(5,90),ex=x+Math.cos(a)*d,ey=y+Math.sin(a)*d,dr=rand(2,brushSize*.65);ctx.save();ctx.globalAlpha=rand(.4,.9);ctx.fillStyle=currentColor;ctx.beginPath();ctx.arc(ex,ey,dr,0,Math.PI*2);ctx.fill();ctx.restore();}}canvas.addEventListener('mousedown',e=>{painting=true;const p=getPos(e);lastX=p.x;lastY=p.y;if(isSplatter)splatter(p.x,p.y);});canvas.addEventListener('mousemove',e=>{if(!painting)return;const p=getPos(e);if(!isSplatter)paintStroke(p.x,p.y,lastX,lastY);lastX=p.x;lastY=p.y;});canvas.addEventListener('mouseup',()=>painting=false);canvas.addEventListener('mouseleave',()=>painting=false);canvas.addEventListener('touchstart',e=>{e.preventDefault();painting=true;const p=getPos(e);lastX=p.x;lastY=p.y;if(isSplatter)splatter(p.x,p.y);},{passive:false});canvas.addEventListener('touchmove',e=>{e.preventDefault();if(!painting)return;const p=getPos(e);if(!isSplatter)paintStroke(p.x,p.y,lastX,lastY);lastX=p.x;lastY=p.y;},{passive:false});canvas.addEventListener('touchend',()=>painting=false);$$('.pz-btn').forEach(btn=>{btn.addEventListener('click',()=>{$$('.pz-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');if(btn.id==='clear-canvas-btn'){ctx.fillStyle='#FEFCF7';ctx.fillRect(0,0,canvas.width,canvas.height);isSplatter=false;return;}if(btn.id==='splatter-btn'){isSplatter=true;if(btn.dataset.color)currentColor=btn.dataset.color;return;}isSplatter=false;if(btn.dataset.color)currentColor=btn.dataset.color;if(btn.dataset.size)brushSize=parseInt(btn.dataset.size);});});})();
(function(){const canvas=$('#tetris-canvas'),nextCanvas=$('#next-canvas');if(!canvas)return;const ctx=canvas.getContext('2d'),nCtx=nextCanvas.getContext('2d'),overlay=$('#game-overlay'),modal=$('#game-modal'),COLS=10,ROWS=20,BLOCK=canvas.width/COLS,COLORS=[null,'#C9982A','#F0C84A','#2A8B8B','#C4748A','#7B4FA0','#3A6FA8','#E8703A'],SHAPES=[null,[[1,1,1,1]],[[2,2],[2,2]],[[0,3,0],[3,3,3]],[[0,4,4],[4,4,0]],[[5,5,0],[0,5,5]],[[6,0,0],[6,6,6]],[[0,0,7],[7,7,7]]];let board,score,level,lines,best=0,cur,nxt,running=false,paused=false,dropTimer=0,lastTime=0,dropInterval=800,animId;function makeBoard(){return Array.from({length:ROWS},()=>new Array(COLS).fill(0));}function randPiece(){const t=randInt(1,7),shape=SHAPES[t].map(r=>[...r]);return{type:t,shape,x:Math.floor(COLS/2)-Math.floor(shape[0].length/2),y:0};}function rotate(s){const r=s.length,c=s[0].length,res=Array.from({length:c},()=>new Array(r).fill(0));for(let i=0;i<r;i++)for(let j=0;j<c;j++)res[j][r-1-i]=s[i][j];return res;}function valid(p,dx=0,dy=0,sh=p.shape){for(let r=0;r<sh.length;r++)for(let c=0;c<sh[r].length;c++){if(!sh[r][c])continue;const nx=p.x+c+dx,ny=p.y+r+dy;if(nx<0||nx>=COLS||ny>=ROWS)return false;if(ny>=0&&board[ny][nx])return false;}return true;}function merge(){cur.shape.forEach((row,r)=>row.forEach((v,c)=>{if(v)board[cur.y+r][cur.x+c]=v;}));}function clearLines(){let cl=0;for(let r=ROWS-1;r>=0;r--){if(board[r].every(c=>c)){board.splice(r,1);board.unshift(new Array(COLS).fill(0));cl++;r++;}}if(cl){score+=[0,100,300,500,800][cl]*level;lines+=cl;level=Math.floor(lines/10)+1;dropInterval=Math.max(80,800-(level-1)*70);updateUI();}}function hardDrop(){while(valid(cur,0,1)){cur.y++;score+=2;}lock();}function lock(){merge();clearLines();cur=nxt;nxt=randPiece();drawNext();if(!valid(cur))endGame();}function updateUI(){$('#t-score').textContent=score;$('#t-level').textContent=level;$('#t-lines').textContent=lines;if(score>best){best=score;$('#t-best').textContent=best;try{localStorage.setItem('ll_best',best);}catch(e){}}}function endGame(){running=false;cancelAnimationFrame(animId);$('#pause-tetris').style.display='none';$('#restart-tetris').style.display='none';$('#gm-score').textContent=score;$('#gm-best').textContent=best;$('#gm-title').textContent=score>500?'🏆 Legendary!':score>200?'🎨 Creative!':'✨ Keep Going!';modal.style.display='flex';}function drawBlock(c,x,y,type,size=BLOCK){if(!type)return;const col=COLORS[type],bx=x*size,by=y*size,s=size-1;c.fillStyle=col;c.fillRect(bx+1,by+1,s-1,s-1);c.fillStyle='rgba(255,255,255,.28)';c.fillRect(bx+1,by+1,s-1,3);c.fillRect(bx+1,by+1,3,s-1);c.fillStyle='rgba(0,0,0,.22)';c.fillRect(bx+s-2,by+2,2,s-2);c.fillRect(bx+2,by+s-2,s-2,2);}function drawGhost(){let gy=cur.y;while(valid(cur,0,gy-cur.y+1))gy++;if(gy===cur.y)return;cur.shape.forEach((row,r)=>row.forEach((v,c2)=>{if(!v)return;ctx.save();ctx.globalAlpha=.18;ctx.strokeStyle=COLORS[v];ctx.lineWidth=2;ctx.strokeRect((cur.x+c2)*BLOCK+2,(gy+r)*BLOCK+2,BLOCK-4,BLOCK-4);ctx.restore();}));}function draw(){const bg=ctx.createLinearGradient(0,0,0,canvas.height);bg.addColorStop(0,'#FEF9EC');bg.addColorStop(1,'#FAF6EE');ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='rgba(201,152,42,.07)';ctx.lineWidth=.5;for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)ctx.strokeRect(c*BLOCK,r*BLOCK,BLOCK,BLOCK);for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(board[r][c])drawBlock(ctx,c,r,board[r][c]);if(cur){drawGhost();cur.shape.forEach((row,r)=>row.forEach((v,c)=>{if(v)drawBlock(ctx,cur.x+c,cur.y+r,v);}));}if(paused){ctx.fillStyle='rgba(253,245,216,.88)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#C9982A';ctx.font="bold 24px 'Cinzel',serif";ctx.textAlign='center';ctx.fillText('PAUSED',canvas.width/2,canvas.height/2);}}function drawNext(){nCtx.fillStyle='#FAF6EE';nCtx.fillRect(0,0,100,100);if(!nxt)return;const bS=18,ox=Math.floor((100-nxt.shape[0].length*bS)/2),oy=Math.floor((100-nxt.shape.length*bS)/2);nxt.shape.forEach((row,r)=>row.forEach((v,c)=>{if(!v)return;nCtx.fillStyle=COLORS[v];nCtx.fillRect(ox+c*bS+1,oy+r*bS+1,bS-2,bS-2);}));}function gameLoop(t){if(!running||paused){draw();return;}const dt=t-lastTime;lastTime=t;dropTimer+=dt;if(dropTimer>=dropInterval){dropTimer=0;valid(cur,0,1)?cur.y++:lock();}draw();animId=requestAnimationFrame(gameLoop);}function start(){board=makeBoard();score=0;level=1;lines=0;dropTimer=0;dropInterval=800;try{best=parseInt(localStorage.getItem('ll_best'))||0;}catch(e){best=0;}cur=randPiece();nxt=randPiece();drawNext();updateUI();running=true;paused=false;overlay.style.display='none';modal.style.display='none';$('#pause-tetris').style.display='block';$('#restart-tetris').style.display='block';lastTime=performance.now();cancelAnimationFrame(animId);animId=requestAnimationFrame(gameLoop);}document.addEventListener('keydown',e=>{if(!running)return;switch(e.key){case'ArrowLeft':case'a':case'A':if(valid(cur,-1,0))cur.x--;e.preventDefault();break;case'ArrowRight':case'd':case'D':if(valid(cur,1,0))cur.x++;e.preventDefault();break;case'ArrowDown':case's':case'S':if(valid(cur,0,1)){cur.y++;score++;}e.preventDefault();break;case'ArrowUp':case'w':case'W':{const rot=rotate(cur.shape);if(valid(cur,0,0,rot))cur.shape=rot;e.preventDefault();break;}case' ':hardDrop();e.preventDefault();break;case'p':case'P':paused=!paused;$('#pause-tetris').textContent=paused?'Resume':'Pause';if(!paused){lastTime=performance.now();animId=requestAnimationFrame(gameLoop);}break;}});let tSX=0,tSY=0;canvas.addEventListener('touchstart',e=>{tSX=e.touches[0].clientX;tSY=e.touches[0].clientY;e.preventDefault();},{passive:false});canvas.addEventListener('touchend',e=>{if(!running)return;const dx=e.changedTouches[0].clientX-tSX,dy=e.changedTouches[0].clientY-tSY;if(Math.abs(dx)<10&&Math.abs(dy)<10){const r=rotate(cur.shape);if(valid(cur,0,0,r))cur.shape=r;}else if(Math.abs(dx)>Math.abs(dy)){if(dx>0&&valid(cur,1,0))cur.x++;else if(dx<0&&valid(cur,-1,0))cur.x--;}else if(dy>30)hardDrop();e.preventDefault();},{passive:false});$('#start-tetris').addEventListener('click',start);$('#pause-tetris').addEventListener('click',()=>{paused=!paused;$('#pause-tetris').textContent=paused?'Resume':'Pause';if(!paused){lastTime=performance.now();animId=requestAnimationFrame(gameLoop);}});$('#restart-tetris').addEventListener('click',start);$('#gm-restart').addEventListener('click',start);$('#gm-close').addEventListener('click',()=>{modal.style.display='none';});board=makeBoard();cur=randPiece();nxt=randPiece();draw();drawNext();})();
(function(){const els=$$('.reveal');els.forEach(el=>new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('vis');});},{threshold:.08}).observe(el));window.addEventListener('scroll',()=>{$('#navbar').classList.toggle('scrolled',scrollY>70);},{passive:true});})();
(function(){$$('.stat-num[data-target]').forEach(el=>{new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting&&!el.dataset.done){el.dataset.done='1';const t=+el.dataset.target;let c=0;const s=t/60;const id=setInterval(()=>{c=Math.min(c+s,t);el.textContent=Math.round(c);if(c>=t)clearInterval(id);},20);}});},{threshold:.5}).observe(el);});})();
(function(){$$('.svc-card,.price-card,[data-tilt]').forEach(card=>{card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/r.width,dy=(e.clientY-r.top-r.height/2)/r.height,i=card.hasAttribute('data-tilt')?12:6;card.style.transform=`perspective(900px) rotateX(${-dy*i}deg) rotateY(${dx*i}deg) translateY(-8px)`;});card.addEventListener('mouseleave',()=>card.style.transform='');});$$('.port-card').forEach(card=>{card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/r.width,dy=(e.clientY-r.top-r.height/2)/r.height,bg=card.querySelector('.port-bg');if(bg)bg.style.transform=`scale(1.07) translate(${dx*14}px,${dy*10}px)`;});card.addEventListener('mouseleave',()=>{const bg=card.querySelector('.port-bg');if(bg)bg.style.transform='';});});$$('.svc-card').forEach(card=>{const splash=card.querySelector('.svc-splash'),col=card.dataset.color||'#C9982A';if(!splash)return;card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect(),x=((e.clientX-r.left)/r.width*100).toFixed(1),y=((e.clientY-r.top)/r.height*100).toFixed(1);splash.style.background=`radial-gradient(circle at ${x}% ${y}%, ${col}1A, transparent 65%)`;});});})();
(function(){const toggle=$('#menu-toggle'),menu=$('#fullscreen-menu'),close=$('#close-menu');const open=()=>{menu.classList.add('open');toggle.classList.add('active');document.body.style.overflow='hidden';};const closeMenu=()=>{menu.classList.remove('open');toggle.classList.remove('active');document.body.style.overflow='';};toggle.addEventListener('click',()=>menu.classList.contains('open')?closeMenu():open());close.addEventListener('click',closeMenu);$$('.fm-link').forEach(l=>l.addEventListener('click',closeMenu));menu.addEventListener('click',e=>{if(e.target===menu)closeMenu();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});})();
(function(){const form=$('#contact-form'),success=$('#form-success');if(!form)return;form.addEventListener('submit',e=>{e.preventDefault();form.style.display='none';success.style.display='block';});})();
$$('a[href^="#"]').forEach(link=>{link.addEventListener('click',e=>{const target=$(link.getAttribute('href'));if(!target)return;e.preventDefault();window.scrollTo({top:target.getBoundingClientRect().top+scrollY-80,behavior:'smooth'});});});

console.log('%c🌹 Little Legacies Creative Agency', 'color:#C9982A;font-size:16px;font-family:serif;font-weight:bold');
console.log('%cWhere Vision Becomes Legacy · Est. 2023 · WebGL Fluid v6', 'color:#F0C84A;font-size:11px');
