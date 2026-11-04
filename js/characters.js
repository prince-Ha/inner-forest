// 고를 수 있는 캐릭터: 하치와레·오데 2명 (교육용·비영리 전용). 그림은 assets/ 의 PNG 시트 (원본 GIF·그림을 dev/ 도구로 오려 낸 것)
//   id    : 코드·기록에 쓰는 이름
//   name  : 화면에 보이는 이름. 구글 시트 '말풍선' 탭 '캐릭터' 칸의 글자와 같아야 말투가 연결돼요
//   sheet : src 그림 파일, frames 그림 장수(한 줄), cell 한 칸 크기(px), delay 한 장 보여 주는 시간(ms)
//           moves (선택): 동작별 [칸 번호, 가로 배율, 세로 배율, 기울기(도), 위로 뜨는 px]. 안 적은 동작은 모든 칸을 차례로
//   scale : 그림 1픽셀을 게임 안에서 얼마 크기로 그릴지 (클수록 캐릭터가 커요)
//   sink  : (선택) 그림 맨 아래 몇 픽셀을 발판 속으로 내릴지. 꼬리가 있는 캐릭터가 둥둥 떠 보이지 않게
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  SF.CHARACTERS = [
    // 춤추는 GIF 8장: 서 있을 때 GIF처럼 돌고, 오를 때도 그 동작으로
    { id: 'hachiware', name: '하치와레', sheet: { src: 'assets/hachiware.png', frames: 8, cell: 160, delay: 50 }, scale: 0.2 },
    // 쪼그려 앉은 그림 1장: 서 있을 때 들썩이고, 오를 때 펄쩍 뛰고, 떨어지면 기울고, 착지하면 눌린다
    { id: 'ode', name: '오데', scale: 0.16, sheet: {
      src: 'assets/ode.png', frames: 1, cell: 200, delay: 350,
      moves: {
        idle: [[0, 1, 1, 0, 0], [0, 1.05, 0.95, 0, 0]],
        walk: [[0, 1, 1, -6, 0], [0, 1, 1, 6, 0]],
        step: [[0, 0.95, 1.1, 0, 10]],
      },
    } },
  ];
})(window.SF);
