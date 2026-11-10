'use strict';
/* 방로그 — 데이터 · 상태 · 공통 함수
   흐름: 입주 첫날 방 전체를 한 바퀴 찍음 → 방 구조를 파악해 '찍기 좋은 자리'에 핀을 꽂음
        → 핀마다 기준 사진 1장 → 1년 점검·계약 연장·퇴실 때 같은 핀에서 같은 구도로 다시 찍어 비교 */

// 찍기 좋은 자리 10곳: 방 전체가 빠짐없이 담기도록 고른 위치와 방향
// 1~6 = 방 전체를 덮는 기본 자리, 7~10 = 놓치기 쉬운 곳(06 작업분석 I01: 문 뒤·콘센트·천장 모서리·장 안)
// sx,sy = 도면 위 서는 곳 / tx,ty = 바라보는 곳
const POINTS = [
  {id:1, name:'방 전체',          hid:0, sx:110, sy:352, tx:285, ty:40,  stand:'현관에 들어서서 방 안쪽을 향해',     face:'맞은편 창문과 주방까지 방 전체',     why:'방 구조와 전체 상태를 한 장에 남기는 첫 기준 사진이에요.'},
  {id:2, name:'창문 쪽 벽',       hid:0, sx:180, sy:270, tx:180, ty:20,  stand:'침대 앞에서 창문을 마주 보고',      face:'창문, 창틀, 방충망과 창 아래 벽',    why:'방충망과 창틀은 “원래 그랬다”를 보여 주기 어려운 대표 부위예요.'},
  {id:3, name:'책상·붙박이장 벽', hid:0, sx:225, sy:205, tx:20,  ty:205, stand:'주방 앞에서 왼쪽 벽을 마주 보고',    face:'책상, 붙박이장 문, 왼쪽 벽 전체',    why:'옵션 가구와 그 뒤 벽은 퇴실 때 자주 다투는 곳이에요.'},
  {id:4, name:'주방',             hid:0, sx:150, sy:128, tx:300, ty:128, stand:'책상 옆에서 싱크대를 마주 보고',     face:'싱크대, 상판, 수전, 위쪽 수납장',     why:'상판 긁힘과 열 자국은 교체 비용이 커요.'},
  {id:5, name:'침대 쪽 벽',       hid:0, sx:130, sy:318, tx:300, ty:318, stand:'현관 안쪽에서 침대를 마주 보고',     face:'침대 옆 벽과 그 아래 바닥',          why:'가구에 가려지는 벽은 입주 뒤에야 흠이 보여요.'},
  {id:6, name:'바닥',             hid:0, sx:150, sy:232, tx:150, ty:300, stand:'방 가운데에서 발밑을 내려다보며',   face:'장판과 이음새',                      why:'바닥 찍힘은 작아서 따로 내려다보고 찍어야 남아요.'},
  {id:7, name:'문 뒤',            hid:1, sx:66,  sy:352, tx:20,  ty:340, stand:'현관문을 닫고 문 뒤쪽에서',         face:'문이 열릴 때 손잡이가 닿는 벽',      why:'평소 동선에서 보이지 않아 가장 많이 빠지는 자리예요.'},
  {id:8, name:'콘센트 주변',      hid:1, sx:246, sy:238, tx:300, ty:238, stand:'콘센트 앞에서 몸을 낮춰',           face:'콘센트와 주변 벽',                   why:'그을음이나 파손은 안전 문제이면서 수리비로 이어질 수 있어요.'},
  {id:9, name:'천장 모서리',      hid:1, sx:96,  sy:96,  tx:20,  ty:20,  stand:'창문 쪽 구석에서 위를 올려다보며',   face:'천장과 벽이 만나는 모서리',          why:'누수 자국과 곰팡이는 올려다보지 않으면 보이지 않아요.'},
  {id:10,name:'붙박이장 안',      hid:1, sx:106, sy:247, tx:20,  ty:247, stand:'붙박이장 문을 모두 열고',           face:'장 안쪽 벽과 선반',                  why:'열어 보고도 “안에는 없다”며 지나치기 쉬운 곳이에요.'},
];
const ALL = POINTS.map(p => p.id);
const P = id => POINTS.find(p => p.id === id);
const TYPE = {movein:'입주', checkup:'정기 점검', repair:'수리 요청', renew:'계약 연장', moveout:'퇴실'};
const AGED = {movein:0, checkup:1, repair:1, renew:1, moveout:2};   // 모의 사진에서 흠이 진행된 정도
const STORE = 'banglog.v4';

function freshState(){ return {onboarded:false, scanned:false, room:'신림동 원룸 302호', sessions:[], current:null, seen:{}, remind:true}; }
function loadState(){ try{ const s = JSON.parse(localStorage.getItem(STORE)); if(s && Array.isArray(s.sessions)) return Object.assign(freshState(), s); }catch(e){} return freshState(); }
function saveState(){ try{ localStorage.setItem(STORE, JSON.stringify(S)); }catch(e){ toast('저장 공간이 부족해요. 사진 일부가 저장되지 않았을 수 있어요.', false); } }

let S = loadState();
const ui = {
  screen:'home', ob:0, pid:1, step:'wide', sel:null, pending:null, sealed:null,
  scan:0, scanRaf:0, stream:null, camTried:false, ghost:true,
  cmp:2, cmpR:null, scope:'all', exp:new Set(ALL), reason:'checkup', chk:'all', changed:new Set(), ids:null,
};

// ── 작은 도구들
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const fmt  = t => { const d = new Date(t); return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const fmtD = t => fmt(t).slice(0, 10);
const fmtM = t => fmt(t).slice(0, 16);
const archiveNo = t => { const d = new Date(t); return `BR-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${Math.random().toString(36).slice(2,8).toUpperCase()}`; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function toast(msg, ok = true){
  const t = $('#toast');
  t.innerHTML = (ok ? '<svg class="ic" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : '') + `<span>${esc(msg)}</span>`;
  t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2300);
}

// ── 기록 조회: 핀마다 기준 사진(wide) 1장 + 흠을 가까이 찍은 사진(close, 선택)
const cur     = () => S.sessions.find(s => s.id === S.current) || null;
const moveIn  = () => S.sessions.find(s => s.type === 'movein') || null;
const sorted  = () => S.sessions.slice().sort((a, b) => a.date - b.date);
const shotOf  = (ses, pid, step) => (ses && ses.shots[pid] && ses.shots[pid][step]) || null;
const isDone  = (ses, pid) => !!shotOf(ses, pid, 'wide');
const idsOf   = () => ui.ids || ALL;
const doneCount = (ses, ids = ALL) => ses ? ids.filter(id => isDone(ses, id)).length : 0;
const photoCount = ses => Object.values(ses.shots).reduce((n, s) => n + (s.wide ? 1 : 0) + (s.close ? 1 : 0), 0);
const imgOf   = shot => shot ? (shot.src || PHOTO.url(shot.art[0], shot.art[1], shot.art[2])) : '';
// 무거운 목록의 모의 사진은 먼저 자리만 잡고, 화면을 그린 뒤 하나씩 채운다(app.js hydrate)
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const lazyImg = (shot, alt = '', cls = '') => shot.src ? `<img class="${cls}" alt="${alt}" src="${shot.src}">`
  : PHOTO.ready(...shot.art) ? `<img class="${cls}" alt="${alt}" src="${PHOTO.url(...shot.art)}">` : `<img class="${cls} lz" alt="${alt}" data-art="${shot.art.join(',')}" src="${BLANK}">`;
const historyOf = pid => sorted().map(s => ({s, shot: shotOf(s, pid, 'wide'), close: shotOf(s, pid, 'close')})).filter(r => r.shot);
// 다시 찍을 때 맞춰 볼 사진: 이 핀의 입주 기준 사진(없으면 가장 최근 사진)
const refShot = pid => { const h = historyOf(pid).filter(r => !r.s.id || r.s.id !== S.current); return h.length ? h[0].shot : null; };

function newSession(type, ids){
  const id = `${type}-${Date.now()}`;
  S.sessions.push({id, type, date:Date.now(), shots:{}, skipped:[], ids: ids && ids.length < ALL.length ? ids : null, closed:false, startedAt:Date.now()});
  S.current = id; saveState(); return id;
}

// ── 체험용 예시: 1년 전 입주 → 1년 정기 점검 → 오늘 퇴실 (같은 핀, 같은 구도)
function seedDemo(){
  const day = 864e5, now = Date.now();
  const at = (t, h, m) => { const d = new Date(t); d.setHours(h, m, 12, 0); return d.getTime(); };
  const make = (type, t0, closeIds = []) => {
    const shots = {}, a = AGED[type];
    ALL.forEach((pid, i) => { const ts = t0 + i * 52e3;
      shots[pid] = {wide:{ts, no:archiveNo(ts), art:[pid, 'wide', a]}};
      if(closeIds.includes(pid)) shots[pid].close = {ts:ts + 24e3, no:archiveNo(ts), art:[pid, 'close', a]}; });
    return {id:`${type}-${t0}`, type, date:t0, shots, skipped:[], ids:null, closed:true, startedAt:t0, closedAt:t0 + ALL.length * 52e3};
  };
  const t1 = at(now - 365 * day, 10, 12), t2 = at(now - 30 * day, 19, 40), t3 = at(now, Math.max(0, new Date(now).getHours() - 1), 5);
  S = Object.assign(freshState(), {onboarded:true, scanned:true, seen:S.seen || {}, sessions:[
    make('movein', t1, [2, 7]), make('checkup', t2, [4]), make('moveout', t3, [2, 4, 6]),
  ]});
  saveState();
}
