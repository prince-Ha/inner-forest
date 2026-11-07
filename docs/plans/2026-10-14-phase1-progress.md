# SDD ledger — plan: docs/plans/2026-10-14-phase1-movement-plan.md

Spec: docs/specs/2026-10-14-phase1-movement-design.md (read)
Executor: executing-plans (inline), chosen by user 2026-10-14

Setup: Ruling: no git and no bash on this PC → no worktree, no commits, helper scripts (task-start/task-done/review-package) cannot run; ledger kept by hand, checkpoint = tests.html all PASS — cost if wrong: no rollback history (mitigated by small steps).

## Pre-flight (shared interfaces)
- T2→T3: World.findStep/isFree/solidHit/landingTop/ceilingBottom/hasSupport — signatures match T3 algorithm. OK.
- T1/T2→T4: makeRng, createGrid, CELL, STYLE — OK.
- T3/T4→T5: createPlayer/stepPlayer, Level.treads/rocks/spawn, treadIndexMap — OK. Ruling: rock.row = lower cell row; rock top surface y = 16*(rock.row+1) (plan said "row = 아래 칸" without the top formula) — cost if wrong: rock-top validation checks wrong height.
- T1/T6: smoothDamp used by camera — OK.
- T5/T6→T7: buildLevel, botDir, treadIndexMap, createDirTracker/bindInput, advanceClock, computeViewport, createCamera — OK.
- T7→T8/T9: renderer + SF.game API — OK.
- Ruling: tests.html gets <script> tags added task by task (plan Step 1.2 listed all upfront) — avoids 404 noise — cost if wrong: none.

## Tasks
Task 1: complete (no commits — no git; tests: tests.html → 4/4 pass; RED seen: "SF is not defined")
Task 2: complete (tests: tests.html → 11/11 pass; RED seen: gridFromAscii missing; bug fixed: rectsIn skipped left column when x0 on a cell boundary → Math.ceil(x0/cs)-1). Note: Grid also has getStyle(c,r) (renderer needs it).
Task 3: Ruling: step-up also requires world.hasSupport(nx, w, top) — plan's rule let findStep's ±1px window step up 1px before touching walls/2-high rocks, causing hop-jitter (verified: removing it fails 2 tests via wall jitter) — cost if wrong: a step triggers ≤1 physics step later.
Task 3: Ruling: 'zigzag turn' test steps dir −1 until a stepUp (≤60) instead of a fixed 60 steps — the 1-wide next tread makes 60 steps walk off its far end (test defect, code correct per trace) — cost if wrong: none.
Task 3: Added assertion to '2-high rock blocks': no stepUp events (catches hop-jitter directly).
Task 3: complete (tests: tests.html → 25/25 pass; RED seen: createPlayer missing)
Task 4: Ruling: open/safe is decided at flight start (wantOpen) and open flights stop one column short of the wall — plan's "decide at landing if outer≥1" under-produced open turns (zone 2: 0.30 vs 0.5) because flights usually reach the wall; added test 'level: open turn ratio follows zones' RED→GREEN — cost if wrong: flights crossing a zone boundary use the start zone's chance.
Task 4: Ruling: final (goal) flight may have 1 tread; generator only enforces ≥2 for non-final flights — cost if wrong: none (goal is a wide platform).
Task 4: complete (tests: tests.html → 34/34 pass; RED seen: generateLevel missing; 4/200 seeds return null → buildLevel retries)
Task 5: Ruling: runBot({startTread}) starts at the tread's entry column (c0 if dirIn>0 else c1), not its center — center of a rock-bumper landing is inside the rock, making validation fail falsely (default seed needed 2 attempts) — 'build: default seed valid' RED→GREEN — cost if wrong: none found.
Task 5: Ruling: fixFallDepths never picks a landing that carries a rock bumper — extending past the rock would trap a faller between rock and wall — cost if wrong: fewer catch candidates, more open turns become safe.
Task 5: Refactor: canPlace/fill/extendToWall moved to module scope in level.js (shared by generateLevel and fixFallDepths); Task 4 tests stayed green.
Task 6: Ruling: bindInput's callback is onPress(dir), fired on every new press (plan named it onFirstInput) — the game needs a start signal after every reset — cost if wrong: none. Tracker also exposes activeDirs() for button highlighting.
Task 6: complete (tests: tests.html → 53/53 pass; RED seen: createDirTracker/advanceClock/computeViewport/createCamera missing)
Task 7: Note: browser pane hidden → rAF throttled to ~1fps; dt clamp makes sim run at ~0.25x real time (expected pause behaviour). Screenshot tool sometimes returns a 2x-cropped capture while hidden; JS layout checks confirmed 390x844@2 correct, reload fixes capture.
Task 7: Added game.resume() so debug teleport/bot work from the finished screen (plan only said start()).
Task 7: complete (tests: tests.html → 53/53 pass; browser 390x844: HUD/overlay/buttons render, ArrowRight → playing+2층+timer, teleport(45)+bot → 완주 overlay "기록 00:07.80 / 추락 0회", 다시 하기 → 1층/00:00.00/최고 1층/ready, pointer click on ▶ starts game and releases; no console errors from index.html)
Task 8: Added tests 'sprites: frame sizes' and 'sprites: bgPalette keyframes' (RED: buildSprites missing → GREEN). Visual fixes after screenshots: flag emblem "+" (looked like first-aid) → leaf; background glow-mushrooms looked like monster eyes → taller mushroom cluster at hollow bottom; overlay text broke mid-word → .panel word-break: keep-all. stepUp shifts game.prev.y by dy so interpolation and hop easing don't double-count.
Task 8: complete (tests: tests.html → 55/55 pass; screenshots 390x844 floors 1/30/54, 360x740, 412x915; open-turn fall from 55 → landed 38, falls=1, popup "−17층!", shake; no console errors)
Task 9: Added to input.js: arrow/A/D keys are ignored while typing in INPUT/TEXTAREA/SELECT (debug number fields) — cost if wrong: none.
Task 9: Note: pane fully hidden (document.hidden=true, 0 rAF frames) so live-loop checks used direct physics with the same cfg object; slider→cfg mutation verified (walkSpeed 100 → simulated max vx 100).
Task 9: complete (tests: tests.html → 55/55 pass; ?debug: toggle opens panel (7 sliders, 5 buttons), teleport 45 → floor 45, bot on/off label, hitbox flag, seed 5 regen → bot 11.9s & falls listed, copy → clipboard denied in automation → fallback textarea with "  physics: {\n    walkSpeed: 100, …" format)
Task 10: Ruling: publish the artifact (Step 5) and update spec/memory (Step 6) AFTER the final whole-branch review and its fix pass — so the phone-test link carries the reviewed code — cost if wrong: none.
Task 10: Steps 1-4 done: tests 55/55; screenshots 360x740/390x844/412x915/1280x800 (desktop shows centered 9:16 column); README.md written. Live full bot run from spawn not repeated (pane hidden → 0 rAF); covered by headless 'bot: completes' + Task 7 live teleport(45)+bot finish. Steps 5-6 deferred until after final review (see ruling).
Final review: dispatched to fresh reviewer (opus), no git → file list instead of diff. Verdict: With fixes. 0 Critical, 2 Important, 10 Minor.
Final: fixed I1 (zone 21~40 lost all cliffs to fall-depth fixes; ratio test checked pre-fix map) — test 'build: every cliff zone keeps a cliff' RED→GREEN; validateLevel now errors when a zone with openTurnChance>0 has no open turn (buildLevel retries); default seed 20261014→20261021 (first attempt valid; cliffs 34:6 38:7 41:13 46:15 52:24 58:27); config.js comment notes the cap lowers the effective cliff count. Suite 63/63.
Final: fixed I2 (bad config → black screen / unwinnable map / 4s block, only console.warn) — tests 'config: *' (4) and 'prepareLevel: *' (3) RED→GREEN; SF.checkConfig (Korean messages), SF.prepareLevel (fatal flag, 1 attempt when config has problems), validateLevel stops after the spawn bot fails, Korean validation messages, game.js shows #notice overlay and stops when fatal, early window 'error' handler in index.html shows script/config.js syntax errors. Verified in browser: ErrorEvent → notice; temp page with treadWidth [4,5] → "게임을 시작할 수 없어요" with the field to fix. Suite 63/63.
Final: Ruling: kept 'level: open turn ratio follows zones' as a generator test and added the build-level cliff test instead of asserting the configured ratio on built maps — fall caps legitimately remove cliffs; the user-visible guarantee is "every cliff zone keeps ≥1 cliff" — cost if wrong: built maps may have fewer cliffs than openTurnChance suggests (documented in config.js).
Final: Ruling (declined-to-judge lines): validation cost at 600 floors → phase 4 (sample treads); timer anti-cheat → phase 5 server checks; artifact iframe behaviour → handled at publish (#debug, clipboard fallback); accessibility → phase 6; iOS rotation timing → check on real phone; finger sliding off panel keeps steering (pointer capture) → intended; sound/haptics → excluded by spec; fun → user's phone test.
Final: minor (deferred): M1 rock walk-off not held to zone fall cap (seed 25 example; default seed unaffected)
Final: minor (deferred): M2 bot dithers on rock tops whose edge is at x=96 (debug bot only)
Final: minor (deferred): M3 ◀/▶ highlight can stay after finish/restart until next input
Final: minor (deferred): M4 reset() doesn't clear game.bot (debug regenerate with bot on)
Final: minor (deferred): M5 an exception inside frame() stops the loop (rAF scheduled last)
Final: minor (deferred): M6 quoted seed concatenates (now reported on screen by checkConfig, not coerced)
Final: minor (deferred): M7 visual timings differ slightly from plan (hop 0.08s, land 0.1s, walk 5px, fall airT>0.1) and no leaf particles
Final: minor (deferred): M8 desktop window under ~341px tall crops world sides at zoom 1
Final: minor (deferred): M9 100dvh / inset need older-browser fallbacks
Final: minor (deferred): M10 no automated tests for DOM input wiring and restart flow
Also: artifact-contract prep: #debug hash support, :root color-scheme dark, 16px side gutters for HUD/controls.
Task 5: complete (tests: tests.html → 41/41 pass; default seed: attempts 1, bot 14.8s, open-turn falls 47:9 55:17 59:6; seeds 1..10 build in 234ms total)

## 1차-B 개편 (2026-10-15) — 탭 한 번 = 한 칸 (spec §12)
Trigger: user phone test + reference video (무한의 계단-style) → "너무 쉬워, 게임 느낌". User chose: ◀▶ one tap one cell, combo + big floor, sound, speech bubbles (no time gauge). Design approved in chat.
- New modules: js/stepper.js (tap movement: climb > side > bump > miss→physics fall→snap), js/combo.js, js/sound.js (WebAudio synth, mute persisted with try/catch), js/talk.js (lines + 18 science facts). Tests first: 14 new tests RED→GREEN; suite 77/77.
- Ruling: stepper completion event renamed 'climb' (physics engine's 'stepUp' only comes from air corner-snaps during falls) — avoids combo counting while falling — cost if wrong: none.
- Ruling: open turn only if the outward tap is really a miss (stepOutcome) — a lower turn's rock beside the landing made a fake cliff (test 'level: open turn has a drop' caught it) — cost if wrong: fewer cliffs.
- Ruling: makeSafe returns true when the outward tap is already blocked (bump/side) — tight zigzags made rock placement fail (72/100 seeds null → 9/100) — cost if wrong: none.
- Ruling: open-turn ratio test tolerance now [chance−0.2, chance+0.15]; blocked turns legitimately reduce cliffs (zone 3 ≈0.60 vs 0.75) — cost if wrong: fewer cliffs than configured (documented in config.js).
- Ruling: flights of 1 tread allowed (zigzag); checkConfig flightTreads min ≥1; stepHeight check replaced by step.hopTime/queueMax/miss*/combo checks; config tests updated accordingly.
- Ruling: validation measures every wrong tap (measureMissFalls) against zone caps; fixFallDepths only fixes outward misses at open landings; backward-miss overruns → seed retry.
- Walking-mode physics params kept in config (engine + physics tests) but marked unused in play.
- Also fixed deferred M5 (frame() schedules rAF first).
- Default seed 20261021 still valid on attempt 1: bot 5.5s, wrong-tap max fall 1/6/22 floors (zones 1/2/3), cliffs 0/2/7.
- Verified live (pane visible): 12 correct taps → floor 12, combo 11; wrong tap → floor 11, combo 0, centred; bubble shows science fact at floor 50; bot finish overlay "최고 콤보 59"; restart resets. Artifact republished (version 2).

## 2차 장애물 시험 구간 61~120층 (2026-10-15) — spec §13
Trigger: user "60층까지 딱 적당" + wants timing obstacles (원숭이 바나나, 가시공) and a brutal 500~600 (deferred to phase 4). User chose: obstacles first as a short test band, all four kinds, knocked off + fall, combo timeout stays 1.5s. Design approved in chat.
- New module js/hazards.js: stateless time→position shapes (spikeBall, banana, acorn), monkeyPose, hazardHit, placeHazards, crumble state (updateCrumbles/restoreCrumbles), stepperKnock, carefulBotDir, checkHazardFairness. Tests first; suite 89/89.
- Ruling: only zones from floor 20 up must keep their open-turn cliffs (validate rule); 15-floor test zones failed it otherwise.
- Ruling: knock and crumble falls are capped by the zone's maxFallFloors at placement time (knockSafe/crumbleSafe filters), not after.
- Ruling: spike-ball rail sits with the stair at one end and extends away from the next stair → one pass per cycle and the exit side is ball-free (bot needed 157s to find gaps before).
- Ruling: careful bot predicts 2 cells ahead with a 2px margin and escapes if its standing tile turns unsafe; fairness check gives up after 15s with no progress.
- Ruling: monkey sits on the far wall; skipped if the wall-side cell at row+1 is not empty (sprite would overlap a slab).
- game.js: clock, crumbles, hit → knock/comboBreak/'hit' sound/bubble, grace blink after landing, throw sound for monkeys within 8 rows, careful bot when bot is on; game.advance(seconds) for headless checks.
- render.js: rail, monkey on branch stub, acorn branch + growing shadow, crack overlay + shaking + ghost before respawn, hazard hitboxes in debug view.
- debug.js: 7 obstacle sliders (path-based), jumps to 61/76/91/106, hazard floors in the info box.
- Verified (game page, headless advance): careful bot 61→120 in 7.3s, 0 hits; reckless bot 9.5s, 4 hits, recovered every time, no errors. Visual check at 375x812. Artifact republished (version 3, hazards.js added to files).

## 최고 난이도 시험 501~600층 (2026-10-15) — spec §14
Trigger: user found 61~120 "무난", wants to feel the hardest band first; completion certificate + sheet mark planned for phase 5. User chose: separate test via a start-screen button (not a URL), all four hardness levers, no fall cap.
- Tests first (7 new): speed scales the pattern (shape(t, s) == shape(t·s, 1)), faster crumble, hardConfig, hard build (≥25 hazard floors, doubles of different kinds, speed tagged, ≥15 crumbles), deep falls (≥50), careful bot 0 hits, config checks for double/speed/floorOffset. Suite 96/96.
- Ruling: speed is implemented as per-hazard local time u = t·speed (h.speed), so phases/periods stay in base units; banana warning stays 0.3 real seconds (warn·speed in u). SF.hazardTiming / SF.throwCount / SF.crumbleDelay expose real-time values for render/sound.
- Ruling: "dense" capped at every other floor — the 2-row spacing and empty waiting floor are kept so the band stays fair (user was told in the design).
- Ruling: double hazards don't consume rng unless the zone sets `double` → default 1~120 placement unchanged.
- Ruling: loadLevel no longer shows notices; callers do. regenerate with a bad seed now shows a closable notice and keeps the old map (previously a fatal notice with no close button).
- Mode switch swaps seed/totalFloors/floorOffset/zones in the shared cfg object, persists 'sf-mode' in localStorage (try/catch), falls back to normal with a notice if the hard map can't be built.
- Verified: button toggles both ways, HUD 501/최고 501층, ready text, persistence across reload; careful bot 18.1s 0 hits; rushing bot 300s 102 hits 78 falls best 582. Visual check at 375x812. Artifact republished (version 4).
- 2026-10-15 user feedback on the hard band: cracked tiles broke too fast to change direction (0.23s = 0.35/1.5). New zone option `hazards.crumbleDelay` (seconds, overrides delay÷speed); hardTest uses 0.47 (user asked ~2x). Base 1~120 stays 0.35. Test-first (crumble: a zone can set its own break time + config check); suite 97/97. Careful bot on the hard map 18.1s → 11.4s (it had been falling through tiles while waiting). Artifact version 5.

## 돌풍 121~140층 + 구간 연습 (2026-10-15) — spec §15
Trigger: user picked 돌풍 from 4 recommendations; rules "멈추면 밀림", alternate direction, test on base 121~140 with practice buttons; "wind only in hard zones" for the 600-floor game.
- Tests first (7 new + fairness now asserts pushes 0): gust phases/alternation, stand-still push off a step, no push before hold + tap resets hold, wall holds, only in gust zones, practiceStarts, config checks. Suite 104/104.
- SF.gustAt / inGustZone / createGustState / updateGust in hazards.js, shared by game.js and checkHazardFairness (pushes counted; build requires 0).
- Ruling: a push off an open edge reuses miss physics (missSpeed/missPopVy), so measured miss-fall caps already bound it; 'climb' outcome downwind counts as blocked (wind doesn't lift you).
- Ruling: hold timer counts only while blowing, grounded and idle with an empty queue; resets on any hop.
- Bug found by 'level: start and goal' after totalFloors 140: a 2-high rock right under the goal row blocked extending the goal to the wall → placeRock refuses rows with r + 3 >= goalRow.
- Practice: SF.practiceStarts(cfg) builds the buttons from hazard zones; game.startPractice(floor) = reset + teleport; HUD "연습 · 최고 N층", finish title "연습 완주! (기록 안 남음)". Debug jumps reuse practiceStarts.
- Verified: practice 121 stand still 8s → pushed, fell 121→114; careful bot 121→140 no push; visuals (banner, streaks, intro bubble) at 375x812. Artifact version 6.
