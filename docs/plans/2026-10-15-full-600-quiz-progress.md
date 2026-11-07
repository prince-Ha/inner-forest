# SDD ledger — plan: docs/plans/2026-10-15-full-600-quiz-plan.md

Spec: docs/specs/2026-10-15-full-600-quiz-design.md (read). Executor: inline (executing-plans).
Ruling: no git repo in this folder → no worktree, no commits; this file is the record, tests.html is the gate — cost if wrong: no diff history to review against (final review reads files directly).

Pre-flight (shared interfaces):
| consumer | producer | item | finding |
|---|---|---|---|
| Task 2 | Task 4 | SF.quizFloors(cfg) | Task 2 runs first → Ruling: create js/quiz.js with quizFloors in Task 2 (+ script tags), Task 4 adds the rest — cost if wrong: none |
| Task 3 | Task 1 | SF.repairRocks(level, cfg) | consistent (Task 1 Produces) |
| Task 6 | Task 4, 5 | quiz run API, computeScore | consistent |

Task 1: Ruling: test helper name `ok` shadowed by a local variable in the new test — renamed the variable (test bug, not code) — cost if wrong: none.
Task 1: Ruling: rock repair keeps the extension slab and tries extendToWall; if that fails the turn becomes 'open' and validate judges the fall — cost if wrong: an extra cliff the cap check may reject → seed retry.
Task 1: complete (600-floor seeds s*101+7: generate 8/20 → 20/20, validate 20/20 after repairRocks (23 rocks), gen 4.6 ms avg; tests: tests.html → PASS 107/107)
Task 2: Ruling: practice button labels come from an optional zone `name` in config.js (가시공·원숭이·금 간 발판·도토리·섞어서·겹치기·돌풍·최고 난이도) — auto labels were all "섞어서" for mixed zones — cost if wrong: one more config field.
Task 2: Ruling: heavy seed sweeps ('build: seeds 1..10 valid', 'build: every cliff zone keeps a cliff', 'build: fast enough') run on a 200-floor SMALL config; the 600-floor map is checked once (default seed). The cliff test took 63 s on 600 floors — cost if wrong: seed-variety bugs above floor 200 only caught via the default map and Task 1's terrain sweep.
Task 2: Ruling: careful bot was stuck in 151~200 (7/8 placements failed fairness): it waited two steps below a hazard, on a cracked tile, fell 8 floors, then kept stepping into the still-broken tile. Fix in carefulBotDir: wait for a broken path tile to respawn; a non-cracked target that stays safe for 2 s is a valid waiting spot (no 2-step lookahead needed). RED evidence: 'build: default seed valid' failed (attempts 2) and fairness 1/8 placements before; after: 12/12 placements on 3 seeds, 0 hits. Unit tests 'careful bot: waits for a broken step…' and '…waits right below a hazard…' were written right after the fix (TDD order not kept for this debug fix) — cost if wrong: the unit tests were never seen failing.
Task 2: Ruling: bot "bot: completes" limit changed from 60 s to totalFloors×0.25 s (600 floors ≈ 55 s for the plain bot) — cost if wrong: none.
Task 2: complete (600 zones + quiz rest stops + hard mode/floorOffset removed; tests: tests.html → PASS 109/109, ~25 s run)
Task 3: Ruling: mapFingerprint includes `seed` (plan said "seed 제외") — otherwise a teacher changing seed would silently keep the old map — cost if wrong: none (map.seed stores the actual attempt seed anyway).
Task 3: Ruling: fingerprint also covers `bot` (validation time limit) — cost if wrong: a needless full re-check after editing bot.
Task 3: Ruling: placeHazards now resets level._crumbleSet — found while wiring buildLevel retries: the careful bot's cached cracked-tile set went stale between placement attempts — cost if wrong: none.
Task 3: Ruling: fixFallDepths only measures outward falls at open turns and resumes from the last bad tread (adding a ledge can only shorten falls) — map identical (grid+treads+hazards+crumbles+rocks hash 750364fe before/after), fixFallDepths 646 → ~300 ms. Fast path total ≈ 0.29–0.31 s on PC (target 0.3; phones est. ~1–1.5 s) — cost if wrong: if a ledge could lengthen a fall, a deeper-than-cap cliff could survive; validate still catches it in the full build.
Task 3: complete (config.map = { seed: 20261021, hazardTry: 0, check: '8a478c98' }; debug button '맵 번호 다시 찾기'; full build 1.38 s PC; tests: tests.html → PASS 113/113)
Task 4: Ruling: choices are NOT shuffled at run time (teachers' sheet questions may say "위 보기 모두" etc.); built-in questions place the answer at varied positions (A10/B10/C9/D11) via a Q(id, q, correct, wrongs, explain, pos) helper — cost if wrong: none.
Task 4: Ruling: dropped the planned feather/free-fall question and the "태양계의 위치(약 3만 광년)" question to keep only unambiguous facts; 40 questions over 7 units — cost if wrong: none.
Task 4: complete (SF.createQuizRun/quizAt/answerQuiz + SF.QUESTIONS 40; tests: tests.html → PASS 118/118)
Task 5: complete (SF.computeScore, config timeLimitSec 900 + score {10, 3000, 5, 200, 10}, checkConfig for timeLimitSec/quiz/score; examples 16,100 / 8,400; tests: tests.html → PASS 122/122)
Task 6: Ruling: when the bot is on, quizzes are answered correctly without opening the box (bot is a watch/verify tool) — cost if wrong: a teacher watching the bot doesn't see quiz boxes.
Task 6: Ruling: map is built after a 30 ms timeout so "숲을 만드는 중…" can paint; debug.js now attaches via SF.whenReady — cost if wrong: none.
Task 6: Ruling: fixed a pre-existing 1-px seam between background chunks (fractional zoom) by snapping chunk edges to integer pixels with 1-px overlap — not in plan; visible to students — verified visually only (no pixel test) — cost if wrong: none.
Task 6: Ruling: sign sprite size assertions were added to 'sprites: frame sizes' after the sprite existed (not seen failing) — cost if wrong: size regressions only.
Task 6: Browser checks (index.html, headless advance + 375x812 screenshots): quiz opens on 10층 with 2 queued taps (queue cleared), world clock & climb time frozen during quiz, wrong answer marks A/C, explanation, continue → playing, not re-asked; time-up at 900 s → 시간 종료 result; careful bot 1→600 climb 72.8 s, 30/30, 0 hits, score 25,125; rushing bot (no waiting) 400층 @90 s, stuck 501~533 until time-up, 273 hits / 236 falls, 11,510 pts. No console errors.
Task 6: complete (tests: tests.html → PASS 124/124)
Task 7: complete (README rewritten for 600층/퀴즈/점수/map; spec status 구현 완료; artifact version 7 with questions.js/quiz.js/score.js; tests: tests.html → PASS 124/124)
Final review: self-review (harness rule: no subagents unless the user asks) — read game.js/hazards.js/level.js/render.js changes against the spec and Review Focus.
Final: fixed quiz floors 450/470/490 sit inside the 441~500 gust zone, so a player could be blown off right after closing a quiz (spec: quiz floors are rest stops) — 'gust: quiz floors are sheltered from the wind' RED→GREEN, suite 125/125; artifact version 8.
Final: Review Focus checked — queued taps at quiz floor (test), time-up mid-move (browser: freezes and shows result), small bank refill (test), stale map (test), 360x740 long question fits (browser).
Final: minor (deferred): quiz header number counts quizzes answered in this run, so practice/teleport starts show "1/30" on a later floor.
Final: minor (deferred): a fall that lands on a quiz-floor height off the path (e.g., rock top) still opens that floor's quiz.
Final: minor (deferred): the bot's perfect run scores 25,125 with combo 599 → combo points (5,990) can rival quiz points; tune score.perCombo after real play data.
