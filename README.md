# 통통새 스튜디오 — 앱인토스 미니앱

- appName: `tongtong-bird` (콘솔 등록 시 이 이름 그대로 사용)
- 표시 이름: 통통새 스튜디오
- 딥링크: `intoss://tongtong-bird`

토스 스타일 플로피버드 게임. 최고점수 기록, 효과음(Web Audio), 난이도 점진 상승, 토스 햅틱 피드백 포함.

## 실행 방법

```bash
npm install
npm run dev        # 개발 서버 (granite dev) — 샌드박스 앱 연결용
npm run web:dev    # 브라우저에서만 빠르게 확인할 때 (vite)
npm run build      # 배포용 .ait 번들 생성 (ait build)
npm run deploy     # 콘솔로 번들 업로드 (ait deploy, 토큰 설정 필요)
```

> 햅틱·네이티브 저장소는 토스 샌드박스 앱 안에서만 동작해요. 일반 브라우저에서는 자동으로 폴백(localStorage)됩니다.

## 출시 절차 (개발자 등록 전 기준)

### 1. 앱인토스 콘솔 등록
1. [앱인토스 콘솔](https://apps-in-toss.toss.im) 회원가입 후 워크스페이스 생성
2. 미니앱 등록: 앱 로고, 앱 이름, **appName**(고유 키), 사용 연령, 고객센터 이메일/연락처 입력
3. 카테고리는 **게임**으로 선택 — 게임은 **게임 등급분류**(자체등급분류 또는 GRAC) 관련 안내를 따라야 해요
4. 사업자가 없어도 출시 가능해요 (개인 자격). 수익화(광고/결제)를 하려면 사업자 등록·계약 필요

### 2. 코드에 콘솔 정보 반영
`granite.config.ts`에서 수정:
- `appName`: 콘솔에 등록한 appName과 **반드시 동일하게**
- `brand.icon`: 콘솔 앱 정보에 업로드한 아이콘 이미지 URL

### 3. 샌드박스 앱으로 테스트
1. [샌드박스 앱 설치](https://developers-apps-in-toss.toss.im/development/test/sandbox.html)
2. `npm run dev` 실행
3. 샌드박스 앱에서 `intoss://{appName}` 스킴 열기
   - 실기기(iPhone): PC와 같은 와이파이 + 샌드박스 앱에 PC IP 입력, `granite.config.ts`의 `web.host`도 PC IP로 변경, dev 명령어에 `--host` 추가
   - Android: `adb reverse tcp:8081 tcp:8081`, `adb reverse tcp:5173 tcp:5173`

### 4. 토스앱에서 테스트
1. `npm run build`로 `flappy-bird.ait` 번들 생성
2. 콘솔에 번들 업로드 → QR 코드로 실제 토스앱에서 테스트
3. **테스트 1회 이상 완료해야 검토 요청 버튼이 활성화**돼요

### 5. 검토 요청 → 출시
1. 콘솔에서 '검토 요청하기' (영업일 기준 최대 3일 소요)
2. 승인되면 이메일 안내 → '출시하기' 버튼 클릭 (즉시 전체 사용자에게 공개)
3. 반려 시 사유 확인 → 수정한 새 번들 업로드 후 재요청

### 게임 검수 체크 포인트
- [게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-game.html) 필독 (내비게이션 바, 사운드, 등급 표기 등)
- 번들 100MB 이하 (현재 약 20KB로 여유)
- `webViewProps.type: 'game'` 설정 완료됨

## 등급분류 심의용 웹 데모 올리기

심의위원이 직접 플레이할 수 있는 URL이 필요할 때:

```bash
npm run web:build   # dist/ 폴더에 웹 빌드 생성
```

그다음 [Netlify Drop](https://app.netlify.com/drop)에 접속해 `dist` 폴더를 통째로 드래그하면 몇 초 만에 공개 URL이 생겨요 (무료 계정 필요). 생성된 URL을 GRAC 신청서의 게임물 제출 항목에 적으면 됩니다.

> 햅틱·네이티브 저장소는 토스 앱 밖에서는 자동 폴백되므로 브라우저에서도 정상 플레이돼요.

## 프로젝트 구조

```
granite.config.ts   # 앱인토스 설정 (appName, 브랜드, 빌드 명령)
index.html          # 캔버스 + 모바일 뷰포트 설정
src/main.ts         # 게임 로직 전체 (물리, 충돌, 난이도, 렌더링)
src/bridge.ts       # 햅틱·저장소 래퍼 (브라우저 폴백 포함)
src/sound.ts        # Web Audio 효과음 (에셋 파일 없음)
```

## 게임 튜닝

`src/main.ts` 상단 상수로 조절:
- `BASE_SPEED`/`MAX_SPEED`, `SPEED_PER_SCORE`: 속도와 난이도 상승폭
- `BASE_GAP`/`MIN_GAP`: 파이프 틈 크기
- `GRAVITY`, `FLAP_VELOCITY`: 조작감
