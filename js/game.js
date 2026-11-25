/* 팔레오 클래시 — 도감 · 전투 · 융합 */
(function () {
  'use strict';

  const C = window.CREATURES;
  const ERAS = window.ERAS;
  const KEY = 'paleo-clash-v1';
  const PACK_COST = 100;
  const PACK_SIZE = 3;
  const MAX_LV = 5;
  const $ = (id) => document.getElementById(id);
  const now = () => performance.now();

  /* ---------------- save ---------------- */
  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.owned) {
          if (typeof parsed.coins !== 'number') parsed.coins = Number(parsed.dna) || 0;
          delete parsed.dna;
          if (typeof parsed.score !== 'number') parsed.score = 0;
          if (typeof parsed.packs !== 'number') parsed.packs = 0;
          if (typeof parsed.name !== 'string') parsed.name = '';
          return parsed;
        }
      }
    } catch (err) {
      /* ignore broken storage */
    }
    const owned = {};
    window.STARTER_IDS.forEach((id) => {
      owned[id] = { n: 1, lv: 1 };
    });
    return { coins: 300, owned, picked: window.STARTER_IDS[0], wins: 0, losses: 0, score: 0, packs: 0, name: '' };
  }

  const save = load();

  function persist() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(save));
    } catch (err) {
      /* ignore */
    }
  }

  /* ---------------- helpers ---------------- */
  const byId = (id) => C.find((c) => c.id === id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function modelOf(c) {
    if (!c._m) {
      const h = hash(c.id);
      c._m = Object.assign({}, c.model, {
        ph: (h % 1000) / 90,
        j: ((h >> 7) % 100) / 100,
      });
    }
    return c._m;
  }

  function statsOf(c, lv) {
    return window.Combat.statsOf(c, lv);
  }

  function stars(n, max) {
    return '★'.repeat(n) + '☆'.repeat(Math.max(0, max - n));
  }

  /* ---------------- tabs ---------------- */
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.tab === name);
    });
    document.querySelectorAll('.screen').forEach((s) => {
      s.classList.toggle('is-active', s.id === 'screen-' + name);
    });
    if (name === 'battle') renderPick();
    if (name === 'fusion') renderFusion();
    if (name === 'shop') renderShop();
    if (name === 'ranks') {
      renderRanks();
      refreshBoard();
      startBoardStream();
    }
  }

  /* ---------------- codex ---------------- */
  let filterEra = 'all';
  let filterText = '';

  function renderCodex() {
    const grid = $('codex-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const query = filterText.trim().toLowerCase();
    const list = C.filter((c) => {
      const eraOk = filterEra === 'all' || c.era === filterEra;
      const textOk =
        !query || c.ko.toLowerCase().includes(query) || c.en.toLowerCase().includes(query);
      return eraOk && textOk;
    });
    const ownedCount = Object.keys(save.owned).length;
    $('codex-meta').textContent = `${list.length}종 표시 · 보유 ${ownedCount}종 · 승리 ${save.wins} / 패배 ${save.losses}`;

    list.forEach((c) => {
      const own = save.owned[c.id];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card' + (own ? '' : ' is-locked');
      card.style.setProperty('--era', ERAS[c.era].tint);
      card.innerHTML =
        '<canvas class="card__art"></canvas>' +
        (own ? '' : '<span class="card__lock">미보유</span>') +
        `<div class="card__name"><strong>${c.ko}</strong><span>${ERAS[c.era].ko}</span></div>` +
        `<div class="card__meta"><span class="stars">${'★'.repeat(c.tier)}</span>` +
        `<span>${own ? `Lv.${own.lv} · ${own.n}마리` : c.period}</span></div>`;
      grid.appendChild(card);
      window.Models.paint(card.querySelector('canvas'), modelOf(c), { locked: !own });
      card.addEventListener('click', () => openDetail(c.id));
    });
  }

  /* ---------------- detail modal ---------------- */
  let modalId = null;
  let modalIsNew = false;

  function statRow(label, value, max, color) {
    return `<div class="stat"><span>${label}</span><i style="width:${Math.round(
      Math.min(100, (value / max) * 100)
    )}%;--c:${color}"></i><b>${value}</b></div>`;
  }

  function openDetail(id, isNew) {
    modalId = id;
    modalIsNew = !!isNew;
    $('modal').hidden = false;
    renderDetail();
  }

  function closeDetail() {
    modalId = null;
    $('modal').hidden = true;
  }

  function renderDetail() {
    const c = byId(modalId);
    if (!c) return;
    const own = save.owned[c.id];
    const lv = own ? own.lv : 1;
    const st = statsOf(c, lv);
    $('modal-body').innerHTML = `
      ${modalIsNew ? '<p class="tag tag--era" style="--era:var(--gold)">새로 발견!</p>' : ''}
      <h2>${c.ko}</h2>
      <p class="latin">${c.en}</p>
      <div class="tagrow">
        <span class="tag tag--era" style="--era:${ERAS[c.era].tint}">${ERAS[c.era].ko} · ${c.period}</span>
        <span class="tag">${c.diet}</span>
        <span class="tag">${c.size}</span>
        <span class="tag">${c.region}</span>
        <span class="tag">${own ? `Lv.${lv} · ${stars(lv, MAX_LV)} · ${own.n}마리` : '미보유'}</span>
      </div>
      <p class="desc">${c.desc}</p>
      ${statRow('체력', st[0], 1500, '#67ab7d')}
      ${statRow('공격', st[1], 160, '#d4675c')}
      ${statRow('방어', st[2], 150, '#5c9fc4')}
      ${statRow('속도', st[3], 130, '#e3b15f')}
      <div class="skillbox">
        <h4>고유 스킬 · ${c.skill.n}<span class="cost">에너지 ${c.skill.c}</span></h4>
        <p>${c.skill.d}</p>
      </div>`;
  }

  /* ---------------- wallet / shop ---------------- */
  function updateWallet() {
    const el = $('coins');
    if (el) el.textContent = save.coins.toLocaleString('ko-KR');
    const btn = $('pack-btn');
    if (btn) btn.disabled = save.coins < PACK_COST;
  }

  function addCreature(id) {
    const own = save.owned[id];
    if (own) own.n += 1;
    else save.owned[id] = { n: 1, lv: 1 };
  }

  function weightedCreature() {
    const weights = { 1: 34, 2: 30, 3: 23, 4: 13 };
    let total = 0;
    C.forEach((c) => {
      total += weights[c.tier];
    });
    let r = Math.random() * total;
    for (let i = 0; i < C.length; i++) {
      r -= weights[C[i].tier];
      if (r <= 0) return C[i];
    }
    return C[0];
  }

  function renderShop() {
    if (!$('shop-coins')) return;
    $('shop-coins').textContent = save.coins.toLocaleString('ko-KR');
    $('shop-opened').textContent = save.packs || 0;
    $('shop-owned').textContent = Object.keys(save.owned).length + ' / ' + C.length;
    $('pack-buy').disabled = save.coins < PACK_COST;
    $('pack-buy').textContent =
      save.coins >= PACK_COST ? `카드팩 열기 · ${PACK_COST} 코인` : `코인 ${PACK_COST} 필요`;
  }

  function buyPack() {
    if (save.coins < PACK_COST) {
      toast(`코인이 부족합니다 · ${PACK_COST} 코인 필요`);
      switchTab('shop');
      return;
    }
    save.coins -= PACK_COST;
    save.packs = (save.packs || 0) + 1;
    const picks = [];
    const fresh = [];
    for (let i = 0; i < PACK_SIZE; i++) {
      const c = weightedCreature();
      fresh.push(!save.owned[c.id]);
      picks.push(c);
      addCreature(c.id);
    }
    persist();
    updateWallet();
    renderCodex();
    renderPick();
    renderFusion();
    renderShop();
    showPack(picks, fresh);
  }

  function showPack(picks, fresh) {
    const box = $('pack-cards');
    box.innerHTML = '';
    picks.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'pack-card';
      el.style.setProperty('--era', ERAS[c.era].tint);
      el.innerHTML =
        '<canvas></canvas>' +
        '<div class="pack-card__body">' +
        `<span class="pack-card__tier">${'★'.repeat(c.tier)}</span>` +
        `<strong>${c.ko}</strong>` +
        `<small>${ERAS[c.era].ko} · ${c.period}</small>` +
        (fresh[i] ? '<em class="pack-card__new">NEW</em>' : '<em class="pack-card__dup">중복 +1</em>') +
        '</div>';
      box.appendChild(el);
      window.Models.paint(el.querySelector('canvas'), modelOf(c), {});
      window.setTimeout(() => el.classList.add('is-open'), 220 + i * 380);
    });
    $('pack-again').disabled = save.coins < PACK_COST;
    $('pack-again').textContent = `한 번 더 · ${PACK_COST} 코인`;
    $('pack-modal').hidden = false;
  }

  function closePack() {
    $('pack-modal').hidden = true;
  }

  /* ---------------- toast ---------------- */
  let toastTimer = 0;
  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      el.hidden = true;
    }, 2200);
  }

  /* ---------------- battle ---------------- */
  let battle = null;
  let battleScale = 1;
  const bcanvas = $('battle-canvas');
  const bctx = bcanvas.getContext('2d');

  function sizeBattle() {
    const rect = bcanvas.getBoundingClientRect();
    const cssW = Math.max(320, rect.width || 900);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    bcanvas.width = Math.round(cssW * dpr);
    bcanvas.height = Math.round(cssW * (420 / 1000) * dpr);
    battleScale = (cssW / 1000) * dpr;
  }

  function makeFighter(id, lv, side, scale) {
    const c = byId(id);
    const fighter = window.Combat.makeFighter(c, lv, side, scale);
    fighter.pose = { kind: 'idle', start: 0 };
    return fighter;
  }

  function randomEnemy(ownId, lv) {
    const myPower = window.Combat.power(byId(ownId), lv);
    const pool = C.filter((c) => c.id !== ownId)
      .map((c) => ({ c, p: window.Combat.power(c, lv) }))
      .sort((a, b) => Math.abs(a.p - myPower) - Math.abs(b.p - myPower));
    const band = pool.slice(0, Math.max(6, Math.round(pool.length * 0.18)));
    return band[Math.floor(Math.random() * band.length)].c;
  }

  function addLog(html, cls) {
    const el = $('log');
    if (!el) return;
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.innerHTML = html;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }

  function addFloater(target, text, color) {
    if (!battle) return;
    const x = target.side === 'p' ? 362 : 638;
    battle.floaters.push({
      x: x + (Math.random() * 36 - 18),
      y: 168 + Math.random() * 16,
      text: String(text),
      color: color || (target.side === 'p' ? '#ff9a90' : '#ffd48a'),
      born: now(),
    });
  }

  function updateHud() {
    if (!battle) return;
    const p = battle.player;
    const e = battle.enemy;
    $('hud-player-name').textContent = p.name;
    $('hud-player-lv').textContent = 'Lv.' + p.lv;
    $('hud-player-hp').style.width = clamp((p.hp / p.maxHp) * 100, 0, 100) + '%';
    $('hud-player-en').style.width = clamp(p.energy, 0, 100) + '%';
    $('hud-enemy-name').textContent = e.name;
    $('hud-enemy-lv').textContent = 'Lv.' + e.lv;
    $('hud-enemy-hp').style.width = clamp((e.hp / e.maxHp) * 100, 0, 100) + '%';
    $('hud-enemy-en').style.width = clamp(e.energy, 0, 100) + '%';
    const skillBtn = $('skill-btn');
    skillBtn.innerHTML = `필살기 <span>에너지 ${p.c.skill.c}</span>`;
    skillBtn.disabled = !(battle.active === 'p' && p.energy >= p.c.skill.c);
    document.querySelectorAll('#actions button').forEach((b) => {
      if (b.dataset.act === 'skill') return;
      b.disabled = battle.active !== 'p' || battle.over;
    });
  }

  function startBattle() {
    const pid = save.picked;
    if (!pid || !save.owned[pid]) {
      toast('먼저 전투에 나설 생물을 선택하세요.');
      return;
    }
    const playerLv = save.owned[pid].lv;
    const enemyC = randomEnemy(pid, playerLv);
    const enemyLv = clamp(playerLv + (Math.random() < 0.22 ? 1 : 0), 1, MAX_LV);

    battle = {
      player: makeFighter(pid, playerLv, 'p', 1),
      enemy: makeFighter(enemyC.id, enemyLv, 'e', 0.96),
      queue: [],
      active: null,
      over: false,
      floaters: [],
      startedAt: now(),
    };

    $('battle-setup').hidden = true;
    $('arena').hidden = false;
    $('result').hidden = true;
    $('log').innerHTML = '';
    sizeBattle();
    updateHud();
    addLog(`<b>${battle.player.name}</b> vs <b>${battle.enemy.name}</b> — 전투 개시!`);
    battle.queue = order();
    window.setTimeout(nextTurn, 500);
  }

  function order() {
    return battle.player.spd >= battle.enemy.spd ? ['p', 'e'] : ['e', 'p'];
  }

  function nextTurn() {
    if (!battle || battle.over) return;
    if (!battle.queue.length) battle.queue = order();
    const side = battle.queue.shift();
    battle.active = side;
    const f = side === 'p' ? battle.player : battle.enemy;

    const st = window.Combat.startTurn(f);
    if (st.bleed > 0) {
      addLog(`${f.name}이(가) 출혈로 <b>${st.bleed}</b> 피해를 입었습니다.`, 'bad');
      addFloater(f, st.bleed, '#e07b6f');
      updateHud();
      if (checkEnd()) return;
    }
    if (st.stunned) {
      battle.active = null;
      addLog(`${f.name}은(는) 기절해 움직일 수 없습니다.`);
      updateHud();
      window.setTimeout(nextTurn, 700);
      return;
    }
    updateHud();

    if (side === 'p') {
      addLog('<b>내 차례</b> — 행동을 선택하세요.');
    } else {
      window.setTimeout(enemyAct, 800);
    }
  }

  function applySkill(a, d) {
    const s = a.c.skill;
    addLog(`<b>${a.name}</b>의 고유 스킬 · ${s.n}!`);
    const r = window.Combat.applyAction(a, d, 'skill', Math.random);
    if (r.dmg > 0) {
      d.pose = { kind: 'hit', start: now() };
      addFloater(d, r.dmg);
      addLog(`${d.name}에게 <b>${r.dmg}</b> 피해`, 'bad');
    } else if (r.evaded) {
      addLog(`${d.name}이(가) 회피했습니다.`, 'good');
    }
    if (r.healed > 0) {
      addFloater(a, '+' + r.healed, '#9fd7b4');
      addLog(`${a.name}이(가) ${r.healed} 회복했습니다.`, 'good');
    }
    if (r.stolen > 0) addLog(`${a.name}이(가) 에너지 <b>${r.stolen}</b>을 흡수했습니다.`, 'good');
    if (s.t === 'bleed') addLog(`${d.name}에게 출혈을 입혔습니다 (3턴).`, 'bad');
    if (s.t === 'stun') addLog(`${d.name}이(가) 기절했습니다!`, 'good');
    if (s.t === 'guard') addLog(`${a.name}이(가) 방어막을 폈습니다 (2턴).`, 'good');
    if (s.t === 'buff') addLog(`${a.name}의 공격력이 상승했습니다 (3턴).`, 'good');
    if (s.t === 'dodge') addLog(`${a.name}이(가) 회피 태세를 취했습니다 (2턴).`, 'good');
    if (s.t === 'pierce') addLog('방어력을 무시하고 꿰뚫었습니다.');
    updateHud();
  }

  function perform(a, d, kind, done) {
    if (kind === 'skill' && a.energy < a.c.skill.c) {
      addLog('에너지가 부족합니다.');
      done();
      return;
    }
    a.pose = { kind: kind === 'guard' ? 'guard' : kind === 'skill' ? 'skill' : 'attack', start: now() };
    updateHud();

    if (kind === 'guard') {
      // 에너지·방어막 모두 공용 전투 코드가 처리합니다.
      window.Combat.applyAction(a, d, 'guard', Math.random);
      addLog(`${a.name}이(가) 방어 태세를 취했습니다. 피해 65% 감소 (2턴)`, 'good');
      updateHud();
      window.setTimeout(() => done(), 520);
      return;
    }

    if (kind === 'attack') {
      window.setTimeout(() => {
        const r = window.Combat.applyAction(a, d, 'attack', Math.random);
        if (r.evaded) {
          addLog(`${d.name}이(가) 공격을 회피했습니다!`, 'good');
          addFloater(d, 'MISS', '#9fd7b4');
        } else {
          d.pose = { kind: 'hit', start: now() };
          addFloater(d, r.crit ? r.dmg + '!' : r.dmg, r.crit ? '#ffd166' : undefined);
          addLog(`${a.name}의 공격 — <b>${r.dmg}</b> 피해${r.crit ? ' <b>(치명타)</b>' : ''}`, 'bad');
        }
        updateHud();
      }, 170);
      window.setTimeout(() => done(), 640);
      return;
    }

    window.setTimeout(() => {
      applySkill(a, d);
      updateHud();
    }, 260);
    window.setTimeout(() => done(), 1000);
  }

  function finishAction() {
    if (!battle || battle.over) return;
    if (checkEnd()) return;
    window.setTimeout(nextTurn, 420);
  }

  function playerAct(kind) {
    if (!battle || battle.over || battle.active !== 'p') return;
    battle.active = null;
    updateHud();
    perform(battle.player, battle.enemy, kind, finishAction);
  }

  function enemyAct() {
    if (!battle || battle.over || battle.active !== 'e') return;
    const e = battle.enemy;
    const action = window.Combat.aiPick(e, battle.player, Math.random);
    battle.active = null;
    updateHud();
    perform(e, battle.player, action, finishAction);
  }

  function checkEnd() {
    if (!battle || battle.over) return true;
    if (battle.enemy.hp <= 0) {
      endBattle(true);
      return true;
    }
    if (battle.player.hp <= 0) {
      endBattle(false);
      return true;
    }
    return false;
  }

  function endBattle(won) {
    battle.over = true;
    battle.active = null;
    updateHud();
    document.querySelectorAll('#actions button').forEach((b) => {
      b.disabled = true;
    });

    let reward = 0;
    let scoreGain = 0;
    let found = null;
    if (won) {
      reward = 35 + battle.enemy.c.tier * 7;
      scoreGain = 12 + battle.enemy.c.tier * 2;
      save.wins += 1;
      if (Math.random() < 0.22) {
        found = weightedCreature();
        addCreature(found.id);
      }
    } else {
      reward = 12;
      scoreGain = -4;
      save.losses += 1;
    }
    save.coins += reward;
    save.score = Math.max(0, (save.score || 0) + scoreGain);
    persist();
    updateWallet();
    renderCodex();
    renderPick();
    renderFusion();
    renderShop();
    renderRanks();

    $('result-title').textContent = won ? '승리!' : '패배';
    $('result-title').style.color = won ? '#e3b15f' : '#d4675c';
    $('result-body').innerHTML =
      `🪙 코인 +${reward} · 순위 점수 ${scoreGain >= 0 ? '+' : ''}${scoreGain}` +
      (found ? `<br>추가 발견: <b>${found.ko}</b> (${ERAS[found.era].ko})` : '') +
      (won ? '<br>상점에서 카드팩을 열어 보세요.' : '<br>다음엔 더 강한 생물로 도전해 보세요.');
    $('result').hidden = false;
  }

  function leaveBattle() {
    battle = null;
    $('arena').hidden = true;
    $('battle-setup').hidden = false;
    $('result').hidden = true;
    renderPick();
  }

  /* ---------------- battle render ---------------- */
  function poseOf(f) {
    const p = f.pose;
    const dur = p.kind === 'attack' ? 460 : p.kind === 'hit' ? 380 : p.kind === 'guard' ? 560 : p.kind === 'skill' ? 1000 : 1;
    if (p.kind === 'idle') return { kind: 'idle', p: 0 };
    const prog = clamp((now() - p.start) / dur, 0, 1);
    if (prog >= 1) {
      f.pose = { kind: 'idle', start: 0 };
      return { kind: 'idle', p: 0 };
    }
    return { kind: p.kind, p: prog };
  }

  function drawFighter(f, x, y, facing, t) {
    const pose = poseOf(f);
    if (pose.kind === 'skill') {
      const r = 110;
      const g = bctx.createRadialGradient(x, y - 90, 10, x, y - 90, r);
      g.addColorStop(0, 'rgba(227,177,95,0.32)');
      g.addColorStop(1, 'rgba(227,177,95,0)');
      bctx.fillStyle = g;
      bctx.beginPath();
      bctx.arc(x, y - 90, r, 0, Math.PI * 2);
      bctx.fill();
    }
    bctx.save();
    bctx.globalAlpha = 0.28;
    bctx.fillStyle = '#000';
    bctx.beginPath();
    bctx.ellipse(x, y + 4, 78, 12, 0, 0, Math.PI * 2);
    bctx.fill();
    bctx.restore();
    window.Models.draw(bctx, modelOf(f.c), {
      x,
      y,
      size: 1.6,
      facing,
      t,
      pose,
    });
  }

  function renderBattle(ts) {
    if (!battle) return;
    const t = ts / 1000;
    bctx.setTransform(battleScale, 0, 0, battleScale, 0, 0);
    bctx.clearRect(0, 0, 1000, 420);

    const g = bctx.createLinearGradient(0, 0, 0, 420);
    g.addColorStop(0, '#0c171d');
    g.addColorStop(0.72, '#132530');
    g.addColorStop(1, '#0a1216');
    bctx.fillStyle = g;
    bctx.fillRect(0, 0, 1000, 420);

    // horizon glow
    const eraTint = ERAS[battle.enemy.c.era].tint;
    bctx.globalAlpha = 0.16;
    bctx.fillStyle = eraTint;
    bctx.beginPath();
    bctx.arc(760, 240, 250, 0, Math.PI * 2);
    bctx.fill();
    bctx.globalAlpha = 0.1;
    bctx.fillStyle = ERAS[battle.player.c.era].tint;
    bctx.beginPath();
    bctx.arc(250, 250, 230, 0, Math.PI * 2);
    bctx.fill();
    bctx.globalAlpha = 1;

    // hills
    bctx.fillStyle = '#15242c';
    for (let i = 0; i < 5; i++) {
      bctx.beginPath();
      bctx.ellipse(120 + i * 230, 372, 150, 66, 0, Math.PI, Math.PI * 2);
      bctx.fill();
    }

    // ground
    bctx.fillStyle = '#1a2b33';
    bctx.fillRect(0, 350, 1000, 70);
    bctx.strokeStyle = '#35505d';
    bctx.lineWidth = 2;
    bctx.beginPath();
    bctx.moveTo(0, 350);
    bctx.lineTo(1000, 350);
    bctx.stroke();
    bctx.strokeStyle = 'rgba(90,160,176,0.22)';
    bctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const x = i * 66 + 12;
      bctx.beginPath();
      bctx.moveTo(x, 372 + (i % 3) * 8);
      bctx.lineTo(x + 26, 372 + (i % 3) * 8);
      bctx.stroke();
    }

    drawFighter(battle.player, 250, 350, 1, t);
    drawFighter(battle.enemy, 750, 350, -1, t);

    // damage numbers
    for (let i = battle.floaters.length - 1; i >= 0; i--) {
      const f = battle.floaters[i];
      const age = (now() - f.born) / 950;
      if (age >= 1) {
        battle.floaters.splice(i, 1);
        continue;
      }
      bctx.globalAlpha = 1 - age * age;
      bctx.font = '700 30px ui-monospace, SFMono-Regular, Menlo, monospace';
      bctx.textAlign = 'center';
      bctx.fillStyle = f.color;
      bctx.fillText(f.text, f.x, f.y - age * 56);
      bctx.globalAlpha = 1;
    }

    // turn tag
    bctx.font = '600 12px system-ui, sans-serif';
    bctx.textAlign = 'center';
    bctx.fillStyle = 'rgba(200,220,230,0.5)';
    bctx.fillText(
      battle.over ? 'BATTLE OVER' : battle.active === 'p' ? 'YOUR TURN' : 'ENEMY TURN',
      500,
      30
    );
  }

  /* ---------------- pick row ---------------- */
  function renderPick() {
    const row = $('pick-row');
    if (!row) return;
    row.innerHTML = '';
    const list = Object.keys(save.owned)
      .map(byId)
      .filter(Boolean)
      .sort((a, b) => b.tier - a.tier || a.ko.localeCompare(b.ko));

    if (!list.length) {
      row.innerHTML = '<p class="empty">보유한 생물이 없습니다. 화석을 발굴해 보세요.</p>';
      $('battle-start').disabled = true;
      return;
    }
    if (!save.owned[save.picked]) save.picked = list[0].id;

    list.forEach((c) => {
      const own = save.owned[c.id];
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'pick' + (save.picked === c.id ? ' is-active' : '');
      el.innerHTML =
        '<canvas></canvas>' +
        `<strong>${c.ko}</strong>` +
        `<span>Lv.${own.lv} ${'★'.repeat(own.lv)} · ${c.period}</span>`;
      row.appendChild(el);
      window.Models.paint(el.querySelector('canvas'), modelOf(c), {});
      el.addEventListener('click', () => {
        save.picked = c.id;
        persist();
        renderPick();
      });
    });
    $('battle-start').disabled = false;
  }

  /* ---------------- fusion ---------------- */
  function renderFusion() {
    const box = $('fusion-list');
    if (!box) return;
    box.innerHTML = '';
    const all = Object.keys(save.owned)
      .map(byId)
      .filter(Boolean)
      .sort((a, b) => {
        const oa = save.owned[a.id];
        const ob = save.owned[b.id];
        const ra = oa.n >= 2 && oa.lv < MAX_LV ? 0 : 1;
        const rb = ob.n >= 2 && ob.lv < MAX_LV ? 0 : 1;
        return ra - rb || ob.lv - oa.lv || b.tier - a.tier || a.ko.localeCompare(b.ko);
      });

    const ready = all.filter((c) => save.owned[c.id].n >= 2 && save.owned[c.id].lv < MAX_LV).length;
    const summary = $('fusion-summary');
    if (summary) {
      summary.textContent = `보유 ${all.length}종 · 지금 융합 가능 ${ready}종 · 같은 종 2마리로 ★5까지 강화`;
    }
    if (!all.length) {
      box.innerHTML = '<p class="empty">보유한 생물이 없습니다.<br>상점에서 카드팩을 열어 생물을 모아 보세요.</p>';
      return;
    }

    all.forEach((c) => {
      const own = save.owned[c.id];
      const maxed = own.lv >= MAX_LV;
      const can = own.n >= 2 && !maxed;
      const cur = statsOf(c, own.lv);
      const next = statsOf(c, Math.min(MAX_LV, own.lv + 1));
      const row = document.createElement('div');
      row.className = 'fuse-row' + (can ? '' : ' is-idle');
      const note = maxed
        ? '★5 최대 강화 완료'
        : can
        ? `Lv.${own.lv} → Lv.${own.lv + 1}`
        : '같은 생물 1마리 더 필요';
      const detail = maxed
        ? `체력 ${cur[0]} · 공격 ${cur[1]} · 보유 ${own.n}마리`
        : `체력 ${cur[0]} → ${next[0]} · 공격 ${cur[1]} → ${next[1]} · 보유 ${own.n}마리`;
      row.innerHTML =
        '<canvas></canvas>' +
        `<div><h3>${c.ko} <span class="stars">${stars(own.lv, MAX_LV)}</span></h3>` +
        `<p>${note} · ${detail}</p></div>` +
        `<button type="button" ${can ? '' : 'disabled'}>${
          maxed ? '최대' : can ? '융합하기' : '재료 부족'
        }</button>`;
      box.appendChild(row);
      window.Models.paint(row.querySelector('canvas'), modelOf(c), {});
      if (can) row.querySelector('button').addEventListener('click', () => fuse(c.id));
    });
  }

  function fuse(id) {
    const c = byId(id);
    const own = save.owned[id];
    if (!own || own.n < 2 || own.lv >= MAX_LV) return;
    own.n -= 1;
    own.lv += 1;
    persist();
    updateWallet();
    renderFusion();
    renderCodex();
    renderPick();
    toast(`${c.ko} ★${own.lv} 융합 완료!`);
    if (modalId === id) renderDetail();
  }

  /* ---------------- ranks ---------------- */
  const BOARD_KEY = 'paleo-clash-board-v1';
  let boardStream = null;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
    );
  }

  function myEntry() {
    return {
      name: (save.name || '').trim() || '고생물학자',
      score: save.score || 0,
      wins: save.wins || 0,
      packs: save.packs || 0,
      at: Date.now(),
    };
  }

  function localBoard() {
    let list = [];
    try {
      list = JSON.parse(window.localStorage.getItem(BOARD_KEY)) || [];
    } catch (err) {
      list = [];
    }
    const me = myEntry();
    const i = list.findIndex((e) => e.name === me.name);
    if (i >= 0) list[i] = me;
    else list.push(me);
    list.sort((a, b) => b.score - a.score);
    try {
      window.localStorage.setItem(BOARD_KEY, JSON.stringify(list.slice(0, 20)));
    } catch (err) {
      /* ignore */
    }
    return list.slice(0, 20);
  }

  function renderBoard(entries) {
    const list = $('rank-list');
    if (!list) return;
    list.innerHTML = '';
    if (!entries || !entries.length) {
      list.innerHTML = '<p class="empty">아직 기록이 없습니다. 첫 기록의 주인이 되어 보세요.</p>';
      return;
    }
    const me = myEntry().name;
    entries.slice(0, 20).forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'rank-row' + (e.name === me ? ' is-me' : '');
      row.innerHTML =
        `<span class="rank-row__no">${i + 1}</span>` +
        `<strong>${escapeHtml(e.name)}</strong>` +
        `<span class="rank-row__wins">${e.wins || 0}승</span>` +
        `<b>${(e.score || 0).toLocaleString('ko-KR')}</b>`;
      list.appendChild(row);
    });
  }

  function renderRanks() {
    const nameInput = $('rank-name');
    if (nameInput && !nameInput.value) nameInput.value = save.name || '';
    const me = $('rank-me');
    if (me) me.textContent = `${save.wins}승 ${save.losses}패 · ${(save.score || 0).toLocaleString('ko-KR')}점`;
  }

  async function refreshBoard() {
    const status = $('rank-status');
    if (!status) return;
    if (!window.Online || !window.Online.enabled()) {
      status.textContent = '로컬 기록 모드 — 서버 주소를 연결하면 다른 플레이어와 실시간으로 겨룰 수 있습니다.';
      status.className = 'rank-status is-local';
      renderBoard(localBoard());
      return;
    }
    status.textContent = '순위를 불러오는 중…';
    status.className = 'rank-status';
    try {
      const data = await window.Online.leaderboard();
      renderBoard(data.entries || []);
      status.textContent = `실시간 연결됨 · ${(data.entries || []).length}명 참가`;
      status.className = 'rank-status is-online';
    } catch (err) {
      status.textContent = '서버에 연결할 수 없어 로컬 기록을 표시합니다.';
      status.className = 'rank-status is-local';
      renderBoard(localBoard());
    }
  }

  async function submitScore() {
    const input = $('rank-name');
    const name = (input.value || '').trim().slice(0, 12);
    if (!name) {
      toast('닉네임을 입력하세요.');
      input.focus();
      return;
    }
    save.name = name;
    persist();
    renderRanks();
    if (!window.Online || !window.Online.enabled()) {
      renderBoard(localBoard());
      toast('로컬 기록에 저장했습니다. 서버를 연결하면 전체 순위에 올라갑니다.');
      return;
    }
    const btn = $('rank-submit');
    btn.disabled = true;
    try {
      const data = await window.Online.submit(myEntry());
      renderBoard(data.entries || []);
      toast('기록을 올렸습니다!');
    } catch (err) {
      renderBoard(localBoard());
      toast('전송 실패 — 로컬 기록으로 대체했습니다.');
    } finally {
      btn.disabled = false;
    }
  }

  function startBoardStream() {
    if (boardStream || !window.Online || !window.Online.enabled()) return;
    boardStream = window.Online.subscribe((data) => {
      if (data && data.entries) renderBoard(data.entries);
    });
  }

  /* ---------------- main loop ---------------- */
  function frame(ts) {
    if (battle) renderBattle(ts);
    if (modalId) {
      const c = byId(modalId);
      if (c) {
        window.Models.paint($('detail-canvas'), modelOf(c), {
          t: ts / 1000,
          zoom: 1.1,
        });
      }
    }
    window.requestAnimationFrame(frame);
  }

  /* ---------------- events ---------------- */
  document.querySelectorAll('.tab').forEach((b) => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });

  $('era-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    filterEra = btn.dataset.era;
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === btn));
    renderCodex();
  });

  $('search').addEventListener('input', (e) => {
    filterText = e.target.value;
    renderCodex();
  });

  $('pack-btn').addEventListener('click', () => {
    switchTab('shop');
    renderShop();
  });
  $('pack-buy').addEventListener('click', buyPack);
  $('pack-again').addEventListener('click', () => {
    closePack();
    buyPack();
  });
  $('pack-ok').addEventListener('click', closePack);
  $('pack-close').addEventListener('click', closePack);
  $('pack-modal').addEventListener('click', (e) => {
    if (e.target === $('pack-modal')) closePack();
  });
  $('rank-submit').addEventListener('click', submitScore);
  $('rank-refresh').addEventListener('click', refreshBoard);
  $('rank-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitScore();
  });

  $('battle-start').addEventListener('click', startBattle);

  $('actions').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn || btn.disabled) return;
    if (btn.dataset.act === 'flee') {
      leaveBattle();
      return;
    }
    if (btn.dataset.act === 'skill' && battle && battle.player.energy < battle.player.c.skill.c) {
      return;
    }
    playerAct(btn.dataset.act);
  });

  $('result-again').addEventListener('click', () => {
    $('result').hidden = true;
    leaveBattle();
    startBattle();
  });

  $('result-leave').addEventListener('click', () => {
    leaveBattle();
    switchTab('codex');
  });

  $('modal-close').addEventListener('click', closeDetail);
  $('modal').addEventListener('click', (e) => {
    if (e.target === $('modal')) closeDetail();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalId) closeDetail();
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    if (battle) sizeBattle();
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      renderCodex();
    }, 220);
  });

  /* ---------------- boot ---------------- */
  updateWallet();
  renderCodex();
  renderPick();
  renderFusion();
  renderShop();
  renderRanks();
  window.requestAnimationFrame(frame);
})();
