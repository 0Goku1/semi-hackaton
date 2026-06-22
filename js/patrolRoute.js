// ==========================================================================
//  patrolRoute.js — 순찰 동선 공통 모듈
//  index.html(app.js) 과 patrol-report.html(report.js) 에서 동일하게 호출한다.
//   1단계: 현재위치(origin) → DZ_001  (OSRM 도보 API, 실제 도로)
//   2단계: DZ_001 → SO_001~SO_017(수동 경유지) → DZ_003
//  ※ dummyData.js 가 먼저 로드되어 있어야 한다.
// ==========================================================================
const PATROL_ROUTE_CONFIG = {
  osrmViaId: "DZ_001", // 1단계 OSRM 도착점
  destinationId: "DZ_003", // 2단계 최종 도착점
  color: "#FF5722", // 동선 색상 (index / report 공통)
};

// OSRM 도보 경로 (from → to, 실제 도로 좌표 배열 반환)
async function fetchPatrolOsrmRoute(from, to) {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url =
    `https://router.project-osrm.org/route/v1/foot/${coords}` +
    `?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM API ${res.status}`);

  const data = await res.json();
  const route = data.routes?.[0];
  if (data.code !== "Ok" || !route) throw new Error("OSRM 경로 없음");

  return {
    path: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    distance: route.distance,
  };
}

// 순찰 동선 전체 좌표 계산
//  origin: { lat, lng } | null  (없으면 1단계 OSRM 생략, DZ_001 에서 시작)
//  반환: { points: [{lat,lng}...], via, destination, osrmFailed }
async function buildPatrolRoutePoints(origin) {
  const via = dummyDangerZones.find((z) => z.id === PATROL_ROUTE_CONFIG.osrmViaId);
  const destination = dummyDangerZones.find(
    (z) => z.id === PATROL_ROUTE_CONFIG.destinationId
  );

  const points = [];
  let osrmFailed = false;
  let junction = via ? { lat: via.lat, lng: via.lng } : origin;

  // ── 1단계: origin → DZ_001 (OSRM 도보, 실제 도로) ──
  if (via && origin) {
    try {
      const osrm = await fetchPatrolOsrmRoute(origin, {
        lat: via.lat,
        lng: via.lng,
      });
      osrm.path.forEach((p) => points.push(p));
      // OSRM 경로 마지막 좌표를 2단계 시작점으로 → 끊김 없이 연결
      if (osrm.path.length) junction = osrm.path[osrm.path.length - 1];
    } catch (e) {
      console.warn("[patrolRoute] OSRM 실패 → 직선 대체:", e.message);
      osrmFailed = true;
      points.push({ lat: origin.lat, lng: origin.lng });
      points.push({ lat: via.lat, lng: via.lng });
    }
  }

  // ── 2단계: junction → SO_001~SO_017 → DZ_003 (수동 경유지) ──
  const manual = [junction];
  dummyWaypoints.forEach((w) => manual.push({ lat: w.lat, lng: w.lng }));
  if (destination) manual.push({ lat: destination.lat, lng: destination.lng });
  manual.forEach((p) => points.push(p));

  return { points, via, destination, osrmFailed };
}
