// 개발용: 브라우저 안에서 apps-script/Code.js를 가짜 구글 시트로 돌려 화면 흐름을 확인한다 (게임에는 안 들어감)
// 쓰는 법 (게임 화면의 콘솔에서):
//   await SF_DEV.useFakeSheet({ delayMs: 300 })   → SF.sheet가 가짜 서버로 바뀌고, 문제·말풍선을 다시 불러옴
//   SF_DEV.sheets.get('랭킹').data                  → 가짜 시트 내용 보기
//   SF_DEV.offline = true                          → 연결 끊김 흉내
window.SF_DEV = window.SF_DEV || {};
(function (D) {
  'use strict';

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src + '?v=' + Date.now();
      s.onload = resolve;
      s.onerror = () => reject(new Error('load ' + src));
      document.head.appendChild(s);
    });
  }

  function fakeGoogle() {
    const sheets = new Map();
    const mkSheet = (name) => {
      const data = [];
      const fit = (row) => { while (data.length < row) data.push([]); };
      return {
        name, data,
        getLastRow: () => data.length,
        appendRow: (row) => { data.push(row.slice()); },
        setFrozenRows() {},
        getDataRange: () => ({ getValues: () => data.map((r) => r.slice()) }),
        getRange: (row, col, nr, nc) => ({
          setValues: (vals) => {
            for (let i = 0; i < (nr || 1); i++) { fit(row + i); for (let j = 0; j < (nc || 1); j++) data[row - 1 + i][col - 1 + j] = vals[i][j]; }
          },
          setValue: (v) => { fit(row); data[row - 1][col - 1] = v; },
        }),
      };
    };
    const ss = { getSheetByName: (n) => sheets.get(n) || null, insertSheet: (n) => { const s = mkSheet(n); sheets.set(n, s); return s; } };
    const cache = new Map();
    window.SpreadsheetApp = { getActiveSpreadsheet: () => ss };
    window.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
    window.CacheService = { getScriptCache: () => ({ get: (k) => (cache.has(k) ? cache.get(k) : null), put: (k, v) => { cache.set(k, v); } }) };
    window.ContentService = { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ text: s, setMimeType() { return this; } }) };
    return sheets;
  }

  D.offline = false;
  D.useFakeSheet = async function (opts) {
    const o = opts || {};
    if (typeof window.doGet !== 'function') await loadScript('apps-script/Code.js');
    D.sheets = fakeGoogle();
    window.setup();
    D.calls = [];
    const fetch = (url, init) => new Promise((resolve, reject) => {
      D.calls.push({ url, init });
      setTimeout(() => {
        if (D.offline) { reject(new TypeError('Failed to fetch')); return; }
        const q = new URL(url).searchParams;
        const out = init && init.method === 'POST'
          ? window.doPost({ postData: { contents: init.body } })
          : window.doGet({ parameter: { action: q.get('action') } });
        resolve({ ok: true, json: () => Promise.resolve(JSON.parse(out.text)) });
      }, o.delayMs || 0);
    });
    SF.sheet = SF.createSheetClient({ url: 'https://script.google.com/macros/s/FAKE/exec', fetch, storage: window.localStorage, timeoutMs: o.timeoutMs || 10000 });
    await SF.sheetUi.boot();
    return SF.sheetUi.status();
  };
})(window.SF_DEV);
