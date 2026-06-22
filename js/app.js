// ============================================================
//  앱 메인 로직 (app.js)
//  스텝 1: 지도 초기화만 담당합니다.
//  (스텝 2~3에서 마커/히트맵/순찰노선이 여기에 추가됩니다)
// ============================================================

// 카카오맵 객체를 전역에서 접근할 수 있도록 보관
let map = null;

/**
 * 내 위치를 MAP_CENTER 변수에 저장하고 반환합니다.
 * localStorage에 저장된 값이 있으면 먼저 불러옵니다.
 * geolocation 실패 시 config 기본값을 사용합니다.
 */
function loadMapCenter() {
  const saved = localStorage.getItem("mapCenter");
  if (saved) {
    MAP_CENTER = JSON.parse(saved);
  }

  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(MAP_CENTER);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        MAP_CENTER = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        localStorage.setItem("mapCenter", JSON.stringify(MAP_CENTER));
        console.log("📍 내 위치로 중심 설정:", MAP_CENTER);
        resolve(MAP_CENTER);
      },
      (error) => {
        console.warn("위치 접근 실패, 기본값 사용:", error.message);
        resolve(MAP_CENTER);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 60000,
      }
    );
  });
}

/**
 * 지도를 생성하고 화면에 그립니다.
 */
async function initMap() {
  const center = await loadMapCenter();

  const container = document.getElementById("map");

  const options = {
    center: new kakao.maps.LatLng(center.lat, center.lng),
    level: CONFIG.MAP_LEVEL,
  };

  map = new kakao.maps.Map(container, options);

  // 우측 상단 확대/축소 컨트롤 추가 (선택사항)
  const zoomControl = new kakao.maps.ZoomControl();
  map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);

  console.log("✅ 지도 초기화 완료", center);
}

// 카카오맵 SDK가 완전히 로드된 뒤에 initMap을 실행
// (index.html에서 autoload=false로 불러왔기 때문에 load 콜백 사용)
kakao.maps.load(initMap);
