/**
 * =============================================================================
 * REMOVABLE DEV MODULE — route-dev 시작점 토글
 * =============================================================================
 * 기본: 기기 GPS (index 동선찾기와 동일)
 * DEV:  "시청으로 이동" → 화성시청 고정 (버튼 점등, 문구는 "내 위치로 이동")
 *
 * 화성시청: 37.1995372034835, 126.831477350332
 *
 * 제거: 이 파일 + route-dev.html #btn-dev-start-pos/#dev-start-status
 *       + css DEV-START-POS + route-dev.js 연동
 * =============================================================================
 */
window.RouteDevStartPos = (() => {
  const CITY_HALL = Object.freeze({
    lat: 37.1995372034835,
    lng: 126.831477350332,
  });

  const MODE_GPS = "gps";
  const MODE_HALL = "hall";
  const STORAGE_KEY = "routeDevStartPosMode_v4";

  let mode = MODE_GPS;
  let cachedGps = null;

  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === MODE_GPS || s === MODE_HALL) mode = s;
  } catch (_) {
    /* ignore */
  }

  function getMode() {
    return mode;
  }

  /** 시청(DEV) 모드일 때 버튼 점등 */
  function isHallMode() {
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
    return setMode(isHallMode() ? MODE_GPS : MODE_HALL);
  }

  /**
   * 버튼 문구 = 다음에 갈 곳 (토글 액션)
   * - GPS 모드(기본): "시청으로 이동"
   * - 시청 모드(점등): "내 위치로 이동"
   */
  function buttonLabel() {
    return isHallMode() ? "내 위치로 이동" : "시청으로 이동";
  }

  function statusLabel() {
    return isHallMode() ? "배정 시작 · 화성시청(DEV)" : "배정 시작 · 내 위치";
  }

  function cityHall() {
    return { lat: CITY_HALL.lat, lng: CITY_HALL.lng };
  }

  function getCachedGps() {
    return cachedGps ? { ...cachedGps } : null;
  }

  function setCachedGps(lat, lng) {
    cachedGps = { lat: +lat, lng: +lng };
    return getCachedGps();
  }

  /** index app.js 와 동일한 GPS 읽기 (실패 시 null — 호출측에서 폴백) */
  function fetchGps() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const pos = {
            lat: p.coords.latitude,
            lng: p.coords.longitude,
          };
          cachedGps = pos;
          resolve({ ...pos });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }

  /**
   * 현재 모드의 시작 좌표 (배정 me_lat / 마커)
   * @returns {Promise<{lat:number,lng:number,mode:string}>}
   */
  async function resolveStart() {
    if (isHallMode()) {
      return { lat: CITY_HALL.lat, lng: CITY_HALL.lng, mode: MODE_HALL };
    }
    if (cachedGps) {
      return { lat: cachedGps.lat, lng: cachedGps.lng, mode: MODE_GPS };
    }
    const gps = await fetchGps();
    if (gps) return { lat: gps.lat, lng: gps.lng, mode: MODE_GPS };
    // GPS 실패 시에만 시청 좌표로 표시 (모드는 gps 유지 — index와 동일 폴백)
    return { lat: CITY_HALL.lat, lng: CITY_HALL.lng, mode: MODE_GPS, fallback: true };
  }

  function formatCoords(lat, lng) {
    return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
  }

  return {
    CITY_HALL,
    MODE_GPS,
    MODE_HALL,
    getMode,
    isHallMode,
    setMode,
    toggleMode,
    buttonLabel,
    statusLabel,
    cityHall,
    getCachedGps,
    setCachedGps,
    fetchGps,
    resolveStart,
    formatCoords,
  };
})();
