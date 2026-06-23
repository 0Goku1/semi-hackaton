// 순찰 동선 공통 모듈 — index / patrol / report 에서 공유
// dummyData.js 가 먼저 로드되어 있어야 한다.

const PATROL_ROUTE_CONFIG = {
  osrmViaId: "DZ_001",
  destinationId: "DZ_003",
  color: "#FF5722",
};

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

async function buildPatrolRoutePoints(origin) {
  const via = dummyDangerZones.find((z) => z.id === PATROL_ROUTE_CONFIG.osrmViaId);
  const destination = dummyDangerZones.find(
    (z) => z.id === PATROL_ROUTE_CONFIG.destinationId
  );

  const points = [];
  let junction = via ? { lat: via.lat, lng: via.lng } : origin;

  // origin → DZ_001 (OSRM)
  if (via && origin) {
    try {
      const osrm = await fetchPatrolOsrmRoute(origin, {
        lat: via.lat,
        lng: via.lng,
      });
      osrm.path.forEach((p) => points.push(p));
      if (osrm.path.length) junction = osrm.path[osrm.path.length - 1];
    } catch (e) {
      console.warn("[patrolRoute] OSRM 실패:", e.message);
      points.push({ lat: origin.lat, lng: origin.lng });
      points.push({ lat: via.lat, lng: via.lng });
    }
  }

  // 경유지 → DZ_003
  const manual = [junction];
  dummyWaypoints.forEach((w) => manual.push({ lat: w.lat, lng: w.lng }));
  if (destination) manual.push({ lat: destination.lat, lng: destination.lng });
  manual.forEach((p) => points.push(p));

  return { points, via, destination };
}
