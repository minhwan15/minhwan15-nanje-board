import { TOPICS, SCIENCE_HINTS } from './config.js';
import { openRoom, summarize, isDemo } from './store.js';
import { STAGES, FIELDS_OF_STUDY, h, toast, store, param, demoBanner } from './ui.js';
import { attachWidget } from './media.js';

const root = document.getElementById('app');
const roomCode = param('room');

if (!roomCode) showJoin(); else start(roomCode);

function showJoin() {
  const input = h('input', { type: 'text', id: 'room', placeholder: '예: 6반', 'aria-label': '수업 코드' });
  const go = () => {
    const v = input.value.trim();
    if (!v) { toast('수업 코드를 입력하세요'); return; }
    location.search = '?room=' + encodeURIComponent(v);
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  root.replaceChildren(h('main', { class: 'setup' }, [
    h('h1', null, [h('small', { class: 'kicker', text: '융합과학 탐구' }), '난제 해결 라이브 보드']),
    h('p', { class: 'muted', text: '칠판에 적힌 수업 코드를 입력하거나 화면의 QR 코드를 찍어 주세요.' }),
    h('div', { class: 'join' }, [input, h('button', { type: 'button', text: '들어가기', onclick: go })]),
    isDemo ? demoBanner() : null
  ]));
}

async function start(code) {
  let room;
  try { room = await openRoom(code); } catch (e) {
    root.replaceChildren(h('main', { class: 's-wrap' }, [h('div', { class: 'err', text: '연결하지 못했어요: ' + e.message })]));
    return;
  }
  const keyG = 'nb_group_' + room.room;
  let group = Number(store(keyG)) || 0;
  let tab = store('nb_tab') || 'map';
  let summary = { latest: {}, comments: [], free: [] };
  let att = null; // 현재 폼의 사진·그림 첨부

  const headBox = h('div');
  const formBox = h('div');
  root.replaceChildren(h('main', { class: 's-wrap' }, [isDemo ? demoBanner() : null, headBox, formBox]));

  const mine = () => summary.latest[group] || {};
  const prevData = () => (mine()[tab] && mine()[tab].d) || {};

  function renderHead() {
    const tabs = STAGES.concat([{ key: 'comment', label: '댓글 평가' }, { key: 'free', label: '자유 게시(사진·그림)' }]);
    headBox.replaceChildren(h('header', { class: 's-head' }, [
      h('h1', null, [h('small', { class: 'kicker', text: '융합과학 탐구' }), '난제 해결 라이브 보드']),
      h('div', { class: 'room', text: '수업 코드 ' + room.room }),
      h('div', { class: 'muted', text: '우리 모둠을 고르고, 단계가 끝날 때마다 올리면 앞 화면에 바로 떠요.' }),
      h('div', { class: 'groups', role: 'group', 'aria-label': '모둠 선택' }, TOPICS.map((t, i) =>
        h('button', { type: 'button', 'aria-pressed': String(group === i + 1), onclick: () => { group = i + 1; store(keyG, String(group)); renderAll(); } },
          [h('b', { text: (i + 1) + '모둠' }), h('span', { text: t })]))),
      group ? h('nav', { class: 'tabs', role: 'tablist' }, tabs.map((s) =>
        h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === s.key), class: (mine()[s.key] || (s.key === 'free' && summary.free.some((f) => f.g === group))) ? 'done' : '', text: s.label,
          onclick: () => { tab = s.key; store('nb_tab', tab); renderAll(); } }))) : null
    ]));
  }

  function area(k, label, opts = {}) {
    return h('label', { class: 'f' }, [
      h('span', null, [label, opts.req ? h('span', { class: 'req', text: '  꼭 쓰기' }) : null]),
      h('textarea', { id: 'f_' + tab + '_' + k, 'data-k': k, placeholder: opts.ph || '', rows: opts.rows || 2 }, [prevData()[k] || ''])
    ]);
  }
  function text(k, label, ph, value) {
    return h('label', { class: 'f' }, [label, h('input', { type: 'text', 'data-k': k, placeholder: ph || '', value: value || '' })]);
  }
  function radios(k, options, value, row) {
    return h('div', { class: 'choices', role: 'radiogroup' }, options.map((o) =>
      h('label', { class: o.cls || '' }, [h('input', { type: 'radio', name: tab + '_' + k + '_' + row, 'data-k': k, value: o.v, checked: value === o.v }), o.t])));
  }

  function fields() {
    const topic = TOPICS[group - 1] || '';
    const d = prevData();
    if (tab === 'map') return [
      h('h2', { text: '① 원인 마인드맵' }),
      h('div', { class: 'hint' }, [h('b', { text: topic + ' 과학 개념 힌트  ' }), SCIENCE_HINTS[topic] || '']),
      area('env', '환경 원인'), area('eco', '경제 원인'), area('soc', '사회 원인'), area('tech', '기술 원인'),
      area('science', '핵심 과학 원리 한 가지 (교과서 쪽수와 함께)', { req: true, rows: 3, ph: '예: 온실 가스가 늘어 지구가 더워지면 빙하가 녹는다 — 교과서 163쪽' })
    ];
    if (tab === 'compare') return [
      h('h2', { text: '② AI 마인드맵과 비교' }),
      h('div', { class: 'hint', text: '카드 ①로 AI 마인드맵을 받은 뒤, 우리 마인드맵과 나란히 놓고 비교해요.' }),
      area('common', '공통점'), area('aiOnly', 'AI만 말한 것'), area('usOnly', '우리만 말한 것')
    ];
    if (tab === 'signal') {
      const rows = d.rows || [];
      return [h('h2', { text: '③ AI 주장 신호등 판정' }),
        h('div', { class: 'hint', text: '초록: 교과서·공공기관 자료에서 확인 / 노랑: 확인할 자료를 못 찾음 / 빨강: 자료와 다르거나 출처가 없음' })]
        .concat([0, 1, 2].map((i) => {
          const r = rows[i] || {};
          return h('div', { class: 'row3', 'data-row': i }, [
            h('h3', { text: 'AI 주장 ' + (i + 1) }),
            text('claim', '주장', 'AI가 말한 내용', r.claim),
            text('source', '확인한 자료', '예: 교과서 165쪽, 통계청 KOSIS', r.source),
            radios('light', [{ v: 'G', t: '초록', cls: 'light-G' }, { v: 'Y', t: '노랑', cls: 'light-Y' }, { v: 'R', t: '빨강', cls: 'light-R' }], r.light, i)
          ]);
        }));
    }
    if (tab === 'v1') {
      const chosen = d.fields || [];
      return [
        h('h2', { text: '④ 해결책 v1' }),
        h('div', { class: 'hint', text: '교과서 168~169쪽의 융합 기술을 참고해요. 어떤 학문이 융합되는지 2개 이상 고르고, 작동 원리를 적어요.' }),
        area('solution', '해결책 한 문장', { req: true }),
        h('div', { class: 'f' }, [h('b', { text: '융합되는 학문 (2개 이상)' }),
          h('div', { class: 'choices' }, FIELDS_OF_STUDY.map((f) =>
            h('label', null, [h('input', { type: 'checkbox', 'data-k': 'fields', value: f, checked: chosen.indexOf(f) >= 0 }), f])))]),
        area('principle', '이 기술이 작동하는 과학 원리', { req: true, rows: 3 })
      ];
    }
    if (tab === 'rebut') {
      const rows = d.rows || [];
      return [h('h2', { text: '⑤ AI 반론과 우리의 판단' }),
        h('div', { class: 'hint', text: '카드 ③으로 받은 반론을 요약하고, 수용할지 반박할지 정해요. 하나는 반드시 반박!' })]
        .concat(['사회', '경제', '윤리'].map((a, i) => {
          const r = rows[i] || {};
          return h('div', { class: 'row3', 'data-row': i }, [
            h('h3', { text: a + ' 측면 반론' }),
            text('summary', 'AI 반론 요약', '', r.summary),
            radios('decision', [{ v: '수용', t: '수용' }, { v: '반박', t: '반박' }], r.decision, i),
            text('reason', '이유·근거', '', r.reason)
          ]);
        }));
    }
    if (tab === 'v2') return [
      h('h2', { text: '⑥ 해결책 v2' }),
      area('solution', '더 나아진 해결책 한 문장', { req: true }),
      area('changed', 'v1에서 무엇이 바뀌었나?', { req: true })
    ];
    if (tab === 'comment') {
      const others = Object.keys(summary.latest).filter((k) => Number(k) !== group && summary.latest[k].v2);
      const received = summary.comments.filter((c) => Number(c.d.to) === group);
      return [
        h('h2', { text: '댓글 평가' }),
        h('div', { class: 'hint', text: '다른 모둠 v2에 좋은 변화 하나, 궁금한 점 하나를 남겨요.' }),
        others.length ? h('div', { class: 'f' }, others.map((k) =>
          h('div', { class: 'recv' }, [h('b', { text: k + '모둠 · ' + (TOPICS[k - 1] || '') + '  ' }), summary.latest[k].v2.d.solution || '']))) :
          h('div', { class: 'muted', text: '아직 v2를 올린 모둠이 없어요.' }),
        h('label', { class: 'f' }, ['댓글 받을 모둠', h('select', { 'data-k': 'to' },
          TOPICS.map((t, i) => (i + 1 === group ? null : h('option', { value: String(i + 1), text: (i + 1) + '모둠 · ' + t }))))]),
        area('good', '좋은 변화 하나'), area('question', '궁금한 점 하나'),
        received.length ? h('div', { class: 'f' }, [h('b', { text: '우리 모둠이 받은 댓글' })].concat(received.map((c) =>
          h('div', { class: 'recv' }, [h('b', { text: c.g + '모둠: ' }), '좋은 점 ' + (c.d.good || '-') + ' · 궁금한 점 ' + (c.d.question || '-')])))) : null
      ];
    }
    if (tab === 'free') {
      const minePosts = summary.free.filter((f) => f.g === group).slice(-6).reverse();
      return [
        h('h2', { text: '자유 게시' }),
        h('div', { class: 'hint', text: '종이에 그린 마인드맵, 실험·자료 사진, 직접 그린 그림을 언제든 올려요. 여러 장 올려도 돼요.' }),
        att.el,
        area('memo', '한 줄 설명', { ph: '예: 우리 모둠 손 마인드맵, 해수 담수화 원리 그림' }),
        minePosts.length ? h('div', { class: 'f' }, [h('b', { text: '우리 모둠이 올린 것' }),
          h('div', { class: 'mini-gal' }, minePosts.map((f) => h('figure', null, [
            f.d.img ? h('img', { src: f.d.img, alt: f.d.memo || '올린 그림' }) : null,
            h('figcaption', { text: f.d.memo || '' })])))]) : null
      ];
    }
    return [];
  }

  function collect(box) {
    const d = collectFields(box);
    const img = att ? att.get() : '';
    if (img) d.img = img;
    return d;
  }
  function collectFields(box) {
    if (tab === 'signal' || tab === 'rebut') {
      return { rows: Array.from(box.querySelectorAll('[data-row]')).map((row) => {
        const o = {};
        row.querySelectorAll('[data-k]').forEach((el) => {
          if (el.type === 'radio') { if (el.checked) o[el.dataset.k] = el.value; } else o[el.dataset.k] = el.value.trim();
        });
        return o;
      }) };
    }
    const o = {};
    box.querySelectorAll('[data-k]').forEach((el) => {
      const k = el.dataset.k;
      if (el.type === 'checkbox') { o[k] = o[k] || []; if (el.checked) o[k].push(el.value); } else o[k] = el.value.trim();
    });
    return o;
  }

  function validate(d) {
    if (tab === 'map' && !d.science) return '핵심 과학 원리를 꼭 적어 주세요.';
    if (tab === 'v1') {
      if (!d.solution || !d.principle) return '해결책과 작동 원리를 모두 적어 주세요.';
      if ((d.fields || []).length < 2) return '융합되는 학문을 2개 이상 골라 주세요.';
    }
    if (tab === 'rebut' && !(d.rows || []).some((r) => r.decision === '반박')) return '반론 하나는 반드시 반박해야 해요.';
    if (tab === 'v2' && (!d.solution || !d.changed)) return 'v2와 바뀐 점을 모두 적어 주세요.';
    if (tab === 'comment' && !d.good && !d.question) return '댓글 내용을 적어 주세요.';
    if (tab === 'free' && !d.img && !d.memo) return '사진·그림이나 설명을 올려 주세요.';
    const { img, ...rest } = d;
    if (JSON.stringify(rest).length > 8000) return '내용이 너무 길어요. 조금 줄여 주세요.';
    return '';
  }

  function renderForm() {
    if (!group) { formBox.replaceChildren(h('div', { class: 'card' }, [h('h2', { text: '먼저 우리 모둠을 눌러 주세요' })])); return; }
    const card = h('section', { class: 'card' });
    att = tab === 'comment' ? null : attachWidget(tab === 'free' ? '' : prevData().img);
    const list = fields();
    if (att && tab !== 'free') list.push(att.el);
    list.forEach((el) => { if (el) card.appendChild(el); });
    const btn = h('button', { type: 'button', class: 'submit', text: tab === 'comment' ? '댓글 남기기' : '보드에 올리기' });
    btn.addEventListener('click', async () => {
      const d = collect(card);
      const msg = validate(d);
      if (msg) { toast(msg); return; }
      btn.disabled = true; btn.textContent = '올리는 중…';
      try {
        await room.submit(group, tab, d);
        toast(tab === 'comment' ? '댓글을 남겼어요' : '보드에 올라갔어요');
        await new Promise((r) => setTimeout(r, 300)); // 내 글이 목록에 들어온 뒤 다시 그리기
        renderForm();
      } catch (e) {
        toast('올리지 못했어요: ' + e.message);
        btn.disabled = false; btn.textContent = '다시 올리기';
      }
    });
    card.appendChild(btn);
    if (tab !== 'free' && mine()[tab]) card.appendChild(h('div', { class: 'muted', text: '마지막으로 올린 시각 ' + new Date(mine()[tab].t).toLocaleTimeString('ko-KR') + ' · 고쳐서 다시 올려도 돼요' }));
    formBox.replaceChildren(card);
  }

  function renderAll() { renderHead(); renderForm(); }

  let first = true;
  room.subscribe((rows) => {
    summary = summarize(rows);
    renderHead();                 // 진행 표시만 갱신, 입력 중인 내용은 그대로 둔다
    if (first) { first = false; renderForm(); }
  }, (err) => toast('연결이 끊겼어요: ' + err.message));
  renderAll();
}
