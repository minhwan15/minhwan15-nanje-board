// 사진 첨부와 그리기 판. 이미지는 휴대폰에서 줄여 JPEG 문자열로 저장한다(Firestore 문서 1MB 제한 안쪽).
import { h, toast } from './ui.js';

export const MAX_IMG_CHARS = 450000; // 약 330KB

function canvasToJpeg(canvas) {
  let q = 0.8;
  let url = canvas.toDataURL('image/jpeg', q);
  while (url.length > MAX_IMG_CHARS && q > 0.35) {
    q -= 0.1;
    url = canvas.toDataURL('image/jpeg', q);
  }
  if (url.length > MAX_IMG_CHARS) throw new Error('사진이 너무 커요. 다른 사진을 골라 주세요.');
  return url;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('사진을 읽지 못했어요.'));
    img.src = src;
  });
}

export async function fileToDataUrl(file, max = 1200) {
  if (!file || !/^image\//.test(file.type)) throw new Error('사진 파일만 올릴 수 있어요.');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return canvasToJpeg(c);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 그리기 판: base(사진)가 있으면 그 위에 그린다. 완료하면 onDone(dataUrl) */
export async function openDrawPad(base, onDone) {
  const W = 1200, H = 850;
  const canvas = h('canvas', { width: W, height: H, class: 'pad-canvas', 'aria-label': '그리기 판' });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  let baseImg = null;
  if (base) {
    try {
      baseImg = await loadImage(base);
      const s = Math.min(W / baseImg.naturalWidth, H / baseImg.naturalHeight);
      const w = baseImg.naturalWidth * s, hh = baseImg.naturalHeight * s;
      ctx.drawImage(baseImg, (W - w) / 2, (H - hh) / 2, w, hh);
    } catch (e) { baseImg = null; }
  }
  const history = [ctx.getImageData(0, 0, W, H)];
  let color = '#1E2B30', size = 6, drawing = false, last = null;

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }
  canvas.addEventListener('pointerdown', (e) => {
    drawing = true; last = pos(e); canvas.setPointerCapture(e.pointerId);
    ctx.beginPath(); ctx.fillStyle = color; ctx.arc(last.x, last.y, size / 2, 0, Math.PI * 2); ctx.fill();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p;
  });
  const end = () => {
    if (!drawing) return;
    drawing = false;
    history.push(ctx.getImageData(0, 0, W, H));
    if (history.length > 30) history.splice(1, 1);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  const colors = [['#1E2B30', '검정'], ['#C8352E', '빨강'], ['#2563C9', '파랑'], ['#2E8B57', '초록'], ['#D9622B', '주황'], ['#FFFFFF', '지우개']];
  const colorBtns = colors.map(([c, name]) => {
    const b = h('button', { type: 'button', class: 'swatch', title: name, 'aria-label': name, style: 'background:' + c, 'aria-pressed': String(c === color) });
    b.addEventListener('click', () => { color = c; colorBtns.forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); });
    return b;
  });
  const sizeSel = h('select', { 'aria-label': '굵기' }, [['3', '가늘게'], ['6', '보통'], ['14', '굵게']].map(([v, t]) => h('option', { value: v, text: t, selected: v === '6' })));
  sizeSel.addEventListener('change', () => { size = Number(sizeSel.value); });

  const ov = h('div', { class: 'pad-ov', role: 'dialog', 'aria-label': '그리기' });
  const close = () => ov.remove();
  ov.append(h('div', { class: 'pad' }, [
    h('div', { class: 'pad-tools' }, colorBtns.concat([
      sizeSel,
      h('button', { type: 'button', class: 'btn-ghost', text: '되돌리기', onclick: () => { if (history.length > 1) { history.pop(); ctx.putImageData(history[history.length - 1], 0, 0); } } }),
      h('button', { type: 'button', class: 'btn-ghost', text: '모두 지우기', onclick: () => { ctx.putImageData(history[0], 0, 0); history.length = 1; } }),
      h('span', { class: 'sp' }),
      h('button', { type: 'button', class: 'btn-ghost', text: '취소', onclick: close }),
      h('button', { type: 'button', class: 'btn', text: '완료', onclick: () => {
        try { onDone(canvasToJpeg(canvas)); close(); } catch (e) { toast(e.message); }
      } })
    ])),
    canvas
  ]));
  document.body.appendChild(ov);
}

/** 첨부 위젯: 사진 고르기·찍기, 그리기, 미리보기, 빼기 */
export function attachWidget(initial, optional = true) {
  let value = initial || '';
  const preview = h('div', { class: 'att-preview' });
  const fileIn = h('input', { type: 'file', accept: 'image/*', class: 'hidden-file', 'aria-label': '사진 고르기' });
  const wrap = h('div', { class: 'f attach' });

  function draw() {
    preview.replaceChildren();
    if (value) {
      preview.append(h('img', { src: value, alt: '첨부한 그림' }),
        h('button', { type: 'button', class: 'btn-ghost', text: '첨부 빼기', onclick: () => { value = ''; draw(); } }));
    }
  }
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files && fileIn.files[0];
    fileIn.value = '';
    if (!f) return;
    try { value = await fileToDataUrl(f); draw(); } catch (e) { toast(e.message); }
  });
  wrap.append(
    h('b', null, ['사진·그림 ', h('span', { class: optional ? 'muted' : 'req', text: optional ? '(선택)' : '꼭 올리기' })]),
    h('div', { class: 'choices' }, [
      h('button', { type: 'button', class: 'btn-ghost', text: '사진 찍기·고르기', onclick: () => fileIn.click() }),
      h('button', { type: 'button', class: 'btn-ghost', text: '직접 그리기', onclick: () => openDrawPad(value, (url) => { value = url; draw(); }) })
    ]),
    fileIn, preview
  );
  draw();
  return { el: wrap, get: () => value };
}
