import { SCIENCE_HINTS } from './config.js';
import { getAct } from './activities.js';
import * as G from './generic.js';
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
    h('h1', null, [h('small', { class: 'kicker', text: '융합과학 탐구' }), '모둠 라이브 보드']),
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
  let actId = null;
  try { actId = await room.getAct(); } catch (e) { actId = null; }
  const act = getAct(actId);
  const nanje = act.engine === 'nanje';
  const TOPICS = act.topics;
  const STAGES_ = nanje ? STAGES : act.stages;
  const lastStage = STAGES_[STAGES_.length - 1];
  const finalKey = nanje ? 'v2' : lastStage.key;
  const finalText = (d) => (nanje ? d.solution : d[lastStage.final]) || '';
  const genStage = () => (nanje ? null : act.stages.find((x) => x.key === tab));
  const keyG = 'nb_group_' + room.room;
  let group = Number(store(keyG)) || 0;
  const tabKey = 'nb_tab_' + act.id;
  const TABS = STAGES_.concat([{ key: 'comment', label: '댓글 평가' }, { key: 'free', label: '자유 게시(사진·그림)' }]);
  let tab = store(tabKey);
  if (!TABS.some((t) => t.key === tab)) tab = STAGES_[0].key;
  let summary = { latest: {}, comments: [], free: [] };
  // 이 태블릿의 고유 번호(교실 화면 '실시간 화면'에서 태블릿을 구분)
  let dev = store('nb_dev');
  if (!dev) { dev = Math.random().toString(36).slice(2, 10); store('nb_dev', dev); }
  let draftTimer = null, lastDraft = '', draftWarned = false;
  function sendDraft(card) {
    clearTimeout(draftTimer); draftTimer = null;
    if (!group || !card || !room.saveDraft) return;
    let d;
    try { d = collectFields(card); } catch (e) { return; }
    if (att && att.get()) d._img = true;
    const body = JSON.stringify([group, tab, d]);
    if (body === lastDraft || body.length > 9000) return;
    lastDraft = body;
    room.saveDraft(dev, group, tab, d).catch((e) => { if (!draftWarned) { draftWarned = true; console.warn('실시간 화면 저장 실패:', e.message); } });
  }
  function scheduleDraft(card) {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => sendDraft(card), 2000);
  }
  let att = null; // 현재 폼의 사진·그림 첨부

  const headBox = h('div');
  const formBox = h('div');
  root.replaceChildren(h('main', { class: 's-wrap' }, [isDemo ? demoBanner() : null, headBox, formBox]));

  const mine = () => summary.latest[group] || {};
  const prevData = () => (mine()[tab] && mine()[tab].d) || {};

  function renderHead() {
    const tabs = TABS;
    headBox.replaceChildren(h('header', { class: 's-head' }, [
      h('h1', null, [h('small', { class: 'kicker', text: '융합과학 탐구 · ' + act.unit }), act.title]),
      h('div', { class: 'room', text: '수업 코드 ' + room.room }),
      h('div', { class: 'muted', text: '우리 모둠을 고르고, 단계가 끝날 때마다 올리면 앞 화면에 바로 떠요.' }),
      h('div', { class: 'groups', role: 'group', 'aria-label': '모둠 선택' }, TOPICS.map((t, i) =>
        h('button', { type: 'button', 'aria-pressed': String(group === i + 1), onclick: () => { group = i + 1; store(keyG, String(group)); renderAll(); } },
          [h('b', { text: (i + 1) + '모둠' }), h('span', { text: t })]))),
      group ? h('nav', { class: 'tabs', role: 'tablist' }, tabs.map((s) =>
        h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === s.key), class: (mine()[s.key] || (s.key === 'free' && summary.free.some((f) => f.g === group))) ? 'done' : '', text: s.label,
          onclick: () => { tab = s.key; store(tabKey, tab); renderAll(); } }))) : null
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

  function guide(steps, note) {
    return h('div', { class: 'guide' }, [h('b', { text: '이렇게 해요' }),
      h('ol', null, steps.map((t) => h('li', { text: t }))), note ? h('p', { class: 'muted', text: note }) : null]);
  }
  function promptCard(label, txt) {
    const btn = h('button', { type: 'button', class: 'copy', text: '복사', onclick: () => {
      const done = () => { btn.textContent = '복사됨 ✓'; setTimeout(() => { btn.textContent = '복사'; }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, () => toast('길게 눌러 직접 복사해 주세요.'));
      else toast('길게 눌러 직접 복사해 주세요.');
    } });
    return h('div', { class: 'pcard' }, [h('span', { class: 'pl', text: label }), h('p', { text: txt }), btn]);
  }
  function fields() {
    const topic = TOPICS[group - 1] || '';
    const d = prevData();
    if (genStage()) return G.formFields(genStage(), d, (act.topicLabel ? act.topicLabel + ': ' : '') + topic);
    const v1sol = ((mine().v1 && mine().v1.d) || {}).solution || '';
    if (tab === 'map') return [
      h('h2', { text: '① 원인 마인드맵 — AI 없이 우리 힘으로' }),
      guide(['종이에 혼자 2분 동안 「왜 ' + topic + ' 문제가 생길까?」 떠오르는 원인을 적어요.',
        '모둠이 모은 원인을 환경·경제·사회·기술 칸에 나눠 1~2개씩 적어요. (해결책 아님! 「왜 생겼나」만)',
        '그중 하나를 과학 원리로 설명하고 교과서 쪽수를 붙여요. 종이 마인드맵 사진도 올려요.'],
        '예시는 수업 주제와 다른 「싱크홀(땅꺼짐)」이에요.'),
      h('div', { class: 'hint' }, [h('b', { text: topic + ' 과학 개념 힌트  ' }), SCIENCE_HINTS[topic] || '']),
      area('env', '환경 원인 — 자연에서 일어나는 원인', { ph: '예(싱크홀): 집중 호우로 땅속 흙이 씻겨 나가 빈 공간이 생긴다' }),
      area('eco', '경제 원인 — 돈, 가격, 산업', { ph: '예(싱크홀): 오래된 하수관을 바꿀 예산이 부족하다' }),
      area('soc', '사회 원인 — 인구, 생활 방식, 갈등', { ph: '예(싱크홀): 도시에 건물이 몰리며 지하 공사가 늘었다' }),
      area('tech', '기술 원인 — 기술의 부족이나 부작용', { ph: '예(싱크홀): 땅속 빈 공간을 미리 찾는 장비가 부족하다' }),
      area('science', '핵심 과학 원리 한 가지 (교과서 쪽수와 함께)', { req: true, rows: 3, ph: '예: 온실 가스가 늘어 지구가 더워지면 빙하가 녹고 바닷물이 팽창해 해수면이 오른다 — 교과서 163쪽' })
    ];
    if (tab === 'compare') return [
      h('h2', { text: '② AI 마인드맵과 비교 — 누가 무엇을 놓쳤나?' }),
      guide(['AI 담당이 아래 카드 ①을 AI에 그대로 넣어요(복사 버튼).',
        'AI가 말한 원인과 ① 우리 마인드맵을 한 줄씩 맞대어 봐요.',
        '둘 다 말한 원인 / AI만 말한 원인 / 우리만 말한 원인으로 나눠 아래 칸에 적어요.']),
      promptCard('카드 ①', "'" + topic + "'의 원인을 환경·경제·사회·기술 네 갈래 마인드맵으로 정리해 줘. 각 원인에 한 줄 설명을 붙여 줘."),
      area('common', '둘 다 말한 원인 (공통점)', { ph: '예(싱크홀): 노후 하수관 누수 — AI도 우리도 씀' }),
      area('aiOnly', 'AI만 말한 원인 → 우리가 놓친 것', { ph: '예(싱크홀): 지하 공사로 지하수 수위가 낮아짐 — 맞는지 ③에서 확인!' }),
      area('usOnly', '우리만 말한 원인 → AI가 놓친 것', { ph: '예(싱크홀): 우리 동네 공사장 주변 도로가 자주 꺼짐' })
    ];
    if (tab === 'signal') {
      const rows = d.rows || [];
      return [h('h2', { text: '③ AI 주장 신호등 — 믿어도 될까?' }),
        guide(['AI 담당이 카드 ②를 넣어 숫자·통계가 들어간 AI 주장 3개를 받아요.',
          '「AI가 한 말」과 「AI가 댄 출처」(기관·보고서 제목·링크)를 그대로 옮겨요.',
          '나머지 모둠원은 AI가 댄 링크를 직접 열어 보고, 교과서 164~171쪽·KOSIS·공공데이터포털에서 같은 내용을 찾아 「찾아본 곳과 결과」에 적어요.',
          '찾았으면 초록, 못 찾았으면 노랑, 자료와 다르거나 AI가 댄 출처·링크가 실제로 없으면 빨강!']),
        promptCard('카드 ②', '방금 말한 내용 중 숫자나 통계가 들어간 것 3개를 골라, 각각 어느 기관의 어떤 자료(보고서 제목·발행 연도·링크)에서 확인할 수 있는지 알려 줘.'),
        h('div', { class: 'hint', text: '초록: 교과서·공공기관 자료에서 확인 / 노랑: 확인할 자료를 못 찾음 / 빨강: 자료와 다르거나 출처가 없음' })]
        .concat([0, 1, 2].map((i) => {
          const r = rows[i] || {};
          return h('div', { class: 'row3', 'data-row': i }, [
            h('h3', { text: 'AI 주장 ' + (i + 1) }),
            text('claim', 'AI가 한 말', '예(싱크홀): 서울에서 한 해 싱크홀이 ○○건 생긴다', r.claim),
            text('aiSrc', 'AI가 댄 출처 (기관·보고서·링크 그대로)', '예: 국토교통부 「지하안전 백서」 2023, https://…', r.aiSrc),
            text('source', '찾아본 곳과 결과', '예: AI 링크 열어 봄 → 없는 페이지 / 교과서 165쪽 — 숫자 같음', r.source),
            radios('light', [{ v: 'G', t: '초록', cls: 'light-G' }, { v: 'Y', t: '노랑', cls: 'light-Y' }, { v: 'R', t: '빨강', cls: 'light-R' }], r.light, i)
          ]);
        }));
    }
    if (tab === 'v1') {
      const chosen = d.fields || [];
      return [
        h('h2', { text: '④ 해결책 v1 — 우리의 첫 번째 해결책' }),
        guide(['①의 원인 중 하나를 골라, 그 원인을 줄이는 기술을 정해요(교과서 168~169쪽 참고).',
          '해결책을 한 문장으로 써요: 「무엇을 이용해 무엇을 줄인다」.',
          '이 기술에 들어가는 학문을 2개 이상 고르고, 어떤 원리로 작동하는지 써요.'],
          'v1은 version 1, 처음 해결책이에요. AI 반론을 받아 ⑥에서 v2(고친 해결책)로 바꿔요.'),
        area('solution', '해결책 한 문장', { req: true, ph: '예(싱크홀): 지표 투과 레이더(GPR)로 도로 아래 빈 공간을 미리 찾아 메운다' }),
        h('div', { class: 'f' }, [h('b', { text: '융합되는 학문 (2개 이상)' }),
          h('div', { class: 'choices' }, FIELDS_OF_STUDY.map((f) =>
            h('label', null, [h('input', { type: 'checkbox', 'data-k': 'fields', value: f, checked: chosen.indexOf(f) >= 0 }), f])))]),
        area('principle', '이 기술이 작동하는 과학 원리', { req: true, rows: 3, ph: '예: 전자기파가 흙과 빈 공간의 경계에서 반사되어 돌아오는 시간으로 빈 공간의 위치를 찾는다' })
      ];
    }
    if (tab === 'rebut') {
      const rows = d.rows || [];
      return [h('h2', { text: '⑤ AI 반론 — AI는 반대편 토론자' }),
        guide(['AI 담당이 카드 ③을 넣어요. 우리 v1 해결책이 자동으로 들어가 있어요.',
          'AI가 말한 사회·경제·윤리 반론을 한 줄씩 요약해요.',
          '반론마다 「맞네, 받아들이자(수용)」 또는 「아니야, 이유는…(반박)」을 고르고 근거를 써요.',
          '셋 중 하나는 꼭 반박! 반박 근거가 맞는지 카드 ④로 AI에게 다시 물어봐도 돼요.']),
        promptCard('카드 ③', "우리 해결책은 '" + (v1sol || '[④에 쓴 해결책]') + "'이야. 너는 반대 토론자야. 사회·경제·윤리 측면 반론을 하나씩, 두 문장 이내로 말해 줘."),
        promptCard('카드 ④', "우리는 [번호] 반론에 '[우리 반박]'이라고 반박해. 설득력이 있는지 평가하고 보완할 점 하나만 알려 줘.")]
        .concat(['사회', '경제', '윤리'].map((a, i) => {
          const r = rows[i] || {};
          const ex = [['예: 장비 점검 때 도로를 막아 시민이 불편하다', '예: 수용 — 차가 적은 밤에 점검한다'],
            ['예: 장비가 비싸 작은 지자체는 쓰기 어렵다', '예: 반박 — 여러 지자체가 장비를 함께 빌려 쓰면 비용이 준다'],
            ['예: 위험 지역이 알려지면 집값이 떨어진다', '예: 수용 — 안전이 먼저지만 공개 방식은 주민과 의논한다']][i];
          return h('div', { class: 'row3', 'data-row': i }, [
            h('h3', { text: a + ' 측면 반론' }),
            text('summary', 'AI 반론 한 줄 요약', ex[0].replace('예:', '예(싱크홀):'), r.summary),
            radios('decision', [{ v: '수용', t: '수용 (맞네, 반영하자)' }, { v: '반박', t: '반박 (아니야, 이유는…)' }], r.decision, i),
            text('reason', '왜? 근거', ex[1], r.reason)
          ]);
        }));
    }
    if (tab === 'v2') return [
      h('h2', { text: '⑥ 해결책 v2 — 반론을 반영해 고친 해결책' }),
      guide(['⑤에서 「수용」한 반론을 해결책에 반영해요.',
        'v1 문장을 고쳐 더 나아진 해결책 한 문장을 써요.',
        '무엇이 왜 바뀌었는지 「○○ 반론을 받아들여 △△을 추가함」처럼 써요.']),
      v1sol ? h('div', { class: 'hint' }, [h('b', { text: '우리 v1  ' }), v1sol]) : null,
      area('solution', '더 나아진 해결책 한 문장', { req: true, ph: '예(싱크홀): 여러 지자체가 레이더 장비를 함께 빌려 밤에 점검하고, 찾은 빈 공간은 바로 메운다' }),
      area('changed', 'v1에서 무엇이 바뀌었나?', { req: true, ph: '예: 경제 반론을 받아들여 「장비 공동 대여」를, 사회 반론을 받아들여 「밤 점검」을 추가함' })
    ];
    if (tab === 'comment') {
      const others = Object.keys(summary.latest).filter((k) => Number(k) !== group && summary.latest[k][finalKey]);
      const received = summary.comments.filter((c) => Number(c.d.to) === group);
      return [
        h('h2', { text: '댓글 평가' }),
        h('div', { class: 'hint', text: nanje ? '다른 모둠 v2에 좋은 변화 하나, 궁금한 점 하나를 남겨요.' : '다른 모둠의 「' + lastStage.short + '」 결과에 좋은 점 하나, 궁금한 점 하나를 남겨요.' }),
        others.length ? h('div', { class: 'f' }, others.map((k) =>
          h('div', { class: 'recv' }, [h('b', { text: k + '모둠 · ' + (TOPICS[k - 1] || '') + '  ' }), finalText(summary.latest[k][finalKey].d)]))) :
          h('div', { class: 'muted', text: nanje ? '아직 v2를 올린 모둠이 없어요.' : '아직 「' + lastStage.short + '」을 올린 모둠이 없어요.' }),
        h('label', { class: 'f' }, ['댓글 받을 모둠', h('select', { 'data-k': 'to' },
          TOPICS.map((t, i) => (i + 1 === group ? null : h('option', { value: String(i + 1), text: (i + 1) + '모둠 · ' + t }))))]),
        area('good', nanje ? '좋은 변화 하나' : '좋은 점 하나'), area('question', '궁금한 점 하나'),
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
    if (genStage()) return G.collectFields(genStage(), box);
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
    if (genStage()) {
      const m = G.validateFields(genStage(), d);
      if (m) return m;
    }
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
    // 쓰는 동안 2초마다(멈췄을 때) 교실 화면에 보내기. 탭을 열자마자 한 번 보내 어느 탭인지 알림
    card.addEventListener('input', () => scheduleDraft(card));
    card.addEventListener('change', () => scheduleDraft(card));
    card.addEventListener('click', (e) => { if (e.target.closest('.btn-ghost, .att-preview button')) setTimeout(() => scheduleDraft(card), 500); });
    setTimeout(() => sendDraft(card), 300);
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
