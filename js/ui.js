export const STAGES = [
  { key: 'map', label: '① 원인 마인드맵', short: '마인드맵' },
  { key: 'compare', label: '② AI와 비교', short: 'AI 비교' },
  { key: 'signal', label: '③ 신호등 판정', short: '신호등' },
  { key: 'v1', label: '④ 해결책 v1', short: 'v1' },
  { key: 'rebut', label: '⑤ AI 반론', short: '반론' },
  { key: 'v2', label: '⑥ 해결책 v2', short: 'v2' }
];

export const FIELDS_OF_STUDY = ['물리학', '화학', '생명과학', '지구과학', '공학·정보', '사회·경제'];

export function h(tag, attrs, kids) {
  const el = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach((k) => {
    const v = attrs[k];
    if (v === undefined || v === null || v === false) return;
    if (k === 'text') el.textContent = v;
    else if (k === 'class') el.className = v;
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  });
  [].concat(kids || []).forEach((c) => {
    if (c === null || c === undefined || c === false) return;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return el;
}

export function toast(msg) {
  const t = h('div', { class: 'toast', role: 'status', text: msg });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

export function store(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch (e) { return null; }
  return null;
}

export function param(name) {
  return new URLSearchParams(location.search).get(name) || '';
}

export function demoBanner() {
  return h('div', { class: 'demo', text: '데모 모드: Firebase 설정 전이라 이 브라우저 안에서만 저장돼요. js/config.js에 설정을 넣으면 실시간으로 연결됩니다.' });
}
