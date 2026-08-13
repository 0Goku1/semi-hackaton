/**
 * =============================================================================
 * REMOVABLE DEV MODULE — route-dev 시작점 (기기 GPS ↔ 화성시청)
 * =============================================================================
 * 목적: 기본은 실GPS(제품 흐름). 원거리 디버깅할 때만 버튼으로 화성시청에 고정.
 *
 * 등록 기준 좌표 (화성시청 · DEV 고정용):
 *   lat 37.1995372034835
 *   lng 126.831477350332
 *
 * 모드:
 *   device_gps (**기본**) — 브라우저 실GPS. 화성 밖이면 내 동선 0격자 가능(제품 방향).
 *   city_hall             — 화성시청 고정. 원거리 디버깅용.
 *
 * 제거 체크리스트 (개발 완료 후):
 *   1) 이 파일 삭제
 *   2) route-dev.html 에서 script + #btn-dev-start-pos 제거
 *   3) css/route-dev.css 의 /* DEV-START-POS */ 블록 제거
 *   4) route-dev.js 의 RouteDevStartPos 연동 → 실GPS만 쓰도록 단순화
 *   5) docs/ROUTE_DEV_PROGRESS.md §6 해당 절 삭제/갱신
 * =============================================================================
 */
const RouteDevStartPos = (() => {
  const HWASEONG_CITY_HALL = Object.freeze({
    lat: 37.1995372034835,
    lng: 126.831477350332,
    label: "화성시청",
  });

  const MODE_HALL = "city_hall";
  const MODE_GPS = "device_gps";
  // v2: 기본을 device_gps로 바꾼 뒤 키 갱신 (옛 city_hall 기본값이 남지 않게)
  const STORAGE_KEY = "routeDevStartPosMode_v2";

  let mode = MODE_GPS; // 제품 기본 = 내 위치
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === MODE_HALL || saved === MODE_GPS) mode = saved;
  } catch (_) {
    /* ignore */
  }

  function getMode() {
    return mode;
  }

  function isCityHallMode() {
    return mode === MODE_HALL;
  }

  function setMode(next) {
    mode = next === MODE_HALL ? MODE_HALL : MODE_GPS;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch (_) {
      /* ignore */
    }
    return mode;
  }

  function toggleMode() {
    return setMode(mode === MODE_GPS ? MODE_HALL : MODE_GPS);
  }

  /** 버튼 문구 = 현재 모드 */
  function buttonLabel() {
    return mode === MODE_GPS ? "시작: 내위치" : "시작: 시청";
  }

  function modeHintKo() {
    return mode === MODE_GPS
      ? "시작점 기기 GPS"
      : "시작점 화성시청(DEV)";
  }

  function fetchDeviceGps() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) =>
          resolve({
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            source: "device_gps",
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }

  /**
   * 현재 모드에 맞는 시작점.
   * @returns {Promise<{lat:number,lng:number,source:string,label?:string}>}
   */
  async function resolveStartPos() {
    if (mode === MODE_HALL) {
      return {
        lat: HWASEONG_CITY_HALL.lat,
        lng: HWASEONG_CITY_HALL.lng,
        source: MODE_HALL,
        label: HWASEONG_CITY_HALL.label,
      };
    }
    const gps = await fetchDeviceGps();
    if (gps) return gps;
    // GPS 실패 시에만 시청 폴백
    return {
      lat: HWASEONG_CITY_HALL.lat,
      lng: HWASEONG_CITY_HALL.lng,
      source: "gps_fallback_hall",
      label: HWASEONG_CITY_HALL.label,
    };
  }

  /** 동기: 시청 좌표 (폴백 center 등) */
  function cityHall() {
    return {
      lat: HWASEONG_CITY_HALL.lat,
      lng: HWASEONG_CITY_HALL.lng,
    };
  }

  return {
    HWASEONG_CITY_HALL,
    MODE_HALL,
    MODE_GPS,
    getMode,
    isCityHallMode,
    setMode,
    toggleMode,
    buttonLabel,
    modeHintKo,
    fetchDeviceGps,
    resolveStartPos,
    cityHall,
  };
})();
