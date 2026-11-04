// ============================================================
//  과학 인내의 숲 — 구글 시트 연결 (Google Apps Script)
//  쓰는 법 (자세히는 설치안내.md):
//   1) 구글 시트를 새로 만들고 → 확장 프로그램 → Apps Script
//   2) Code.gs 내용을 모두 지우고 이 파일 내용을 통째로 붙여 넣기 → 저장
//   3) 위쪽 함수 고르기에서 setup 을 고르고 ▶ 실행 (처음 한 번, 권한 허용) → 시트에 탭 6개가 생김
//   4) 배포 → 새 배포 → 유형: 웹 앱, 실행: 나, 액세스: 모든 사용자 → 배포 → 웹 앱 URL 복사
//   5) 게임의 config.js 에서 sheet: { url: '여기에 붙여 넣기' }
//  문제·말풍선은 시트에서 고치면 다음 판부터 바로 반영돼요 (다시 배포할 필요 없음).
//  이 파일을 고쳤을 때만: 배포 → 배포 관리 → 수정(연필) → 버전: 새 버전 → 배포
// ============================================================

// 게임 규칙 (게임의 config.js 와 같아야 해요 — 점수를 구글 쪽에서 다시 계산해 장난 기록을 막아요)
var SFS = (function () {
  'use strict';

  var RULES = {
    totalFloors: 600,
    timeLimitSec: 900,
    quiz: { firstFloor: 10, every: 20, count: 30 },
    score: { perFloor: 10, finishBonus: 3000, perSecondLeft: 5, perCorrect: 200, perCombo: 10 },
    minFinishSec: 60, // 600층을 이보다 빨리 완주한 기록은 받지 않아요 (가장 빠른 봇도 70초 넘게 걸림)
    nameMax: 10,
    messageMax: 30,
    maxClass: 30,
  };

  var HEADERS = {
    '문제': ['번호', '문제', '보기A', '보기B', '보기C', '보기D', '정답', '해설', '사용'],
    '말풍선': ['상황', '문구', '사용'],
    '기록': ['기록일시', '학생ID', '이름', '학년', '반', '캐릭터', '최고층', '완주', '등반시간(초)', '전체시간(초)',
      '정답', '오답', '추락', '최고콤보', '점수', '그만둠', '판번호'],
    '랭킹': ['학생ID', '이름', '학년', '반', '캐릭터', '최고층', '완주', '등반시간(초)', '점수', '정답', '완주일시', '기록일시'],
    '한마디': ['번호', '작성일시', '학생ID', '이름', '반', '한마디', '숨김'],
    '설정': ['항목', '값', '설명'],
  };

  // 말풍선 상황 이름 → 게임 안의 이름
  var LINE_KEYS = {
    '출발': 'start', '추락': 'fall', '맞음': 'hit', '바람': 'gust', '돌풍안내': 'gustIntro',
    '콤보10': 'combo10', '콤보30': 'combo30', '콤보50': 'combo50', '완주': 'finish', '시간종료': 'timeup', '과학상식': 'fact',
  };

  var DEFAULT_BAD_WORDS = ['바보', '멍청', '시발', '씨발', 'ㅅㅂ', '개새', '병신', 'ㅂㅅ', '존나', '좆', '꺼져', '닥쳐', '지랄',
    'ㅈㄹ', '새끼', 'fuck', 'shit'];

  var letters = function (s) { return Array.from(String(s)).length; };
  var isInt = function (v) { return typeof v === 'number' && Math.floor(v) === v && isFinite(v); };
  var isNum = function (v) { return typeof v === 'number' && isFinite(v); };

  // 그 층까지 지나는 퀴즈 수 (10·30·50…층)
  function quizzesUpTo(floor) {
    var Q = RULES.quiz;
    if (floor < Q.firstFloor) return 0;
    return Math.min(Q.count, Math.floor((floor - Q.firstFloor) / Q.every) + 1);
  }

  // 점수 (게임의 SF.computeScore 와 같은 공식)
  function scoreOf(r) {
    var S = RULES.score, limit = RULES.timeLimitSec;
    var speed = r.finished && limit > 0 ? Math.floor(Math.max(0, limit - r.climbTime)) * S.perSecondLeft : 0;
    return r.bestFloor * S.perFloor + (r.finished ? S.finishBonus : 0) + speed + r.correct * S.perCorrect + r.maxCombo * S.perCombo;
  }

  // 받을 수 없는 기록이면 그 까닭(한국어), 괜찮으면 null
  function checkRecord(r) {
    if (!r || typeof r !== 'object') return '기록이 비어 있어요';
    if (r.test) return '테스트 기록은 저장하지 않아요';
    if (typeof r.runId !== 'string' || !r.runId || r.runId.length > 64) return '판 번호가 없어요';
    var name = String(r.name || '').trim();
    if (!name || letters(name) > RULES.nameMax) return '이름이 이상해요';
    if (!isInt(r.grade) || r.grade < 1 || r.grade > 6) return '학년이 이상해요';
    if (!isInt(r.classNo) || r.classNo < 1 || r.classNo > RULES.maxClass) return '반이 이상해요';
    if (!isInt(r.bestFloor) || r.bestFloor < 1 || r.bestFloor > RULES.totalFloors) return '층수가 이상해요';
    if (!isNum(r.climbTime) || r.climbTime < 0 || (RULES.timeLimitSec > 0 && r.climbTime > RULES.timeLimitSec + 5)) return '등반 시간이 이상해요';
    if (!isNum(r.totalTime) || r.totalTime < 0) return '전체 시간이 이상해요';
    if (r.finished) {
      if (r.bestFloor !== RULES.totalFloors) return '정상에 닿지 않았는데 완주로 되어 있어요';
      if (r.climbTime < RULES.minFinishSec) return '너무 빨리 완주했어요';
    }
    if (!isInt(r.correct) || !isInt(r.wrong) || r.correct < 0 || r.wrong < 0) return '퀴즈 수가 이상해요';
    if (r.correct + r.wrong > quizzesUpTo(r.bestFloor)) return '오른 층보다 퀴즈를 많이 풀었어요';
    if (!isInt(r.maxCombo) || r.maxCombo < 0 || r.maxCombo > RULES.totalFloors) return '콤보가 이상해요';
    if (!isInt(r.falls) || r.falls < 0) return '추락 수가 이상해요';
    return null;
  }

  // 랭킹: 완주한 쪽 → 점수 높은 쪽 → 등반 시간 짧은 쪽
  function better(a, b) {
    if (!!a.finished !== !!b.finished) return !!a.finished;
    if (a.score !== b.score) return a.score > b.score;
    return a.climbTime < b.climbTime;
  }

  // 금지어 비교용: 띄어쓰기·기호를 빼고 소문자로
  var squash = function (s) { return String(s).replace(/[\s.,!?~\-_*^'"`·•…:;()[\]{}<>/\\|+=@#$%&]+/g, '').toLowerCase(); };

  function cleanMessage(text, badWords) {
    var t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (!t) return { ok: false, reason: '한마디를 적어 주세요.' };
    if (letters(t) > RULES.messageMax) return { ok: false, reason: '한마디는 ' + RULES.messageMax + '글자까지예요.' };
    var flat = squash(t);
    for (var i = 0; i < badWords.length; i++) {
      var w = squash(badWords[i]);
      if (w && flat.indexOf(w) >= 0) return { ok: false, reason: '쓸 수 없는 말이 들어 있어요.' };
    }
    return { ok: true, text: t };
  }

  var off = function (v) {
    var s = String(v == null ? '' : v).trim().toUpperCase();
    return v === false || s === 'X' || s === 'N' || s === 'NO' || s === 'FALSE' || s === '아니오';
  };

  // 문제 탭 → 게임 문제 (정답은 A~D 또는 1~4). 이상한 줄은 건너뜀
  function parseQuestions(rows) {
    var out = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r || off(r[8])) continue;
      var q = String(r[1] == null ? '' : r[1]).trim();
      var choices = [r[2], r[3], r[4], r[5]].map(function (c) { return String(c == null ? '' : c).trim(); });
      var a = String(r[6] == null ? '' : r[6]).trim().toUpperCase();
      var answer = 'ABCD'.indexOf(a);
      if (answer < 0 && /^[1-4]$/.test(a)) answer = Number(a) - 1;
      if (!q || a.length !== 1 || answer < 0 || choices.some(function (c) { return !c; })) continue;
      out.push({ id: String(r[0] == null ? '' : r[0]).trim() || 'row' + (i + 1), q: q, choices: choices, answer: answer,
        explain: String(r[7] == null ? '' : r[7]).trim() });
    }
    return out;
  }

  // 말풍선 탭 → { start: [...], fact: [...], ... }
  function parseLines(rows) {
    var out = {};
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r || off(r[2])) continue;
      var key = LINE_KEYS[String(r[0] == null ? '' : r[0]).trim()];
      var text = String(r[1] == null ? '' : r[1]).trim();
      if (!key || !text) continue;
      (out[key] = out[key] || []).push(text);
    }
    return out;
  }

  // 처음 설치할 때 시트에 넣는 문제·문구 (게임 안 임시 문제·문구와 같음)
  var SEED_QUESTIONS = [
    ["c1","화학 반응 전후에 물질의 총질량이 변하지 않는다는 법칙은?","일정 성분비 법칙","기체 반응 법칙","질량 보존 법칙","보일 법칙","C","반응 전후에 원자의 종류와 개수가 변하지 않아서 총질량이 같아요.","O"],
    ["c2","물을 이루는 수소와 산소의 질량비는?","1 : 8","1 : 16","2 : 1","8 : 1","A","물에서 수소와 산소는 항상 1 : 8의 질량비로 결합해요 (일정 성분비 법칙).","O"],
    ["c3","같은 온도·압력에서 수소 기체 2부피와 산소 기체 1부피가 반응하면 수증기는 몇 부피 생길까?","1부피","3부피","4부피","2부피","D","기체 반응 법칙: 수소 : 산소 : 수증기 = 2 : 1 : 2의 부피비로 반응해요.","O"],
    ["c4","반응할 때 주변으로 열을 내보내 주변 온도가 높아지는 반응은?","흡열 반응","발열 반응","분해 반응","앙금 생성 반응","B","발열 반응은 열을 내보내고, 흡열 반응은 주변의 열을 흡수해요.","O"],
    ["c5","다음 중 주변의 열을 흡수하는 반응을 이용한 것은?","손난로","냉찜질 팩","발열 도시락","연료의 연소","B","냉찜질 팩 속 질산 암모늄이 물에 녹으면서 주변의 열을 흡수해 차가워져요.","O"],
    ["c6","철 가루가 공기 중의 산소와 반응할 때 나오는 열을 이용한 물건은?","냉찜질 팩","드라이아이스","얼음 주머니","손난로","D","손난로는 철이 산소와 반응하는 발열 반응을 이용해요.","O"],
    ["c7","구리 가루를 공기 중에서 가열하면 질량은 어떻게 될까?","늘어난다","줄어든다","변하지 않는다","0이 된다","A","구리가 공기 중의 산소와 결합해 산화 구리(Ⅱ)가 되므로 결합한 산소만큼 질량이 늘어요.","O"],
    ["c8","열린 용기에서 탄산 칼슘과 묽은 염산을 반응시키면 측정한 질량은?","늘어난다","변하지 않는다","줄어든다","두 배가 된다","C","생긴 이산화 탄소 기체가 빠져나가서 줄어요. 닫힌 용기에서는 총질량이 그대로예요.","O"],
    ["w1","높이 올라갈수록 기온이 낮아지고, 대류가 일어나며 구름·비 같은 기상 현상이 나타나는 층은?","성층권","중간권","열권","대류권","D","대류권에는 수증기가 있고 대류가 일어나서 기상 현상이 나타나요.","O"],
    ["w2","오존층이 있어 태양의 자외선을 흡수하는 기권의 층은?","대류권","중간권","성층권","열권","C","성층권의 오존층이 자외선을 흡수해서 높이 올라갈수록 기온이 높아져요.","O"],
    ["w3","공기 덩어리가 위로 올라가면 어떻게 될까?","부피가 작아지고 온도가 높아진다","부피가 커지고 온도가 낮아진다","부피가 커지고 온도가 높아진다","아무 변화가 없다","B","위로 갈수록 기압이 낮아 공기가 팽창하면서 온도가 낮아져요. 이슬점에 이르면 구름이 생겨요.","O"],
    ["w4","공기 중의 수증기가 응결하기 시작하는 온도는?","이슬점","어는점","끓는점","녹는점","A","공기가 이슬점까지 냉각되면 포화 상태가 되어 수증기가 물방울로 응결해요.","O"],
    ["w5","바람이 부는 가장 큰 까닭은?","두 지점 사이의 기압 차이","달의 인력","구름의 이동","바닷물의 짠맛","A","공기는 기압이 높은 곳에서 낮은 곳으로 이동해요. 이것이 바람이에요.","O"],
    ["w6","맑은 날 낮에 바닷가에서 바다에서 육지 쪽으로 부는 바람은?","육풍","해풍","계절풍","편서풍","B","낮에는 육지가 빨리 데워져 기압이 낮아지므로 바다에서 육지로 해풍이 불어요.","O"],
    ["w7","우리나라 겨울 날씨에 큰 영향을 주는 차고 건조한 기단은?","북태평양 기단","오호츠크해 기단","시베리아 기단","양쯔강 기단","C","대륙에서 생긴 시베리아 기단은 차고 건조해서 겨울에 춥고 건조한 날씨를 만들어요.","O"],
    ["w8","찬 공기가 따뜻한 공기 밑으로 파고들 때 생기는 전선은?","온난 전선","정체 전선","폐색 전선","한랭 전선","D","한랭 전선 뒤쪽에는 적운형 구름이 생기고 좁은 지역에 소나기가 내려요.","O"],
    ["w9","북반구의 저기압 중심 부근에서 일어나는 일은?","바람이 시계 방향으로 불어 나가고 하강 기류가 생긴다","바람이 시계 반대 방향으로 불어 들어오고 상승 기류가 생긴다","바람이 시계 방향으로 불어 들어오고 하강 기류가 생긴다","바람이 전혀 불지 않는다","B","저기압 중심에서는 공기가 모여 위로 올라가므로 구름이 생기고 날씨가 흐려요.","O"],
    ["m1","속력과 방향이 변하지 않는 운동은?","자유 낙하 운동","원운동","등속 직선 운동","진자 운동","C","등속 직선 운동은 같은 시간 동안 같은 거리를 이동해요.","O"],
    ["m2","공기 저항이 없을 때 자유 낙하하는 물체의 속력은 1초마다 약 얼마씩 빨라질까?","1 m/s","4.9 m/s","빨라지지 않는다","9.8 m/s","D","자유 낙하하는 물체는 중력 때문에 1초마다 속력이 약 9.8 m/s씩 빨라져요.","O"],
    ["m3","10 N의 힘으로 물체를 힘의 방향으로 2 m 옮겼을 때 한 일은?","20 J","5 J","12 J","0 J","A","일 = 힘 × 힘의 방향으로 이동한 거리 = 10 N × 2 m = 20 J","O"],
    ["m4","질량 2 kg인 물체를 5 m 높이로 들어 올렸을 때 늘어난 위치 에너지는? (g = 9.8 m/s²)","10 J","98 J","49 J","196 J","B","위치 에너지 = 9.8 × 질량 × 높이 = 9.8 × 2 × 5 = 98 J","O"],
    ["m5","물체의 속력이 2배가 되면 운동 에너지는 몇 배가 될까?","4배","2배","같다","1/2배","A","운동 에너지는 속력의 제곱에 비례해요 (½ × 질량 × 속력²).","O"],
    ["m6","가방을 든 채 수평으로 걸어갈 때, 과학에서 말하는 일의 양은?","가방 무게 × 걸은 거리","걸은 시간에 비례한다","가방 무게 ÷ 걸은 거리","0이다","D","드는 힘(위쪽)과 이동 방향(수평)이 수직이어서 과학에서 한 일은 0이에요.","O"],
    ["s1","눈에서 빛을 받아들여 상이 맺히는 곳은?","홍채","수정체","각막","망막","D","망막의 시각 세포가 빛을 받아들이고, 시각 신경을 거쳐 대뇌로 전달돼요.","O"],
    ["s2","밝은 곳에서 어두운 곳으로 가면 동공은 어떻게 될까?","작아진다","변하지 않는다","커진다","없어진다","C","홍채가 줄어들어 동공이 커지면서 더 많은 빛을 받아들여요.","O"],
    ["s3","귀에서 몸이 회전하는 것을 느끼는 곳은?","달팽이관","반고리관","고막","귓속뼈","B","반고리관은 회전을, 전정 기관은 몸의 기울어짐을 느껴요.","O"],
    ["s4","뜨거운 물체에 손이 닿자마자 무의식적으로 손을 떼는 반응의 중추는?","척수","대뇌","소뇌","간뇌","A","척수 반사는 대뇌를 거치지 않아 반응이 매우 빨라요.","O"],
    ["s5","혈당량이 높을 때 이자에서 나와 혈당량을 낮추는 호르몬은?","글루카곤","아드레날린","인슐린","티록신","C","인슐린은 포도당을 글리코젠으로 바꿔 저장하게 해서 혈당량을 낮춰요.","O"],
    ["s6","몸의 균형을 유지하고 근육 운동을 조절하는 뇌는?","대뇌","소뇌","연수","간뇌","B","소뇌는 몸의 자세와 균형을 유지해요.","O"],
    ["g1","생식세포를 만들며, 염색체 수가 체세포의 절반이 되는 세포 분열은?","감수 분열","체세포 분열","이분법","출아법","A","감수 분열로 만든 생식세포가 수정하면 염색체 수가 다시 체세포와 같아져요.","O"],
    ["g2","사람의 체세포 하나에 들어 있는 염색체 수는?","23개","44개","48개","46개","D","사람의 체세포에는 상염색체 44개와 성염색체 2개, 모두 46개가 있어요.","O"],
    ["g3","순종의 둥근 완두(RR)와 주름진 완두(rr)를 교배한 잡종 1대의 모양은?","모두 주름지다","모두 둥글다","둥근 것과 주름진 것이 반반","둥근 것 : 주름진 것 = 3 : 1","B","잡종 1대(Rr)에서는 우성인 둥근 모양만 나타나요 (우열의 원리).","O"],
    ["g4","잡종 1대(Rr) 완두를 자가 수분하면 잡종 2대의 둥근 것과 주름진 것의 비는?","1 : 1","1 : 2 : 1","3 : 1","9 : 3 : 3 : 1","C","RR : Rr : rr = 1 : 2 : 1이고, RR과 Rr은 둥글어서 3 : 1이 돼요.","O"],
    ["g5","사람의 성염색체 구성에서 남자는?","XX","YY","XXY","XY","D","여자는 XX, 남자는 XY예요. 아버지에게서 X를 받으면 딸, Y를 받으면 아들이에요.","O"],
    ["e1","선풍기는 전기 에너지를 주로 어떤 에너지로 바꿀까?","화학 에너지","운동 에너지","핵에너지","위치 에너지","B","선풍기 모터는 전기 에너지를 날개를 돌리는 운동 에너지로 바꿔요.","O"],
    ["e2","소비 전력이 100 W인 전구를 2시간 켰을 때의 전력량은?","50 Wh","102 Wh","100 Wh","200 Wh","D","전력량 = 전력 × 시간 = 100 W × 2 h = 200 Wh","O"],
    ["e3","발전기는 어떤 현상을 이용해 전기를 만들까?","전자기 유도","정전기 유도","빛의 굴절","열의 전도","A","코일 주변에서 자석을 움직이면 코일에 전류가 흘러요 (전자기 유도).","O"],
    ["u1","지구가 공전하기 때문에 생기는, 별의 시차의 1/2을 무엇이라고 할까?","일주 운동","겉보기 등급","연주 시차","광년","C","연주 시차가 클수록 별까지의 거리가 가까워요.","O"],
    ["u2","별의 등급이 1등급 차이 나면 밝기는 약 몇 배 차이 날까?","약 2.5배","약 10배","약 100배","약 1.5배","A","1등급 차이는 약 2.5배, 5등급 차이는 100배의 밝기 차이예요.","O"],
    ["u3","표면 온도가 가장 높은 별의 색은?","적색","황색","주황색","청색","D","별은 표면 온도가 높을수록 청색, 낮을수록 적색을 띠어요.","O"],
  ];

  var SEED_LINES = [
    ['출발', '가 보자!'], ['출발', '정상까지 가즈아!'], ['출발', '오늘은 꼭 완주!'],
    ['추락', '으악!'], ['추락', '괜찮아, 다시!'], ['추락', '중력은 정직해…'], ['추락', '떨어지는 것도 과학이야'],
    ['맞음', '아야!'], ['맞음', '앗, 맞았다!'], ['맞음', '타이밍을 노려!'], ['맞음', '조심조심…'],
    ['바람', '바람에 날아간다~'], ['바람', '멈추면 안 됐는데!'], ['바람', '휘이잉~'], ['바람', '바람이 세다!'],
    ['돌풍안내', '돌풍 구간! 바람 불 땐 멈추지 마!'],
    ['콤보10', '좋아, 리듬 탔어!'], ['콤보30', '손이 안 보여!'], ['콤보50', '전설의 등반가!'],
    ['완주', '정상이다!'], ['시간종료', '시간이 다 됐어!'],
    ['과학상식', '빛은 1초에 약 30만 km를 가요'], ['과학상식', '물은 1기압에서 100℃에 끓어요'],
    ['과학상식', '소리는 진공에서 전달되지 않아요'], ['과학상식', '식물은 광합성으로 산소를 내보내요'],
    ['과학상식', '지구 표면의 약 70%는 물이에요'], ['과학상식', '모든 물질은 원자로 이루어져 있어요'],
    ['과학상식', 'DNA는 이중 나선 구조예요'], ['과학상식', '지구는 약 24시간에 한 바퀴 자전해요'],
    ['과학상식', '달은 스스로 빛을 내지 않아요'], ['과학상식', '얼음은 물보다 밀도가 작아 물에 떠요'],
    ['과학상식', '공기의 약 78%는 질소예요'], ['과학상식', '자석의 같은 극끼리는 밀어내요'],
    ['과학상식', '혈액은 온몸에 산소를 날라요'], ['과학상식', '나무는 물관으로 물을 끌어올려요'],
    ['과학상식', '높이 오를수록 위치 에너지가 커져요'], ['과학상식', '떨어지는 물체는 점점 빨라져요'],
    ['과학상식', '태양은 스스로 빛을 내는 별이에요'], ['과학상식', '번개는 구름 속 전기가 방전되는 현상이에요'],
    ['과학상식', '바람은 기압이 높은 곳에서 낮은 곳으로 불어요'],
  ].map(function (r) { return [r[0], r[1], 'O']; });

  return {
    RULES: RULES, HEADERS: HEADERS, LINE_KEYS: LINE_KEYS, DEFAULT_BAD_WORDS: DEFAULT_BAD_WORDS,
    quizzesUpTo: quizzesUpTo, scoreOf: scoreOf, checkRecord: checkRecord, better: better,
    cleanMessage: cleanMessage, parseQuestions: parseQuestions, parseLines: parseLines,
    SEED_QUESTIONS: SEED_QUESTIONS, SEED_LINES: SEED_LINES,
  };
})();

// ============================================================ 시트 다루기
function sheet_(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }
function rows_(name) { var sh = sheet_(name); return sh ? sh.getDataRange().getValues() : []; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function iso_(v) { return v instanceof Date ? v.toISOString() : String(v == null ? '' : v); }
function yes_(v) { return v === true || String(v).trim().toUpperCase() === 'TRUE' || String(v).trim().toUpperCase() === 'O'; }

// 설정 탭: 비밀번호, 금지어
function settings_() {
  var out = { password: '6666', badWords: SFS.DEFAULT_BAD_WORDS };
  rows_('설정').slice(1).forEach(function (r) {
    var k = String(r[0]).trim(), v = String(r[1] == null ? '' : r[1]).trim();
    if (k === '비밀번호' && v) out.password = v;
    if (k === '금지어') out.badWords = v.split(',').map(function (w) { return w.trim(); }).filter(Boolean);
  });
  return out;
}

// 처음 한 번 실행: 탭 6개와 머리줄, 임시 문제 40개·말풍선 문구·설정을 넣는다 (다시 실행해도 있는 내용은 그대로)
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SFS.HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(SFS.HEADERS[name]);
      sh.setFrozenRows(1);
    }
  });
  var seed = function (name, rows) {
    var sh = ss.getSheetByName(name);
    if (sh.getLastRow() === 1 && rows.length) sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  };
  seed('문제', SFS.SEED_QUESTIONS);
  seed('말풍선', SFS.SEED_LINES);
  seed('설정', [
    ['비밀번호', '6666', '선생님 모드 비밀번호 (게임 config.js의 teacher.password와 같게)'],
    ['금지어', SFS.DEFAULT_BAD_WORDS.join(','), '쉼표로 구분. 한마디에 이 말이 들어 있으면 막아요'],
  ]);
}

// 랭킹 탭 한 줄 ↔ 기록
var RANK_COLS = 12;
function rankRow_(r, finishedAt, now) {
  return [r.id, r.name, r.grade, r.classNo, r.charId, r.bestFloor, r.finished, r.climbTime, r.score, r.correct, finishedAt || '', now];
}
function rankObj_(row) {
  return { id: String(row[0]), name: String(row[1]), grade: Number(row[2]), classNo: Number(row[3]), charId: String(row[4]),
    bestFloor: Number(row[5]), finished: yes_(row[6]), climbTime: Number(row[7]), score: Number(row[8]), correct: Number(row[9]),
    finishedAt: iso_(row[10]) };
}
function sortedRanking_() {
  return rows_('랭킹').slice(1).filter(function (r) { return r[0]; }).map(rankObj_)
    .sort(function (a, b) { return SFS.better(a, b) ? -1 : SFS.better(b, a) ? 1 : 0; });
}

// 한 판 기록 저장: 기록 탭에 한 줄, 랭킹 탭은 더 좋을 때만 바꿈. 같은 판번호는 한 번만
function saveRecord_(rec) {
  var err = SFS.checkRecord(rec);
  if (err) return { ok: false, error: err };
  var cache = CacheService.getScriptCache();
  if (cache.get('run:' + rec.runId)) return { ok: true, duplicate: true };
  var r = {};
  Object.keys(rec).forEach(function (k) { r[k] = rec[k]; });
  r.name = String(rec.name).trim();
  r.score = SFS.scoreOf(r); // 점수는 다시 계산 (게임이 보낸 점수는 믿지 않음)
  var now = new Date();
  sheet_('기록').appendRow([now, r.id, r.name, r.grade, r.classNo, r.charId, r.bestFloor, r.finished, r.climbTime, r.totalTime,
    r.correct, r.wrong, r.falls, r.maxCombo, r.score, !!r.quit, r.runId]);
  var sh = sheet_('랭킹');
  var rows = sh.getDataRange().getValues();
  var at = -1;
  for (var i = 1; i < rows.length; i++) if (String(rows[i][0]) === r.id) { at = i; break; }
  var best = false;
  if (at < 0) {
    sh.appendRow(rankRow_(r, r.finished ? now : '', now));
    best = true;
  } else {
    var old = rankObj_(rows[at]);
    if (SFS.better(r, old)) {
      // 완주일시는 처음 완주한 날을 남긴다 (완주자 목록용)
      var firstFinish = old.finished ? rows[at][10] : (r.finished ? now : '');
      sh.getRange(at + 1, 1, 1, RANK_COLS).setValues([rankRow_(r, firstFinish, now)]);
      best = true;
    }
  }
  cache.put('run:' + rec.runId, '1', 21600);
  var ranking = sortedRanking_();
  var school = 0, cls = 0, inClass = 0;
  for (var j = 0; j < ranking.length; j++) {
    if (ranking[j].classNo === r.classNo) inClass++;
    if (ranking[j].id === r.id) { school = j + 1; cls = inClass; break; }
  }
  return { ok: true, best: best, score: r.score, rank: { school: school, class: cls, total: ranking.length } };
}

// 완주자 한마디: 랭킹에서 완주로 되어 있어야, 학생마다 하나 (새로 쓰면 바뀜, 선생님이 숨긴 것은 못 바꿈)
function saveMessage_(m) {
  var id = String(m.id || '');
  var me = sortedRanking_().filter(function (r) { return r.id === id; })[0];
  if (!me || !me.finished) return { ok: false, error: '완주한 학생만 한마디를 남길 수 있어요.' };
  var c = SFS.cleanMessage(m.text, settings_().badWords);
  if (!c.ok) return { ok: false, error: c.reason };
  var sh = sheet_('한마디');
  var rows = sh.getDataRange().getValues();
  var at = -1, maxNo = 0;
  for (var i = 1; i < rows.length; i++) {
    maxNo = Math.max(maxNo, Number(rows[i][0]) || 0);
    if (String(rows[i][2]) === id) at = i;
  }
  if (at >= 0 && yes_(rows[at][6])) return { ok: false, error: '선생님이 숨긴 한마디가 있어서 새로 쓸 수 없어요.' };
  var row = [at >= 0 ? rows[at][0] : maxNo + 1, new Date(), id, me.name, me.classNo, c.text, ''];
  if (at >= 0) sh.getRange(at + 1, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
  return { ok: true };
}

function messages_(includeHidden) {
  return rows_('한마디').slice(1).filter(function (r) { return r[0] && (includeHidden || !yes_(r[6])); })
    .map(function (r) { return { no: Number(r[0]), date: iso_(r[1]), name: String(r[3]), classNo: Number(r[4]), text: String(r[5]), hidden: yes_(r[6]) }; })
    .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
}

function handle_(action, body) {
  var teacher = function () { return String(body.password == null ? '' : body.password).trim() === settings_().password; };
  switch (action) {
    case 'bootstrap':
      return { ok: true, questions: SFS.parseQuestions(rows_('문제')), lines: SFS.parseLines(rows_('말풍선')) };
    case 'board':
      return { ok: true, ranking: sortedRanking_(), messages: messages_(false).slice(0, 100) };
    case 'record':
      return saveRecord_(body.record);
    case 'message':
      return saveMessage_(body);
    case 'finishers':
      if (!teacher()) return { ok: false, error: '비밀번호가 달라요.' };
      return { ok: true, finishers: sortedRanking_().filter(function (r) { return r.finished; })
        .sort(function (a, b) { return a.classNo - b.classNo || (a.finishedAt < b.finishedAt ? -1 : 1); }) };
    case 'messages':
      if (!teacher()) return { ok: false, error: '비밀번호가 달라요.' };
      return { ok: true, messages: messages_(true) };
    case 'hide': {
      if (!teacher()) return { ok: false, error: '비밀번호가 달라요.' };
      var sh = sheet_('한마디');
      var rows = sh.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (Number(rows[i][0]) === Number(body.no)) { sh.getRange(i + 1, 7).setValue('O'); return { ok: true }; }
      }
      return { ok: false, error: '그 한마디를 찾지 못했어요.' };
    }
    default:
      return { ok: false, error: '모르는 요청이에요: ' + action };
  }
}

// 읽기 (문제·말풍선·보드): 주소 뒤 ?action=bootstrap 또는 ?action=board
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (action !== 'bootstrap' && action !== 'board') return json_({ ok: false, error: '읽을 수 있는 것은 bootstrap, board 예요.' });
  try { return json_(handle_(action, {})); } catch (err) { return json_({ ok: false, error: String(err) }); }
}

// 쓰기 (기록·한마디·선생님 기능): 본문 JSON. 비밀번호는 주소가 아니라 본문으로 받는다
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse(e.postData.contents);
    lock.waitLock(10000);
    return json_(handle_(body.action, body));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) { /* 잠그지 못했으면 풀 것도 없음 */ }
  }
}
