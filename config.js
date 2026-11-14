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

  // 등반 시간 제한(초). 퀴즈 푸는 시간은 빼고 잽니다. 1800 = 30분, 0 = 제한 없음
  // (바꾸면 apps-script/Code.js의 RULES.timeLimitSec도 같게 고치고 다시 붙여 넣어야 기록이 저장돼요)
  timeLimitSec: 1800,

  // 1000층 도전 (601층~): 메이플 점프 퀘스트처럼 발판을 뛰어 오른다. topFloor까지 만들어져 있어요
  jump: {
    topFloor: 1000,  // 꼭대기
    seed: 7,         // 맵 모양 번호
    speed: 320,      // 점프 힘 (높이 약 2.9칸)
    walkSpeed: 90,   // 걷는 속도 (픽셀/초)
    airAccel: 400,   // 공중에서 방향 바꾸는 힘
    ropeSpeed: 48,   // 밧줄 오르내리는 속도
    windSpeed: 34,   // 돌풍 구간에서 바람에 밀리는 속도 (픽셀/초). 걸어서 버틸 수 있어요
    gustPeriod: 6,   // 돌풍이 부는 간격(초). 1~600층은 4초
    spikePeriod: 2.6, // 가시공 한 번 왕복하는 시간(초). 클수록 느려서 발판에 설 틈이 길어요
    crumbleDelay: 0.8, // 금 간 발판이 밟고 나서 부서지기까지(초). 1~600층(0.35초)보다 넉넉하게
    practiceFloors: [900, 950], // 선생님 테스트 모드의 점프 숲 연습 버튼 (601층 버튼은 항상 있어요)
    // 정복 퀴즈: 그 층(폭 전체 쉼터)에 처음 서면 나와요. 구글 시트와 따로, 여기서만 고쳐요.
    //   answer는 정답 번호 (0 = A, 1 = B, 2 = C, 3 = D). 1000층 문제는 풀고 나면 정복 축하가 나와요
    quizzes: [
      {
        floor: 800,
        q: '칼슘은 전자를 2개 잃고 Ca²⁺이 되고, 염소는 전자를 1개 얻어 Cl⁻이 된다. 이 두 이온이 결합해 만들어지는 물질의 화학식은?',
        choices: ['CaCl', 'CaCl₂', 'Ca₂Cl', 'Ca₂Cl₂'],
        answer: 1,
        explain: '이온이 결합한 물질은 (+)전하의 합과 (−)전하의 합이 같아야 해요. Ca²⁺ 1개의 +2를 맞추려면 Cl⁻이 2개 필요해요.',
      },
      {
        floor: 1000,
        q: '뚜껑을 열어 둔 용기에 탄산 칼슘과 묽은 염산을 넣고 반응시켰더니 기체가 발생하면서 전체 질량이 2 g 줄어들었다. 같은 물질을 같은 양만큼 밀폐 용기에 넣고 반응시키면 반응 후 전체 질량은?',
        choices: ['2 g 줄어든다', '변하지 않는다', '2 g 늘어난다', '4 g 줄어든다'],
        answer: 1,
        explain: '열린 용기에서는 생긴 기체가 공기 중으로 날아가서 질량이 줄어든 것처럼 보여요. 밀폐 용기에서는 기체가 빠져나가지 못해서 전체 질량이 그대로예요.',
      },
    ],
    // 구간별 난이도 (아래부터). width 발판 폭 [최소, 최대] 칸, minGap 발판 사이 최소 빈칸, twoRowChance 2줄 위로 뛸 확률,
    //   ropeChance 밧줄 확률, hazards 발판마다 장애물 확률, crumble 금 간 발판 확률, gust 돌풍, speed 장애물 빠르기, double 겹칠 확률
    //   hazards 이름: spikeBall 가시공, monkey 바나나 원숭이, acorn 도토리, rust 녹물 방울(위에서 뚝뚝, 도토리와 같은 움직임)
    bands: [
      { untilFloor: 700, width: [2, 3], minGap: 1, twoRowChance: 0.6, hazards: { spikeBall: 0.25, rust: 0.2 } },
      { untilFloor: 800, width: [1, 2], minGap: 1, twoRowChance: 0.65, hazards: { spikeBall: 0.25, monkey: 0.25, rust: 0.3 }, crumble: 0.2 },
      { untilFloor: 900, width: [1, 2], minGap: 1, twoRowChance: 0.7, hazards: { spikeBall: 0.25, monkey: 0.2, acorn: 0.3, rust: 0.3 }, crumble: 0.3, gust: true, speed: 1.15 },
      { untilFloor: 1000, width: [1, 2], minGap: 1, twoRowChance: 0.75, hazards: { spikeBall: 0.3, monkey: 0.3, acorn: 0.35, rust: 0.4 }, crumble: 0.4, gust: true, speed: 1.3, double: 0.35 },
    ],
    // 쉼터(40층마다)에서 문제가 나와요: 640·680·…·1000층. 800·1000층은 위 고정 문제, 나머지는 시트 문제은행에서. 0이면 고정 문제 층에서만
    quizEvery: 40,
    // 크림슨발록: 문제를 풀 때 옆에서 기다리다가, 맞히면 날아가고 틀리면 학생을 떨어뜨려요
    balrog: {
      drop: 10,        // 틀리면 떨어지는 층수 (그 아래 가장 가까운 발판에 내려요)
      fly: 'assets/balrog/fly.gif',       // 기다리다 날아갈 때 (날개 짓)
      attack: 'assets/balrog/attack.gif', // 틀린 학생을 덮칠 때
      right: ['쳇… 맞혔군. 이번엔 봐준다!', '흥, 운이 좋았다!', '다음 문제에서 두고 보자!', '오호, 제법인데? 쳇.'],
      wrong: [
        '크하하! 그걸 틀려? 발록이 다 부끄럽다!',
        '정답은 {정답}! 교과서 한 번만 펴 봐라~ 크큭',
        '이 정도 문제에 떨어지다니, 날개가 필요하겠는데?',
        '아래층 구경 잘 다녀와라~ 크하하!',
        '네 과학 점수가 궁금해지는구나, 크큭.',
        '발록은 오늘도 즐겁다! 다음 먹잇감은 누구냐!',
      ],
    },
  },

  // 1000층 정복 축하 움짤 (차례로 겹치며 나타나요). seconds초 뒤 또는 화면을 누르면 증명서로
  cheer: {
    files: ['assets/cheer/1.gif', 'assets/cheer/2.gif', 'assets/cheer/3.gif', 'assets/cheer/4.gif', 'assets/cheer/5.gif', 'assets/cheer/6.gif', 'assets/cheer/7.gif'],
    gap: 1.6,          // 다음 움짤이 나오기까지(초). 앞 움짤이 한 번 다 움직이는 시간
    holdSeconds: 4,    // 모두 나온 뒤 더 보여 주는 시간(초)
    song: 'assets/cheer/celebrate.mp3', // 축하하는 동안 나오는 노래 (소리를 켜 둔 기기에서만). 비우면 빵빠레만
    songVolume: 0.8,
  },

  // 배경음: 차례로 반복 재생. 처음에는 꺼져 있고 왼쪽 위 스피커를 누르면 효과음과 함께 켜져요. 비우면 배경음 없음
  bgm: {
    files: ['assets/bgm/1-azure-light.mp3', 'assets/bgm/2-magatia.mp3', 'assets/bgm/3-sleepywood.mp3', 'assets/bgm/4-my-prince-my-kingdom.mp3'],
    volume: 0.4, // 0~1
  },

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
