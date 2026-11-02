// 설정(activities.js)으로 만드는 연습 활동: 학생 입력 폼과 교실 화면 표시
import { h } from './ui.js';

const LIGHTS = [{ v: 'G', t: '초록', cls: 'light-G' }, { v: 'Y', t: '노랑', cls: 'light-Y' }, { v: 'R', t: '빨강', cls: 'light-R' }];
export const LIGHT_NAME = { G: '초록', Y: '노랑', R: '빨강' };

function input(f, value, name) {
  if (f.type === 'area') {
    return h('label', { class: 'f' }, [
      h('span', null, [f.label, f.req ? h('span', { class: 'req', text: '  꼭 쓰기' }) : null]),
      h('textarea', { 'data-k': f.k, placeholder: f.ph || '', rows: f.rows || 2 }, [value || ''])
    ]);
  }
  if (f.type === 'text') {
    return h('label', { class: 'f' }, [f.label, h('input', { type: 'text', 'data-k': f.k, placeholder: f.ph || '', value: value || '' })]);
  }
  if (f.type === 'radio' || f.type === 'light') {
    const opts = f.type === 'light' ? LIGHTS : f.options.map((o) => ({ v: o, t: o }));
    return h('div', { class: 'f' }, [f.label ? h('b', { text: f.label }) : null,
      h('div', { class: 'choices', role: 'radiogroup' }, opts.map((o) =>
        h('label', { class: o.cls || '' }, [h('input', { type: 'radio', name, 'data-k': f.k, value: o.v, checked: value === o.v }), o.t])))]);
  }
  if (f.type === 'checks') {
    const chosen = value || [];
    return h('div', { class: 'f' }, [h('b', { text: f.label }),
      h('div', { class: 'choices' }, f.options.map((o) =>
        h('label', null, [h('input', { type: 'checkbox', 'data-k': f.k, value: o, checked: chosen.indexOf(o) >= 0 }), o])))]);
  }
  return null;
}

/** 단계 입력 폼 요소 목록 */
export function formFields(stage, prev, topic) {
  const out = [h('h2', { text: stage.label })];
  if (stage.hint) out.push(h('div', { class: 'hint' }, [topic ? h('b', { text: topic + '  ' }) : null, stage.hint]));
  stage.fields.forEach((f) => {
    if (f.type === 'rows') {
      const rows = prev.rows || [];
      for (let i = 0; i < f.n; i++) {
        const r = rows[i] || {};
        out.push(h('div', { class: 'row3', 'data-row': i }, [h('h3', { text: f.title(i) })]
          .concat(f.sub.map((s) => input(s, r[s.k], stage.key + '_' + s.k + '_' + i)))));
      }
    } else out.push(input(f, prev[f.k], stage.key + '_' + f.k));
  });
  return out;
}

export function collectFields(stage, box) {
  const o = {};
  const read = (scope, target) => scope.querySelectorAll('[data-k]').forEach((el) => {
    const k = el.dataset.k;
    if (el.type === 'radio') { if (el.checked) target[k] = el.value; }
    else if (el.type === 'checkbox') { target[k] = target[k] || []; if (el.checked) target[k].push(el.value); }
    else target[k] = el.value.trim();
  });
  const rowEls = Array.from(box.querySelectorAll('[data-row]'));
  if (rowEls.length) {
    o.rows = rowEls.map((row) => { const r = {}; read(row, r); return r; });
  }
  // 줄(row) 바깥 입력만 읽기
  box.querySelectorAll('[data-k]').forEach((el) => {
    if (el.closest('[data-row]')) return;
    const k = el.dataset.k;
    if (el.type === 'radio') { if (el.checked) o[k] = el.value; }
    else if (el.type === 'checkbox') { o[k] = o[k] || []; if (el.checked) o[k].push(el.value); }
    else o[k] = el.value.trim();
  });
  return o;
}

export function validateFields(stage, d) {
  for (const f of stage.fields) {
    if (f.type === 'rows' && f.req && !(d.rows || []).some(f.req)) return f.reqMsg;
    if (f.type === 'area' && f.req && !d[f.k]) return f.label + ' 칸을 꼭 적어 주세요.';
    if (f.type === 'checks' && f.min && (d[f.k] || []).length < f.min) return f.minMsg || f.label + ': ' + f.min + '개 이상 골라 주세요.';
  }
  if (stage.needImg && !d.img) return '그림을 그리거나 사진을 올려 주세요.';
  return '';
}

/** 교실 화면 칸 내용 */
export function boardBody(stage, d, pic) {
  const out = [];
  stage.fields.forEach((f) => {
    if (f.type === 'rows') {
      (d.rows || []).forEach((r, i) => {
        if (!f.sub.some((s) => r[s.k] && s.type !== 'light' && s.type !== 'radio')) return;
        const light = r.light;
        const main = f.sub.filter((s) => s.type === 'text').map((s) => r[s.k]).filter(Boolean);
        const tag = f.sub.find((s) => s.type === 'radio');
        const inner = h('div', null, [
          h('div', { class: 'lbl', text: f.title(i) }),
          h('div', { class: 'box' }, [tag && r[tag.k] ? h('span', { class: 'chip', text: r[tag.k] }) : null, main.slice(0, 2).join(' — ')]),
          main[2] ? h('div', { class: 'muted', text: '근거: ' + main[2] }) : null
        ]);
        out.push(light ? h('div', { class: 'sig' }, [h('i', { class: light, 'aria-label': LIGHT_NAME[light] }), inner]) : inner);
      });
    } else if (f.type === 'checks') {
      if ((d[f.k] || []).length) out.push(h('div', null, d[f.k].map((x) => h('span', { class: 'chip', text: x }))));
    } else if (f.type === 'radio') {
      if (d[f.k]) out.push(h('div', null, [h('span', { class: 'pill mvp', style: 'background:var(--teal)', text: (f.label ? f.label + ' ' : '') + d[f.k] })]));
    } else if (d[f.k]) {
      out.push(h('div', null, [h('div', { class: 'lbl', text: f.label }), h('div', { class: 'box' + (stage.final === f.k ? ' v2' : f.req ? ' sci' : ''), text: d[f.k] })]));
    }
  });
  if (d.img) out.push(pic(d.img, stage.short + ' 그림'));
  return out;
}

/** 신호등이 있는 단계에서 판정된 줄 모으기 */
export function lightRows(stage, d) {
  if (!stage.fields.some((f) => f.type === 'rows' && f.sub.some((s) => s.type === 'light'))) return [];
  return (d.rows || []).filter((r) => r.light).map((r) => {
    const f = stage.fields.find((x) => x.type === 'rows');
    const texts = f.sub.filter((s) => s.type === 'text').map((s) => r[s.k]).filter(Boolean);
    return { light: r.light, claim: texts.slice(0, 2).join(' — '), source: texts[2] || '' };
  });
}

/** CSV용 평문 */
export function flatText(stage, d) {
  const parts = [];
  stage.fields.forEach((f) => {
    if (f.type === 'rows') {
      (d.rows || []).forEach((r, i) => {
        const t = f.sub.map((s) => (r[s.k] ? (s.label || (s.type === 'light' ? '판정' : '')) + ': ' + (s.type === 'light' ? LIGHT_NAME[r[s.k]] : r[s.k]) : '')).filter(Boolean).join(', ');
        if (t) parts.push(f.title(i) + ' (' + t + ')');
      });
    } else if (d[f.k] && (!Array.isArray(d[f.k]) || d[f.k].length)) {
      parts.push((f.label || f.k) + ': ' + (Array.isArray(d[f.k]) ? d[f.k].join('·') : d[f.k]));
    }
  });
  return parts.join(' | ');
}
