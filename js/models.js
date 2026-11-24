/* 절차적 고생물 모델러
 * 10가지 몸 구조(아키타입) + 종별 비율/색/돌기/모션으로 45종을 각각 다르게 그립니다.
 * 좌표계: 발이 y=0, 머리 방향이 +x, 표준 키 약 100 단위.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;

  function ell(ctx, x, y, rx, ry, color, rot) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(Math.abs(rx), 0.2), Math.max(Math.abs(ry), 0.2), 0, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function circ(ctx, x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(r, 0.2), 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function poly(ctx, pts, color) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function limb(ctx, pts, w, color) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  function tailShape(ctx, pts, widths, color) {
    const left = [];
    const right = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0];
      let dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const nx = -dy;
      const ny = dx;
      const w = widths[Math.min(i, widths.length - 1)];
      left.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
      right.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function curvePts(x0, y0, cx, cy, x1, y1, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const v = 1 - u;
      out.push([v * v * x0 + 2 * v * u * cx + u * u * x1, v * v * y0 + 2 * v * u * cy + u * u * y1]);
    }
    return out;
  }

  function motion(m, t) {
    const ph = m.ph || 0;
    const rate = 1.5 + (m.j || 0) * 0.9;
    return {
      bob: Math.sin(t * rate + ph),
      slow: Math.sin(t * rate * 0.6 + ph * 1.7),
      tail: Math.sin(t * rate * 1.4 + ph),
      rate,
    };
  }

  function eye(ctx, x, y, r, accent) {
    circ(ctx, x, y, r, '#fffdf6');
    circ(ctx, x + r * 0.25, y, r * 0.48, accent || '#1d2320');
  }

  function stripe(ctx, x, y, rx, ry, color, n, w) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    for (let i = 0; i < n; i++) {
      const sx = x - rx + ((i + 0.5) * rx * 2) / n;
      ctx.beginPath();
      ctx.moveTo(sx, y - ry);
      ctx.quadraticCurveTo(sx + rx * 0.16, y, sx, y + ry);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- theropod ---------------- */
  function theropod(ctx, m, t, pose, open) {
    const c = m.c;
    const main = c[0];
    const dark = c[1];
    const light = c[2];
    const accent = c[3];
    const f = m.f;
    const mo = motion(m, t);
    const big = f === 'rex' || f === 'gorgon' || f === 'sail';
    const slim = f === 'raptor';
    const y = -56 + mo.bob * 1.2;
    const rx = big ? 40 : slim ? 27 : 33;
    const ry = big ? 26 : slim ? 18 : 22;
    const headX = 62;
    const headY = (big ? -84 : slim ? -80 : -82) + mo.bob * 0.8;
    const stride = Math.sin(t * (5 + (m.j || 0)) + (m.ph || 0)) * 0.6;

    function leg(offset, color, near) {
      const hipX = offset;
      const kneeX = hipX - 6 + stride * 9 * (near ? 1 : -1);
      const footX = hipX + 4 - stride * 7 * (near ? 1 : -1);
      limb(ctx, [[hipX, y + ry * 0.55], [kneeX, -26], [footX, -6]], near ? 13 : 11, color);
      ell(ctx, footX + 5, -4, 8, 4, color);
    }

    leg(-10, dark, 0);
    const tp = curvePts(-rx + 4, y - 2, -80, y - 18 + mo.tail * 5, -118, y + 12, 7);
    tailShape(ctx, tp, [14, 13, 10, 8, 6, 4, 1.5], main);

    ell(ctx, 0, y, rx, ry, main);
    ell(ctx, 6, y + ry * 0.42, rx * 0.78, ry * 0.5, light);

    // sails / crests
    if (f === 'sail') {
      const baseY = y - ry * 0.8;
      poly(ctx, [[-26, baseY + 6], [-16, baseY - 52], [8, baseY - 60], [30, baseY - 44], [34, baseY + 8]], dark);
      ctx.strokeStyle = light;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(-22 + i * 10, baseY + 2);
        ctx.lineTo(-16 + i * 9, baseY - 44 + Math.abs(i - 2) * 6);
        ctx.stroke();
      }
    }
    if (f === 'hadro') {
      const pts = curvePts(headX - 4, headY - 2, headX - 26, headY - 16, headX - 66, headY - 36, 7);
      tailShape(ctx, pts, [11, 10, 9, 7.5, 6, 4.5, 3, 1.8], accent);
      tailShape(ctx, pts.map((p) => [p[0], p[1] + 2]), [5, 4.5, 4, 3.4, 2.6, 2, 1.4, 0.8], light);
    }

    leg(-2, main, 1);

    // tiny arms
    limb(
      ctx,
      [[rx * 0.45, y + 2], [rx * 0.7, y + 12], [rx * 0.52, y + 18]],
      big ? 6 : 4.5,
      main
    );

    // neck
    limb(
      ctx,
      [[rx * 0.35, y - ry * 0.5], [rx * 0.62, y - ry * 1.15], [headX - 12, headY + 10]],
      big ? 24 : slim ? 13 : 17,
      main
    );

    // head
    const hrx = f === 'rex' ? 25 : f === 'raptor' ? 22 : f === 'sail' ? 28 : 20;
    const hry = f === 'rex' ? 16 : f === 'raptor' ? 11 : 13;
    ell(ctx, headX, headY, hrx, hry, main);
    // snout
    poly(
      ctx,
      [
        [headX + hrx * 0.2, headY - hry * 0.7],
        [headX + hrx * 1.15, headY - hry * 0.2],
        [headX + hrx * 1.1, headY + hry * 0.35],
        [headX + hrx * 0.2, headY + hry * 0.75],
      ],
      main
    );
    // jaw
    const jawDrop = open ? 7 : 1.5;
    poly(
      ctx,
      [
        [headX + hrx * 0.1, headY + hry * 0.35],
        [headX + hrx * 1.05, headY + hry * 0.45],
        [headX + hrx * 0.95, headY + hry * 0.45 + jawDrop],
        [headX + hrx * 0.05, headY + hry * 0.6 + jawDrop],
      ],
      dark
    );
    ctx.fillStyle = '#fffaf0';
    for (let i = 0; i < 4; i++) {
      const tx = headX + hrx * 0.45 + i * hrx * 0.16;
      poly(ctx, [[tx, headY + hry * 0.42], [tx + 3, headY + hry * 0.42], [tx + 1.4, headY + hry * 0.42 + 5]], '#fffaf0');
    }
    eye(ctx, headX + hrx * 0.42, headY - hry * 0.3, 3.4, accent);
    if (f === 'crest') {
      poly(ctx, [[headX + 2, headY - 8], [headX + 10, headY - 30], [headX + 19, headY - 26], [headX + 18, headY - 4]], accent);
      poly(ctx, [[headX - 14, headY - 8], [headX - 6, headY - 32], [headX + 3, headY - 28], [headX + 2, headY - 6]], accent);
    }
    if (f === 'raptor') {
      // feathered arms
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(rx * 0.5, y + 10 + i * 2);
        ctx.lineTo(rx * 0.5 - 14 - i * 3, y + 22 + i * 3);
        ctx.stroke();
      }
    }
    if (f === 'rex') {
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, y - ry * 0.9);
      ctx.lineTo(-8, y - ry * 0.35);
      ctx.stroke();
    }
  }

  /* ---------------- quadruped ---------------- */
  function quadruped(ctx, m, t, pose, open) {
    const c = m.c;
    const main = c[0];
    const dark = c[1];
    const light = c[2];
    const accent = c[3];
    const f = m.f;
    const mo = motion(m, t);
    const y = -54 + mo.bob * 0.7;
    const big = f === 'trunk' || f === 'frill' || f === 'armadillo';
    const rx = f === 'lizard' ? 56 : big ? 52 : f === 'wolf' ? 40 : 44;
    const ry = f === 'trunk' ? 32 : f === 'lizard' ? 21 : f === 'wolf' ? 24 : 27;
    const stride = Math.sin(t * (3.6 + (m.j || 0)) + (m.ph || 0)) * 0.5;

    function leg(x, color, near, extra) {
      const kx = x + stride * 7 * (near ? 1 : -1);
      const len = f === 'wolf' ? 40 : f === 'sloth' ? 30 : 30;
      limb(ctx, [[x, y + ry * 0.55], [kx, -len * 0.55], [kx + 2, -4]], near ? 14 : 12, color);
      ell(ctx, kx + 6, -3, 9, 4, color);
    }

    // tail
    const tl = f === 'lizard' ? 1.7 : f === 'wolf' ? 0.9 : 0.8;
    const tp = curvePts(-rx + 4, y - 6, -rx - 26, y - 22 + mo.tail * 5, -rx - 52 * tl, y + 10, 7);
    tailShape(ctx, tp, [12, 11, 9, 7, 5, 3.4, 2], main);

    leg(-rx * 0.52, dark, 0);
    leg(rx * 0.34, dark, 0);
    ell(ctx, 0, y, rx, ry, main);
    ell(ctx, 4, y + ry * 0.45, rx * 0.8, ry * 0.48, light);
    leg(-rx * 0.38, main, 1);
    leg(rx * 0.5, main, 1);

    // neck + head
    const neckX = rx * 0.72;
    const headX = rx * 1.35;
    const headY = f === 'trunk' ? y - 46 : f === 'lizard' ? y + 6 : y - 18;
    limb(ctx, [[neckX - 6, y - ry * 0.4], [neckX + 8, headY + 8], [headX - 10, headY + 4]], f === 'trunk' ? 26 : 19, main);
    const hx = headX + 6;
    ell(ctx, hx, headY, f === 'trunk' ? 24 : 20, f === 'trunk' ? 20 : 16, main);
    ell(ctx, hx + 4, headY + 4, 12, 9, light);

    // snout
    if (f === 'wolf' || f === 'lizard' || f === 'saber') {
      poly(ctx, [[hx + 8, headY - 8], [hx + (f === 'wolf' ? 40 : 30), headY - 2], [hx + 34, headY + 8], [hx + 6, headY + 10]], main);
    } else if (f !== 'trunk' && f !== 'frill' && f !== 'club' && f !== 'armadillo') {
      ell(ctx, hx + 14, headY + 1, 14, 11, main);
    }
    if (f === 'saber') {
      poly(ctx, [[hx + 20, headY + 4], [hx + 24, headY + 4], [hx + 23, headY + 26]], '#fffdf4');
      poly(ctx, [[hx + 28, headY + 4], [hx + 32, headY + 4], [hx + 30, headY + 22]], '#fffdf4');
    }
    if (f === 'wolf' || f === 'saber' || f === 'wombat') {
      poly(ctx, [[hx - 8, headY - 12], [hx - 2, headY - 26], [hx + 6, headY - 12]], main);
    }

    // features
    if (f === 'frill') {
      const fx = hx - 8;
      const fy = headY - 8;
      ctx.beginPath();
      ctx.ellipse(fx, fy, 31, 29, 0, 0, TAU);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(fx + 2, fy + 2, 21, 19, 0, 0, TAU);
      ctx.fillStyle = main;
      ctx.fill();
      ell(ctx, hx + 6, headY + 4, 21, 17, main);
      ell(ctx, hx + 16, headY + 7, 11, 8, light);
      poly(ctx, [[hx + 18, headY - 4], [hx + 42, headY - 18], [hx + 36, headY + 4]], '#f3ead2');
      poly(ctx, [[hx + 6, headY - 8], [hx + 20, headY - 32], [hx + 27, headY - 6]], '#f3ead2');
      poly(ctx, [[hx + 30, headY + 10], [hx + 44, headY + 4], [hx + 34, headY + 14]], '#f3ead2');
    }
    if (f === 'plates') {
      const baseX = -rx * 0.7;
      for (let i = 0; i < 8; i++) {
        const px = baseX + i * (rx * 1.5) / 8;
        const ph = 18 + Math.sin((i / 7) * Math.PI) * 26;
        poly(ctx, [[px - 11, y - ry * 0.85], [px, y - ry * 0.85 - ph], [px + 11, y - ry * 0.85]], i % 2 ? dark : accent);
      }
      poly(ctx, [[-rx - 46, y + 2], [-rx - 62, y - 26], [-rx - 28, y - 4]], '#f3ead2');
      poly(ctx, [[-rx - 40, y + 10], [-rx - 58, y - 8], [-rx - 24, y + 4]], '#f3ead2');
    }
    if (f === 'club') {
      for (let i = 0; i < 5; i++) {
        const px = -rx * 0.55 + i * rx * 0.28;
        poly(ctx, [[px, y - ry * 0.9], [px + 8, y - ry * 0.9 - 10], [px + 16, y - ry * 0.9]], dark);
      }
      limb(ctx, [[-rx - 20, y + 4], [-rx - 44, y + 8]], 13, main);
      ell(ctx, -rx - 50, y + 8, 20, 16, dark);
      for (let i = 0; i < 5; i++) {
        const a = -0.9 + i * 0.45;
        circ(ctx, -rx - 50 + Math.cos(a) * 17, y + 8 + Math.sin(a) * 13, 4, accent);
      }
    }
    if (f === 'armadillo') {
      ctx.beginPath();
      ctx.ellipse(0, y - 4, rx * 0.98, ry * 1.15, 0, Math.PI, TAU);
      ctx.fillStyle = dark;
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(0, y - 4, rx * 0.5 + i * 6, Math.PI * 1.12, Math.PI * 1.88);
        ctx.stroke();
      }
      limb(ctx, [[-rx + 2, y + 2], [-rx - 24, y + 14], [-rx - 46, y + 2]], 14, main);
      ell(ctx, -rx - 54, y + 2, 16, 13, dark);
      for (let i = 0; i < 4; i++) {
        poly(ctx, [[-rx - 64 + i * 6, y - 8], [-rx - 62 + i * 6, y - 18], [-rx - 58 + i * 6, y - 8]], '#f3ead2');
      }
    }
    if (f === 'trunk') {
      ell(ctx, hx - 14, headY + 2, 13, 17, dark);
      ell(ctx, hx + 2, headY - 14, 17, 12, main);
      lensTrunk(ctx, hx, headY, main, light, mo);
      limb(ctx, curvePts(hx + 10, headY + 16, hx + 44, headY + 22, hx + 62, headY - 4, 6), 7, '#f3ead2');
      limb(ctx, curvePts(hx + 2, headY + 18, hx + 34, headY + 26, hx + 52, headY - 2, 6), 6, '#efe6cf');
      ellipseFur(ctx, rx, ry, y, main, light);
    }
    if (f === 'sloth') {
      const fx = rx * 0.5;
      for (let i = 0; i < 3; i++) {
        limb(ctx, [[fx + 3 + i * 4, -14], [fx + 9 + i * 4, -8], [fx + 13 + i * 4, -2]], 3.2, '#efe6cf');
      }
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = light;
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(-rx * 0.5 + i * 14, y - ry * 0.6);
        ctx.lineTo(-rx * 0.5 + i * 14 - 4, y + ry * 0.45);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (f === 'horn2') {
      poly(ctx, [[hx - 4, headY + 4], [hx + 1, headY - 40], [hx + 11, headY - 35], [hx + 11, headY + 4]], '#f3ead2');
      poly(ctx, [[hx + 16, headY + 4], [hx + 20, headY - 34], [hx + 30, headY - 27], [hx + 30, headY + 4]], '#f3ead2');
    }
    if (f === 'lizard') {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx + 32, headY + 2);
      ctx.lineTo(hx + 48, headY + 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx + 48, headY + 2);
      ctx.lineTo(hx + 44, headY - 6);
      ctx.moveTo(hx + 48, headY + 2);
      ctx.lineTo(hx + 44, headY + 10);
      ctx.stroke();
      for (let i = 0; i < 6; i++) circ(ctx, -rx + i * 12, y - ry - 2, 2.6, accent);
    }
    if (f === 'amphibian') {
      poly(ctx, [[hx + 2, headY + 3], [hx + 26, headY + 5], [hx + 21, headY + 13], [hx + 1, headY + 11]], main);
      circ(ctx, hx - 6, headY - 7, 2.6, accent);
      circ(ctx, hx + 6, headY - 9, 2.2, accent);
    }
    if (f === 'beak') {
      ell(ctx, hx + 24, headY + 2, 12, 9, '#d9cba4');
      poly(ctx, [[hx + 30, headY - 2], [hx + 42, headY + 2], [hx + 30, headY + 6]], '#c9b98f');
      poly(ctx, [[hx + 21, headY + 8], [hx + 25, headY + 22], [hx + 29, headY + 7]], '#efe6cf');
    }
    if (f === 'wombat') {
      ell(ctx, hx - 10, headY + 4, 6, 5, dark);
    }

    eye(ctx, hx + 6, headY - 6, 3.2, accent);
  }

  function lensTrunk(ctx, hx, headY, main, light, mo) {
    const pts = [
      [hx + 24, headY + 2],
      [hx + 40, headY + 18 + mo.slow * 2],
      [hx + 44, headY + 40 + mo.slow * 3],
      [hx + 34, headY + 52 + mo.slow * 3],
    ];
    limb(ctx, pts, 12, main);
    limb(ctx, pts, 6, light);
  }

  function ellipseFur(ctx, rx, ry, y, main, light) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = light;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU;
      const px = Math.cos(a) * rx * 0.95;
      const py = y + Math.sin(a) * ry * 0.95;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px * 1.04, py - 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- sauropod ---------------- */
  function sauropod(ctx, m, t, pose, open) {
    const c = m.c;
    const main = c[0];
    const dark = c[1];
    const light = c[2];
    const accent = c[3];
    const f = m.f;
    const mo = motion(m, t);
    const y = -58 + mo.bob * 0.6;
    const rx = f === 'rhino' ? 62 : 58;
    const ry = f === 'tall' ? 30 : f === 'rhino' ? 34 : 26;
    const stride = Math.sin(t * (2.9 + (m.j || 0)) + (m.ph || 0)) * 0.4;

    function leg(x, color, near) {
      const kx = x + stride * 6 * (near ? 1 : -1);
      limb(ctx, [[x, y + ry * 0.4], [kx, -26], [kx, -5]], near ? 18 : 15, color);
      ell(ctx, kx + 4, -4, 11, 5, color);
    }

    const tp = curvePts(-rx + 6, y, -rx - 50, y - 10 + mo.tail * 5, -rx - 120, y - 4, 8);
    tailShape(ctx, tp, [11, 9, 7.5, 6, 4.6, 3.4, 2.4, 1.6, 1], main);

    leg(-rx * 0.6, dark, 0);
    leg(rx * 0.25, dark, 0);
    ell(ctx, 0, y, rx, ry, main);
    ell(ctx, 4, y + ry * 0.4, rx * 0.8, ry * 0.5, light);
    leg(-rx * 0.45, main, 1);
    leg(rx * 0.4, main, 1);

    // neck
    let neckH = f === 'tall' ? 58 : f === 'rhino' ? 8 : 18;
    let neckX = rx * 0.55;
    let headX = rx * 0.68 + (f === 'tall' ? 12 : 44);
    let headY = y - ry - neckH;
    if (f === 'tall') {
      limb(ctx, [[neckX, y - ry * 0.5], [neckX + 4, y - 66], [headX - 8, headY + 6]], 20, main);
    } else if (f === 'rhino') {
      limb(ctx, [[rx * 0.6, y - ry * 0.4], [rx * 0.9, y - ry * 1.15], [headX - 10, headY + 6]], 34, main);
    } else {
      limb(ctx, [[rx * 0.5, y - ry * 0.5], [rx * 0.9, y - ry - 4], [headX - 8, headY + 6]], 16, main);
    }
    ell(ctx, headX, headY, f === 'rhino' ? 23 : 16, f === 'rhino' ? 19 : 12, main);
    if (f === 'rhino') {
      ell(ctx, headX + 10, headY + 6, 18, 13, main);
      ell(ctx, headX + 22, headY + 8, 10, 8, main);
      poly(ctx, [[headX - 6, headY - 12], [headX + 4, headY - 24], [headX + 12, headY - 10]], main);
      poly(ctx, [[headX - 14, headY - 10], [headX - 18, headY - 24], [headX - 2, headY - 14]], dark);
      ell(ctx, headX - 12, headY - 8, 6, 5, dark);
    } else {
      ell(ctx, headX + 10, headY + 2, 9, 8, main);
      circ(ctx, headX + 3, headY - 4, 2.4, accent);
    }
    if (f === 'whip') {
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-rx - 108, y - 2);
      ctx.lineTo(-rx - 124, y - 14);
      ctx.stroke();
    }
    if (f === 'tall') {
      stripe(ctx, 0, y, rx, ry, dark, 5, 5);
    }
    eye(ctx, headX + 4, headY - 4, f === 'rhino' ? 3 : 2.6, accent);
  }

  /* ---------------- synapsid (sail back) ---------------- */
  function synapsid(ctx, m, t, pose, open) {
    const c = m.c;
    const main = c[0];
    const dark = c[1];
    const light = c[2];
    const accent = c[3];
    const mo = motion(m, t);
    const y = -42 + mo.bob * 0.8;
    const rx = 52;
    const ry = 24;
    const stride = Math.sin(t * 3.4 + (m.ph || 0)) * 0.5;

    function leg(x, color, near) {
      const kx = x + stride * 9 * (near ? 1 : -1);
      limb(ctx, [[x, y + ry * 0.4], [kx - 8, y + 12], [kx + 2, -4]], near ? 12 : 10, color);
    }

    const tp = curvePts(-rx + 4, y, -rx - 40, y + 2 + mo.tail * 3, -rx - 88, y - 6, 7);
    tailShape(ctx, tp, [12, 10, 8, 6, 4, 2.4, 1.2], main);

    leg(-22, dark, 0);
    leg(24, dark, 0);

    // sail
    const sailH = m.f === 'sail' ? 54 : 42;
    ctx.beginPath();
    ctx.moveTo(-36, y - ry * 0.6);
    ctx.bezierCurveTo(-20, y - ry - sailH, 22, y - ry - sailH * 1.05, 36, y - ry * 0.7);
    ctx.closePath();
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.6;
    for (let i = 0; i <= 10; i++) {
      const px = -34 + (i / 10) * 68;
      const t2 = i / 10;
      const top = y - ry - sailH * (0.4 + Math.sin(t2 * Math.PI) * 0.6);
      ctx.beginPath();
      ctx.moveTo(px, top + sailH * 0.42);
      ctx.lineTo(px, top + 5);
      ctx.stroke();
    }

    ell(ctx, 0, y, rx, ry, main);
    ell(ctx, 4, y + ry * 0.4, 40, 12, light);

    leg(-14, main, 1);
    leg(32, main, 1);

    // neck / head
    limb(ctx, [[rx * 0.62, y - ry * 0.4], [rx * 0.85, y - ry - 6], [rx * 1.05, y - ry - 2]], 17, main);
    const hx = rx * 1.2;
    const hy = y - ry - 4;
    ell(ctx, hx, hy, 22, 13, main);
    poly(ctx, [[hx + 8, hy - 6], [hx + 34, hy + 1], [hx + 30, hy + 8], [hx + 6, hy + 8]], main);
    if (open) poly(ctx, [[hx + 10, hy + 7], [hx + 32, hy + 8], [hx + 26, hy + 16], [hx + 8, hy + 14]], dark);
    // teeth
    for (let i = 0; i < 4; i++) {
      poly(ctx, [[hx + 14 + i * 5, hy + 6], [hx + 16 + i * 5, hy + 6], [hx + 15 + i * 5, hy + 12]], '#fffaf0');
    }
    eye(ctx, hx + 6, hy - 5, 2.6, accent);
  }

  /* ---------------- hominid ---------------- */
  function hominid(ctx, m, t, pose, open) {
    const c = m.c;
    const main = c[0];
    const dark = c[1];
    const light = c[2];
    const accent = c[3];
    const mo = motion(m, t);
    const sway = mo.slow * 2;
    const bulky = m.f === 'neander';
    const y = 0;

    // legs
    limb(ctx, [[-8, -46], [-12 + sway * 0.5, -24], [-10, -2]], 13, dark);
    limb(ctx, [[8, -46], [12 - sway * 0.5, -24], [10, -2]], 13, main);
    ell(ctx, -12, -2, 8, 4, dark);
    ell(ctx, 12, -2, 8, 4, main);

    // torso
    ell(ctx, 0, -60, bulky ? 22 : 19, bulky ? 26 : 24, main);
    ell(ctx, 2, -54, 12, 16, light);

    // arms
    limb(ctx, [[-16, -70 + sway], [-26, -52], [-22 + sway, -34]], 9, main);
    limb(ctx, [[16, -70 - sway], [27, -56], [30 - sway, -38]], 9, main);
    if (m.f === 'neander') {
      limb(ctx, [[30, -40], [52, -54], [74, -72]], 4, '#8a6a45');
      poly(ctx, [[76, -76], [86, -86], [76, -68]], '#cfd3d6');
      limb(ctx, [[52, -54], [55, -44]], 3, dark);
    } else {
      circ(ctx, 24, -34, 6, '#a08a6a');
    }

    // neck + head
    ell(ctx, 0, -92, 12, 13, main);
    ell(ctx, 6, -84, 9, 10, main);
    if (m.f === 'neander') {
      ell(ctx, 2, -96, 15, 12, main);
      ell(ctx, 10, -92, 8, 7, light);
    } else {
      ell(ctx, 2, -96, 12, 14, main);
      ell(ctx, 8, -94, 7, 7, light);
    }
    eye(ctx, 8, -98, 2.2, accent);
    circ(ctx, 12, -90, 1.6, dark);

    // hair
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(0, -98, 14, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
  }

  /* ---------------- marine ---------------- */
  function marine(ctx, m, t, pose, open) {
    const c = m.c;
    const main = c[0];
    const dark = c[1];
    const light = c[2];
    const accent = c[3];
    const f = m.f;
    const mo = motion(m, t);
    const float = Math.sin(t * 1.2 + (m.ph || 0)) * 3;
    const y = -62 + float;
    const rx = f === 'basilosaurus' ? 78 : f === 'livyatan' ? 62 : 58;
    const ry = f === 'basilosaurus' ? 20 : f === 'livyatan' ? 30 : 24;

    // tail fluke
    const tailX = -rx - (f === 'basilosaurus' ? 54 : 30);
    const tp = curvePts(-rx * 0.7, y, -rx - 20, y + mo.tail * 6, tailX, y + mo.tail * 8, 6);
    tailShape(ctx, tp, [12, 10, 8, 6, 4, 2], main);
    if (f === 'mosasaur' || f === 'basilosaurus') {
      poly(ctx, [[tailX, y + mo.tail * 8], [tailX - 20, y - 20 + mo.tail * 8], [tailX + 6, y + mo.tail * 8], [tailX - 10, y + 22 + mo.tail * 8]], dark);
    } else {
      poly(ctx, [[tailX, y + mo.tail * 8], [tailX - 18, y - 26], [tailX + 4, y], [tailX - 14, y + 24]], dark);
    }

    // flippers
    poly(ctx, [[-6, y + ry * 0.5], [-38, y + ry + 22], [-10, y + ry + 4], [16, y + ry * 0.8]], dark);
    poly(ctx, [[-24, y + ry * 0.4], [-50, y + ry + 14], [-22, y + ry - 2]], dark);

    // body
    ell(ctx, 0, y, rx, ry, main);
    ell(ctx, 6, y + ry * 0.45, rx * 0.78, ry * 0.45, light);

    if (f === 'plesiosaur') {
      // long neck + small head
      limb(ctx, [[rx * 0.6, y - 6], [rx * 0.75, y - 40], [rx * 0.85, y - 66]], 15, main);
      ell(ctx, rx * 0.88, y - 72, 13, 10, main);
      poly(ctx, [[rx * 0.9, y - 76], [rx * 0.9 + 22, y - 70], [rx * 0.9, y - 66]], main);
      eye(ctx, rx * 0.88 + 4, y - 74, 2.4, accent);
      return;
    }

    if (f === 'livyatan') {
      ell(ctx, rx * 0.78, y - 4, 34, 30, main);
      poly(ctx, [[rx * 0.8, y + 8], [rx * 0.8 + 48, y + 2], [rx * 0.8 + 42, y + 16], [rx * 0.8, y + 20]], main);
      for (let i = 0; i < 5; i++) {
        poly(ctx, [[rx * 0.86 + i * 7, y + 12], [rx * 0.86 + i * 7 + 4, y + 12], [rx * 0.86 + i * 7 + 2, y + 22]], '#fffdf4');
      }
      eye(ctx, rx * 0.82, y + 2, 3, accent);
      ell(ctx, rx * 0.78, y - 22, 5, 4, dark);
      return;
    }

    if (f === 'basilosaurus') {
      // serpentine body: extra segments + tiny hind flippers
      poly(ctx, [[-10, y + ry * 0.6], [18, y + ry + 18], [34, y + ry + 2]], dark);
      for (let i = 0; i < 5; i++) circ(ctx, -rx * 0.6 + i * 16, y - ry * 0.4, 2, accent);
      ell(ctx, rx * 0.7, y - 4, 32, 20, main);
      poly(ctx, [[rx * 0.7, y + 2], [rx * 0.7 + 52, y + 4], [rx * 0.7 + 46, y + 14], [rx * 0.7, y + 14]], main);
      eye(ctx, rx * 0.72 + 6, y - 10, 3, accent);
      return;
    }

    if (f === 'ichthyosaur') {
      // dolphin-like beak
      poly(ctx, [[rx * 0.7, y - 14], [rx * 0.7 + 46, y - 2], [rx * 0.7 + 44, y + 6], [rx * 0.7, y + 9]], main);
      circ(ctx, rx * 0.74, y - 4, 3.4, accent);
      ellipsePattern(ctx, rx, ry, y, light);
      return;
    }

    // mosasaur
    ell(ctx, rx * 0.72, y - 4, 26, 16, main);
    poly(ctx, [[rx * 0.72, y + 4], [rx * 0.72 + 40, y + 2], [rx * 0.72 + 38, y + 12], [rx * 0.72, y + 14]], main);
    for (let i = 0; i < 4; i++) {
      poly(ctx, [[rx * 0.8 + i * 8, y + 6], [rx * 0.8 + i * 8 + 3, y + 6], [rx * 0.8 + i * 8 + 1, y + 14]], '#fffdf4');
    }
    eye(ctx, rx * 0.75, y - 8, 3, accent);
    for (let i = 0; i < 6; i++) {
      circ(ctx, -rx * 0.4 + i * 13, y - ry * 0.6, 2.2, light);
    }
  }

  function ellipsePattern(ctx, rx, ry, y, color) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 5; i++) circ(ctx, -20 + i * 16, y - 6, 3, color);
    ctx.restore();
  }

  /* ---------------- shark ---------------- */
  function shark(ctx, m, t, pose, open) {
    const c = m.c;
    const main = c[0];
    const dark = c[1];
    const light = c[2];
    const accent = c[3];
    const f = m.f;
    const mo = motion(m, t);
    const y = -72 + Math.sin(t * 1.2 + (m.ph || 0)) * 3;
    const rx = 64;

    // tail
    const tailX = -rx - 34;
    const tp = curvePts(-rx * 0.7, y, -rx - 26, y + mo.tail * 5, tailX, y + mo.tail * 6, 6);
    tailShape(ctx, tp, [12, 10, 8, 6, 4, 2], main);
    poly(ctx, [[tailX + 2, y + mo.tail * 6], [tailX - 16, y - 34], [tailX - 4, y + 6], [tailX - 20, y + 22]], dark);

    // dorsal fin
    poly(ctx, [[-14, y - 18], [-4, y - 62], [16, y - 48], [22, y - 18]], dark);
    // pectoral fin
    poly(ctx, [[16, y + 10], [44, y + 34], [6, y + 22]], dark);

    ell(ctx, 0, y, rx, 26, main);
    ell(ctx, 6, y + 12, rx * 0.78, 10, light);

    if (f === 'dunkle') {
      // armored head plate
      poly(ctx, [[rx * 0.2, y - 22], [rx * 0.75, y - 30], [rx + 8, y - 6], [rx * 0.72, y + 24], [rx * 0.25, y + 20]], dark);
      poly(ctx, [[rx * 0.62, y - 6], [rx + 22, y + 2], [rx + 4, y + 12]], accent);
      poly(ctx, [[rx * 0.56, y + 8], [rx + 6, y + 10], [rx * 0.58, y + 18]], '#e9e2cf');
      eye(ctx, rx * 0.42, y - 8, 4, accent);
    } else if (f === 'helicoprion') {
      // tooth whorl
      const cx = rx * 0.66;
      const cy = y + 8;
      ell(ctx, cx, cy, 20, 20, '#efe8d6');
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2.4;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, 4 + i * 5, 0, TAU);
        ctx.stroke();
      }
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7;
        poly(ctx, [[cx + Math.cos(a) * 18, cy + Math.sin(a) * 18], [cx + Math.cos(a + 0.25) * 22, cy + Math.sin(a + 0.25) * 22], [cx + Math.cos(a + 0.12) * 12, cy + Math.sin(a + 0.12) * 12]], '#fffdf4');
      }
      poly(ctx, [[rx * 0.5, y - 8], [rx + 14, y - 14], [rx * 0.66, y + 12]], main);
      eye(ctx, rx * 0.5, y - 10, 3, accent);
    } else {
      // megalodon jaws
      poly(ctx, [[rx * 0.45, y - 16], [rx + 10, y - 22], [rx + 6, y + 10], [rx * 0.45, y + 10]], main);
      poly(ctx, [[rx + 4, y - 4], [rx + 34, y + 2], [rx + 20, y + 12], [rx * 0.5, y + 16]], dark);
      ctx.fillStyle = '#fffdf4';
      for (let i = 0; i < 6; i++) {
        const tx = rx * 0.55 + i * 8;
        poly(ctx, [[tx, y + 6], [tx + 6, y + 6], [tx + 3, y + 17]], '#fffdf4');
      }
      eye(ctx, rx * 0.52, y - 12, 3.4, accent);
    }
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = light;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-4 + i * 8, y - 8);
      ctx.lineTo(-4 + i * 8, y + 8);
      ctx.stroke();
    }
  }

  /* ---------------- flyer ---------------- */
  function flyer(ctx, m, t, pose, open) {
    const c = m.c;
    const main = c[0];
    const dark = c[1];
    const light = c[2];
    const accent = c[3];
    const f = m.f;
    const mo = motion(m, t);
    const flap = Math.sin(t * (4.2 + (m.j || 0)) + (m.ph || 0));
    const y = -86 + mo.bob * 4;

    // far wing
    poly(ctx, [[-4, y - 6], [-54, y - 34 - flap * 26], [-92, y - 6 - flap * 12], [-32, y + 8]], dark);
    // body
    ell(ctx, 0, y, 24, 15, main);
    ell(ctx, 4, y + 4, 16, 8, light);
    // near wing
    poly(ctx, [[-2, y + 2], [-48, y - 20 + flap * 34], [-86, y + 10 + flap * 18], [-26, y + 14]], main);
    ctx.strokeStyle = light;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-2, y + 2);
    ctx.lineTo(-48, y - 20 + flap * 34);
    ctx.stroke();

    // head
    const hx = 30;
    ell(ctx, hx, y - 4, 14, 11, main);
    poly(ctx, [[hx + 6, y - 8], [hx + 44, y - 2], [hx + 40, y + 4], [hx + 6, y + 2]], accent);
    eye(ctx, hx + 4, y - 8, 2.6, accent);

    if (f === 'pteranodon') {
      poly(ctx, [[hx + 4, y - 14], [hx - 34, y - 30], [hx - 46, y - 19], [hx - 12, y - 2]], accent);
      poly(ctx, [[hx + 2, y - 10], [hx - 22, y - 19], [hx - 27, y - 12], [hx - 8, y - 2]], light);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx + 44, y - 2);
      ctx.lineTo(hx + 48, y - 8);
      ctx.stroke();
    } else {
      // feathered tail
      for (let i = 0; i < 5; i++) {
        poly(ctx, [[-18, y + 6], [-70 - i * 4, y + 14 + i * 5], [-62, y + 20 + i * 5], [-16, y + 12]], i % 2 ? dark : accent);
      }
      // teeth
      poly(ctx, [[hx + 22, y], [hx + 26, y], [hx + 24, y + 6]], '#fffdf4');
    }
  }

  /* ---------------- arthropod ---------------- */
  function arthropod(ctx, m, t, pose, open) {
    const c = m.c;
    const main = c[0];
    const dark = c[1];
    const light = c[2];
    const accent = c[3];
    const f = m.f;
    const mo = motion(m, t);
    const y = -40 + mo.bob * 2;

    if (f === 'trilobite') {
      for (let i = 0; i < 6; i++) {
        limb(ctx, [[-26 + i * 10, y + 12], [-30 + i * 10, y + 26]], 2.4, dark);
        limb(ctx, [[-26 + i * 10, y + 12], [-20 + i * 10, y + 26]], 2.4, dark);
      }
      ctx.beginPath();
      ctx.ellipse(0, y, 46, 22, 0, 0, TAU);
      ctx.fillStyle = main;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, y - 4, 14, 18, 0, 0, TAU);
      ctx.fillStyle = light;
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(-34 + i * 13, y - 18 + Math.abs(i - 2) * 2);
        ctx.lineTo(-34 + i * 13, y + 18);
        ctx.stroke();
      }
      ell(ctx, 34, y + 2, 12, 14, dark);
      eye(ctx, 38, y - 4, 3, accent);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(40, y - 8 + i * 4);
        ctx.lineTo(60, y - 16 + i * 8);
        ctx.strokeStyle = main;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      return;
    }

    if (f === 'anomalo') {
      for (let i = 0; i < 9; i++) {
        const px = -44 + i * 11;
        const wob = Math.sin(t * 6 + i * 0.6 + (m.ph || 0)) * 4;
        poly(ctx, [[px, y - 4], [px - 4, y + 14 + wob], [px + 8, y + 6]], i % 2 ? dark : light);
      }
      ell(ctx, 0, y, 48, 20, main);
      ell(ctx, 0, y - 7, 40, 9, light);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(-36 + i * 14, y, 9, Math.PI * 0.35, Math.PI * 1.65);
        ctx.stroke();
      }
      // frontal claws
      limb(ctx, [[38, y - 6], [64, y - 4], [74, y + 8]], 6, main);
      limb(ctx, [[38, y + 4], [62, y + 12], [70, y + 22]], 6, main);
      for (let i = 0; i < 4; i++) {
        poly(ctx, [[70 + i * 2, y + 6 + i * 2], [80 + i * 2, y + 2 + i * 4], [74 + i * 2, y + 12 + i * 2]], dark);
      }
      ell(ctx, 46, y - 6, 15, 12, main);
      eye(ctx, 47, y - 10, 5, accent);
      eye(ctx, 54, y - 4, 4, accent);
      return;
    }

    if (f === 'opabinia') {
      for (let i = 0; i < 5; i++) {
        limb(ctx, [[-30 + i * 12, y + 8], [-34 + i * 12 + Math.sin(t * 4 + i) * 4, y + 20]], 2, dark);
      }
      ell(ctx, -6, y, 36, 15, main);
      ell(ctx, -6, y - 4, 29, 7, light);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(-24 + i * 9, y, 7, Math.PI * 0.4, Math.PI * 1.6);
        ctx.stroke();
      }
      // proboscis
      const pts = curvePts(24, y - 4, 56, y - 18 + Math.sin(t * 2) * 5, 64, y + 2, 6);
      limb(ctx, pts, 5, light);
      poly(ctx, [[64, y + 2], [72, y - 6], [70, y + 4], [66, y + 8]], dark);
      // five eyes
      for (let i = 0; i < 5; i++) {
        const ex = 26 + Math.cos(i * 1.2) * 12;
        const ey = y - 10 + Math.sin(i * 1.2) * 8;
        limb(ctx, [[28, y - 2], [ex, ey]], 1.6, dark);
        circ(ctx, ex, ey, 2.6, '#fffdf6');
        circ(ctx, ex, ey, 1.2, accent);
      }
      return;
    }

    if (f === 'hallucigenia') {
      for (let i = 0; i < 8; i++) {
        limb(ctx, [[-34 + i * 9, y + 6], [-34 + i * 9, y + 24 + Math.sin(t * 4 + i) * 3]], 2.2, dark);
      }
      for (let i = 0; i < 7; i++) {
        poly(ctx, [[-36 + i * 10, y - 2], [-34 + i * 10, y - 30], [-28 + i * 10, y - 2]], i % 2 ? accent : light);
      }
      ell(ctx, 0, y, 42, 10, main);
      ell(ctx, 0, y - 2, 34, 5, light);
      ell(ctx, 44, y - 2, 9, 8, main);
      eye(ctx, 46, y - 5, 2.2, accent);
      return;
    }

    if (f === 'eurypterus') {
      // tail
      const tp = curvePts(-30, y, -58, y - 4, -80, y - 18, 5);
      tailShape(ctx, tp, [10, 8, 6, 4, 2], main);
      poly(ctx, [[-80, y - 18], [-92, y - 34], [-74, y - 22]], dark);
      ell(ctx, -6, y, 34, 16, main);
      ell(ctx, -4, y - 4, 26, 8, light);
      // legs
      for (let i = 0; i < 4; i++) {
        limb(ctx, [[-14 + i * 8, y + 10], [-18 + i * 8, y + 26]], 2.4, dark);
      }
      // head shield + pincers
      ell(ctx, 32, y - 2, 20, 16, dark);
      limb(ctx, [[44, y - 6], [66, y - 14], [80, y - 6]], 5, main);
      limb(ctx, [[44, y + 2], [64, y + 8], [78, y + 2]], 5, main);
      poly(ctx, [[78, y - 8], [88, y - 16], [84, y - 2]], dark);
      poly(ctx, [[78, y + 4], [88, y + 10], [82, y - 2]], dark);
      eye(ctx, 36, y - 8, 3, accent);
      return;
    }

    if (f === 'meganeura') {
      const flap = Math.sin(t * 9 + (m.ph || 0));
      for (let i = 0; i < 2; i++) {
        const off = i * 6;
        poly(ctx, [[2, y - 8], [-30 - off, y - 46 - flap * 10], [-74 - off, y - 36 - flap * 6], [-38 - off, y - 8]], light);
        poly(ctx, [[4, y - 2], [-24 - off, y - 30 - flap * 8], [-60 - off, y - 22 - flap * 5], [-30 - off, y + 2]], main);
      }
      const tp = curvePts(-8, y, -44, y + 4, -84, y + 8 + Math.sin(t * 2) * 3, 6);
      tailShape(ctx, tp, [7, 6, 5, 4, 3, 2, 1.2], main);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.4;
      for (let i = 1; i < 5; i++) {
        const p = tp[i + 1];
        ctx.beginPath();
        ctx.moveTo(p[0], p[1] - 5);
        ctx.lineTo(p[0], p[1] + 5);
        ctx.stroke();
      }
      ell(ctx, 0, y - 2, 9, 9, dark);
      ell(ctx, 10, y - 6, 11, 10, main);
      circ(ctx, 16, y - 12, 5, dark);
      eye(ctx, 17, y - 12, 3.2, accent);
      for (let i = 0; i < 3; i++) {
        limb(ctx, [[2 - i * 7, y + 4], [-2 - i * 7, y + 20]], 1.6, dark);
      }
      return;
    }

    // arthropleura
    for (let i = 0; i < 14; i++) {
      limb(ctx, [[-46 + i * 7, y + 6], [-48 + i * 7, y + 22]], 2, dark);
    }
    const tp = curvePts(-50, y + 2, -10, y + 10, 42, y - 2, 8);
    tailShape(ctx, tp, [9, 10, 10, 9, 8, 7, 5, 3.4, 2], main);
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(-46 + i * 11, y + 4, 11, Math.PI * 1.05, Math.PI * 1.95);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2.6;
      ctx.stroke();
    }
    ell(ctx, 44, y - 2, 13, 11, dark);
    eye(ctx, 46, y - 6, 2.6, accent);
  }

  /* ---------------- serpent ---------------- */
  function serpent(ctx, m, t, pose, open) {
    const c = m.c;
    const main = c[0];
    const dark = c[1];
    const light = c[2];
    const accent = c[3];
    const f = m.f;
    const thick = f === 'boa' ? 16 : 5;
    const len = f === 'boa' ? 150 : 120;
    const y = f === 'pikaia' ? -30 : -34;
    const pts = [];
    const widths = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = -len * 0.5 + u * len;
      const wave = Math.sin(u * Math.PI * 2.2 + t * 1.6 + (m.ph || 0) * 0.2) * (f === 'boa' ? 10 : 7);
      pts.push([x, y + wave]);
      widths.push(thick * (0.45 + Math.sin(u * Math.PI) * 0.7));
    }
    // ground shadow
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.ellipse(0, 2, len * 0.55, 8, 0, 0, TAU);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    tailShape(ctx, pts, widths, main);
    if (f === 'boa') {
      const inner = pts.slice(2, pts.length - 2).map((p) => [p[0], p[1] - 4]);
      ctx.save();
      ctx.globalAlpha = 0.5;
      tailShape(ctx, inner, widths.slice(2, -2).map((w) => w * 0.4), light);
      ctx.restore();
      for (let i = 2; i < pts.length - 3; i += 2) {
        circ(ctx, pts[i][0], pts[i][1] - 2, 4, dark);
      }
    } else {
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
    const head = pts[pts.length - 1];
    ell(ctx, head[0] + 6, head[1] - 2, f === 'boa' ? 18 : 10, f === 'boa' ? 13 : 7, main);
    if (f === 'boa') {
      ell(ctx, head[0] + 12, head[1] + 2, 12, 7, light);
      eye(ctx, head[0] + 8, head[1] - 6, 2.6, accent);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(head[0] + 22, head[1] + 4);
      ctx.lineTo(head[0] + 34, head[1] + 6);
      ctx.moveTo(head[0] + 34, head[1] + 6);
      ctx.lineTo(head[0] + 30, head[1]);
      ctx.stroke();
    } else {
      circ(ctx, head[0] + 8, head[1] - 4, 1.8, accent);
    }
  }

  const ARCH = {
    theropod,
    quadruped,
    sauropod,
    synapsid,
    hominid,
    marine,
    shark,
    flyer,
    arthropod,
    serpent,
  };

  function draw(ctx, spec, opts) {
    const o = opts || {};
    const pose = o.pose || { kind: 'idle', p: 0 };
    const t = o.t || 0;
    const size = (o.size || 1.5) * (spec.s || 1);

    ctx.save();
    ctx.translate(o.x || 0, o.y || 0);
    ctx.scale((o.facing || 1) * size, size);

    let dx = 0;
    let dy = 0;
    const k = Math.sin((pose.p || 0) * Math.PI);
    if (pose.kind === 'attack') {
      dx = 20 * k;
      dy = -6 * k;
    } else if (pose.kind === 'hit') {
      dx = Math.sin((pose.p || 0) * Math.PI * 12) * 5;
    } else if (pose.kind === 'guard') {
      dy = 4;
    } else if (pose.kind === 'skill') {
      dy = -9 * k;
      dx = 7 * k;
    }
    ctx.translate(dx, dy);

    if (o.alpha != null) ctx.globalAlpha = o.alpha;

    const fn = ARCH[spec.a] || quadruped;
    fn(ctx, spec, t, pose, pose.kind === 'attack' || pose.kind === 'skill');
    ctx.restore();
  }

  function paint(canvas, spec, opts) {
    const o = opts || {};
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || o.w || 220;
    const h = canvas.clientHeight || o.h || 150;
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (o.locked) {
      ctx.globalAlpha = 0.28;
    }
    const fit = { sauropod: 0.82, marine: 0.95, shark: 0.92, serpent: 0.95, hominid: 1.05, arthropod: 1.05 };
    const base = Math.min(w / 280, h / 160) * (fit[spec.a] || 1);
    draw(ctx, spec, {
      x: w * 0.5,
      y: h * 0.9,
      size: base * (o.zoom || 1),
      facing: o.facing || 1,
      t: o.t || 0,
      pose: o.pose,
    });
    ctx.globalAlpha = 1;
  }

  window.Models = { draw, paint };
})();
