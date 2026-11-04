// 고를 수 있는 캐릭터: 하치와레·오데 2명 (교육용·비영리 전용). 그림은 assets/ 의 PNG 시트 (원본 GIF·그림을 dev/ 도구로 오려 낸 것)
//   id    : 코드·기록에 쓰는 이름
//   name  : 화면에 보이는 이름. 구글 시트 '말풍선' 탭 '캐릭터' 칸의 글자와 같아야 말투가 연결돼요
//   sheet : src 그림 파일, frames 그림 장수(한 줄), cell 한 칸 크기(px), delay 한 장 보여 주는 시간(ms)
//           moves: 동작별 [칸 번호, 가로 배율, 세로 배율, 기울기(도), 위로 뜨는 px]. 안 적은 동작은 모든 칸을 차례로
//   scale : 그림 1픽셀을 게임 안에서 얼마 크기로 그릴지 (클수록 캐릭터가 커요). 부딪히는 범위는 그림 크기와 상관없이 같아요
//   sink  : (선택) 그림 맨 아래 몇 픽셀을 발판 속으로 내릴지. 꼬리가 있는 캐릭터가 둥둥 떠 보이지 않게
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  // 그림 한 장으로 움직이기: 서 있을 때 들썩, 옆으로 갈 때 기울기, 오를 때 펄쩍, 떨어질 때 좌우로 기울기, 착지하면 눌림
  // (두 캐릭터가 같은 움직임이라 좌우 방향만 다르게 보인다)
  const STILL = (frame) => ({
    idle: [[frame, 1, 1, 0, 0], [frame, 1.05, 0.95, 0, 0]],
    walk: [[frame, 1, 1, -6, 0], [frame, 1, 1, 6, 0]],
    step: [[frame, 0.95, 1.1, 0, 10]],
    fall: [[frame, 1, 1.03, -8, 0], [frame, 1, 1.03, 8, 0]],
    land: [[frame, 1.1, 0.86, 0, 0]],
  });

  SF.CHARACTERS = [
    // 춤추는 GIF 8장 중 첫 장만 쓴다 (전부 돌리면 깜빡여서 정신없다)
    { id: 'hachiware', name: '하치와레', scale: 0.2, sheet: { src: 'assets/hachiware.png', frames: 8, cell: 160, delay: 350, moves: STILL(0) } },
    // 쪼그려 앉은 그림 1장
    { id: 'ode', name: '오데', scale: 0.125, sheet: { src: 'assets/ode.png', frames: 1, cell: 200, delay: 350, moves: STILL(0) } },
  ];
})(window.SF);
