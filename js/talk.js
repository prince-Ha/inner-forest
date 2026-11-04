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

  // 캐릭터마다 말투가 다른 기본 문구 (시트 '말풍선' 탭 캐릭터 칸에 같은 내용이 들어 있어요). 적지 않은 상황은 위 공통 문구를 써요
  SF.TALK_CHAR_DEFAULTS = {
    hachiware: {
      start: ['좋아, 가보자!', '두근두근 출발이야!', '오늘도 힘내자!'],
      fall: ['으앗! 괜찮아 괜찮아!', '다시 올라가면 돼!', '떨어졌지만 웃자!', '앗, 중력이다~'],
      hit: ['아야야!', '앗, 깜짝이야!', '조심조심~'],
      gust: ['바람이 휘잉~!', '날아가겠다~!', '꽉 붙잡아!'],
      gustIntro: ['앗, 돌풍 구간이야! 멈추지 말고 가자!'],
      combo10: ['좋아 좋아, 리듬 탔어!'],
      combo30: ['우와, 손이 안 보여!'],
      combo50: ['전설의 등반가다!'],
      finish: ['해냈다! 정상이야!'],
      timeup: ['앗, 시간이 다 됐어!'],
    },
    ode: {
      start: ['오데, 간다!', '오데 올라간다!', '오데 힘 세다!'],
      fall: ['으어어! 떨어졌다!', '오데 안 아프다!', '다시 간다, 오데!'],
      hit: ['아얏! 오데 맞았다!', '오데 아프다…', '저건 뭐야!'],
      gust: ['바람 세다, 오데 날아간다!', '으아아, 휘잉!'],
      gustIntro: ['바람 분다! 오데 꽉 잡는다!'],
      combo10: ['오데 신난다!'],
      combo30: ['오데 빠르다!'],
      combo50: ['오데가 제일 세다!'],
      finish: ['오데 해냈다! 꼭대기다!'],
      timeup: ['오데 아직 더 오르고 싶다!'],
    },
    adventurer: {
      start: ['모험 시작!', '퀘스트 수락. 목표는 600층!', '오늘 정상 찍고 간다.'],
      fall: ['윽, 체력 -10', '리스폰. 다시 간다.', '이 정도 추락은 경험치지.'],
      hit: ['크윽, 데미지!', '방심했다…', '패턴 외웠다. 다음엔 안 맞아.'],
      gust: ['바람 디버프!', '버텨, 버텨!'],
      gustIntro: ['돌풍 구간 진입. 멈추면 밀린다!'],
      combo10: ['콤보 10! 몸이 풀렸다.'],
      combo30: ['콤보 30! 레벨 업 느낌!'],
      combo50: ['콤보 50! 전설 등급 달성!'],
      finish: ['퀘스트 완료! 600층 클리어!'],
      timeup: ['시간 초과… 다음 판엔 꼭 클리어.'],
    },
  };

  let lines = SF.TALK_DEFAULTS;
  let charLines = SF.TALK_CHAR_DEFAULTS;
  const clean = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.trim()) : []);
  // 시트 문구로 바꾸기: 문구가 있는 상황만 바꾸고 나머지는 기본. null이면 기본으로 되돌림
  //   custom   = { 상황: [문구…] }  공통 문구
  //   byChar   = { 캐릭터id: { 상황: [문구…] } }  캐릭터별 문구 (그 캐릭터가 없는 상황은 공통 문구를 씀)
  SF.applyTalkLines = function (custom, byChar) {
    const next = {};
    for (const k in SF.TALK_DEFAULTS) {
      const v = clean(custom && custom[k]);
      next[k] = v.length ? v : SF.TALK_DEFAULTS[k];
    }
    lines = next;
    const nc = {};
    for (const id of new Set(Object.keys(SF.TALK_CHAR_DEFAULTS).concat(Object.keys(byChar || {})))) {
      nc[id] = {};
      // 시트에 그 캐릭터 문구가 하나라도 있으면 시트 내용만(없는 상황은 공통 문구),
      // 하나도 없으면(시트가 없거나 새 캐릭터라 아직 setup을 안 돌린 시트) 기본 말투
      const fromSheet = !!byChar && !!byChar[id] && Object.keys(byChar[id]).some((k) => clean(byChar[id][k]).length);
      for (const k in SF.TALK_DEFAULTS) {
        const v = clean(byChar && byChar[id] && byChar[id][k]);
        const fallback = fromSheet ? [] : clean(SF.TALK_CHAR_DEFAULTS[id] && SF.TALK_CHAR_DEFAULTS[id][k]);
        nc[id][k] = v.length ? v : fallback;
      }
    }
    charLines = nc;
  };

  // charId를 주면 그 캐릭터 말투를 우선으로
  SF.createTalk = function (rng, charId) {
    const r = rng || SF.makeRng((Math.random() * 4294967296) >>> 0);
    const mine = (charId && charLines[charId]) || {};
    const pickList = (kind) => (mine[kind] && mine[kind].length ? mine[kind] : lines[kind]);
    const facts = pickList('fact').slice();
    for (let i = facts.length - 1; i > 0; i--) {
      const j = Math.floor(r.next() * (i + 1));
      [facts[i], facts[j]] = [facts[j], facts[i]];
    }
    let next = 0;
    return {
      fact() { return facts[next++ % facts.length]; },
      line(kind, n) {
        const list = pickList(kind === 'combo' ? 'combo' + n : kind);
        return list && list.length ? r.pick(list) : null;
      },
    };
  };
})(window.SF);
