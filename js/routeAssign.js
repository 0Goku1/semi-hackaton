/**
 * 테스트용 격자→순찰자 배정 (근무 체크/실근무 연계 없음)
 *
 * 가정:
 *  - 위험 격자 후보 = ROUTE_DEV_GRIDS (임시 20)
 *  - 순찰자 풀 = 30명 (항상 가용으로 가정 — 실제 근무 명단은 추후)
 *  - 격자 1개당 순찰자 1명
 *  - 본인(isMain)에게 먼저 가장 격자 배정 → 나머지는 score 높은 순으로 가까운 순찰자
 *  - 배정 못 받은 순찰자 10명은 대기
 */
const TEST_PATROL_OFFICERS = (() => {
  const seed = [
    { id: "USER_001", name: "정승우", isMain: true, lat: 37.1995, lng: 126.8312 },
    { id: "USER_002", name: "이다영", isMain: false, lat: 37.2201, lng: 126.9495 },
    { id: "USER_003", name: "양정빈", isMain: false, lat: 37.2244, lng: 126.9847 },
    { id: "USER_004", name: "김상범", isMain: false, lat: 37.2273, lng: 126.9644 },
    { id: "USER_005", name: "박서현", isMain: false, lat: 37.2113, lng: 126.9696 },
    { id: "USER_006", name: "최민준", isMain: false, lat: 37.2050, lng: 126.8200 },
    { id: "USER_007", name: "정하은", isMain: false, lat: 37.1800, lng: 126.8500 },
    { id: "USER_008", name: "윤도현", isMain: false, lat: 37.1600, lng: 126.8800 },
    { id: "USER_009", name: "강수아", isMain: false, lat: 37.1450, lng: 126.7000 },
    { id: "USER_010", name: "조예준", isMain: false, lat: 37.1500, lng: 126.7200 },
    { id: "USER_011", name: "한지호", isMain: false, lat: 37.0900, lng: 126.7700 },
    { id: "USER_012", name: "오서연", isMain: false, lat: 37.0950, lng: 126.8000 },
    { id: "USER_013", name: "신우진", isMain: false, lat: 37.0700, lng: 126.9200 },
    { id: "USER_014", name: "임채원", isMain: false, lat: 37.1000, lng: 126.9600 },
    { id: "USER_015", name: "배수빈", isMain: false, lat: 37.1300, lng: 126.8700 },
    { id: "USER_016", name: "황준서", isMain: false, lat: 37.2100, lng: 126.8100 },
    { id: "USER_017", name: "송지민", isMain: false, lat: 37.2500, lng: 126.8000 },
    { id: "USER_018", name: "류하린", isMain: false, lat: 37.2300, lng: 126.7500 },
    { id: "USER_019", name: "문태윤", isMain: false, lat: 37.1200, lng: 126.8300 },
    { id: "USER_020", name: "노은채", isMain: false, lat: 37.0550, lng: 126.8300 },
    { id: "USER_021", name: "구민재", isMain: false, lat: 37.1900, lng: 126.9000 },
    { id: "USER_022", name: "안예서", isMain: false, lat: 37.1750, lng: 126.9500 },
    { id: "USER_023", name: "홍시우", isMain: false, lat: 37.1400, lng: 126.9000 },
    { id: "USER_024", name: "서다온", isMain: false, lat: 37.1000, lng: 126.7500 },
    { id: "USER_025", name: "권지안", isMain: false, lat: 37.0800, lng: 126.8600 },
    { id: "USER_026", name: "유하준", isMain: false, lat: 37.2000, lng: 126.9800 },
    { id: "USER_027", name: "남소율", isMain: false, lat: 37.1650, lng: 126.7800 },
    { id: "USER_028", name: "표건우", isMain: false, lat: 37.1100, lng: 126.9100 },
    { id: "USER_029", name: "변서아", isMain: false, lat: 37.2400, lng: 126.8600 },
    { id: "USER_030", name: "석도윤", isMain: false, lat: 37.1550, lng: 126.8400 },
  ];
  return seed.map((o) => ({ ...o, status: o.isMain ? "WAITING" : "WAITING" }));
})();

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function gridAsLatLng(grid) {
  return { lat: grid.lat, lng: grid.lon ?? grid.lng };
}

/**
 * @returns {{
 *   assignments: Array<{officer, grid, distanceM}>,
 *   unassignedOfficers: Array,
 *   byOfficerId: Record<string, object>
 * }}
 */
function assignGridsToOfficers(grids, officers, originOverride) {
  const pool = (grids && grids.length ? grids : []).slice().sort((a, b) => b.score - a.score);
  const free = (officers && officers.length ? officers : TEST_PATROL_OFFICERS).map((o) => ({
    ...o,
    lat: o.isMain && originOverride ? originOverride.lat : o.lat,
    lng: o.isMain && originOverride ? originOverride.lng : o.lng,
  }));

  const assignments = [];
  const usedOfficer = new Set();
  const usedGrid = new Set();

  const takeNearestPair = (preferOfficerId) => {
    let best = null;
    for (const g of pool) {
      if (usedGrid.has(g.grid_id)) continue;
      const gll = gridAsLatLng(g);
      for (const o of free) {
        if (usedOfficer.has(o.id)) continue;
        if (preferOfficerId && o.id !== preferOfficerId) continue;
        const d = haversineMeters({ lat: o.lat, lng: o.lng }, gll);
        if (!best || d < best.distanceM) {
          best = { officer: o, grid: g, distanceM: Math.round(d) };
        }
      }
    }
    return best;
  };

  // 1) 본인 우선: 20격자 중 가장 가까운 곳
  const main = free.find((o) => o.isMain) || free[0];
  if (main) {
    const mine = takeNearestPair(main.id);
    if (mine) {
      usedOfficer.add(mine.officer.id);
      usedGrid.add(mine.grid.grid_id);
      assignments.push(mine);
    }
  }

  // 2) 남은 격자(score 순) → 남은 순찰자 중 최근접
  for (const g of pool) {
    if (usedGrid.has(g.grid_id)) continue;
    const gll = gridAsLatLng(g);
    let best = null;
    for (const o of free) {
      if (usedOfficer.has(o.id)) continue;
      const d = haversineMeters({ lat: o.lat, lng: o.lng }, gll);
      if (!best || d < best.distanceM) {
        best = { officer: o, grid: g, distanceM: Math.round(d) };
      }
    }
    if (!best) break;
    usedOfficer.add(best.officer.id);
    usedGrid.add(best.grid.grid_id);
    assignments.push(best);
  }

  const byOfficerId = {};
  assignments.forEach((a) => {
    byOfficerId[a.officer.id] = a;
  });

  return {
    assignments,
    unassignedOfficers: free.filter((o) => !usedOfficer.has(o.id)),
    byOfficerId,
  };
}

function getMyPatrolAssignment(origin) {
  const grids = typeof ROUTE_DEV_GRIDS !== "undefined" ? ROUTE_DEV_GRIDS : [];
  const result = assignGridsToOfficers(grids, TEST_PATROL_OFFICERS, origin);
  const main = TEST_PATROL_OFFICERS.find((o) => o.isMain);
  const mine = main ? result.byOfficerId[main.id] : result.assignments[0];
  return { ...result, mine };
}

function assignmentToDangerZone(assignment) {
  if (!assignment || !assignment.grid) return null;
  const g = assignment.grid;
  const typeKo =
    (typeof ROUTE_DEV_TYPE_KO !== "undefined" && ROUTE_DEV_TYPE_KO[g.type]) || g.type;
  return {
    id: `GRID_${g.grid_id.replace(/\s+/g, "")}`,
    type: `${typeKo} 접촉 격자`,
    lat: g.lat,
    lng: g.lon,
    dangerLevel: g.dangerLevel || "위험도 높음",
    address: `${g.emd_name || ""} · ${g.grid_id}`,
    description: `위험순위 ${g.rank} · score ${g.score}`,
    grid_id: g.grid_id,
    score: g.score,
    rank: g.rank,
  };
}
