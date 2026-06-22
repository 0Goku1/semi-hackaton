// ============================================================
//  전역 설정 파일 (config.js)
//  발표용 프로토타입이 아닌 실서비스라면 도메인 제한 + 서버 프록시로 보호해야 함)
// ============================================================

const CONFIG = {
  // 카카오 JavaScript 키 (js/secrets.js 에서 로드)
  KAKAO_JS_KEY: SECRETS.KAKAO_JS_KEY,

  // 위치 못 가져올 때 쓰는 기본 중심 (화성시)
  DEFAULT_MAP_CENTER: {
    lat: 37.1996,
    lng: 126.8313,
  },

  // 지도 초기 확대 레벨 (숫자가 작을수록 더 확대됨)
  MAP_LEVEL: 4,
};

// 실제 지도 중심 — 앱 실행 중 내 위치로 갱신될 수 있음
let MAP_CENTER = { ...CONFIG.DEFAULT_MAP_CENTER };
