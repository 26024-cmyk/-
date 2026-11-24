/* 전투 규칙 — 게임과 밸런스 시뮬레이션이 함께 사용하는 단일 계산원 */
(function (root) {
  'use strict';

  const MAX_ENERGY = 100;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function statsOf(creature, lv) {
    const mult = 1 + 0.28 * (lv - 1);
    return creature.stats.map((v) => Math.round(v * mult));
  }

  function makeFighter(creature, lv, side, scale) {
    const s = scale == null ? 1 : scale;
    const st = statsOf(creature, lv);
    const hp = Math.round(st[0] * s);
    return {
      id: creature.id,
      c: creature,
      side,
      lv,
      name: creature.ko,
      maxHp: hp,
      hp,
      atk: Math.round(st[1] * s),
      def: Math.round(st[2] * s),
      spd: Math.round(st[3] * s),
      energy: 40,
      status: { shield: 0, atkUp: 0, bleed: 0, stun: 0, evade: 0 },
    };
  }

  function rawDamage(a, d, mult, pierce, rng) {
    const atk = a.atk * (a.status.atkUp > 0 ? 1.4 : 1);
    const def = d.def * (1 - (pierce || 0));
    let dmg = atk * 2.6 * (120 / (120 + def)) * mult;
    dmg *= 0.92 + rng() * 0.16;
    if (d.status.shield > 0) dmg *= 0.35;
    return Math.max(8, Math.round(dmg));
  }

  function hit(a, d, mult, pierce, rng) {
    if (d.status.evade > 0 && rng() < 0.45) return { evaded: true, dmg: 0, crit: false };
    const dodge = clamp((d.spd - a.spd) / 500, 0, 0.18);
    if (dodge > 0 && rng() < dodge) return { evaded: true, dmg: 0, crit: false };
    const critChance = clamp((a.spd - d.spd) / 500, 0, 0.2);
    const crit = rng() < critChance;
    const dmg = Math.round(rawDamage(a, d, mult, pierce, rng) * (crit ? 1.5 : 1));
    d.hp = Math.max(0, d.hp - dmg);
    d.energy = Math.min(MAX_ENERGY, d.energy + 7);
    return { evaded: false, dmg, crit };
  }

  function heal(f, amount) {
    const before = f.hp;
    f.hp = Math.min(f.maxHp, f.hp + Math.round(amount));
    return f.hp - before;
  }

  function skill(a, d, rng) {
    const s = a.c.skill;
    const out = { dmg: 0, healed: 0, evaded: false, stolen: 0, applied: s.t };
    switch (s.t) {
      case 'burst': {
        const r = hit(a, d, s.v, 0, rng);
        out.dmg += r.dmg;
        out.evaded = r.evaded;
        break;
      }
      case 'multi': {
        for (let i = 0; i < 2; i++) {
          const r = hit(a, d, s.v * 0.74, 0, rng);
          out.dmg += r.dmg;
          out.evaded = out.evaded || r.evaded;
        }
        break;
      }
      case 'pierce': {
        const r = hit(a, d, s.v, 0.7, rng);
        out.dmg += r.dmg;
        out.evaded = r.evaded;
        break;
      }
      case 'drain': {
        const r = hit(a, d, s.v, 0, rng);
        out.dmg += r.dmg;
        if (r.dmg > 0) out.healed = heal(a, r.dmg * 0.38);
        break;
      }
      case 'bleed': {
        const r = hit(a, d, s.v, 0, rng);
        out.dmg += r.dmg;
        d.status.bleed = 3;
        break;
      }
      case 'stun': {
        const r = hit(a, d, s.v, 0, rng);
        out.dmg += r.dmg;
        d.status.stun = 1;
        break;
      }
      case 'guard': {
        a.status.shield = 2;
        out.healed = heal(a, a.maxHp * 0.06);
        break;
      }
      case 'heal': {
        out.healed = heal(a, a.maxHp * s.v);
        break;
      }
      case 'buff': {
        a.status.atkUp = 3;
        break;
      }
      case 'dodge': {
        a.status.evade = 2;
        break;
      }
      case 'energy': {
        const steal = Math.min(d.energy, s.v);
        d.energy -= steal;
        a.energy = Math.min(MAX_ENERGY, a.energy + steal);
        out.stolen = steal;
        break;
      }
      default: {
        const r = hit(a, d, 1, 0, rng);
        out.dmg += r.dmg;
      }
    }
    return out;
  }

  function aiPick(a, d, rng) {
    const cost = a.c.skill.c;
    if (a.energy >= cost && rng() < 0.72) return 'skill';
    if (a.hp / a.maxHp < 0.32 && rng() < 0.45) return 'guard';
    return 'attack';
  }

  function applyAction(a, d, kind, rng) {
    if (kind === 'attack') {
      a.energy = Math.min(MAX_ENERGY, a.energy + 18);
      return Object.assign({ kind, dmg: 0, evaded: false }, hit(a, d, 1, 0, rng));
    }
    if (kind === 'guard') {
      a.energy = Math.min(MAX_ENERGY, a.energy + 26);
      a.status.shield = 2;
      return { kind, dmg: 0, evaded: false };
    }
    a.energy = Math.max(0, a.energy - a.c.skill.c);
    return Object.assign({ kind: 'skill' }, skill(a, d, rng));
  }

  /* 턴 시작 처리: 출혈 → 지속효과 감소 → 기절 */
  function startTurn(f) {
    const res = { bleed: 0, stunned: false };
    if (f.status.bleed > 0) {
      res.bleed = Math.round(f.maxHp * 0.045 + 10);
      f.hp = Math.max(0, f.hp - res.bleed);
      f.status.bleed -= 1;
    }
    if (f.status.shield > 0) f.status.shield -= 1;
    if (f.status.evade > 0) f.status.evade -= 1;
    if (f.status.atkUp > 0) f.status.atkUp -= 1;
    if (f.status.stun > 0) {
      f.status.stun -= 1;
      res.stunned = true;
    }
    f.energy = Math.min(MAX_ENERGY, f.energy + 5);
    return res;
  }

  function simulate(cA, cB, lvA, lvB, rng, maxTurns) {
    const a = makeFighter(cA, lvA, 'p', 1);
    const b = makeFighter(cB, lvB, 'e', 1);
    let queue = a.spd >= b.spd ? [a, b] : [b, a];
    const limit = maxTurns || 160;
    for (let turn = 0; turn < limit; turn++) {
      if (!queue.length) queue = a.spd >= b.spd ? [a, b] : [b, a];
      const f = queue.shift();
      const o = f === a ? b : a;
      const res = startTurn(f);
      if (f.hp <= 0) return { winner: o.side, turns: turn, hpA: a.hp, hpB: b.hp };
      if (res.stunned) continue;
      const kind = aiPick(f, o, rng);
      const act = applyAction(f, o, kind, rng);
      if (o.hp <= 0) return { winner: f.side, turns: turn, hpA: a.hp, hpB: b.hp };
      if (act.kind === 'attack' && f.hp <= 0) return { winner: o.side, turns: turn, hpA: a.hp, hpB: b.hp };
    }
    return { winner: 'draw', turns: limit, hpA: a.hp, hpB: b.hp };
  }

  function power(c, lv) {
    const st = statsOf(c, lv);
    return Math.round(st[0] * 0.5 + st[1] * 2.4 + st[2] * 1.6 + st[3] * 1.1);
  }

  const api = {
    MAX_ENERGY,
    clamp,
    statsOf,
    makeFighter,
    rawDamage,
    hit,
    heal,
    skill,
    aiPick,
    applyAction,
    startTurn,
    simulate,
    power,
  };

  root.Combat = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
