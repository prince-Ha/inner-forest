// 시드 난수 (mulberry32). 같은 시드 → 항상 같은 수열 → 모든 학생이 같은 맵
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  SF.makeRng = function (seed) {
    let a = seed >>> 0;
    function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next,
      int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
      chance: (p) => next() < p,
      pick: (arr) => arr[Math.floor(next() * arr.length)],
    };
  };
})(window.SF);
