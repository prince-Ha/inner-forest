// 같은 방 친구들 (Firebase Realtime Database) — 이번 단계: 내 정보 저장만
//  - 시작하면 rooms/forest/players/{내ID} = { nick(=이름), floor, state: 'climb', charId, t } (방은 하나)
//  - 발 딛고 선 층이 바뀔 때만 floor·t를 고친다 (위치를 계속 보내지 않음)
//  - 창을 닫거나 연결이 끊기면 onDisconnect로 내 정보가 지워진다. 처음 화면으로 가도 지운다
//  - 퀴즈·구글 시트 코드와는 따로 돌아간다
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getDatabase, ref, set, update, remove, onDisconnect, serverTimestamp,
  onChildAdded, onChildChanged, onChildRemoved }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const SF = window.SF;
const cfg = window.GAME_CONFIG;
const $ = (id) => document.getElementById(id);

// 방은 하나만 쓴다 (config.js의 firebase.room, 없으면 'forest'). 닉네임은 입장 때 적은 이름
const ROOM = String((cfg.firebase && cfg.firebase.room) || 'forest').replace(/[.#$[\]/\s]/g, '') || 'forest';
const cleanNick = (s) => Array.from(String(s || '').trim()).slice(0, 10).join('');
// 이 창의 ID (새로 열 때마다 새로: 같은 학생이 두 기기에서 해도 겹치지 않게)
const myId = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, '');

let db = null;
try {
  if (cfg.firebase && cfg.firebase.databaseURL) db = getDatabase(initializeApp(cfg.firebase));
} catch (e) {
  console.warn('Firebase 시작 실패', e);
}

let me = null; // { room, nick, ref }

// ---------------------------------------------------------------- 같은 방 친구들 (보기)
// 바뀐 사람의 정보만 받아(onChild…) 그 사람 것만 고친다. 이름표 그림은 닉네임·화면 배율이 바뀔 때만 다시 만든다
const others = new Map(); // id → { nick, floor, charId, y(그리는 높이), label, labelKey }
let stopWatch = [];
function watch(room) {
  const list = ref(db, 'rooms/' + room + '/players');
  const put = (snap) => {
    if (snap.key === myId) return;
    const v = snap.val() || {};
    const o = others.get(snap.key) || { y: null, label: null, labelKey: '' };
    o.nick = cleanNick(v.nick) || '친구';
    o.floor = Math.max(1, Number(v.floor) || 1);
    o.charId = v.charId;
    others.set(snap.key, o);
  };
  stopWatch = [
    onChildAdded(list, put),
    onChildChanged(list, put),
    onChildRemoved(list, (snap) => others.delete(snap.key)),
  ];
}
function unwatch() {
  for (const off of stopWatch) off();
  stopWatch = [];
  others.clear();
}

// 친구가 같은 발판에 몰려도 겹치지 않게: ID로 발판 안의 칸을 정한다
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
let treadLevel = null, treadByFloor = null;
function treadAt(level, floor) {
  if (treadLevel !== level) { treadLevel = level; treadByFloor = new Map(level.treads.map((t) => [t.row + 1, t])); }
  return treadByFloor.get(floor);
}
// 닉네임 이름표 (화면 픽셀 크기로 한 번 그려 두고 재사용)
function makeLabel(nick, z) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = 'bold ' + Math.max(9, Math.round(5.5 * z)) + 'px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  g.font = font;
  c.width = Math.ceil(g.measureText(nick).width) + 6;
  c.height = Math.max(9, Math.round(5.5 * z)) + 6;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 3;
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(20, 10, 4, 0.9)';
  g.strokeText(nick, c.width / 2, c.height / 2);
  g.fillStyle = '#fff7e6';
  g.fillText(nick, c.width / 2, c.height / 2);
  return c;
}

const CS = cfg.world.cell;
let lastT = 0;
SF.drawGhosts = function (ctx, v) {
  if (!others.size) return;
  const dt = Math.min(0.1, Math.max(0, v.time - lastT));
  lastT = v.time;
  const z = v.z;
  const onFloor = new Map(); // 층마다 지금까지 그린 사람 수 → 같은 발판이면 다음 칸, 칸이 모자라면 반 칸씩 비켜서
  ctx.save();
  for (const [id, o] of others) {
    const t = treadAt(v.level, o.floor);
    const targetY = (o.floor - 1) * CS;
    o.y = o.y == null ? targetY : o.y + (targetY - o.y) * Math.min(1, dt * 10); // 층이 바뀌면 부드럽게 따라감
    if (o.y > v.top + 8 || o.y + 40 < v.bottom) continue; // 화면 밖은 안 그림
    const k = onFloor.get(o.floor) || 0;
    onFloor.set(o.floor, k + 1);
    const width = t ? t.c1 - t.c0 + 1 : 1;
    const col = t ? t.c0 + ((hash(String(o.floor)) + k) % width) : Math.floor(cfg.world.cols / 2);
    const x = col * CS + (Math.floor(k / width) % 2 ? CS / 2 : 0) * (Math.floor(k / width) % 4 < 2 ? 1 : -1);
    const who = (o.charId && v.sprites.characters[o.charId]) || v.sprites.player;
    const im = who.right.idle[0];
    ctx.globalAlpha = 0.45;
    SF.drawSprite(ctx, im, v.sx(x), v.sy(o.y + 24), z);
    const key = o.nick + '|' + z;
    if (o.labelKey !== key) { o.label = makeLabel(o.nick, z); o.labelKey = key; }
    ctx.globalAlpha = 0.85;
    ctx.drawImage(o.label, Math.round(v.sx(x + 8) - o.label.width / 2), v.sy(o.y + 27 + (k % 2) * 6) - o.label.height); // 옆 사람과 이름표가 겹치지 않게 번갈아 높이
  }
  ctx.restore();
};

function leave() {
  unwatch();
  if (!me) return;
  const r = me.ref;
  me = null;
  onDisconnect(r).cancel().catch(() => {});
  remove(r).catch(() => {});
}

function join(name) {
  leave();
  const room = ROOM;
  const nick = cleanNick(name);
  if (!db || !nick) return;
  const r = ref(db, 'rooms/' + room + '/players/' + myId);
  me = { room, nick, ref: r };
  // 끊기면 지우기를 먼저 걸어 두고 저장 (저장만 되고 안 지워지는 일이 없게)
  onDisconnect(r).remove()
    .then(() => set(r, { nick, floor: 1, state: 'climb', charId: SF.game.charId || '', t: serverTimestamp() }))
    .catch((e) => console.warn('방 입장 저장 실패', e));
  watch(room);
}

const game = SF && SF.game;
if (game) {
  const begin = game.begin;
  game.begin = function (student, charId) {
    begin.call(this, student, charId);
    game.standFloor = null;
    join(student.name);
  };
  const toHome = game.toHome;
  game.toHome = function () {
    leave();
    return toHome.apply(this, arguments);
  };
  // 층이 바뀔 때만 저장
  game.onFloor = function (floor) {
    if (!me) return;
    update(me.ref, { floor, t: serverTimestamp() }).catch(() => {});
  };
}

// 디버그용: 지금 방 정보
SF.room = { status: () => (me ? { room: me.room, nick: me.nick, id: myId } : null) };
