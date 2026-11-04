// 구글 시트(Apps Script 웹 앱)와 주고받기 (설계 문서 2026-10-16 3단계)
//  - 읽기(문제·말풍선·보드)는 GET, 쓰기(기록·한마디·선생님 기능)는 POST 본문 JSON
//  - POST는 Content-Type text/plain 으로 보낸다 → 브라우저가 사전 요청(CORS preflight)을 하지 않아 Apps Script가 받을 수 있다
//  - 비밀번호는 주소에 넣지 않고 본문으로
//  - 기록을 못 보내면(와이파이 끊김 등) 기기에 모아 두었다가 다음에 다시 보낸다
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  const PENDING = 'sf-pending-records';

  // 시트에서 온 문제 하나가 게임에서 쓸 수 있는 모양인가
  const goodQuestion = (q) => q && typeof q.q === 'string' && q.q.trim() && Array.isArray(q.choices) && q.choices.length === 4 &&
    q.choices.every((c) => typeof c === 'string' && c.trim()) && Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3;

  // opts = { url, fetch, storage, timeoutMs }
  SF.createSheetClient = function (opts) {
    const url = String(opts.url || '').trim();
    const doFetch = opts.fetch || (typeof window.fetch === 'function' ? window.fetch.bind(window) : null);
    const storage = opts.storage || null;
    const timeoutMs = opts.timeoutMs || 8000;
    const enabled = /^https:\/\//.test(url) && !!doFetch;

    // 응답이 timeoutMs 안에 안 오면 'timeout', 연결이 안 되면 'network'
    function call(fetchArgs) {
      if (!enabled) return Promise.reject(new Error('disabled'));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
        Promise.resolve()
          .then(() => doFetch(...fetchArgs))
          .then((res) => res.json())
          .then((json) => { clearTimeout(timer); resolve(json); },
            () => { clearTimeout(timer); reject(new Error('network')); });
      });
    }
    const get = (action) => call([url + '?action=' + encodeURIComponent(action), { method: 'GET', redirect: 'follow' }]);
    const post = (body) => call([url, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    }]);

    // 못 보낸 기록 (기기에 저장, 막혀 있어도 동작)
    const load = () => { try { return JSON.parse((storage && storage.getItem(PENDING)) || '[]'); } catch (_) { return []; } };
    const save = (list) => { try { if (storage) storage.setItem(PENDING, JSON.stringify(list)); } catch (_) { /* 저장 못 해도 동작 */ } };

    async function sendOne(record) {
      try {
        const res = await post({ action: 'record', record });
        return res && res.ok ? res : { ok: false, error: (res && res.error) || '저장하지 못했어요' }; // 거절된 기록은 다시 보내지 않음
      } catch (e) {
        return { ok: false, offline: true, error: e.message };
      }
    }

    const client = {
      enabled,
      // 문제·말풍선. 쓸 수 없는 문제는 빼고 돌려준다
      async bootstrap() {
        const res = await get('bootstrap');
        if (!res || !res.ok) throw new Error((res && res.error) || 'bad');
        // charLines: 캐릭터 이름별 말풍선 (예전 시트 설치본에는 없다)
        return { questions: (res.questions || []).filter(goodQuestion), lines: res.lines || {}, charLines: res.charLines || null };
      },
      // 한 판의 기록 보내기. 테스트 기록은 보내지 않음, 연결이 안 되면 모아 둠
      async sendRecord(record) {
        if (!enabled || !record || record.test) return { ok: false, skipped: true };
        const res = await sendOne(record);
        if (res.offline) {
          const list = load().filter((r) => r.runId !== record.runId);
          list.push(record);
          save(list.slice(-30));
          return { ok: false, queued: true, error: res.error };
        }
        return res;
      },
      // 모아 둔 기록 다시 보내기 → 보낸(또는 거절된) 개수
      async flush() {
        if (!enabled) return 0;
        const left = [];
        let done = 0;
        for (const r of load()) {
          const res = await sendOne(r);
          if (res.offline) left.push(r);
          else done++;
        }
        save(left);
        return done;
      },
      pending: () => load().length,
      board: () => get('board'),
      sendMessage: (m) => post({ action: 'message', id: m.id, name: m.name, classNo: m.classNo, text: m.text }),
      finishers: (password) => post({ action: 'finishers', password }),
      messages: (password) => post({ action: 'messages', password }),
      hide: (password, no) => post({ action: 'hide', password, no }),
    };
    return client;
  };

  // ---------------------------------------------------------------- 화면에 쓰는 정리 (보드·결과·선생님 상자)
  SF.MESSAGE_MAX = 30; // 한마디 글자 수 (Apps Script RULES.messageMax와 같게)
  SF.messageProblem = function (text) {
    const t = String(text == null ? '' : text).trim();
    if (!t) return '한마디를 적어 주세요.';
    if (Array.from(t).length > SF.MESSAGE_MAX) return '한마디는 ' + SF.MESSAGE_MAX + '글자까지예요.';
    return null;
  };

  // 랭킹 보드 한 탭의 줄들. ranking은 서버가 이미 순위대로 정렬해 보낸다
  // o = { tab: 'class'|'school', classNo, id(내 학생ID) }
  SF.boardRows = function (ranking, o) {
    const list = o.tab === 'class' ? ranking.filter((r) => o.classNo && r.classNo === Number(o.classNo)) : ranking;
    return list.map((r, i) => ({
      rank: i + 1, name: r.name, classNo: r.classNo, score: r.score,
      label: r.finished ? '완주' : r.bestFloor + '층',
      me: !!o.id && r.id === o.id,
    }));
  };

  // 기록 보낸 결과 → 결과 화면 한 줄 (kind: ok 저장됨, wait 기기에 보관, bad 저장 못 함)
  SF.recordStatus = function (res) {
    if (res && res.ok) {
      if (!res.rank) return { kind: 'ok', text: '기록을 저장했어요.' };
      const where = '전교 ' + res.rank.school + '등 · 우리 반 ' + res.rank.class + '등';
      return { kind: 'ok', text: res.best ? '기록 저장! ' + where : '기록 저장! 지난 기록이 더 좋아요 (' + where + ')' };
    }
    if (res && res.queued) return { kind: 'wait', text: '인터넷이 안 돼서 이 기기에 보관했어요. 다음에 게임을 열면 보내요.' };
    return { kind: 'bad', text: '기록을 저장하지 못했어요' + (res && res.error ? ': ' + res.error : '.') };
  };

  // 선생님 완주자 목록: 반별로, 반 안에서는 먼저 완주한 순
  SF.finishersByClass = function (list) {
    const by = new Map();
    for (const s of list) {
      const k = Number(s.classNo);
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(s);
    }
    return [...by.keys()].sort((a, b) => a - b).map((classNo) => ({
      classNo,
      students: by.get(classNo).slice().sort((a, b) => String(a.finishedAt).localeCompare(String(b.finishedAt))),
    }));
  };
})(window.SF);
