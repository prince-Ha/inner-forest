// 개발용: 배경이 있는 그림에서 노란 캐릭터(오데)만 오려 내 투명 PNG 조각을 만든다 (브라우저 콘솔에서 실행, 게임에는 안 들어감)
//   await SF_DEV.cutout('dev/src/ode-jump.png', { pad: 6 })  → { canvas, w, h }
//   방법: 노랑·갈색(옷)·흰색(눈)·살구(입) 같은 '몸 색'을 찾고, 그 둘레 몇 픽셀 안의 어두운 픽셀(테두리)을 합친 뒤,
//         가장 큰 덩어리 하나만 남기고 안쪽 구멍을 메운다
window.SF_DEV = window.SF_DEV || {};
(function (D) {
  'use strict';
  const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u + '?v=' + Date.now(); });
  const rgb2hsv = (r, g, b) => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return [h, mx ? d / mx : 0, mx / 255];
  };
  D.cutout = async function (url, o) {
    o = o || {};
    const img = await load(url);
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H), a = d.data;
    const N = W * H;
    const body = new Uint8Array(N), dark = new Uint8Array(N);
    for (let p = 0; p < N; p++) {
      const r = a[p * 4], gg = a[p * 4 + 1], b = a[p * 4 + 2];
      const [h, s, v] = rgb2hsv(r, gg, b);
      const yellow = h >= 40 && h <= 70 && s >= 0.3 && v >= 0.6;            // 노란 몸
      const brown = h >= 15 && h <= 45 && s >= 0.25 && v >= 0.35 && v < 0.9;  // 갈색 옷
      const peach = h >= 10 && h <= 40 && s >= 0.15 && s < 0.5 && v >= 0.75;  // 살구색 입
      const white = v >= 0.93 && s <= 0.08;                                   // 흰 눈
      body[p] = (yellow || brown || peach) ? 1 : 0;
      if (white) body[p] = 2; // 흰색은 몸 가까이에 있을 때만 (돌벽 밝은 부분과 구분)
      dark[p] = v <= (o.darkV || 0.35) ? 1 : 0;                               // 테두리 (배경이 어두우면 darkV를 낮춘다)
    }
    // 몸 둘레 R픽셀 안의 어두운 픽셀 = 테두리, 흰색도 몸 둘레 안에서만
    const R = o.edge || Math.max(4, Math.round(W / 110));
    const near = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (body[y * W + x] !== 1) continue;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; near[Y * W + X] = 1;
      }
    }
    const mask = new Uint8Array(N);
    for (let p = 0; p < N; p++) mask[p] = body[p] === 1 || (near[p] && (dark[p] || body[p] === 2)) ? 1 : 0;
    // 가장 큰 덩어리만
    const comp = new Int32Array(N).fill(-1); const sizes = []; const st = [];
    for (let p = 0; p < N; p++) {
      if (!mask[p] || comp[p] >= 0) continue;
      const id = sizes.length; let n = 0; st.push(p); comp[p] = id;
      while (st.length) { const q = st.pop(); n++; const x = q % W, y = (q - x) / W;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const r = Y * W + X; if (mask[r] && comp[r] < 0) { comp[r] = id; st.push(r); } } }
      sizes.push(n);
    }
    let big = 0; for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[big]) big = i;
    for (let p = 0; p < N; p++) mask[p] = comp[p] === big ? 1 : 0;
    // 안쪽 구멍 메우기: 바깥(가장자리)에서 닿을 수 없는 빈 픽셀은 몸 속
    const outside = new Uint8Array(N);
    for (let x = 0; x < W; x++) { st.push(x); st.push((H - 1) * W + x); } for (let y = 0; y < H; y++) { st.push(y * W); st.push(y * W + W - 1); }
    while (st.length) { const q = st.pop(); if (outside[q] || mask[q]) continue; outside[q] = 1; const x = q % W, y = (q - x) / W;
      if (x > 0) st.push(q - 1); if (x < W - 1) st.push(q + 1); if (y > 0) st.push(q - W); if (y < H - 1) st.push(q + W); }
    for (let p = 0; p < N; p++) if (!mask[p] && !outside[p]) mask[p] = 1;
    // 가장자리를 1픽셀 부드럽게 (반투명)
    let minx = W, miny = H, maxx = -1, maxy = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (!mask[p]) { a[p * 4 + 3] = 0; continue; }
      let edge = false; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H || !mask[Y * W + X]) edge = true; }
      a[p * 4 + 3] = edge ? 160 : 255;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
    g.putImageData(d, 0, 0);
    const pad = o.pad || 0;
    const out = document.createElement('canvas');
    out.width = maxx - minx + 1 + pad * 2; out.height = maxy - miny + 1 + pad * 2;
    out.getContext('2d').drawImage(c, minx, miny, maxx - minx + 1, maxy - miny + 1, pad, pad, maxx - minx + 1, maxy - miny + 1);
    return { canvas: out, w: out.width, h: out.height, box: [minx, miny, maxx, maxy], kept: sizes[big], parts: sizes.length };
  };
  // 조각들을 같은 크기 칸(cell)으로 한 줄 시트에 (각 조각은 heightFrac × cell 높이로, 발이 칸 바닥에)
  D.sheet = function (pieces, cell) {
    const s = document.createElement('canvas'); s.width = cell * pieces.length; s.height = cell;
    const g = s.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    pieces.forEach((pc, i) => {
      const h = cell * (pc.heightFrac || 0.95), w = pc.canvas.width * h / pc.canvas.height;
      g.drawImage(pc.canvas, i * cell + (cell - w) / 2, cell - h - (pc.lift || 0), w, h);
    });
    return s;
  };
  // 시트를 서버의 dev/out/ 에 base64로 저장 (serve.ps1의 PUT)
  D.save = async function (canvas, name) {
    const b64 = canvas.toDataURL('image/png').split(',')[1];
    const r = await fetch('/dev/out/' + name + '.b64', { method: 'PUT', body: b64 });
    return r.status;
  };
})(window.SF_DEV);
