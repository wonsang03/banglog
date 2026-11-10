'use strict';
/* 방로그 — 3D 방 렌더러(캔버스)
   스캔으로 파악한 방(도면 좌표)을 3D로 세우고, 핀마다 정해진 자리·방향에서 '기준 사진'을 그린다.
   같은 핀 = 같은 카메라라서 입주·점검·퇴실 사진이 정확히 겹치고, 그 사이에 생기거나 커진 흠만 달라진다.
   좌표: x(도면 가로), y(높이, 천장 200), z(도면 세로). 방 안쪽 x 20~300, z 20~380, 창문은 북쪽 벽(z=20) */
const ROOM = (() => {
  let W = 450, H = 600, SC = 1.5, OY = 0;   // 스캔 화면(spin*)이 화면 비율·수평선 높이에 맞춰 잠시 바꾼다
  const NEAR = 3, CEIL = 200, cache = new Map();
  const rng = s => { let x = (s * 2654435761) >>> 0 || 7; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; };
  const blur = n => `blur(${n * SC}px)`;
  // 핀별 카메라: 눈높이(h), 고개 각도(pitch, +는 위), 화각(f, 작을수록 넓게)
  const CAMS = {1:{h:128, pitch:-.08, f:200}, 2:{h:118, pitch:.02, f:250}, 3:{h:118, pitch:-.05, f:232}, 4:{h:118, pitch:-.1, f:240}, 5:{h:118, pitch:-.1, f:232},
    6:{h:130, pitch:-.98, f:250}, 7:{h:110, pitch:-.1, f:210}, 8:{h:62, pitch:-.42, f:228}, 9:{h:120, pitch:.62, f:220}, 10:{h:112, pitch:-.12, f:218}};
  let C = null, c = null;

  // ── 투영
  function camera(pid){ const p = P(pid), k = CAMS[pid], a = Math.atan2(p.ty - p.sy, p.tx - p.sx);
    return {x:p.sx, z:p.sy, h:k.h, ca:Math.cos(a), sa:Math.sin(a), cp:Math.cos(k.pitch), sp:Math.sin(k.pitch), f:k.f}; }
  const view = (x, y, z) => { const dx = x - C.x, dz = z - C.z, X = -dx * C.sa + dz * C.ca, F = dx * C.ca + dz * C.sa, Y = y - C.h; return [X, Y * C.cp - F * C.sp, Y * C.sp + F * C.cp]; };
  const scr = q => [W / 2 + C.f * q[0] / q[2], H / 2 + OY - C.f * q[1] / q[2]];
  const proj = p => { const q = view(...p); return q[2] > NEAR ? scr(q) : null; };
  function clipNear(q){ const o = []; for(let i = 0; i < q.length; i++){ const a = q[i], b = q[(i + 1) % q.length], ai = a[2] > NEAR, bi = b[2] > NEAR;
    if(ai) o.push(a); if(ai !== bi){ const t = (NEAR - a[2]) / (b[2] - a[2]); o.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); } } return o; }
  function path(pts){ const q = clipNear(pts.map(p => view(p[0], p[1], p[2]))); if(q.length < 3) return false;
    c.beginPath(); q.forEach((v, i) => { const s = scr(v); i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]); }); c.closePath(); return true; }
  const fill = (pts, col) => { if(path(pts)){ c.fillStyle = col; c.fill(); } };
  function seg(a, b){ let A = view(...a), B = view(...b); if(A[2] <= NEAR && B[2] <= NEAR) return;
    if(A[2] <= NEAR){ const t = (NEAR - A[2]) / (B[2] - A[2]); A = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, NEAR]; }
    if(B[2] <= NEAR){ const t = (NEAR - B[2]) / (A[2] - B[2]); B = [B[0] + (A[0] - B[0]) * t, B[1] + (A[1] - B[1]) * t, NEAR]; }
    const s = scr(A), e = scr(B); c.moveTo(s[0], s[1]); c.lineTo(e[0], e[1]); }
  const lines = (list, style, w = 1) => { c.beginPath(); list.forEach(([a, b]) => seg(a, b)); c.strokeStyle = style; c.lineWidth = w; c.stroke(); };
  const facing = (n, p) => n[0] * (C.x - p[0]) + n[1] * (C.h - p[1]) + n[2] * (C.z - p[2]) > 0;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  // 면 위에 화면 기준 그라데이션을 덧칠(두 3D 점 사이)
  function wash(pts, p0, p1, stops){ const s0 = proj(p0), s1 = proj(p1); if(!s0 || !s1) return;
    c.save(); if(path(pts)){ c.clip(); const g = c.createLinearGradient(s0[0], s0[1], s1[0], s1[1]); stops.forEach(([o, col]) => g.addColorStop(o, col)); c.fillStyle = g; c.fillRect(-W, -H, W * 3, H * 3); } c.restore(); }

  // ── 빛: 북쪽 창문에서 들어오는 빛 + 주변광
  const L = [0, .55, -.83].map((v, _, a) => v / Math.hypot(...a));
  const WIN = [170, 135, 20];
  const near = p => Math.max(0, Math.min(1, 1 - (Math.hypot(p[0] - WIN[0], p[2] - WIN[2]) - 40) / 380));
  const glow = k => k > .5 ? `rgba(255,248,236,${((k - .5) * .34).toFixed(3)})` : `rgba(38,28,18,${((.5 - k) * .26).toFixed(3)})`;
  const shade = (rgb, n, amb = .9) => { const d = n[0] * L[0] + n[1] * L[1] + n[2] * L[2], k = amb + (1 - amb) * d; return `rgb(${rgb.map(v => Math.max(0, Math.min(255, Math.round(v * k)))).join(',')})`; };
  function box(x0, x1, y0, y1, z0, z1, top, side = top){
    [[[[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], top], [[[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], side],
     [[[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0], side], [[[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [0, 0, -1], side],
     [[[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], side]].forEach(([pts, n, col]) => {
      const m = pts.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4, s[2] + p[2] / 4], [0, 0, 0]); if(!facing(n, m)) return;
      fill(pts, shade(col, n));
      if(n[1] === 0 && y1 - y0 > 6) wash(pts, [m[0], y1, m[2]], [m[0], y0, m[2]], [[0, 'rgba(255,255,255,.07)'], [1, 'rgba(0,0,0,.12)']]);
      if(n[1] === 1) lines([[pts[0], pts[1]], [pts[1], pts[2]], [pts[2], pts[3]], [pts[3], pts[0]]], 'rgba(255,255,255,.3)', .7); });
  }
  const shadow = (x0, x1, z0, z1, a = .18, b = 4) => { c.save(); c.filter = blur(6); fill([[x0 - b, .2, z0 - b], [x1 + b, .2, z0 - b], [x1 + b, .2, z1 + b], [x0 - b, .2, z1 + b]], `rgba(32,22,12,${a})`); c.restore(); };
  // 벽·바닥에 붙는 것: 그 지점의 원근을 근사한 변환으로 그린다(그리기 단위 1 ≈ 그 거리의 1px)
  function decal(P, U, V, n, fn){
    if(n && !facing(n, P)) return; const q = view(...P); if(q[2] <= NEAR * 2) return;
    const k = C.f / q[2], s0 = scr(q), m = Math.max(W, H) * .5; if(s0[0] < -m || s0[0] > W + m || s0[1] < -m || s0[1] > H + m) return;   // 화면 밖 멀리(거의 옆·머리 위)면 이 근사가 깨진다
    const su = scr(view(P[0] + U[0] / k, P[1] + U[1] / k, P[2] + U[2] / k)), sv = scr(view(P[0] + V[0] / k, P[1] + V[1] / k, P[2] + V[2] / k));
    c.save(); c.setTransform(SC * (su[0] - s0[0]), SC * (su[1] - s0[1]), SC * (sv[0] - s0[0]), SC * (sv[1] - s0[1]), SC * s0[0], SC * s0[1]); fn(k); c.restore();
  }

  // ── 방 껍데기
  const WALLS = [{p:[[20, 0, 20], [300, 0, 20], [300, CEIL, 20], [20, CEIL, 20]], n:[0, 0, 1]}, {p:[[300, 0, 20], [300, 0, 380], [300, CEIL, 380], [300, CEIL, 20]], n:[-1, 0, 0]},
    {p:[[300, 0, 380], [20, 0, 380], [20, CEIL, 380], [300, CEIL, 380]], n:[0, 0, -1]}, {p:[[20, 0, 380], [20, 0, 20], [20, CEIL, 20], [20, CEIL, 380]], n:[1, 0, 0]}];
  const CEILING = [[20, CEIL, 20], [20, CEIL, 380], [300, CEIL, 380], [300, CEIL, 20]], FLOOR = [[20, 0, 20], [300, 0, 20], [300, 0, 380], [20, 0, 380]];
  function shell(){
    fill(CEILING, shade([248, 247, 244], [0, -1, 0])); wash(CEILING, [160, CEIL, 30], [160, CEIL, 370], [[0, 'rgba(255,252,246,.16)'], [1, 'rgba(30,24,16,.1)']]);
    WALLS.forEach(w => { fill(w.p, shade([240, 237, 231], w.n));
      const a = w.p[0], b = w.p[1], pa = [a[0] + (b[0] - a[0]) * .1, 100, a[2] + (b[2] - a[2]) * .1], pb = [a[0] + (b[0] - a[0]) * .9, 100, a[2] + (b[2] - a[2]) * .9];
      wash(w.p, pa, pb, [[0, glow(near(pa))], [1, glow(near(pb))]]);
      const m = mid(a, b); wash(w.p, [m[0], CEIL, m[2]], [m[0], 0, m[2]], [[0, 'rgba(255,255,255,.06)'], [.75, 'rgba(0,0,0,0)'], [1, 'rgba(30,20,10,.08)']]); });
    const r = rng(13);
    WALLS.forEach(w => { const a = w.p[0], b = w.p[1]; for(let i = 0; i < 70; i++){ const t = r(), x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, y = r() * 130;
      c.beginPath(); seg([x, y, z], [x, y + 30 + r() * 70, z]); c.strokeStyle = `rgba(${r() < .5 ? '255,255,255' : '120,108,90'},${.05 + r() * .05})`; c.lineWidth = .8; c.stroke(); } });
  }
  function floor(){
    const r = rng(11);
    fill(FLOOR, shade([204, 170, 128], [0, 1, 0]));
    c.save(); if(!path(FLOOR)){ c.restore(); return; } c.clip();
    const joints = [];
    for(let x = 20; x < 300; x += 16){ let z = 20 - r() * 80;
      while(z < 380){ const z1 = Math.min(380, z + 70 + r() * 110), v = (r() - .5) * 32, z0 = Math.max(20, z);
        fill([[x, .05, z0], [x + 16, .05, z0], [x + 16, .05, z1], [x, .05, z1]], v > 0 ? `rgba(255,238,214,${v / 230})` : `rgba(70,46,22,${-v / 190})`);
        if(z1 < 380 && z1 > 20) joints.push([[x, .1, z1], [x + 16, .1, z1]]); z = z1; } }
    for(let i = 0; i < 360; i++){ const x = 20 + r() * 280, z = 20 + r() * 360; c.beginPath(); seg([x, .1, z], [x + (r() - .5) * .6, .1, z + 14 + r() * 60]);
      c.strokeStyle = `rgba(95,62,30,${.035 + r() * .07})`; c.lineWidth = .5 + r() * .9; c.stroke(); }
    const seams = []; for(let x = 36; x < 300; x += 16) seams.push([[x, .1, 20], [x, .1, 380]]);
    lines(seams, 'rgba(78,52,26,.4)', 1); lines(joints, 'rgba(78,52,26,.36)', 1); c.restore();
    wash(FLOOR, [160, 0, 30], [160, 0, 375], [[0, 'rgba(255,246,230,.12)'], [1, 'rgba(30,20,10,.14)']]);
    // 창으로 들어온 햇빛(창틀 두 칸 모양)
    c.save(); c.filter = blur(2.5); [[111, 167], [173, 229]].forEach(([x0, x1]) => fill([[x0 + 9, .3, 112], [x1 + 9, .3, 112], [x1 + 22, .3, 232], [x0 + 22, .3, 232]], 'rgba(255,244,220,.26)')); c.restore();
    // 현관 타일
    fill([[20, .4, 330], [96, .4, 330], [96, .4, 380], [20, .4, 380]], shade([214, 211, 205], [0, 1, 0]));
    const g = []; for(let x = 32.7; x < 96; x += 12.7) g.push([[x, .5, 330], [x, .5, 380]]); for(let z = 342.5; z < 380; z += 12.5) g.push([[20, .5, z], [96, .5, z]]);
    lines(g, 'rgba(120,116,110,.5)', .8); lines([[[20, .6, 330], [96, .6, 330]], [[96, .6, 330], [96, .6, 380]]], 'rgba(60,55,50,.45)', 1.6);
  }
  function edges(){
    const flo = [[[20, 1, 20], [300, 1, 20]], [[300, 1, 20], [300, 1, 380]], [[300, 1, 380], [20, 1, 380]], [[20, 1, 380], [20, 1, 20]]];
    const ver = [[[20, 0, 20], [20, CEIL, 20]], [[300, 0, 20], [300, CEIL, 20]], [[300, 0, 380], [300, CEIL, 380]], [[20, 0, 380], [20, CEIL, 380]]];
    const top = [[[20, CEIL - .5, 20], [300, CEIL - .5, 20]], [[300, CEIL - .5, 20], [300, CEIL - .5, 380]], [[300, CEIL - .5, 380], [20, CEIL - .5, 380]], [[20, CEIL - .5, 380], [20, CEIL - .5, 20]]];
    c.save(); c.filter = blur(8); c.lineCap = 'round'; lines(flo, 'rgba(40,28,16,.22)', 12); lines(ver, 'rgba(0,0,0,.08)', 14); lines(top, 'rgba(0,0,0,.08)', 12); c.restore();
    lines(ver, 'rgba(0,0,0,.09)', 1); lines(top, 'rgba(0,0,0,.12)', 1.2);
    const t = .8, h = 9, B = [[[20, 0, 20 + t], [300, 0, 20 + t], [300, h, 20 + t], [20, h, 20 + t], [0, 0, 1]], [[300 - t, 0, 20], [300 - t, 0, 380], [300 - t, h, 380], [300 - t, h, 20], [-1, 0, 0]],
      [[300, 0, 380 - t], [84, 0, 380 - t], [84, h, 380 - t], [300, h, 380 - t], [0, 0, -1]], [[20 + t, 0, 380], [20 + t, 0, 20], [20 + t, h, 20], [20 + t, h, 380], [1, 0, 0]]];
    B.forEach(b => fill(b.slice(0, 4), shade([247, 245, 241], b[4]))); lines(B.map(b => [b[3], b[2]]), 'rgba(255,255,255,.75)', 1);
  }
  function lamp(){ decal([160, CEIL - .3, 200], [1, 0, 0], [0, 0, 1], [0, -1, 0], k => { const R = 8 * k, g = c.createRadialGradient(0, 0, 0, 0, 0, R * 1.5);
    g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(.6, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * 1.5, 0, 7); c.fill();
    c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1; c.stroke(); }); }

  // ── 벽에 붙은 것들
  function bbox(pts){ const s = pts.map(p => view(...p)).filter(q => q[2] > NEAR).map(scr); if(!s.length) return null;
    const xs = s.map(p => p[0]), ys = s.map(p => p[1]); return {x:Math.min(...xs), y:Math.min(...ys), w:Math.max(...xs) - Math.min(...xs), h:Math.max(...ys) - Math.min(...ys)}; }
  function sky(b){ const g = c.createLinearGradient(0, b.y, 0, b.y + b.h); g.addColorStop(0, '#A9C7E6'); g.addColorStop(.65, '#DFE9F3'); g.addColorStop(1, '#F3F5F6'); c.fillStyle = g; c.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    c.save(); c.filter = blur(2); c.fillStyle = 'rgba(146,157,170,.55)'; [[0, .56, .3], [.28, .38, .2], [.5, .63, .26], [.78, .46, .3]].forEach(([u, v, w]) => c.fillRect(b.x + b.w * u, b.y + b.h * v, b.w * w, b.h));
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(b.x, b.y, b.w, b.h * .18); c.restore(); }
  function windowN(a){
    const z = 20.3;
    c.save(); c.filter = blur(14); fill([[96, 66, z], [244, 66, z], [244, 204, z], [96, 204, z]], 'rgba(255,250,238,.5)'); c.restore();   // 창 주변 빛 번짐
    fill([[104, 74, z], [236, 74, z], [236, 196, z], [104, 196, z]], shade([251, 251, 249], [0, 0, 1], .96));
    [[111, 167, 0], [173, 229, 1]].forEach(([x0, x1, i]) => {
      const pts = [[x0, 82, z + .1], [x1, 82, z + .1], [x1, 189, z + .1], [x0, 189, z + .1]], b = bbox(pts); if(!b) return;
      c.save(); if(path(pts)){ c.clip(); sky(b);
        if(i){ c.strokeStyle = 'rgba(50,55,62,.28)'; c.lineWidth = .6; c.beginPath(); const st = Math.max(2, b.w / 42);
          for(let x = b.x; x < b.x + b.w; x += st){ c.moveTo(x, b.y); c.lineTo(x, b.y + b.h); } for(let y = b.y; y < b.y + b.h; y += st){ c.moveTo(b.x, y); c.lineTo(b.x + b.w, y); } c.stroke();
          if(a >= 2){ const r = rng(29), F = PHOTO.fx, p2 = F.blob(r, b.x + b.w * .56, b.y + b.h * .4, b.w * .17, .8, 1.3, 12, .8);
            c.save(); F.trace(c, p2); c.clip(); sky(b); c.restore(); F.trace(c, p2); c.strokeStyle = 'rgba(40,42,46,.6)'; c.lineWidth = 1.1; c.stroke(); } } }
      c.restore(); if(path(pts)){ c.strokeStyle = 'rgba(0,0,0,.16)'; c.lineWidth = 1.2; c.stroke(); } });
    box(98, 242, 68, 74, 20, 31, [248, 247, 244], [236, 234, 230]);
  }
  function door(){ const z = 379.7; fill([[30, 0, z], [84, 0, z], [84, 172, z], [30, 172, z]], shade([229, 225, 217], [0, 0, -1]));
    wash([[30, 0, z], [84, 0, z], [84, 172, z], [30, 172, z]], [57, 172, z], [57, 0, z], [[0, 'rgba(255,255,255,.06)'], [1, 'rgba(0,0,0,.1)']]);
    lines([[[30, 172, z], [84, 172, z]], [[30, 0, z], [30, 172, z]], [[84, 0, z], [84, 172, z]]], 'rgba(0,0,0,.22)', 1.4); box(73, 81, 86, 91, 375, 379.6, [196, 200, 206]);
    decal([102, 112, 379.6], [-1, 0, 0], [0, -1, 0], [0, 0, -1], k => { c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(-3.2 * k, -4.6 * k, 7 * k, 10 * k); c.fillStyle = '#F8F8F6'; c.fillRect(-3.5 * k, -5 * k, 7 * k, 10 * k); });
  }
  function outlet(){ decal([299.6, 28, 238], [0, 0, 1], [0, -1, 0], [-1, 0, 0], k => { const w = 15 * k, h = 10 * k;
    c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(-w / 2 + .6 * k, -h / 2 + .8 * k, w, h); c.fillStyle = '#F7F7F4'; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, k); c.fill();
    [-w * .23, w * .23].forEach(x => { c.fillStyle = '#E4E3DE'; c.beginPath(); c.arc(x, 0, h * .33, 0, 7); c.fill(); c.fillStyle = '#2A2A2A'; [-1, 1].forEach(d => { c.beginPath(); c.arc(x + d * h * .12, 0, h * .055, 0, 7); c.fill(); }); }); }); }
  function backsplash(){ const x = 299.7, Q = [[x, 74, 52], [x, 74, 206], [x, 140, 206], [x, 140, 52]]; fill(Q, shade([248, 248, 246], [-1, 0, 0], .95));
    const g = []; for(let y = 85; y < 140; y += 11) g.push([[x - .1, y, 52], [x - .1, y, 206]]);
    for(let y = 74, i = 0; y < 140; y += 11, i++) for(let z = 52 + (i % 2) * 11; z < 206; z += 22) g.push([[x - .1, y, z], [x - .1, y + 11, z]]);
    lines(g, 'rgba(150,150,145,.5)', .9); wash(Q, [x, 140, 129], [x, 74, 129], [[0, 'rgba(0,0,0,.12)'], [.3, 'rgba(0,0,0,0)']]); }
  // 벽걸이 에어컨(동쪽 벽, 침대 위)
  const aircon = () => { box(287, 300, 160, 188, 298, 372, [246, 246, 244], [236, 236, 233]); lines([[[286.8, 165, 302], [286.8, 165, 368]], [[286.8, 168, 302], [286.8, 168, 368]]], 'rgba(0,0,0,.18)', .9); };

  // ── 가구
  const desk = () => { box(62, 66, 0, 58, 118, 122, [196, 174, 142]); box(62, 66, 0, 58, 190, 194, [196, 174, 142]); box(22, 64, 42, 58, 150, 194, [224, 206, 178], [214, 194, 164]);
    lines([[[64.1, 50, 166], [64.1, 50, 178]]], 'rgba(120,110,95,.9)', 2); box(20, 68, 58, 62, 116, 196, [218, 196, 164], [196, 172, 138]); };
  const chair = () => { box(85, 89, 0, 40, 153, 157, [70, 74, 80]); box(76, 98, 40, 45, 144, 166, [60, 64, 72]); box(95, 99, 45, 84, 146, 164, [60, 64, 72]); };
  function closet(open){
    if(!open){ box(20, 60, 0, 190, 206, 288, [238, 236, 231]); lines([[[60.1, 3, 247], [60.1, 187, 247]]], 'rgba(0,0,0,.2)', 1);
      lines([[[60.2, 92, 243], [60.2, 112, 243]], [[60.2, 92, 251], [60.2, 112, 251]]], 'rgba(150,155,160,.95)', 2); return; }
    const m = [214, 208, 196];
    fill([[22, 2, 208], [22, 2, 286], [22, 188, 286], [22, 188, 208]], shade(m, [1, 0, 0], .78)); fill([[22, 188, 208], [60, 188, 208], [60, 188, 286], [22, 188, 286]], shade(m, [0, -1, 0], .7));
    fill([[22, 2, 208], [60, 2, 208], [60, 2, 286], [22, 2, 286]], shade(m, [0, 1, 0], .8)); fill([[22, 2, 208], [60, 2, 208], [60, 188, 208], [22, 188, 208]], shade(m, [0, 0, 1], .72));
    fill([[22, 2, 286], [22, 188, 286], [60, 188, 286], [60, 2, 286]], shade(m, [0, 0, -1], .72));
    wash([[22, 2, 208], [22, 2, 286], [22, 188, 286], [22, 188, 208]], [22, 188, 247], [22, 2, 247], [[0, 'rgba(0,0,0,.18)'], [.4, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.12)']]);
    box(22, 60, 136, 140, 208, 286, [228, 223, 212], [206, 200, 188]); lines([[[40, 162, 210], [40, 162, 284]]], 'rgba(186,191,197,1)', 2.5);
    lines([[[60, 0, 206], [60, 190, 206]], [[60, 0, 288], [60, 190, 288]], [[60, 190, 206], [60, 190, 288]]], 'rgba(0,0,0,.22)', 3);
  }
  function kitchen(){
    box(259, 300, 0, 4, 54, 204, [70, 70, 72]); box(254, 300, 4, 70, 52, 206, [233, 232, 228]); box(250, 300, 70, 74, 50, 208, [215, 216, 213], [196, 197, 194]);
    lines([[[253.9, 6, 103], [253.9, 68, 103]], [[253.9, 6, 155], [253.9, 68, 155]]], 'rgba(0,0,0,.25)', 1);
    lines([[[253.8, 62, 72], [253.8, 62, 92]], [[253.8, 62, 118], [253.8, 62, 140]], [[253.8, 62, 166], [253.8, 62, 190]]], 'rgba(150,155,160,.9)', 2);
    fill([[258, 74.2, 70], [292, 74.2, 70], [292, 74.2, 112], [258, 74.2, 112]], '#8C939A'); fill([[261, 74.3, 73], [289, 74.3, 73], [289, 74.3, 109], [261, 74.3, 109]], '#6B7178');
    box(293, 297, 74, 104, 86, 92, [206, 211, 217]); box(279, 297, 100, 104, 87, 91, [206, 211, 217]);
    fill([[257, 74.2, 138], [294, 74.2, 138], [294, 74.2, 198], [257, 74.2, 198]], '#1E2125');
    [[275, 155], [275, 182]].forEach(([x, z]) => decal([x, 74.4, z], [1, 0, 0], [0, 0, 1], [0, 1, 0], k => { c.strokeStyle = 'rgba(200,205,210,.55)'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 8 * k, 0, 7); c.stroke(); }));
    box(268, 300, 140, 196, 52, 206, [242, 241, 237]); lines([[[267.9, 142, 129], [267.9, 194, 129]]], 'rgba(0,0,0,.2)', 1);
  }
  const bed = () => { box(214, 300, 0, 86, 272, 277, [196, 176, 146], [184, 163, 132]); box(214, 300, 0, 26, 277, 380, [205, 186, 156], [190, 170, 140]);
    box(216, 298, 26, 42, 279, 378, [246, 245, 242], [232, 230, 226]); box(215, 299, 36, 48, 302, 380, [222, 228, 236], [206, 213, 223]); box(226, 290, 42, 52, 283, 300, [252, 252, 250], [238, 238, 236]); };

  // ── 흠: at(생기는 시점), grow(시간이 지나면 커짐), layer 'top'은 가구를 그린 뒤
  const DEF = [
    {kind:'stain', at:0, P:[20.5, 120, 104], U:[0, 0, -1], V:[0, -1, 0], n:[1, 0, 0], R:9, col:[150, 114, 62]},
    {kind:'scratch', at:0, P:[150, 74.2, 26], U:[1, 0, 0], V:[0, 0, 1], n:[0, 1, 0], L:26, layer:'top'},
    {kind:'dent', at:0, grow:1, P:[170, .3, 268], U:[1, 0, 0], V:[0, 0, 1], n:[0, 1, 0], R:2.8},
    {kind:'dent', at:2, P:[206, .3, 300], U:[1, 0, 0], V:[0, 0, 1], n:[0, 1, 0], R:2.4},
    {kind:'mold', at:0, grow:1, P:[32, 189, 20.5], U:[1, 0, 0], V:[0, -1, 0], n:[0, 0, 1], R:9},
    {kind:'soot', at:0, P:[299.5, 37, 238], U:[0, 0, 1], V:[0, -1, 0], n:[-1, 0, 0], R:7},
    {kind:'hole', at:0, grow:1, P:[20.5, 90, 334], U:[0, 0, -1], V:[0, -1, 0], n:[1, 0, 0], R:3.2},
    {kind:'scratch', at:2, P:[42, 62.2, 128], U:[0, 0, 1], V:[1, 0, 0], n:[0, 1, 0], L:20, layer:'top'},
    {kind:'burn', at:0, grow:1, P:[262, 74.4, 126], U:[1, 0, 0], V:[0, 0, 1], n:[0, 1, 0], R:5, layer:'top'},
    {kind:'stain', at:0, P:[22.6, 60, 262], U:[0, 0, -1], V:[0, -1, 0], n:[1, 0, 0], R:7, col:[140, 128, 110], layer:'closet'},
    {kind:'scratch', at:1, grow:1, P:[299.5, 64, 300], U:[0, 0, 1], V:[0, -1, 0], n:[-1, 0, 0], L:14},
  ];
  function defect(d, i, a){
    if(a < d.at) return; const g = 1 + (d.grow ? (a - d.at) * .55 : 0), r = rng(101 + i), F = PHOTO.fx;
    decal(d.P, d.U, d.V, d.n, k => { const R = (d.R || 0) * k * g, Lh = (d.L || 0) * k * g / 2, w = Math.max(.7, k * .5);
      if(d.kind === 'stain') F.stain(c, r, 0, 0, R, d.col, 1);
      else if(d.kind === 'mold') F.mold(c, r, 0, 0, R, 1);
      else if(d.kind === 'soot') F.soot(c, 0, 0, R, 1);
      else if(d.kind === 'dent' || d.kind === 'hole') F.dent(c, r, 0, 0, R, d.kind === 'hole' ? 1.3 : 1.1);
      else if(d.kind === 'scratch'){ F.scratch(c, r, -Lh, Lh * .16, Lh, -Lh * .16, w, 1); F.scratch(c, r, -Lh * .6, Lh * .36, Lh * .5, Lh * .12, w * .7, .8); }
      else if(d.kind === 'burn'){ c.save(); c.filter = `blur(${Math.max(.5, R * .1)}px)`; c.lineWidth = R * .22; c.strokeStyle = 'rgba(110,72,40,.5)'; c.beginPath(); c.ellipse(0, 0, R, R * .72, 0, 0, 7); c.stroke(); c.restore(); } });
  }

  // 지금 카메라(C)로 방 전체를 그린다. a = 흠이 진행된 정도, open = 붙박이장 문을 연 상태
  function scene(a, open){
    c.setTransform(SC, 0, 0, SC, 0, 0); c.fillStyle = '#E9E6E0'; c.fillRect(0, 0, W, H);
    shell(); floor(); edges(); lamp(); windowN(a); door(); backsplash(); outlet();
    DEF.forEach((d, i) => { if(!d.layer) defect(d, i, a); });
    shadow(20, 68, 116, 196, .15); shadow(76, 98, 144, 166, .12, 2); if(!open) shadow(20, 60, 206, 288, .14); shadow(252, 300, 52, 206, .14); shadow(214, 300, 272, 380, .18);
    const d2 = (x, y, z) => (x - C.x) ** 2 + (z - C.z) ** 2 + (y - C.h) ** 2 * .2;
    [[d2(44, 60, 156), desk], [d2(87, 40, 155), chair], [d2(40, 95, 247), () => closet(open)], [d2(277, 80, 129), kitchen], [d2(257, 30, 328), bed], [d2(293, 174, 335), aircon]]
      .sort((x, y) => y[0] - x[0]).forEach(([, fn]) => fn());
    DEF.forEach((d, i) => { if(d.layer === 'top' || (d.layer === 'closet' && open)) defect(d, i, a); });
  }
  function render(pid, a = 0){
    const key = `${pid}-${a}`; if(cache.has(key)) return cache.get(key);
    const cv = document.createElement('canvas'); cv.width = W * SC; cv.height = H * SC; c = cv.getContext('2d', {willReadFrequently:true}); C = camera(pid);
    try{ scene(a, pid === 10); PHOTO.fx.finish(c, rng(19), false); }catch(e){ console.warn('room', pid, e); }
    const out = cv.toDataURL('image/jpeg', .84); cache.set(key, out); c = null; return out;
  }

  // ── 방 전체 찍기(스캔): 방 가운데 서서 창문을 보고 시작해 오른쪽으로 제자리에서 한 바퀴 돈다
  // 15°마다 한 장씩 제대로 그려 원통 파노라마로 이어 붙여 두고, 매 프레임은 그 파노라마를 원근 화면으로 다시 투영만 한다
  // (매번 방을 새로 그리지 않아 느린 기기에서도 부드럽게 돌고, 사진 품질은 그대로)
  const SPOT = {x:160, z:214, h:124}, SPIN0 = -Math.PI / 2, STEP = Math.PI / 12, PAD = .7, TAU = Math.PI * 2;
  const SPIN = {key:'', cv:null, tmp:null, f:0, w:0, h:0, has:new Set()};
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // 스캔이 지나간 방향에만 보이는 AR 선(방 모서리·창·문·가구 윤곽)과 특징점, 바닥 격자
  const MESH = (() => {
    const E = [], G = [], pts = [], r = rng(57);
    const cut = (list, a, b, n) => { for(let i = 0; i < n; i++) list.push([lerp(a, b, i / n), lerp(a, b, (i + 1) / n)]); };
    const loop = (q, n, list = E) => q.forEach((p, i) => cut(list, p, q[(i + 1) % q.length], n));
    loop([[20, .5, 20], [300, .5, 20], [300, .5, 380], [20, .5, 380]], 16); loop([[20, CEIL, 20], [300, CEIL, 20], [300, CEIL, 380], [20, CEIL, 380]], 16);
    [[20, 20], [300, 20], [300, 380], [20, 380]].forEach(([x, z]) => cut(E, [x, 0, z], [x, CEIL, z], 6));
    loop([[104, 74, 20.5], [236, 74, 20.5], [236, 196, 20.5], [104, 196, 20.5]], 6);           // 창문
    loop([[30, 0, 379.5], [84, 0, 379.5], [84, 172, 379.5], [30, 172, 379.5]], 5);            // 현관문
    loop([[20, 62, 116], [68, 62, 116], [68, 62, 196], [20, 62, 196]], 4);                    // 책상
    loop([[60, 0, 206], [60, 0, 288], [60, 190, 288], [60, 190, 206]], 5);                    // 붙박이장
    loop([[250, 74, 50], [250, 74, 208], [250, 0, 208], [250, 0, 50]], 6);                    // 주방
    loop([[214, 42, 277], [300, 42, 277], [300, 42, 380], [214, 42, 380]], 5);                // 침대
    for(let x = 55; x < 300; x += 35) cut(G, [x, .4, 20], [x, .4, 380], 18);
    for(let z = 55; z < 380; z += 35) cut(G, [20, .4, z], [300, .4, z], 14);
    for(let i = 0; i < 300; i++){ const w = r() * 4 | 0, t = r(), y = 8 + r() * 184;
      if(i % 5 === 0) pts.push([20 + r() * 280, 0.6, 20 + r() * 360]);
      else pts.push(w === 0 ? [20 + t * 280, y, 20.6] : w === 1 ? [299.4, y, 20 + t * 360] : w === 2 ? [20 + t * 280, y, 379.4] : [20.6, y, 20 + t * 360]); }
    return {E, G, pts};
  })();
  // 카메라 자리에서 본 방향이 이미 훑은 범위(SPIN0부터 오른쪽으로 span만큼) 안이면 훑은 뒤 지난 각도, 아니면 -1
  const swept = (p, span) => { let d = Math.atan2(p[2] - C.z, p[0] - C.x) - SPIN0; d = ((d % TAU) + TAU) % TAU; return d <= span ? span - d : -1; };
  function mesh(span){
    const age = s => swept(lerp(s[0], s[1], .5), span), live = span < TAU, old = [], hot = [];
    c.lineCap = 'round';
    c.beginPath(); MESH.G.forEach(s => { if(age(s) >= 0) seg(s[0], s[1]); }); c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = .8; c.stroke();
    MESH.E.forEach(s => { const g = age(s); if(g >= 0) (live && g < .16 ? hot : old).push(s); });
    // 밝은 벽 위에서도 보이게 어두운 밑선을 깔고 흰 선을 올린다
    c.beginPath(); old.forEach(s => seg(s[0], s[1])); c.strokeStyle = 'rgba(17,19,24,.3)'; c.lineWidth = 4.2; c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
    // 방금 담은 곳은 주황으로 잠깐 빛난다
    c.beginPath(); hot.forEach(s => seg(s[0], s[1])); c.strokeStyle = 'rgba(255,90,31,.38)'; c.lineWidth = 6.5; c.stroke(); c.strokeStyle = '#FFC2A3'; c.lineWidth = 1.8; c.stroke();
    MESH.pts.forEach(p => { const g = swept(p, span); if(g < 0) return; const s = proj(p); if(!s) return;
      const fresh = live && g < .2, R = fresh ? 2.3 : 1.2;
      c.fillStyle = 'rgba(17,19,24,.28)'; c.beginPath(); c.arc(s[0], s[1], R + 1.1, 0, TAU); c.fill();
      c.fillStyle = fresh ? `rgba(255,106,44,${(1 - g / .2 * .4).toFixed(2)})` : '#fff'; c.beginPath(); c.arc(s[0], s[1], R, 0, TAU); c.fill(); });
  }
  // 휴대폰 세로 화면 카메라: 세로 화각 약 96°, 고개는 수평.
  // 수평선을 화면 높이의 39% 지점에 둬서(렌즈 시프트) 아래 안내판에 가려지는 만큼 바닥 쪽을 더 담는다. 세로선은 그대로 곧게 선다
  const HOR = .39;
  function spinCam(yaw, wpx = SPIN.w){ SC = SPIN.w / 450; W = wpx / SC; H = SPIN.h / SC; OY = (HOR - .5) * H;
    C = {x:SPOT.x, z:SPOT.z, h:SPOT.h, ca:Math.cos(yaw), sa:Math.sin(yaw), cp:1, sp:0, f:SPIN.f / SC}; }
  const spinEnd = keep => { c.setTransform(1, 0, 0, 1, 0, 0); c = null; [W, H, SC] = keep; OY = 0; };
  function spinSetup(w, h){ const key = `${w}x${h}`; if(SPIN.key === key) return;
    Object.assign(SPIN, {key, w, h, f:h / 2.3, yh:h * HOR, has:new Set()});
    SPIN.cv = document.createElement('canvas'); SPIN.cv.width = Math.ceil((TAU + PAD * 2) * SPIN.f); SPIN.cv.height = h;
    // 조각은 가운데 15° 띠만 쓰므로 그 폭(+여유)만큼만 그린다. 전체 화각으로 그릴 때보다 3배쯤 빠르다
    SPIN.tw = 2 * Math.ceil(SPIN.f * Math.tan(STEP / 2) + 8); SPIN.tmp = document.createElement('canvas'); SPIN.tmp.width = SPIN.tw; SPIN.tmp.height = h; }
  // k번째 15° 조각: 그 방향을 보고 방을 그린 뒤 가운데 세로 띠를 원통에 붙인다(한 바퀴가 이어지도록 양 끝에 한 번 더)
  function spinSlice(k){
    k = ((k % 24) + 24) % 24; if(SPIN.has.has(k)) return;
    const keep = [W, H, SC]; spinCam(SPIN0 + k * STEP, SPIN.tw); c = SPIN.tmp.getContext('2d');
    try{ scene(0, false); }catch(e){ console.warn('spin', e); } spinEnd(keep);
    const f = SPIN.f, out = SPIN.cv.getContext('2d'), hw = SPIN.tw / 2, h = SPIN.h, yh = SPIN.yh;
    [-TAU, 0, TAU].forEach(r => { const a = k * STEP + r; if(a + STEP / 2 < -PAD || a - STEP / 2 > TAU + PAD) return;
      const X0 = Math.round((a - STEP / 2 + PAD) * f), X1 = Math.round((a + STEP / 2 + PAD) * f);
      // 평면 사진 → 원통: 2px 세로 띠마다 가로 위치(tan)와 세로 배율(cos)을 맞춰 옮긴다
      for(let X = X0; X < X1; X += 2){ const th = (X + 1) / f - PAD - a, t = Math.tan(th), cs = Math.cos(th), sw = 2 * (1 + t * t);
        out.drawImage(SPIN.tmp, hw + f * t - sw / 2, 0, sw, h, X, yh * (1 - cs), 2, h * cs); } });
    SPIN.has.add(k);
  }
  // a = 처음 방향에서 돈 각도(0~2π). 원통의 세로 띠를 화면 열마다 늘려 붙여 원근 화면으로 되돌린다
  // o.swept = 지금까지 훑은 각도(그 범위에만 AR 선을 그림), o.dy = 손떨림(px)
  function spinFrame(cv, a, o = {}){
    const w = cv.width, h = cv.height; spinSetup(w, h);
    const f = SPIN.f, yh = SPIN.yh, hf = Math.atan(w / 2 / f) + STEP / 2, x = cv.getContext('2d'), S = 2, dy = o.dy || 0;
    for(let k = Math.ceil((a - hf) / STEP); k <= Math.floor((a + hf) / STEP); k++) spinSlice(k);
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#16181C'; x.fillRect(0, 0, w, h);
    for(let i = 0; i < w; i += S){ const t = (i + S / 2 - w / 2) / f, k = Math.sqrt(1 + t * t), sw = S / (1 + t * t), u = (a + Math.atan(t) + PAD) * f;
      x.drawImage(SPIN.cv, u - sw / 2, 0, sw, h, i, yh * (1 - k) + dy, S, h * k); }
    if(o.swept > 0 && o.swept < TAU){   // 아직 담지 않은 쪽(가운데 선의 오른쪽, 처음엔 왼쪽 끝도)은 살짝 어둡게
      const hv = Math.atan(w / 2 / f), col = t => w / 2 + f * Math.tan(Math.max(-hv, Math.min(hv, t))); x.fillStyle = 'rgba(10,12,16,.24)';
      x.fillRect(w / 2, 0, col(TAU - o.swept) - w / 2, h); if(o.swept < hv) x.fillRect(0, 0, col(-o.swept), h); }
    if(o.swept > 0){ const keep = [W, H, SC]; spinCam(SPIN0 + a); c = x; c.setTransform(SC, 0, 0, SC, 0, dy);
      try{ mesh(Math.min(TAU, o.swept)); }catch(e){ console.warn('mesh', e); } spinEnd(keep); }
  }
  // 나머지 조각은 쉬는 시간에 미리 그려 둔다(도는 방향 순서대로)
  function spinWarm(){ if(SPIN.warming) return; SPIN.warming = true; const idle = window.requestIdleCallback || (f => setTimeout(f, 50));
    const step = () => { if(SPIN.cv) for(let k = 0; k < 24; k++) if(!SPIN.has.has(k)){ spinSlice(k); return idle(step); } SPIN.warming = false; }; idle(step); }
  const spinFree = () => { SPIN.key = ''; SPIN.cv = SPIN.tmp = null; SPIN.has = new Set(); };
  // 파노라마 띠: 돈 만큼(0 → a)만, 수평선 위아래 30°
  function spinStrip(out, a){ if(!SPIN.cv) return; const f = SPIN.f, vh = f * Math.tan(Math.PI / 6), x = out.getContext('2d'), pa = Math.min(a, TAU);
    for(let k = 0; (k - .5) * STEP < pa; k++) spinSlice(k);
    x.clearRect(0, 0, out.width, out.height); if(pa > 0) x.drawImage(SPIN.cv, PAD * f, SPIN.yh - vh, pa * f, vh * 2, 0, 0, pa / TAU * out.width, out.height); }
  // 쉬는 시간에 사진을 미리 그려 두어 화면 전환이 끊기지 않게 한다
  function warm(list){
    const q = (list || [0, 2, 1].flatMap(a => ALL.map(pid => [pid, a]))).filter(([pid, a]) => !cache.has(`${pid}-${a}`));
    const idle = window.requestIdleCallback || (f => setTimeout(f, 60));
    const step = () => { const j = q.shift(); if(!j) return; render(j[0], j[1]); idle(step); }; idle(step);
  }
  return {render, warm, spinFrame, spinWarm, spinStrip, spinFree, SPOT, has:(pid, a = 0) => cache.has(`${pid}-${a}`)};
})();
