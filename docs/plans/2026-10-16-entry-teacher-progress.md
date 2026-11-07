# SDD ledger — plan: docs/plans/2026-10-16-entry-teacher-plan.md

Spec: docs/specs/2026-10-16-entry-teacher-design.md. Executor: inline. No git → this file is the record.
Ruling: spec/plan approved via in-chat summary + one-click ("좋아요, 만들어 주세요"), per user feedback (no doc reviews) — cost if wrong: user never read the written plan.
Pre-flight: Task 5 consumes Task 1 (makeRecord, validateStudent), Task 2 (characters), Task 3 (drawCertificate) — names as in plan Produces.

Task 1: Ruling: teacher password compare trims spaces; empty input never matches — cost if wrong: none.
Task 1: Ruling: name length counted in characters (Array.from) so emoji/한글 count as one letter; max 10 — cost if wrong: none.
Task 1: complete (student.js, config school/teacher + checkConfig; tests: tests.html → PASS 134/134)
Task 2: Ruling: after a visual check the shared stick legs looked too long for Chiikawa-style characters → characters.js has its own round belly + short chubby legs (`legs`, `crouch` per definition; sprites.js falls back to the old legs for 새싹이) — cost if wrong: none.
Task 2: Ruling: 새싹이 stays as `S.player`, the fallback when a character id is unknown — cost if wrong: none.
Task 2: complete (characters.js 치이카와·하치와레·우사기·랏코, sprites.js charFrames(def), render uses frame.charId; tests: tests.html → PASS 135/135)
Task 3: Ruling: certificate data carries `floors` (from cfg.totalFloors) instead of hard-coding 600 — cost if wrong: none.
Task 3: complete (certificate.js certificateLines + drawCertificate 600×840 with character ×8, seal, test watermark; visual check OK; tests: tests.html → PASS 138/138)
Task 4: Ruling: the phone page (artifact) is now generated from index.html by scratchpad/build_artifact.py (needs the \\?\ long-path prefix) so the two pages can't drift — cost if wrong: none.
Task 4: Ruling: HUD buttons stack vertically on the left (소리·⏸·🏠) because three in a row don't fit next to "600층" on 360-px phones; debug ⚙ moved to the bottom-left, debug panel lower — cost if wrong: none.
Task 4: markup + CSS written (home, ready, pause, confirm, result buttons, cert, teacher-login, teacher, test badge); visual check happens with Task 5.
Task 5: Ruling: UI overlays (home, pause, confirm, teacher, cert) live in new js/ui.js; game.js keeps ready/quiz/finish and exposes begin/toHome/inRun/quitToHome/pause/unpause/setTestMode — cost if wrong: none.
Task 5: Ruling: the character picked on the home screen is previewed by the character standing in the background — cost if wrong: none.
Task 5: Ruling: pop-up panels over other panels are opaque with a darker backdrop (the teacher panel showed the home panel through it) — cost if wrong: none.
Task 5: Ruling: Esc toggles pause on PC — cost if wrong: none.
Task 5: Browser checks (index.html, scripted + 375x812 screenshots): arrows ignored on the home screen; empty name/class errors; start → ready with "우사기와 함께 홍길동 · 3학년 2반", remembered next time; pause freezes climb time, world and player; home → confirm "최고 6층은 기록돼요" → 계속하기 resumes, 그만하기 → home with record {id 3-2-홍길동, best 6, quit, not test}; teacher wrong/right password, summary, test mode badge + 8 practice buttons + test tools; bot finish in test mode → "테스트 완주! (기록 안 남음)", record test=true, certificate image + download name; leaving teacher mode turns test mode off. No console errors.
Task 5: complete (tests: tests.html → PASS 138/138)
Task 6: Ruling: claude.ai pages can't use a[download]; the cert save button uses claude.use("downloads").save() when available (artifact declares downloads) and falls back to the plain link elsewhere; long-press on the <img> works everywhere — not verified inside claude.ai (browser pane not signed in) — cost if wrong: button does nothing in the test link, long-press still works.
Task 6: complete (certificate overlay + save; local fallback verified)
Task 7: complete (artifact version 10 with student/characters/certificate/ui.js + downloads capability; phone page generated from index.html)
Final review: self-review (no subagents unless the user asks).
Final: minor (deferred): choosing "처음 화면으로" in the pause menu and then "계속하기" in the confirm resumes play instead of returning to the pause menu.
Final: minor (deferred): game.lastRecord is only kept in memory until 3단계 sends it to the sheet.
After: user feedback — spike-ball hits pushed the character forward (the rail sits behind the stair, so the ball usually comes from behind). SF.knockDir: spike ball → opposite of p.facing; banana/acorn unchanged. Used by game.js and the fairness sim; knockSafe already checks both directions so placement/map unchanged. 'knock: a spike ball throws you back the way you came' RED→GREEN, suite 139/139; live check 4/4 hits opposite to facing. Artifact version 11.
