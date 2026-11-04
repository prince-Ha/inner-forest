// 말풍선 문구: 상황별 한마디 + 20층마다 짧은 과학 상식 (한 판에서 겹치지 않게)
// 구글 시트 '말풍선' 탭의 문구가 오면 SF.applyTalkLines로 바꿔 끼운다 (없는 상황은 아래 기본 문구)
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  // 기본 문구. 시트의 상황 이름: 출발 start, 추락 fall, 맞음 hit, 바람 gust, 돌풍안내 gustIntro,
  // 콤보10·30·50 combo10·30·50, 완주 finish, 시간종료 timeup, 과학상식 fact
  SF.TALK_DEFAULTS = {
    start: ['가 보자!', '정상까지 가즈아!', '오늘은 꼭 완주!'],
    fall: ['으악!', '괜찮아, 다시!', '중력은 정직해…', '떨어지는 것도 과학이야'],
    hit: ['아야!', '앗, 맞았다!', '타이밍을 노려!', '조심조심…'],
    gust: ['바람에 날아간다~', '멈추면 안 됐는데!', '휘이잉~', '바람이 세다!'],
    gustIntro: ['돌풍 구간! 바람 불 땐 멈추지 마!'],
    combo10: ['좋아, 리듬 탔어!'],
    combo30: ['손이 안 보여!'],
    combo50: ['전설의 등반가!'],
    finish: ['정상이다!'],
    timeup: ['시간이 다 됐어!'],
    fact: [
      '빛은 1초에 약 30만 km를 가요',
      '물은 1기압에서 100℃에 끓어요',
      '소리는 진공에서 전달되지 않아요',
      '식물은 광합성으로 산소를 내보내요',
      '지구 표면의 약 70%는 물이에요',
      '모든 물질은 원자로 이루어져 있어요',
      'DNA는 이중 나선 구조예요',
      '지구는 약 24시간에 한 바퀴 자전해요',
      '달은 스스로 빛을 내지 않아요',
      '얼음은 물보다 밀도가 작아 물에 떠요',
      '공기의 약 78%는 질소예요',
      '자석의 같은 극끼리는 밀어내요',
      '혈액은 온몸에 산소를 날라요',
      '나무는 물관으로 물을 끌어올려요',
      '높이 오를수록 위치 에너지가 커져요',
      '떨어지는 물체는 점점 빨라져요',
      '태양은 스스로 빛을 내는 별이에요',
      '번개는 구름 속 전기가 방전되는 현상이에요',
      '바람은 기압이 높은 곳에서 낮은 곳으로 불어요',
    ],
  };

  let lines = SF.TALK_DEFAULTS;
  // 시트 문구로 바꾸기: 문구가 있는 상황만 바꾸고 나머지는 기본. null이면 기본으로 되돌림
  SF.applyTalkLines = function (custom) {
    const next = {};
    for (const k in SF.TALK_DEFAULTS) {
      const v = custom && custom[k];
      next[k] = Array.isArray(v) && v.some((s) => typeof s === 'string' && s.trim())
        ? v.filter((s) => typeof s === 'string' && s.trim()) : SF.TALK_DEFAULTS[k];
    }
    lines = next;
  };

  SF.createTalk = function (rng) {
    const r = rng || SF.makeRng((Math.random() * 4294967296) >>> 0);
    const facts = lines.fact.slice();
    for (let i = facts.length - 1; i > 0; i--) {
      const j = Math.floor(r.next() * (i + 1));
      [facts[i], facts[j]] = [facts[j], facts[i]];
    }
    const now = lines;
    let next = 0;
    return {
      fact() { return facts[next++ % facts.length]; },
      line(kind, n) {
        const list = kind === 'combo' ? now['combo' + n] : now[kind];
        return list && list.length ? r.pick(list) : null;
      },
    };
  };
})(window.SF);
