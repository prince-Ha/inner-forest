// 완주 증명서: 글자(테스트 가능)와 그림(캔버스 600×840 → 사진으로 저장)
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  const W = 600, H = 840;
  const FONT = 'system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const mmss = (t) => { const s = Math.max(0, Math.floor(t + 1e-6)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  // d = { name, grade, classNo, floors, date(Date), climbTime(초), score, correct, total, test }
  // 순서: [제목, 부제, 이름, 학년·반, 기록, 문장, 날짜, (테스트 표시)]
  SF.certificateLines = function (d) {
    const date = d.date.getFullYear() + '년 ' + (d.date.getMonth() + 1) + '월 ' + d.date.getDate() + '일';
    const lines = [
      '완주 증명서',
      '과학 인내의 숲 ' + d.floors + '층',
      d.name,
      d.grade + '학년 ' + d.classNo + '반',
      '등반 ' + mmss(d.climbTime) + ' · 퀴즈 ' + d.correct + '/' + d.total + ' · 점수 ' + d.score.toLocaleString('ko-KR'),
      '위 학생은 거대한 나무 속 ' + d.floors + '층을 끝까지 올라 과학 인내의 숲을 완주했음을 증명합니다.',
      date,
    ];
    if (d.test) lines.push('테스트 기록 (기록 안 남음)');
    return lines;
  };

  // 폭 maxW에 맞게 단어 단위로 줄바꿈
  function wrap(ctx, text, maxW) {
    const out = [''];
    for (const w of text.split(' ')) {
      const t = out[out.length - 1] ? out[out.length - 1] + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && out[out.length - 1]) out.push(w);
      else out[out.length - 1] = t;
    }
    return out;
  }

  SF.drawCertificate = function (d, sprites) {
    const [title, sub, name, cls, record, sentence, date, testLine] = SF.certificateLines(d);
    const cnv = document.createElement('canvas');
    cnv.width = W;
    cnv.height = H;
    const ctx = cnv.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // 종이와 두 겹 테두리, 모서리 나뭇잎
    ctx.fillStyle = '#fff8e7';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(16, 16, W - 32, 10); ctx.fillRect(16, H - 26, W - 32, 10);
    ctx.fillRect(16, 16, 10, H - 32); ctx.fillRect(W - 26, 16, 10, H - 32);
    ctx.fillStyle = '#e6b54a';
    ctx.fillRect(34, 34, W - 68, 4); ctx.fillRect(34, H - 38, W - 68, 4);
    ctx.fillRect(34, 34, 4, H - 68); ctx.fillRect(W - 38, 34, 4, H - 68);
    for (const [x, y] of [[30, 30], [W - 54, 30], [30, H - 54], [W - 54, H - 54]]) {
      ctx.fillStyle = '#4f8f2e'; ctx.fillRect(x, y, 24, 24);
      ctx.fillStyle = '#86c94f'; ctx.fillRect(x + 6, y + 6, 12, 12);
    }

    const center = (text, y, size, color, weight) => {
      ctx.font = (weight || 'bold') + ' ' + size + 'px ' + FONT;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, W / 2, y);
    };
    center(title, 120, 54, '#5c3c12');
    center(sub, 166, 24, '#8a5a2b');

    // 고른 캐릭터를 크게 (도트 그대로 8배)
    const who = (sprites.characters && sprites.characters[d.charId]) || sprites.player;
    const img = who.right.idle[0];
    ctx.fillStyle = '#f3e3bf';
    ctx.fillRect(W / 2 - 92, 192, 184, 220);
    ctx.drawImage(img, W / 2 - 64, 206, 128, 192);

    center(name, 476, 44, '#3a2210');
    center(cls, 516, 24, '#5c3c12', '600');
    center(record, 566, 22, '#8a5a2b', '600');
    ctx.font = '22px ' + FONT;
    wrap(ctx, sentence, W - 140).forEach((l, i) => center(l, 626 + i * 34, 22, '#3a2210', 'normal'));
    center(date, 744, 24, '#3a2210', '600');
    center('과학 인내의 숲', 786, 22, '#5c3c12');

    // 도장
    ctx.strokeStyle = '#c8322b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(W / 2 + 140, 776, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillStyle = '#c8322b';
    ctx.textBaseline = 'middle';
    ctx.fillText('완주', W / 2 + 140, 777);

    if (testLine) {
      // 테스트 기록은 크게 비스듬히 표시 (진짜 증명서로 쓰이지 않게)
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-0.4);
      ctx.font = 'bold 96px ' + FONT;
      ctx.fillStyle = 'rgba(200, 50, 43, 0.28)';
      ctx.textBaseline = 'middle';
      ctx.fillText('테스트', 0, 0);
      ctx.restore();
      center(testLine, 70, 18, '#c8322b');
    }
    return cnv;
  };
})(window.SF);
