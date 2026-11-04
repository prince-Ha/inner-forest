// 고를 수 있는 캐릭터: 하치와레·오데 2명 (교육용·비영리 전용).
// 그림은 원본을 도트로 옮긴 js/characters-art.js에 있고, 여기서는 이름과 크기만 정한다.
//   id    : 코드·기록에 쓰는 이름
//   name  : 화면에 보이는 이름. 구글 시트 '말풍선' 탭 '캐릭터' 칸의 글자와 같아야 말투가 연결돼요
//   art   : characters-art.js의 그림 이름
//   scale : 도트 한 칸을 게임 안에서 얼마 크기로 그릴지 (클수록 캐릭터가 커요)
//   sink  : (선택) 그림 맨 아래 몇 칸을 발판 속으로 내릴지. 꼬리가 있는 캐릭터가 둥둥 떠 보이지 않게
// 걷기·오르기·떨어지기 같은 움직임은 sprites.js가 한 장의 그림을 살짝 기울이고 눌러서 만든다.
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  SF.CHARACTERS = [
    { id: 'hachiware', name: '하치와레', art: 'hachiware', scale: 0.35, sink: 7 }, // 꼬리는 발판 앞으로 내려가게
    { id: 'ode', name: '오데', art: 'ode', scale: 0.35 },
  ];
})(window.SF);
