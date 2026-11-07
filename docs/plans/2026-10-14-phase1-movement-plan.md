# 과학 인내의 숲 1차(이동 프로토타입) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 좌우 버튼만으로 60층 나무를 오르고, 실수하면 실제 물리로 떨어지는 모바일 세로형 웹게임 프로토타입을 만든다.

**Architecture:** 일반 `<script>`로 순서대로 로드하는 순수 JS. 화면과 무관한 로직(world·physics·level·bot)과 화면 코드(input·camera·render·game·debug)를 나누고, 로직은 `tests.html`에서 브라우저로 자동 테스트한다. 모든 수치는 `config.js`.

**Tech Stack:** HTML5 Canvas 2D, ES2017 JS(빌드 없음), Pointer Events. 로컬 서버는 Anaconda Python(`serve.py`, 스크래치패드).

**Spec:** `docs/specs/2026-10-14-phase1-movement-design.md`

## Global Constraints

- 외부 라이브러리·이미지·웹폰트 없음. `type="module"` 금지 → `index.html` 더블클릭(file://)으로도 실행.
- 전역은 `window.SF`(코드), `window.GAME_CONFIG`(설정) 두 개만. 각 파일은 `window.SF = window.SF || {};`로 시작.
- 좌표: 논리 px, y 위쪽 +, 셀 16, 바닥 윗면 y=0. 층 = `Math.floor(y / 16 + 1e-6) + 1`.
- 월드 12열(0·11 벽, 1~10 안쪽), 발판 두께 6, 캐릭터 충돌 상자 8×22(x=몸 왼쪽, y=발), 고정 스텝 1/120초.
- 물리 기본값: walkSpeed 72, groundAccel 900, groundDecel 1200, turnAccel 1800, airAccel 270, airDrag 0, gravity 1100, maxFallSpeed 420, stepHeight 17, airStepTolerance 3. 추락 판정 3층, 화면 흔들림 10층.
- 카메라: climbAnchor 0.62, fallAnchor 0.35, smoothTime 0.15, edgeMargin 0.12.
- 구간: `{untilFloor:20, treadWidth:[2,3], flightTreads:[3,4], openTurnChance:0, maxFallFloors:0, style:'plank'}`, `{40, [1,2], [3,5], 0.5, 8, 'brick'}`, `{60, [1,1], [4,7], 0.75, 30, 'branch'}`. rockBumperChance 0.35. 기본 시드 20261014.
- 화면 문구는 모두 한국어.
- 이 PC에는 git이 없다 → 각 Task의 "커밋" 대신 "테스트 페이지 전부 통과"를 체크포인트로 삼는다.
- **테스트 실행 방법(모든 Task 공통):** `.claude/launch.json`의 서버 `forest`를 preview_start → 앱 안 브라우저로 `http://localhost:8123/tests.html` → `window.TEST_RESULTS`의 `failed === 0` 확인.

## Review Focus

1. 손가락이 버튼 패널 밖으로 나가거나 iOS 시스템 제스처로 pointercancel이 오면 → 버튼이 눌린 채 남으면 안 됨(캐릭터 멈춤). → Task 6 `dirTracker: clear releases everything`, `dirTracker: release unknown id is harmless`.
2. 탭 전환·화면 잠금 후 복귀 → 몇 초 분량 물리가 한꺼번에 돌거나 타이머가 튀면 안 됨(한 프레임 최대 0.25초). → Task 6 `advanceClock clamps long frames`.
3. 주소창 숨김·회전·320px 작은 폰 → 정수 배율 ≥1, 월드 폭 전체 표시, 버튼 영역 최소 96px. → Task 6 `computeViewport` 4종.
4. 한 프레임에 크게 떨어져도 캐릭터가 화면 밖으로 나가면 안 됨. → Task 6 `camera keeps player inside margins`.
5. 완주 후 "다시 하기" → 타이머·추락 횟수·최고 층·카메라·오버레이 완전 초기화. → Task 7 Step 6 (브라우저 확인).

---

### Task 1: 뼈대, 설정, 테스트 하네스

**Files:**
- Create: `config.js`, `js/util.js`, `js/rng.js`, `tests.html`, `js/tests.js`, `.claude/launch.json`
- 이미 있음: 스크래치패드 `serve.py` (no-store 캐시, `.js` → `application/javascript`)

**Interfaces — Produces:**
- `window.GAME_CONFIG = { totalFloors: 60, seed: 20261014, world: {cols: 12, cell: 16, slabThickness: 6}, player: {width: 8, height: 22}, physics: {walkSpeed, groundAccel, groundDecel, turnAccel, airAccel, airDrag, gravity, maxFallSpeed, stepHeight, airStepTolerance, fixedStep: 1/120}, fall: {countFloors: 3, shakeFloors: 10}, camera: {climbAnchor, fallAnchor, smoothTime, edgeMargin}, zones: [...], rockBumperChance: 0.35, ui: {controlsRatio: 0.2, controlsMinPx: 96}, bot: {maxSecondsPerFloor: 2} }` — 항목마다 한글 주석.
- `SF.clamp(v, lo, hi)`, `SF.lerp(a, b, t)`, `SF.approach(v, target, delta)`, `SF.floorAt(y) -> int`, `SF.smoothDamp(current, target, velRef /*{v}*/, smoothTime, dt) -> number` (Unity식 임계 감쇠).
- `SF.makeRng(seed) -> { next(): [0,1), int(lo, hi) /*양끝 포함*/, chance(p): bool, pick(arr) }` — mulberry32.
- 하네스(`js/tests.js` 맨 앞): `test(name, fn)`, `ok(cond, msg)`, `eq(a, b, msg)`, `near(a, b, tol, msg)`. 끝나면 결과 목록을 페이지에 그리고 `window.TEST_RESULTS = {passed, failed, failures: [{name, message}]}`, `document.title = 'PASS n'` 또는 `'FAIL n'`.

- [ ] **Step 1:** `.claude/launch.json` 작성: `{"version":"0.0.1","configurations":[{"name":"forest","runtimeExecutable":"C:\\Users\\toste\\anaconda3\\python.exe","runtimeArgs":["<스크래치패드>\\serve.py","8123","<프로젝트 루트>"],"port":8123}]}`
- [ ] **Step 2:** `tests.html`(스크립트 순서: config → util → rng → world → physics → level → bot → input → camera → tests; 아직 없는 파일은 이후 Task에서 추가)과 하네스, 실패하는 테스트 작성:
  - `floorAt`: `floorAt(0)=1`, `floorAt(15.99)=1`, `floorAt(16)=2`, `floorAt(944)=60`
  - `rng deterministic`: `makeRng(42)` 두 개의 처음 5개 `next()` 같음, `makeRng(43)`과는 다름
  - `rng.int inclusive`: `int(2,3)` 1000번 → 2와 3이 모두 나오고 범위 밖 없음
  - `approach`: `approach(10,0,3)=7`, `approach(1,0,3)=0`, `approach(-1,0,3)=0`
- [ ] **Step 3:** 서버 띄우고 tests.html 열기 → FAIL 확인 (`SF.floorAt` 없음)
- [ ] **Step 4:** `config.js`, `js/util.js`, `js/rng.js` 구현
- [ ] **Step 5:** tests.html → 전부 PASS

### Task 2: 격자와 충돌 질의 (`js/world.js`)

**Interfaces:**
- Consumes: `GAME_CONFIG.world`
- Produces:
  - `SF.CELL = {EMPTY:0, SLAB:1, SOLID:2}`, `SF.STYLE = {PLANK:0, BRICK:1, BRANCH:2, ROCK:3, GROUND:4, GOAL:5, WALL:6}`
  - `SF.createGrid(cols, rows) -> Grid {cols, rows, type: Uint8Array, style: Uint8Array, get(c, r), set(c, r, type, style)}`. 범위 밖 `get`: `c<0 || c>=cols` → SOLID, `r<0` → SOLID, `r>=rows` → (c가 0 또는 cols−1이면 SOLID, 아니면 EMPTY).
  - `SF.gridFromAscii(lines) -> Grid` — 마지막 줄 = 행 0. `#` SOLID/WALL(행 0은 GROUND), `R` SOLID/ROCK, `=` SLAB/PLANK, `.` EMPTY.
  - `new SF.World(grid, cfg)`, Rect = `{x0, y0, x1, y1, kind: 'slab'|'solid', col, row}`. 발판 `[16c,16c+16]×[16r−6, 16r]`, 고체 `[16c,16c+16]×[16r−16, 16r]`.
    - `rectsIn(x0, y0, x1, y1) -> Rect[]`
    - `hasSupport(x, w, feet) -> bool` — 윗면이 feet±0.01, 가로 겹침 > 0.001
    - `landingTop(x, w, yFrom, yTo) -> number|null` — yTo<yFrom, 윗면 ∈ [yTo, yFrom+0.01], 가로 겹침, 가장 높은 윗면
    - `findStep(nx, w, feet, tol, d) -> number|null` — 윗면 ∈ (feet+0.01, feet+tol+0.01]이고, d>0이면 `x0 ∈ [nx−1, nx+w+1]`, d<0이면 `x1 ∈ [nx−1, nx+w+1]`. 가장 높은 윗면. (진행 방향 앞쪽 가장자리만 계단으로 인정 → 뒤쪽 발판에 올라타지 않음)
    - `isFree(x, feet, w, h) -> bool` — 고체와 0.001 넘게 겹치지 않음(발판은 무시)
    - `solidHit(nx, feet, w, h, d) -> number|null` — 겹치는 고체가 있으면 d>0: `min(x0) − w`, d<0: `max(x1)`
    - `ceilingBottom(x, w, headFrom, headTo) -> number|null` — 고체 아랫면 ∈ [headFrom−0.01, headTo], 가장 낮은 것

- [ ] **Step 1:** 실패하는 테스트 작성 (지도는 테스트 안에 ASCII로):
  - `grid: out of range`: `get(-1,5)`=SOLID, `get(3,-1)`=SOLID, `get(3,999)`=EMPTY, `get(0,999)`=SOLID
  - `world: support`: 바닥만 있는 지도 → `hasSupport(20,8,0)` true, `hasSupport(20,8,1)` false; 행1 열3~4 발판 → `hasSupport(73,8,16)` true(가장자리 7px 걸침), `hasSupport(80.5,8,16)` false
  - `world: landingTop highest`: 행2 열4~6 발판 → 발판 위 x에서 `landingTop(70,8,40,30)=32`, 발판 밖 x에서 `landingTop(20,8,40,-5)=0`
  - `world: findStep direction`: 행1 열5 발판(x 80~96) → `findStep(73,8,0,17,+1)=16`, `findStep(97,8,0,17,-1)=16`, `findStep(97,8,0,17,+1)=null`, `findStep(73,8,0,15,+1)=null`
  - `world: solidHit`: 행1~2 열6 바위(x 96~112) → `solidHit(90,0,8,22,+1)=88`, `solidHit(110,0,8,22,-1)=112`
  - `world: slabs not solid`: 행1 열5 발판 → `isFree(80,0,8,22)` true
- [ ] **Step 2:** tests.html → 새 테스트 FAIL 확인
- [ ] **Step 3:** `js/world.js` 구현 (칸 단위 순회로 사각형 생성, 별도 캐시 없음)
- [ ] **Step 4:** tests.html → 전부 PASS

### Task 3: 캐릭터 물리 (`js/physics.js`)

**Interfaces:**
- Consumes: `SF.World`(Task 2), `cfg.physics`, `cfg.player`, `SF.floorAt/approach/clamp`
- Produces:
  - `SF.createPlayer(x, y) -> {x, y, w: 8, h: 22, vx: 0, vy: 0, grounded: true, facing: 1, airStartY: y}`
  - `SF.stepPlayer(p, world, dir, cfg) -> Event[]` — Event: `{type:'stepUp', dy}` | `{type:'leaveGround'}` | `{type:'land', dropFloors, floor}` | `{type:'bump'}`

순서가 동작을 결정하므로 그대로 따른다 (dt = cfg.physics.fixedStep, P = cfg.physics):
```
1. 땅: dir≠0 → vx += dir*(vx≠0 && sign(vx)≠dir ? P.turnAccel : P.groundAccel)*dt; dir=0 → vx = approach(vx,0,P.groundDecel*dt)
   공중: dir≠0 → vx += dir*P.airAccel*dt;  dir=0 → vx = approach(vx,0,P.airDrag*dt)
   vx = clamp(vx, -P.walkSpeed, P.walkSpeed); dir≠0 → facing = dir
2. 공중: vy = max(vy - P.gravity*dt, -P.maxFallSpeed)
3. dx = vx*dt ≠ 0 이면: nx = x+dx, d = sign(dx), tol = grounded ? P.stepHeight : P.airStepTolerance
   top = world.findStep(nx, w, y, tol, d)
   top≠null && world.isFree(nx, top, w, h) → (공중이었으면 land 이벤트) stepUp{dy: top-y}; y=top; vy=0; grounded=true; x=nx
   아니면 hit = world.solidHit(nx, y, w, h, d): hit≠null → x=hit, vx=0, bump / 아니면 x=nx
4. 공중이면 ny = y+vy*dt.
   vy<0: top = world.landingTop(x, w, y, ny) → 있으면 y=top, vy=0, grounded=true,
         land{dropFloors: floorAt(airStartY)-floorAt(top), floor: floorAt(top)} / 없으면 y=ny
   vy>0: c = world.ceilingBottom(x, w, y+h, ny+h) → 있으면 y=c-h, vy=0 / 없으면 y=ny
5. grounded && !world.hasSupport(x, w, y) → grounded=false, vy=0, airStartY=y, leaveGround
```

- [ ] **Step 1:** 실패하는 테스트 작성. 하네스에 `runSteps(p, world, dirFn, n) -> events[]` 추가(`dirFn(step, p)`가 방향을 돌려줌).
  - `physics: accel numbers`: 정지 상태 dir+1 1스텝 → `vx=7.5`; 60스텝 → `vx=72`
  - `physics: release decel`: 땅에서 `vx=72`, dir 0, 1스텝 → `vx=62`
  - `physics: auto step up`: 행1 열4~10 발판, `createPlayer(20,0)` dir+1 120스텝 → `y=16`, grounded, stepUp(dy 16) 이벤트 있음
  - `physics: idle never climbs`: 같은 지도, `createPlayer(50,0)` dir 0 120스텝 → `y=0`
  - `physics: 2-high rock blocks`: 행1~2 열6 바위, `createPlayer(20,0)` dir+1 240스텝 → `x=88`, `y=0`, bump 이벤트 있음
  - `physics: 1-high solid is a step`: 행1 열6 바위 하나 → dir+1 → `y=16`
  - `physics: walk off and fall to ground`: 행3 열2~5 발판, `createPlayer(40,48)` dir+1 → 착지 후 `y=0`, `land.dropFloors=3`
  - `physics: land on lower slab`: 위 지도 + 행1 열5~9 발판 → 착지 후 `y=16`, `dropFloors=2`
  - `physics: walk under high slab`: 행2 열4~7 발판, `createPlayer(20,0)` dir+1 200스텝 → `x>130`, `y=0`
  - `physics: pass up through slab`: 행2 열3~6 발판, `p=createPlayer(60,0)`, `grounded=false`, `vy=350`, dir 0 120스텝 → `y=32`(통과해 올라갔다가 위에 착지)
  - `physics: air control limited`: 빈 공중, `grounded=false`, `vx=72`, dir−1 1스텝 → `vx≈69.75`
  - `physics: air step tolerance`: 행3 열6~8 발판, `p` x=87.5, y=46, vx=72, vy=−50, grounded=false → 1스텝 → `y=48`, grounded, land 이벤트
  - `physics: zigzag turn`: 행1 열5, 행2 열6, 행3 열5 발판. `createPlayer(40,0)` dir+1로 `y===32 && grounded`까지(최대 400스텝), 그다음 dir−1 60스텝 → `y=48`
  - `physics: overshoot open landing`: 같은 지도, dir+1만 300스텝 → `y=0`, 마지막 land의 `dropFloors=2`
- [ ] **Step 2:** tests.html → 새 테스트 FAIL 확인
- [ ] **Step 3:** `js/physics.js` 구현 (위 순서 그대로)
- [ ] **Step 4:** tests.html → 전부 PASS

### Task 4: 맵 생성기 (`js/level.js` 1부)

**Interfaces:**
- Consumes: `SF.createGrid`, `SF.CELL`, `SF.STYLE`, `SF.makeRng`, `cfg.zones`
- Produces:
  - `SF.zoneForFloor(cfg, floor) -> {index, zone}`
  - `SF.generateLevel(cfg, seed) -> Level` / 실패 시 `null` (비행이 디딤판 2개 미만 등)
    - `Level = {grid, treads: Tread[], rocks: [{col, row}], spawn: {x: 20, y: 0}, goalRow: totalFloors−1, seed}` (바위 `row` = 아래 칸, 두 칸 차지)
    - `Tread = {row, c0, c1, flight, dirIn: ±1, dirToNext: ±1|0, isLanding, turn: 'safe'|'open'|null, zone, extended, isGoal}`
  - `SF.checkHeadroom(level) -> string[]` (위반 목록, 비면 통과)
  - `SF.treadIndexMap(level) -> Int32Array(cols*rows)` (칸 → 디딤판 번호, 없으면 −1)

생성 규칙 (설계 §5):
```
행수 = totalFloors + 6. 행0 전체 SOLID/GROUND, 열0·11 전체 SOLID/WALL.
row=1, dir=+1, cursor=3(첫 디딤판 시작 열), flight=0
while row <= goalRow:
  len = rng.int(zone(row+1).flightTreads)
  비행 안에서 반복 (placed < len && row <= goalRow):
    w = rng.int(zone(row+1).treadWidth)
    dir>0: [cursor, min(cursor+w-1, 10)]  /  dir<0: [max(cursor-w+1, 1), cursor];  cursor가 1~10 밖이면 비행 종료
    canPlace(row,c0,c1) 실패 → w=1로 재시도 → 또 실패면 비행 종료
    배치(스타일 = 구간 style), row++, cursor = dir>0 ? c1+1 : c0-1
    방금 놓은 행이 goalRow면: 진행 방향 벽까지 늘리고 GOAL 표시 → 생성 끝
  비행 디딤판 < 2 → return null
  마지막 디딤판 = 착지판. 바깥 빈 열 수 = dir>0 ? 10-c1 : c0-1
    바깥≥1 && chance(openTurnChance) → 'open'
    아니면 'safe': 바깥≥1 && chance(rockBumperChance) && 바위 자리 OK → 착지판 1칸 연장 + 그 위 바위(2칸)
                  아니면 벽까지 연장
  dir = -dir; cursor = dir>0 ? landing.c1+1 : landing.c0-1; flight++
canPlace: 칸들이 비어 있고, 같은 열 위아래 한 행(행≥1)에 발판·바위가 없을 것.
바위 자리: 연장 칸 위 3칸(r+1, r+2 바위, r+3 머리 공간)이 비어 있을 것.
dirToNext: 다음 디딤판이 오른쪽이면 +1, 왼쪽이면 −1, 정상은 0.
```

- [ ] **Step 1:** 실패하는 테스트 작성 (`L = SF.generateLevel(GAME_CONFIG, GAME_CONFIG.seed)`):
  - `level: generated`: `L !== null`
  - `level: treads continuous`: 모든 i에서 `next.row === cur.row+1`이고 (`next.c0 === cur.c1+1` 또는 `next.c1 === cur.c0−1`)
  - `level: start and goal`: `treads[0].row===1`, 마지막 디딤판 `row===59`, `isGoal`, 진행 방향 벽까지(`c1===10` 또는 `c0===1`)
  - `level: headroom clean`: `checkHeadroom(L)`이 빈 배열
  - `level: zone rules`: 1~20층에 'open' 없음, 착지판·정상이 아닌 디딤판 폭이 구간 범위 안, 모든 비행 디딤판 ≥2
  - `level: open turn has a drop`: 'open' 착지판 바깥 옆 칸이 같은 행에서 EMPTY
  - `level: deterministic`: 같은 시드 두 번 → `grid.type` 원소가 모두 같음, 시드+1과는 다름
- [ ] **Step 2:** FAIL 확인
- [ ] **Step 3:** 구현
- [ ] **Step 4:** 전부 PASS

### Task 5: 봇, 추락 깊이 조절, 검증 (`js/bot.js`, `js/level.js` 2부)

**Interfaces:**
- Consumes: Task 3 `stepPlayer`, Task 4 `Level`/`treadIndexMap`
- Produces:
  - `SF.botDir(level, map, p) -> -1|0|1` — 공중 0 / 행0 바닥 +1 / 디딤판 위 `dirToNext`(정상 0) / 그 밖(바위 윗면) `p.x+4 < 96 ? +1 : −1`. 발 아래 칸 = `(col of p.x+4, round(p.y/16))`.
  - `SF.runBot(level, cfg, opts?) -> {reached, seconds, maxFloor}` — `opts.startTread`면 그 디딤판 가운데(`x = (c0+c1+1)*8 − 4`, `y = row*16`)에서 시작. `maxSeconds` 기본 `totalFloors * cfg.bot.maxSecondsPerFloor`.
  - `SF.measureOpenTurnFalls(level, cfg) -> [{treadIndex, floor, side, landedFloor, fallFloors}]` — 착지판 바깥 끝(`side>0: x=(c1+1)*16−8`, `side<0: x=c0*16`)에 vx=side*walkSpeed로 세우고 바깥쪽을 계속 누르며 land까지(최대 10초).
  - `SF.fixFallDepths(level, cfg, rng) -> fixesApplied` — 설계 §5대로 최대 50회: 가장 먼저 한도를 넘는 꺾임을 찾아, 같은 쪽·아래·한도 안·바위 없음·정상 아님·연장 가능한 착지판 중 rng로 하나를 벽까지 연장(`turn='safe'`, `extended=true`). 후보가 없으면 그 꺾임을 벽까지 연장해 안전하게.
  - `SF.validateLevel(level, cfg) -> string[]` — 머리 공간, 시작점 봇 완주, 모든 디딤판에서 봇 완주, 열린 꺾임 추락 ≤ 구간 한도, 바위 윗면에서 좌우로 걸어 내려가면 디딤판·바닥에 착지.
  - `SF.buildLevel(cfg) -> {level, attempts, report: {errors, botSeconds, falls}}` — 시도 k(0~9)는 시드 `cfg.seed + k*7919`: generate → fix → validate, 오류 없으면 반환. 10번 다 실패하면 마지막 결과와 오류 반환.

- [ ] **Step 1:** 실패하는 테스트 작성:
  - `build: default seed valid`: `B = SF.buildLevel(GAME_CONFIG)` → `B.report.errors.length===0`, `B.attempts===1`
  - `build: seeds 1..10 valid`: 시드 1~10 각각 errors 0
  - `bot: completes`: `runBot(B.level, GAME_CONFIG).reached`, `seconds < 60`
  - `bot: from every tread`: 모든 i에서 `runBot(B.level, GAME_CONFIG, {startTread: i}).reached`
  - `falls: within zone max`: 모든 `fallFloors ≤` 해당 구간 `maxFallFloors`
  - `falls: hard zone bites`: 기본 시드에서 41~60층 열린 꺾임 중 `fallFloors ≥ 15`인 것이 하나 이상
  - `build: fast enough`: `buildLevel` 실행 시간 < 1500ms
- [ ] **Step 2:** FAIL 확인
- [ ] **Step 3:** 구현. `falls: hard zone bites`가 실패하면 원인을 보고 구간 값이 아니라 fix 후보 선택(얕은 받침만 고르는지)을 고친다.
- [ ] **Step 4:** 전부 PASS

### Task 6: 입력·클록·화면 계산·카메라 (순수 함수)

**Files:** Create `js/input.js`, `js/camera.js`; Modify `js/util.js`

**Interfaces — Produces:**
- `SF.createDirTracker() -> {press(id, dir, t), move(id, dir, t), release(id), clear(), getDir()}` — 눌린 것 중 t가 가장 큰 것의 방향, 없으면 0. `move`는 방향이 바뀔 때만 t 갱신.
- `SF.bindInput(tracker, {controls, leftBtn, rightBtn}, onFirstInput)` — 키 ArrowLeft/KeyA = −1, ArrowRight/KeyD = +1(키 반복 무시). 패널 pointerdown → `setPointerCapture`, 방향 = 패널 가운데 기준 좌/우. pointermove/up/cancel/lostpointercapture 처리. window blur·visibilitychange(hidden) → `clear()`. 눌린 방향 버튼에 `.pressed`. contextmenu 막기.
- `SF.advanceClock(acc, realDt, step, maxFrame = 0.25) -> {steps, acc}`
- `SF.computeViewport(cssW, cssH, dpr, cfg) -> {controlsH, gameCssW, gameCssH, canvasW, canvasH, zoom, viewW, viewH, worldOffsetX}` — `controlsH = max(controlsMinPx, round(cssH*controlsRatio))`, `canvasW = round(cssW*dpr)`, `canvasH = round((cssH−controlsH)*dpr)`, `zoom = max(1, floor(canvasW/192))`, `viewW = canvasW/zoom`, `viewH = canvasH/zoom`, `worldOffsetX = (viewW−192)/2`.
- `SF.createCamera(cfg) -> {top, vel, snap(centerY, viewH, bounds), update(centerY, vy, airborne, viewH, dt, bounds)}` — top = 화면 위쪽 가장자리의 월드 y. anchor = lerp(climbAnchor, fallAnchor, 공중이고 vy<0이면 clamp(−vy/maxFallSpeed, 0, 1), 아니면 0). 목표 top = centerY + anchor·viewH → smoothDamp → 캐릭터 화면 비율을 [edgeMargin, 1−edgeMargin]로 고정 → `bounds {minTop, maxTop}`로 마지막에 고정(바닥 근처에서는 경계가 우선).

- [ ] **Step 1:** 실패하는 테스트 작성:
  - `dirTracker: last pressed wins`: press('k',+1,1), press('p1',−1,2) → −1
  - `dirTracker: release falls back`: 이어서 release('p1') → +1, release('k') → 0
  - `dirTracker: slide changes direction`: press('p1',−1,1), press('p2',+1,2), move('p1',+1,3), move('p2',−1,4) → −1
  - `dirTracker: clear releases everything`: clear() → 0
  - `dirTracker: release unknown id is harmless`: release('nope') → 오류 없음, 방향 유지
  - `advanceClock clamps long frames`: `(0, 5, 1/120)` → steps 30; `(0, 1/60, 1/120)` → steps 2; `(0.004, 0.005, 1/120)` → steps 1, acc ≈ 0.000667
  - `computeViewport 390x844@3`: controlsH 169, zoom 6, viewW 195, worldOffsetX 1.5
  - `computeViewport 360x740@2`: controlsH 148, zoom 3, viewW 240
  - `computeViewport 412x915@2.625`: canvasW 1082, zoom 5
  - `computeViewport 320x568@1`: controlsH 114, zoom 1, viewW 320 (네 경우 모두 `zoom*192 ≤ canvasW`, `viewH > 0`)
  - `camera keeps player inside margins`: snap(1500, 300, {minTop: 284, maxTop: 5000}) 후 update(1000, −420, true, 300, 1/60, 같은 bounds) → `(top−1000)/300 ∈ [0.12, 0.88]`
- [ ] **Step 2:** FAIL 확인
- [ ] **Step 3:** 구현
- [ ] **Step 4:** 전부 PASS

### Task 7: 플레이 가능한 화면 (단색 그림)

**Files:** Create `index.html`, `css/style.css`, `js/render.js`, `js/game.js`

**Interfaces:**
- Consumes: Task 1~6 전부
- Produces:
  - `SF.createRenderer(canvas, cfg) -> {setLevel(level), resize(vp), draw(frame)}`, frame = `{player: {x, y, w, h, facing, grounded, vx, vy}, cameraTop, time, popups: [{text, x, y, age}], particles: [], shake: {x, y}, debug: {hitbox}}`
  - `SF.game = {cfg, level, world, player, state: 'ready'|'playing'|'finished', stats: {time, falls, bestFloor}, reset(), teleport(floor), regenerate(seed), setBot(on), bot: bool}`

동작:
- 레이아웃: `#app`(세로 flex, PC에서 `max-width: calc(100vh*9/16)` 가운데) → `#stage`(canvas + HUD + 오버레이) + `#controls`(높이 = `vp.controlsH`, `padding-bottom: env(safe-area-inset-bottom)`, ◀ ▶ 버튼 두 개). `touch-action:none`, `user-select:none`, `-webkit-touch-callout:none`, viewport meta에 `user-scalable=no, viewport-fit=cover`.
- 루프: rAF → `advanceClock` → 스텝마다 `stepPlayer`(방향 = 봇 켜짐 ? `botDir` : `tracker.getDir()`) → 이벤트 처리 → 직전·현재 위치 보간해 그림.
- 카메라 경계: `minTop = viewH − 16`(바닥 아래는 바닥 두께만), `maxTop = (goalRow + 4) * 16`. 시작·reset·teleport 때 `snap`.
- 상태: 'ready'에서 "◀ ▶ 버튼(또는 ← → 키)으로 출발!" → 첫 입력에 'playing'(타이머는 'playing' 스텝마다 +fixedStep). HUD `{층}층`, `최고 {n}층`, `mm:ss.cc`.
- 추락: land `dropFloors ≥ 3` → `falls++`, "−{n}층!" 팝업 1.2초; `≥ 10` → 0.3초 흔들림(진폭 2px).
- 완주: grounded이고 `floorAt(y) ≥ totalFloors` → 'finished', "완주!" + 시간 + 추락 횟수 + "다시 하기" 버튼 → `reset()`.
- 단색 그림: 배경 짙은 갈색, 벽·바닥·바위 회색, 발판 구간 색(plank 주황·brick 회백·branch 갈색·goal 금색), 캐릭터 청록 사각형.

- [ ] **Step 1:** 구현
- [ ] **Step 2:** tests.html 여전히 PASS (회귀 확인)
- [ ] **Step 3:** 앱 안 브라우저 390×844에서 index.html → 스크린샷: HUD·게임·버튼 배치, 콘솔 오류 없음
- [ ] **Step 4:** 키보드 입력(→ 누르기)으로 몇 층 오르기 → HUD 층수 증가, 타이머 진행
- [ ] **Step 5:** `SF.game.teleport(45)` → `SF.game.setBot(true)` → 완주 오버레이 확인
- [ ] **Step 6:** "다시 하기" → 1층, `00:00.00`, 추락 0, 최고 1층, 준비 오버레이, 카메라 바닥

### Task 8: 픽셀아트와 연출 (`js/sprites.js`, `js/render.js`)

**Interfaces — Produces:**
- `SF.pixelCanvas(rows: string[], palette) -> HTMLCanvasElement` (문자 → 색, `.` 투명)
- `SF.buildSprites() -> {player: {idle:[2], walk:[4], step:[1], fall:[2], land:[1]}, slab: {plank|brick|branch|goal: {left, mid, right, single}}, rock, ground, wall, flag, deco: {grass, flower, mushroom, vine}}` — 캐릭터 프레임 16×24, 오른쪽을 봄
- `SF.bgPalette(frac) -> {base, grain, dark, light, accent}` — 0 짙은 따뜻한 갈색 → 0.5 초록 → 1 금빛 보간

그리기(설계 §7):
- 배경: 192×256 조각을 높이별로 생성·캐시, 패럴랙스 0.5. 결·옹이·덩굴·빛줄기.
- 벽: 나무껍질 타일, 화면 좌우 여백까지 채움. 발판: 이웃을 보고 왼끝·가운데·오른끝·단독 타일. 바위·바닥·정상 깃발.
- 장식: 디딤판 번호로 시드를 정해 풀·꽃·버섯(착지판)·덩굴(발판 아래), 충돌 없음.
- 캐릭터 프레임 선택: 공중이고 vy<−60 → fall / 착지 0.12초 → land / stepUp 0.07초 → step(+16px에서 0으로 줄어드는 그림 오프셋) / |vx|>5 → walk(이동 거리 6px마다 다음 프레임) / 그 외 idle(0.5초마다). facing<0이면 좌우 반전.
- 입자: 착지 먼지(층수에 비례), 계단 톡 작은 먼지, 떠다니는 나뭇잎·반딧불.

- [ ] **Step 1:** 구현
- [ ] **Step 2:** tests.html 여전히 PASS
- [ ] **Step 3:** 1층·30층·58층에서 스크린샷 (teleport) → 색 변화, 발판·캐릭터 명도 대비, 장식이 발판을 가리지 않음
- [ ] **Step 4:** 360×740, 412×915에서 스크린샷 → 정수 배율로 선명, 월드 폭 전체 보임
- [ ] **Step 5:** 봇으로 한 판 → 걷기·계단·추락·착지 동작이 자연스러움(필요하면 프레임 조정), 콘솔 오류 없음

### Task 9: 조정 패널 (`js/debug.js`)

**Files:** Create `js/debug.js`; Modify `index.html`(스크립트), `css/style.css`(패널)

동작 (설계 §9): 주소에 `debug`가 있을 때만 ⚙ 버튼 → 패널.
- 슬라이더(즉시 반영): walkSpeed 40~140, groundAccel 300~3000, groundDecel 300~3000, airAccel 0~900, gravity 500~2000, maxFallSpeed 200~800, camera.smoothTime 0.05~0.5
- 버튼: 설정 복사(`physics: {...},` / `camera: {...},` 텍스트, clipboard 실패 시 textarea 선택), 봇 켜기/끄기, N층으로 이동, 시드 입력 → 맵 다시 생성, 충돌 상자 보기
- 정보: 봇 완주 시간(`report.botSeconds`), 열린 꺾임별 추락 깊이 목록

- [ ] **Step 1:** 구현
- [ ] **Step 2:** `?debug`로 열기 → walkSpeed를 100으로 → 더 빨라짐 확인
- [ ] **Step 3:** 봇 켜기 → 정상까지, 45층 이동, 시드 5로 다시 생성, 충돌 상자 표시 확인
- [ ] **Step 4:** 설정 복사 결과 텍스트가 config.js 형식과 일치

### Task 10: 마무리 검증, 안내서, 폰 테스트 링크

**Files:** Create `README.md`; Modify 설계 문서 상태 줄

- [ ] **Step 1:** tests.html 전부 PASS (결과 수 기록)
- [ ] **Step 2:** 360×740, 390×844, 412×915, PC 1280×800 스크린샷, 콘솔 오류 없음
- [ ] **Step 3:** 실제 게임 화면에서 봇으로 처음부터 완주 → 완주 오버레이
- [ ] **Step 4:** `README.md`(한국어): 실행 방법(더블클릭/서버), config.js 고치는 법, `?debug` 사용법, 파일 구조, 다음 단계
- [ ] **Step 5:** artifact-design 스킬을 읽고 index.html + 보조 파일을 claude.ai 비공개 아티팩트로 게시 → 링크 전달
- [ ] **Step 6:** 설계 문서 상태를 "1차 구현 완료"로 바꾸고 메모리 갱신
