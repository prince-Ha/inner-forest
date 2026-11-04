// ============================================================
//  과학 인내의 숲 — 설정 파일
//  선생님이 직접 고칠 수 있는 값을 모아 둔 곳입니다.
//  숫자만 바꾸고 저장한 뒤 게임 화면을 새로고침하면 바로 반영됩니다.
//  (쉼표·괄호·따옴표를 지우지 않도록 주의하세요)
// ============================================================
window.GAME_CONFIG = {
  // 학교: 입장 화면에서 고르는 학년과 반 개수 (3학년 1~10반)
  school: { grade: 3, classCount: 10 },

  // 선생님 모드 비밀번호 (입장 화면의 '선생님' 버튼). 따옴표 안에 적어요
  teacher: { password: '6666' },

  // 구글 시트 연결 (설치안내.md 참고). Apps Script 웹 앱 주소(https://script.google.com/macros/s/…/exec)를 따옴표 안에 붙여 넣어요.
  // 비워 두면 시트 없이 게임 안 문제·말풍선으로 하고, 기록·랭킹·한마디는 남지 않아요.
  // 시트의 '설정' 탭 비밀번호도 위 teacher.password와 같게 해 주세요 (완주자 목록·한마디 숨기기에 써요)
  sheet: { url: 'https://script.google.com/macros/s/AKfycbwQ0D4lOUtEd_c83Pb872FiFAqh6Ik2y_U3ro74cwj47I4YTBZLNq39m7RjfZPwWw2G/exec' },

  // 구간 연습 버튼에 더하고 싶은 시작 층 (선생님 테스트 모드). 구간 이름 버튼 뒤에 붙어요
  practiceExtra: [{ floor: 570, label: '최종 구간' }],

  // 같은 방 친구들 (Firebase Realtime Database). 시작하면 rooms/{room}/players에 내 층을 올려요
  firebase: {
    room: 'forest', // 방은 하나만: 접속한 모두가 같은 방
    apiKey: 'AIzaSyAABoygMrdlEmv9s2hAxVC78guKihhFLc4',
    authDomain: 'endurance-1210a.firebaseapp.com',
    databaseURL: 'https://endurance-1210a-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'endurance-1210a',
    storageBucket: 'endurance-1210a.firebasestorage.app',
    messagingSenderId: '945432874903',
    appId: '1:945432874903:web:b787886eb1c911ac78bed2',
  },

  // 전체 층수
  totalFloors: 600,

  // 맵 번호(시드). 같은 번호면 모든 학생이 똑같은 맵을 플레이합니다.
  // 번호를 바꾸면 새로운 맵이 만들어집니다. (따옴표 없이 숫자로)
  seed: 20261021,

  // 월드 크기 — 그림이 이 크기에 맞춰져 있으니 고치지 마세요
  world: {
    cols: 12,          // 가로 칸 수 (양 끝 1칸은 벽)
    cell: 16,          // 한 칸 크기(픽셀). 계단 한 칸 높이 = 1층
    slabThickness: 6,  // 발판 두께(픽셀)
  },

  // 캐릭터 충돌 상자 크기(픽셀) — 고치지 마세요
  player: { width: 8, height: 22 },

  // 버튼 한 번 = 한 칸 (조작감)
  step: {
    hopTime: 0.09,     // 한 칸 뛰는 데 걸리는 시간(초). 작을수록 빠름 (0.03~0.3)
    queueMax: 2,       // 뛰는 중에 누른 버튼을 몇 번까지 기억했다가 이어서 할지
    missSpeed: 70,     // 잘못 눌러 허공으로 뛰어나가는 속도 (픽셀/초)
    missPopVy: 140,    // 잘못 눌렀을 때 살짝 튀어오르는 힘
    snapTime: 0.08,    // 떨어져 착지한 뒤 칸 가운데로 맞추는 시간(초)
  },

  // 콤보 (실수 없이 연속으로 오르기)
  combo: {
    timeout: 1.5,               // 이 시간(초) 동안 안 오르면 콤보가 끊김
    milestones: [10, 30, 50],   // 축하해 주는 콤보 수
  },

  // 추락 물리 (떨어질 때 쓰는 값)
  physics: {
    gravity: 1100,         // 중력
    maxFallSpeed: 420,     // 최대 낙하 속도 (420 = 초당 약 26층)
    airStepTolerance: 3,   // 떨어지면서 모서리에 아슬아슬하게 닿을 때 올려주는 여유(픽셀)
    fixedStep: 1 / 120,    // 물리 계산 간격(초) — 고치지 마세요
    // 아래는 '누르고 있으면 걷기' 방식(1차 처음 버전)의 값. 지금 게임에서는 쓰지 않아요
    walkSpeed: 72,
    groundAccel: 900,
    groundDecel: 1200,
    turnAccel: 1800,
    airAccel: 270,
    airDrag: 0,
    stepHeight: 17,
  },

  // 추락
  fall: {
    countFloors: 3,   // 이 층수 이상 떨어지면 '추락 1회'로 셉니다
    shakeFloors: 10,  // 이 층수 이상 떨어지면 화면이 살짝 흔들립니다
  },

  // 카메라
  camera: {
    climbAnchor: 0.62,  // 오를 때 캐릭터 위치 (화면 위에서부터의 비율, 클수록 아래)
    fallAnchor: 0.35,   // 빠르게 떨어질 때 캐릭터 위치 (아래를 미리 보여줌)
    smoothTime: 0.15,   // 카메라가 따라오는 부드러움(초). 클수록 느긋하게
    edgeMargin: 0.12,   // 캐릭터가 화면 위아래 이 비율 밖으로는 나가지 않음
  },

  // 높이별 난이도 구간 (아래 구간부터 차례로)
  //   untilFloor     이 층까지가 이 구간
  //   treadWidth     계단 한 칸(1층)의 가로 폭 [최소, 최대] 칸 (1~3, 최소는 2 이하)
  //   flightTreads   한 방향으로 이어지는 계단 수 [최소, 최대] (최소 1 이상, 작을수록 자주 꺾임)
  //   openTurnChance 꺾이는 곳이 낭떠러지일 확률 (0 = 항상 안전, 1 = 항상 낭떠러지)
  //                  maxFallFloors를 넘는 낭떠러지는 안전하게 막히므로 실제 낭떠러지 수는 이보다 적어요
  //   maxFallFloors  잘못 눌렀을 때 최대 추락 층수 (모든 계단에서 시험해 이 값을 넘는 맵은 쓰지 않아요)
  //   style          발판 모양: 'plank' 나무판, 'brick' 돌벽돌, 'branch' 나뭇가지
  //   name           구간 연습 버튼에 보이는 이름 (장애물 구간만)
  //   hazards        장애물 (없으면 장애물 없음)
  //                    spikeBall·monkey·acorn: [a, b] = a~b층마다 하나씩
  //                    crumble: 0~1 = 계단이 금 간 발판일 확률
  //                    gust: true = 돌풍 (바람이 부는 동안 가만히 서 있으면 바람 쪽으로 한 칸 밀림)
  //                    double: 0~1 = 장애물 층에 다른 장애물이 하나 더 겹칠 확률 (안 적으면 0)
  //                    speed: 장애물 빠르기 배수 (안 적으면 1, 1.5 = 1.5배 빠름. 원숭이 예고 시간은 그대로)
  //                    crumbleDelay: 금 간 발판이 밟고 부서지기까지(초). 안 적으면 obstacles.crumble.delay ÷ speed
  zones: [
    { untilFloor: 20,  treadWidth: [1, 1], flightTreads: [4, 6], openTurnChance: 0,    maxFallFloors: 2,  style: 'plank' },
    { untilFloor: 40,  treadWidth: [1, 1], flightTreads: [2, 4], openTurnChance: 0.5,  maxFallFloors: 8,  style: 'brick' },
    { untilFloor: 60,  treadWidth: [1, 1], flightTreads: [1, 3], openTurnChance: 0.75, maxFallFloors: 30, style: 'branch' },
    { untilFloor: 100, treadWidth: [1, 1], flightTreads: [2, 4], openTurnChance: 0.5,  maxFallFloors: 10, style: 'brick',
      name: '가시공', hazards: { spikeBall: [2, 4] } },
    { untilFloor: 150, treadWidth: [1, 1], flightTreads: [2, 4], openTurnChance: 0.5,  maxFallFloors: 15, style: 'branch',
      name: '원숭이', hazards: { monkey: [3, 4], spikeBall: [6, 8] } },
    { untilFloor: 200, treadWidth: [1, 1], flightTreads: [2, 4], openTurnChance: 0.5,  maxFallFloors: 15, style: 'plank',
      name: '금 간 발판', hazards: { crumble: 0.5, spikeBall: [5, 7] } },
    { untilFloor: 280, treadWidth: [1, 1], flightTreads: [1, 3], openTurnChance: 0.6,  maxFallFloors: 20, style: 'branch',
      name: '도토리', hazards: { acorn: [3, 5], monkey: [5, 7], spikeBall: [5, 7], crumble: 0.2 } },
    { untilFloor: 360, treadWidth: [1, 1], flightTreads: [1, 3], openTurnChance: 0.7,  maxFallFloors: 30, style: 'brick',
      name: '섞어서', hazards: { acorn: [3, 5], monkey: [3, 5], spikeBall: [3, 5], crumble: 0.3, speed: 1.15 } },
    { untilFloor: 440, treadWidth: [1, 1], flightTreads: [1, 3], openTurnChance: 0.75, maxFallFloors: 40, style: 'branch',
      name: '겹치기', hazards: { acorn: [2, 4], monkey: [2, 4], spikeBall: [2, 4], crumble: 0.4, double: 0.2, speed: 1.25 } },
    // 돌풍은 어려운 구간에만. 기다려야 하는 장애물 없이 "쉬지 말고 오르기"
    { untilFloor: 500, treadWidth: [1, 1], flightTreads: [1, 2], openTurnChance: 0.8,  maxFallFloors: 50, style: 'brick',
      name: '돌풍', hazards: { gust: true, crumble: 0.5 } },
    // 최고 난이도: 추락 한도 없음(100), 장애물 2층마다·절반은 겹침·1.5배, 금 간 발판은 방향 바꿀 틈을 주려고 0.47초
    { untilFloor: 600, treadWidth: [1, 1], flightTreads: [1, 2], openTurnChance: 0.9,  maxFallFloors: 100, style: 'branch',
      name: '최고 난이도', hazards: { spikeBall: [2, 3], monkey: [2, 3], acorn: [2, 3], crumble: 0.7, double: 0.5, speed: 1.5,
        crumbleDelay: 0.47 } },
  ],

  // 과학 퀴즈: firstFloor층부터 every층마다 count문제 (10·30·…·590층). 퀴즈 층과 그 위 층에는 장애물을 두지 않아요
  quiz: { firstFloor: 10, every: 20, count: 30 },

  // 등반 시간 제한(초). 퀴즈 푸는 시간은 빼고 잽니다. 900 = 15분, 0 = 제한 없음
  timeLimitSec: 900,

  // 점수 = 최고 층 × perFloor + 완주 finishBonus + (완주 때만) 남은 등반 초 × perSecondLeft
  //        + 퀴즈 정답 × perCorrect + 최고 콤보 × perCombo
  score: { perFloor: 10, finishBonus: 3000, perSecondLeft: 5, perCorrect: 200, perCombo: 10 },

  // 미리 검사한 맵 (학생 휴대폰은 600층 검사를 건너뛰고 이 값으로 바로 맵을 만들어요)
  // seed·zones·obstacles 등 맵에 관한 값을 고치면 check가 맞지 않아 처음부터 검사해요(느림).
  // 그때 화면에 나오는 안내의 map 줄이나, 조정 패널의 '맵 번호 다시 찾기' 결과를 여기에 붙여 넣으세요
  map: { seed: 20261021, hazardTry: 0, check: '8a478c98' },

  // 장애물
  obstacles: {
    knockSpeed: 90,     // 맞았을 때 튕겨나가는 속도 (픽셀/초)
    knockPopVy: 180,    // 맞았을 때 튀어오르는 힘
    graceTime: 0.6,     // 맞고 착지한 뒤 무적 시간(초)
    spikeBall: { period: 1.6, span: 3 },            // 왕복 시간(초), 굴러가는 칸 수
    banana: { period: 1.8, speed: 100, warn: 0.3 }, // 던지는 간격(초), 속도, 던지기 전 예고(초)
    crumble: { delay: 0.35, respawn: 3 },           // 밟고 부서지기까지(초), 다시 생기기까지(초)
    acorn: { period: 1.5, speed: 150, height: 5 },  // 떨어지는 간격(초), 속도, 몇 칸 위에서 떨어지는지
    // 돌풍: period초마다 예고(나뭇잎) warn초 → 바람 blow초. 바람 속에서 hold초 넘게 서 있으면 한 칸 밀림. 방향은 번갈아
    gust: { period: 4, warn: 0.7, blow: 1, hold: 0.35 },
  },

  // 안전한 꺾임을 벽 대신 바위로 막을 확률 (바위에 부딪히면 제자리)
  rockBumperChance: 1,

  // 화면
  ui: {
    controlsRatio: 0.2,  // 아래 버튼 영역 높이 (화면 높이 대비)
    controlsMinPx: 96,   // 버튼 영역 최소 높이(px)
  },

  // 맵 검증 봇 (한 층당 허용 시간, 초)
  bot: { maxSecondsPerFloor: 2 },
};
