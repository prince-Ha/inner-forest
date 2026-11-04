// 고를 수 있는 캐릭터: 하치와레·오데 2명 (교육용·비영리 전용).
//   id    : 코드·기록에 쓰는 이름
//   name  : 화면에 보이는 이름. 구글 시트 '말풍선' 탭 '캐릭터' 칸의 글자와 같아야 말투가 연결돼요
//   sheet : 그림 파일 캐릭터. GIF를 dev/gif2sheet.ps1로 펼친 PNG (src), 그림 장수(frames), 한 칸 크기(cell), 한 장 보여 주는 시간(delay, ms)
//   art   : 도트 그림 캐릭터. js/characters-art.js의 그림 이름 (한 장을 흔들어서 움직인다)
//   scale : 그림 1픽셀(또는 도트 1칸)을 게임 안에서 얼마 크기로 그릴지 (클수록 캐릭터가 커요)
//   sink  : (선택) 그림 맨 아래 몇 칸을 발판 속으로 내릴지. 꼬리가 있는 캐릭터가 둥둥 떠 보이지 않게
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  SF.CHARACTERS = [
    { id: 'hachiware', name: '하치와레', sheet: { src: 'assets/hachiware.png', frames: 8, cell: 160, delay: 50 }, scale: 0.2 },
    { id: 'ode', name: '오데', art: 'ode', scale: 0.35 }, // 움직이는 그림이 오면 sheet로 바꾼다
  ];
})(window.SF);
