import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // ⚠️ 앱인토스 콘솔에서 등록한 appName과 반드시 같아야 해요.
  // 콘솔에서 미니앱을 등록한 뒤, 등록한 이름으로 바꿔주세요.
  appName: 'tongtong-bird',
  brand: {
    displayName: '통통새 스튜디오', // 화면에 노출될 앱 이름
    primaryColor: '#3182F6',
    // 콘솔의 앱 정보에서 업로드한 아이콘 이미지 URL을 넣어주세요. (등록 전엔 빈 문자열 가능)
    icon: '',
  },
  web: {
    host: 'localhost', // 실기기 테스트 시 PC의 IP 주소로 변경
    port: 5173,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  webViewProps: {
    type: 'game', // 게임 미니앱용 웹뷰
  },
  permissions:[],
});

