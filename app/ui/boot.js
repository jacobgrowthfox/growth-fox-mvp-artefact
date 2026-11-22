/* Start-up: runs last, after every other file has loaded. */
  // Real clients: give up waiting for the shared store after 12 s
  setTimeout(() => { let ch = false; for (const k in realStatus) if (realStatus[k] === 'loading') { realStatus[k] = 'nodb'; ch = true; } if (ch) render(); }, 12000);

  // Connect the shared store (ledger, decisions, changes, real-client data) when opened in claude.ai
  (async () => {
    const noDb = () => {
      // Local tests only: tools/smoke.js can hand in fixture documents shaped like a real client's export.
      const fx = window.__gfFixture;
      if (fx && typeof fx === 'object') for (const [id, docs] of Object.entries(fx)) if (realStatus[id] === 'loading' && GF.setReal(id, docs)) { realStatus[id] = 'ready'; delete cache[id]; }
      for (const k in realStatus) if (realStatus[k] === 'loading') realStatus[k] = 'nodb'; render();
    };
    if (!window.claude || typeof window.claude.use !== 'function') return noDb();
    let d = null, u = null;
    try { [d, u] = await Promise.all([window.claude.use('db'), window.claude.use('user')]); } catch (e) { return noDb(); }
    if (!d) return noDb();
    db = d; ledgerMode = 'shared';
    try { uid = u ? await u.id() : null; } catch (e) { /* no id */ }
    try { if (u && (await u.can('data.write')) === false) ledgerMode = 'readonly'; } catch (e) { /* not told: let writes decide */ }
    for (const cfg of GF.CLIENTS) {
      shared[cfg.id] = { status: {}, qdec: {} };
      db.collection(`clients/${cfg.id}/ledger`).onSnapshot(snap => {
        const o = {}; for (const x of snap.docs) o[x.id] = x.data(); shared[cfg.id].status = o; render();
      }, () => {});
      db.doc(`clients/${cfg.id}/settings/revenue`).onSnapshot(d => {
        const v = d && d.exists && d.data() ? d.data().model : null;
        if (v) { state.revModel = state.revModel || {}; state.revModel[cfg.id] = v; render(); }
      }, () => {});
      db.collection(`clients/${cfg.id}/decisions`).onSnapshot(snap => {
        const o = {}; for (const x of snap.docs) o[x.id] = x.data().value; shared[cfg.id].qdec = o; render();
      }, () => {});
      db.doc(`clients/${cfg.id}/profile/business`).onSnapshot(d => { putProfile(cfg.id, d && d.exists ? d.data() : null); render(); }, () => {});
      CHG[cfg.id] = {};
      db.collection(`clients/${cfg.id}/changes`).onSnapshot(snap => {
        const o = {}; for (const x of snap.docs) o[x.id] = x.data(); CHG[cfg.id] = o; render();
      }, () => {});
      if (cfg.real) db.collection(`clients/${cfg.id}/gads`).onSnapshot(snap => {
        const docs = {}; for (const x of snap.docs) docs[x.id] = x.data();
        if (GF.setReal(cfg.id, docs)) { realStatus[cfg.id] = 'ready'; delete cache[cfg.id]; } else realStatus[cfg.id] = 'empty';
        render();
      }, () => { realStatus[cfg.id] = 'error'; render(); });
    }
    render();
  })();

  window.addEventListener('hashchange', route);
  route();
