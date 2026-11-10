'use strict';
/* 방로그 — 모의 사진 렌더러(캔버스)
   실제 카메라를 쓸 수 없을 때 보여 줄 '현장 사진'을 그린다.
   같은 자리·같은 흠은 같은 시드로 그려서, 입주/퇴실 사진을 겹쳐 비교해도 위치가 맞는다.
   a(경과 단계 0~2)가 커지면 흠이 커지고 진해진다. */
const PHOTO = (() => {
  const W = 450, H = 600, SC = 1.5, TAU = Math.PI * 2, cache = new Map();
  const rng = seed => { let s = (seed * 2654435761) >>> 0 || 7; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

  // ── 기본 도형
  const path = (c, pts) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); };
  const poly = (c, pts, fill) => { path(c, pts); c.fillStyle = fill; c.fill(); };
  function blob(r, cx, cy, R, sx = 1, sy = .8, n = 22, jag = .45){
    const pts = []; for(let i = 0; i < n; i++){ const a = i / n * TAU, rr = R * (1 - jag / 2 + r() * jag); pts.push([cx + Math.cos(a) * rr * sx, cy + Math.sin(a) * rr * sy]); } return pts;
  }
  function trace(c, pts){
    const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let m = mid(pts[0], pts[1]); c.beginPath(); c.moveTo(m[0], m[1]);
    for(let i = 1; i <= n; i++){ const p = pts[i % n], q = mid(p, pts[(i + 1) % n]); c.quadraticCurveTo(p[0], p[1], q[0], q[1]); }
    c.closePath();
  }
  const speckle = (c, r, x, y, w, h, n, rgb, a) => { for(let i = 0; i < n; i++){ c.fillStyle = `rgba(${rgb},${a * r()})`; c.fillRect(x + r() * w, y + r() * h, 1 + r() * 2, 1 + r() * 2); } };

  // ── 재질
  function wall(c, r, x, y, w, h, tone = '#ECE9E3'){
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.fillStyle = tone; c.fillRect(x, y, w, h);
    for(let i = 0; i < 14; i++){ const cx = x + r() * w, cy = y + r() * h, R = 60 + r() * 170, a = .02 + r() * .03, g = c.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, r() < .5 ? `rgba(255,255,255,${a})` : `rgba(120,108,90,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x, y, w, h); }
    for(let i = 0; i < w * .9; i++){ c.fillStyle = `rgba(${r() < .5 ? '255,255,255' : '110,100,85'},${.025 + r() * .035})`; c.fillRect(x + r() * w, y + r() * h * .3, .8, h * (.3 + r() * .8)); }
    c.restore();
  }
  function planks(c, r, x, y, w, h, pw, t = [198, 163, 121]){
    for(let px = x; px < x + w; px += pw){
      const v = (r() - .5) * 24; c.fillStyle = `rgb(${t[0] + v},${t[1] + v * .9},${t[2] + v * .8})`; c.fillRect(px, y, pw, h);
      for(let k = 0; k < pw * .7; k++){ let gx = px + r() * pw; c.strokeStyle = `rgba(${85 + r() * 30},${55 + r() * 20},28,${.05 + r() * .09})`; c.lineWidth = .4 + r() * 1.3;
        c.beginPath(); c.moveTo(gx, y); for(let gy = y; gy < y + h; gy += 26){ gx += (r() - .5) * 1.6; c.lineTo(gx, gy); } c.stroke(); }
      c.fillStyle = 'rgba(60,40,20,.38)'; c.fillRect(px, y, 1.3, h);
      for(let jy = y + r() * h * .6; jy < y + h; jy += h * (.45 + r() * .6)) c.fillRect(px, jy, pw, 1.1);
    }
  }
  function board(c, r, x, y, w, h, t, hz = true){
    c.fillStyle = `rgb(${t})`; c.fillRect(x, y, w, h);
    const n = Math.round((hz ? h : w) * .9);
    for(let i = 0; i < n; i++){ c.strokeStyle = `rgba(${t[0] - 90},${t[1] - 90},${t[2] - 90},${.035 + r() * .07})`; c.lineWidth = .4 + r() * 1.4; c.beginPath();
      if(hz){ let gy = y + r() * h; c.moveTo(x, gy); for(let gx = x; gx <= x + w + 30; gx += 30){ gy += (r() - .5) * 1.4; c.lineTo(gx, gy); } }
      else { let gx = x + r() * w; c.moveTo(gx, y); for(let gy = y; gy <= y + h + 30; gy += 30){ gx += (r() - .5) * 1.4; c.lineTo(gx, gy); } }
      c.stroke(); }
  }
  function floor(c, r, top){
    const off = document.createElement('canvas'); off.width = W * 2.6; off.height = H; const o = off.getContext('2d');
    planks(o, r, 0, 0, off.width, off.height, 74);
    const rows = H - top;
    for(let i = 0; i < rows; i++){ const t = (i + 1) / rows, sc = .36 + .64 * t, sw = W / sc, sy = Math.min(H - 1, Math.floor(H * Math.sqrt(t) * .98));
      c.drawImage(off, (off.width - sw) / 2, sy, sw, 1, 0, top + i, W, 1); }
    const g = c.createLinearGradient(0, top, 0, top + 70); g.addColorStop(0, 'rgba(40,28,16,.38)'); g.addColorStop(1, 'rgba(40,28,16,0)'); c.fillStyle = g; c.fillRect(0, top, W, 70);
  }
  function baseboard(c, y, h = 18){ c.fillStyle = '#F4F2EE'; c.fillRect(0, y, W, h); c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(0, y, W, 1.5); c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(0, y + h - 2, W, 2); c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(0, y - 6, W, 6); }
  function marble(c, r, x, y, w, h){
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = '#EDEAE4'; c.fillRect(x, y, w, h);
    for(let i = 0; i < 9; i++){ c.strokeStyle = `rgba(120,115,105,${.05 + r() * .08})`; c.lineWidth = .6 + r() * 1.8; c.beginPath(); let px = x + r() * w, py = y; c.moveTo(px, py);
      for(let k = 0; k < 8; k++){ px += (r() - .3) * 60; py += h / 8; c.lineTo(px, py); } c.stroke(); }
    speckle(c, r, x, y, w, h, w * h / 420, '90,88,84', .14); c.restore();
  }
  function stone(c, r, x, y, w, h){ c.fillStyle = '#DCDCD8'; c.fillRect(x, y, w, h); speckle(c, r, x, y, w, h, w * h / 90, '70,70,68', .32); speckle(c, r, x, y, w, h, w * h / 160, '255,255,255', .6); }
  function tiles(c, x, y, w, h){
    c.fillStyle = '#F3F3F1'; c.fillRect(x, y, w, h); c.strokeStyle = 'rgba(150,150,145,.55)'; c.lineWidth = 1.5;
    for(let j = 0, yy = y; yy < y + h; j++, yy += 38){ c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke();
      for(let xx = x - (j % 2) * 40; xx < x + w; xx += 80){ c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, yy + 38); c.stroke(); } }
  }
  function sky(c, x, y, w, h){
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#B7D1EA'); g.addColorStop(1, '#EEF3F7'); c.fillStyle = g; c.fillRect(x, y, w, h);
    c.filter = 'blur(4px)'; c.fillStyle = 'rgba(146,155,166,.55)';
    [[.04, .56, .22], [.3, .42, .17], [.52, .63, .2], [.75, .47, .24]].forEach(([a, b, cw]) => c.fillRect(x + w * a, y + h * b, w * cw, h));
    c.restore();
  }
  function mesh(c, r, x, y, w, h, st, t){
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.strokeStyle = 'rgba(52,57,63,.4)'; c.lineWidth = .7; c.beginPath();
    for(let i = x; i <= x + w; i += st){ c.moveTo(i, y); c.lineTo(i, y + h); } for(let j = y; j <= y + h; j += st){ c.moveTo(x, j); c.lineTo(x + w, j); } c.stroke();
    if(t){ const pts = blob(r, t.x, t.y, t.R, .8, 1.25, 12, .8);
      c.save(); trace(c, pts); c.clip(); sky(c, x, y, w, h); c.restore();
      trace(c, pts); c.strokeStyle = 'rgba(40,42,46,.55)'; c.lineWidth = 1.3; c.stroke();
      c.lineWidth = .7; pts.forEach(p => { const a = Math.atan2(p[1] - t.y, p[0] - t.x); c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] - Math.cos(a) * t.R * .25, p[1] - Math.sin(a) * t.R * .25); c.stroke(); }); }
    c.restore();
  }
  const frameH = (c, x, y, w, h) => { const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#D7D6D1'); c.fillStyle = g; c.fillRect(x, y, w, h); };
  const frameV = (c, x, y, w, h) => { const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#FBFBFA'); g.addColorStop(1, '#D4D3CE'); c.fillStyle = g; c.fillRect(x, y, w, h); };

  // ── 흠
  function stain(c, r, cx, cy, R, col, k){
    const dk = d => col.map(v => v - d).join(',');
    c.save();
    c.filter = `blur(${R * .12}px)`; trace(c, blob(r, cx, cy, R)); c.fillStyle = `rgba(${col},${.17 * k})`; c.fill();
    c.filter = `blur(${R * .04}px)`;
    for(let i = 0; i < 10; i++){ trace(c, blob(r, cx + (r() - .5) * R * .6, cy + (r() - .5) * R * .5, R * (.15 + r() * .3), 1, .8, 14, .6)); c.fillStyle = `rgba(${col},${(.05 + r() * .08) * k})`; c.fill(); }
    c.filter = `blur(${Math.max(1, R * .03)}px)`; c.lineWidth = Math.max(1.4, R * .035);
    trace(c, blob(r, cx, cy, R * .98)); c.strokeStyle = `rgba(${dk(40)},${.2 * k})`; c.stroke();
    trace(c, blob(r, cx + R * .05, cy + R * .04, R * .7)); c.strokeStyle = `rgba(${dk(30)},${.1 * k})`; c.stroke();
    c.restore();
  }
  function scratch(c, r, x1, y1, x2, y2, w, k){
    const pts = []; for(let i = 0; i <= 28; i++){ const t = i / 28; pts.push([x1 + (x2 - x1) * t + (r() - .5) * 2, y1 + (y2 - y1) * t + (r() - .5) * 2]); }
    const line = (d, col, lw) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0] + d, p[1] + d) : c.moveTo(p[0] + d, p[1] + d)); c.stroke(); };
    c.save(); c.lineCap = 'round'; line(1, `rgba(255,255,255,${.55 * k})`, w * .8); line(0, `rgba(55,40,28,${Math.min(.9, .62 * k)})`, w); c.restore();
  }
  function scratches(c, r, o, cx, cy, len){
    const L = len * o.f, w = o.close ? 3 : 1.5;
    scratch(c, r, cx - L / 2, cy + L * .09, cx + L / 2, cy - L * .09, w, o.k);
    scratch(c, r, cx - L * .3, cy + L * .16, cx + L * .25, cy + L * .05, w * .7, o.k * .8);
    scratch(c, r, cx - L * .1, cy - L * .12, cx + L * .35, cy - L * .2, w * .55, o.k * .6);
    for(let i = 0; i < o.a * 2; i++){ const y = cy + (o.rx() - .5) * L * .5, x = cx + (o.rx() - .5) * L * .4; scratch(c, o.rx, x - L * .3, y, x + L * .3, y - L * .08, w * .7, 1); }
  }
  function dent(c, r, cx, cy, R, k){
    c.save(); c.filter = `blur(${R * .18}px)`;
    c.fillStyle = `rgba(40,30,20,${.32 * k})`; c.beginPath(); c.ellipse(cx - R * .12, cy - R * .1, R, R * .78, 0, 0, TAU); c.fill();
    c.fillStyle = `rgba(255,255,255,${.32 * k})`; c.beginPath(); c.ellipse(cx + R * .22, cy + R * .2, R * .7, R * .5, 0, 0, TAU); c.fill();
    c.filter = 'none'; trace(c, blob(r, cx, cy, R * .32, 1, .8, 10, .7)); c.fillStyle = `rgba(60,45,30,${Math.min(.9, .55 * k)})`; c.fill(); c.restore();
  }
  function hole(c, r, o, cx, cy, R){
    dent(c, r, cx, cy, R * o.f, o.k * 1.2);
    c.save(); c.strokeStyle = `rgba(70,60,50,${.45 * o.k})`; c.lineWidth = R > 40 ? 1.6 : .9;
    for(let i = 0; i < 6; i++){ let a = r() * TAU, x = cx + Math.cos(a) * R * .4 * o.f, y = cy + Math.sin(a) * R * .4 * o.f; c.beginPath(); c.moveTo(x, y);
      for(let k = 0; k < 5; k++){ a += (r() - .5) * .7; x += Math.cos(a) * R * .22 * o.f; y += Math.sin(a) * R * .22 * o.f; c.lineTo(x, y); } c.stroke(); }
    c.restore();
  }
  function soot(c, cx, cy, R, k){ c.save(); c.filter = `blur(${R * .2}px)`; const g = c.createRadialGradient(cx, cy - R * .3, 0, cx, cy - R * .3, R * 1.2);
    g.addColorStop(0, `rgba(35,30,26,${.55 * k})`); g.addColorStop(1, 'rgba(35,30,26,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy - R * .35, R * .75, R * 1.25, 0, 0, TAU); c.fill(); c.restore(); }
  function burn(c, o, cx, cy, R, sq){ R *= o.f; c.save(); c.filter = `blur(${R * .08}px)`; c.lineWidth = R * .18; c.strokeStyle = `rgba(110,72,40,${.42 * o.k})`;
    c.beginPath(); c.ellipse(cx, cy, R, R * sq, 0, 0, TAU); c.stroke(); c.fillStyle = `rgba(140,100,60,${.12 * o.k})`; c.fill(); c.restore(); }
  function mold(c, r, cx, cy, R, k){
    stain(c, r, cx, cy, R * 1.1, [122, 118, 98], .7 * k);
    for(let i = 0; i < R * R * .22 * k; i++){ const a = r() * TAU, d = Math.pow(r(), 1.8) * R; c.fillStyle = `rgba(${40 + r() * 20},${46 + r() * 18},36,${.25 + r() * .5})`;
      c.beginPath(); c.arc(cx + Math.cos(a) * d * 1.2, cy + Math.sin(a) * d * .8, .4 + r() * 1.7, 0, TAU); c.fill(); }
  }
  function outlet(c, x, y, w, h){
    c.save(); c.shadowColor = 'rgba(0,0,0,.22)'; c.shadowBlur = w * .08; c.shadowOffsetY = w * .03; c.beginPath(); c.roundRect(x, y, w, h, w * .08); c.fillStyle = '#F7F7F4'; c.fill(); c.restore();
    const s = h * .3; [x + w * .3, x + w * .7].forEach(cx => { const cy = y + h / 2, g = c.createRadialGradient(cx, cy - s * .3, s * .2, cx, cy, s);
      g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#D6D5D0'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, s, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1; c.stroke(); c.fillStyle = '#2A2A2A'; [-1, 1].forEach(d => { c.beginPath(); c.arc(cx + d * s * .42, cy, s * .13, 0, TAU); c.fill(); }); });
  }
  const handle = (c, x, y) => { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x - 28, y + 3, 56, 6); c.fillStyle = '#B9BDC2'; c.fillRect(x - 28, y, 56, 5); };

  // ── 자리별 장면 (wide = 전체, close = 근접)
  const SCENE = {
    1(c, r, o){ if(o.close){ wall(c, r, 0, 0, W, H); stain(c, r, 225, 285, 150 * o.f, [150, 112, 60], o.k); return; }
      wall(c, r, 0, 0, W, 470); baseboard(c, 470); floor(c, r, 488); stain(c, r, 205, 300, 46 * o.f, [150, 112, 60], o.k); },
    2(c, r, o){ c.save(); c.translate(W / 2, H / 2); c.rotate(-.1); planks(c, r, -W, -H, W * 2, H * 2, o.close ? 210 : 96); c.restore();
      dent(c, r, o.close ? 225 : 240, o.close ? 290 : 330, (o.close ? 54 : 15) * o.f, o.k); },
    3(c, r, o){ if(o.close){ board(c, r, 0, 0, W, H, [214, 188, 150]); scratches(c, r, o, 225, 300, 190); return; }
      wall(c, r, 0, 0, W, 330);
      c.save(); path(c, [[30, 250], [420, 250], [450, 330], [0, 330]]); c.clip(); board(c, r, 0, 250, W, 80, [214, 188, 150]); c.restore();
      c.fillStyle = '#C8AD86'; c.fillRect(0, 330, W, 12); board(c, r, 0, 342, W, H - 342, [222, 200, 166], false);
      c.fillStyle = 'rgba(70,50,30,.35)'; c.fillRect(0, 470, W, 2); c.fillRect(W / 2 - 1, 342, 2, H - 342);
      handle(c, 112, 400); handle(c, 338, 400); handle(c, 112, 530); handle(c, 338, 530); scratches(c, r, o, 215, 292, 70); },
    4(c, r, o){ if(o.close){ wall(c, r, 0, 0, W, H); stain(c, r, 225, 290, 135 * o.f, [128, 116, 98], o.k); return; }
      wall(c, r, 0, 0, W, H); c.fillStyle = 'rgba(0,0,0,.1)'; c.fillRect(0, 474, W, 6); board(c, r, 0, 480, W, 120, [214, 188, 150]);
      stain(c, r, 170, 300, 34 * o.f, [128, 116, 98], o.k); },
    5(c, r, o){ if(o.close){ sky(c, 0, 0, W, 250); mesh(c, r, 0, 0, W, 250, 7, {x:300, y:120, R:46 * o.f}); frameH(c, 0, 232, W, 26); marble(c, r, 0, 258, W, H - 258); scratches(c, r, o, 215, 420, 190); return; }
      wall(c, r, 0, 0, W, H); c.fillStyle = 'rgba(0,0,0,.1)'; c.fillRect(54, 62, 350, 352);
      sky(c, 60, 70, 330, 330); mesh(c, r, 228, 78, 154, 316, 4, {x:300, y:210, R:16 * o.f});
      frameH(c, 60, 70, 330, 16); frameH(c, 60, 384, 330, 16); frameV(c, 60, 70, 16, 330); frameV(c, 374, 70, 16, 330); frameV(c, 217, 70, 14, 330);
      c.save(); path(c, [[44, 400], [406, 400], [430, 452], [20, 452]]); c.clip(); marble(c, r, 0, 400, W, 52); c.restore();
      baseboard(c, 520, 16); floor(c, r, 536); scratches(c, r, o, 190, 428, 80); },
    6(c, r, o){ if(o.close){ stone(c, r, 0, 0, W, H); scratches(c, r, o, 215, 300, 200); burn(c, o, 245, 330, 62, .9); return; }
      tiles(c, 0, 0, W, 330);
      c.save(); path(c, [[0, 330], [450, 330], [450, 440], [0, 440]]); c.clip(); stone(c, r, 0, 330, W, 110); c.restore();
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 330, W, 3);
      const b = c.createRadialGradient(345, 380, 10, 345, 380, 95); b.addColorStop(0, '#9DA3A9'); b.addColorStop(1, '#5E646B'); c.fillStyle = b; c.beginPath(); c.ellipse(345, 380, 92, 28, 0, 0, TAU); c.fill();
      c.save(); c.lineCap = 'round'; const g = c.createLinearGradient(372, 0, 398, 0); g.addColorStop(0, '#8E9399'); g.addColorStop(.5, '#F2F4F6'); g.addColorStop(1, '#7D838A');
      c.strokeStyle = g; c.lineWidth = 14; c.beginPath(); c.moveTo(385, 352); c.lineTo(385, 250); c.quadraticCurveTo(385, 215, 350, 215); c.lineTo(334, 215); c.stroke(); c.restore();
      c.fillStyle = '#D5D3CE'; c.fillRect(0, 440, W, 14); c.fillStyle = '#E8E7E3'; c.fillRect(0, 454, W, H - 454);
      c.fillStyle = 'rgba(0,0,0,.16)'; [150, 300].forEach(x => c.fillRect(x, 454, 2, H - 454)); [75, 225, 375].forEach(x => { c.fillStyle = '#B5B9BE'; c.fillRect(x - 20, 474, 40, 5); });
      scratches(c, r, o, 150, 394, 70); burn(c, o, 180, 400, 18, .35); },
    7(c, r, o){ if(o.close){ wall(c, r, 0, 0, W, H); hole(c, r, o, 225, 300, 62); return; }
      wall(c, r, 0, 0, W, H); baseboard(c, 520, 16); floor(c, r, 536);
      const g = c.createLinearGradient(0, 0, 170, 0); g.addColorStop(0, '#D7D4CD'); g.addColorStop(.85, '#E8E5DF'); g.addColorStop(1, '#C8C4BB'); c.fillStyle = g; c.fillRect(0, 0, 170, H);
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(170, 0, 7, H);
      c.fillStyle = '#9EA3A9'; c.beginPath(); c.arc(148, 330, 13, 0, TAU); c.fill(); c.fillStyle = '#C9CDD2'; c.fillRect(96, 324, 54, 11);
      hole(c, r, o, 236, 330, 20); },
    8(c, r, o){ if(o.close){ wall(c, r, 0, 0, W, H); outlet(c, 70, 220, 310, 230); soot(c, 250, 300, 120 * o.f, o.k); return; }
      wall(c, r, 0, 0, W, H); baseboard(c, 520, 16); floor(c, r, 536); outlet(c, 165, 262, 120, 90); soot(c, 249, 300, 32 * o.f, o.k); },
    9(c, r, o){ const V = o.close ? [230, 250] : [300, 170];
      if(o.close){ poly(c, [[0, 0], [450, 0], [450, 120], V, [0, 170]], '#F2F1EE'); poly(c, [[0, 170], V, [230, 600], [0, 600]], '#E6E2DB'); poly(c, [V, [450, 120], [450, 600], [230, 600]], '#D8D3CB'); }
      else { poly(c, [[0, 0], [450, 0], [450, 60], V, [0, 110]], '#F2F1EE'); poly(c, [[0, 110], V, [300, 600], [0, 600]], '#E7E3DC'); poly(c, [V, [450, 60], [450, 600], [300, 600]], '#DAD5CD'); }
      c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, o.close ? 170 : 110); c.lineTo(V[0], V[1]); c.lineTo(450, o.close ? 120 : 60); c.moveTo(V[0], V[1]); c.lineTo(V[0], 600); c.stroke();
      const ao = c.createRadialGradient(V[0], V[1], 0, V[0], V[1], 160); ao.addColorStop(0, 'rgba(0,0,0,.14)'); ao.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = ao; c.fillRect(0, 0, W, H);
      mold(c, r, V[0] - 8, V[1] + 14, (o.close ? 140 : 44) * o.f, o.k); },
    10(c, r, o){ const mel = (x, y, w, h) => board(c, r, x, y, w, h, [216, 210, 199], false);
      if(o.close){ mel(0, 0, W, H); hole(c, r, o, 215, 290, 50); scratches(c, r, o, 230, 420, 150); dim(c, .14); return; }
      poly(c, [[0, 0], [450, 0], [370, 70], [80, 70]], '#C6C1B7'); poly(c, [[0, 0], [80, 70], [80, 560], [0, 600]], '#BCB6AB'); poly(c, [[450, 0], [370, 70], [370, 560], [450, 600]], '#A69F94'); poly(c, [[0, 600], [80, 560], [370, 560], [450, 600]], '#9C958A');
      mel(80, 70, 290, 490); poly(c, [[0, 262], [450, 262], [370, 222], [80, 222]], '#D9D4CA'); c.fillStyle = '#BEB8AD'; c.fillRect(0, 262, W, 12);
      const g = c.createLinearGradient(0, 122, 0, 132); g.addColorStop(0, '#F0F2F4'); g.addColorStop(1, '#8C9298'); c.fillStyle = g; c.fillRect(80, 122, 290, 9);
      hole(c, r, o, 215, 410, 18); scratches(c, r, o, 245, 460, 60); dim(c, .3); },
  };
  function dim(c, a){ const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(0,0,0,${a * .4})`); g.addColorStop(1, `rgba(0,0,0,${a})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }

  // ── 촬영 느낌: 빛, 주변부 어둡게, 근접 사진의 얕은 심도, 노이즈
  function finish(c, r, close){
    const w = c.canvas.width, h = c.canvas.height; c.setTransform(1, 0, 0, 1, 0, 0);
    c.save(); c.globalCompositeOperation = 'soft-light';
    const g = c.createRadialGradient(w * .28, h * .08, 10, w * .28, h * .08, h * 1.1); g.addColorStop(0, 'rgba(255,248,236,.5)'); g.addColorStop(1, 'rgba(0,0,0,.36)');
    c.fillStyle = g; c.fillRect(0, 0, w, h); c.restore();
    const v = c.createRadialGradient(w / 2, h / 2, h * .32, w / 2, h / 2, h * .8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.26)'); c.fillStyle = v; c.fillRect(0, 0, w, h);
    if(close){ const t = document.createElement('canvas'); t.width = w; t.height = h; const x = t.getContext('2d');
      x.filter = `blur(${5 * w / W}px)`; x.drawImage(c.canvas, 0, 0); x.filter = 'none'; x.globalCompositeOperation = 'destination-in';
      const m = x.createRadialGradient(w / 2, h * .47, h * .22, w / 2, h * .47, h * .62); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)'); x.fillStyle = m; x.fillRect(0, 0, w, h);
      c.drawImage(t, 0, 0); }
    // 약한 대비 + 따뜻한 톤 + 센서 노이즈
    const im = c.getImageData(0, 0, w, h), d = im.data;
    for(let i = 0; i < d.length; i += 4){ const n = (r() - .5) * 9;
      d[i] = d[i] + (d[i] - 128) * .07 + n + 3; d[i + 1] = d[i + 1] + (d[i + 1] - 128) * .07 + n + 1; d[i + 2] = d[i + 2] + (d[i + 2] - 128) * .07 + n - 3; }
    c.putImageData(im, 0, 0);
  }

  // 기준 사진(wide)은 3D 방 렌더러가, 흠을 가까이 찍은 사진(close)은 아래 장면이 그린다
  const CLOSE_OF = {1:1, 2:5, 3:4, 4:6, 5:1, 6:2, 7:7, 8:8, 9:9, 10:10};
  function url(pid, variant = 'wide', a = 0){
    if(variant !== 'close') return ROOM.render(pid, a);
    const key = `${pid}-${variant}-${a}`; if(cache.has(key)) return cache.get(key);
    const sid = CLOSE_OF[pid] || pid;
    const cv = document.createElement('canvas'); cv.width = W * SC; cv.height = H * SC; const c = cv.getContext('2d', {willReadFrequently:true}); c.setTransform(SC, 0, 0, SC, 0, 0);
    const close = true, r = rng(sid * 97 + 13);
    const o = {close, a, f:1 + a * .45, k:Math.min(1.5, 1 + a * .22), rx:rng(sid * 131 + 71)};
    try{ SCENE[sid](c, r, o); finish(c, r, close); }catch(e){ console.warn('photo', pid, e); }
    const out = cv.toDataURL('image/jpeg', .84); cache.set(key, out); return out;
  }
  const ready = (pid, variant = 'wide', a = 0) => variant !== 'close' ? ROOM.has(pid, a) : cache.has(`${pid}-${variant}-${a}`);
  return {url, ready, W, H, SC, fx:{blob, trace, stain, scratch, dent, soot, mold, finish}};
})();
