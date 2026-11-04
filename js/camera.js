// 화면 크기 계산과 세로 카메라
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  // 화면(CSS px)과 기기 픽셀 비율로 캔버스 크기와 정수 픽셀 배율을 정한다.
  // 월드 폭(192 논리 px) 전체가 항상 보이고, 남는 좌우는 나무껍질로 채운다.
  SF.computeViewport = function (cssW, cssH, dpr, cfg) {
    const worldW = cfg.world.cols * cfg.world.cell;
    const controlsH = Math.max(cfg.ui.controlsMinPx, Math.round(cssH * cfg.ui.controlsRatio));
    const gameCssW = cssW;
    const gameCssH = Math.max(1, cssH - controlsH);
    const canvasW = Math.max(1, Math.round(cssW * dpr));
    const canvasH = Math.max(1, Math.round(gameCssH * dpr));
    const zoom = Math.max(1, Math.floor(canvasW / worldW));
    const viewW = canvasW / zoom;
    const viewH = canvasH / zoom;
    return { controlsH, gameCssW, gameCssH, canvasW, canvasH, zoom, viewW, viewH, worldOffsetX: (viewW - worldW) / 2 };
  };

  // top = 화면 위쪽 가장자리의 월드 y. 캐릭터 화면 위치 비율 = (top - centerY) / viewH (0=위, 1=아래)
  SF.createCamera = function (cfg) {
    const C = cfg.camera;
    const vel = { v: 0 };
    const cam = { top: 0, vel };

    function clampToBounds(bounds) {
      cam.top = SF.clamp(cam.top, bounds.minTop, Math.max(bounds.minTop, bounds.maxTop));
    }

    cam.snap = function (centerY, viewH, bounds) {
      cam.top = centerY + C.climbAnchor * viewH;
      vel.v = 0;
      clampToBounds(bounds);
    };

    cam.update = function (centerY, vy, airborne, viewH, dt, bounds) {
      // 빨리 떨어질수록 캐릭터를 화면 위쪽에 둬서 아래를 미리 보여준다
      const t = airborne && vy < 0 ? SF.clamp(-vy / cfg.physics.maxFallSpeed, 0, 1) : 0;
      const anchor = SF.lerp(C.climbAnchor, C.fallAnchor, t);
      cam.top = SF.smoothDamp(cam.top, centerY + anchor * viewH, vel, C.smoothTime, dt);
      const frac = (cam.top - centerY) / viewH;
      if (frac < C.edgeMargin) cam.top = centerY + C.edgeMargin * viewH;
      else if (frac > 1 - C.edgeMargin) cam.top = centerY + (1 - C.edgeMargin) * viewH;
      clampToBounds(bounds);
    };

    return cam;
  };
})(window.SF);
