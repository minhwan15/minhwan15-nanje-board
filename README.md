# 난제 해결 라이브 보드

융합과학 탐구 Ⅲ-02 「융합과학 기술과 사회적 난제 해결」 수업용 실시간 모둠 보드입니다.
학생은 태블릿에서 단계별 결과를 올리고, 교실 앞 PC 화면에는 5개 모둠의 진행이 실시간으로 뜹니다.

- 학생 화면: `https://<배포주소>/?room=6반-1106`
- 교실 화면: `https://<배포주소>/board?room=6반-1106` (QR 코드가 함께 표시됨)
- 수업 코드(room)마다 보드가 따로 생깁니다. 6반·8반, 리허설을 코드로 나눠 쓰세요.

## 구조

정적 사이트(빌드 없음) + Firebase Firestore 실시간 저장소.

```
index.html        학생 화면
board.html        교실 앞 보드
js/config.js      Firebase 설정, 모둠 주제, 과학 개념 힌트  ← 여기만 고치면 됨
js/store.js       Firestore 연결(설정 전에는 브라우저 데모 모드)
js/student.js     학생 화면 로직
js/board.js       보드 로직
css/style.css
firestore.rules   보안 규칙(읽기·새 글만 허용, 수정·삭제 불가)
```

## 처음 한 번 설정

1. Firebase 콘솔에서 새 프로젝트 → Firestore Database 만들기(위치 asia-northeast3 서울).
2. 프로젝트 설정 → 내 앱 → 웹 앱 추가 → 나오는 `firebaseConfig` 값을 `js/config.js`에 붙여 넣기.
3. Firestore → 규칙 탭에 `firestore.rules` 내용을 붙여 넣고 게시.
4. GitHub에 push → Vercel에서 이 저장소를 Import(Framework: Other, 빌드 설정 없음) → Deploy.

`js/config.js`의 apiKey가 `YOUR_`로 시작하면 데모 모드로 돌아갑니다(같은 브라우저 탭끼리만 연결).

## 수업 단계

① 원인 마인드맵(핵심 과학 원리 필수) → ② AI와 비교 → ③ 신호등 판정 → ④ 해결책 v1(융합 학문 2개 이상·작동 원리 필수) → ⑤ AI 반론(1개 이상 반박 필수) → ⑥ 해결책 v2 → 댓글 평가

기록은 Firestore `rooms/<수업 코드>/posts`에 남습니다.
