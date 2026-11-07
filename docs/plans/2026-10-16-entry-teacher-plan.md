# 완성본 2단계 (입장·선생님·일시정지·증명서) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, chosen in earlier phases). Steps use checkbox (`- [ ]`).

**Goal:** 처음(입장) 화면, 치이카와 4명 캐릭터, 일시정지·홈 버튼, 선생님 모드(테스트 모드·설정 요약·시트 자리), 완주 증명서.
**Architecture:** 순수 함수(`student.js`, `certificate.js`의 글자 부분, `characters.js` 데이터)는 tests.html로 TDD. DOM 연결은 `ui.js`가 game API만 부른다. `game.js`는 상태 `home`·`paused`만 늘린다.
**Tech Stack:** 기존과 같음 (일반 `<script>`, 전역 `SF`, 빌드 없음). git 없음 → 진행 기록 `docs/plans/2026-10-16-entry-teacher-progress.md`.
**Spec:** `docs/specs/2026-10-16-entry-teacher-design.md`

## Global Constraints
- 학생 화면 문구 한국어. 이름 1~10자(앞뒤 공백 제거). 반 1~`school.classCount`. 학생 ID `grade-반-이름`.
- 테스트 모드·구간 연습 판은 `makeRecord` 결과에 `test: true` → 3단계에서 절대 전송 안 함.
- 일시정지 중 등반 시간 멈춤, 전체 시간 흐름. 홈으로 나간 판은 `finished: false, quit: true` 기록.
- 저장소(localStorage) 실패해도 동작 (try/catch).
- 캐릭터 그림은 `js/characters.js`에만.

## Review Focus
- 처음 화면에서 ← → 키를 눌러도 게임이 시작되지 않아야 함 (입력 무시) → Task 5 브라우저 확인
- 일시정지 중 퀴즈·시간 종료가 겹치지 않음 (퀴즈 중엔 일시정지 버튼 무시) → Task 5
- 이름에 공백만 / 아주 긴 이름 / 이모지 → validateStudent 테스트
- 증명서 저장이 claude.ai 링크(샌드박스)에서 막혀도 이미지 길게 눌러 저장 가능하게 `<img>`로도 보여 줌 → Task 6
- 홈으로 나갔다 다시 시작하면 이전 판의 퀴즈·금 간 발판·시간이 남지 않음 → Task 5

---

### Task 1: 학생 정보·비밀번호·기록 (student.js)
**Produces:** `SF.classOptions(cfg) -> number[]`, `SF.validateStudent({name, classNo}, cfg) -> string[]`(오류 문구, 비면 통과), `SF.studentId({name, classNo}, cfg) -> '3-2-홍길동'`, `SF.loadStudent(storage) -> {name, classNo, charId}|null`, `SF.saveStudent(storage, s)`, `SF.checkTeacherPassword(cfg, input) -> boolean`, `SF.makeRecord({student, charId, stats, quiz, finished, quit, test}, cfg, now) -> { id, name, grade, classNo, charId, bestFloor, finished, climbTime, totalTime, correct, wrong, falls, score, quit, test, date }` (score = computeScore().total, date = ISO 문자열).
- [ ] 테스트: `student: class options`, `student: name and class are checked`(빈칸·공백만·11자·반 0·반 11 → 오류, '홍길동'/2반 → 통과), `student: id`, `student: remembered on this device`(가짜 저장소 + 던지는 저장소), `teacher: password`, `record: finished run`, `record: quit run keeps the best floor`, `record: test runs are marked`, `config: school and teacher are checked` → FAIL 확인
- [ ] 구현 + config `school`, `teacher` + checkConfig → PASS → 기록

### Task 2: 치이카와 캐릭터 (characters.js + sprites.js + render.js)
**Produces:** `SF.CHARACTERS` (id: chiikawa·hachiware·usagi·rakko, name: 치이카와·하치와레·우사기·랏코), `SF.buildSprites().characters[id] = { right, left }` (idle 2·walk 4·step 1·fall 2·land 1, 16×24), `render`는 `frame.charId`.
- [ ] 테스트 `characters: four friends with full frame sets` → FAIL → 구현 → PASS → 기록

### Task 3: 증명서 글자 (certificate.js)
**Produces:** `SF.certificateLines({ name, grade, classNo, date, climbTime, score, correct, total, test }) -> string[]`(제목·이름·학년반·기록·날짜·문장, 테스트면 "테스트" 줄), `SF.drawCertificate(data, sprites) -> HTMLCanvasElement`(600×840).
- [ ] 테스트 `certificate: lines` (이름·'3학년 2반'·'2026년 10월 16일'·'9:12'·'16,100'), `certificate: test runs say so`, `certificate: draws a canvas` → FAIL → 구현 → PASS → 기록

### Task 4: 화면 틀 (index.html·아티팩트·css)
처음 화면(#home: 제목, 이름, 반 select, 캐릭터 4 버튼, 시작, 오류 줄, 선생님 버튼), HUD ⏸·🏠·테스트 표시, 일시정지(#pause), 확인(#confirm), 선생님 비밀번호(#teacher-login), 선생님(#teacher), 증명서(#cert: img + 저장·닫기), 결과 상자 버튼 [증명서 보기][다시 하기][처음 화면]. 준비 화면의 구간 연습은 테스트 모드에서만.
- [ ] 마크업·스타일 → 브라우저에서 깨짐 없는지 확인 → 기록

### Task 5: 게임 흐름 (game.js + ui.js)
**Produces:** `game.state` ∈ `home|ready|playing|quiz|paused|finished|timeup`, `game.begin(student, charId)`, `game.pause()`, `game.unpause()`, `game.quitToHome()`, `game.testMode`, `game.lastRecord`, `game.student`, `game.charId`.
- [ ] 구현 (처음 화면에서 입력 무시, 일시정지 중 등반 시간 정지, 홈 확인, 판 끝 기록, 테스트 모드 기능)
- [ ] 브라우저 확인(위 Review Focus 포함) → 기록

### Task 6: 증명서 연결 + 저장
- [ ] 완주 → [증명서 보기] → 캔버스 → `<img>`와 [사진으로 저장](a[download] → 안 되면 안내) → 브라우저 확인 → 기록

### Task 7: 전체 확인·게시
- [ ] tests.html 전부 PASS, 폰 크기 화면 확인, 아티팩트 재게시(새 js 4개), README·spec 상태·메모리
