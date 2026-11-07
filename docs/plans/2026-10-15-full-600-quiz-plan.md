# 완성본 1단계 (600층 + 퀴즈 + 15분 + 점수) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1~600층 한 맵 + 10·30·…·590층 과학 퀴즈 30개 + 등반 시간 15분 제한 + 점수 결과 화면.

**Architecture:** 기존 일반 `<script>` 구조(전역 `window.SF`, 빌드 없음)를 따른다. 퀴즈·점수는 순수 함수 파일(`quiz.js`, `score.js`, 데이터 `questions.js`)로 두고 `game.js`가 상태(`quiz`, `timeup`)로 연결한다. 600층 맵은 생성기를 튼튼하게 고치고, 학생 기기에서는 미리 검증한 맵 번호로 검사 없이 바로 만든다.

**Tech Stack:** HTML5 Canvas, 순수 JS(ES2017, 모듈 없음), 브라우저 테스트(`tests.html` → `window.TEST_RESULTS`), 로컬 서버 `.claude/launch.json` "forest" (포트 8123). git 없음 → 커밋 대신 진행 기록(`docs/plans/2026-10-14-phase1-progress.md`)에 한 줄.

**Spec:** `docs/specs/2026-10-15-full-600-quiz-design.md`

## Global Constraints

- 모든 조정값은 `config.js`(한글 주석). 새 값: `timeLimitSec: 900`, `quiz: { firstFloor: 10, every: 20, count: 30 }`, `score: { perFloor: 10, finishBonus: 3000, perSecondLeft: 5, perCorrect: 200, perCombo: 10 }`, `map: { seed, hazardTry, check }`.
- 600층 구간표는 spec §3 그대로. 돌풍은 441~500에만.
- 등반 시간은 `playing` 상태에서만 흐름(퀴즈 중 멈춤), 총 플레이 시간은 `playing`+`quiz`.
- 오답 벌칙 없음. 순위 규칙(완주 우선)은 3단계 몫 — 이번엔 결과 화면만.
- 학생 화면 문구는 한국어, 띄어쓰기·존댓말 기존 화면과 같게.
- 아티팩트 페이지(scratchpad `artifact/science-forest.html`)와 `index.html`은 같은 DOM을 유지.

## Review Focus

- 퀴즈 층에 도착하는 순간 ◀▶를 연타해도: 줄 선 입력은 버려지고 퀴즈가 뜬다 → Task 6 테스트 `game: quiz clears queued taps`.
- 등반 시간이 뛰는 중·떨어지는 중에 0이 되면: 즉시 시간 종료, 최고 층으로 점수 → Task 6 브라우저 확인 + `score` 테스트(미완주).
- 문제가 30개보다 적은 문제은행: 다 쓰면 다시 섞어 계속 낸다(빈 퀴즈 금지) → Task 4 `quiz: small bank refills`.
- 선생님이 `zones`를 고치고 `map` 값은 그대로 둔 경우: 느려도 전체 검사로 맞는 맵을 만들고, 새 `map` 값을 안내 → Task 3 `map: stale check falls back to a full build`.
- 긴 문제·작은 화면(360×740): 퀴즈 상자가 화면을 넘지 않고 스크롤 → Task 6 브라우저 확인.

---

### Task 1: 600층 맵 생성 안정화

현재(측정): 600층 시드 60개 중 41개 생성 실패(`generateLevel` → null), 생성된 19개 중 14개가 "바위에서 내려올 길이 없어요"로 검사 실패. 검사 1회 ≈ 0.57초(PC).

**Files:** Modify `js/level.js` (generateLevel, validateLevel 바위 검사 부분, buildLevel), Test `js/tests.js`

**Interfaces:**
- Produces: `SF.rockEscapes(level, cfg, rock, world, map) -> boolean` (validateLevel의 바위 검사 본문을 꺼낸 것, 같은 의미), `SF.repairRocks(level, cfg) -> number` (고친 바위 수), `generateLevel`은 실패 대신 비행 단위 재시도.

- [ ] **Step 1: 실패 테스트** — 테스트 전용 600층 구간표 `CFG600`(spec §3, 장애물 없이)를 tests.js 위쪽에 만들고:
  - `level600: most seeds generate` — 시드 `s*101+7` (s=1..20) 중 `generateLevel` 성공 ≥ 19
  - `level600: most seeds validate` — 위 성공분에 `fixFallDepths` + `repairRocks` 후 `validateLevel` 오류 없음 ≥ 70%
  - `rocks: repaired rock tops can be left` — 위 맵들에서 모든 바위가 `rockEscapes` true
- [ ] **Step 2: 실행 → FAIL 확인** (`tests.html`, 생성 성공 약 6/20)
- [ ] **Step 3: 구현**
  - `generateLevel`: 비행(flight)을 시작할 때 상태(격자 복사본, treads/rocks 길이, row/dir/cursor/flight)를 저장하고, 그 비행이 실패하면(첫 디딤판 못 놓음, makeSafe 실패) 되돌려 같은 rng로 다시 뽑기 최대 12번, 그래도 안 되면 한 비행 더 되돌림(최대 3단계). 끝내 안 되면 null. 격자 복사는 `createGrid`의 내부 배열을 `slice()` (필요하면 `SF.cloneGrid(g)`를 world.js에 추가).
  - `repairRocks`: `rockEscapes`가 false인 바위마다 바위 두 칸을 비우고, 그 꺾임을 `extendToWall`로 막는다(못 하면 바위 칸 발판만 남겨 열린 꺾임으로 두되 추락 깊이는 이후 검사가 본다). `buildLevel`에서 `fixFallDepths` 다음, `validateLevel` 전에 호출.
- [ ] **Step 4: 실행 → PASS**, 기존 테스트도 전부 통과
- [ ] **Step 5: 진행 기록에 한 줄** (성공률 전/후)

### Task 2: 600층 설정 + 퀴즈 층 쉬는 자리 + 최고 난이도 모드 정리

**Files:** Modify `config.js`, `js/hazards.js` (placeHazards), `js/level.js` (checkConfig, `SF.quizFloors` 사용), `js/game.js`·`js/debug.js`·`index.html`·아티팩트 페이지(모드 전환·hardTest·floorOffset 코드 삭제), `js/render.js`(floorOffset 삭제), Test `js/tests.js`

**Interfaces:**
- Consumes: Task 4의 `SF.quizFloors(cfg) -> number[]` (이 Task에서 먼저 quiz.js에 이 함수만 만들어도 됨)
- Produces: `config.js`의 600층 `zones`, `quiz`, `totalFloors: 600`

- [ ] **Step 1: 실패 테스트**
  - `config600: zones match the plan` — 구간 경계 [20,40,60,100,150,200,280,360,440,500,600], 돌풍은 마지막 두 번째 구간에만
  - `hazards: quiz floors are rest stops` — 기본 맵에서 퀴즈 층 행과 그 위 행에 장애물 없음, 퀴즈 층 발판은 금 간 발판 아님
  - `hazards: 501-600 is the old hard test` — 501~600에 겹친 층 있음, speed 1.5, 금 간 발판 delay 0.47, 깊은 추락 ≥ 50층
  - `fairness: careful climber 61-600` — 맞음 0, 밀림 0
  - 기존 hard/floorOffset 테스트 삭제, 무거운 시드 순회 테스트(`build: seeds 1..10 valid`, `bot: from every tread` 등)는 200층짜리 `SMALL` 설정으로 바꿔 시간 유지
- [ ] **Step 2: 실행 → FAIL**
- [ ] **Step 3: 구현** — spec §3 표를 `zones`로. `placeHazards`: 점 장애물은 행 `q-1`(퀴즈 층)·`q`(그 위)에 두지 않음, 금 간 발판은 퀴즈 층 행에 두지 않음. 시작 화면 모드 버튼·`hardTest`·`SF.hardConfig`·`floorOffset`·`setMode` 삭제(구간 연습 버튼은 유지).
- [ ] **Step 4: 실행 → PASS**
- [ ] **Step 5: 기록**

### Task 3: 미리 검증한 맵으로 빠르게 만들기

**Files:** Modify `js/level.js` (prepareLevel, buildLevel), `config.js` (`map`), `js/debug.js`, Test `js/tests.js`

**Interfaces:**
- Produces: `SF.mapFingerprint(cfg) -> string` (seed 제외, `totalFloors, world, player, step, physics, zones, obstacles, rockBumperChance, quiz`를 안정적으로 JSON → 32비트 해시 16진수), `buildLevel` 결과 `level.hazardTry`, `SF.prepareLevel(cfg)`가 `cfg.map.check === mapFingerprint(cfg)`이면 `generateLevel(cfg, map.seed)` + `fixFallDepths` + `repairRocks` + `placeHazards(rng(hazardTry))`만 하고 `report = { errors: [], botSeconds: null, falls: [], fast: true }`.

- [ ] **Step 1: 실패 테스트**
  - `map: fast build equals the full build` — 같은 treads·rocks·hazards·crumbles
  - `map: default config has a current map entry` — `GAME_CONFIG.map.check === SF.mapFingerprint(GAME_CONFIG)` (설정만 고치고 map을 안 맞추면 여기서 걸림)
  - `map: stale check falls back to a full build` — check를 틀리게 주면 전체 검사 + 안내 문구에 새 `map: { seed: …, hazardTry: …, check: '…' }` 한 줄
- [ ] **Step 2: FAIL 확인**
- [ ] **Step 3: 구현**, 기본 설정으로 전체 검사를 한 번 돌려 나온 값을 `config.js`의 `map`에 적는다(주석: "zones·obstacles를 고치면 조정 패널의 '맵 번호 다시 찾기'로 새 값을 받아 붙여 넣기"). 조정 패널에 그 버튼(결과 한 줄을 복사 칸에).
- [ ] **Step 4: PASS + 빠른 길 시간 측정 (PC 300ms 이하 목표, 진행 기록에 적기)**
- [ ] **Step 5: 기록**

### Task 4: 퀴즈 핵심 (문제 고르기)

**Files:** Create `js/questions.js`, `js/quiz.js`; Modify `tests.html`, `index.html`, 아티팩트 페이지(스크립트 순서: talk.js 다음 questions.js, quiz.js, 그다음 hazards.js); Test `js/tests.js`

**Interfaces:**
- Produces:
  - `SF.QUESTIONS`: `{ id: string, q: string, choices: [4 strings], answer: 0..3, explain: string }[]` 40개 (spec §4 단원, 사실 확인된 내용만, 보기 중복 없음)
  - `SF.quizFloors(cfg) -> number[]` (`firstFloor + every*i`, i < count, ≤ totalFloors)
  - `SF.createQuizRun(bank, cfg, rng) -> { order: question[], next: number, done: Set<floor>, correct: number, wrong: number }`
  - `SF.quizAt(run, cfg, floor) -> question | null` (퀴즈 층이고 아직 안 푼 층이면 다음 문제, 안 넘김)
  - `SF.answerQuiz(run, floor, choice) -> { correct: boolean, answer: number, explain: string }` (그 층 done, 카운트 증가, next++)
- [ ] **Step 1: 실패 테스트** — `quiz: floors are 10..590`, `quiz: 30 different questions in a run`, `quiz: a floor is asked once`, `quiz: small bank refills` (문제 5개 은행으로 30번 모두 문제가 나옴), `questions: well formed` (40개, 보기 4개, answer 0~3, id 중복 없음, 문제·해설 비어 있지 않음)
- [ ] **Step 2: FAIL**
- [ ] **Step 3: 구현** (문제가 count보다 적으면 다 쓴 뒤 rng로 다시 섞어 이어 붙임)
- [ ] **Step 4: PASS**
- [ ] **Step 5: 기록**

### Task 5: 점수와 시간 설정

**Files:** Create `js/score.js`; Modify `config.js`, `js/level.js` (checkConfig), html 두 곳(score.js 스크립트); Test `js/tests.js`

**Interfaces:**
- Produces: `SF.computeScore({ bestFloor, finished, climbTime, correct, maxCombo }, cfg) -> { floor, finish, speed, quiz, combo, total }` — speed = 완주일 때만 `floor(max(0, timeLimitSec − climbTime)) × perSecondLeft`, timeLimitSec 0이면 speed 0.
- [ ] **Step 1: 실패 테스트** — `score: finished example` (600층, 완주, climbTime 600, 정답 24, 콤보 80 → total 16100), `score: unfinished example` (420, 미완주, 정답 18, 콤보 60 → 8400, speed 0), `config: time, quiz and score values are checked` (timeLimitSec −1, quiz.every 0, score.perCorrect 'x' → 각각 안내)
- [ ] **Step 2: FAIL** → **Step 3: 구현** → **Step 4: PASS** → **Step 5: 기록**

### Task 6: 게임에 연결 (퀴즈 창, 남은 시간, 결과 화면, 표지판)

**Files:** Modify `js/game.js`, `js/render.js`, `js/sprites.js`, `js/debug.js`, `index.html`, 아티팩트 페이지, `css/style.css`; Test `js/tests.js` + 브라우저

**Interfaces:**
- Consumes: Task 4·5 함수, `SF.QUESTIONS`
- Produces: `game.state` ∈ `ready | playing | quiz | finished | timeup`, `game.stats = { climbTime, totalTime, falls, hits, bestFloor, maxCombo }`, `game.quiz` (현재 퀴즈 run), `game.answer(choice)`, `game.continueAfterQuiz()`, `game.advance(seconds)`는 quiz 상태에서 아무것도 안 함(시계 멈춤)
- [ ] **Step 1: 실패 테스트** (tests.html에서 game.js 없이 쓸 수 있게 출제 판단을 순수 함수로) — `SF.shouldAskQuiz(run, cfg, player, stepper) -> question|null`: `game: quiz waits until standing on the quiz step` (뛰는 중이면 null, 서 있으면 문제), `game: quiz clears queued taps` (호출 쪽이 지키는 규칙 → `SF.openQuiz(stepper)`가 queue 비움)
- [ ] **Step 2: FAIL** → **Step 3: 구현**
  - 상태 `quiz`: stepOnce 안 돎(시계·장애물·바람·금 간 발판·콤보·등반 시간 멈춤), 총 시간만 frame에서 증가. ◀▶ 무시.
  - 퀴즈 상자(DOM `#quiz`): "과학 퀴즈 n/30", 문제, 보기 버튼 4개, PC 1~4 키 → 결과(정답/오답, 정답 강조, 해설) + [계속 오르기].
  - HUD 타이머: `남은 mm:ss` (등반 시간 기준), 60초 이하 빨간색(`data-low`). 0 → `timeup`.
  - 결과 상자(`#finish` 재사용): 제목(완주! / 시간 종료! / 연습 완주! (기록 안 남음)), 점수 표(층·완주·빨리 도착·퀴즈 n/30·콤보·합계), 등반 시간, 총 플레이 시간, 추락.
  - 표지판 그림 2종(? / ✓, 12×14 오리지널), 퀴즈 층 발판 위에 그림.
  - 과학 상식 말풍선 층을 `f % 20 === 0`으로.
  - 조정 패널: "퀴즈 건너뛰기", "1분 남기기".
- [ ] **Step 4: PASS + 브라우저 확인** (375×812, 360×740): 퀴즈 열림·멈춤(장애물 위치 그대로)·답·계속, 시간 종료 결과, 완주 결과 점수, 오류 없음
- [ ] **Step 5: 기록**

### Task 7: 전체 확인, 시간 측정, 게시

**Files:** README.md, spec 상태 줄, 진행 기록, 메모리, 아티팩트 files 맵(새 js 3개)

- [ ] **Step 1:** `tests.html` 전부 PASS
- [ ] **Step 2:** 봇 시간 측정 — 조심하는 봇 1→600 등반 시간, 서두르는 봇이 15분 안에 몇 층까지 가는지 (게임 페이지 `game.advance`)
- [ ] **Step 3:** 폰 크기 화면 확인 후 같은 아티팩트 URL로 재게시
- [ ] **Step 4:** README(600층·퀴즈·점수·map 값), spec 상태 "구현 완료", 진행 기록, 메모리 갱신
