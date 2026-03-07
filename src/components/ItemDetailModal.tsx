/* ─── Overlay ───────────────────────────────────────────────── */
.overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}

/* ─── Modal shell ───────────────────────────────────────────── */
.modal {
  background: #fff;
  border-radius: 16px;
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px rgba(0,0,0,0.25);
}

/* ─── Hero image / emoji area ───────────────────────────────── */
.hero {
  position: relative;
  height: 200px;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.heroEmoji { font-size: 5rem; }
.heroCover {
  position: absolute; inset: 0;
  width: 100%; height: 100%; object-fit: cover;
}
.closeBtn {
  position: absolute; top: 0.75rem; right: 0.75rem;
  background: rgba(0,0,0,0.45); color: #fff;
  border: none; border-radius: 50%;
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 1rem; line-height: 1;
  transition: background 0.15s; backdrop-filter: blur(4px);
}
.closeBtn:hover { background: rgba(0,0,0,0.65); }
.statusBadge { position: absolute; top: 0.75rem; left: 0.75rem; }

/* ─── Scrollable body ───────────────────────────────────────── */
.body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

/* ─── Pill row ──────────────────────────────────────────────── */
.pillRow { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.85rem; }
.pill {
  display: inline-flex; align-items: center; gap: 0.25rem;
  padding: 0.15rem 0.55rem; border-radius: 20px;
  font-size: 0.72rem; font-weight: 500;
}
.pillCategory { background: var(--cream); color: var(--muted); }
.pillOffer    { background: #E8F5E9; color: var(--sage); }
.pillCondition { background: #FFF8E1; color: #B8860B; }

/* ─── Title / author ────────────────────────────────────────── */
.title  { font-family: 'Fraunces', serif; font-size: 1.35rem; font-weight: 600; line-height: 1.25; margin-bottom: 0.2rem; }
.author { font-size: 0.88rem; color: var(--muted); margin-bottom: 0.4rem; }

/* ─── Metadata row ──────────────────────────────────────────── */
.meta { font-size: 0.82rem; color: var(--muted); margin-bottom: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }
.metaDot { opacity: 0.4; }

/* ─── Notes ─────────────────────────────────────────────────── */
.notes {
  background: var(--cream); border-radius: 8px;
  padding: 0.85rem 1rem; font-size: 0.85rem; color: var(--bark);
  line-height: 1.6; margin-bottom: 1rem; font-style: italic;
}

/* ─── Owner row ─────────────────────────────────────────────── */
.ownerRow {
  display: flex; align-items: center; gap: 0.65rem;
  padding: 0.85rem 1rem; background: var(--cream);
  border-radius: 10px; margin-bottom: 1.25rem;
}
.ownerInfo { flex: 1; }
.ownerName  { font-size: 0.9rem; font-weight: 600; }
.ownerTrust { font-size: 0.78rem; color: var(--gold); }

/* ─── Actions ───────────────────────────────────────────────── */
.actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.actions .btn { flex: 1; min-width: 120px; }

/* ─── Mobile: slide up from bottom ─────────────────────────── */
@media (max-width: 600px) {
  .overlay {
    align-items: flex-end;
    padding: 0;
  }
  .modal {
    border-radius: 20px 20px 0 0;
    max-width: 100%;
    max-height: 92vh;
    /* snap to bottom safely */
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .hero { height: 180px; }
}
