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
    h('h1', null, [h('small', { class: 'kicker', text: '융합과학 탐구 · 난제 해결 라이브 보드' }), '교실 화면 열기']),
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
  let data = { latest: {}, comments: [], free: [] };
  let rows = [];
  let bigImg = null; // { src, cap }
  let updated = 0;
  let view = store('nb_view') || 'all';
  let focus = 0;
  const seen = {};
  const VIEWS = [['all', '전체 진행'], ['map', '마인드맵'], ['signal', '신호등'], ['solution', 'v1 → v2'], ['comment', '댓글'], ['free', '사진·그림'], ['summary', '반 전체 정리']];
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

  function pic(src, cap) {
    if (!src) return null;
    return h('figure', { class: 'pic' }, [
      h('img', { src, alt: cap || '모둠이 올린 그림', loading: 'lazy', onclick: (e) => { e.stopPropagation(); bigImg = { src, cap }; render(); } }),
      cap ? h('figcaption', { text: cap }) : null
    ]);
  }
  const freeOf = (g) => data.free.filter((f) => Number(f.g) === g).slice().reverse();

  function content(g) {
    const out = body(g);
    // 전체 진행 화면에서는 단계 내용 아래에 최근 자유 게시 사진 2장까지
    if (view === 'all') {
      const fr = freeOf(g).slice(0, 2);
      if (fr.length) out.push(h('div', { class: 'lbl', text: '자유 게시' }), ...fr.map((f) => pic(f.d.img, f.d.memo) || box('', f.d.memo)));
    }
    return out;
  }

  function body(g) {
    const l = data.latest[g] || {};
    const out = [];
    const v = view === 'all' ? stageOf(g) : view;
    if (!v) return [h('div', { class: 'empty', text: '아직 올린 내용이 없어요' })];
    if (v === 'map') {
      const d = l.map && l.map.d;
      if (!d) return [h('div', { class: 'empty', text: '마인드맵 대기 중' })];
      out.push(pic(d.img, '마인드맵 그림'), box('핵심 과학 원리', d.science, 'sci'), box('환경', d.env), box('경제', d.eco), box('사회', d.soc), box('기술', d.tech));
    } else if (v === 'compare') {
      const d = l.compare.d;
      out.push(box('공통점', d.common), box('AI만 말한 것', d.aiOnly), box('우리만 말한 것', d.usOnly), pic(d.img));
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
      out.push(pic(d.img));
    } else if (v === 'v1' || v === 'rebut' || v === 'v2' || v === 'solution') {
      const v1 = l.v1 && l.v1.d, rb = l.rebut && l.rebut.d, v2 = l.v2 && l.v2.d;
      if (!v1 && !v2) return [h('div', { class: 'empty', text: '해결책 대기 중' })];
      if (v1) {
        out.push(box('해결책 v1', v1.solution));
        if (v1.fields && v1.fields.length) out.push(h('div', null, v1.fields.map((f) => h('span', { class: 'chip', text: f }))));
        out.push(box('작동 원리', v1.principle, 'sci'), pic(v1.img, 'v1 그림'));
      }
      if (rb) out.push(h('div', null, [h('div', { class: 'lbl', text: 'AI 반론에 대한 판단' })].concat((rb.rows || []).map((r, i) => {
        if (!r.summary && !r.decision) return null;
        return h('div', { class: 'box' }, [h('span', { class: 'chip ' + (r.decision === '반박' ? 'reb' : 'acc'), text: ['사회', '경제', '윤리'][i] + ' · ' + (r.decision || '?') }), r.summary || '']);
      }))));
      if (v2) out.push(box('해결책 v2', v2.solution, 'v2'), box('바뀐 점', v2.changed), pic(v2.img, 'v2 그림'));
    } else if (v === 'comment') {
      const cs = data.comments.filter((c) => Number(c.d.to) === g);
      if (!cs.length) return [h('div', { class: 'empty', text: '받은 댓글이 없어요' })];
      cs.forEach((c) => out.push(h('div', { class: 'box' }, [h('b', { text: c.g + '모둠  ' }), '좋은 점 ' + (c.d.good || '-') + ' · 궁금한 점 ' + (c.d.question || '-')])));
    } else if (v === 'free') {
      const fr = freeOf(g);
      if (!fr.length) return [h('div', { class: 'empty', text: '올린 사진·그림이 없어요' })];
      fr.forEach((f) => out.push(pic(f.d.img, f.d.memo) || box('', f.d.memo)));
    }
    return out;
  }

  // 마지막으로 올린 뒤 지난 시간. v2 전인데 8분 넘게 소식이 없으면 경고
  function ago(t, finished) {
    if (!t) return null;
    const m = Math.floor((Date.now() - t) / 60000);
    const stale = !finished && m >= 8;
    return h('span', { class: 'ago' + (stale ? ' stale' : ''), text: stale ? m + '분째 정체' : '  ' + (m ? m + '분 전' : '방금') });
  }

  function column(g, big) {
    const l = data.latest[g] || {};
    const cur = stageOf(g);
    const latestT = Math.max(0, ...Object.keys(l).map((k) => l[k].t), ...freeOf(g).map((f) => f.t));
    const fresh = !big && seen[g] !== undefined && latestT > seen[g];
    if (!big) seen[g] = latestT;
    const toggle = () => { focus = big ? 0 : g; render(); };
    return h('section', { class: 'col' + (fresh ? ' fresh' : ''), tabindex: '0', 'aria-label': g + '모둠', onclick: toggle,
      onkeydown: (e) => { if (e.key === 'Enter') toggle(); } }, [
      h('header', { class: 'col-h' }, [
        h('div', { class: 'n' }, [g + '모둠' + (cur ? ' · 지금 ' + STAGES.find((s) => s.key === cur).short : ''), ago(latestT, !!l.v2)]),
        h('div', { class: 't', text: TOPICS[g - 1] }),
        h('div', { class: 'dots', 'aria-hidden': 'true' }, STAGES.map((s) => h('span', { class: 'dot' + (l[s.key] ? (s.key === cur ? ' now' : ' on') : '') })))
      ]),
      h('div', { class: 'col-b' }, content(g))
    ]);
  }

  // 반 전체 정리: AI 주장 신호등 집계 + 모둠별 v1 → v2
  function summaryView() {
    const all = [];
    TOPICS.forEach((t, i) => {
      const sg = data.latest[i + 1] && data.latest[i + 1].signal;
      ((sg && sg.d.rows) || []).forEach((r) => { if (r.claim && r.light) all.push({ g: i + 1, ...r }); });
    });
    const n = { G: 0, Y: 0, R: 0 };
    all.forEach((r) => { n[r.light] = (n[r.light] || 0) + 1; });
    const total = all.length;
    const pct = (k) => (total ? Math.round((n[k] / total) * 100) : 0);
    const bar = h('div', { class: 'sum-bar', role: 'img', 'aria-label': '초록 ' + n.G + ', 노랑 ' + n.Y + ', 빨강 ' + n.R },
      ['G', 'Y', 'R'].map((k) => (n[k] ? h('div', { class: 'seg ' + k, style: 'flex:' + n[k], text: String(n[k]) }) : null)));
    const legend = h('div', { class: 'sum-legend' }, ['G', 'Y', 'R'].map((k) => h('span', null, [h('i', { class: k }), ({ G: '초록 확인됨 ', Y: '노랑 확인 못 함 ', R: '빨강 틀림·출처 없음 ' })[k] + n[k] + '개 (' + pct(k) + '%)'])));
    const reds = all.filter((r) => r.light !== 'G');
    const left = h('section', { class: 'sum-card' }, [
      h('h2', { text: 'AI 주장 ' + total + '개 중, 그대로 믿을 수 있었던 것은 ' + n.G + '개' }),
      total ? h('div', null, [bar, legend]) : h('div', { class: 'empty', text: '아직 신호등 판정이 없어요' }),
      reds.length ? h('div', { class: 'lbl', text: '확인되지 않은 AI 주장' }) : null,
      h('div', { class: 'sum-list' }, reds.map((r) => h('div', { class: 'sig' }, [h('i', { class: r.light }),
        h('div', null, [h('div', { class: 'box', text: r.claim }), h('div', { class: 'muted', text: r.g + '모둠' + (r.source ? ' · ' + r.source : '') })])])))
    ]);
    const right = h('section', { class: 'sum-card' }, [
      h('h2', { text: 'AI 반론을 거쳐 해결책은 어떻게 바뀌었나' }),
      h('div', { class: 'sum-list' }, TOPICS.map((t, i) => {
        const l = data.latest[i + 1] || {};
        const v1 = l.v1 && l.v1.d, v2 = l.v2 && l.v2.d, rb = l.rebut && l.rebut.d;
        const dec = ((rb && rb.rows) || []).filter((r) => r.decision);
        const acc = dec.filter((r) => r.decision === '수용').length, reb = dec.length - acc;
        return h('div', { class: 'sum-row' }, [
          h('div', { class: 'sum-g' }, [h('b', { text: (i + 1) + '모둠' }), h('span', { text: t })]),
          h('div', { class: 'sum-v' }, [
            h('div', { class: 'box', text: (v1 && v1.solution) || 'v1 대기 중' }),
            h('div', { class: 'arrow' }, [dec.length ? h('span', { class: 'chip acc', text: '수용 ' + acc }) : null, dec.length ? h('span', { class: 'chip reb', text: '반박 ' + reb }) : null, '→']),
            h('div', { class: 'box v2', text: (v2 && v2.solution) || 'v2 대기 중' })
          ]),
          v2 && v2.changed ? h('div', { class: 'muted sum-c', text: '바뀐 점: ' + v2.changed }) : null
        ]);
      }))
    ]);
    return h('div', { class: 'sum-grid' }, [left, right]);
  }

  // 수업 기록을 엑셀에서 열리는 CSV로 저장 (세특·수업 성찰 근거용)
  function exportCsv() {
    const LBL = { map: '① 마인드맵', compare: '② AI 비교', signal: '③ 신호등', v1: '④ 해결책 v1', rebut: '⑤ AI 반론', v2: '⑥ 해결책 v2', comment: '댓글', free: '자유 게시' };
    const K = { env: '환경', eco: '경제', soc: '사회', tech: '기술', science: '과학 원리', common: '공통점', aiOnly: 'AI만', usOnly: '우리만',
      solution: '해결책', principle: '작동 원리', fields: '융합 학문', changed: '바뀐 점', to: '받는 모둠', good: '좋은 점', question: '궁금한 점', memo: '설명',
      claim: '주장', source: '근거', light: '판정', summary: '반론', decision: '판단', reason: '이유' };
    const LIGHT = { G: '초록', Y: '노랑', R: '빨강' };
    const flat = (d) => Object.keys(d).filter((k) => k !== 'img').map((k) => {
      const v = d[k];
      if (k === 'rows') return v.map((r, i) => (i + 1) + ') ' + Object.keys(r).filter((x) => r[x]).map((x) => (K[x] || x) + ': ' + (x === 'light' ? LIGHT[r[x]] : r[x])).join(', ')).join(' / ');
      return (K[k] || k) + ': ' + (Array.isArray(v) ? v.join('·') : v);
    }).filter((x) => !/: $/.test(x)).join(' | ') + (d.img ? ' | [사진·그림 첨부]' : '');
    const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = [['시각', '모둠', '주제', '단계', '내용']].concat(rows.map((r) => [
      new Date(r.t).toLocaleString('ko-KR'), r.g + '모둠', TOPICS[r.g - 1] || '', LBL[r.s] || r.s, flat(r.d || {})]));
    const blob = new Blob(['\ufeff' + lines.map((l) => l.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: '난제보드_' + room.room + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  // 그림 크게 보기: 화면 가득 맞춤 → 누르거나 + 로 확대, 끌어서 이동
  let zoom = 1;
  function viewer(item) {
    const img = h('img', { src: item.src, alt: item.cap || '크게 본 그림', draggable: 'false' });
    const stage = h('div', { class: 'iv-stage' }, [img]);
    const label = h('span', { class: 'iv-z' });
    function fit() {
      if (!img.naturalWidth) return;
      const sw = stage.clientWidth, sh = stage.clientHeight;
      const base = Math.min(sw / img.naturalWidth, sh / img.naturalHeight);
      const w = img.naturalWidth * base * zoom;
      img.style.width = w + 'px';
      img.style.height = (img.naturalHeight * base * zoom) + 'px';
      label.textContent = Math.round(zoom * 100) + '%';
      stage.classList.toggle('zoomed', zoom > 1);
    }
    const setZ = (z, cx, cy) => {
      const old = zoom;
      zoom = Math.max(1, Math.min(5, z));
      // 누른 지점이 화면에서 제자리에 있도록 스크롤 보정
      const r = stage.getBoundingClientRect();
      const px = (cx === undefined ? r.width / 2 : cx - r.left), py = (cy === undefined ? r.height / 2 : cy - r.top);
      const sx = (stage.scrollLeft + px) / old, sy = (stage.scrollTop + py) / old;
      fit();
      stage.scrollLeft = sx * zoom - px; stage.scrollTop = sy * zoom - py;
    };
    img.addEventListener('load', fit);
    if (img.complete) requestAnimationFrame(fit);
    // 끌어서 이동, 짧게 누르면 확대/맞춤 전환
    let drag = null;
    stage.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, l: stage.scrollLeft, t: stage.scrollTop, moved: false, onImg: e.target === img }; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
      stage.scrollLeft = drag.l - dx; stage.scrollTop = drag.t - dy;
    });
    stage.addEventListener('pointerup', (e) => {
      const d = drag; drag = null;
      if (!d || d.moved) return;
      if (d.onImg) setZ(zoom > 1 ? 1 : 2.5, e.clientX, e.clientY);
      else if (zoom === 1) close();
    });
    stage.addEventListener('wheel', (e) => { e.preventDefault(); setZ(zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY); }, { passive: false });
    function close() { bigImg = null; zoom = 1; render(); }
    return h('div', { class: 'img-ov', role: 'dialog', 'aria-label': '그림 크게 보기' }, [
      h('div', { class: 'iv-bar' }, [
        h('span', { class: 'iv-cap', text: item.cap || '' }),
        h('button', { type: 'button', text: '−', 'aria-label': '축소', onclick: () => setZ(zoom / 1.5) }),
        label,
        h('button', { type: 'button', text: '+', 'aria-label': '확대', onclick: () => setZ(zoom * 1.5) }),
        h('button', { type: 'button', text: '맞춤', onclick: () => setZ(1) }),
        h('button', { type: 'button', text: '닫기 ✕', onclick: close })
      ]),
      stage
    ]);
  }

  function render() {
    const tabs = h('div', { class: 'b-tabs', role: 'tablist' }, VIEWS.map((v) =>
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(view === v[0]), text: v[1], onclick: () => { view = v[0]; store('nb_view', view); render(); } })));
    const top = h('header', { class: 'b-top' }, [
      h('h1', null, [h('small', { class: 'kicker', text: '융합과학 탐구' }), '난제 해결 라이브 보드']),
      h('span', { class: 'q', text: 'AI가 알려 준 답, 그대로 믿고 난제를 풀 수 있을까?' }),
      h('span', { class: 'sp' }),
      tabs,
      h('div', { class: 'joinbox' }, [qrNode(), h('div', null, [h('div', { class: 'code', text: room.room }), h('div', { class: 'url', text: studentUrl }), h('div', { class: 'muted', text: 'QR을 누르면 크게 보여요' })])]),
      h('div', { class: 'b-side' }, [
        h('span', { class: 'b-meta', text: updated ? '갱신 ' + new Date(updated).toLocaleTimeString('ko-KR') : '연결 중…' }),
        h('button', { type: 'button', class: 'btn-ghost', text: '기록 저장(엑셀)', onclick: exportCsv })
      ])
    ]);
    const grid = view === 'summary' ? summaryView() : h('div', { class: 'b-grid' }, TOPICS.map((t, i) => column(i + 1, false)));
    root.replaceChildren(h('main', { class: 'b-wrap' }, [isDemo ? demoBanner() : null, top, grid]));
    if (focus) {
      const ov = h('div', { class: 'ov', onclick: (e) => { if (e.target === ov) { focus = 0; render(); } } }, [column(focus, true)]);
      root.appendChild(ov);
    }
    if (bigImg) root.appendChild(viewer(bigImg));
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
    if (bigImg) {
      root.appendChild(h('div', { class: 'ov img-ov', onclick: () => { bigImg = null; render(); } }, [
        h('figure', { class: 'img-big' }, [h('img', { src: bigImg.src, alt: bigImg.cap || '크게 본 그림' }),
          bigImg.cap ? h('figcaption', { text: bigImg.cap }) : null])
      ]));
    }
    if (bigImg) { bigImg = null; zoom = 1; render(); } else if (bigQr) { bigQr = false; render(); } else if (focus) { focus = 0; render(); }
  });
  room.subscribe((r) => { rows = r; data = summarize(r); updated = Date.now(); render(); },
    (err) => toast('연결이 끊겼어요: ' + err.message));
  render();
  // '몇 분 전' 표시 갱신 (크게 보기 중에는 건너뜀)
  setInterval(() => { if (!focus && !bigImg && !bigQr) render(); }, 30000);
}
