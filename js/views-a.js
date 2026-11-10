'use strict';
/* 방로그 — 화면(1): 온보딩 · 홈 · 방 전체 촬영(스캔) · 핀 따라 촬영 안내
   각 화면은 {bar, html, tabs, dark, full, noBar, large, after}를 돌려준다. */

const VIEWS = {};
const empty = (ic, title, desc, cta = '') => `<div class="empty"><div class="empty-ic">${icon(ic)}</div><h2 class="head">${title}</h2><p class="sub">${desc}</p>${cta ? `<div class="mt-20">${cta}</div>` : ''}</div>`;
const backBar = (title, to = 'home', side = '') => `<button class="btn-icon plain" data-go="${to}" aria-label="뒤로">${icon('chevL')}</button><div class="ttl">${title}</div><div class="side">${side}</div>`;

// ── 온보딩: 서비스 흐름 4단계
const OB = [
  {t:'처음엔 방 전체를<br>한 바퀴 찍어요', d:'어디를 어떻게 찍을지 몰라도 괜찮아요. 입주 날 방을 천천히 한 바퀴 비추면, 방 구조를 파악해 도면을 만들어요.',
   art:() => `<div class="ob-card">${planSVG({anim:true, ids:[], cone:false})}</div>`},
  {t:'찍기 좋은 자리에<br>핀을 꽂아 드려요', d:'방 전체가 빠짐없이 담기는 자리 10곳을 골라요. 핀은 내가 설 자리, 부채꼴은 카메라를 향할 방향이에요.',
   art:() => `<div class="ob-card">${planSVG({anim:true, cones:true, cone:false, callout:false})}</div>`},
  {t:'핀마다 한 장씩<br>기준 사진을 남겨요', d:'찍는 순간 촬영 일시와 보관 번호가 함께 남아요. 흠이 보이면 가까이 한 장을 덧붙일 수도 있어요.',
   art:() => `<div class="ob-photo"><img alt="" src="${PHOTO.url(2, 'wide', 0)}"><div class="ob-seal">${sealSVG(Date.now())}</div><div class="ob-meta glass"><b>2  창문 쪽 벽</b><span class="num">${fmt(Date.now())}</span></div></div>`},
  {t:'1년 뒤에도, 퇴실 날에도<br>같은 자리에서 똑같이', d:'점검 때가 되면 같은 핀에서 이전 사진을 겹쳐 보며 똑같이 찍어요. 두 사진을 밀어 보면 달라진 곳이 바로 보여요.',
   art:() => `<div class="ob-compare compare auto"><img alt="" src="${PHOTO.url(2, 'wide', 2)}"><img class="before" alt="" src="${PHOTO.url(2, 'wide', 0)}"><i class="knob"></i><span class="lb l">입주</span><span class="lb r">1년 뒤</span></div>`},
];
VIEWS.onboard = () => {
  const i = ui.ob, from = ui.obFrom ?? i;
  return {tabs:false, full:true, noBar:true, html:`<div class="ob">
    <div class="ob-top"><span class="brand">${icon('home')}방로그</span><button class="btn-text" data-act="obSkip">${S.onboarded ? '닫기' : '건너뛰기'}</button></div>
    <div class="ob-view" id="obView"><div class="ob-track" id="obTrack" style="transform:translateX(${-from * 100}%)">
      ${OB.map((s, k) => `<section class="ob-slide${k === i ? ' on' : ''}" aria-hidden="${k !== i}"><div class="ob-art">${s.art()}</div>
        <div class="ob-copy"><h2 class="display">${s.t}</h2><p class="body t-2 mt-12">${s.d}</p></div></section>`).join('')}
    </div></div>
    <div class="ob-foot">
      <div class="ob-dots" role="tablist" aria-label="안내 단계">${OB.map((_, k) => `<button role="tab" aria-selected="${k === i}" aria-label="${k + 1}단계" data-ob="${k}"></button>`).join('')}</div>
      ${i < OB.length - 1 ? `<button class="btn btn-block" data-act="obNext">다음</button>` : `<button class="btn btn-block btn-accent" data-act="obStart">방 전체 찍기 시작</button>`}
      <button class="btn-text ob-later ${i < OB.length - 1 ? 'hide' : ''}" data-act="obSkip">먼저 둘러볼게요</button>
    </div></div>`,
    after(){ if(from !== i) requestAnimationFrame(() => requestAnimationFrame(() => { const t = $('#obTrack'); if(t) t.style.transform = `translateX(${-i * 100}%)`; })); ui.obFrom = i; }};
};

// ── 홈: 지금 할 일 하나 + 계약 기간 타임라인 + 핀별 최근 사진
const addYear = (t, n) => { const d = new Date(t); d.setFullYear(d.getFullYear() + n); return d.getTime(); };
const fmtS = t => { const d = new Date(t); return `${String(d.getFullYear()).slice(2)}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; };
function leaseCard(m){
  const start = m.date, end = Math.max(addYear(start, 2), ...S.sessions.map(s => s.date)), now = Date.now(), pos = t => Math.max(0, Math.min(100, (t - start) / (end - start) * 100));
  const nodes = sorted().map(s => ({t:s.date, label:TYPE[s.type]}));
  const due = addYear(start, 1); if(!S.sessions.some(s => s.type !== 'movein' && Math.abs(s.date - due) < 60 * 864e5)) nodes.push({t:due, label:'정기 점검', plan:1});
  nodes.push({t:addYear(start, 2), label:'계약 만료', plan:1}); nodes.sort((x, y) => x.t - y.t);
  return `<section class="card lease"><div class="row between"><h2 class="head">계약 기간</h2><span class="cap num">${fmtS(start)} ~ ${fmtS(addYear(start, 2))}</span></div>
    <div class="lease-track"><i class="lease-bar"></i><i class="lease-fill" style="width:${pos(now).toFixed(1)}%"></i>
    ${nodes.map((n, i) => { const x = pos(n.t); return `<span class="lease-node ${n.plan ? 'plan' : 'on'} ${i % 2 ? 'dn' : 'up'} ${x < 12 ? 'l' : x > 88 ? 'r' : ''}" style="left:${x.toFixed(1)}%"><i></i><b>${n.label}</b><em class="num">${fmtS(n.t)}</em></span>`; }).join('')}
    ${nodes.some(n => Math.abs(pos(n.t) - pos(now)) < 3) ? '' : `<span class="lease-now" style="left:${pos(now).toFixed(1)}%"></span>`}</div></section>`;
}
VIEWS.home = () => {
  const m = moveIn(), c = cur(), out = S.sessions.find(s => s.type === 'moveout' && s.closed);
  let chip, title, desc, cta, prog = '';
  if(!S.scanned){
    chip = ['', '첫 단계']; title = '입주 날, 방 전체부터 찍어요'; desc = '어디를 찍을지 몰라도 괜찮아요. 방을 한 바퀴 비추면 찍기 좋은 자리를 정해 드려요.';
    cta = `<button class="btn btn-block btn-accent" data-go="scan">${icon('scan')}방 전체 찍기</button>`;
  } else if(c){
    const ids = c.ids || ALL, k = doneCount(c, ids);
    chip = ['accent', `${TYPE[c.type]} 촬영 중`]; title = `핀 ${ids.length}곳 중 ${k}곳을 찍었어요`; desc = c.type === 'movein' ? '남은 핀부터 이어서 안내해 드려요.' : '입주 때와 같은 자리, 같은 구도로 이어서 찍어요.';
    prog = `<div class="segbar mt-16" style="--n:${ids.length}">${ids.map(id => `<i class="${isDone(c, id) ? 'done' : ''}"></i>`).join('')}</div>`;
    cta = `<button class="btn btn-block btn-accent" data-go="guide">이어서 촬영하기</button>`;
  } else if(!m){
    chip = ['', '핀 10곳 준비 완료']; title = '이제 핀마다 기준 사진을 찍어요'; desc = '도면에 꽂힌 10곳을 순서대로 안내해 드려요. 10분 정도 걸려요.';
    cta = `<button class="btn btn-block btn-accent" data-act="startMoveIn">입주 촬영 시작하기</button>`;
  } else if(out){
    chip = ['ok', '퇴실 기록 완료']; title = '입주와 퇴실을 같은 자리에서 찍었어요'; desc = '핀을 고르고 두 사진을 밀어 보면 무엇이 달라졌는지 보여요.';
    cta = `<button class="btn btn-block" data-go="records">자리별로 비교하기</button>`;
  } else {
    chip = ['ok', '보관됨']; title = '입주 기준 사진을 보관했어요'; desc = `핀 ${doneCount(m)}곳을 찍었어요. 1년 뒤 같은 자리에서 다시 찍도록 알려 드려요.`;
    cta = `<button class="btn btn-block" data-go="records">기록 보기</button>`;
  }
  const last = sorted().filter(s => shotOf(s, 1, 'wide')).pop();
  const media = last ? lazyImg(shotOf(last, 1, 'wide'), '방 전체 사진', 'hero-img')
    : `<div class="hero-plan">${planSVG({cone:false, callout:false, cones:S.scanned, ids:S.scanned ? null : [], cls:S.scanned ? 'mini' : 'mini ghosted'})}</div>`;
  const strip = S.scanned ? `<div class="sec-title"><h2>핀별 최근 사진</h2>${S.sessions.length ? '<button class="btn-text" data-go="records">기록 보기</button>' : ''}</div>
    <div class="strip">${POINTS.map(p => { const h = historyOf(p.id), l = h[h.length - 1];
      return `<button class="strip-item" data-pin="${p.id}"><span class="strip-ph">${l ? lazyImg(l.shot) : icon('camera')}<span class="pnum sm ${p.hid ? 'hid' : ''}">${p.id}</span></span>
        <b>${p.name}</b><span class="cap">${l ? `${TYPE[l.s.type]}, ${fmtS(l.shot.ts)}` : '아직 안 찍었어요'}</span></button>`; }).join('')}</div>` : '';
  const cell = (go, ic, t, d) => `<button class="cell" data-go="${go}"><span class="ico">${icon(ic)}</span><span class="grow"><b class="head">${t}</b><span class="cap" style="display:block">${d}</span></span>${icon('chevR', 'chev')}</button>`;
  return {tabs:true, noBar:true, html:`
    <header class="home-head"><div><p class="cap">내 방</p><h1 class="title">${S.room}</h1></div><button class="btn-icon" data-go="onboard" aria-label="사용법 보기">${icon('help')}</button></header>
    <section class="hero-card${last ? ' has-photo' : ''}">
      <div class="hero-media">${media}${last ? `<span class="hero-tag">${icon('camera')}1. 방 전체, ${TYPE[last.type]} ${fmtS(last.date)}</span>` : ''}</div>
      <div class="hero-body"><span class="chip ${chip[0] ? 'chip-' + chip[0] : ''}"><span class="dot"></span>${chip[1]}</span>
        <h2 class="title mt-12">${title}</h2><p class="sub mt-4">${desc}</p>${prog}<div class="mt-20">${cta}</div></div>
    </section>
    ${m ? leaseCard(m) : ''}
    ${strip}
    <div class="sec-title"><h2>바로 가기</h2></div>
    <div class="group">${cell('checkup', 'refresh', '같은 자리 다시 찍기', '정기 점검, 계약 연장, 퇴실, 수리 요청')}${cell('export', 'doc', '확인서 만들기', 'PDF나 링크로 보내기')}${cell('onboard', 'help', '사용법', '4단계 안내 다시 보기')}</div>
    <div class="demo"><div class="grow"><b class="head">체험용 예시 데이터</b><p class="cap mt-4">1년 전 입주, 정기 점검, 오늘 퇴실까지 같은 핀에서 찍은 기록이에요.</p></div>
      <div class="row"><button class="btn btn-sm btn-tonal" data-act="seed">불러오기</button><button class="btn btn-sm btn-ghost" data-act="reset">비우기</button></div></div>
    <p class="cap foot">방 구조 파악과 공인전자문서센터 보관은 구현을 가정한 모의 기능이에요. 보관 표시는 법적 효력을 보장하지 않고, 시점과 원본이 추정되는 기록을 남기는 것을 목표로 해요.</p>`};
};

// ── 방 전체 찍기(스캔): 방 가운데 서서 창문을 보고 시작해, 오른쪽으로 제자리에서 한 바퀴(360°) 돈다
// 진행(ui.scan 0~100)은 app.js scanTick이 시간 기준으로 올리고, 화면은 다시 만들지 않고 scanPaint가 그림만 갱신한다
const SCAN_MS = 9000;
const SCAN_TIPS = ['오른쪽으로 천천히 돌아요', '좋아요, 계속 돌아 주세요', '반 바퀴 지났어요', '처음 본 창문까지 돌아요'];
// 돈 각도 → 지금 화면 가운데에 담기는 곳(방 가운데에서 본 방향)
const SCAN_FACE = [[33, '창문 쪽 벽'], [88, '주방'], [112, '콘센트 쪽 벽'], [190, '침대 쪽 벽'], [228, '현관'], [278, '붙박이장'], [322, '책상'], [361, '창문 쪽 벽']];
const scanFace = deg => SCAN_FACE.find(([d]) => deg < d)[1];
const scanTip = p => SCAN_TIPS[Math.min(3, Math.floor(p / 25))];
const calmMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// 레이더: 위에서 본 방. 가운데가 나, 부채꼴이 지금 보는 방향, 훑은 만큼 도면이 드러난다
const RD = .19, RD_R = 46, RD_A0 = -90;
const rdPt = (deg, r) => `${(Math.cos(deg * Math.PI / 180) * r).toFixed(2)} ${(Math.sin(deg * Math.PI / 180) * r).toFixed(2)}`;
const rdSector = (a0, a1, r = RD_R) => a1 - a0 >= 359.9 ? `M${-r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`
  : a1 - a0 <= .01 ? 'M0 0' : `M0 0L${rdPt(a0, r)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${rdPt(a1, r)}Z`;
function radarSVG(p){
  const S0 = ROOM.SPOT, X = x => ((x - S0.x) * RD).toFixed(1), Z = z => ((z - S0.z) * RD).toFixed(1);
  const rect = (x0, z0, x1, z1, cls) => `<rect class="${cls}" x="${X(x0)}" y="${Z(z0)}" width="${((x1 - x0) * RD).toFixed(1)}" height="${((z1 - z0) * RD).toFixed(1)}"/>`;
  const a = RD_A0 + p * 3.6;
  return `<svg class="radar" viewBox="-50 -50 100 100" aria-hidden="true">
    <defs><clipPath id="rdClip"><circle r="${RD_R}"/></clipPath><mask id="rdMask"><path id="rdSweepM" fill="#fff" d="${rdSector(RD_A0, a)}"/></mask>
      <radialGradient id="rdCg" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="${RD_R}"><stop offset="0" stop-color="#FF5A1F" stop-opacity=".8"/><stop offset="1" stop-color="#FF5A1F" stop-opacity=".05"/></radialGradient></defs>
    <circle class="rd-bg" r="${RD_R}"/>
    <g clip-path="url(#rdClip)"><path class="rd-sweep" id="rdSweep" d="${rdSector(RD_A0, a)}"/>
      <g class="rd-ghost">${rect(20, 20, 300, 380, 'rd-wall')}</g>
      <g class="rd-room" mask="url(#rdMask)">${rect(20, 116, 68, 196, 'rd-f')}${rect(20, 206, 60, 288, 'rd-f')}${rect(250, 50, 300, 208, 'rd-f')}${rect(214, 272, 300, 380, 'rd-f')}${rect(20, 20, 300, 380, 'rd-wall')}
        <line class="rd-win" x1="${X(110)}" y1="${Z(20)}" x2="${X(230)}" y2="${Z(20)}"/></g>
      <path class="rd-cone" id="rdCone" fill="url(#rdCg)" transform="rotate(${a.toFixed(1)})" d="M0 0L${rdPt(-31, RD_R)}A${RD_R} ${RD_R} 0 0 1 ${rdPt(31, RD_R)}Z"/></g>
    <circle class="rd-ring" r="${RD_R}"/><circle class="rd-me" r="3.6"/></svg>`;
}
const SCAN_GO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
VIEWS.scan = () => {
  const p = ui.scan, run = p > 0 && p < 100, done = p >= 100, deg = Math.round(p * 3.6);
  return {tabs:false, dark:true, full:true, noBar:true, after:scanPaint, html:`<div class="scan ${run ? 'run' : ''} ${done ? 'done' : ''}" id="scan">
    <canvas class="scan-cv" id="scanCv" role="img" aria-label="방 가운데에서 본 방 안 모습"></canvas><div class="scan-shade"></div>
    ${run ? `<div class="scan-aim" aria-hidden="true"></div><div class="scan-go" aria-hidden="true">${SCAN_GO.repeat(3)}</div>` : ''}
    <div class="scan-top"><button class="btn-icon glass" data-go="home" aria-label="닫기">${icon('close')}</button><span class="chip chip-glass">${done ? '방 구조 파악 완료' : run ? '방 구조 파악 중' : '방 전체 찍기'}</span><span style="width:40px"></span></div>
    ${done ? '' : `<div class="scan-panel glass">${run
      ? `<div class="scan-row">${radarSVG(p)}<div class="grow"><p class="scan-deg num" aria-hidden="true"><b id="scanDeg">${deg}</b>°<span> / 360°</span></p>
          <p class="head" id="scanTip" role="status">${scanTip(p)}</p><p class="cap scan-face" id="scanFace">지금 담는 곳: ${scanFace(deg)}</p></div></div>
        <div class="pano" aria-hidden="true"><canvas id="pano" width="960" height="176"></canvas><i id="panoHead" style="--p:${p}"></i></div>`
      : `<div class="scan-row">${radarSVG(0)}<div class="grow"><h2 class="head">방 가운데에 서서<br>한 바퀴 돌아 주세요</h2></div></div>
         <p class="sub mt-12" style="color:#ffffffc0">휴대폰을 가슴 높이로 들고, 제자리에서 오른쪽으로 천천히 360° 돌면 돼요. 이렇게 찍은 화면으로 방 구조를 파악하고, 찍기 좋은 자리를 정해요.</p>
         <button class="btn btn-block btn-white mt-16" data-act="scanStart">찍기 시작</button><p class="cap mt-12" style="color:#ffffff90">모의 화면이에요. 실제로는 휴대폰의 공간 인식으로 도면을 만든다고 가정했어요.</p>`}</div>`}
    ${done ? `<div class="scan-result"><div class="handle"></div><h2 class="title">찍기 좋은 자리 10곳을 정했어요</h2>
      <p class="sub mt-4">한 바퀴 찍은 화면으로 방 구조(약 18㎡)를 파악하고, 이 자리에서 찍으면 방 전체가 빠짐없이 담기도록 핀을 꽂았어요. 다음 점검 때도 같은 핀에서 찍어요.</p>
      <div class="res-plan">${planSVG({anim:true, cones:true, cone:false, callout:false})}</div>
      <button class="btn btn-block btn-accent" data-act="scanOk">핀 따라 촬영 시작</button><button class="btn-text btn-block" data-act="scanAgain">다시 찍기</button></div>` : ''}
  </div>`};
};
// 지금 각도의 방 화면(훑은 쪽에만 AR 선), 파노라마 띠, 레이더, 문구를 갱신한다
function scanPaint(){
  const cv = $('#scanCv'); if(!cv) return;
  const p = ui.scan, run = p > 0 && p < 100, done = p >= 100, TAU = Math.PI * 2, calm = calmMotion();
  // 처음 들어올 때는 안내판부터 띄우고, 카메라 화면은 바로 뒤에 켠다
  if(!run && !done && !cv.dataset.on){ cv.dataset.on = 1; return void setTimeout(scanPaint, 40); }
  const res = Math.min(1.5, window.devicePixelRatio || 1, 1100 / (cv.clientHeight || 1));
  const w = Math.round(cv.clientWidth * res), h = Math.round(cv.clientHeight * res); if(!w || !h) return;
  if(cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
  // 도는 화면은 실제 앱의 카메라 화면을 대신하는 내용이라 '움직임 줄이기'에서도 그대로 보여 주고, 손떨림 같은 장식만 뺀다
  const a = p / 100 * TAU;
  ROOM.spinFrame(cv, a, {swept:run || done ? a : 0, dy:run && !calm ? Math.sin(p * .9) * 2.5 * res : 0});
  if(!run){ cv.classList.add('ready'); if(!done) ROOM.spinWarm(); return; }
  const vis = $('#pano'); if(vis) ROOM.spinStrip(vis, p / 100 * TAU);
  const deg = Math.round(p * 3.6), ra = RD_A0 + p * 3.6, sw = rdSector(RD_A0, ra);
  const set = (id, fn) => { const el = document.getElementById(id); if(el) fn(el); };
  const text = (id, t) => set(id, el => { if(el.textContent !== t) el.textContent = t; });
  text('scanDeg', String(deg)); text('scanTip', scanTip(p)); text('scanFace', `지금 담는 곳: ${scanFace(deg)}`);
  set('panoHead', el => el.style.setProperty('--p', p)); set('rdSweep', el => el.setAttribute('d', sw)); set('rdSweepM', el => el.setAttribute('d', sw));
  set('rdCone', el => el.setAttribute('transform', `rotate(${ra.toFixed(1)})`));
}

// ── 핀 따라 촬영 안내: 도면 + 선택한 핀 정보(바텀 시트)
VIEWS.guide = () => {
  if(!S.scanned) return {bar:backBar('촬영'), tabs:true, html:empty('scan', '먼저 방 전체를 찍어 주세요', '방 구조를 알아야 찍기 좋은 자리에 핀을 꽂을 수 있어요.', `<button class="btn btn-accent" data-go="scan">방 전체 찍기</button>`)};
  const ses = cur();
  if(!ses){
    const m = moveIn();
    if(m) return {bar:backBar('촬영'), tabs:true, html:empty('refresh', '입주 기준 사진을 보관하고 있어요', '정기 점검, 계약 연장, 퇴실 때 같은 핀에서 같은 구도로 다시 찍어요.', `<button class="btn btn-accent" data-go="checkup">같은 자리 다시 찍기</button>`)};
    return {bar:backBar('입주 촬영'), tabs:false, html:`<div class="start"><div class="start-plan">${planSVG({cones:true, cone:false, callout:false})}</div>
      <h2 class="title mt-20">입주 기준 사진을 찍을까요?</h2><p class="sub mt-8">도면의 핀 10곳을 순서대로 안내해 드려요. 방 전체를 덮는 6곳을 먼저 찍고, 놓치기 쉬운 4곳은 마지막에 챙겨요.</p>
      <div class="note mt-16">${icon('clock')}<span>핀마다 한 장씩, 10분 정도 걸려요. 짐을 들이기 전에 찍는 게 가장 좋아요.</span></div>
      <button class="btn btn-block btn-accent mt-20" data-act="startMoveIn">촬영 시작하기</button></div>`};
  }
  const ids = ses.ids || ALL, skipped = ses.skipped || [], again = ses.type !== 'movein';
  const left = ids.filter(id => !isDone(ses, id)), todo = left.filter(id => !skipped.includes(id));
  if(!ui.sel || !ids.includes(ui.sel)) ui.sel = todo[0] || left[0] || ids[0];
  const p = P(ui.sel), dn = isDone(ses, p.id), k = ids.length - left.length;
  const hidLeft = left.filter(id => P(id).hid).length, visLeft = left.length - hidLeft, allDone = !left.length;
  const ref = again ? refShot(p.id) : null;
  const banner = allDone ? '' : (!visLeft && hidLeft) ? `<div class="note accent mb-12">${icon('info')}<span>방 전체를 덮는 자리는 다 찍었어요. 이제 <b>놓치기 쉬운 ${hidLeft}곳</b>만 남았어요.</span></div>`
    : (!todo.length && left.length) ? `<div class="note accent mb-12">${icon('info')}<span>건너뛴 핀 ${left.length}곳이 남았어요. 지금 찍거나 촬영을 마칠 수 있어요.</span></div>` : '';
  const sheet = allDone
    ? `<div class="done-mini"><span class="done-ic">${icon('check')}</span><div><h2 class="title">핀 ${ids.length}곳을 모두 찍었어요</h2><p class="sub mt-4">촬영을 마치면 기록을 보관하고 시각을 확정해요.</p></div></div>
       <button class="btn btn-block btn-accent mt-16" data-act="finish">촬영 마치고 보관하기</button>`
    : `${banner}<div class="row top between"><div class="grow"><p class="cap">${p.hid ? '놓치기 쉬운 곳' : '방 전체를 덮는 자리'}, ${ids.indexOf(p.id) + 1}번째</p><h2 class="title">${p.id}. ${p.name}</h2></div>${dn ? '<span class="chip chip-ok">찍음</span>' : skipped.includes(p.id) ? '<span class="chip">건너뜀</span>' : ''}</div>
       <div class="g-info mt-12"><div class="facts"><div class="fact">${icon('stand')}<div><p class="cap">서는 곳</p><p class="body">${p.stand}</p></div></div><div class="fact">${icon('eye')}<div><p class="cap">바라볼 곳</p><p class="body">${p.face}</p></div></div></div>
         <figure class="ex"><img alt="${p.name} ${ref ? '입주 때 사진' : '예시 구도'}" src="${ref ? imgOf(ref) : PHOTO.url(p.id, 'wide', 0)}"><figcaption>${ref ? '입주 때' : '예시'}</figcaption></figure></div>
       <p class="why mt-12">${again ? '입주 때와 같은 자리, 같은 방향으로 찍어요. 카메라에서 입주 사진을 겹쳐 보여 드려요.' : p.why}</p>
       <div class="row mt-16"><button class="btn btn-ghost" data-act="skip" ${dn ? 'disabled' : ''}>나중에</button><button class="btn btn-accent grow" data-shoot="${p.id}">${icon('camera')}${dn ? '다시 찍기' : '이 자리에서 찍기'}</button></div>`;
  return {bar:backBar(`${TYPE[ses.type]} 촬영`, 'home', allDone ? '' : `<button class="btn-text" data-act="finish">마치기</button>`), tabs:false, full:true, html:`<div class="guide">
    <div class="g-head"><div class="row between"><p class="head num">${k}<span class="t-3"> / ${ids.length}</span></p><button class="chip ${allDone ? 'chip-ok' : 'chip-accent'}" data-act="list" aria-label="핀 목록 보기">${allDone ? '모두 찍었어요' : `남은 핀 ${left.length}`}${icon('chevR')}</button></div>
      <div class="segbar mt-8" style="--n:${ids.length}">${ids.map(id => `<i class="${isDone(ses, id) ? 'done' : id === ui.sel ? 'now' : skipped.includes(id) ? 'skip' : ''}"></i>`).join('')}</div></div>
    <div class="g-plan">${planSVG({session:ses, sel:allDone ? null : ui.sel, ids, interactive:true})}</div>
    ${planLegend()}
    <div class="g-sheet"><div class="handle"></div>${sheet}</div></div>`};
};

// 핀 목록(모달 시트)
VIEWS.listSheet = () => {
  const ses = cur(), ids = (ses && ses.ids) || ALL, skipped = (ses && ses.skipped) || [];
  const row = id => { const p = P(id), dn = isDone(ses, id), sk = skipped.includes(id) && !dn;
    return `<button class="cell" data-pick="${id}"><span class="pnum ${p.hid ? 'hid' : ''} ${dn ? 'done' : ''}">${dn ? icon('check') : id}</span><span class="grow"><b class="head">${p.name}</b><span class="cap" style="display:block">${dn ? '기준 사진을 찍었어요' : sk ? '건너뛴 핀이에요' : p.face}</span></span>${icon('chevR', 'chev')}</button>`; };
  const vis = ids.filter(id => !P(id).hid), hid = ids.filter(id => P(id).hid);
  return `<div class="handle"></div><h2 class="title">찍을 핀 ${ids.length}곳</h2><p class="sub mt-4">핀을 누르면 도면에서 설 자리와 방향을 보여 줘요.</p>
    ${vis.length ? `<p class="cap mt-20 mb-8">방 전체를 덮는 자리</p><div class="group flat">${vis.map(row).join('')}</div>` : ''}
    ${hid.length ? `<p class="cap mt-20 mb-8">놓치기 쉬운 곳, 마지막에 챙겨요</p><div class="group flat">${hid.map(row).join('')}</div>` : ''}`;
};
