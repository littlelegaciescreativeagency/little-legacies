'use strict';
// ══════════════════════════════════════════════════
// LITTLE LEGACIES — main.js v7
// Gold Liquid VIDEO background with cursor interaction
// Ripple + spotlight + lens distortion on mouse move
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

  (function animCursor() {
    ox = lerp(ox, mx, 0.1); oy = lerp(oy, my, 0.1);
    outer.style.left = ox + 'px'; outer.style.top = oy + 'px';
    trailPts.push({ x: mx, y: my });
    if (trailPts.length > 28) trailPts.shift();
    tCtx.clearRect(0, 0, trail.width, trail.height);
    for (let i = 1; i < trailPts.length; i++) {
      const p0 = trailPts[i-1], p1 = trailPts[i], age = i / trailPts.length;
      tCtx.strokeStyle = `rgba(201,152,42,${age * 0.2})`;
      tCtx.lineWidth = age * 2.5; tCtx.lineCap = 'round';
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
// 2. VIDEO CURSOR INTERACTION
// When cursor moves over hero:
// - Spotlight follows cursor (brightens area under mouse)
// - Gold ripples emanate from cursor position
// - Video gets subtle parallax tilt
// - Click creates gold splash burst
// ─────────────────────────────────────
(function initVideoInteraction() {
  const hero = $('#hero');
  const video = $('#hero-video');
  const overlay = $('#video-overlay');
  if (!hero || !overlay) return;

  const ctx = overlay.getContext('2d');
  let W, H;

  function resize() {
    W = overlay.width = hero.offsetWidth;
    H = overlay.height = hero.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Mouse state
  let mouseX = W / 2, mouseY = H / 2;
  let targetX = W / 2, targetY = H / 2;
  let smoothX = W / 2, smoothY = H / 2;
  let velX = 0, velY = 0, prevX = W/2, prevY = H/2;
  let isInHero = false;
  let mouseActive = false;

  // Ripples array
  let ripples = [];
  // Gold splash particles on click
  let splashParts = [];

  hero.addEventListener('mouseenter', () => { isInHero = true; mouseActive = true; });
  hero.addEventListener('mouseleave', () => {
    isInHero = false;
    setTimeout(() => { if (!isInHero) mouseActive = false; }, 800);
  });

  hero.addEventListener('mousemove', e => {
    const rect = hero.getBoundingClientRect();
    prevX = targetX; prevY = targetY;
    targetX = e.clientX - rect.left;
    targetY = e.clientY - rect.top;
    velX = targetX - prevX;
    velY = targetY - prevY;
    mouseActive = true;

    // Spawn ripple on fast movement
    const speed = Math.hypot(velX, velY);
    if (speed > 4) {
      ripples.push(new Ripple(targetX, targetY, speed));
    }

    // Subtle video parallax — tilt slightly toward cursor
    if (video) {
      const dx = (targetX / W - 0.5) * 14;
      const dy = (targetY / H - 0.5) * 8;
      video.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.06)`;
    }
  });

  // Click = gold splash burst
  hero.addEventListener('click', e => {
    const rect = hero.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    // Big ripple
    for (let i = 0; i < 3; i++) {
      ripples.push(new Ripple(cx, cy, 20 + i * 8, true));
    }
    // Gold particles
    for (let i = 0; i < 40; i++) {
      splashParts.push(new SplashParticle(cx, cy));
    }
  });

  // ── RIPPLE CLASS ──
  class Ripple {
    constructor(x, y, speed = 5, isBig = false) {
      this.x = x; this.y = y;
      this.r = isBig ? 5 : rand(2, 8);
      this.maxR = isBig ? rand(120, 220) : rand(40, 80 + speed * 4);
      this.life = 1;
      this.decay = isBig ? 0.014 : rand(0.018, 0.035);
      this.isBig = isBig;
      this.lineWidth = isBig ? rand(2, 4) : rand(1, 2.5);
      // Gold color variation
      this.goldAlpha = isBig ? 0.7 : rand(0.3, 0.65);
    }
    update() {
      this.r = lerp(this.r, this.maxR, 0.055);
      this.life -= this.decay;
    }
    draw() {
      const a = Math.max(0, this.life) * this.goldAlpha;
      // Outer ring
      ctx.save();
      ctx.strokeStyle = `rgba(240,200,74,${a})`;
      ctx.lineWidth = this.lineWidth;
      ctx.shadowColor = `rgba(201,152,42,${a * 0.5})`;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.stroke();
      // Inner shimmer ring
      if (this.isBig && this.r > 15) {
        ctx.strokeStyle = `rgba(255,248,200,${a * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r * 0.65, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ── SPLASH PARTICLE CLASS ──
  class SplashParticle {
    constructor(cx, cy) {
      const a = rand(0, Math.PI * 2);
      const spd = rand(2, 12);
      this.x = cx; this.y = cy;
      this.vx = Math.cos(a) * spd + velX * 0.3;
      this.vy = Math.sin(a) * spd + velY * 0.3;
      this.r = rand(1.5, 5);
      this.life = 1;
      this.decay = rand(0.02, 0.05);
      this.col = ['rgba(201,152,42,','rgba(240,200,74,','rgba(255,248,180,','rgba(247,224,138,'][randInt(0, 3)];
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      this.vy += 0.18; this.vx *= 0.96;
      this.life -= this.decay;
    }
    draw() {
      const a = Math.max(0, this.life);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = this.col + a + ')';
      ctx.shadowColor = 'rgba(201,152,42,0.6)';
      ctx.shadowBlur = this.r * 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * a, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Ambient auto-ripples — keep some movement even without cursor
  let autoRippleTimer = 0;
  function spawnAutoRipple() {
    const cx = rand(W * 0.2, W * 0.8);
    const cy = rand(H * 0.2, H * 0.8);
    ripples.push(new Ripple(cx, cy, 3, false));
  }

  // ── MAIN OVERLAY RENDER LOOP ──
  function animOverlay(t) {
    ctx.clearRect(0, 0, W, H);

    // Smooth cursor follow
    smoothX = lerp(smoothX, targetX, 0.08);
    smoothY = lerp(smoothY, targetY, 0.08);

    // Auto ripple every 2.5s
    autoRippleTimer++;
    if (autoRippleTimer % 150 === 0) spawnAutoRipple();
    if (autoRippleTimer % 220 === 0) spawnAutoRipple(); // second wave

    // ── SPOTLIGHT EFFECT ──
    // Bright circle follows cursor, reveals the video more vividly
    if (mouseActive) {
      // Outer glow halo
      const halo = ctx.createRadialGradient(smoothX, smoothY, 0, smoothX, smoothY, 300);
      halo.addColorStop(0,   'rgba(255,248,180,0.18)');
      halo.addColorStop(0.3, 'rgba(247,220,100,0.08)');
      halo.addColorStop(0.7, 'rgba(201,152,42,0.03)');
      halo.addColorStop(1,   'rgba(201,152,42,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, W, H);

      // Core bright spot
      const spot = ctx.createRadialGradient(smoothX, smoothY, 0, smoothX, smoothY, 80);
      spot.addColorStop(0,   'rgba(255,255,240,0.22)');
      spot.addColorStop(0.4, 'rgba(255,240,160,0.08)');
      spot.addColorStop(1,   'rgba(255,240,160,0)');
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, W, H);

      // Gold ring around cursor on the video
      ctx.save();
      const ringA = 0.4 + 0.2 * Math.sin(t * 0.003);
      const ringGrd = ctx.createRadialGradient(smoothX, smoothY, 55, smoothX, smoothY, 80);
      ringGrd.addColorStop(0, `rgba(240,200,74,${ringA})`);
      ringGrd.addColorStop(0.4, `rgba(201,152,42,${ringA * 0.5})`);
      ringGrd.addColorStop(1, 'rgba(201,152,42,0)');
      ctx.strokeStyle = `rgba(240,200,74,${ringA * 0.7})`;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(240,200,74,0.5)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(smoothX, smoothY, 62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ── UPDATE & DRAW RIPPLES ──
    ripples = ripples.filter(r => r.life > 0);
    ripples.forEach(r => { r.update(); r.draw(); });

    // ── UPDATE & DRAW SPLASH PARTICLES ──
    splashParts = splashParts.filter(p => p.life > 0);
    splashParts.forEach(p => { p.update(); p.draw(); });

    // ── GOLD EDGE VIGNETTE ──
    // Subtle gold glow at corners to frame the video beautifully
    const vigGrd = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, Math.max(W,H)*0.8);
    vigGrd.addColorStop(0, 'rgba(201,152,42,0)');
    vigGrd.addColorStop(0.7, 'rgba(201,152,42,0)');
    vigGrd.addColorStop(1, 'rgba(201,152,42,0.12)');
    ctx.fillStyle = vigGrd;
    ctx.fillRect(0, 0, W, H);

    requestAnimationFrame(animOverlay);
  }
  requestAnimationFrame(animOverlay);

  // Reset video parallax on mouse leave
  hero.addEventListener('mouseleave', () => {
    if (video) video.style.transform = 'translate(-50%, -50%) scale(1.06)';
  });
})();

// ─────────────────────────────────────
// 3. GLITTER OVERLAY
// ─────────────────────────────────────
(function initGlitter() {
  const canvas = $('#glitter-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;
  function resize() { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }
  resize(); window.addEventListener('resize', resize);
  const COLS = ['#C9982A','#F0C84A','#F7E08A','#FFF8DC','#fff'];
  const glitters = Array.from({ length: 180 }, () => ({
    x: rand(0, 2000), y: rand(0, 1500),
    vx: rand(-0.1, 0.1), vy: rand(-0.08, 0.08),
    r: rand(0.4, 2.2), alpha: rand(0.15, 0.75),
    tw: rand(0.01, 0.05), ph: rand(0, Math.PI * 2),
    col: COLS[randInt(0, COLS.length - 1)],
    isStar: Math.random() < 0.4,
  }));
  (function animGlitter(t) {
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
  })();
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

  class Particle{
    constructor(cx,cy,burst){
      const a=rand(0,Math.PI*2),spd=burst?rand(3,11):rand(.4,1.8);
      this.x=cx;this.y=cy;this.vx=Math.cos(a)*spd;this.vy=Math.sin(a)*spd;
      this.r=burst?rand(2,6):rand(1,2.5);this.life=1;
      this.decay=burst?rand(.02,.055):rand(.008,.022);
      this.col=['#C9982A','#F0C84A','#F7E08A','#fff','#FDF5D8'][randInt(0,4)];this.star=Math.random()<.45;
    }
    update(){this.x+=this.vx;this.y+=this.vy;this.vy+=.07;this.vx*=.97;this.life-=this.decay;}
    draw(){
      pCtx.save();pCtx.globalAlpha=Math.max(0,this.life);pCtx.fillStyle=this.col;pCtx.strokeStyle=this.col;pCtx.shadowColor=this.col;pCtx.shadowBlur=this.r*5;
      if(this.star){pCtx.lineWidth=1;const s=this.r*2.5;pCtx.beginPath();pCtx.moveTo(this.x-s,this.y);pCtx.lineTo(this.x+s,this.y);pCtx.moveTo(this.x,this.y-s);pCtx.lineTo(this.x,this.y+s);pCtx.stroke();}
      else{pCtx.beginPath();pCtx.arc(this.x,this.y,this.r,0,Math.PI*2);pCtx.fill();}
      pCtx.restore();
    }
  }

  function burst(cx,cy,n){for(let i=0;i<n;i++)parts.push(new Particle(cx,cy,true));}

  (function animParts(){
    pCtx.clearRect(0,0,pc.width,pc.height);
    parts=parts.filter(p=>p.life>0);
    parts.forEach(p=>{p.update();p.draw();});
    if(isHovering&&Math.random()<.4)parts.push(new Particle(pc.width/2+rand(-90,90),pc.height/2+rand(-90,90),false));
    requestAnimationFrame(animParts);
  })();

  hero.addEventListener('mousemove',e=>{
    const r=hero.getBoundingClientRect();
    tRY=((e.clientX-r.left-r.width/2)/r.width)*38;
    tRX=-((e.clientY-r.top-r.height/2)/r.height)*30;
    tScale=1.09;
  });
  hero.addEventListener('mouseleave',()=>{tRX=0;tRY=0;tScale=1;isHovering=false;targetGlow=0;});
  logo3d.addEventListener('mouseenter',()=>{isHovering=true;targetGlow=1;document.body.classList.add('hovering');});
  logo3d.addEventListener('mouseleave',()=>{isHovering=false;targetGlow=0;document.body.classList.remove('hovering');});
  logo3d.addEventListener('click',()=>{burst(pc.width/2,pc.height/2,55);tScale=1.2;setTimeout(()=>{tScale=isHovering?1.09:1;},280);});

  (function animTilt(){
    cRX=lerp(cRX,tRX,.052);cRY=lerp(cRY,tRY,.052);cScale=lerp(cScale,tScale,.06);glowI=lerp(glowI,targetGlow,.055);
    logo3d.style.transform=`perspective(900px) rotateX(${cRX}deg) rotateY(${cRY}deg) scale(${cScale})`;
    if(logoImg){
      const g=glowI;
      logoImg.style.filter=`drop-shadow(0 ${8+g*24}px ${30+g*55}px rgba(201,152,42,${.48+g*.42})) drop-shadow(0 0 ${55+g*90}px rgba(201,152,42,${.22+g*.48})) drop-shadow(0 0 ${g*50}px rgba(240,200,74,${g*.65}))`;
    }
    requestAnimationFrame(animTilt);
  })();
})();

// ─────────────────────────────────────
// 5-14. ALL REMAINING SYSTEMS
// ─────────────────────────────────────

// Portfolio Filter
(function(){const btns=$$('.pf-btn'),cards=$$('.port-card');btns.forEach(btn=>{btn.addEventListener('click',()=>{btns.forEach(b=>b.classList.remove('active'));btn.classList.add('active');const f=btn.dataset.filter;cards.forEach(card=>{const match=f==='all'||card.dataset.category===f;card.style.display=match?'':'none';if(match){card.classList.remove('vis');void card.offsetHeight;card.classList.add('vis');}});});});})();

// Lightbox
(function(){const lb=$('#lightbox'),lbImg=$('#lb-img'),lbCat=$('#lb-cat'),lbTitle=$('#lb-title'),lbClose=$('#lb-close'),lbBackdrop=$('#lb-backdrop'),lbPrev=$('#lb-prev'),lbNext=$('#lb-next');if(!lb)return;const items=$$('.gallery-item');let current=0;function openLb(idx){current=idx;const item=items[idx];lbImg.src=item.dataset.img;lbCat.textContent=item.dataset.cat;lbTitle.textContent=item.dataset.title;lb.classList.add('open');document.body.style.overflow='hidden';lbPrev.style.display=items.length>1?'flex':'none';lbNext.style.display=items.length>1?'flex':'none';}function closeLb(){lb.classList.remove('open');document.body.style.overflow='';setTimeout(()=>{lbImg.src='';},350);}items.forEach((item,idx)=>item.addEventListener('click',()=>openLb(idx)));lbClose.addEventListener('click',closeLb);lbBackdrop.addEventListener('click',closeLb);lbPrev.addEventListener('click',e=>{e.stopPropagation();current=(current-1+items.length)%items.length;openLb(current);});lbNext.addEventListener('click',e=>{e.stopPropagation();current=(current+1)%items.length;openLb(current);});document.addEventListener('keydown',e=>{if(!lb.classList.contains('open'))return;if(e.key==='Escape')closeLb();if(e.key==='ArrowLeft'){current=(current-1+items.length)%items.length;openLb(current);}if(e.key==='ArrowRight'){current=(current+1)%items.length;openLb(current);}});})();

// Gold Orb Video Interaction
(function(){
  const orbWrap = $('.why-orb-wrap');
  const orbVideo = $('#why-orb-video');
  const orbGlow = $('.why-orb-glow');
  if (!orbWrap || !orbVideo) return;

  let tRX = 0, tRY = 0, cRX = 0, cRY = 0;

  orbWrap.addEventListener('mousemove', e => {
    const r = orbWrap.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width/2) / r.width;
    const dy = (e.clientY - r.top - r.height/2) / r.height;
    tRX = -dy * 18; tRY = dx * 18;
    orbVideo.style.filter = 'brightness(1.18) saturate(1.4) contrast(1.08)';
    if (orbGlow) orbGlow.style.opacity = '1';
  });
  orbWrap.addEventListener('mouseleave', () => {
    tRX = 0; tRY = 0;
    orbVideo.style.filter = 'brightness(1.08) saturate(1.2) contrast(1.05)';
    if (orbGlow) orbGlow.style.opacity = '0.7';
  });

  (function animOrb() {
    cRX = lerp(cRX, tRX, 0.06); cRY = lerp(cRY, tRY, 0.06);
    orbWrap.style.transform = `perspective(600px) rotateX(${cRX}deg) rotateY(${cRY}deg)`;
    requestAnimationFrame(animOrb);
  })();
})();

// Interactive Paint Canvas
(function(){const canvas=$('#user-paint-canvas');if(!canvas)return;const ctx=canvas.getContext('2d');canvas.width=canvas.offsetWidth;canvas.height=420;let painting=false,lastX=0,lastY=0,currentColor='#C9982A',brushSize=12,isSplatter=false;ctx.fillStyle='#FEFCF7';ctx.fillRect(0,0,canvas.width,canvas.height);function getPos(e){const rect=canvas.getBoundingClientRect(),sx=canvas.width/rect.width,sy=canvas.height/rect.height;if(e.touches)return{x:(e.touches[0].clientX-rect.left)*sx,y:(e.touches[0].clientY-rect.top)*sy};return{x:(e.clientX-rect.left)*sx,y:(e.clientY-rect.top)*sy};}function paintStroke(x,y,px,py){ctx.save();ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.strokeStyle=currentColor;ctx.lineWidth=brushSize;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor=currentColor;ctx.shadowBlur=brushSize*.5;ctx.globalAlpha=.82;ctx.stroke();ctx.restore();}function splatter(x,y){for(let i=0;i<randInt(8,22);i++){const a=rand(0,Math.PI*2),d=rand(5,90),ex=x+Math.cos(a)*d,ey=y+Math.sin(a)*d,dr=rand(2,brushSize*.65);ctx.save();ctx.globalAlpha=rand(.4,.9);ctx.fillStyle=currentColor;ctx.beginPath();ctx.arc(ex,ey,dr,0,Math.PI*2);ctx.fill();ctx.restore();}}canvas.addEventListener('mousedown',e=>{painting=true;const p=getPos(e);lastX=p.x;lastY=p.y;if(isSplatter)splatter(p.x,p.y);});canvas.addEventListener('mousemove',e=>{if(!painting)return;const p=getPos(e);if(!isSplatter)paintStroke(p.x,p.y,lastX,lastY);lastX=p.x;lastY=p.y;});canvas.addEventListener('mouseup',()=>painting=false);canvas.addEventListener('mouseleave',()=>painting=false);canvas.addEventListener('touchstart',e=>{e.preventDefault();painting=true;const p=getPos(e);lastX=p.x;lastY=p.y;if(isSplatter)splatter(p.x,p.y);},{passive:false});canvas.addEventListener('touchmove',e=>{e.preventDefault();if(!painting)return;const p=getPos(e);if(!isSplatter)paintStroke(p.x,p.y,lastX,lastY);lastX=p.x;lastY=p.y;},{passive:false});canvas.addEventListener('touchend',()=>painting=false);$$('.pz-btn').forEach(btn=>{btn.addEventListener('click',()=>{$$('.pz-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');if(btn.id==='clear-canvas-btn'){ctx.fillStyle='#FEFCF7';ctx.fillRect(0,0,canvas.width,canvas.height);isSplatter=false;return;}if(btn.id==='splatter-btn'){isSplatter=true;if(btn.dataset.color)currentColor=btn.dataset.color;return;}isSplatter=false;if(btn.dataset.color)currentColor=btn.dataset.color;if(btn.dataset.size)brushSize=parseInt(btn.dataset.size);});});})();

// Tetris
(function(){const canvas=$('#tetris-canvas'),nextCanvas=$('#next-canvas');if(!canvas)return;const ctx=canvas.getContext('2d'),nCtx=nextCanvas.getContext('2d'),overlay=$('#game-overlay'),modal=$('#game-modal'),COLS=10,ROWS=20,BLOCK=canvas.width/COLS,COLORS=[null,'#C9982A','#F0C84A','#2A8B8B','#C4748A','#7B4FA0','#3A6FA8','#E8703A'],SHAPES=[null,[[1,1,1,1]],[[2,2],[2,2]],[[0,3,0],[3,3,3]],[[0,4,4],[4,4,0]],[[5,5,0],[0,5,5]],[[6,0,0],[6,6,6]],[[0,0,7],[7,7,7]]];let board,score,level,lines,best=0,cur,nxt,running=false,paused=false,dropTimer=0,lastTime=0,dropInterval=800,animId;function makeBoard(){return Array.from({length:ROWS},()=>new Array(COLS).fill(0));}function randPiece(){const t=randInt(1,7),shape=SHAPES[t].map(r=>[...r]);return{type:t,shape,x:Math.floor(COLS/2)-Math.floor(shape[0].length/2),y:0};}function rotate(s){const r=s.length,c=s[0].length,res=Array.from({length:c},()=>new Array(r).fill(0));for(let i=0;i<r;i++)for(let j=0;j<c;j++)res[j][r-1-i]=s[i][j];return res;}function valid(p,dx=0,dy=0,sh=p.shape){for(let r=0;r<sh.length;r++)for(let c=0;c<sh[r].length;c++){if(!sh[r][c])continue;const nx=p.x+c+dx,ny=p.y+r+dy;if(nx<0||nx>=COLS||ny>=ROWS)return false;if(ny>=0&&board[ny][nx])return false;}return true;}function merge(){cur.shape.forEach((row,r)=>row.forEach((v,c)=>{if(v)board[cur.y+r][cur.x+c]=v;}));}function clearLines(){let cl=0;for(let r=ROWS-1;r>=0;r--){if(board[r].every(c=>c)){board.splice(r,1);board.unshift(new Array(COLS).fill(0));cl++;r++;}}if(cl){score+=[0,100,300,500,800][cl]*level;lines+=cl;level=Math.floor(lines/10)+1;dropInterval=Math.max(80,800-(level-1)*70);updateUI();}}function hardDrop(){while(valid(cur,0,1)){cur.y++;score+=2;}lock();}function lock(){merge();clearLines();cur=nxt;nxt=randPiece();drawNext();if(!valid(cur))endGame();}function updateUI(){$('#t-score').textContent=score;$('#t-level').textContent=level;$('#t-lines').textContent=lines;if(score>best){best=score;$('#t-best').textContent=best;try{localStorage.setItem('ll_best',best);}catch(e){}}}function endGame(){running=false;cancelAnimationFrame(animId);$('#pause-tetris').style.display='none';$('#restart-tetris').style.display='none';$('#gm-score').textContent=score;$('#gm-best').textContent=best;$('#gm-title').textContent=score>500?'🏆 Legendary!':score>200?'🎨 Creative!':'✨ Keep Going!';modal.style.display='flex';}function drawBlock(c,x,y,type,size=BLOCK){if(!type)return;const col=COLORS[type],bx=x*size,by=y*size,s=size-1;c.fillStyle=col;c.fillRect(bx+1,by+1,s-1,s-1);c.fillStyle='rgba(255,255,255,.28)';c.fillRect(bx+1,by+1,s-1,3);c.fillRect(bx+1,by+1,3,s-1);c.fillStyle='rgba(0,0,0,.22)';c.fillRect(bx+s-2,by+2,2,s-2);c.fillRect(bx+2,by+s-2,s-2,2);}function drawGhost(){let gy=cur.y;while(valid(cur,0,gy-cur.y+1))gy++;if(gy===cur.y)return;cur.shape.forEach((row,r)=>row.forEach((v,c2)=>{if(!v)return;ctx.save();ctx.globalAlpha=.18;ctx.strokeStyle=COLORS[v];ctx.lineWidth=2;ctx.strokeRect((cur.x+c2)*BLOCK+2,(gy+r)*BLOCK+2,BLOCK-4,BLOCK-4);ctx.restore();}));}function draw(){const bg=ctx.createLinearGradient(0,0,0,canvas.height);bg.addColorStop(0,'#FEF9EC');bg.addColorStop(1,'#FAF6EE');ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='rgba(201,152,42,.07)';ctx.lineWidth=.5;for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)ctx.strokeRect(c*BLOCK,r*BLOCK,BLOCK,BLOCK);for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(board[r][c])drawBlock(ctx,c,r,board[r][c]);if(cur){drawGhost();cur.shape.forEach((row,r)=>row.forEach((v,c)=>{if(v)drawBlock(ctx,cur.x+c,cur.y+r,v);}));}if(paused){ctx.fillStyle='rgba(253,245,216,.88)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#C9982A';ctx.font="bold 24px 'Cinzel',serif";ctx.textAlign='center';ctx.fillText('PAUSED',canvas.width/2,canvas.height/2);}}function drawNext(){nCtx.fillStyle='#FAF6EE';nCtx.fillRect(0,0,100,100);if(!nxt)return;const bS=18,ox=Math.floor((100-nxt.shape[0].length*bS)/2),oy=Math.floor((100-nxt.shape.length*bS)/2);nxt.shape.forEach((row,r)=>row.forEach((v,c)=>{if(!v)return;nCtx.fillStyle=COLORS[v];nCtx.fillRect(ox+c*bS+1,oy+r*bS+1,bS-2,bS-2);}));}function gameLoop(t){if(!running||paused){draw();return;}const dt=t-lastTime;lastTime=t;dropTimer+=dt;if(dropTimer>=dropInterval){dropTimer=0;valid(cur,0,1)?cur.y++:lock();}draw();animId=requestAnimationFrame(gameLoop);}function start(){board=makeBoard();score=0;level=1;lines=0;dropTimer=0;dropInterval=800;try{best=parseInt(localStorage.getItem('ll_best'))||0;}catch(e){best=0;}cur=randPiece();nxt=randPiece();drawNext();updateUI();running=true;paused=false;overlay.style.display='none';modal.style.display='none';$('#pause-tetris').style.display='block';$('#restart-tetris').style.display='block';lastTime=performance.now();cancelAnimationFrame(animId);animId=requestAnimationFrame(gameLoop);}document.addEventListener('keydown',e=>{if(!running)return;switch(e.key){case'ArrowLeft':case'a':case'A':if(valid(cur,-1,0))cur.x--;e.preventDefault();break;case'ArrowRight':case'd':case'D':if(valid(cur,1,0))cur.x++;e.preventDefault();break;case'ArrowDown':case's':case'S':if(valid(cur,0,1)){cur.y++;score++;}e.preventDefault();break;case'ArrowUp':case'w':case'W':{const rot=rotate(cur.shape);if(valid(cur,0,0,rot))cur.shape=rot;e.preventDefault();break;}case' ':hardDrop();e.preventDefault();break;case'p':case'P':paused=!paused;$('#pause-tetris').textContent=paused?'Resume':'Pause';if(!paused){lastTime=performance.now();animId=requestAnimationFrame(gameLoop);}break;}});let tSX=0,tSY=0;canvas.addEventListener('touchstart',e=>{tSX=e.touches[0].clientX;tSY=e.touches[0].clientY;e.preventDefault();},{passive:false});canvas.addEventListener('touchend',e=>{if(!running)return;const dx=e.changedTouches[0].clientX-tSX,dy=e.changedTouches[0].clientY-tSY;if(Math.abs(dx)<10&&Math.abs(dy)<10){const r=rotate(cur.shape);if(valid(cur,0,0,r))cur.shape=r;}else if(Math.abs(dx)>Math.abs(dy)){if(dx>0&&valid(cur,1,0))cur.x++;else if(dx<0&&valid(cur,-1,0))cur.x--;}else if(dy>30)hardDrop();e.preventDefault();},{passive:false});$('#start-tetris').addEventListener('click',start);$('#pause-tetris').addEventListener('click',()=>{paused=!paused;$('#pause-tetris').textContent=paused?'Resume':'Pause';if(!paused){lastTime=performance.now();animId=requestAnimationFrame(gameLoop);}});$('#restart-tetris').addEventListener('click',start);$('#gm-restart').addEventListener('click',start);$('#gm-close').addEventListener('click',()=>{modal.style.display='none';});board=makeBoard();cur=randPiece();nxt=randPiece();draw();drawNext();})();

// Scroll Reveal + Navbar
(function(){const els=$$('.reveal');els.forEach(el=>new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('vis');});},{threshold:.08}).observe(el));window.addEventListener('scroll',()=>{$('#navbar').classList.toggle('scrolled',scrollY>70);},{passive:true});})();

// Counters
(function(){$$('.stat-num[data-target]').forEach(el=>{new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting&&!el.dataset.done){el.dataset.done='1';const t=+el.dataset.target;let c=0;const s=t/60;const id=setInterval(()=>{c=Math.min(c+s,t);el.textContent=Math.round(c);if(c>=t)clearInterval(id);},20);}});},{threshold:.5}).observe(el);});})();

// Card Tilt
(function(){$$('.svc-card,.price-card,[data-tilt]').forEach(card=>{card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/r.width,dy=(e.clientY-r.top-r.height/2)/r.height,i=card.hasAttribute('data-tilt')?12:6;card.style.transform=`perspective(900px) rotateX(${-dy*i}deg) rotateY(${dx*i}deg) translateY(-8px)`;});card.addEventListener('mouseleave',()=>card.style.transform='');});$$('.port-card').forEach(card=>{card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/r.width,dy=(e.clientY-r.top-r.height/2)/r.height,bg=card.querySelector('.port-bg');if(bg)bg.style.transform=`scale(1.07) translate(${dx*14}px,${dy*10}px)`;});card.addEventListener('mouseleave',()=>{const bg=card.querySelector('.port-bg');if(bg)bg.style.transform='';});});$$('.svc-card').forEach(card=>{const splash=card.querySelector('.svc-splash'),col=card.dataset.color||'#C9982A';if(!splash)return;card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect(),x=((e.clientX-r.left)/r.width*100).toFixed(1),y=((e.clientY-r.top)/r.height*100).toFixed(1);splash.style.background=`radial-gradient(circle at ${x}% ${y}%, ${col}1A, transparent 65%)`;});});})();

// Menu
(function(){const toggle=$('#menu-toggle'),menu=$('#fullscreen-menu'),close=$('#close-menu');const open=()=>{menu.classList.add('open');toggle.classList.add('active');document.body.style.overflow='hidden';};const closeMenu=()=>{menu.classList.remove('open');toggle.classList.remove('active');document.body.style.overflow='';};toggle.addEventListener('click',()=>menu.classList.contains('open')?closeMenu():open());close.addEventListener('click',closeMenu);$$('.fm-link').forEach(l=>l.addEventListener('click',closeMenu));menu.addEventListener('click',e=>{if(e.target===menu)closeMenu();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});})();

// Contact Form
(function(){const form=$('#contact-form'),success=$('#form-success');if(!form)return;form.addEventListener('submit',e=>{e.preventDefault();form.style.display='none';success.style.display='block';});})();

// Smooth Scroll
$$('a[href^="#"]').forEach(link=>{link.addEventListener('click',e=>{const target=$(link.getAttribute('href'));if(!target)return;e.preventDefault();window.scrollTo({top:target.getBoundingClientRect().top+scrollY-80,behavior:'smooth'});});});

console.log('%c🌹 Little Legacies Creative Agency', 'color:#C9982A;font-size:16px;font-family:serif;font-weight:bold');
console.log('%cWhere Vision Becomes Legacy · Video Background v7', 'color:#F0C84A;font-size:11px');
