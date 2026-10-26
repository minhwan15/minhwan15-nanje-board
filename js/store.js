// 데이터 저장소: Firebase Firestore(실시간) 또는 설정 전 데모 모드(이 브라우저 안에서만)
import { firebaseConfig } from './config.js';

export const STAGE_KEYS = ['map', 'compare', 'signal', 'v1', 'rebut', 'v2', 'comment'];
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
  return {
    room,
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
  return {
    room,
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

/** 행 목록 → 모둠·단계별 최신 + 댓글 */
export function summarize(rows) {
  const latest = {};
  const comments = [];
  rows.forEach((r) => {
    if (r.s === 'comment') { comments.push(r); return; }
    latest[r.g] = latest[r.g] || {};
    const prev = latest[r.g][r.s];
    if (!prev || prev.t <= r.t) latest[r.g][r.s] = { t: r.t, d: r.d };
  });
  return { latest, comments };
}
