'use strict';
// ══════════════════════════════════════
// LITTLE LEGACIES — main.js v4
// Gold & White fluid background · Clean gold cursor
// Dramatic logo · Kagehana mockup in panel 2
// ══════════════════════════════════════

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));

// ─────────────────────────────────────
// 1. CLEAN GOLD RING CURSOR
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
    inner.style.left = mx + 'px';
    inner.style.top = my + 'px';
  });

  let f = 0;
  function animCursor() {
    f++;
    ox = lerp(ox, mx, 0.1); oy = lerp(oy, my, 0.1);
    outer.style.left = ox + 'px'; outer.style.top = oy + 'px';

    if (f % 3 === 0 && mx > -100) {
      trailPts.push({ x: mx, y: my });
      if (trailPts.length > 35) trailPts.shift();
    }
    tCtx.clearRect(0, 0, trail.width, trail.height);
    for (let i = 1; i < trailPts.length; i++) {
      const p0 = trailPts[i - 1], p1 = trailPts[i], age = i / trailPts.length;
      tCtx.strokeStyle = `rgba(201,152,42,${age * 0.22})`;
      tCtx.lineWidth = age * 2.5; tCtx.lineCap = 'round';
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
// 2. FLUID PAINT BACKGROUND — Fairvue style
// Organic gold & white blobs that merge/flow like liquid
// Reacts to mouse AND scroll
// ─────────────────────────────────────
(function initFluidBackground() {
  const canvas = $('#paint-bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  let mouseX = 400, mouseY = 300, velX = 0, velY = 0;
  let prevMX = mouseX, prevMY = mouseY;
  let scrollOffset = 0;

  document.addEventListener('mousemove', e => {
    velX = e.clientX - prevMX; velY = e.clientY - prevMY;
    prevMX = mouseX; prevMY = mouseY;
    mouseX = e.clientX; mouseY = e.clientY;
  });
  window.addEventListener('scroll', () => {
    const hero = $('#hero');
    if (hero && hero.getBoundingClientRect().bottom > 0) scrollOffset = window.scrollY;
  }, { passive: true });

  // Fluid blob — organic drifting circle
  class Blob {
    constructor(i, total) {
      const a = (i / total) * Math.PI * 2 + rand(-0.3, 0.3);
      this.x = W * 0.5 + Math.cos(a) * rand(60, W * 0.45);
      this.y = H * 0.5 + Math.sin(a) * rand(40, H * 0.4);
      this.vx = rand(-0.25, 0.25); this.vy = rand(-0.2, 0.2);
      this.r = rand(100, 280);
      this.phase = rand(0, Math.PI * 2);
      this.spd = rand(0.0002, 0.0007);
      this.mi = rand(0.008, 0.03); // mouse influence
      this.isGold = Math.random() < 0.55;
      this.cp = rand(0, Math.PI * 2); // color phase
    }
    update(t) {
      // Organic drift using sine waves
      this.vx += Math.sin(t * this.spd + this.phase) * 0.018;
      this.vy += Math.cos(t * this.spd * 1.2 + this.phase + 1) * 0.013;

      // Mouse pulls blobs gently
      const dx = mouseX - this.x, dy = mouseY - this.y;
      const dist = Math.hypot(dx, dy) + 1;
      const f = Math.min(120 / dist, 2);
      this.vx += (dx / dist) * f * this.mi;
      this.vy += (dy / dist) * f * this.mi;

      // Mouse velocity ripple
      this.vx += velX * 0.003; this.vy += velY * 0.003;

      // Scroll pushes blobs up
      this.vy -= scrollOffset * 0.00012;

      // Fluid damping
      this.vx *= 0.962; this.vy *= 0.962;
      this.x += this.vx; this.y += this.vy;

      // Soft bounce walls
      const margin = this.r * 0.4;
      if (this.x < -margin) { this.x = -margin; this.vx *= -0.25; }
      if (this.x > W + margin) { this.x = W + margin; this.vx *= -0.25; }
      if (this.y < -margin) { this.y = -margin; this.vy *= -0.25; }
      if (this.y > H + margin) { this.y = H + margin; this.vy *= -0.25; }

      // Breathing radius
      this.currentR = this.r + Math.sin(t * this.spd * 2.5 + this.phase) * 22;
    }

    draw(t) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.0004 + this.cp);
      const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.currentR);

      if (this.isGold) {
        const r = Math.floor(lerp(201, 245, pulse));
        const g = Math.floor(lerp(152, 210, pulse));
        const b = Math.floor(lerp(42, 80, pulse));
        grd.addColorStop(0,    `rgba(${r},${g},${b},0.52)`);
        grd.addColorStop(0.3,  `rgba(${r},${g},${b},0.32)`);
        grd.addColorStop(0.6,  `rgba(247,224,138,0.12)`);
        grd.addColorStop(1,    `rgba(247,224,138,0)`);
      } else {
        // White/cream
        grd.addColorStop(0,   `rgba(255,255,255,0.72)`);
        grd.addColorStop(0.3, `rgba(255,252,240,0.45)`);
        grd.addColorStop(0.65,`rgba(253,245,216,0.15)`);
        grd.addColorStop(1,   `rgba(253,245,216,0)`);
      }

      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.currentR, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlight (glossy paint look)
      const hx = this.x - this.currentR * 0.25, hy = this.y - this.currentR * 0.25;
      const hgrd = ctx.createRadialGradient(hx, hy, 0, hx, hy, this.currentR * 0.45);
      hgrd.addColorStop(0, `rgba(255,255,255,0.4)`);
      hgrd.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = hgrd;
      ctx.beginPath();
      ctx.arc(hx, hy, this.currentR * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  const blobs = Array.from({ length: 20 }, (_, i) => new Blob(i, 20));

  // Gold drips
  const drips = Array.from({ length: 28 }, () => ({
    x: rand(0, 2000), y: rand(-300, 400),
    w: rand(2, 14), len: rand(50, 220),
    spd: rand(0.06, 0.35),
    alpha: rand(0.03, 0.13),
    col: Math.random() < 0.68 ? [201, 152, 42] : [255, 250, 230],
    life: rand(0, 800), maxLife: rand(500, 1000),
  }));

  function drawDrips() {
    drips.forEach(d => {
      d.life++; d.y += d.spd;
      if (d.life > d.maxLife || d.y > H + 300) {
        d.x = rand(0, W); d.y = rand(-200, -50);
        d.life = 0; d.maxLife = rand(500, 1000);
      }
      const fade = Math.min(1, Math.min(d.life, d.maxLife - d.life) / 80);
      const [r, g, b] = d.col;
      const grd = ctx.createLinearGradient(d.x, d.y, d.x, d.y + d.len);
      grd.addColorStop(0, `rgba(${r},${g},${b},${d.alpha * fade})`);
      grd.addColorStop(0.6, `rgba(${r},${g},${b},${d.alpha * fade * 0.5})`);
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.save();
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(d.x - d.w / 2, d.y);
      ctx.bezierCurveTo(d.x - d.w / 2, d.y + d.len * 0.55, d.x - d.w * 0.8, d.y + d.len * 0.82, d.x, d.y + d.len);
      ctx.bezierCurveTo(d.x + d.w * 0.8, d.y + d.len * 0.82, d.x + d.w / 2, d.y + d.len * 0.55, d.x + d.w / 2, d.y);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(d.x, d.y + d.len, d.w * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${d.alpha * fade * 0.65})`; ctx.fill();
      ctx.restore();
    });
  }

  // Glitter
  const glitters = Array.from({ length: 180 }, () => ({
    x: rand(0, 2000), y: rand(0, 1500),
    vx: rand(-0.12, 0.12), vy: rand(-0.08, 0.08),
    r: rand(0.4, 2.3), alpha: rand(0.2, 0.88),
    tw: rand(0.012, 0.05), ph: rand(0, Math.PI * 2),
    col: ['#C9982A', '#F0C84A', '#F7E08A', '#FFF8DC', '#fff'][randInt(0, 4)],
    isStar: Math.random() < 0.38,
  }));

  function drawGlitter(t) {
    glitters.forEach(g => {
      g.x += g.vx - velX * 0.008; g.y += g.vy - velY * 0.008;
      if (g.x < 0) g.x = W; if (g.x > W) g.x = 0;
      if (g.y < 0) g.y = H; if (g.y > H) g.y = 0;
      const a = g.alpha * (0.28 + 0.72 * Math.abs(Math.sin(t * g.tw + g.ph)));
      ctx.save(); ctx.globalAlpha = a;
      if (g.isStar) {
        ctx.strokeStyle = g.col; ctx.lineWidth = g.r * 0.55;
        ctx.shadowColor = g.col; ctx.shadowBlur = g.r * 5;
        const s = g.r * 2.8;
        ctx.beginPath();
        ctx.moveTo(g.x - s, g.y); ctx.lineTo(g.x + s, g.y);
        ctx.moveTo(g.x, g.y - s); ctx.lineTo(g.x, g.y + s);
        ctx.moveTo(g.x - s * 0.65, g.y - s * 0.65); ctx.lineTo(g.x + s * 0.65, g.y + s * 0.65);
        ctx.moveTo(g.x + s * 0.65, g.y - s * 0.65); ctx.lineTo(g.x - s * 0.65, g.y + s * 0.65);
        ctx.stroke();
      } else {
        ctx.fillStyle = g.col; ctx.shadowColor = g.col; ctx.shadowBlur = g.r * 4;
        ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
  }

  function animFluid(t) {
    ctx.clearRect(0, 0, W, H);

    // Warm cream base — NO black
    const bgGrd = ctx.createRadialGradient(W * 0.38, H * 0.32, 0, W * 0.5, H * 0.5, Math.max(W, H));
    bgGrd.addColorStop(0, '#FEFCF7');
    bgGrd.addColorStop(0.55, '#FAF6EE');
    bgGrd.addColorStop(1, '#F5EFE0');
    ctx.fillStyle = bgGrd; ctx.fillRect(0, 0, W, H);

    // Update & draw blobs
    blobs.forEach(b => { b.update(t); b.draw(t); });

    // Slow diagonal gold wave (adds richness)
    const wGrd = ctx.createLinearGradient(
      W * (0.15 + 0.12 * Math.sin(t * 0.00022)), 0,
      W * (0.85 + 0.08 * Math.cos(t * 0.00018)), H
    );
    wGrd.addColorStop(0, 'rgba(201,152,42,0)');
    wGrd.addColorStop(0.28, 'rgba(240,200,74,0.055)');
    wGrd.addColorStop(0.5, 'rgba(247,224,138,0.085)');
    wGrd.addColorStop(0.72, 'rgba(201,152,42,0.055)');
    wGrd.addColorStop(1, 'rgba(201,152,42,0)');
    ctx.fillStyle = wGrd; ctx.fillRect(0, 0, W, H);

    // White sheen wave
    const wGrd2 = ctx.createLinearGradient(0, H * (0.25 + 0.12 * Math.sin(t * 0.00028)), W, H * (0.75 + 0.1 * Math.cos(t * 0.00022)));
    wGrd2.addColorStop(0, 'rgba(255,255,255,0)');
    wGrd2.addColorStop(0.42, 'rgba(255,255,255,0.16)');
    wGrd2.addColorStop(0.58, 'rgba(253,245,216,0.09)');
    wGrd2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = wGrd2; ctx.fillRect(0, 0, W, H);

    drawDrips();
    drawGlitter(t);
    requestAnimationFrame(animFluid);
  }
  requestAnimationFrame(animFluid);
})();

// ─────────────────────────────────────
// 3. DRAMATIC LOGO — strong glow, aggressive tilt, particle burst
// ─────────────────────────────────────
(function initLogoInteraction() {
  const logo3d = $('#logo3d'), logoImg = $('#logo-img'), scene = $('#logo-scene'), hero = $('#hero');
  if (!logo3d || !hero) return;

  let tRX = 0, tRY = 0, cRX = 0, cRY = 0, tScale = 1, cScale = 1;
  let isHovering = false, glowI = 0, targetGlow = 0;

  // Particle canvas
  const pc = document.createElement('canvas');
  pc.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:10;';
  scene.style.position = 'relative';
  scene.appendChild(pc);
  function resizePC() { const r = scene.getBoundingClientRect(); pc.width = r.width || 380; pc.height = r.height || 380; }
  resizePC(); window.addEventListener('resize', resizePC);
  const pCtx = pc.getContext('2d');
  let parts = [];

  class Particle {
    constructor(cx, cy, burst) {
      const a = rand(0, Math.PI * 2), spd = burst ? rand(3, 11) : rand(0.4, 1.8);
      this.x = cx; this.y = cy; this.vx = Math.cos(a) * spd; this.vy = Math.sin(a) * spd;
      this.r = burst ? rand(2, 6) : rand(1, 2.5); this.life = 1;
      this.decay = burst ? rand(0.02, 0.055) : rand(0.008, 0.022);
      this.col = ['#C9982A','#F0C84A','#F7E08A','#fff','#FDF5D8'][randInt(0, 4)];
      this.star = Math.random() < 0.45;
    }
    update() { this.x += this.vx; this.y += this.vy; this.vy += 0.07; this.vx *= 0.97; this.life -= this.decay; }
    draw() {
      pCtx.save(); pCtx.globalAlpha = Math.max(0, this.life);
      pCtx.fillStyle = this.col; pCtx.strokeStyle = this.col;
      pCtx.shadowColor = this.col; pCtx.shadowBlur = this.r * 5;
      if (this.star) {
        pCtx.lineWidth = 1; const s = this.r * 2.5;
        pCtx.beginPath();
        pCtx.moveTo(this.x-s,this.y); pCtx.lineTo(this.x+s,this.y);
        pCtx.moveTo(this.x,this.y-s); pCtx.lineTo(this.x,this.y+s);
        pCtx.stroke();
      } else {
        pCtx.beginPath(); pCtx.arc(this.x, this.y, this.r, 0, Math.PI*2); pCtx.fill();
      }
      pCtx.restore();
    }
  }

  function burst(cx, cy, n) { for (let i = 0; i < n; i++) parts.push(new Particle(cx, cy, true)); }

  function animParts() {
    pCtx.clearRect(0, 0, pc.width, pc.height);
    parts = parts.filter(p => p.life > 0);
    parts.forEach(p => { p.update(); p.draw(); });
    // Ambient sparkle while hovering
    if (isHovering && Math.random() < 0.4) {
      parts.push(new Particle(pc.width/2 + rand(-90,90), pc.height/2 + rand(-90,90), false));
    }
    requestAnimationFrame(animParts);
  }
  animParts();

  hero.addEventListener('mousemove', e => {
    const r = hero.getBoundingClientRect();
    tRY = ((e.clientX - r.left - r.width/2) / r.width) * 38;
    tRX = -((e.clientY - r.top - r.height/2) / r.height) * 30;
    tScale = 1.09;
  });
  hero.addEventListener('mouseleave', () => { tRX=0; tRY=0; tScale=1; isHovering=false; targetGlow=0; });

  logo3d.addEventListener('mouseenter', () => { isHovering=true; targetGlow=1; });
  logo3d.addEventListener('mouseleave', () => { isHovering=false; targetGlow=0; });
  logo3d.addEventListener('click', () => {
    burst(pc.width/2, pc.height/2, 55);
    tScale=1.2; setTimeout(()=>{ tScale=isHovering?1.09:1; }, 280);
  });

  function animTilt() {
    cRX = lerp(cRX, tRX, 0.052); cRY = lerp(cRY, tRY, 0.052);
    cScale = lerp(cScale, tScale, 0.06); glowI = lerp(glowI, targetGlow, 0.055);
    logo3d.style.transform = `perspective(900px) rotateX(${cRX}deg) rotateY(${cRY}deg) scale(${cScale})`;
    if (logoImg) {
      const g = glowI;
      logoImg.style.filter = `
        drop-shadow(0 ${8+g*24}px ${30+g*55}px rgba(201,152,42,${0.48+g*0.42}))
        drop-shadow(0 0 ${55+g*90}px rgba(201,152,42,${0.22+g*0.48}))
        drop-shadow(0 0 ${g*50}px rgba(240,200,74,${g*0.65}))
        drop-shadow(0 0 ${g*20}px rgba(255,255,200,${g*0.4}))
      `;
    }
    requestAnimationFrame(animTilt);
  }
  animTilt();
})();

// ─────────────────────────────────────
// 4. PORTFOLIO FILTER
// ─────────────────────────────────────
(function initPortFilter() {
  const btns = $$('.pf-btn'), cards = $$('.port-card');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active')); btn.classList.add('active');
      const f = btn.dataset.filter;
      cards.forEach(card => {
        const match = f==='all' || card.dataset.category===f;
        card.style.display = match ? '' : 'none';
        if (match) { card.classList.remove('vis'); void card.offsetHeight; card.classList.add('vis'); }
      });
    });
  });
})();

// ─────────────────────────────────────
// 5. LIGHTBOX
// ─────────────────────────────────────
(function initLightbox() {
  const lb=$('#lightbox'),lbImg=$('#lb-img'),lbCat=$('#lb-cat'),lbTitle=$('#lb-title');
  const lbClose=$('#lb-close'),lbBackdrop=$('#lb-backdrop'),lbPrev=$('#lb-prev'),lbNext=$('#lb-next');
  if(!lb) return;
  const items=$$('.gallery-item'); let current=0;
  function openLb(idx){current=idx;const item=items[idx];lbImg.src=item.dataset.img;lbCat.textContent=item.dataset.cat;lbTitle.textContent=item.dataset.title;lb.classList.add('open');document.body.style.overflow='hidden';lbPrev.style.display=items.length>1?'flex':'none';lbNext.style.display=items.length>1?'flex':'none';}
  function closeLb(){lb.classList.remove('open');document.body.style.overflow='';setTimeout(()=>{lbImg.src='';},350);}
  items.forEach((item,idx)=>item.addEventListener('click',()=>openLb(idx)));
  lbClose.addEventListener('click',closeLb); lbBackdrop.addEventListener('click',closeLb);
  lbPrev.addEventListener('click',e=>{e.stopPropagation();current=(current-1+items.length)%items.length;openLb(current);});
  lbNext.addEventListener('click',e=>{e.stopPropagation();current=(current+1)%items.length;openLb(current);});
  document.addEventListener('keydown',e=>{if(!lb.classList.contains('open'))return;if(e.key==='Escape')closeLb();if(e.key==='ArrowLeft'){current=(current-1+items.length)%items.length;openLb(current);}if(e.key==='ArrowRight'){current=(current+1)%items.length;openLb(current);}});
})();

// ─────────────────────────────────────
// 6. WHY-US ANIMATED CANVAS
// ─────────────────────────────────────
(function initWhyCanvas() {
  const canvas=$('#why-canvas'); if(!canvas)return;
  const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;
  const COLS=['#C9982A','#F0C84A','#2A8B8B','#C4748A','#7B4FA0','#F7E08A','#fff'];
  const strokes=Array.from({length:14},()=>({cx:rand(50,W-50),cy:rand(50,H-50),r:rand(28,95),col:COLS[randInt(0,COLS.length-1)],speed:rand(0.003,0.013),phase:rand(0,Math.PI*2),alpha:rand(0.05,0.17),sw:rand(6,28)}));
  function animWhy(t){
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#FEF9EC'; ctx.fillRect(0,0,W,H);
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

// ─────────────────────────────────────
// 7. INTERACTIVE PAINT CANVAS
// ─────────────────────────────────────
(function initPaintCanvas(){
  const canvas=$('#user-paint-canvas'); if(!canvas)return;
  const ctx=canvas.getContext('2d');
  canvas.width=canvas.offsetWidth; canvas.height=420;
  let painting=false,lastX=0,lastY=0,currentColor='#C9982A',brushSize=12,isSplatter=false;
  ctx.fillStyle='#FEFCF7'; ctx.fillRect(0,0,canvas.width,canvas.height);
  function getPos(e){const rect=canvas.getBoundingClientRect(),sx=canvas.width/rect.width,sy=canvas.height/rect.height;if(e.touches)return{x:(e.touches[0].clientX-rect.left)*sx,y:(e.touches[0].clientY-rect.top)*sy};return{x:(e.clientX-rect.left)*sx,y:(e.clientY-rect.top)*sy};}
  function paintStroke(x,y,px,py){ctx.save();ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.strokeStyle=currentColor;ctx.lineWidth=brushSize;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor=currentColor;ctx.shadowBlur=brushSize*0.5;ctx.globalAlpha=0.82;ctx.stroke();for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(px+rand(-brushSize*.3,brushSize*.3),py+rand(-brushSize*.3,brushSize*.3));ctx.lineTo(x+rand(-brushSize*.3,brushSize*.3),y+rand(-brushSize*.3,brushSize*.3));ctx.lineWidth=1.5;ctx.globalAlpha=0.25;ctx.stroke();}ctx.restore();}
  function splatter(x,y){for(let i=0;i<randInt(8,22);i++){const a=rand(0,Math.PI*2),d=rand(5,90),ex=x+Math.cos(a)*d,ey=y+Math.sin(a)*d,dr=rand(2,brushSize*.65);ctx.save();ctx.globalAlpha=rand(0.4,0.9);ctx.fillStyle=currentColor;ctx.shadowColor=currentColor;ctx.shadowBlur=dr*2;ctx.beginPath();ctx.ellipse(ex,ey,dr,dr*rand(0.4,1.6),a,0,Math.PI*2);ctx.fill();ctx.restore();}}
  canvas.addEventListener('mousedown',e=>{painting=true;const p=getPos(e);lastX=p.x;lastY=p.y;if(isSplatter)splatter(p.x,p.y);});
  canvas.addEventListener('mousemove',e=>{if(!painting)return;const p=getPos(e);if(!isSplatter)paintStroke(p.x,p.y,lastX,lastY);lastX=p.x;lastY=p.y;});
  canvas.addEventListener('mouseup',()=>painting=false); canvas.addEventListener('mouseleave',()=>painting=false);
  canvas.addEventListener('touchstart',e=>{e.preventDefault();painting=true;const p=getPos(e);lastX=p.x;lastY=p.y;if(isSplatter)splatter(p.x,p.y);},{passive:false});
  canvas.addEventListener('touchmove',e=>{e.preventDefault();if(!painting)return;const p=getPos(e);if(!isSplatter)paintStroke(p.x,p.y,lastX,lastY);lastX=p.x;lastY=p.y;},{passive:false});
  canvas.addEventListener('touchend',()=>painting=false);
  $$('.pz-btn').forEach(btn=>{btn.addEventListener('click',()=>{$$('.pz-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');if(btn.id==='clear-canvas-btn'){ctx.fillStyle='#FEFCF7';ctx.fillRect(0,0,canvas.width,canvas.height);isSplatter=false;return;}if(btn.id==='splatter-btn'){isSplatter=true;if(btn.dataset.color)currentColor=btn.dataset.color;return;}isSplatter=false;if(btn.dataset.color)currentColor=btn.dataset.color;if(btn.dataset.size)brushSize=parseInt(btn.dataset.size);});});
})();

// ─────────────────────────────────────
// 8. ARTISTIC TETRIS
// ─────────────────────────────────────
(function initTetris(){
  const canvas=$('#tetris-canvas'),nextCanvas=$('#next-canvas'); if(!canvas)return;
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

// ─────────────────────────────────────
// 9-14. REVEAL / COUNTERS / TILT / MENU / FORM / SCROLL
// ─────────────────────────────────────
(function initReveal(){const els=$$('.reveal');new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('vis');});},{threshold:0.08,rootMargin:'0px 0px -40px 0px'}).observe||(()=>{});els.forEach(el=>new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('vis');});},{threshold:0.08}).observe(el));window.addEventListener('scroll',()=>{$('#navbar').classList.toggle('scrolled',scrollY>70);},{passive:true});})();
(function initCounters(){$$('.stat-num[data-target]').forEach(el=>{new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting&&!el.dataset.done){el.dataset.done='1';const t=+el.dataset.target;let c=0;const s=t/60;const id=setInterval(()=>{c=Math.min(c+s,t);el.textContent=Math.round(c);if(c>=t)clearInterval(id);},20);}});},{threshold:0.5}).observe(el);});})();
(function initTilt(){$$('.svc-card,.price-card,[data-tilt]').forEach(card=>{card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/r.width,dy=(e.clientY-r.top-r.height/2)/r.height,i=card.hasAttribute('data-tilt')?12:6;card.style.transform=`perspective(900px) rotateX(${-dy*i}deg) rotateY(${dx*i}deg) translateY(-8px)`;});card.addEventListener('mouseleave',()=>card.style.transform='');});$$('.port-card').forEach(card=>{card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/r.width,dy=(e.clientY-r.top-r.height/2)/r.height,bg=card.querySelector('.port-bg');if(bg)bg.style.transform=`scale(1.07) translate(${dx*14}px,${dy*10}px)`;});card.addEventListener('mouseleave',()=>{const bg=card.querySelector('.port-bg');if(bg)bg.style.transform='';});});$$('.svc-card').forEach(card=>{const splash=card.querySelector('.svc-splash'),col=card.dataset.color||'#C9982A';if(!splash)return;card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect(),x=((e.clientX-r.left)/r.width*100).toFixed(1),y=((e.clientY-r.top)/r.height*100).toFixed(1);splash.style.background=`radial-gradient(circle at ${x}% ${y}%, ${col}1A, transparent 65%)`;});});})();
(function initMenu(){const toggle=$('#menu-toggle'),menu=$('#fullscreen-menu'),close=$('#close-menu');const open=()=>{menu.classList.add('open');toggle.classList.add('active');document.body.style.overflow='hidden';};const closeMenu=()=>{menu.classList.remove('open');toggle.classList.remove('active');document.body.style.overflow='';};toggle.addEventListener('click',()=>menu.classList.contains('open')?closeMenu():open());close.addEventListener('click',closeMenu);$$('.fm-link').forEach(l=>l.addEventListener('click',closeMenu));menu.addEventListener('click',e=>{if(e.target===menu)closeMenu();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});})();
(function initForm(){const form=$('#contact-form'),success=$('#form-success');if(!form)return;form.addEventListener('submit',e=>{e.preventDefault();form.style.display='none';success.style.display='block';});})();
$$('a[href^="#"]').forEach(link=>{link.addEventListener('click',e=>{const target=$(link.getAttribute('href'));if(!target)return;e.preventDefault();window.scrollTo({top:target.getBoundingClientRect().top+scrollY-80,behavior:'smooth'});});});

console.log('%c🌹 Little Legacies Creative Agency', 'color:#C9982A;font-size:16px;font-family:serif;font-weight:bold');
console.log('%cWhere Vision Becomes Legacy · Est. 2023', 'color:#F0C84A;font-size:11px');
