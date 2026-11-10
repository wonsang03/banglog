'use strict';
/* 방로그 — 화면 전환 · 동작 · 카메라 · 제스처 */

const TABS = [['home', '홈', 'home'], ['records', '기록', 'stack'], null, ['checkup', '다시 찍기', 'refresh'], ['export', '확인서', 'doc']];
const TAB_OF = {home:'home', onboard:'home', scan:'home', done:'home', guide:'', camera:'', records:'records', checkup:'checkup', export:'export'};

function render(){
  if(!S.onboarded && ui.screen === 'home') { ui.screen = 'onboard'; ui.ob = 0; ui.obFrom = 0; }
  const o = VIEWS[ui.screen]();
  const scr = $('#screen'), bar = $('#appbar'), v = $('#view');
  scr.className = 'screen' + (o.dark ? ' dark' : '') + (o.tabs === false ? ' no-tabs' : '') + (o.full ? ' full' : '') + (o.noBar || !o.bar ? ' no-bar' : '');
  scr.dataset.screen = ui.screen;
  bar.className = 'appbar' + (o.large ? ' large' : '');
  bar.innerHTML = o.noBar ? '' : (o.bar || '');
  const changed = render.last !== ui.screen;
  // 같은 화면을 다시 그릴 때 가로 사진 줄의 스크롤 위치를 유지한다
  const keep = changed ? [] : [...v.querySelectorAll('[data-keep]')].map(el => [el.dataset.keep, el.scrollLeft]);
  v.innerHTML = o.html;
  keep.forEach(([k, x]) => { const el = v.querySelector(`[data-keep="${k}"]`); if(el) el.scrollLeft = x; });
  v.classList.toggle('enter', changed);
  if(changed){ v.scrollTop = 0; render.last = ui.screen; }
  $('#tabbar').innerHTML = TABS.map(t => t
    ? `<button class="tab" data-go="${t[0]}" ${TAB_OF[ui.screen] === t[0] ? 'aria-current="page"' : ''}>${icon(t[2])}<span>${t[1]}</span></button>`
    : `<button class="tab-cta" data-act="shootCta" aria-label="촬영하기">${icon('camera')}</button>`).join('');
  if(o.after) o.after(changed);
  if(ui.screen === 'onboard') bindSwipe();
  hydrate();
}
// 자리만 잡아 둔 모의 사진을 한 장씩 채운다(화면이 멈추지 않게)
function hydrate(){ clearTimeout(hydrate.t); const step = () => { const el = document.querySelector('img.lz'); if(!el) return; const [p, v, a] = el.dataset.art.split(',');
  el.src = PHOTO.url(+p, v, +a); el.classList.remove('lz'); hydrate.t = setTimeout(step, 16); }; hydrate.t = setTimeout(step, 30); }
function go(s){ if(s !== 'camera') stopCam(); if(s === 'onboard'){ ui.ob = 0; ui.obFrom = 0; }
  // 방 전체 찍기는 들어올 때마다 처음부터, 나가면 회전을 멈추고 파노라마를 비운다
  if(s === 'scan'){ if(ui.screen !== 'scan') ui.scan = 0; } else { scanStop(); ROOM.spinFree(); }
  closeModal(); ui.screen = s; render(); }

// ── 모달 시트
function openModal(html){ const m = $('#modal'); m.innerHTML = `<div class="scrim" data-act="closeModal"></div><div class="panel" role="dialog" aria-modal="true" tabindex="-1">${html}</div>`; m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); m.querySelector('.panel').focus(); }
function closeModal(){ const m = $('#modal'); if(!m.classList.contains('open')) return; m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); m.innerHTML = ''; }
const confirmSheet = left => `<div class="handle"></div><h2 class="title">아직 ${left.length}곳을 찍지 않았어요</h2><p class="sub mt-8">${left.map(id => `${id}. ${P(id).name}`).join(', ')}</p>
  <div class="note accent mt-16">${icon('info')}<span>찍지 않은 자리는 퇴실 때 근거가 없을 수 있어요. 놓치기 쉬운 곳을 한 번 더 확인해 주세요.</span></div>
  <button class="btn btn-block btn-accent mt-20" data-act="closeModal">계속 찍기</button><button class="btn-text btn-block mt-4" data-act="finishAnyway">이대로 마치기</button>`;
const resetSheet = () => `<div class="handle"></div><h2 class="title">기록을 모두 비울까요?</h2><p class="sub mt-8">이 기기에 저장된 도면과 사진이 지워지고, 되돌릴 수 없어요.</p>
  <button class="btn btn-block btn-danger mt-20" data-act="resetYes">모두 비우기</button><button class="btn-text btn-block mt-4" data-act="closeModal">취소</button>`;

// ── 기록 도우미
function nextAfter(pid){ const ses = cur(); if(!ses) return null; const l = ses.ids || ALL, i = l.indexOf(pid);
  return [...l.slice(i + 1), ...l.slice(0, i)].find(id => !isDone(ses, id) && !(ses.skipped || []).includes(id)) || null; }
function putShot(src){
  const ses = cur(), ts = Date.now(), sh = ses.shots[ui.pid] = ses.shots[ui.pid] || {};
  const art = ui.pendingArt && PHOTO.url(...ui.pendingArt) === src ? ui.pendingArt : null;
  sh[ui.step] = Object.assign({ts, no:archiveNo(ts)}, art ? {art} : {src});
  ses.skipped = (ses.skipped || []).filter(i => i !== ui.pid); saveState(); return sh[ui.step];
}
function closeSession(){ const ses = cur(); ses.closed = true; ses.closedAt = Date.now(); S.current = null; saveState(); ui.doneId = ses.id; ui.sel = null; ui.cmp = (ses.ids || ALL)[0]; go('done'); }

// ── 카메라: 휴대폰에서는 자동으로, 컴퓨터에서는 요청할 때만 실제 카메라를 켠다
const coarse = () => matchMedia('(pointer:coarse)').matches;
function stopCam(){ if(ui.stream){ ui.stream.getTracks().forEach(t => t.stop()); ui.stream = null; } ui.camTried = false; }
function attachCam(force){
  const v = $('#cam'); if(v && ui.stream){ if(v.srcObject !== ui.stream) v.srcObject = ui.stream; return; }
  if(ui.camTried || !(force || coarse() || ui.wantCam) || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return;
  ui.camTried = true;
  navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}, width:{ideal:1280}}, audio:false})
    .then(s => { if(ui.screen !== 'camera'){ s.getTracks().forEach(t => t.stop()); return; } ui.stream = s; render(); })
    .catch(() => { ui.wantCam = false; toast('카메라를 쓸 수 없어 모의 화면으로 보여 드려요', false); });
}
function grab(){
  const v = $('#cam');
  if(v && v.videoWidth){ const sc = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight)), c = document.createElement('canvas'); c.width = v.videoWidth * sc; c.height = v.videoHeight * sc;
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); return {src:c.toDataURL('image/jpeg', .72)}; }
  const art = [ui.pid, ui.step, AGED[cur().type]];
  return {src:PHOTO.url(...art), art};
}
function downscale(file){ return new Promise((res, rej) => { const r = new FileReader(); r.onerror = rej; r.onload = () => { const im = new Image(); im.onerror = rej;
  im.onload = () => { const sc = Math.min(1, 720 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = im.width * sc; c.height = im.height * sc;
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ui.pendingArt = null; res(c.toDataURL('image/jpeg', .72)); }; im.src = r.result; }; r.readAsDataURL(file); }); }

// ── 방 스캔 진행: 시간 기준으로 각도를 정하고(느린 기기에서도 같은 속도), 화면은 다시 만들지 않고 그림만 갱신
function scanTick(){
  if(ui.screen !== 'scan' || !(ui.scan > 0 && ui.scan < 100)) return;
  // 지난 프레임부터 흐른 시간만큼 돈다. 한 번에 최대 0.12초치만 반영해서, 다른 탭에 다녀와도 건너뛰지 않고 이어서 돈다
  const now = performance.now(); ui.scan = Math.min(100, ui.scan + Math.min(120, now - ui.scanT0) / SCAN_MS * 100); ui.scanT0 = now;
  if(ui.scan >= 100) return render();
  scanPaint(); scanNext();
}
// 화면 주사율에 맞춰 다음 프레임을 예약한다. 프레임 콜백이 멈춘 환경에서도 진행되게 타이머를 함께 건다
function scanNext(){ let ran = false; const run = () => { if(ran) return; ran = true; scanStop(); scanTick(); };
  ui.scanRaf = requestAnimationFrame(run); ui.scanTo = setTimeout(run, 80); }
function scanStop(){ cancelAnimationFrame(ui.scanRaf); clearTimeout(ui.scanTo); }

// ── 온보딩 스와이프
function bindSwipe(){
  const vw = $('#obView'), tr = $('#obTrack'); if(!vw || vw.dataset.b) return; vw.dataset.b = 1;
  let x0 = null, dx = 0, w = 1;
  vw.addEventListener('pointerdown', e => { x0 = e.clientX; dx = 0; w = vw.clientWidth; tr.style.transition = 'none'; });
  vw.addEventListener('pointermove', e => { if(x0 === null) return; dx = e.clientX - x0; if(Math.abs(dx) > 4) tr.style.transform = `translateX(calc(${-ui.ob * 100}% + ${dx}px))`; });
  const end = () => { if(x0 === null) return; x0 = null; tr.style.transition = '';
    if(dx < -w * .16 && ui.ob < OB.length - 1){ ui.obFrom = ui.ob; ui.ob++; render(); }
    else if(dx > w * .16 && ui.ob > 0){ ui.obFrom = ui.ob; ui.ob--; render(); }
    else tr.style.transform = `translateX(${-ui.ob * 100}%)`; };
  vw.addEventListener('pointerup', end); vw.addEventListener('pointerleave', end); vw.addEventListener('pointercancel', end);
}

// ── 동작
const ACT = {
  obNext(){ ui.obFrom = ui.ob; ui.ob = Math.min(OB.length - 1, ui.ob + 1); render(); },
  obSkip(){ S.onboarded = true; saveState(); go('home'); },
  obStart(){ S.onboarded = true; saveState(); ui.scan = 0; go(S.scanned ? 'guide' : 'scan'); },
  scanStart(){ ui.scan = .01; ui.scanT0 = performance.now(); render(); scanStop(); scanNext(); },
  scanAgain(){ ui.scan = 0; render(); },
  scanOk(){ S.scanned = true; saveState(); ui.scan = 0; toast('도면을 저장했어요'); go('guide'); },
  startMoveIn(){ newSession('movein'); ui.sel = null; go('guide'); },
  list(){ openModal(VIEWS.listSheet()); },
  skip(){
    const ses = cur(); if(!ses) return; const pid = ui.screen === 'camera' ? ui.pid : ui.sel;
    ses.skipped = [...new Set([...(ses.skipped || []), pid])]; saveState(); toast('건너뛴 자리는 목록에 남겨 둘게요', false);
    const n = nextAfter(pid);
    if(ui.screen === 'camera'){ if(n){ ui.pid = ui.sel = n; ui.step = 'wide'; ui.pending = null; render(); } else { ui.sel = null; go('guide'); } }
    else { ui.sel = n || pid; render(); }
  },
  shutter(){ const g = grab(); ui.pending = g.src; ui.pendingArt = g.art || null; render(); const f = $('#flash'); if(f) f.classList.add('go'); },
  retake(){ ui.pending = null; ui.pendingArt = null; render(); },
  accept(){ const shot = putShot(ui.pending); ui.pending = null; ui.pendingArt = null; ui.sealed = shot; ui.sealedStep = ui.step; render(); },
  addClose(){ ui.sealed = null; ui.step = 'close'; ui.pending = null; render(); },
  next(){ ui.sealed = null; const n = nextAfter(ui.pid);
    if(n){ ui.pid = ui.sel = n; ui.step = 'wide'; ui.pending = null; render(); } else { ui.sel = null; go('guide'); } },
  ghost(){ ui.ghost = !ui.ghost; render(); },
  realCam(){ ui.wantCam = true; ui.camTried = false; attachCam(true); },
  finish(){ const ses = cur(); if(!ses) return; const left = (ses.ids || ALL).filter(id => !isDone(ses, id)); if(left.length) openModal(confirmSheet(left)); else closeSession(); },
  finishAnyway(){ closeModal(); closeSession(); },
  shootCta(){ if(!S.scanned) go('scan'); else if(cur() || !moveIn()) go('guide'); else go('checkup'); },
  remind(){ S.remind = !S.remind; saveState(); render(); toast(S.remind ? '정기 점검을 알려 드릴게요' : '정기 점검 알림을 껐어요'); },
  startCheck(){ const ids = ui.chk === 'all' ? ALL.slice() : [...ui.changed].sort((a, b) => a - b); if(!ids.length) return; newSession(ui.reason, ids); ui.changed = new Set(); ui.sel = null; go('guide'); },
  exportOne(){ ui.scope = 'pick'; ui.exp = new Set([ui.cmp]); go('export'); },
  pdf(){ $('#print').innerHTML = `<article class="doc">${docHTML([...ui.exp].sort((a, b) => a - b))}</article>`; setTimeout(() => window.print(), 80); },
  link(){ const u = `https://banglog.example/share/${archiveNo(Date.now())}`;
    (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast('공유 링크를 복사했어요 (모의)'), () => toast('공유 링크 (모의) ' + u)); },
  seed(){ seedDemo(); ROOM.warm(); ui.cmp = 2; ui.cmpR = null; ui.scope = 'all'; ui.exp = new Set(ALL); toast('예시 데이터를 불러왔어요'); go('records'); },
  reset(){ openModal(resetSheet()); },
  resetYes(){ S = Object.assign(freshState(), {onboarded:true}); saveState(); ui.sel = null; closeModal(); toast('기록을 모두 비웠어요'); go('home'); },
  closeModal(){ closeModal(); },
};

// ── 이벤트
document.addEventListener('click', e => {
  const t = e.target.closest('[data-go],[data-act],[data-shoot],[data-pid],[data-pin],[data-pick],[data-ob],[data-reason],[data-chk],[data-cmpr],[data-scope],[data-ex]');
  if(!t || t.disabled) return; const d = t.dataset;
  if(d.act) return ACT[d.act] && ACT[d.act](t);
  if(d.shoot){ ui.pid = ui.sel = +d.shoot; ui.step = 'wide'; ui.pending = null; ui.sealed = null; return go('camera'); }
  if(d.pin){ const id = +d.pin; if(ui.screen === 'records' || historyOf(id).length){ ui.cmp = id; ui.cmpR = null; return ui.screen === 'records' ? render() : go('records'); }
    if(cur()){ ui.sel = id; return go('guide'); } return; }
  if(d.pick){ ui.sel = +d.pick; closeModal(); return render(); }
  if(d.pid){ const id = +d.pid;
    if(ui.screen === 'guide'){ ui.sel = id; return render(); }
    if(ui.screen === 'checkup'){ ui.changed.has(id) ? ui.changed.delete(id) : ui.changed.add(id); return render(); }
    if(ui.screen === 'records'){ ui.cmp = id; ui.cmpR = null; return render(); } return; }
  if(d.ob){ ui.obFrom = ui.ob; ui.ob = +d.ob; return render(); }
  if(d.reason){ ui.reason = d.reason; ui.chk = d.reason === 'repair' ? 'pick' : 'all'; return render(); }
  if(d.chk){ ui.chk = d.chk; return render(); }
  if(d.cmpr){ ui.cmpR = d.cmpr; return render(); }
  if(d.scope){ ui.scope = d.scope; if(d.scope === 'all') ui.exp = new Set(ALL); return render(); }
  if(d.ex){ const id = +d.ex; ui.exp.has(id) ? ui.exp.delete(id) : ui.exp.add(id); return render(); }
  if(d.go) return go(d.go);
});
document.addEventListener('keydown', e => {
  if((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.pin')){ e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', {bubbles:true})); }
  if(e.key === 'Escape') closeModal();
  if(ui.screen === 'onboard' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')){ const n = ui.ob + (e.key === 'ArrowRight' ? 1 : -1); if(n >= 0 && n < OB.length){ ui.obFrom = ui.ob; ui.ob = n; render(); } }
});
document.addEventListener('input', e => { const c = e.target.closest && e.target.closest('#cmp'); if(c) c.style.setProperty('--x', e.target.value + '%'); });
$('#introNav').addEventListener('click', e => {
  const b = e.target.closest('[data-j]'); if(!b) return; const j = b.dataset.j;
  if(j === 'onboard') go('onboard');
  if(j === 'fresh'){ S = Object.assign(freshState(), {onboarded:true}); saveState(); ui.scan = 0; ui.sel = null; go('scan'); }
  if(j === 'records'){ seedDemo(); ui.cmp = 2; ui.cmpR = null; go('records'); }
  if(j === 'export'){ seedDemo(); ui.scope = 'all'; ui.exp = new Set(ALL); go('export'); }
});

// 수평계: 휴대폰 기울기를 보여 주고 수평이면 초록으로
window.addEventListener('deviceorientation', e => { const el = $('#level'); if(!el || e.gamma == null) return; el.classList.add('show');
  el.style.setProperty('--r', `${(-e.gamma).toFixed(1)}deg`); el.classList.toggle('ok', Math.abs(e.gamma) < 2.5); });

render();
setTimeout(() => ROOM.warm(), 900);
