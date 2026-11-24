/* 팔레오 클래시 — 온라인 순위 클라이언트 */
(function () {
  'use strict';

  const cfg = window.PALEO_CONFIG || {};
  const base = String(cfg.apiBase || '').replace(/\/+$/, '');

  function enabled() {
    return base.length > 0;
  }

  async function leaderboard() {
    const res = await window.fetch(base + '/api/leaderboard', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function submit(entry) {
    const res = await window.fetch(base + '/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function subscribe(onData) {
    if (!enabled() || !window.EventSource) return null;
    const es = new window.EventSource(base + '/api/stream');
    es.onmessage = (ev) => {
      try {
        onData(JSON.parse(ev.data));
      } catch (err) {
        /* ignore malformed frame */
      }
    };
    return es;
  }

  window.Online = { enabled, leaderboard, submit, subscribe, base };
})();
