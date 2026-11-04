// 과학 퀴즈 (설계 문서 2026-10-15 §4): 퀴즈 층, 한 판의 문제 순서, 답하기
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  // 퀴즈가 나오는 층: firstFloor부터 every층마다 count개 (정상 층과 그 위는 뺀다)
  SF.quizFloors = function (cfg) {
    const Q = cfg.quiz;
    const out = [];
    if (!Q) return out;
    for (let i = 0; i < Q.count; i++) {
      const f = Q.firstFloor + Q.every * i;
      if (f >= cfg.totalFloors) break;
      out.push(f);
    }
    return out;
  };

  function shuffled(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 한 판의 퀴즈: 문제은행을 섞어 퀴즈 층 수만큼 줄 세운다 (모자라면 다 쓴 뒤 다시 섞어 잇는다)
  SF.createQuizRun = function (bank, cfg, rng) {
    const need = SF.quizFloors(cfg).length;
    const order = [];
    while (bank.length && order.length < need) order.push(...shuffled(bank, rng));
    order.length = Math.min(order.length, need);
    return { order, next: 0, done: new Set(), correct: 0, wrong: 0, total: need };
  };

  // 이 층이 아직 안 푼 퀴즈 층이면 낼 문제, 아니면 null (답하기 전까지는 같은 문제)
  SF.quizAt = function (run, cfg, floor) {
    if (run.done.has(floor) || run.next >= run.order.length) return null;
    return SF.quizFloors(cfg).includes(floor) ? run.order[run.next] : null;
  };

  // 게임에서 지금 퀴즈를 낼까: 발이 땅에 닿아 서 있고(뛰는 중·떨어지는 중이 아님) 그 높이가 안 푼 퀴즈 층일 때
  SF.shouldAskQuiz = function (run, cfg, p, st) {
    if (!p.grounded || st.mode !== 'idle') return null;
    return SF.quizAt(run, cfg, SF.floorAt(p.y));
  };
  // 퀴즈를 열 때: 뛰던 중 눌러 둔 입력은 버린다 (퀴즈를 건너뛰고 지나가지 않게)
  SF.openQuiz = function (st) {
    st.queue.length = 0;
  };

  // 답하기: 그 층은 다시 안 나오고, 다음 문제로
  SF.answerQuiz = function (run, floor, choice) {
    const q = run.order[run.next];
    const correct = choice === q.answer;
    run.done.add(floor);
    run.next++;
    if (correct) run.correct++; else run.wrong++;
    return { correct, answer: q.answer, explain: q.explain };
  };
})(window.SF);
