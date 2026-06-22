// ============================================================
//  앱 메인 로직 (app.js)
//  스텝 1: 지도 초기화만 담당합니다.
//  (스텝 2~3에서 마커/히트맵/순찰노선이 여기에 추가됩니다)
// ============================================================

// 카카오맵 객체를 전역에서 접근할 수 있도록 보관
let map = null;

/**
 * 지도를 생성하고 화면에 그립니다.
 */
function initMap() {
  const container = document.getElementById("map");

  const options = {
    center: new kakao.maps.LatLng(CONFIG.MAP_CENTER.lat, CONFIG.MAP_CENTER.lng),
    level: CONFIG.MAP_LEVEL,
  };

  map = new kakao.maps.Map(container, options);

  // 우측 상단 확대/축소 컨트롤 추가 (선택사항)
  const zoomControl = new kakao.maps.ZoomControl();
  map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);

  console.log("✅ 지도 초기화 완료");
}

// 카카오맵 SDK가 완전히 로드된 뒤에 initMap을 실행
// (index.html에서 autoload=false로 불러왔기 때문에 load 콜백 사용)
kakao.maps.load(initMap);
