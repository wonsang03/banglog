'use strict';
/* 방로그 — 아이콘 · 도면(SVG) · 보관 도장 */

const ICONS = {
  home:'<path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z"/>',
  stack:'<path d="M12 3.5 21 8.5l-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  camera:'<path d="M4 8h3l1.6-2.4A1.5 1.5 0 0 1 9.9 5h4.2a1.5 1.5 0 0 1 1.3.6L17 8h3a1 1 0 0 1 1 1v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.6"/>',
  bell:'<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  doc:'<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9.5 13h5M9.5 16.5h5"/>',
  chevL:'<path d="m14.5 5-7 7 7 7"/>', chevR:'<path d="m9.5 5 7 7-7 7"/>', close:'<path d="M6 6l12 12M18 6 6 18"/>', check:'<path d="M5 12.5 9.5 17 19 7.5"/>',
  stand:'<circle cx="12" cy="4.8" r="2"/><path d="M12 8.5v5.5m0 0-3 7m3-7 3 7M7.5 11h9"/>',
  eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  list:'<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>',
  share:'<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>',
  download:'<path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  image:'<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/>',
  overlay:'<rect x="3.5" y="3.5" width="12" height="12" rx="2"/><rect x="8.5" y="8.5" width="12" height="12" rx="2"/>',
  shield:'<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.4 7.5 9.5 4.4-1.1 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.3 2.3 4.3-4.6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8M12 17h.01"/>',
  scan:'<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M4 12h16"/>',
  wrench:'<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.5-.5-.5-2.5z"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  plan:'<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 13H11v7.5M11 3.5V9M15 13h5.5"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
  skip:'<path d="M5 6l7 6-7 6zM13 6l7 6-7 6z"/>',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

// 글자 폭 대략 계산(한글 11.2, 영숫자 6.4)
const textW = t => [...t].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? 11.2 : 6.4), 0);

/* 도면
   session: 완료 표시 기준 기록 / sel: 선택 자리 / ids: 표시할 자리 / interactive: 핀을 눌러 고를 수 있음
   marked: 여러 개 선택(점검) / cone: 바라볼 방향 / callout: 선택 자리 이름표 / anim: 그려지는 연출 */
function planSVG({session = null, sel = null, ids = null, interactive = false, marked = null, cone = true, callout = true, anim = false, cones = false, cls = ''} = {}){
  const list = POINTS.filter(p => !ids || ids.includes(p.id));
  const sp = sel ? P(sel) : null;
  const L = (x, y, t, c = '') => `<text class="pl-lbl ${c}" x="${x}" y="${y}">${t}</text>`;
  let s = `<svg class="plan ${anim ? 'anim' : ''} ${cls}" viewBox="0 0 320 400" role="img" aria-label="스캔으로 만든 원룸 도면. 번호 핀은 촬영할 때 서는 자리입니다.">
  <defs><pattern id="pl-tile" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" fill="none" stroke="var(--line-2)" stroke-width=".6"/></pattern>
  <pattern id="pl-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="var(--line-2)" stroke-width="1"/></pattern>
  ${sp && cone ? `<linearGradient id="pl-cone" gradientUnits="userSpaceOnUse" x1="${sp.sx}" y1="${sp.sy}" x2="${sp.tx}" y2="${sp.ty}"><stop offset="0" stop-color="var(--accent)" stop-opacity=".4"/><stop offset="1" stop-color="var(--accent)" stop-opacity=".06"/></linearGradient>` : ''}</defs>
  <rect class="pl-floor" x="20" y="20" width="280" height="360"/>
  <rect x="20" y="330" width="76" height="50" fill="url(#pl-tile)" class="pl-fade"/>
  <g class="pl-furn pl-fade">
    <rect x="20" y="120" width="46" height="72" rx="2"/><circle cx="86" cy="156" r="10"/>
    <rect x="20" y="206" width="40" height="82" rx="1"/><rect x="20" y="206" width="40" height="82" fill="url(#pl-hatch)" stroke="none"/>
    <rect x="252" y="52" width="48" height="154" rx="2"/><rect class="pl-in" x="260" y="70" width="32" height="42" rx="6"/><circle class="pl-in" cx="276" cy="150" r="9"/><circle class="pl-in" cx="276" cy="178" r="9"/>
    <rect x="214" y="276" width="86" height="104" rx="4"/><rect class="pl-in" x="222" y="284" width="70" height="22" rx="6"/>
  </g>
  <g class="pl-fade">${L(43, 160, '책상')}${L(40, 251, '붙박이장', 'xs')}${L(276, 222, '주방')}${L(257, 348, '침대')}${L(138, 36, '창문')}${L(50, 375, '현관')}${L(178, 186, '18㎡', 'xs')}</g>
  <path class="pl-wall" d="M110 16H16V384H28M84 384H304V16H230"/>
  <rect class="pl-win" x="110" y="12.5" width="120" height="7"/><line class="pl-winl" x1="110" y1="16" x2="230" y2="16"/>
  <path class="pl-door" d="M84 380A54 54 0 0 0 30 326"/><line class="pl-leaf" x1="30" y1="380" x2="30" y2="326"/>`;

  // 핀 전체의 시야(방이 빠짐없이 담기는지 보여 주기)
  if(cones) list.forEach((p, i) => { const a = Math.atan2(p.ty - p.sy, p.tx - p.sx), d = Math.min(150, Math.hypot(p.tx - p.sx, p.ty - p.sy)), w = .5;
    const p1 = [p.sx + Math.cos(a - w) * d, p.sy + Math.sin(a - w) * d], p2 = [p.sx + Math.cos(a + w) * d, p.sy + Math.sin(a + w) * d];
    s += `<path class="pl-cov" style="--d:${300 + i * 70}ms" d="M${p.sx} ${p.sy}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}A${d.toFixed(1)} ${d.toFixed(1)} 0 0 1 ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}Z"/>`; });
  if(sp && cone && list.includes(sp)){
    const a = Math.atan2(sp.ty - sp.sy, sp.tx - sp.sx), d = Math.hypot(sp.tx - sp.sx, sp.ty - sp.sy), w = .36;
    const p1 = [sp.sx + Math.cos(a - w) * d, sp.sy + Math.sin(a - w) * d], p2 = [sp.sx + Math.cos(a + w) * d, sp.sy + Math.sin(a + w) * d];
    s += `<path class="pl-cone" d="M${sp.sx} ${sp.sy}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}A${d.toFixed(1)} ${d.toFixed(1)} 0 0 1 ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}Z" fill="url(#pl-cone)"/>
      <g class="pl-target" transform="translate(${sp.tx} ${sp.ty})"><circle r="6"/><circle class="dot" r="1.8"/></g>`;
  }
  list.forEach((p, i) => {
    const dn = isDone(session, p.id), sk = !!(session && (session.skipped || []).includes(p.id) && !dn), on = sel === p.id, mk = !!(marked && marked.has(p.id));
    const state = dn ? '촬영 완료' : sk ? '건너뜀' : '촬영 전';
    s += `<g class="pin${p.hid ? ' hid' : ''}${dn ? ' done' : ''}${sk ? ' skip' : ''}${on ? ' sel' : ''}${mk ? ' mk' : ''}" transform="translate(${p.sx} ${p.sy})" style="--d:${300 + i * 70}ms"
      ${interactive ? `tabindex="0" role="button" data-pid="${p.id}"` : ''} aria-label="${p.id}번 ${p.name}${p.hid ? ', 놓치기 쉬운 곳' : ''}, ${state}${mk ? ', 선택됨' : ''}">
      <g class="pin-in">${on ? '<circle class="pin-halo" r="21"/>' : ''}${mk ? '<circle class="pin-mk" r="17"/>' : ''}<circle class="pin-hit" r="20"/><circle class="pin-bg" r="11.5"/><text class="pin-num" y="4">${p.id}</text>
      ${dn ? '<g class="pin-ok" transform="translate(8.5 -8.5)"><circle r="5.6"/><path d="M-2.5 .1l1.7 1.7L2.7-1.9"/></g>' : ''}${mk ? '<g class="pin-ok mk" transform="translate(8.5 -8.5)"><circle r="5.6"/><path d="M-2.5 .1l1.7 1.7L2.7-1.9"/></g>' : ''}</g></g>`;
  });
  if(sp && callout && list.includes(sp)){
    const t = `${sp.id}  ${sp.name}`, w = textW(t) + 22;
    let x = Math.min(Math.max(sp.sx, w / 2 + 4), 316 - w / 2), y = sp.sy - 31; if(y < 16) y = sp.sy + 31;
    s += `<g class="pl-callout" transform="translate(${x.toFixed(1)} ${y})"><rect x="${(-w / 2).toFixed(1)}" y="-12" width="${w.toFixed(1)}" height="24" rx="12"/><text y="4.3">${esc(t)}</text></g>`;
  }
  return s + '</svg>';
}
const planLegend = () => `<div class="legend"><span><i class="lg-a"></i>찍을 자리</span><span><i class="lg-h"></i>놓치기 쉬운 곳</span><span><i class="lg-d"></i>찍음</span></div>`;

// 보관 도장: 가장자리에 날짜가 둘러 새겨진 원형 도장
let sealN = 0;
function sealSVG(ts){
  const id = `seal-${++sealN}`;
  return `<svg class="seal" viewBox="0 0 120 120" role="img" aria-label="보관 완료 ${fmt(ts)}">
    <defs><path id="${id}" d="M60 60m-45 0a45 45 0 1 1 90 0a45 45 0 1 1-90 0"/></defs>
    <circle class="s1" cx="60" cy="60" r="56"/><circle class="s2" cx="60" cy="60" r="34"/>
    <text class="s-ring"><textPath href="#${id}" textLength="279" lengthAdjust="spacing">방로그 보관 기록 · ${fmtD(ts)} · 방로그 보관 기록 · ${fmtD(ts)} ·</textPath></text>
    <path class="s-check" d="M46.5 60.5l9 9L75 50"/></svg>`;
}
