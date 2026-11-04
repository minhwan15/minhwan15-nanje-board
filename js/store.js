// 데이터 저장소: Firebase Firestore(실시간) 또는 설정 전 데모 모드(이 브라우저 안에서만)
import { firebaseConfig } from './config.js';

export const STAGE_KEYS = ['map', 'compare', 'signal', 'v1', 'rebut', 'v2', 'comment', 'free', 'p1', 'p2', 'p3', 'p4'];
export const isDemo = String(firebaseConfig.apiKey || '').startsWith('YOUR_');

function cleanRoom(room) {
  return String(room || '').trim().replace(/[\/\s#?.\[\]]+/g, '-').slice(0, 40);
}

export async function openRoom(rawRoom) {
  const room = cleanRoom(rawRoom);
  if (!room) throw new Error('수업 코드가 필요해요.');
  return isDemo ? demoStore(room) : firestoreStore(room);
}

async function firestoreStore(room) {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
  const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const app = initializeApp(firebaseConfig);
  const db = fs.getFirestore(app);
  const col = fs.collection(db, 'rooms', room, 'posts');
  const meta = fs.doc(db, 'rooms', room);
  const draftCol = fs.collection(db, 'rooms', room, 'drafts');
  return {
    room,
    // 태블릿마다 지금 쓰고 있는 내용(올리기 전)을 덮어써서 저장 → 교실 화면 '실시간 화면'
    async saveDraft(dev, group, tab, data) {
      await fs.setDoc(fs.doc(draftCol, dev), { dev, group: Number(group), tab, data, updatedAt: fs.serverTimestamp() });
    },
    subscribeDrafts(cb, onError) {
      return fs.onSnapshot(draftCol, (snap) => {
        const list = [];
        snap.forEach((doc) => {
          const v = doc.data();
          const t = v.updatedAt && v.updatedAt.toMillis ? v.updatedAt.toMillis() : Date.now();
          list.push({ dev: v.dev || doc.id, g: v.group, tab: v.tab, d: v.data || {}, t });
        });
        cb(list);
      }, (err) => onError && onError(err));
    },
    // 이 수업 코드가 어떤 활동인지(처음 교실 화면을 연 때 정해짐). 기록이 없으면 null
    async getAct() {
      const snap = await fs.getDoc(meta);
      return snap.exists() ? snap.data().act : null;
    },
    async setAct(act) {
      await fs.setDoc(meta, { act, createdAt: fs.serverTimestamp() });
    },
    async submit(group, stage, data) {
      if (STAGE_KEYS.indexOf(stage) < 0) throw new Error('단계를 확인하세요.');
      await fs.addDoc(col, { group: Number(group), stage, data, createdAt: fs.serverTimestamp() });
    },
    subscribe(cb, onError) {
      return fs.onSnapshot(fs.query(col, fs.orderBy('createdAt')), (snap) => {
        const rows = [];
        snap.forEach((doc) => {
          const v = doc.data();
          const t = v.createdAt && v.createdAt.toMillis ? v.createdAt.toMillis() : Date.now();
          rows.push({ t, g: v.group, s: v.stage, d: v.data || {} });
        });
        cb(rows);
      }, (err) => onError && onError(err));
    }
  };
}

function demoStore(room) {
  const key = 'nanje-demo-' + room;
  const read = () => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } };
  let chan = null;
  try { chan = new BroadcastChannel(key); } catch (e) { chan = null; }
  const listeners = new Set();
  const emit = () => listeners.forEach((cb) => cb(read()));
  if (chan) chan.onmessage = emit;
  window.addEventListener('storage', (e) => { if (e.key === key) emit(); });
  const metaKey = 'nanje-demo-meta-' + room;
  const draftKey = 'nanje-demo-drafts-' + room;
  const readDrafts = () => { try { return JSON.parse(localStorage.getItem(draftKey) || '{}'); } catch (e) { return {}; } };
  const draftListeners = new Set();
  const emitDrafts = () => { const m = readDrafts(); draftListeners.forEach((cb) => cb(Object.keys(m).map((k) => m[k]))); };
  let dchan = null;
  try { dchan = new BroadcastChannel(draftKey); dchan.onmessage = emitDrafts; } catch (e) { dchan = null; }
  return {
    room,
    async saveDraft(dev, group, tab, data) {
      const m = readDrafts();
      m[dev] = { dev, g: Number(group), tab, d: data, t: Date.now() };
      try { localStorage.setItem(draftKey, JSON.stringify(m)); } catch (e) { return; }
      if (dchan) dchan.postMessage('changed');
      emitDrafts();
    },
    subscribeDrafts(cb) { draftListeners.add(cb); emitDrafts(); return () => draftListeners.delete(cb); },
    async getAct() { try { return localStorage.getItem(metaKey); } catch (e) { return null; } },
    async setAct(act) { try { localStorage.setItem(metaKey, act); } catch (e) { /* 무시 */ } },
    async submit(group, stage, data) {
      const rows = read();
      rows.push({ t: Date.now(), g: Number(group), s: stage, d: data });
      try { localStorage.setItem(key, JSON.stringify(rows)); } catch (e) { throw new Error('이 브라우저에 저장할 수 없어요.'); }
      if (chan) chan.postMessage('changed');
      emit();
    },
    subscribe(cb) { listeners.add(cb); cb(read()); return () => listeners.delete(cb); }
  };
}

/** 행 목록 → 모둠·단계별 최신 + 댓글 + 자유 게시 */
export function summarize(rows) {
  const latest = {};
  const comments = [];
  const free = [];
  rows.forEach((r) => {
    if (r.s === 'comment') { comments.push(r); return; }
    if (r.s === 'free') { free.push(r); return; }
    latest[r.g] = latest[r.g] || {};
    const prev = latest[r.g][r.s];
    if (!prev || prev.t <= r.t) latest[r.g][r.s] = { t: r.t, d: r.d };
  });
  return { latest, comments, free };
}
