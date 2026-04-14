'use strict';
// ══════════════════════════════════════════════════
// LITTLE LEGACIES — main.js v5
// 3D Volumetric Gold Liquid Background
// Thick, glossy, swooping gold streams with depth,
// specular highlights, droplets, and cursor interaction
// ══════════════════════════════════════════════════

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));

// ─────────────────────────────────────
// 1. GOLD CURSOR (clean ring)
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
  function animCursor() {
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
  }
  animCursor();
  $$('a,button,.svc-card,.port-card,.price-card,.why-pt,.test-card,.stat-card,.pz-btn,.gallery-item').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
  });
})();

// ─────────────────────────────────────
// 2. 3D VOLUMETRIC GOLD LIQUID BACKGROUND
// Thick, swooping gold streams with specular highlights,
// inner depth shadows, droplets, and cursor distortion
// ─────────────────────────────────────
(function initGoldLiquid() {
  const canvas = $('#paint-bg');
  const glitterCanvas = $('#glitter-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const gCtx = glitterCanvas ? glitterCanvas.getContext('2d') : null;
  let W, H;

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    if (glitterCanvas) { glitterCanvas.width = W; glitterCanvas.height = H; }
  }
  resize();
  window.addEventListener('resize', () => { resize(); buildStreams(); buildDroplets(); });

  // Mouse state
  let mouseX = -500, mouseY = -500;
  let velX = 0, velY = 0, prevMX = 0, prevMY = 0;
  let isMouseInHero = false;
  let scrollY2 = 0;

  const hero = $('#hero');
  if (hero) {
    hero.addEventListener('mousemove', e => {
      velX = e.clientX - prevMX; velY = e.clientY - prevMY;
      prevMX = mouseX; prevMY = mouseY;
      mouseX = e.clientX; mouseY = e.clientY;
      isMouseInHero = true;
    });
    hero.addEventListener('mouseleave', () => { isMouseInHero = false; mouseX = -500; mouseY = -500; });
  }
  window.addEventListener('scroll', () => {
    if (hero && hero.getBoundingClientRect().bottom > 0) scrollY2 = window.scrollY;
  }, { passive: true });

  // ══════════════════════════════
  // GOLD STREAM — thick 3D liquid ribbon
  // ══════════════════════════════
  class GoldStream {
    constructor(idx, total) {
      this.idx = idx;
      this.total = total;
      this.reset(true);
    }

    reset(init) {
      // Each stream is a bezier ribbon flowing across the canvas
      const side = Math.random() < 0.5;
      // Start and end on opposite edges
      if (side) {
        this.startX = -150;
        this.startY = rand(H * 0.05, H * 0.95);
        this.endX = W + 150;
        this.endY = rand(H * 0.05, H * 0.95);
      } else {
        this.startX = rand(W * 0.05, W * 0.95);
        this.startY = -150;
        this.endX = rand(W * 0.05, W * 0.95);
        this.endY = H + 150;
      }

      // Control points for bezier — creates the swooping curve
      this.cp1x = rand(W * 0.1, W * 0.9);
      this.cp1y = rand(H * 0.05, H * 0.95);
      this.cp2x = rand(W * 0.1, W * 0.9);
      this.cp2y = rand(H * 0.05, H * 0.95);

      // Target control points (they drift over time)
      this.tcp1x = this.cp1x; this.tcp1y = this.cp1y;
      this.tcp2x = this.cp2x; this.tcp2y = this.cp2y;

      this.width = rand(18, 65);       // Stream thickness
      this.alpha = rand(0.55, 0.88);   // Opacity
      this.speed = rand(0.0002, 0.0006); // Drift speed
      this.phase = rand(0, Math.PI * 2);
      this.life = init ? rand(0, 1) : 0;
      this.maxLife = rand(0.4, 0.85);   // When it reaches max, fades out
      this.morphSpeed = rand(0.0003, 0.001);
      this.morphAmt = rand(30, 120);    // How much the stream morphs

      // Gold color variation
      const goldVariant = randInt(0, 3);
      this.colors = [
        { dark: [160, 110, 20],  mid: [201, 152, 42],  bright: [240, 200, 74],  shine: [255, 245, 180] },
        { dark: [140, 95,  15],  mid: [185, 140, 35],  bright: [225, 185, 60],  shine: [255, 240, 160] },
        { dark: [175, 125, 30],  mid: [215, 165, 50],  bright: [250, 210, 80],  shine: [255, 248, 200] },
        { dark: [200, 160, 50],  mid: [230, 185, 70],  bright: [255, 225, 100], shine: [255, 252, 220] },
      ][goldVariant];
    }

    update(t) {
      this.life += this.speed * 0.8;
      if (this.life > 1.1) this.reset(false);

      // Drift control points organically
      this.tcp1x += Math.sin(t * this.morphSpeed + this.phase) * 0.4;
      this.tcp1y += Math.cos(t * this.morphSpeed * 1.3 + this.phase) * 0.3;
      this.tcp2x += Math.cos(t * this.morphSpeed * 0.8 + this.phase + 1) * 0.4;
      this.tcp2y += Math.sin(t * this.morphSpeed * 1.1 + this.phase + 2) * 0.3;

      // Clamp control points to canvas bounds
      this.tcp1x = clamp(this.tcp1x, 0, W);
      this.tcp1y = clamp(this.tcp1y, 0, H);
      this.tcp2x = clamp(this.tcp2x, 0, W);
      this.tcp2y = clamp(this.tcp2y, 0, H);

      // Smooth lerp toward targets
      this.cp1x = lerp(this.cp1x, this.tcp1x, 0.008);
      this.cp1y = lerp(this.cp1y, this.tcp1y, 0.008);
      this.cp2x = lerp(this.cp2x, this.tcp2x, 0.008);
      this.cp2y = lerp(this.cp2y, this.tcp2y, 0.008);

      // Mouse distortion — cursor pushes streams
      if (isMouseInHero && mouseX > -400) {
        const influence = 180;
        // Distort CP1
        const d1x = mouseX - this.cp1x, d1y = mouseY - this.cp1y;
        const dist1 = Math.hypot(d1x, d1y) + 1;
        if (dist1 < influence) {
          const force = (influence - dist1) / influence;
          this.cp1x -= (d1x / dist1) * force * 25;
          this.cp1y -= (d1y / dist1) * force * 25;
        }
        // Distort CP2
        const d2x = mouseX - this.cp2x, d2y = mouseY - this.cp2y;
        const dist2 = Math.hypot(d2x, d2y) + 1;
        if (dist2 < influence) {
          const force = (influence - dist2) / influence;
          this.cp2x -= (d2x / dist2) * force * 25;
          this.cp2y -= (d2y / dist2) * force * 25;
        }
        // Velocity ripple
        this.cp1x += velX * 0.06; this.cp1y += velY * 0.06;
        this.cp2x += velX * 0.04; this.cp2y += velY * 0.04;
      }

      // Scroll shifts streams vertically
      this.cp1y -= scrollY2 * 0.0008;
      this.cp2y -= scrollY2 * 0.0008;
    }

    // Get point on bezier curve at t
    bezierPoint(t2) {
      const mt = 1 - t2;
      return {
        x: mt*mt*mt*this.startX + 3*mt*mt*t2*this.cp1x + 3*mt*t2*t2*this.cp2x + t2*t2*t2*this.endX,
        y: mt*mt*mt*this.startY + 3*mt*mt*t2*this.cp1y + 3*mt*t2*t2*this.cp2y + t2*t2*t2*this.endY,
      };
    }

    // Get tangent direction at t
    bezierTangent(t2) {
      const mt = 1 - t2;
      const dx = 3*mt*mt*(this.cp1x-this.startX) + 6*mt*t2*(this.cp2x-this.cp1x) + 3*t2*t2*(this.endX-this.cp2x);
      const dy = 3*mt*mt*(this.cp1y-this.startY) + 6*mt*t2*(this.cp2y-this.cp1y) + 3*t2*t2*(this.endY-this.cp2y);
      const len = Math.hypot(dx, dy) + 0.001;
      return { nx: -dy/len, ny: dx/len }; // normal (perpendicular)
    }

    draw(t) {
      // Life-based fade in/out
      const fadeIn = clamp(this.life * 4, 0, 1);
      const fadeOut = clamp((1 - this.life) * 3, 0, 1);
      const fade = fadeIn * fadeOut;
      if (fade < 0.01) return;

      const { dark, mid, bright, shine } = this.colors;
      const STEPS = 80; // Resolution of the ribbon
      const halfW = this.width / 2;

      // ── Draw the ribbon as a series of trapezoids ──
      // Each segment has top edge (edge1) and bottom edge (edge2)
      // with proper 3D shading: dark at edges, bright at top-center

      ctx.save();

      // Use a path for the whole ribbon
      const topEdge = [], bottomEdge = [];

      for (let i = 0; i <= STEPS; i++) {
        const tt = i / STEPS;
        const pt = this.bezierPoint(tt);
        const { nx, ny } = this.bezierTangent(tt);

        // Vary width along the stream (tapers at ends, swells in middle)
        const widthMod = Math.sin(tt * Math.PI) * 0.4 + 0.6;
        const w = halfW * widthMod;

        topEdge.push({ x: pt.x + nx * w, y: pt.y + ny * w });
        bottomEdge.push({ x: pt.x - nx * w, y: pt.y - ny * w });
      }

      // ── LAYER 1: Dark base (shadow/depth) ──
      ctx.beginPath();
      ctx.moveTo(topEdge[0].x, topEdge[0].y);
      for (let i = 1; i <= STEPS; i++) ctx.lineTo(topEdge[i].x, topEdge[i].y);
      for (let i = STEPS; i >= 0; i--) ctx.lineTo(bottomEdge[i].x, bottomEdge[i].y);
      ctx.closePath();

      // Get approximate center of stream for gradient
      const midPt = this.bezierPoint(0.5);
      const { nx: mnx, ny: mny } = this.bezierTangent(0.5);
      const gx1 = midPt.x + mnx * halfW, gy1 = midPt.y + mny * halfW;
      const gx2 = midPt.x - mnx * halfW, gy2 = midPt.y - mny * halfW;

      // Cross-stream gradient (dark→bright→dark = 3D cylinder look)
      try {
        const ribbonGrad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
        const [dr, dg, db] = dark;
        const [mr, mg, mb] = mid;
        const [br2, bg2, bb2] = bright;
        const [sr, sg, sb] = shine;
        const a = this.alpha * fade;

        ribbonGrad.addColorStop(0,    `rgba(${dr},${dg},${db},${a * 0.7})`);
        ribbonGrad.addColorStop(0.15, `rgba(${mr},${mg},${mb},${a * 0.92})`);
        ribbonGrad.addColorStop(0.35, `rgba(${br2},${bg2},${bb2},${a})`);
        ribbonGrad.addColorStop(0.5,  `rgba(${sr},${sg},${sb},${a})`);     // top specular
        ribbonGrad.addColorStop(0.65, `rgba(${br2},${bg2},${bb2},${a})`);
        ribbonGrad.addColorStop(0.85, `rgba(${mr},${mg},${mb},${a * 0.88})`);
        ribbonGrad.addColorStop(1,    `rgba(${dr},${dg},${db},${a * 0.65})`);

        ctx.fillStyle = ribbonGrad;
        ctx.fill();
      } catch(e) {
        ctx.fillStyle = `rgba(201,152,42,${this.alpha * fade * 0.7})`;
        ctx.fill();
      }

      // ── LAYER 2: Specular highlight stripe (top of 3D form) ──
      ctx.beginPath();
      // Draw a thin highlight along the top-third of the ribbon
      const highlightEdge1 = [], highlightEdge2 = [];
      for (let i = 0; i <= STEPS; i++) {
        const tt = i / STEPS;
        const pt = this.bezierPoint(tt);
        const { nx: tnx, ny: tny } = this.bezierTangent(tt);
        const widthMod = Math.sin(tt * Math.PI) * 0.35 + 0.65;
        const w = halfW * widthMod;
        const shineOffset = w * 0.18;
        const shineWidth  = w * 0.22;
        highlightEdge1.push({ x: pt.x + tnx * (shineOffset + shineWidth), y: pt.y + tny * (shineOffset + shineWidth) });
        highlightEdge2.push({ x: pt.x + tnx * shineOffset, y: pt.y + tny * shineOffset });
      }
      ctx.moveTo(highlightEdge1[0].x, highlightEdge1[0].y);
      for (let i = 1; i <= STEPS; i++) ctx.lineTo(highlightEdge1[i].x, highlightEdge1[i].y);
      for (let i = STEPS; i >= 0; i--) ctx.lineTo(highlightEdge2[i].x, highlightEdge2[i].y);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,252,220,${this.alpha * fade * 0.55})`;
      ctx.fill();

      // ── LAYER 3: Inner shadow (bottom of 3D form = concavity) ──
      ctx.beginPath();
      const shadowEdge1 = [], shadowEdge2 = [];
      for (let i = 0; i <= STEPS; i++) {
        const tt = i / STEPS;
        const pt = this.bezierPoint(tt);
        const { nx: snx, ny: sny } = this.bezierTangent(tt);
        const widthMod = Math.sin(tt * Math.PI) * 0.35 + 0.65;
        const w = halfW * widthMod;
        shadowEdge1.push({ x: pt.x - snx * w * 0.15, y: pt.y - sny * w * 0.15 });
        shadowEdge2.push({ x: pt.x - snx * w * 0.45, y: pt.y - sny * w * 0.45 });
      }
      ctx.moveTo(shadowEdge1[0].x, shadowEdge1[0].y);
      for (let i = 1; i <= STEPS; i++) ctx.lineTo(shadowEdge1[i].x, shadowEdge1[i].y);
      for (let i = STEPS; i >= 0; i--) ctx.lineTo(shadowEdge2[i].x, shadowEdge2[i].y);
      ctx.closePath();
      ctx.fillStyle = `rgba(140,95,10,${this.alpha * fade * 0.28})`;
      ctx.fill();

      ctx.restore();
    }
  }

  // ══════════════════════════════
  // DROPLETS — gold paint drops that fly off streams
  // ══════════════════════════════
  class GoldDroplet {
    constructor() { this.reset(); }
    reset() {
      this.x = rand(0, W); this.y = rand(0, H);
      this.vx = rand(-0.4, 0.4); this.vy = rand(-0.2, 0.3);
      this.r = rand(1.5, 8);
      this.alpha = rand(0.3, 0.85);
      this.isEllipse = Math.random() < 0.4; // elongated splatter drops
      this.rotation = rand(0, Math.PI * 2);
      this.goldVariant = randInt(0, 3);
      this.twinkle = rand(0.01, 0.04);
      this.phase = rand(0, Math.PI * 2);
      this.tail = this.isEllipse ? rand(1.5, 4) : 1; // elongation
    }
    update(t) {
      this.x += this.vx + velX * 0.015;
      this.y += this.vy + velY * 0.015 - scrollY2 * 0.00008;
      if (this.x < -20 || this.x > W + 20 || this.y < -20 || this.y > H + 20) this.reset();
    }
    draw(t) {
      const goldPalette = [
        [201,152,42], [240,200,74], [180,130,30], [225,175,55]
      ][this.goldVariant];
      const [r, g, b] = goldPalette;
      const pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * this.twinkle + this.phase));
      const a = this.alpha * pulse;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      // Inner gradient for 3D sphere/drop look
      const grd = ctx.createRadialGradient(-this.r * 0.25, -this.r * 0.25, 0, 0, 0, this.r * this.tail);
      grd.addColorStop(0, `rgba(255,248,200,${a})`);           // bright specular
      grd.addColorStop(0.25,`rgba(${r+30},${g+30},${b+20},${a * 0.95})`); // bright gold
      grd.addColorStop(0.6, `rgba(${r},${g},${b},${a * 0.85})`);       // mid gold
      grd.addColorStop(0.85,`rgba(${r-30},${g-35},${b-15},${a * 0.7})`);// dark gold
      grd.addColorStop(1,   `rgba(${r-40},${g-50},${b-20},0)`);         // transparent edge

      ctx.fillStyle = grd;
      ctx.shadowColor = `rgba(${r},${g},${b},0.4)`;
      ctx.shadowBlur = this.r * 2;

      if (this.isEllipse) {
        ctx.scale(this.tail, 1);
        ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ══════════════════════════════
  // SPLASH BURST — cursor creates splashes
  // ══════════════════════════════
  let splashParticles = [];
  class SplashParticle {
    constructor(x, y) {
      const a = rand(0, Math.PI * 2), spd = rand(2, 12);
      this.x = x; this.y = y;
      this.vx = Math.cos(a) * spd + velX * 0.5;
      this.vy = Math.sin(a) * spd + velY * 0.5;
      this.r = rand(1, 5); this.life = 1;
      this.decay = rand(0.025, 0.06);
      const c = [[201,152,42],[240,200,74],[255,245,180],[180,130,30]][randInt(0,3)];
      this.col = `rgb(${c[0]},${c[1]},${c[2]})`;
    }
    update() { this.x+=this.vx; this.y+=this.vy; this.vy+=0.15; this.vx*=0.96; this.life-=this.decay; }
    draw() {
      ctx.save(); ctx.globalAlpha=Math.max(0,this.life);
      ctx.fillStyle=this.col; ctx.shadowColor=this.col; ctx.shadowBlur=this.r*3;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r*this.life,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  // Mouse move creates splash
  let lastSplashTime = 0;
  if (hero) {
    hero.addEventListener('mousemove', e => {
      const now = performance.now();
      const speed = Math.hypot(velX, velY);
      if (speed > 8 && now - lastSplashTime > 80) {
        lastSplashTime = now;
        for (let i = 0; i < Math.min(speed * 0.5, 8); i++) {
          splashParticles.push(new SplashParticle(e.clientX, e.clientY));
        }
      }
    });
  }

  // ══════════════════════════════
  // GOLD GLITTER STARS
  // ══════════════════════════════
  const glitters = Array.from({ length: 200 }, () => ({
    x: rand(0, 2000), y: rand(0, 1500),
    vx: rand(-0.1, 0.1), vy: rand(-0.08, 0.08),
    r: rand(0.5, 2.4), alpha: rand(0.2, 0.9),
    tw: rand(0.012, 0.055), ph: rand(0, Math.PI * 2),
    col: ['#C9982A','#F0C84A','#F7E08A','#FFF8DC','#fff'][randInt(0, 4)],
    isStar: Math.random() < 0.42,
  }));

  function drawGlitter(t, c) {
    glitters.forEach(g => {
      g.x += g.vx; g.y += g.vy;
      if (g.x < 0) g.x = W; if (g.x > W) g.x = 0;
      if (g.y < 0) g.y = H; if (g.y > H) g.y = 0;
      const a = g.alpha * (0.3 + 0.7 * Math.abs(Math.sin(t * g.tw + g.ph)));
      c.save(); c.globalAlpha = a;
      if (g.isStar) {
        c.strokeStyle = g.col; c.lineWidth = g.r * 0.6;
        c.shadowColor = g.col; c.shadowBlur = g.r * 5;
        const s = g.r * 2.8;
        c.beginPath();
        c.moveTo(g.x-s,g.y); c.lineTo(g.x+s,g.y);
        c.moveTo(g.x,g.y-s); c.lineTo(g.x,g.y+s);
        c.moveTo(g.x-s*.65,g.y-s*.65); c.lineTo(g.x+s*.65,g.y+s*.65);
        c.moveTo(g.x+s*.65,g.y-s*.65); c.lineTo(g.x-s*.65,g.y+s*.65);
        c.stroke();
      } else {
        c.fillStyle = g.col; c.shadowColor = g.col; c.shadowBlur = g.r * 4;
        c.beginPath(); c.arc(g.x, g.y, g.r, 0, Math.PI*2); c.fill();
      }
      c.restore();
    });
  }

  // Build scene objects
  let streams = [], droplets = [];
  function buildStreams() {
    streams = Array.from({ length: 7 }, (_, i) => new GoldStream(i, 7));
    // Stagger their life so they don't all appear at once
    streams.forEach((s, i) => { s.life = (i / 7) * 0.8; });
  }
  function buildDroplets() {
    droplets = Array.from({ length: 80 }, () => new GoldDroplet());
  }
  buildStreams(); buildDroplets();

  // ══════════════════════════════
  // MAIN RENDER LOOP
  // ══════════════════════════════
  function animGold(t) {
    ctx.clearRect(0, 0, W, H);

    // ── Warm white background (cream, no black) ──
    const bgGrd = ctx.createRadialGradient(W*0.4, H*0.35, 0, W*0.5, H*0.5, Math.max(W,H));
    bgGrd.addColorStop(0,   '#FEFCF7');
    bgGrd.addColorStop(0.5, '#FAF6EE');
    bgGrd.addColorStop(1,   '#F4EEE0');
    ctx.fillStyle = bgGrd;
    ctx.fillRect(0, 0, W, H);

    // ── Subtle warm glow zones ──
    // These add richness to the background between streams
    const zones = [
      { x: W*0.25, y: H*0.3,  r: W*0.35, c: 'rgba(247,224,138,0.08)' },
      { x: W*0.75, y: H*0.65, r: W*0.3,  c: 'rgba(240,200,74,0.06)'  },
      { x: W*0.5,  y: H*0.5,  r: W*0.4,  c: 'rgba(255,248,200,0.05)' },
    ];
    zones.forEach(z => {
      const zg = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r);
      zg.addColorStop(0, z.c); zg.addColorStop(1, 'rgba(247,224,138,0)');
      ctx.fillStyle = zg; ctx.fillRect(0, 0, W, H);
    });

    // ── Draw droplets (behind streams) ──
    droplets.forEach(d => { d.update(t); d.draw(t); });

    // ── Draw gold streams (main feature) ──
    // Sort by width so thinner ones draw on top (depth feel)
    const sorted = [...streams].sort((a, b) => b.width - a.width);
    sorted.forEach(s => { s.update(t); s.draw(t); });

    // ── Draw splash particles ──
    splashParticles = splashParticles.filter(p => p.life > 0);
    splashParticles.forEach(p => { p.update(); p.draw(); });

    requestAnimationFrame(animGold);
  }
  requestAnimationFrame(animGold);

  // Glitter on separate canvas for performance
  if (gCtx) {
    function animGlitter(t) {
      gCtx.clearRect(0, 0, W, H);
      drawGlitter(t, gCtx);
      requestAnimationFrame(animGlitter);
    }
    requestAnimationFrame(animGlitter);
  }
})();

// ─────────────────────────────────────
// 3. DRAMATIC LOGO INTERACTION
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

  class Particle {
    constructor(cx,cy,burst){
      const a=rand(0,Math.PI*2),spd=burst?rand(3,11):rand(0.4,1.8);
      this.x=cx;this.y=cy;this.vx=Math.cos(a)*spd;this.vy=Math.sin(a)*spd;
      this.r=burst?rand(2,6):rand(1,2.5);this.life=1;
      this.decay=burst?rand(0.02,0.055):rand(0.008,0.022);
      this.col=['#C9982A','#F0C84A','#F7E08A','#fff','#FDF5D8'][randInt(0,4)];
      this.star=Math.random()<0.45;
    }
    update(){this.x+=this.vx;this.y+=this.vy;this.vy+=0.07;this.vx*=0.97;this.life-=this.decay;}
    draw(){
      pCtx.save();pCtx.globalAlpha=Math.max(0,this.life);pCtx.fillStyle=this.col;pCtx.strokeStyle=this.col;pCtx.shadowColor=this.col;pCtx.shadowBlur=this.r*5;
      if(this.star){pCtx.lineWidth=1;const s=this.r*2.5;pCtx.beginPath();pCtx.moveTo(this.x-s,this.y);pCtx.lineTo(this.x+s,this.y);pCtx.moveTo(this.x,this.y-s);pCtx.lineTo(this.x,this.y+s);pCtx.stroke();}
      else{pCtx.beginPath();pCtx.arc(this.x,this.y,this.r,0,Math.PI*2);pCtx.fill();}
      pCtx.restore();
    }
  }

  function burst(cx,cy,n){for(let i=0;i<n;i++)parts.push(new Particle(cx,cy,true));}
  function animParts(){
    pCtx.clearRect(0,0,pc.width,pc.height);
    parts=parts.filter(p=>p.life>0);
    parts.forEach(p=>{p.update();p.draw();});
    if(isHovering&&Math.random()<0.4)parts.push(new Particle(pc.width/2+rand(-90,90),pc.height/2+rand(-90,90),false));
    requestAnimationFrame(animParts);
  }
  animParts();

  hero.addEventListener('mousemove',e=>{
    const r=hero.getBoundingClientRect();
    tRY=((e.clientX-r.left-r.width/2)/r.width)*38;
    tRX=-((e.clientY-r.top-r.height/2)/r.height)*30;
    tScale=1.09;
  });
  hero.addEventListener('mouseleave',()=>{tRX=0;tRY=0;tScale=1;isHovering=false;targetGlow=0;});
  logo3d.addEventListener('mouseenter',()=>{isHovering=true;targetGlow=1;});
  logo3d.addEventListener('mouseleave',()=>{isHovering=false;targetGlow=0;});
  logo3d.addEventListener('click',()=>{burst(pc.width/2,pc.height/2,55);tScale=1.2;setTimeout(()=>{tScale=isHovering?1.09:1;},280);});

  function animTilt(){
    cRX=lerp(cRX,tRX,0.052);cRY=lerp(cRY,tRY,0.052);cScale=lerp(cScale,tScale,0.06);glowI=lerp(glowI,targetGlow,0.055);
    logo3d.style.transform=`perspective(900px) rotateX(${cRX}deg) rotateY(${cRY}deg) scale(${cScale})`;
    if(logoImg){
      const g=glowI;
      logoImg.style.filter=`drop-shadow(0 ${8+g*24}px ${30+g*55}px rgba(201,152,42,${0.48+g*0.42})) drop-shadow(0 0 ${55+g*90}px rgba(201,152,42,${0.22+g*0.48})) drop-shadow(0 0 ${g*50}px rgba(240,200,74,${g*0.65})) drop-shadow(0 0 ${g*20}px rgba(255,255,200,${g*0.4}))`;
    }
    requestAnimationFrame(animTilt);
  }
  animTilt();
})();

// ─────────────────────────────────────
// 4-14. ALL OTHER SYSTEMS (unchanged from v4)
// ─────────────────────────────────────

// Portfolio Filter
(function(){
  const btns=$$('.pf-btn'),cards=$$('.port-card');
  btns.forEach(btn=>{btn.addEventListener('click',()=>{btns.forEach(b=>b.classList.remove('active'));btn.classList.add('active');const f=btn.dataset.filter;cards.forEach(card=>{const match=f==='all'||card.dataset.category===f;card.style.display=match?'':'none';if(match){card.classList.remove('vis');void card.offsetHeight;card.classList.add('vis');}});});});
})();

// Lightbox
(function(){
  const lb=$('#lightbox'),lbImg=$('#lb-img'),lbCat=$('#lb-cat'),lbTitle=$('#lb-title');
  const lbClose=$('#lb-close'),lbBackdrop=$('#lb-backdrop'),lbPrev=$('#lb-prev'),lbNext=$('#lb-next');
  if(!lb)return;
  const items=$$('.gallery-item');let current=0;
  function openLb(idx){current=idx;const item=items[idx];lbImg.src=item.dataset.img;lbCat.textContent=item.dataset.cat;lbTitle.textContent=item.dataset.title;lb.classList.add('open');document.body.style.overflow='hidden';lbPrev.style.display=items.length>1?'flex':'none';lbNext.style.display=items.length>1?'flex':'none';}
  function closeLb(){lb.classList.remove('open');document.body.style.overflow='';setTimeout(()=>{lbImg.src='';},350);}
  items.forEach((item,idx)=>item.addEventListener('click',()=>openLb(idx)));
  lbClose.addEventListener('click',closeLb);lbBackdrop.addEventListener('click',closeLb);
  lbPrev.addEventListener('click',e=>{e.stopPropagation();current=(current-1+items.length)%items.length;openLb(current);});
  lbNext.addEventListener('click',e=>{e.stopPropagation();current=(current+1)%items.length;openLb(current);});
  document.addEventListener('keydown',e=>{if(!lb.classList.contains('open'))return;if(e.key==='Escape')closeLb();if(e.key==='ArrowLeft'){current=(current-1+items.length)%items.length;openLb(current);}if(e.key==='ArrowRight'){current=(current+1)%items.length;openLb(current);}});
})();

// Why Canvas
(function(){
  const canvas=$('#why-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;
  const COLS=['#C9982A','#F0C84A','#2A8B8B','#C4748A','#7B4FA0','#F7E08A','#fff'];
  const strokes=Array.from({length:14},()=>({cx:rand(50,W-50),cy:rand(50,H-50),r:rand(28,95),col:COLS[randInt(0,COLS.length-1)],speed:rand(0.003,0.013),phase:rand(0,Math.PI*2),alpha:rand(0.05,0.17),sw:rand(6,28)}));
  function animWhy(t){
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#FEF9EC';ctx.fillRect(0,0,W,H);
    for(let i=3;i>=1;i--){ctx.save();ctx.strokeStyle=`rgba(201,152,42,${0.08/i})`;ctx.lineWidth=1;ctx.beginPath();ctx.arc(W/2,H/2,60*i,0,Math.PI*2);ctx.stroke();ctx.restore();}
    strokes.forEach(s=>{const a=t*s.speed+s.phase,x1=s.cx+Math.cos(a)*s.r,y1=s.cy+Math.sin(a)*s.r,x2=s.cx+Math.cos(a+0.6)*s.r,y2=s.cy+Math.sin(a+0.6)*s.r;ctx.save();ctx.globalAlpha=s.alpha;ctx.strokeStyle=s.col;ctx.lineWidth=s.sw;ctx.lineCap='round';ctx.shadowColor=s.col;ctx.shadowBlur=s.sw*0.4;ctx.beginPath();ctx.moveTo(x1,y1);ctx.quadraticCurveTo(s.cx,s.cy,x2,y2);ctx.stroke();ctx.restore();});
    const size=80+Math.sin(t*0.001)*8;ctx.save();ctx.translate(W/2,H/2);ctx.rotate(t*0.0005);
    ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(size*0.7,0);ctx.lineTo(0,size);ctx.lineTo(-size*0.7,0);ctx.closePath();ctx.strokeStyle='rgba(201,152,42,0.5)';ctx.lineWidth=2;ctx.stroke();
    ctx.font="bold 22px 'Cinzel',serif";ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(201,152,42,0.9)';ctx.shadowColor='rgba(201,152,42,0.5)';ctx.shadowBlur=12;ctx.fillText('LLC',0,-10);
    ctx.font="10px 'Raleway',sans-serif";ctx.fillStyle='rgba(30,24,16,0.5)';ctx.shadowBlur=0;ctx.fillText('EST. 2023',0,14);ctx.restore();
    requestAnimationFrame(animWhy);
  }
  requestAnimationFrame(animWhy);
})();

// Interactive Paint Canvas
(function(){
  const canvas=$('#user-paint-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  canvas.width=canvas.offsetWidth;canvas.height=420;
  let painting=false,lastX=0,lastY=0,currentColor='#C9982A',brushSize=12,isSplatter=false;
  ctx.fillStyle='#FEFCF7';ctx.fillRect(0,0,canvas.width,canvas.height);
  function getPos(e){const rect=canvas.getBoundingClientRect(),sx=canvas.width/rect.width,sy=canvas.height/rect.height;if(e.touches)return{x:(e.touches[0].clientX-rect.left)*sx,y:(e.touches[0].clientY-rect.top)*sy};return{x:(e.clientX-rect.left)*sx,y:(e.clientY-rect.top)*sy};}
  function paintStroke(x,y,px,py){ctx.save();ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.strokeStyle=currentColor;ctx.lineWidth=brushSize;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor=currentColor;ctx.shadowBlur=brushSize*0.5;ctx.globalAlpha=0.82;ctx.stroke();ctx.restore();}
  function splatter(x,y){for(let i=0;i<randInt(8,22);i++){const a=rand(0,Math.PI*2),d=rand(5,90),ex=x+Math.cos(a)*d,ey=y+Math.sin(a)*d,dr=rand(2,brushSize*.65);ctx.save();ctx.globalAlpha=rand(0.4,0.9);ctx.fillStyle=currentColor;ctx.beginPath();ctx.arc(ex,ey,dr,0,Math.PI*2);ctx.fill();ctx.restore();}}
  canvas.addEventListener('mousedown',e=>{painting=true;const p=getPos(e);lastX=p.x;lastY=p.y;if(isSplatter)splatter(p.x,p.y);});
  canvas.addEventListener('mousemove',e=>{if(!painting)return;const p=getPos(e);if(!isSplatter)paintStroke(p.x,p.y,lastX,lastY);lastX=p.x;lastY=p.y;});
  canvas.addEventListener('mouseup',()=>painting=false);canvas.addEventListener('mouseleave',()=>painting=false);
  canvas.addEventListener('touchstart',e=>{e.preventDefault();painting=true;const p=getPos(e);lastX=p.x;lastY=p.y;if(isSplatter)splatter(p.x,p.y);},{passive:false});
  canvas.addEventListener('touchmove',e=>{e.preventDefault();if(!painting)return;const p=getPos(e);if(!isSplatter)paintStroke(p.x,p.y,lastX,lastY);lastX=p.x;lastY=p.y;},{passive:false});
  canvas.addEventListener('touchend',()=>painting=false);
  $$('.pz-btn').forEach(btn=>{btn.addEventListener('click',()=>{$$('.pz-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');if(btn.id==='clear-canvas-btn'){ctx.fillStyle='#FEFCF7';ctx.fillRect(0,0,canvas.width,canvas.height);isSplatter=false;return;}if(btn.id==='splatter-btn'){isSplatter=true;if(btn.dataset.color)currentColor=btn.dataset.color;return;}isSplatter=false;if(btn.dataset.color)currentColor=btn.dataset.color;if(btn.dataset.size)brushSize=parseInt(btn.dataset.size);});});
})();

// Tetris
(function(){
  const canvas=$('#tetris-canvas'),nextCanvas=$('#next-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d'),nCtx=nextCanvas.getContext('2d');
  const overlay=$('#game-overlay'),modal=$('#game-modal');
  const COLS=10,ROWS=20,BLOCK=canvas.width/COLS;
  const COLORS=[null,'#C9982A','#F0C84A','#2A8B8B','#C4748A','#7B4FA0','#3A6FA8','#E8703A'];
  const SHAPES=[null,[[1,1,1,1]],[[2,2],[2,2]],[[0,3,0],[3,3,3]],[[0,4,4],[4,4,0]],[[5,5,0],[0,5,5]],[[6,0,0],[6,6,6]],[[0,0,7],[7,7,7]]];
  let board,score,level,lines,best=0,cur,nxt,running=false,paused=false,dropTimer=0,lastTime=0,dropInterval=800,animId;
  function makeBoard(){return Array.from({length:ROWS},()=>new Array(COLS).fill(0));}
  function randPiece(){const t=randInt(1,7),shape=SHAPES[t].map(r=>[...r]);return{type:t,shape,x:Math.floor(COLS/2)-Math.floor(shape[0].length/2),y:0};}
  function rotate(s){const r=s.length,c=s[0].length,res=Array.from({length:c},()=>new Array(r).fill(0));for(let i=0;i<r;i++)for(let j=0;j<c;j++)res[j][r-1-i]=s[i][j];return res;}
  function valid(p,dx=0,dy=0,sh=p.shape){for(let r=0;r<sh.length;r++)for(let c=0;c<sh[r].length;c++){if(!sh[r][c])continue;const nx=p.x+c+dx,ny=p.y+r+dy;if(nx<0||nx>=COLS||ny>=ROWS)return false;if(ny>=0&&board[ny][nx])return false;}return true;}
  function merge(){cur.shape.forEach((row,r)=>row.forEach((v,c)=>{if(v)board[cur.y+r][cur.x+c]=v;}));}
  function clearLines(){let cl=0;for(let r=ROWS-1;r>=0;r--){if(board[r].every(c=>c)){board.splice(r,1);board.unshift(new Array(COLS).fill(0));cl++;r++;}}if(cl){score+=[0,100,300,500,800][cl]*level;lines+=cl;level=Math.floor(lines/10)+1;dropInterval=Math.max(80,800-(level-1)*70);updateUI();}}
  function hardDrop(){while(valid(cur,0,1)){cur.y++;score+=2;}lock();}
  function lock(){merge();clearLines();cur=nxt;nxt=randPiece();drawNext();if(!valid(cur))endGame();}
  function updateUI(){$('#t-score').textContent=score;$('#t-level').textContent=level;$('#t-lines').textContent=lines;if(score>best){best=score;$('#t-best').textContent=best;try{localStorage.setItem('ll_best',best);}catch(e){}}}
  function endGame(){running=false;cancelAnimationFrame(animId);$('#pause-tetris').style.display='none';$('#restart-tetris').style.display='none';$('#gm-score').textContent=score;$('#gm-best').textContent=best;$('#gm-title').textContent=score>500?'🏆 Legendary!':score>200?'🎨 Creative!':'✨ Keep Going!';modal.style.display='flex';}
  function drawBlock(c,x,y,type,size=BLOCK){if(!type)return;const col=COLORS[type],bx=x*size,by=y*size,s=size-1;c.fillStyle=col;c.fillRect(bx+1,by+1,s-1,s-1);c.fillStyle='rgba(255,255,255,0.28)';c.fillRect(bx+1,by+1,s-1,3);c.fillRect(bx+1,by+1,3,s-1);c.fillStyle='rgba(0,0,0,0.22)';c.fillRect(bx+s-2,by+2,2,s-2);c.fillRect(bx+2,by+s-2,s-2,2);}
  function drawGhost(){let gy=cur.y;while(valid(cur,0,gy-cur.y+1))gy++;if(gy===cur.y)return;cur.shape.forEach((row,r)=>row.forEach((v,c2)=>{if(!v)return;ctx.save();ctx.globalAlpha=0.18;ctx.strokeStyle=COLORS[v];ctx.lineWidth=2;ctx.strokeRect((cur.x+c2)*BLOCK+2,(gy+r)*BLOCK+2,BLOCK-4,BLOCK-4);ctx.restore();}));}
  function draw(){const bg=ctx.createLinearGradient(0,0,0,canvas.height);bg.addColorStop(0,'#FEF9EC');bg.addColorStop(1,'#FAF6EE');ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='rgba(201,152,42,0.07)';ctx.lineWidth=0.5;for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)ctx.strokeRect(c*BLOCK,r*BLOCK,BLOCK,BLOCK);for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(board[r][c])drawBlock(ctx,c,r,board[r][c]);if(cur){drawGhost();cur.shape.forEach((row,r)=>row.forEach((v,c)=>{if(v)drawBlock(ctx,cur.x+c,cur.y+r,v);}));}if(paused){ctx.fillStyle='rgba(253,245,216,0.88)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#C9982A';ctx.font="bold 24px 'Cinzel',serif";ctx.textAlign='center';ctx.fillText('PAUSED',canvas.width/2,canvas.height/2);}}
  function drawNext(){nCtx.fillStyle='#FAF6EE';nCtx.fillRect(0,0,100,100);if(!nxt)return;const bS=18,ox=Math.floor((100-nxt.shape[0].length*bS)/2),oy=Math.floor((100-nxt.shape.length*bS)/2);nxt.shape.forEach((row,r)=>row.forEach((v,c)=>{if(!v)return;nCtx.fillStyle=COLORS[v];nCtx.fillRect(ox+c*bS+1,oy+r*bS+1,bS-2,bS-2);}));}
  function gameLoop(t){if(!running||paused){draw();return;}const dt=t-lastTime;lastTime=t;dropTimer+=dt;if(dropTimer>=dropInterval){dropTimer=0;valid(cur,0,1)?cur.y++:lock();}draw();animId=requestAnimationFrame(gameLoop);}
  function start(){board=makeBoard();score=0;level=1;lines=0;dropTimer=0;dropInterval=800;try{best=parseInt(localStorage.getItem('ll_best'))||0;}catch(e){best=0;}cur=randPiece();nxt=randPiece();drawNext();updateUI();running=true;paused=false;overlay.style.display='none';modal.style.display='none';$('#pause-tetris').style.display='block';$('#restart-tetris').style.display='block';lastTime=performance.now();cancelAnimationFrame(animId);animId=requestAnimationFrame(gameLoop);}
  document.addEventListener('keydown',e=>{if(!running)return;switch(e.key){case'ArrowLeft':case'a':case'A':if(valid(cur,-1,0))cur.x--;e.preventDefault();break;case'ArrowRight':case'd':case'D':if(valid(cur,1,0))cur.x++;e.preventDefault();break;case'ArrowDown':case's':case'S':if(valid(cur,0,1)){cur.y++;score++;}e.preventDefault();break;case'ArrowUp':case'w':case'W':{const rot=rotate(cur.shape);if(valid(cur,0,0,rot))cur.shape=rot;e.preventDefault();break;}case' ':hardDrop();e.preventDefault();break;case'p':case'P':paused=!paused;$('#pause-tetris').textContent=paused?'Resume':'Pause';if(!paused){lastTime=performance.now();animId=requestAnimationFrame(gameLoop);}break;}});
  let tSX=0,tSY=0;
  canvas.addEventListener('touchstart',e=>{tSX=e.touches[0].clientX;tSY=e.touches[0].clientY;e.preventDefault();},{passive:false});
  canvas.addEventListener('touchend',e=>{if(!running)return;const dx=e.changedTouches[0].clientX-tSX,dy=e.changedTouches[0].clientY-tSY;if(Math.abs(dx)<10&&Math.abs(dy)<10){const r=rotate(cur.shape);if(valid(cur,0,0,r))cur.shape=r;}else if(Math.abs(dx)>Math.abs(dy)){if(dx>0&&valid(cur,1,0))cur.x++;else if(dx<0&&valid(cur,-1,0))cur.x--;}else if(dy>30)hardDrop();e.preventDefault();},{passive:false});
  $('#start-tetris').addEventListener('click',start);
  $('#pause-tetris').addEventListener('click',()=>{paused=!paused;$('#pause-tetris').textContent=paused?'Resume':'Pause';if(!paused){lastTime=performance.now();animId=requestAnimationFrame(gameLoop);}});
  $('#restart-tetris').addEventListener('click',start);
  $('#gm-restart').addEventListener('click',start);
  $('#gm-close').addEventListener('click',()=>{modal.style.display='none';});
  board=makeBoard();cur=randPiece();nxt=randPiece();draw();drawNext();
})();

// Scroll Reveal + Navbar
(function(){
  const els=$$('.reveal');
  els.forEach(el=>new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('vis');});},{threshold:0.08}).observe(el));
  window.addEventListener('scroll',()=>{$('#navbar').classList.toggle('scrolled',scrollY>70);},{passive:true});
})();

// Counters
(function(){
  $$('.stat-num[data-target]').forEach(el=>{
    new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting&&!el.dataset.done){el.dataset.done='1';const t=+el.dataset.target;let c=0;const s=t/60;const id=setInterval(()=>{c=Math.min(c+s,t);el.textContent=Math.round(c);if(c>=t)clearInterval(id);},20);}});},{threshold:0.5}).observe(el);
  });
})();

// Card Tilt
(function(){
  $$('.svc-card,.price-card,[data-tilt]').forEach(card=>{
    card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/r.width,dy=(e.clientY-r.top-r.height/2)/r.height,i=card.hasAttribute('data-tilt')?12:6;card.style.transform=`perspective(900px) rotateX(${-dy*i}deg) rotateY(${dx*i}deg) translateY(-8px)`;});
    card.addEventListener('mouseleave',()=>card.style.transform='');
  });
  $$('.port-card').forEach(card=>{
    card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/r.width,dy=(e.clientY-r.top-r.height/2)/r.height,bg=card.querySelector('.port-bg');if(bg)bg.style.transform=`scale(1.07) translate(${dx*14}px,${dy*10}px)`;});
    card.addEventListener('mouseleave',()=>{const bg=card.querySelector('.port-bg');if(bg)bg.style.transform='';});
  });
  $$('.svc-card').forEach(card=>{
    const splash=card.querySelector('.svc-splash'),col=card.dataset.color||'#C9982A';
    if(!splash)return;
    card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect(),x=((e.clientX-r.left)/r.width*100).toFixed(1),y=((e.clientY-r.top)/r.height*100).toFixed(1);splash.style.background=`radial-gradient(circle at ${x}% ${y}%, ${col}1A, transparent 65%)`;});
  });
})();

// Menu
(function(){
  const toggle=$('#menu-toggle'),menu=$('#fullscreen-menu'),close=$('#close-menu');
  const open=()=>{menu.classList.add('open');toggle.classList.add('active');document.body.style.overflow='hidden';};
  const closeMenu=()=>{menu.classList.remove('open');toggle.classList.remove('active');document.body.style.overflow='';};
  toggle.addEventListener('click',()=>menu.classList.contains('open')?closeMenu():open());
  close.addEventListener('click',closeMenu);
  $$('.fm-link').forEach(l=>l.addEventListener('click',closeMenu));
  menu.addEventListener('click',e=>{if(e.target===menu)closeMenu();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
})();

// Contact Form
(function(){
  const form=$('#contact-form'),success=$('#form-success');
  if(!form)return;
  form.addEventListener('submit',e=>{e.preventDefault();form.style.display='none';success.style.display='block';});
})();

// Smooth Scroll
$$('a[href^="#"]').forEach(link=>{
  link.addEventListener('click',e=>{const target=$(link.getAttribute('href'));if(!target)return;e.preventDefault();window.scrollTo({top:target.getBoundingClientRect().top+scrollY-80,behavior:'smooth'});});
});

console.log('%c🌹 Little Legacies Creative Agency', 'color:#C9982A;font-size:16px;font-family:serif;font-weight:bold');
console.log('%cWhere Vision Becomes Legacy · Est. 2023', 'color:#F0C84A;font-size:11px');
