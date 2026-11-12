import { openRoom, summarize, isDemo } from './store.js';
import { STAGES, h, toast, store, param, demoBanner } from './ui.js';
import { ACTIVITIES, ACT_IDS, LISTED, ACT_TAG, getAct } from './activities.js';
import * as G from './generic.js';

const root = document.getElementById('app');
const roomCode = param('room');

if (!roomCode) showSetup(); else start(roomCode);

function showSetup() {
  const d = new Date();
  const mmdd = String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const SUFFIX = { nanje: '', future: '미래-', uam: '융합-' };
  let pick = LISTED.indexOf(store('nb_setup_act')) >= 0 ? store('nb_setup_act') : LISTED[0];
  const input = h('input', { type: 'text', id: 'room', 'aria-label': '수업 코드' });
  const suggest = () => { input.value = '6반-' + SUFFIX[pick] + mmdd; };
  suggest();
  const cards = h('div', { class: 'act-cards', role: 'radiogroup', 'aria-label': '수업 활동' });
  function drawCards() {
    cards.replaceChildren(...LISTED.map((id) => {
      const a = ACTIVITIES[id];
      return h('button', { type: 'button', role: 'radio', class: 'act-card', 'aria-checked': String(pick === id),
        onclick: () => { pick = id; store('nb_setup_act', id); suggest(); drawCards(); } }, [
        h('span', { class: 'act-tag', text: ACT_TAG[id] }),
        h('b', { text: a.title }),
        h('span', { class: 'muted', text: a.unit }),
        h('span', { class: 'act-q', text: a.question })
      ]);
    }));
  }
  drawCards();
  const go = () => {
    const v = input.value.trim();
    if (!v) { toast('수업 코드를 입력하세요'); return; }
    location.search = '?room=' + encodeURIComponent(v) + '&act=' + pick;
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  root.replaceChildren(h('main', { class: 'setup wide' }, [
    h('h1', null, [h('small', { class: 'kicker', text: '융합과학 탐구 · 모둠 라이브 보드' }), '교실 화면 열기']),
    h('div', { class: 'lbl', text: '① 오늘 할 활동' }),
    cards,
    h('div', { class: 'lbl', text: '② 수업 코드' }),
    h('p', { class: 'muted', text: '수업마다 새 코드를 쓰면 빈 보드에서 시작합니다. 코드는 처음 연 활동으로 고정되니, 활동이 다르면 코드도 다르게 써 주세요.' }),
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
  // 이 수업 코드의 활동: 이미 정해져 있으면 그대로, 처음이면 고른 활동으로 기록
  let actId = null;
  try { actId = await room.getAct(); } catch (e) { actId = null; }
  const wanted = ACT_IDS.indexOf(param('act')) >= 0 ? param('act') : 'nanje';
  if (!actId) {
    try { await room.setAct(wanted); actId = wanted; } catch (e) {
      if (wanted !== 'nanje') {
        root.replaceChildren(h('div', { class: 'setup' }, [h('div', { class: 'err', text: '연습 활동을 기록하지 못했어요. Firebase 콘솔 Firestore → 규칙 탭에 새 규칙(firestore.rules)을 다시 게시해 주세요. (' + e.message + ')' })]));
        return;
      }
      actId = 'nanje';
    }
  } else if (param('act') && param('act') !== actId) {
    setTimeout(() => toast('이 코드는 이미 「' + getAct(actId).title + '」 활동으로 만들어진 코드예요.'), 300);
  }
  const act = getAct(actId);
  const nanje = act.engine === 'nanje';
  const TOPICS = act.topics;
  const STAGES_ = nanje ? STAGES : act.stages;
  const lastStage = STAGES_[STAGES_.length - 1];
  const finalKey = nanje ? 'v2' : lastStage.key;
  const genStage = (k) => (nanje ? null : act.stages.find((x) => x.key === k));

  let data = { latest: {}, comments: [], free: [] };
  let rows = [];
  let drafts = []; // 태블릿별 작성 중인 내용
  const TAB_LABEL = {};
  STAGES_.forEach((s) => { TAB_LABEL[s.key] = s.short || s.label; });
  TAB_LABEL.comment = '댓글 평가'; TAB_LABEL.free = '자유 게시';
  let bigImg = null; // { src, cap }
  let updated = 0;
  const viewKey = 'nb_view_' + act.id;
  let focus = 0;
  const seen = {};
  const VIEWS = nanje
    ? [['all', '전체 진행'], ['live', '실시간 화면'], ['map', '마인드맵'], ['signal', '신호등'], ['solution', 'v1 → v2'], ['comment', '댓글'], ['free', '사진·그림'], ['summary', '반 전체 정리']]
    : [['all', '전체 진행'], ['live', '실시간 화면']].concat(act.stages.map((x) => [x.key, x.short]), [['comment', '댓글'], ['free', '사진·그림'], ['summary', '반 전체 정리']]);
  let view = store(viewKey);
  if (!VIEWS.some((v) => v[0] === view)) view = 'all';
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
    STAGES_.forEach((s) => { if (l[s.key] && (!last || l[s.key].t >= l[last].t)) last = s.key; });
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

  // 실시간 화면: 모둠 태블릿마다 지금 보고 있는 탭과 쓰고 있는 내용(아직 안 올린 것 포함)
  function letterOf(g, devId) {
    const ids = drafts.filter((x) => x.g === g).map((x) => x.dev).sort();
    return String.fromCharCode(65 + Math.max(0, ids.indexOf(devId)));
  }
  function secAgo(t) {
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    return s < 60 ? s + '초 전' : Math.floor(s / 60) + '분 전';
  }
  function draftBody(g, dr) {
    const d = dr.d || {};
    const filled = JSON.stringify(d).replace(/"_img":true/, '').match(/:"[^"]+"|:\["[^"]/);
    const extra = d._img ? [h('span', { class: 'chip acc', text: '사진·그림 첨부함' })] : [];
    if (!filled && !d._img) return [h('div', { class: 'empty small', text: '아직 쓰기 전' })];
    if (dr.tab === 'comment') return [box('댓글 → ' + (d.to || '?') + '모둠 · 좋은 점', d.good), box('궁금한 점', d.question)];
    if (dr.tab === 'free') return extra.concat([box('자유 게시 설명', d.memo)]);
    const lo = {}; lo[dr.tab] = { d };
    const v = nanje && (dr.tab === 'v1' || dr.tab === 'rebut' || dr.tab === 'v2') ? 'solution' : dr.tab;
    return extra.concat(body(g, lo, v).filter((x) => x && !(x.classList && x.classList.contains('empty'))));
  }
  function liveContent(g) {
    const list = drafts.filter((x) => x.g === g).sort((a, b) => b.t - a.t);
    if (!list.length) return [h('div', { class: 'empty', text: '아직 접속한 태블릿이 없어요' })];
    return list.map((dr) => {
      const idle = Date.now() - dr.t > 90000;
      return h('div', { class: 'live' + (idle ? ' idle' : '') }, [
        h('div', { class: 'live-h' }, [h('b', { text: '태블릿 ' + letterOf(g, dr.dev) }), h('span', { class: 'live-tab', text: TAB_LABEL[dr.tab] || dr.tab }), h('span', { class: 'live-t', text: secAgo(dr.t) })]),
        h('div', { class: 'live-b' }, draftBody(g, dr))
      ]);
    });
  }
  // ---------- 발표 모드: 한 모둠 결과를 단계별로 화면 가득 ----------
  let pres = null; // { g, i }
  let timerEnd = 0, timerLeft = 60;
  const PRES_LABEL = { map: '① 원인 마인드맵', compare: '② AI 마인드맵과 비교', signal: '③ AI 주장 신호등', solution: '④~⑥ 해결책 v1 → v2', free: '자유 게시 (사진·그림)', comment: '받은 댓글' };
  function presSteps(g) {
    const l = data.latest[g] || {};
    const steps = nanje
      ? ['map', 'compare', 'signal', 'solution'].filter((k) => (k === 'solution' ? (l.v1 || l.rebut || l.v2) : l[k]))
      : act.stages.filter((s) => l[s.key]).map((s) => s.key);
    if (freeOf(g).length) steps.push('free');
    if (data.comments.some((c) => Number(c.d.to) === g)) steps.push('comment');
    return steps;
  }
  const stepLabel = (k) => (genStage(k) ? genStage(k).label : PRES_LABEL[k] || k);
  function presGo(g, i) {
    const steps = presSteps(g);
    pres = { g, i: Math.max(0, Math.min(i, Math.max(0, steps.length - 1))) };
    render();
  }
  function timerText() {
    const left = timerEnd ? Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000)) : timerLeft;
    return Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
  }
  function presView() {
    const g = pres.g, steps = presSteps(g), k = steps[pres.i];
    const timerBtn = h('button', { type: 'button', class: 'pres-timer' + (timerEnd ? ' run' : ''), title: '누르면 1분 타이머 시작/정지',
      onclick: () => { if (timerEnd) { timerLeft = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000)); timerEnd = 0; } else { if (timerLeft <= 0) timerLeft = 60; timerEnd = Date.now() + timerLeft * 1000; } render(); } }, [timerText()]);
    return h('div', { class: 'pres', role: 'dialog', 'aria-label': g + '모둠 발표' }, [
      h('header', { class: 'pres-h' }, [
        h('div', { class: 'pres-g' }, TOPICS.map((t, i) => h('button', { type: 'button', 'aria-pressed': String(g === i + 1), text: (i + 1) + '모둠', onclick: () => presGo(i + 1, 0) }))),
        h('span', { class: 'sp' }),
        timerBtn,
        h('button', { type: 'button', class: 'pres-x', text: '1:00', title: '타이머 다시 1분으로', onclick: () => { timerEnd = 0; timerLeft = 60; render(); } }),
        h('button', { type: 'button', class: 'pres-x', text: '닫기 ✕', onclick: () => { pres = null; render(); } })
      ]),
      h('div', { class: 'pres-title' }, [h('span', { class: 'pres-n', text: g + '모둠 발표' }), h('b', { text: TOPICS[g - 1] })]),
      h('nav', { class: 'pres-steps' }, steps.map((s, i) => h('button', { type: 'button', 'aria-current': String(i === pres.i), text: stepLabel(s), onclick: () => presGo(g, i) }))),
      h('main', { class: 'pres-b' }, k ? body(g, null, k).filter(Boolean) : [h('div', { class: 'empty', text: '아직 올린 내용이 없어요' })]),
      h('footer', { class: 'pres-f' }, [
        h('button', { type: 'button', text: '◀ 이전', disabled: pres.i <= 0, onclick: () => presGo(g, pres.i - 1) }),
        h('span', { text: steps.length ? (pres.i + 1) + ' / ' + steps.length : '' }),
        h('button', { type: 'button', text: '다음 ▶', disabled: pres.i >= steps.length - 1, onclick: () => presGo(g, pres.i + 1) })
      ])
    ]);
  }
  setInterval(() => {
    if (!pres || !timerEnd) return;
    const el = document.querySelector('.pres-timer');
    if (el) { el.textContent = timerText(); el.classList.toggle('warn', timerEnd - Date.now() <= 10000); }
    if (Date.now() >= timerEnd) { timerEnd = 0; timerLeft = 0; render(); }
  }, 250);

  function typingCount(g) { return drafts.filter((x) => x.g === g && Date.now() - x.t < 30000).length; }

  function content(g) {
    if (view === 'live') return liveContent(g);
    const out = body(g);
    // 전체 진행 화면에서는 단계 내용 아래에 최근 자유 게시 사진 2장까지
    if (view === 'all') {
      const fr = freeOf(g).slice(0, 2);
      if (fr.length) out.push(h('div', { class: 'lbl', text: '자유 게시' }), ...fr.map((f) => pic(f.d.img, f.d.memo) || box('', f.d.memo)));
    }
    return out;
  }

  function body(g, lo, vo) {
    const l = lo || data.latest[g] || {};
    const out = [];
    const v = vo || (view === 'all' ? stageOf(g) : view);
    if (!v) return [h('div', { class: 'empty', text: '아직 올린 내용이 없어요' })];
    if (genStage(v)) {
      const d = l[v] && l[v].d;
      if (!d) return [h('div', { class: 'empty', text: genStage(v).short + ' 대기 중' })];
      if (view === 'all' && !lo) out.push(h('div', { class: 'lbl stage-t', text: genStage(v).label }));
      return out.concat(G.boardBody(genStage(v), d, pic).filter(Boolean));
    }
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
          h('div', null, [h('div', { class: 'box', text: r.claim }), r.aiSrc ? h('div', { class: 'muted', text: 'AI가 댄 출처: ' + r.aiSrc }) : null, r.source ? h('div', { class: 'muted', text: '확인 결과: ' + r.source }) : null])]));
      });
      out.push(pic(d.img));
    } else if (v === 'v1' || v === 'rebut' || v === 'v2' || v === 'solution') {
      const v1 = l.v1 && l.v1.d, rb = l.rebut && l.rebut.d, v2 = l.v2 && l.v2.d;
      if (!v1 && !v2 && !rb) return [h('div', { class: 'empty', text: '해결책 대기 중' })];
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
        h('div', { class: 'n' }, [g + '모둠' + (cur ? ' · 지금 ' + STAGES_.find((s) => s.key === cur).short : ''), ago(latestT, !!l[finalKey]),
          typingCount(g) ? h('span', { class: 'typing', text: '입력 중 ' + typingCount(g) }) : null]),
        h('div', { class: 't', text: TOPICS[g - 1] }),
        h('div', { class: 'dots', 'aria-hidden': 'true' }, STAGES_.map((s) => h('span', { class: 'dot' + (l[s.key] ? (s.key === cur ? ' now' : ' on') : '') })))
      ]),
      h('div', { class: 'col-b' }, content(g))
    ]);
  }

  // 신호등 집계 카드
  function tallyCard(all, noun) {
    const n = { G: 0, Y: 0, R: 0 };
    all.forEach((r) => { n[r.light] = (n[r.light] || 0) + 1; });
    const total = all.length;
    const pct = (k) => (total ? Math.round((n[k] / total) * 100) : 0);
    const bar = h('div', { class: 'sum-bar', role: 'img', 'aria-label': '초록 ' + n.G + ', 노랑 ' + n.Y + ', 빨강 ' + n.R },
      ['G', 'Y', 'R'].map((k) => (n[k] ? h('div', { class: 'seg ' + k, style: 'flex:' + n[k], text: String(n[k]) }) : null)));
    const legend = h('div', { class: 'sum-legend' }, ['G', 'Y', 'R'].map((k) => h('span', null, [h('i', { class: k }), ({ G: '초록 확인됨 ', Y: '노랑 확인 못 함 ', R: '빨강 틀림·출처 없음 ' })[k] + n[k] + '개 (' + pct(k) + '%)'])));
    const reds = all.filter((r) => r.light !== 'G');
    return h('section', { class: 'sum-card' }, [
      h('h2', { text: noun + ' ' + total + '개 중, 자료로 확인된 것은 ' + n.G + '개' }),
      total ? h('div', null, [bar, legend]) : h('div', { class: 'empty', text: '아직 신호등 판정이 없어요' }),
      reds.length ? h('div', { class: 'lbl', text: '확인되지 않은 내용' }) : null,
      h('div', { class: 'sum-list' }, reds.map((r) => h('div', { class: 'sig' }, [h('i', { class: r.light }),
        h('div', null, [h('div', { class: 'box', text: r.claim }), h('div', { class: 'muted', text: r.g + '모둠' + (r.aiSrc ? ' · AI 출처: ' + r.aiSrc : '') + (r.source ? ' · 확인: ' + r.source : '') })])])))
    ]);
  }

  // 반 전체 정리
  function summaryView() {
    const all = [];
    if (nanje) {
      TOPICS.forEach((t, i) => {
        const sg = data.latest[i + 1] && data.latest[i + 1].signal;
        ((sg && sg.d.rows) || []).forEach((r) => { if (r.claim && r.light) all.push({ g: i + 1, ...r }); });
      });
    } else {
      TOPICS.forEach((t, i) => act.stages.forEach((st) => {
        const p = data.latest[i + 1] && data.latest[i + 1][st.key];
        if (p) G.lightRows(st, p.d).forEach((r) => all.push({ g: i + 1, ...r }));
      }));
    }
    const left = tallyCard(all, nanje ? 'AI 주장' : '조사한 내용');
    if (!nanje) {
      const right = h('section', { class: 'sum-card' }, [
        h('h2', { text: '모둠별 「' + lastStage.short + '」' }),
        h('div', { class: 'sum-list' }, TOPICS.map((t, i) => {
          const p = data.latest[i + 1] && data.latest[i + 1][finalKey];
          const d = p && p.d;
          return h('div', { class: 'sum-row' }, [
            h('div', { class: 'sum-g' }, [h('b', { text: (i + 1) + '모둠' }), h('span', { text: t })]),
            d ? h('div', { class: 'sum-final' + (d.img ? '' : ' noimg') }, [
              d.img ? pic(d.img, (i + 1) + '모둠 ' + lastStage.short) : null,
              h('div', null, G.boardBody(lastStage, Object.assign({}, d, { img: '' }), pic).filter(Boolean))
            ]) : h('div', { class: 'muted', text: '대기 중' })
          ]);
        }))
      ]);
      return h('div', { class: 'sum-grid' }, [left, right]);
    }
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
      claim: '주장', aiSrc: 'AI 출처', source: '확인 결과', light: '판정', summary: '반론', decision: '판단', reason: '이유' };
    const LIGHT = { G: '초록', Y: '노랑', R: '빨강' };
    const flat = (d) => Object.keys(d).filter((k) => k !== 'img').map((k) => {
      const v = d[k];
      if (k === 'rows') return v.map((r, i) => (i + 1) + ') ' + Object.keys(r).filter((x) => r[x]).map((x) => (K[x] || x) + ': ' + (x === 'light' ? LIGHT[r[x]] : r[x])).join(', ')).join(' / ');
      return (K[k] || k) + ': ' + (Array.isArray(v) ? v.join('·') : v);
    }).filter((x) => !/: $/.test(x)).join(' | ') + (d.img ? ' | [사진·그림 첨부]' : '');
    const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    if (!nanje) act.stages.forEach((x) => { LBL[x.key] = x.label; });
    const text = (r) => (genStage(r.s) ? G.flatText(genStage(r.s), r.d || {}) + (r.d && r.d.img ? ' | [사진·그림 첨부]' : '') : flat(r.d || {}));
    const lines = [['시각', '모둠', act.topicLabel || '주제', '단계', '내용']].concat(rows.map((r) => [
      new Date(r.t).toLocaleString('ko-KR'), r.g + '모둠', TOPICS[r.g - 1] || '', LBL[r.s] || r.s, text(r)]));
    const blob = new Blob(['\ufeff' + lines.map((l) => l.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: act.title.replace(/\s+/g, '') + '_' + room.room + '.csv' });
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
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(view === v[0]), text: v[1], onclick: () => { view = v[0]; store(viewKey, view); render(); } })));
    const top = h('header', { class: 'b-top' }, [
      h('h1', null, [h('small', { class: 'kicker', text: '융합과학 탐구 · ' + act.unit }), act.title]),
      h('span', { class: 'q', text: act.question }),
      h('span', { class: 'sp' }),
      tabs,
      h('div', { class: 'joinbox' }, [qrNode(), h('div', null, [h('div', { class: 'code', text: room.room }), h('div', { class: 'url', text: studentUrl }), h('div', { class: 'muted', text: 'QR을 누르면 크게 보여요' })])]),
      h('div', { class: 'b-side' }, [
        h('span', { class: 'b-meta', text: updated ? '갱신 ' + new Date(updated).toLocaleTimeString('ko-KR') : '연결 중…' }),
        h('div', { class: 'b-btns' }, [
          h('button', { type: 'button', class: 'btn', text: '발표 모드', onclick: () => presGo(focus || 1, 0) }),
          h('button', { type: 'button', class: 'btn-ghost', text: '기록 저장(엑셀)', onclick: exportCsv })
        ])
      ])
    ]);
    const grid = view === 'summary' ? summaryView() : h('div', { class: 'b-grid' }, TOPICS.map((t, i) => column(i + 1, false)));
    root.replaceChildren(h('main', { class: 'b-wrap' }, [isDemo ? demoBanner() : null, top, grid]));
    if (focus) {
      const ov = h('div', { class: 'ov', onclick: (e) => { if (e.target === ov) { focus = 0; render(); } } }, [column(focus, true)]);
      root.appendChild(ov);
    }
    if (pres) { focus = 0; root.appendChild(presView()); }
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
    if (pres && !bigImg) {
      const n = presSteps(pres.g).length;
      if (['ArrowRight', 'PageDown', ' '].indexOf(e.key) >= 0) { e.preventDefault(); if (pres.i < n - 1) presGo(pres.g, pres.i + 1); return; }
      if (['ArrowLeft', 'PageUp'].indexOf(e.key) >= 0) { e.preventDefault(); if (pres.i > 0) presGo(pres.g, pres.i - 1); return; }
      if (/^[1-5]$/.test(e.key) && Number(e.key) <= TOPICS.length) { presGo(Number(e.key), 0); return; }
      if (e.key === 'Escape') { pres = null; render(); return; }
    }
    if (e.key !== 'Escape') return;
    if (bigImg) { bigImg = null; zoom = 1; render(); } else if (bigQr) { bigQr = false; render(); } else if (focus) { focus = 0; render(); }
  });
  // 작성 중 내용은 자주 바뀌므로 1초에 한 번만 다시 그림 (그림 크게 보기·QR 크게 보기 중에는 멈춤)
  let liveTimer = null;
  const renderSoon = () => {
    if (liveTimer) return;
    liveTimer = setTimeout(() => { liveTimer = null; if (!bigImg && !bigQr) render(); }, 1000);
  };
  if (room.subscribeDrafts) room.subscribeDrafts((list) => { drafts = list; renderSoon(); }, () => {});
  room.subscribe((r) => { rows = r; data = summarize(r); updated = Date.now(); render(); },
    (err) => toast('연결이 끊겼어요: ' + err.message));
  render();
  // '몇 분 전' 표시 갱신 (크게 보기 중에는 건너뜀)
  setInterval(() => { if (!bigImg && !bigQr && (view === 'live' || !focus)) render(); }, view === 'live' ? 10000 : 30000);
}
