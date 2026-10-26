import { TOPICS } from './config.js';
import { openRoom, summarize, isDemo } from './store.js';
import { STAGES, h, toast, store, param, demoBanner } from './ui.js';

const root = document.getElementById('app');
const roomCode = param('room');

if (!roomCode) showSetup(); else start(roomCode);

function showSetup() {
  const d = new Date();
  const suggest = '6반-' + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const input = h('input', { type: 'text', id: 'room', value: suggest, 'aria-label': '수업 코드' });
  const go = () => {
    const v = input.value.trim();
    if (!v) { toast('수업 코드를 입력하세요'); return; }
    location.search = '?room=' + encodeURIComponent(v);
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  root.replaceChildren(h('main', { class: 'setup' }, [
    h('h1', { text: '교실 화면 열기' }),
    h('p', { class: 'muted', text: '수업마다 새 코드를 쓰면 빈 보드에서 시작합니다. 반과 날짜를 넣어 두면 나중에 기록을 다시 볼 수 있어요. (예: 6반-1106, 8반-1106, 리허설)' }),
    h('div', { class: 'join' }, [input, h('button', { type: 'button', text: '보드 열기', onclick: go })]),
    isDemo ? demoBanner() : null
  ]));
}

async function start(code) {
  let room;
  try { room = await openRoom(code); } catch (e) {
    root.replaceChildren(h('div', { class: 'setup' }, [h('div', { class: 'err', text: '연결하지 못했어요: ' + e.message })]));
    return;
  }
  let data = { latest: {}, comments: [] };
  let updated = 0;
  let view = store('nb_view') || 'all';
  let focus = 0;
  const seen = {};
  const VIEWS = [['all', '전체 진행'], ['map', '마인드맵'], ['signal', '신호등'], ['solution', 'v1 → v2'], ['comment', '댓글']];
  const studentUrl = location.origin + location.pathname.replace(/board(\.html)?$/, '') + '?room=' + encodeURIComponent(room.room);

  // QR: 보드 위에는 중간 크기, 누르면 화면 가득 크게
  function qrImg(cell) {
    try {
      // eslint-disable-next-line no-undef
      const qr = qrcode(0, 'L');
      qr.addData(studentUrl);
      qr.make();
      const img = document.createElement('img');
      img.src = qr.createDataURL(cell, 4);
      img.alt = '학생 접속 QR 코드';
      return img;
    } catch (e) { return null; }
  }
  let bigQr = false;
  function qrNode() {
    const img = qrImg(6);
    const box = h('button', { type: 'button', class: 'qr', title: '눌러서 크게 보기', onclick: () => { bigQr = true; render(); } });
    if (img) box.appendChild(img); else box.appendChild(h('span', { class: 'muted', text: 'QR 없음' }));
    return box;
  }

  function stageOf(g) {
    const l = data.latest[g] || {};
    let last = null;
    STAGES.forEach((s) => { if (l[s.key] && (!last || l[s.key].t >= l[last].t)) last = s.key; });
    return last;
  }

  function box(label, value, cls) {
    if (!value) return null;
    return h('div', null, [h('div', { class: 'lbl', text: label }), h('div', { class: 'box ' + (cls || ''), text: value })]);
  }

  function content(g) {
    const l = data.latest[g] || {};
    const out = [];
    const v = view === 'all' ? stageOf(g) : view;
    if (!v) return [h('div', { class: 'empty', text: '아직 올린 내용이 없어요' })];
    if (v === 'map') {
      const d = l.map && l.map.d;
      if (!d) return [h('div', { class: 'empty', text: '마인드맵 대기 중' })];
      out.push(box('핵심 과학 원리', d.science, 'sci'), box('환경', d.env), box('경제', d.eco), box('사회', d.soc), box('기술', d.tech));
    } else if (v === 'compare') {
      const d = l.compare.d;
      out.push(box('공통점', d.common), box('AI만 말한 것', d.aiOnly), box('우리만 말한 것', d.usOnly));
    } else if (v === 'signal') {
      const d = l.signal && l.signal.d;
      if (!d) return [h('div', { class: 'empty', text: '신호등 판정 대기 중' })];
      const reds = (d.rows || []).filter((r) => r.light === 'R').length;
      if (reds) out.push(h('span', { class: 'pill mvp', text: '빨간불 ' + reds + '개 발견' }));
      (d.rows || []).forEach((r) => {
        if (!r.claim) return;
        out.push(h('div', { class: 'sig' }, [h('i', { class: r.light || '', 'aria-label': ({ G: '초록', Y: '노랑', R: '빨강' })[r.light] || '미판정' }),
          h('div', null, [h('div', { class: 'box', text: r.claim }), r.source ? h('div', { class: 'muted', text: '근거: ' + r.source }) : null])]));
      });
    } else if (v === 'v1' || v === 'rebut' || v === 'v2' || v === 'solution') {
      const v1 = l.v1 && l.v1.d, rb = l.rebut && l.rebut.d, v2 = l.v2 && l.v2.d;
      if (!v1 && !v2) return [h('div', { class: 'empty', text: '해결책 대기 중' })];
      if (v1) {
        out.push(box('해결책 v1', v1.solution));
        if (v1.fields && v1.fields.length) out.push(h('div', null, v1.fields.map((f) => h('span', { class: 'chip', text: f }))));
        out.push(box('작동 원리', v1.principle, 'sci'));
      }
      if (rb) out.push(h('div', null, [h('div', { class: 'lbl', text: 'AI 반론에 대한 판단' })].concat((rb.rows || []).map((r, i) => {
        if (!r.summary && !r.decision) return null;
        return h('div', { class: 'box' }, [h('span', { class: 'chip ' + (r.decision === '반박' ? 'reb' : 'acc'), text: ['사회', '경제', '윤리'][i] + ' · ' + (r.decision || '?') }), r.summary || '']);
      }))));
      if (v2) out.push(box('해결책 v2', v2.solution, 'v2'), box('바뀐 점', v2.changed));
    } else if (v === 'comment') {
      const cs = data.comments.filter((c) => Number(c.d.to) === g);
      if (!cs.length) return [h('div', { class: 'empty', text: '받은 댓글이 없어요' })];
      cs.forEach((c) => out.push(h('div', { class: 'box' }, [h('b', { text: c.g + '모둠  ' }), '좋은 점 ' + (c.d.good || '-') + ' · 궁금한 점 ' + (c.d.question || '-')])));
    }
    return out;
  }

  function column(g, big) {
    const l = data.latest[g] || {};
    const cur = stageOf(g);
    const latestT = Math.max(0, ...Object.keys(l).map((k) => l[k].t));
    const fresh = !big && seen[g] !== undefined && latestT > seen[g];
    if (!big) seen[g] = latestT;
    const toggle = () => { focus = big ? 0 : g; render(); };
    return h('section', { class: 'col' + (fresh ? ' fresh' : ''), tabindex: '0', 'aria-label': g + '모둠', onclick: toggle,
      onkeydown: (e) => { if (e.key === 'Enter') toggle(); } }, [
      h('header', { class: 'col-h' }, [
        h('div', { class: 'n', text: g + '모둠' + (cur ? ' · 지금 ' + STAGES.find((s) => s.key === cur).short : '') }),
        h('div', { class: 't', text: TOPICS[g - 1] }),
        h('div', { class: 'dots', 'aria-hidden': 'true' }, STAGES.map((s) => h('span', { class: 'dot' + (l[s.key] ? (s.key === cur ? ' now' : ' on') : '') })))
      ]),
      h('div', { class: 'col-b' }, content(g))
    ]);
  }

  function render() {
    const tabs = h('div', { class: 'b-tabs', role: 'tablist' }, VIEWS.map((v) =>
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(view === v[0]), text: v[1], onclick: () => { view = v[0]; store('nb_view', view); render(); } })));
    const top = h('header', { class: 'b-top' }, [
      h('h1', { text: '난제 해결 라이브 보드' }),
      h('span', { class: 'q', text: 'AI가 알려 준 답, 그대로 믿고 난제를 풀 수 있을까?' }),
      h('span', { class: 'sp' }),
      tabs,
      h('div', { class: 'joinbox' }, [qrNode(), h('div', null, [h('div', { class: 'code', text: room.room }), h('div', { class: 'url', text: studentUrl }), h('div', { class: 'muted', text: 'QR을 누르면 크게 보여요' })])]),
      h('span', { class: 'b-meta', text: updated ? '갱신 ' + new Date(updated).toLocaleTimeString('ko-KR') : '연결 중…' })
    ]);
    const grid = h('div', { class: 'b-grid' }, TOPICS.map((t, i) => column(i + 1, false)));
    root.replaceChildren(h('main', { class: 'b-wrap' }, [isDemo ? demoBanner() : null, top, grid]));
    if (focus) {
      const ov = h('div', { class: 'ov', onclick: (e) => { if (e.target === ov) { focus = 0; render(); } } }, [column(focus, true)]);
      root.appendChild(ov);
    }
    if (bigQr) {
      const img = qrImg(12);
      root.appendChild(h('div', { class: 'ov qr-ov', onclick: () => { bigQr = false; render(); } }, [
        h('div', { class: 'qr-big' }, [
          img,
          h('div', { class: 'code', text: '수업 코드 ' + room.room }),
          h('div', { class: 'url', text: studentUrl }),
          h('div', { class: 'muted', text: '아무 곳이나 누르면 닫혀요' })
        ])
      ]));
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (bigQr) { bigQr = false; render(); } else if (focus) { focus = 0; render(); }
  });
  room.subscribe((rows) => { data = summarize(rows); updated = Date.now(); render(); },
    (err) => toast('연결이 끊겼어요: ' + err.message));
  render();
}
