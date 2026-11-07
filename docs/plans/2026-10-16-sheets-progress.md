# SDD ledger — plan: docs/plans/2026-10-16-sheets-plan.md

Spec: docs/specs/2026-10-16-sheets-design.md. Executor: inline. No git → this file is the record.
Ruling: approved via in-chat summary + one-click (user prefers no doc reviews) — cost if wrong: user never read the plan.
Ruling: user did not tick "연결 확인" in the teacher-feature question, but phase 2 already approved a "구글 시트 연결 확인" spot in the teacher panel → keep a one-line connection status there (no extra screen) — cost if wrong: one line the user didn't ask for.
Ruling: real Apps Script can't run here (needs the teacher's Google account) → server logic is tested against a fake SpreadsheetApp in tests.html; the real deployment is verified with the user after the install guide — cost if wrong: an Apps Script API difference only shows up on first real run.
Pre-flight: Task 4 consumes Task 1–3 (SFS handlers via HTTP, SF.createSheetClient, makeRecord maxCombo/runId).

Task 1: Ruling: seed questions in Code.js were generated from SF.QUESTIONS in the browser and a test pins them equal — cost if wrong: none.
Task 1: Ruling: record check also requires correct+wrong ≤ quizzes reachable by the best floor and maxCombo ≤ 600; finishing needs ≥ 60 s climb (fastest bot 72.8 s) — cost if wrong: an extraordinary real student under 60 s would be refused.
Task 1: Ruling: bad-word check strips spaces/punctuation before matching (catches "바 보", "바.보"); default list editable in 설정 tab — cost if wrong: some innocent phrases containing a listed word get refused.
Task 1: complete (apps-script/Code.js SFS pure functions + seeds; tests: tests.html → PASS 148/148)
Task 2: Ruling: one one-liner per student (writing again replaces it; a teacher-hidden one can't be replaced) — prevents spam — cost if wrong: students can't keep several messages.
Task 2: Ruling: ranking keeps the first 완주일시 even when a later run improves the score (finisher list = who finished first, when) — cost if wrong: none.
Task 2: Ruling: added a password-protected `messages` action (all one-liners incl. hidden) so the teacher's hide screen can list them — cost if wrong: none.
Task 2: complete (setup/doGet/doPost/handle_ in Code.js; tests: tests.html → PASS 157/157 with a fake SpreadsheetApp/LockService/CacheService/ContentService)
Task 3: Ruling: a server refusal (bad record) is final — not queued; only network failures/timeouts are queued (max 30, one per runId) — cost if wrong: a record refused by a server bug is lost (the score still shows on screen).
Task 3: Ruling: talk lines are snapshotted when a run starts (createTalk), so sheet lines arriving mid-run take effect next run — cost if wrong: none.
Task 3: complete (js/sheet.js createSheetClient, talk.js TALK_DEFAULTS/applyTalkLines, makeRecord maxCombo/runId; tests: tests.html → PASS 166/166)
Task 4: Ruling: sheet screens live in a new js/sheet-ui.js (ui.js only calls SF.sheetUi hooks) — keeps ui.js phase-2 only — cost if wrong: none.
Task 4: Ruling: bootstrap is not capped at 5 s (spec) — it never blocks play (the first run may use built-in questions, the next uses the sheet's), so one 10 s client timeout covers everything — cost if wrong: none.
Task 4: Ruling: a bad sheet.url is reported in the teacher panel, not via checkConfig (checkConfig messages switch off the fast map path) — cost if wrong: none.
Task 4: Ruling: [랭킹·한마디]/[랭킹 보기] are always shown; without a sheet the board says it isn't connected — cost if wrong: one extra button on the claude.ai test link.
Task 4: Ruling: dev/fake-sheet.js (not loaded by the game) runs Code.js on a fake sheet inside the game page for browser checks — cost if wrong: none.
Task 4: complete (game.bank/runId/onRecord + talk finish/timeup in game.js; sheet-ui.js; board/save-status/one-liner/teacher markup + CSS; tests: tests.html → PASS 170/170; browser with fake sheet at 375×812: finish → "기록 저장! 전교 3등 · 우리 반 2등" + one-liner (31자 거절, "바 보" 금지어 거절, 정상 저장); board class/school/한마디 tabs with my row highlighted; teacher: status "연결됨 — 시트 문제 40개", 완주자 9명 by class, hide → gone from board, wrong sheet password → hint; offline time-up → "기기에 보관" then sent on next boot (기록 15줄, no duplicates); test-mode run sends nothing; empty url / failed connection → silent, game playable, no console errors)
Task 5: Ruling: install guide recommends a personal Gmail account (school Workspace domains often block "모든 사용자" web-app access) — cost if wrong: none, school account still works if allowed.
Task 5: complete (설치안내.md, README, spec status; artifact v12 published with sheet.js + sheet-ui.js, sheet.url empty → board says "not connected", game unchanged)
Open: real Apps Script deploy not yet run (needs the teacher's Google account) → verify together after the guide (bootstrap URL check, one real record, board, teacher list).
