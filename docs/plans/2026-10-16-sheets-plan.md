# 완성본 3단계 (구글 시트) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`).

**Goal:** 구글 시트(Apps Script)와 게임 연결: 문제·말풍선 불러오기, 기록·랭킹, 완주자 한마디 보드, 선생님 기능.
**Architecture:** 서버 = `apps-script/Code.js` 한 파일(순수 함수는 `SFS` 객체에 모아 tests.html에서도 불러 테스트, 시트 API는 얇게). 클라이언트 = `js/sheet.js`(fetch, 시간 초과, 못 보낸 기록 모아 두기). 화면은 ui.js/game.js에 덧붙임.
**Spec:** `docs/specs/2026-10-16-sheets-design.md` · 진행 기록 `docs/plans/2026-10-16-sheets-progress.md`

## Global Constraints
- 비밀번호는 URL에 넣지 않음(POST 본문). 테스트·연습 기록은 절대 전송 안 함.
- 시트 연결 실패가 게임을 막지 않음(내장 문제·문구로 진행, 기록은 기기에 모아 둠).
- 점수 공식·시간 제한·퀴즈 층은 config.js와 같게(서버 상수 + 테스트로 같은지 확인).

## Review Focus
- 학교 와이파이 끊김: 기록 전송 실패 → 모아 두고 다음에 보냄, 같은 판 두 번 저장 안 됨 → Task 2·3 테스트
- 장난 기록(가짜 600층 10초 완주, 점수 부풀리기) → 서버 검사 테스트
- 시트에서 선생님이 문제를 잘못 적음(정답 칸 'E', 보기 빈칸) → 그 문제만 건너뜀 → parseQuestions 테스트
- 금지어를 띄어 쓰거나 기호 섞기 → 정규화 후 차단 테스트
- claude.ai 링크에서 연결이 막힘 → 내장 문제로 조용히 진행 (브라우저 확인)

### Task 1: 서버 순수 함수 (Code.js `SFS`)
`SFS.RULES`(totalFloors 600, timeLimitSec 900, quiz {10,20,30}, score {10,3000,5,200,10}, minFinishSec 60, nameMax 10, messageMax 30), `SFS.scoreOf(r)`, `SFS.quizzesUpTo(floor)`, `SFS.checkRecord(r) -> 오류|null`, `SFS.better(a, b) -> boolean`, `SFS.cleanMessage(text, badWords) -> {ok, text, reason}`, `SFS.parseQuestions(rows) -> question[]`, `SFS.parseLines(rows) -> {key: string[]}`, `SFS.SEED_QUESTIONS`, `SFS.SEED_LINES`.
- [ ] 테스트(설정값·점수가 config와 같음, 검사 경우들, 순위, 금지어, 문제·문구 읽기, 씨앗 = SF.QUESTIONS) → FAIL → 구현 → PASS

### Task 2: 서버 처리기 + 가짜 시트
`setup()`, `doGet(e)`, `doPost(e)` + 내부 `handle(action, body)`. 가짜 SpreadsheetApp/LockService/CacheService/ContentService는 tests.js 안에.
- [ ] 테스트(설치 탭·씨앗, bootstrap, 기록 추가·랭킹 갱신·나쁜 기록 무시, 중복 판번호, 잘못된 기록 거절, 한마디 권한·길이·금지어, 보드에서 숨김 제외, 숨기기 비밀번호, 완주자 목록 비밀번호) → FAIL → 구현 → PASS

### Task 3: 클라이언트 (js/sheet.js) + 기록·말풍선
`SF.createSheetClient({url, fetch, storage, timeoutMs})` → `{enabled, bootstrap(), sendRecord(r), flush(), board(), sendMessage(m), finishers(pw), hide(pw, id)}`; `SF.applyTalkLines(lines)`; `SF.makeRecord`에 `maxCombo`, `runId`.
- [ ] 테스트(가짜 fetch: GET/POST 모양, 시간 초과, 실패 시 모아 두기와 다음 flush, test 기록 거절, url 없으면 enabled false, 말풍선 교체) → FAIL → 구현 → PASS

### Task 4: 게임 연결
시작 시 bootstrap → `game.bank`, 결과 화면 저장 상태·한마디 칸·[랭킹 보기], 처음 화면 [랭킹·한마디], 보드 상자(탭 3개), 선생님 상자(연결 상태·완주자 목록·한마디 숨기기). index.html·css·ui.js·game.js.
- [ ] 브라우저: 가짜 서버(SF.sheet 바꿔 끼우기)로 전체 흐름, url 빈칸·연결 실패 시 조용히 진행, 폰 크기 → 기록

### Task 5: 설치 안내서·게시
`설치안내.md`(깃허브 페이지 올리기, 시트 만들기, Apps Script 붙여 넣기·setup 실행·웹 앱 배포, config.js에 주소), README, 아티팩트 재게시, 메모리.
