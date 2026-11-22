  /* ---------- State ---------- */
  const state = {
    clientId: store.get('client', 'nordlys'),
    range: store.get('range', 28),
    page: 'overview', ovFox: 'paid', bubFox: 'all',
    recFilter: 'all', recSort: 'value', showDone: false,
    open: new Set(), whyOpen: new Set(), dismissing: null, rule: 'lc',
  };
  const cache = {};

  /* ---------- Recommendation ledger: a shared system of record ----------
     With the db capability, every status (adopted, requested, snoozed, dismissed, verified) is one
     shared document per action at clients/<client>/ledger/<action id>, so every viewer sees the
     same history. Without it (e.g. opened outside claude.ai), it falls back to this browser only. */
  const shared = {};
  let db = null, uid = null, ledgerMode = 'local'; // 'local' | 'shared' | 'readonly'
  // Real clients' data arrives from the shared store: 'loading' until it does, 'nodb' outside claude.ai,
  // 'empty' when nothing has been exported yet, 'error' when the read is refused.
  const realStatus = {};
  for (const cfg of GF.CLIENTS) if (cfg.real) realStatus[cfg.id] = 'loading';
  const S = cid => (shared[cid] = shared[cid] || { status: store.get('status.' + cid, {}), qdec: store.get('quarantine.' + cid, {}) });
  // Changes the customer logs themselves (a promotion, a launch, a price change), at clients/<client>/changes/<id>
  const CHG = {};
  const chg = cid => (CHG[cid] = CHG[cid] || store.get('changes.' + cid, {}));
  async function writeDoc(cid, coll, id, val) {
    if (ledgerMode === 'local') {
      if (coll === 'changes') store.set('changes.' + cid, chg(cid));
      else store.set((coll === 'ledger' ? 'status.' : 'quarantine.') + cid, coll === 'ledger' ? S(cid).status : S(cid).qdec);
      return;
    }
    if (ledgerMode === 'readonly' || !db) return;
    try {
      const ref = db.doc(`clients/${cid}/${coll}/${id}`);
      if (val == null) await ref.delete(); else await ref.set(val);
    } catch (e) {
      if (e && e.code === 'invalid_argument') { ledgerMode = 'readonly'; toast('You can view this ledger, but not change it.'); render(); }
      else toast('Couldn’t save to the shared ledger. Please try again.');
    }
  }

  /* ---------- Business profile (Executive Fox), one shared document per client at clients/<client>/profile/business ----------
     Read by the engine through GF.profileOf(); this file only stores it. Without the shared store it stays in this browser. */
  const profVer = {};
  function putProfile(cid, doc) { GF.setProfile(cid, doc); profVer[cid] = (profVer[cid] || 0) + 1; }
  for (const cfg of GF.CLIENTS) putProfile(cfg.id, store.get('profile.' + cfg.id, null));
  async function saveProfile(cid, doc) {
    putProfile(cid, doc);
    if (ledgerMode === 'local') { store.set('profile.' + cid, doc); return true; }
    if (ledgerMode === 'readonly' || !db) return false;
    try { await db.doc(`clients/${cid}/profile/business`).set(doc); return true; }
    catch (e) { if (e && e.code === 'invalid_argument') ledgerMode = 'readonly'; return false; }
  }
