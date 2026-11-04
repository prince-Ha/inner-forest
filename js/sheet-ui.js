// 구글 시트 화면 (설계 문서 2026-10-16 3단계)
//  - 열 때: 시트의 문제·말풍선 불러오기, 못 보낸 기록 다시 보내기 (실패하면 게임 안 문제로 조용히)
//  - 판이 끝나면: 기록 보내기, 결과 화면에 저장 상태, 완주자는 한마디 칸
//  - 랭킹·한마디 보드 (우리 반 / 전교 / 한마디)
//  - 선생님 상자의 시트 부분: 연결 상태, 완주자 목록, 한마디 숨기기
// 시트 클라이언트는 매번 SF.sheet로 부른다 (브라우저 확인 때 가짜 서버로 바꿔 끼울 수 있게)
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const cfg = window.GAME_CONFIG;
  const game = SF.game;
  const storage = (() => { try { return window.localStorage; } catch (_) { return null; } })();
  const url = String((cfg.sheet && cfg.sheet.url) || '').trim();
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const md = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : (d.getMonth() + 1) + '/' + d.getDate(); };
  const mmss = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  const won = (n) => Number(n || 0).toLocaleString('ko-KR');
  // 한 줄 안내: kind = ok(초록) / wait(노랑) / bad(빨강)
  function say(id, text, kind) {
    const p = $(id);
    p.textContent = text || '';
    p.dataset.kind = kind || '';
    p.hidden = !text;
  }

  SF.sheet = SF.createSheetClient({ url, storage, timeoutMs: 10000 });

  // ------------------------------------------------------------ 열 때: 문제·말풍선 불러오기
  const conn = { state: 'off', detail: '', questions: 0 };
  function connText() {
    const left = SF.sheet.pending();
    const pend = left ? ' · 아직 못 보낸 기록 ' + left + '개' : '';
    switch (conn.state) {
      case 'off': return { kind: '', text: '연결 안 함 — config.js의 sheet.url이 비어 있어요. 게임 안 문제로 해요.' };
      case 'bad-url': return { kind: 'bad', text: '주소가 이상해요 — sheet.url은 https://script.google.com/… 로 시작해야 해요.' };
      case 'wait': return { kind: 'wait', text: '연결 확인 중…' };
      case 'ok': return conn.questions
        ? { kind: 'ok', text: '연결됨 — 시트 문제 ' + conn.questions + '개 · 말풍선 불러옴' + pend }
        : { kind: 'wait', text: '연결됨 — 그런데 쓸 수 있는 문제가 없어 게임 안 문제로 해요 (문제 탭 확인)' + pend };
      default: return { kind: 'bad', text: '연결 실패 (' + conn.detail + ') — 게임 안 문제로 해요. 주소와 배포 설정(액세스: 모든 사용자)을 확인해 주세요.' + pend };
    }
  }
  function boot() {
    if (!SF.sheet.enabled) { conn.state = url ? 'bad-url' : 'off'; return Promise.resolve(); }
    conn.state = 'wait';
    return SF.sheet.bootstrap().then((b) => {
      if (b.questions.length) game.bank = b.questions; // 다음 판부터 시트 문제
      SF.applyTalkLines(b.lines);
      conn.questions = b.questions.length;
      conn.state = 'ok';
      return SF.sheet.flush();
    }).catch((e) => {
      conn.state = 'fail';
      conn.detail = e.message === 'timeout' ? '응답 없음' : e.message === 'network' ? '연결 안 됨' : e.message;
    }).then(syncTeacherStatus);
  }

  // ------------------------------------------------------------ 판이 끝나면: 기록 보내기
  let msgFor = null; // 한마디를 남길 학생 {id, name, classNo}
  game.onRecord = function (rec) {
    const onResult = game.state === 'finished' || game.state === 'timeup';
    if (onResult) {
      say('save-status', '');
      $('msg-box').hidden = true;
    }
    if (rec.test || !SF.sheet.enabled) return; // 테스트·연습·시트 없음: 안 보냄
    if (onResult) say('save-status', '기록 저장 중…', 'wait');
    const runId = rec.runId;
    SF.sheet.sendRecord(rec).then((res) => {
      if (res.ok) SF.sheet.flush(); // 연결된 김에 밀린 기록도
      if (!onResult || game.runId !== runId) return; // 그새 다른 판을 시작했으면 화면은 그대로
      const s = SF.recordStatus(res);
      say('save-status', s.text, s.kind);
      if (res.ok && rec.finished) {
        msgFor = { id: rec.id, name: rec.name, classNo: rec.classNo };
        $('msg-input').value = '';
        say('msg-status', '');
        $('msg-box').hidden = false;
      }
    });
  };

  function sendMessage() {
    if (!msgFor) return;
    const text = $('msg-input').value;
    const problem = SF.messageProblem(text);
    if (problem) { say('msg-status', problem, 'bad'); return; }
    const btn = $('msg-send');
    btn.disabled = true;
    say('msg-status', '보내는 중…', 'wait');
    SF.sheet.sendMessage(Object.assign({ text: text.trim() }, msgFor)).then((res) => {
      if (res && res.ok) say('msg-status', '한마디를 남겼어요! 랭킹 보드의 한마디 탭에서 볼 수 있어요. (다시 쓰면 바뀌어요)', 'ok');
      else say('msg-status', (res && res.error) || '남기지 못했어요.', 'bad');
    }, () => say('msg-status', '인터넷 연결이 안 돼서 못 남겼어요. 잠시 뒤 다시 눌러 주세요.', 'bad'))
      .then(() => { btn.disabled = false; });
  }

  // ------------------------------------------------------------ 랭킹·한마디 보드
  const board = { tab: 'school', me: null, data: null, ask: 0 };
  // 보드에서 '나': 결과 화면에서는 이번 판 학생, 처음 화면에서는 입력한 이름·반
  function meFromHome() {
    const s = { name: $('in-name').value, classNo: $('in-class').value ? Number($('in-class').value) : null };
    if (!s.classNo) return null;
    return { classNo: s.classNo, id: SF.validateStudent(s, cfg).length ? null : SF.studentId(s, cfg) };
  }
  const meFromGame = () => (game.student ? { classNo: game.student.classNo, id: SF.studentId(game.student, cfg) } : null);

  function openBoard(me, tab) {
    board.me = me;
    board.tab = tab || (me ? 'class' : 'school');
    board.data = null;
    $('board').classList.remove('hidden');
    renderBoard();
    if (!SF.sheet.enabled) return;
    const ask = ++board.ask;
    SF.sheet.board().then((res) => {
      if (ask !== board.ask) return;
      if (!res || !res.ok) throw new Error((res && res.error) || 'bad');
      board.data = res;
      renderBoard();
    }).catch(() => {
      if (ask === board.ask) say('board-note', '랭킹을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 열어 주세요.', 'bad');
    });
  }

  function renderBoard() {
    for (const b of $('board-tabs').children) b.setAttribute('aria-selected', b.dataset.tab === board.tab ? 'true' : 'false');
    const list = $('board-list');
    list.textContent = '';
    if (!SF.sheet.enabled) { say('board-note', '아직 구글 시트가 연결되지 않아서 랭킹이 없어요.'); return; }
    if (!board.data) { say('board-note', '불러오는 중…', 'wait'); return; }
    const d = board.data;
    if (board.tab === 'messages') {
      say('board-note', d.messages.length ? '600층을 완주한 친구들의 한마디' : '아직 한마디가 없어요. 600층을 완주하면 남길 수 있어요!');
      for (const m of d.messages) {
        const li = el('li', 'm-row');
        li.appendChild(el('p', 'm-text', m.text));
        li.appendChild(el('p', 'm-meta', m.name + ' · ' + m.classNo + '반 · ' + md(m.date)));
        list.appendChild(li);
      }
      return;
    }
    if (board.tab === 'class' && !(board.me && board.me.classNo)) {
      say('board-note', '처음 화면에서 반을 고르면 우리 반 랭킹을 볼 수 있어요.');
      return;
    }
    const rows = SF.boardRows(d.ranking, { tab: board.tab, classNo: board.me && board.me.classNo, id: board.me && board.me.id });
    const done = rows.filter((r) => r.label === '완주').length;
    const where = board.tab === 'class' ? cfg.school.grade + '학년 ' + board.me.classNo + '반' : cfg.school.grade + '학년 전체';
    say('board-note', rows.length ? where + ' · ' + rows.length + '명 · 완주 ' + done + '명' : '아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!');
    let mine = null;
    for (const r of rows) {
      const li = el('li', 'b-row' + (r.me ? ' me' : ''));
      li.appendChild(el('span', 'b-rank', String(r.rank)));
      const name = el('span', 'b-name', r.name);
      if (board.tab === 'school') name.appendChild(el('small', '', r.classNo + '반'));
      li.appendChild(name);
      li.appendChild(el('span', 'b-floor' + (r.label === '완주' ? ' done' : ''), r.label));
      li.appendChild(el('span', 'b-score', won(r.score)));
      list.appendChild(li);
      if (r.me) mine = li;
    }
    list.scrollTop = 0;
    if (mine) mine.scrollIntoView({ block: 'nearest' });
  }

  // ------------------------------------------------------------ 선생님 상자의 시트 부분
  let teacherPw = ''; // 선생님 모드에 들어올 때 적은 비밀번호 (메모리에만, 구글 쪽에서 다시 확인)
  function syncTeacherStatus() {
    const s = connText();
    say('sheet-status', s.text, s.kind);
    $('sheet-tools').hidden = conn.state !== 'ok' || !teacherPw;
  }
  // 선생님 쪽 요청: 실패하면 안내 한 줄
  function teacherCall(fn, render) {
    say('t-note', '불러오는 중…', 'wait');
    $('t-list').textContent = '';
    fn().then((res) => {
      if (!res || !res.ok) {
        const err = (res && res.error) || '불러오지 못했어요.';
        say('t-note', err + (/비밀번호/.test(err) ? ' (시트 설정 탭의 비밀번호가 config.js의 teacher.password와 같은지 확인해 주세요)' : ''), 'bad');
        return;
      }
      render(res);
    }, () => say('t-note', '연결이 안 돼요. 잠시 뒤 다시 눌러 주세요.', 'bad'));
  }
  function showFinishers() {
    teacherCall(() => SF.sheet.finishers(teacherPw), (res) => {
      const groups = SF.finishersByClass(res.finishers);
      say('t-note', res.finishers.length ? '완주 ' + res.finishers.length + '명 (반별, 먼저 완주한 순)' : '아직 완주한 학생이 없어요.', 'ok');
      const box = $('t-list');
      for (const g of groups) {
        box.appendChild(el('h4', '', g.classNo + '반 · ' + g.students.length + '명'));
        const ul = el('ul');
        for (const s of g.students) {
          ul.appendChild(el('li', '', s.name + ' — ' + md(s.finishedAt) + ' 완주 · 등반 ' + mmss(s.climbTime) + ' · ' + won(s.score) + '점'));
        }
        box.appendChild(ul);
      }
    });
  }
  function showMessages() {
    teacherCall(() => SF.sheet.messages(teacherPw), (res) => {
      say('t-note', res.messages.length ? '숨기면 보드에서 안 보여요. (시트 한마디 탭의 숨김 칸을 지우면 다시 보여요)' : '아직 한마디가 없어요.', 'ok');
      const box = $('t-list');
      for (const m of res.messages) {
        const row = el('div', 't-msg' + (m.hidden ? ' is-hidden' : ''));
        const txt = el('div');
        txt.appendChild(el('p', 'm-text', m.text));
        txt.appendChild(el('p', 'm-meta', m.name + ' · ' + m.classNo + '반 · ' + md(m.date)));
        row.appendChild(txt);
        const b = el('button', 'menu-btn small', m.hidden ? '숨김' : '숨기기');
        b.type = 'button';
        b.disabled = m.hidden;
        b.addEventListener('click', () => {
          b.disabled = true;
          SF.sheet.hide(teacherPw, m.no).then((r) => {
            if (r && r.ok) { b.textContent = '숨김'; row.classList.add('is-hidden'); } else { b.disabled = false; say('t-note', (r && r.error) || '숨기지 못했어요.', 'bad'); }
          }, () => { b.disabled = false; say('t-note', '연결이 안 돼요. 잠시 뒤 다시 눌러 주세요.', 'bad'); });
        });
        row.appendChild(b);
        box.appendChild(row);
      }
    });
  }

  // ui.js가 선생님 상자를 열고 닫을 때 부른다
  SF.sheetUi = {
    teacherLogin(pw) { teacherPw = String(pw || '').trim(); },
    teacherOpened() {
      say('t-note', '');
      $('t-list').textContent = '';
      syncTeacherStatus();
    },
    teacherLogout() { teacherPw = ''; },
    status: () => Object.assign({}, conn),
    boot, // 다시 불러오기 (개발용 가짜 서버로 바꿔 끼운 뒤)
  };

  // ------------------------------------------------------------ 버튼 연결
  $('msg-send').addEventListener('click', sendMessage);
  $('msg-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } });
  $('board-open').addEventListener('click', () => openBoard(meFromHome()));
  $('board-from-result').addEventListener('click', () => openBoard(meFromGame()));
  $('board-close').addEventListener('click', () => { board.ask++; $('board').classList.add('hidden'); });
  for (const b of $('board-tabs').children) {
    b.addEventListener('click', () => { board.tab = b.dataset.tab; renderBoard(); });
  }
  $('t-finishers').addEventListener('click', showFinishers);
  $('t-messages').addEventListener('click', showMessages);
  boot();
})(window.SF);
