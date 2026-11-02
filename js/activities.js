// 수업 활동 목록. 'nanje'는 공개수업 차시(02 난제 해결), 나머지는 이전 차시(01 미래 사회와 융합과학 기술) 연습 활동.
// 연습 활동은 아래 설정만으로 학생 입력 화면과 교실 화면이 만들어진다.
import { TOPICS } from './config.js';

const LIGHT = { k: 'light', type: 'light' };
const FIELDS = { k: 'fields', type: 'checks', label: '융합되는 학문 (2개 이상)', options: ['물리학', '화학', '생명과학', '지구과학', '공학·정보', '사회·경제'], min: 2, minMsg: '융합되는 학문을 2개 이상 골라 주세요.' };

export const ACTIVITIES = {
  nanje: {
    id: 'nanje',
    title: '난제 해결 라이브 보드',
    unit: '02 융합과학 기술과 사회적 난제 해결 · 교과서 163~172쪽',
    question: 'AI가 알려 준 답, 그대로 믿고 난제를 풀 수 있을까?',
    topics: TOPICS,
    engine: 'nanje'
  },

  future: {
    id: 'future',
    title: '미래 유망 기술 예측하기',
    unit: '01 미래 사회와 융합과학 기술 · 교과서 156~157쪽',
    question: '10년 전에 예측한 미래 기술, 지금 얼마나 맞았을까?',
    topicLabel: '조사할 기관',
    topics: ['한국과학기술기획평가원(KISTEP)', '한국과학기술정보연구원(KISTI)', 'MIT 테크놀로지 리뷰', '세계경제포럼(WEF)', '가트너(Gartner)'],
    stages: [
      {
        key: 'p1', label: '① 영화 속 미래 기술', short: '영화 속 기술',
        hint: '「백 투 더 퓨처 2」(1990)가 그린 2015년의 기술 가운데 두 가지를 골라 지금의 기술과 비교해요. 예: 비디오 안경 → 스마트 안경, 지문 인식 현관문, 호버보드 → 자기 부상 열차, 스마트 옷 (교과서 156쪽)',
        fields: [
          { k: 'rows', type: 'rows', n: 2, title: (i) => '영화 속 기술 ' + (i + 1), sub: [
            { k: 'movie', type: 'text', label: '영화 속 기술', ph: '예: 호버보드' },
            { k: 'now', type: 'text', label: '지금은 어떻게 쓰이나', ph: '예: 자기장의 반발력을 이용한 자기 부상 열차' },
            { k: 'real', type: 'radio', options: ['실현됨', '일부 실현', '아직'] }
          ], req: (r) => r.movie && r.now, reqMsg: '영화 속 기술 하나 이상과 지금의 모습을 적어 주세요.' }
        ]
      },
      {
        key: 'p2', label: '② 10년 전·5년 전·올해 유망 기술', short: '기관 발표',
        hint: '우리 모둠 기관이 발표한 미래 유망 기술을 한 가지씩 찾아요. AI에게 물어봐도 되지만, AI는 없는 발표를 지어내기도 해요. 기관 누리집이나 보도 자료에서 확인하고 신호등을 표시해요. (초록: 확인됨 / 노랑: 확인 못 함 / 빨강: 사실과 다름)',
        fields: [
          { k: 'rows', type: 'rows', n: 3, title: (i) => ['10년 전 발표', '5년 전 발표', '올해(가장 최근) 발표'][i], sub: [
            { k: 'tech', type: 'text', label: '유망 기술', ph: '예: 무인 자율주행 자동차' },
            { k: 'desc', type: 'text', label: '어떤 기술인가', ph: '한 줄 설명' },
            { k: 'source', type: 'text', label: '확인한 자료', ph: '예: KISTEP 2015 보도 자료' },
            LIGHT
          ], req: (r) => r.tech, reqMsg: '유망 기술을 하나 이상 적어 주세요.' }
        ]
      },
      {
        key: 'p3', label: '③ 예측과 현실 비교', short: '예측 vs 현실',
        hint: '10년 전, 5년 전에 기대했던 기술이 지금 얼마나 실현되었는지 토의해요. (교과서 157쪽 탐구 3)',
        fields: [
          { k: 'level', type: 'radio', label: '10년 전 예측은 지금…', options: ['대부분 실현', '일부 실현', '거의 안 됨'] },
          { k: 'compare', type: 'area', label: '토의 결과', req: true, rows: 3, ph: '예: 자율주행은 일부 도로에서 시범 운행 중이지만, 운전자 없이 달리는 단계는 아직이다.' },
          { k: 'why', type: 'area', label: '예측이 빗나간(또는 맞은) 까닭', rows: 2, ph: '기술·비용·법·사회적 수용 등' }
        ]
      },
      {
        key: 'p4', label: '④ 우리가 예측한 유망 기술', short: '우리의 예측',
        final: 'tech',
        hint: '기관이 아직 고르지 않았지만 10년 뒤 유망할 기술을 근거와 함께 제안해요. 교과서 158~159쪽 융합과학 기술(바이오 나노, 에너지 저장, 사물 인터넷, 인공지능, 로봇, 양자 컴퓨터)을 참고해요.',
        fields: [
          { k: 'tech', type: 'area', label: '우리가 예측한 미래 유망 기술', req: true, ph: '예: 혈관 속을 다니며 약을 전달하는 바이오 나노 로봇' },
          FIELDS,
          { k: 'reason', type: 'area', label: '유망하다고 보는 근거', req: true, rows: 3, ph: '자료·통계·현재 연구 사례 등 객관적인 근거' }
        ]
      }
    ]
  },

  uam: {
    id: 'uam',
    title: '새로운 융합과학 기술 조사하기',
    unit: '01 미래 사회와 융합과학 기술 · 교과서 160~161쪽',
    question: '하나의 미래 기술 속에는 몇 개의 기술이 숨어 있을까?',
    topicLabel: '조사할 사례',
    topics: ['스마트 그리드', '가상·증강 현실(VR·AR)', '스마트 팜', '자율주행 자동차', '스마트 시티'],
    stages: [
      {
        key: 'p1', label: '① UAM 속 기술의 역할', short: 'UAM',
        hint: '도심형 항공 모빌리티(UAM)에 쓰이는 기술이 각각 무슨 일을 하는지 조사해요. 예: 센서 기술 → 비행 높이, 기상 조건, 주변 환경을 감지 (교과서 160쪽)',
        fields: [
          { k: 'rows', type: 'rows', n: 5, title: (i) => ['인공지능', '디지털 네트워크', '빅데이터 분석', '센서 기술', '블록체인 기술'][i], sub: [
            { k: 'role', type: 'text', label: 'UAM에서 하는 일', ph: '' }
          ], req: (r) => r.role, reqMsg: '기술 하나 이상의 역할을 적어 주세요.' }
        ]
      },
      {
        key: 'p2', label: '② 우리 사례 속 융합 기술', short: '융합 기술',
        hint: '우리 모둠 사례에 어떤 기술들이 융합되어 있는지 찾아요. AI에게 물어본 내용은 자료에서 확인하고 신호등을 표시해요. (초록: 확인됨 / 노랑: 확인 못 함 / 빨강: 사실과 다름)',
        fields: [
          { k: 'rows', type: 'rows', n: 4, title: (i) => '융합된 기술 ' + (i + 1), sub: [
            { k: 'tech', type: 'text', label: '융합된 기술', ph: '예: 사물 인터넷 센서' },
            { k: 'desc', type: 'text', label: '사례에서 하는 일', ph: '' },
            { k: 'source', type: 'text', label: '확인한 자료', ph: '예: 교과서 161쪽, 한국전력 누리집' },
            LIGHT
          ], req: (r) => r.tech, reqMsg: '융합된 기술을 하나 이상 적어 주세요.' }
        ]
      },
      {
        key: 'p3', label: '③ 더 발전시키려면', short: '발전 아이디어',
        hint: '우리 사례를 더 발전시키려면 어떤 기술을 더하면 좋을지 토의해요. 예: 부품에 재활용 소재 쓰기, 소음·분진 줄이는 기술 (교과서 161쪽)',
        fields: [
          { k: 'add', type: 'area', label: '더하고 싶은 기술', req: true, ph: '' },
          { k: 'effect', type: 'area', label: '더하면 무엇이 좋아지나', req: true, rows: 3, ph: '' }
        ]
      },
      {
        key: 'p4', label: '④ 미래 생활 모습 그리기', short: '미래 생활',
        final: 'scene', needImg: true,
        hint: '우리 사례가 쓰이는 10년 뒤 생활 모습을 그림으로 표현해요. "직접 그리기"로 그리거나, 종이에 그려 찍어 올려요. (교과서 161쪽 탐구 5)',
        fields: [
          { k: 'scene', type: 'area', label: '그림 설명 한 문장', req: true, ph: '예: 아파트 옥상 태양광이 남는 전기를 이웃집과 나누는 동네' },
          FIELDS
        ]
      }
    ]
  }
};

export const ACT_IDS = Object.keys(ACTIVITIES);
// 교실 화면에서 고를 수 있는 활동 (차시 순서). uam은 예전 코드 호환용으로만 남김
export const LISTED = ['future', 'nanje'];
export const ACT_TAG = { future: 'Ⅲ-01 차시', nanje: 'Ⅲ-02 차시', uam: 'Ⅲ-01 추가' };
export const getAct = (id) => ACTIVITIES[id] || ACTIVITIES.nanje;
