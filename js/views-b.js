'use strict';
/* 방로그 — 화면(2): 카메라 · 촬영 완료 · 기록 비교 · 같은 자리 다시 찍기 · 확인서 */

const nextPid = () => { const ses = cur(); if(!ses) return null; const l = ses.ids || ALL, i = l.indexOf(ui.pid);
  return [...l.slice(i + 1), ...l.slice(0, i)].find(id => !isDone(ses, id) && !(ses.skipped || []).includes(id)) || null; };

// ── 카메라: 핀마다 기준 사진 1장(필수) + 흠을 가까이 1장(선택)
VIEWS.camera = () => {
  const ses = cur(), p = P(ui.pid), close = ui.step === 'close', again = ses.type !== 'movein';
  const ref = again && !close ? refShot(p.id) : null;
  const live = ui.stream ? `<video id="cam" class="cam-media" autoplay playsinline muted></video>` : `<img class="cam-media sim" alt="" src="${PHOTO.url(p.id, ui.step, AGED[ses.type])}">`;
  const hint = close ? '흠이 가운데 원 안에 크게 보이도록 다가가요' : ref && ui.ghost ? '입주 때 사진이 겹쳐 보여요. 벽 모서리와 창틀 선을 맞춰 찍어요' : `${p.face}, 한 화면에 다 담기게 찍어요`;
  const nx = ui.sealed ? nextPid() : null;
  return {tabs:false, dark:true, full:true, noBar:true, html:`<div class="cam${ui.pending ? ' reviewing' : ''}">
    <div class="cam-live">${ui.pending ? `<img class="cam-media" alt="방금 찍은 사진" src="${ui.pending}">` : live}${ref && ui.ghost && !ui.pending ? `<img class="cam-ghost" alt="" src="${imgOf(ref)}">` : ''}</div>
    <div class="cam-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    ${close && !ui.pending ? '<div class="reticle" aria-hidden="true"></div>' : ''}
    <div class="cam-top">
      <button class="btn-icon glass" data-go="guide" aria-label="촬영 안내로 돌아가기">${icon('close')}</button>
      <div class="cam-title"><p>${p.id}. ${p.name}</p><span class="cam-tag">${close ? '흠 가까이 찍기 (선택)' : again ? '입주 때와 같은 구도로' : '기준 사진'}</span></div>
      ${ref ? `<button class="btn-icon glass${ui.ghost ? ' on' : ''}" data-act="ghost" aria-pressed="${ui.ghost}" aria-label="입주 때 사진 겹쳐 보기">${icon('overlay')}</button>` : '<span class="cam-sp"></span>'}
    </div>
    <div class="cam-map" aria-hidden="true">${planSVG({sel:p.id, callout:false, cls:'mini-cam'})}</div>
    <div class="level" id="level" aria-hidden="true"><i></i></div>
    ${ui.pending ? `<div class="review glass"><p class="head">${close ? '흠이 또렷하게 보이나요?' : '이 사진을 기준 사진으로 쓸까요?'}</p>
        <p class="cap">${close ? '흐리거나 멀면 근거로 쓰기 어려워요.' : again ? '입주 사진과 구도가 비슷한지 확인해 주세요.' : '다음 점검 때 이 사진과 같은 구도로 다시 찍게 안내해 드려요.'}</p>
        <div class="row mt-12"><button class="btn btn-sm glass-btn grow" data-act="retake">다시 찍기</button><button class="btn btn-sm btn-white grow" data-act="accept">${close ? '덧붙이기' : '사용하기'}</button></div></div>`
      : `<div class="cam-hint glass">${hint}</div>`}
    <div class="cam-bottom">
      <label class="cam-side" aria-label="앨범에서 사진 고르기">${icon('image')}<input id="file" type="file" accept="image/*" hidden></label>
      <button class="shutter" data-act="shutter" aria-label="촬영" ${ui.pending ? 'disabled' : ''}><span></span></button>
      ${close ? `<button class="cam-side txt" data-act="next" ${ui.pending ? 'disabled' : ''}>그만두기</button>` : `<button class="cam-side txt" data-act="skip" ${ui.pending ? 'disabled' : ''}>건너뛰기</button>`}
    </div>
    <p class="cam-mode">${ui.stream ? '카메라로 촬영하고 있어요' : `모의 카메라 화면이에요. <button class="linkbtn" data-act="realCam">실제 카메라 쓰기</button>`}</p>
    ${ui.sealed ? `<div class="sealed"><div class="sealed-card"><div class="sealed-seal">${sealSVG(ui.sealed.ts)}</div><h3 class="title">${ui.sealedStep === 'close' ? '가까이 찍은 사진을 덧붙였어요' : '기준 사진을 보관했어요'}</h3>
      <dl class="kv"><dt>촬영 일시</dt><dd class="num">${fmt(ui.sealed.ts)}</dd><dt>보관 번호</dt><dd class="num">${ui.sealed.no}</dd></dl>
      <button class="btn btn-block mt-20" data-act="next">${nx ? `다음 핀, ${nx}. ${P(nx).name}` : '촬영 안내로 돌아가기'}</button>
      ${ui.sealedStep === 'wide' ? `<button class="btn-text btn-block mt-4" data-act="addClose">${icon('camera')} 흠이 보이면 가까이 한 장 덧붙이기</button>` : ''}</div></div>` : ''}
    <div class="flash" id="flash"></div></div>`,
    after(){ attachCam(); const f = $('#file'); if(f) f.onchange = async e => { const x = e.target.files[0]; if(!x) return;
      try{ ui.pending = await downscale(x); render(); }catch(err){ toast('사진을 열지 못했어요. 다른 사진을 골라 주세요.', false); } }; }};
};

// ── 촬영을 마친 뒤
VIEWS.done = () => {
  const s = S.sessions.find(x => x.id === ui.doneId) || sorted().slice(-1)[0];
  const ids = s.ids || ALL, k = doneCount(s, ids), miss = ids.filter(id => !isDone(s, id));
  const t = s.closedAt || Date.now(), mins = Math.max(1, Math.round((t - (s.startedAt || s.date)) / 6e4));
  return {tabs:false, noBar:true, html:`<div class="fin">
    <div class="done-seal">${sealSVG(t)}</div>
    <h1 class="display mt-24">${TYPE[s.type]} 기록을<br>보관했어요</h1><p class="sub mt-8">${fmt(t)}에 촬영 시각이 확정됐어요.</p>
    <div class="stats mt-24"><div><b class="num">${k}</b><span>핀</span></div><div><b class="num">${photoCount(s)}</b><span>사진</span></div><div><b class="num">${mins}</b><span>분 걸림</span></div></div>
    ${miss.length ? `<div class="note accent mt-20">${icon('info')}<span>찍지 않은 핀 ${miss.length}곳이 있어요. ${miss.map(id => P(id).name).join(', ')}. 다시 찍기에서 언제든 찍을 수 있어요.</span></div>`
      : `<div class="note mt-20">${icon('shield')}<span>${s.type === 'movein' ? '1년 뒤 정기 점검 때 같은 핀에서 똑같이 찍도록 알려 드릴게요.' : '입주 때와 같은 구도로 찍었어요. 기록에서 두 사진을 밀어 비교해 보세요.'}</span></div>`}
    <button class="btn btn-block mt-24" data-go="records">기록 보기</button><button class="btn-text btn-block mt-4" data-go="home">홈으로</button></div>`};
};

// ── 기록: 위에서부터 도면 → 비교 사진 → 핀별 사진 줄. 도면이나 사진 줄에서 핀을 고르고, 같은 구도의 사진을 시점별로 비교
VIEWS.records = () => {
  const ss = sorted().filter(s => Object.keys(s.shots).length);
  if(!ss.length) return {bar:'<div class="ttl">기록</div>', large:true, tabs:true, html:empty('stack', '아직 보관한 기록이 없어요', '입주 촬영을 마치면 핀마다 모여요. 결과 화면이 궁금하다면 예시 데이터를 불러와 보세요.', `<button class="btn btn-tonal" data-act="seed">예시 불러오기</button>`)};
  const pid = ui.cmp, p = P(pid), rows = historyOf(pid), a = rows[0];
  let b = rows.find(r => r.s.id === ui.cmpR) || rows[rows.length - 1]; if(b === a && rows.length > 1) b = rows[rows.length - 1];
  // 1) 도면: 핀이 방의 어디에 있는지 먼저 보여 주고, 핀을 눌러 고른다
  const map = `<section class="card rec-map"><div class="rec-map-hd"><b>${icon('plan')}도면에서 위치 보기</b><span class="cap">핀을 눌러 골라요</span></div>
    ${planSVG({session:moveIn() || ss[0], sel:pid, interactive:true})}</section>`;
  // 3) 사진 줄: 핀별 최근 사진을 가로로 넘기며 고른다(도면과 같은 선택을 공유)
  const shotN = POINTS.filter(q => historyOf(q.id).length).length;
  const pins = `<div class="sec-title"><h2>핀별 사진</h2><span class="cap">${shotN}/${ALL.length}곳</span></div>
    <div class="pinstrip" id="pinstrip" data-keep="pinstrip" role="tablist" aria-label="핀 고르기">${POINTS.map(q => { const h = historyOf(q.id), l = h[h.length - 1];
    return `<button class="pin-card${q.id === pid ? ' on' : ''}" role="tab" aria-selected="${q.id === pid}" aria-label="${q.id}번 ${q.name}${l ? '' : ', 아직 찍지 않음'}" data-pin="${q.id}"><span class="pin-card-ph">${l ? lazyImg(l.shot) : icon('camera')}<span class="pnum sm ${q.hid ? 'hid' : ''}">${q.id}</span></span><b>${q.name}</b></button>`; }).join('')}</div>`;
  const cmp = rows.length >= 2
    ? `<div class="compare" id="cmp" style="--x:50%"><img alt="${TYPE[b.s.type]} 때 사진" src="${imgOf(b.shot)}"><img class="before" alt="${TYPE[a.s.type]} 때 사진" src="${imgOf(a.shot)}"><i class="knob"></i>
        <input type="range" min="0" max="100" value="50" aria-label="${TYPE[a.s.type]} 사진과 ${TYPE[b.s.type]} 사진 비교"><span class="lb l">${TYPE[a.s.type]}</span><span class="lb r">${TYPE[b.s.type]}</span></div>`
    : rows.length ? `<div class="compare single"><img alt="${TYPE[a.s.type]} 때 사진" src="${imgOf(a.shot)}"><span class="lb l">${TYPE[a.s.type]}</span></div>`
    : `<div class="card">${empty('image', '이 핀은 아직 찍지 않았어요', '도면이나 아래 사진 줄에서 다른 핀을 골라 보세요.')}</div>`;
  const vs = rows.length >= 2 ? `<div class="vs"><div class="vs-side"><span class="cap">기준</span><b>${TYPE[a.s.type]}</b><span class="cap num">${fmtM(a.shot.ts)}</span></div>
      <div class="vs-side r"><span class="cap">비교할 시점</span><div class="vs-pick">${rows.slice(1).map(r => `<button class="pill sm" aria-pressed="${r === b}" data-cmpr="${r.s.id}">${TYPE[r.s.type]}</button>`).join('')}</div><span class="cap num">${fmtM(b.shot.ts)}</span></div></div>` : '';
  const closes = rows.filter(r => r.close);
  const key = `${pid}-${b ? b.s.id : ''}`;
  return {bar:'<div class="ttl">기록</div>', large:true, tabs:true, after:changed => recAfter(changed, key), html:`
    ${map}
    <div class="row between mt-24"><div><p class="cap">${p.id}번 핀, ${p.hid ? '놓치기 쉬운 곳' : '방 전체를 덮는 자리'}</p><h2 class="title">${p.name}</h2></div><span class="chip">${rows.length}번 찍음</span></div>
    <div class="mt-12">${cmp}</div>${vs}
    ${rows.length >= 2 ? '<p class="cap mt-12">같은 핀에서 같은 구도로 찍은 사진이에요. 손잡이를 밀어 달라진 곳을 찾아보세요.</p>' : ''}
    ${pins}
    ${closes.length ? `<div class="sec-title"><h2>가까이 찍은 사진</h2><span class="cap">${closes.length}장</span></div><div class="strip">${closes.map(r => `<div class="strip-item"><span class="strip-ph">${lazyImg(r.close)}</span><b>${TYPE[r.s.type]}</b><span class="cap num">${fmtS(r.close.ts)}</span></div>`).join('')}</div>` : ''}
    ${rows.length ? `<div class="sec-title"><h2>시점별 기록</h2></div><ol class="tl">${rows.slice().reverse().map(r => `<li class="tl-row static"><span class="tl-ph">${lazyImg(r.shot)}</span><span class="grow"><b class="head">${TYPE[r.s.type]}</b><span class="cap num">촬영 ${fmt(r.shot.ts)}</span><span class="cap num">${r.shot.no}</span></span><span class="chip chip-ok">${icon('shield')}보관됨</span></li>`).join('')}</ol>` : ''}
    ${rows.length ? `<button class="btn btn-block mt-20" data-act="exportOne">${icon('doc')}이 핀 확인서 만들기</button>` : ''}
    <p class="cap foot">보관 표시는 모의예요. 법적 효력을 보장하지 않고, 촬영 시점과 원본이 추정되는 기록을 보여 줘요.</p>`};
};

// 기록을 다시 그린 뒤: 고른 핀을 사진 줄 가운데로 옮기고, 핀이나 시점이 바뀌면 비교 사진을 부드럽게 바꾼다
function recAfter(changed, key){
  const st = $('#pinstrip'), it = st && st.querySelector('.on');
  const calm = changed || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(it) st.scrollTo({left:it.offsetLeft - (st.clientWidth - it.offsetWidth) / 2, behavior:calm ? 'auto' : 'smooth'});
  const c = document.querySelector('#view .compare');
  if(c && !changed && recAfter.key !== key) c.classList.add('swap');
  recAfter.key = key;
}

// ── 같은 자리 다시 찍기: 정기 점검·계약 연장·퇴실은 모든 핀, 수리 요청은 고른 핀만
const REASONS = {checkup:['calendar', '정기 점검', '1년마다 모든 핀에서 다시 찍어요'], renew:['doc', '계약 연장', '연장하기 전에 지금 상태를 남겨요'],
  moveout:['home', '퇴실', '나가기 전에 모든 핀에서 찍어 입주 때와 비교해요'], repair:['wrench', '수리 요청', '고장 난 곳의 핀만 골라 찍어요']};
VIEWS.checkup = () => {
  const m = moveIn();
  if(!m) return {bar:'<div class="ttl">다시 찍기</div>', large:true, tabs:true, html:empty('bell', '입주 기준 사진이 있어야 해요', '입주 촬영을 마치면 1년 뒤 같은 핀에서 다시 찍도록 알려 드려요.', S.scanned ? `<button class="btn btn-accent" data-go="guide">입주 촬영하기</button>` : `<button class="btn btn-accent" data-go="scan">방 전체 찍기</button>`)};
  const due = new Date(m.date); due.setFullYear(due.getFullYear() + 1); const days = Math.ceil((due - Date.now()) / 864e5);
  const n = ui.chk === 'all' ? ALL.length : ui.changed.size;
  return {bar:'<div class="ttl">다시 찍기</div>', large:true, tabs:true, html:`
    <section class="card dday"><div class="row between top"><div><p class="cap">다음 정기 점검</p><p class="dday-num num">${days > 0 ? `D-${days}` : 'D-day'}</p><p class="sub">${fmtD(due.getTime())}${days <= 0 ? ', 같은 자리에서 다시 찍을 때가 됐어요' : ''}</p></div>
      <div class="row"><span class="cap">알림</span><button class="switch" role="switch" aria-checked="${S.remind}" aria-label="정기 점검 알림" data-act="remind"></button></div></div></section>
    <div class="sec-title"><h2>왜 다시 찍나요?</h2></div>
    <div class="group" role="radiogroup" aria-label="다시 찍는 이유">${Object.entries(REASONS).map(([k, [ic, t, d]]) => `<button class="cell" role="radio" aria-checked="${ui.reason === k}" data-reason="${k}"><span class="ico">${icon(ic)}</span><span class="grow"><b class="head">${t}</b><span class="cap" style="display:block">${d}</span></span><span class="radio"></span></button>`).join('')}</div>
    <div class="sec-title"><h2>어느 핀에서 찍을까요?</h2><span class="cap">${n}곳</span></div>
    <div class="seg" role="group" aria-label="찍을 범위"><button data-chk="all" aria-pressed="${ui.chk === 'all'}">모든 핀 ${ALL.length}곳</button><button data-chk="pick" aria-pressed="${ui.chk === 'pick'}">핀 고르기</button></div>
    <div class="card pad-0 chk-plan mt-12">${planSVG({session:m, marked:ui.chk === 'all' ? new Set(ALL) : ui.changed, interactive:ui.chk === 'pick', cone:false, callout:false})}</div>
    <p class="cap mt-8">${ui.chk === 'pick' ? '도면에서 핀을 눌러 골라 주세요.' : '입주 때 찍은 핀 10곳을 같은 순서로 안내해 드려요.'} 카메라에서 입주 사진을 겹쳐 보여 드려 같은 구도로 찍을 수 있어요.</p>
    <button class="btn btn-block btn-accent mt-20" data-act="startCheck" ${n ? '' : 'disabled'}>${n ? `핀 ${n}곳 다시 찍기` : '찍을 핀을 골라 주세요'}</button>`};
};

// ── 확인서
function docHTML(ids){
  const ss = sorted().filter(s => Object.keys(s.shots).length), first = ss[0], last = ss[ss.length - 1];
  return `<div class="doc-head"><div><p class="doc-kicker">방로그 기록 확인서</p><h2 class="doc-title">입주 상태 기록 확인서</h2></div><div class="doc-seal">${sealSVG(last.date)}</div></div>
    <dl class="doc-meta"><div><dt>방</dt><dd>${S.room}</dd></div><div><dt>기록 기간</dt><dd class="num">${fmtD(first.date)} ~ ${fmtD(last.date)}</dd></div>
      <div><dt>기록</dt><dd>${ss.map(s => TYPE[s.type]).join(', ')}</dd></div><div><dt>담은 핀</dt><dd>${ids.length}곳, 같은 자리·같은 구도</dd></div></dl>
    <table class="doc-table"><thead><tr><th>핀</th><th>처음 기록</th><th>최근 기록</th></tr></thead><tbody>
    ${ids.map(id => { const h = historyOf(id); if(!h.length) return `<tr><td><b>${id}. ${P(id).name}</b></td><td colspan="2" class="t-3">기록 없음</td></tr>`;
      const f = h[0], l = h[h.length - 1];
      return `<tr><td><b>${id}. ${P(id).name}</b><span>${P(id).face}</span></td><td><img alt="" src="${imgOf(f.shot)}"><span class="num">${TYPE[f.s.type]}<br>${fmtM(f.shot.ts)}</span></td>
        <td>${l !== f ? `<img alt="" src="${imgOf(l.shot)}"><span class="num">${TYPE[l.s.type]}<br>${fmtM(l.shot.ts)}</span>` : '<span class="t-3">-</span>'}</td></tr>`; }).join('')}
    </tbody></table>
    <p class="doc-foot">같은 핀(자리·방향)에서 찍은 사진의 촬영 일시와 보관 사실을 보여 줍니다. 보관 번호는 공인전자문서센터 보관을 가정한 예시 값이며, 법적 효력을 보장하지 않습니다.</p>`;
}
VIEWS.export = () => {
  const ss = sorted().filter(s => Object.keys(s.shots).length);
  if(!ss.length) return {bar:'<div class="ttl">확인서</div>', large:true, tabs:true, html:empty('doc', '확인서로 만들 기록이 없어요', '촬영을 마치면 촬영 일시와 보관 번호가 담긴 확인서를 만들 수 있어요.', `<button class="btn btn-tonal" data-act="seed">예시 불러오기</button>`)};
  const ids = [...ui.exp].sort((a, b) => a - b);
  return {bar:'<div class="ttl">확인서</div>', large:true, tabs:true, html:`
    <div class="seg" role="group" aria-label="담을 범위"><button data-scope="all" aria-pressed="${ui.scope === 'all'}">모든 핀</button><button data-scope="pick" aria-pressed="${ui.scope === 'pick'}">핀 고르기</button></div>
    ${ui.scope === 'pick' ? `<div class="pills mt-12">${POINTS.map(p => `<button class="pill" aria-pressed="${ui.exp.has(p.id)}" data-ex="${p.id}">${p.id}. ${p.name}</button>`).join('')}</div>` : ''}
    <article class="doc mt-20" aria-label="확인서 미리보기">${ids.length ? docHTML(ids) : `<p class="sub">담을 핀을 하나 이상 골라 주세요.</p>`}</article>
    <div class="row mt-20"><button class="btn btn-ghost grow" data-act="link" ${ids.length ? '' : 'disabled'}>${icon('share')}링크 복사</button><button class="btn grow" data-act="pdf" ${ids.length ? '' : 'disabled'}>${icon('download')}PDF 저장</button></div>`};
};
