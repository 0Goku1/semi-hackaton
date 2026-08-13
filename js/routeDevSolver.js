/**
 * 동선 DEV — 등산로·임도 2계층 이동비용 + TOP(Team Orienteering) 휴리스틱
 * analysis/09_network.py · 10_solver_bench.py 모델과 동일 가정:
 *  - 같은 컴포넌트: 네트워크 minutes (등산로 실측 / 임도 4km/h)
 *  - 다른 컴포넌트: 직선×1.4 / 30km/h + 환승 6분
 *  - 체류 15분, 근무 180분, 높음 등급 우선
 *
 * OR-Tools 대신 PATH_CHEAPEST 스타일 greedy + 개선 (브라우저 임시).
 */
const ROUTE_DEV_SOLVER = {
  VEH_KMH: 30,
  DETOUR: 1.4,
  TRANSFER: 6,
  DWELL: 15,
  BUDGET: 180,
  N_AGENTS: 5,
};

function haversineM(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** 인접리스트 그래프 */
function buildAdj(network) {
  const adj = new Map();
  const edgeKey = (u, v) => (u < v ? `${u}_${v}` : `${v}_${u}`);
  const edgeMap = new Map();
  network.edges.forEach((e) => {
    edgeMap.set(edgeKey(e.u, e.v), e);
    if (!adj.has(e.u)) adj.set(e.u, []);
    if (!adj.has(e.v)) adj.set(e.v, []);
    adj.get(e.u).push({ to: e.v, minutes: e.minutes });
    adj.get(e.v).push({ to: e.u, minutes: e.minutes });
  });
  return { adj, edgeMap, edgeKey };
}

function dijkstra(adj, start) {
  const dist = new Map([[start, 0]]);
  const prev = new Map();
  const pq = [[0, start]];
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, u] = pq.shift();
    if (d !== dist.get(u)) continue;
    const nbrs = adj.get(u) || [];
    for (const { to, minutes } of nbrs) {
      const nd = d + minutes;
      if (!dist.has(to) || nd < dist.get(to)) {
        dist.set(to, nd);
        prev.set(to, u);
        pq.push([nd, to]);
      }
    }
  }
  return { dist, prev };
}

function reconstructPath(prev, start, end) {
  if (start === end) return [start];
  const path = [];
  let cur = end;
  while (cur !== undefined && cur !== start) {
    path.push(cur);
    cur = prev.get(cur);
  }
  if (cur !== start) return null;
  path.push(start);
  path.reverse();
  return path;
}

function pathToLatLng(nodePath, edgeMap, edgeKey, nodes) {
  const coords = [];
  for (let i = 0; i < nodePath.length - 1; i++) {
    const u = nodePath[i];
    const v = nodePath[i + 1];
    const e = edgeMap.get(edgeKey(u, v));
    let seg = e && e.coords ? e.coords.slice() : null;
    if (!seg) {
      const a = nodes[u];
      const b = nodes[v];
      seg = [
        [a.lon, a.lat],
        [b.lon, b.lat],
      ];
    } else {
      // 방향 맞추기
      const a = nodes[u];
      const first = seg[0];
      const d0 = Math.hypot(first[0] - a.lon, first[1] - a.lat);
      const last = seg[seg.length - 1];
      const d1 = Math.hypot(last[0] - a.lon, last[1] - a.lat);
      if (d1 < d0) seg.reverse();
    }
    seg.forEach(([lon, lat], j) => {
      if (i > 0 && j === 0) return;
      coords.push({ lat, lng: lon });
    });
  }
  return coords;
}

function vehicleMinutes(a, b) {
  const straight = haversineM(a, b);
  return (
    (straight * ROUTE_DEV_SOLVER.DETOUR) /
      1000 /
      ROUTE_DEV_SOLVER.VEH_KMH *
      60 +
    ROUTE_DEV_SOLVER.TRANSFER
  );
}

/**
 * @param {object} network route_dev_network.json
 * @param {{lat,lng}} mePos GPS
 * @param {number} nAgents
 */
function solveRouteDevTop(network, mePos, nAgents = ROUTE_DEV_SOLVER.N_AGENTS) {
  const { adj, edgeMap, edgeKey } = buildAdj(network);
  const nodes = network.nodes;
  const grids = network.grids.slice().sort((a, b) => b.score - a.score);

  // 요원 0 = 나(GPS→최근접 노드). 나머지 가상 요원을 상위 컴포넌트 중심에 배치
  const meSnap = nearestNetworkNode(nodes, mePos.lat, mePos.lng);
  const agents = [{ kind: "me", node: meSnap.i, lat: mePos.lat, lng: mePos.lng, comp: nodes[meSnap.i].comp }];

  const compCenters = {};
  nodes.forEach((n) => {
    if (!compCenters[n.comp]) compCenters[n.comp] = { lon: 0, lat: 0, n: 0, i: n.i };
    const c = compCenters[n.comp];
    c.lon += n.lon;
    c.lat += n.lat;
    c.n += 1;
  });
  const centers = Object.keys(compCenters)
    .map((k) => {
      const c = compCenters[k];
      return {
        comp: +k,
        lon: c.lon / c.n,
        lat: c.lat / c.n,
        i: c.i,
      };
    })
    .sort((a, b) => a.comp - b.comp);

  for (let a = 1; a < nAgents; a++) {
    const c = centers[(a - 1) % centers.length];
    const nn = nearestNetworkNode(nodes, c.lat, c.lon);
    agents.push({
      kind: "virtual",
      node: nn.i,
      lat: nodes[nn.i].lat,
      lng: nodes[nn.i].lon,
      comp: nodes[nn.i].comp,
    });
  }

  // stops: agents + grids
  const stops = [
    ...agents.map((a, idx) => ({
      kind: "agent",
      agentIdx: idx,
      node: a.node,
      lat: a.lat,
      lng: a.lng,
      comp: a.comp,
      score: 0,
      grid: null,
    })),
    ...grids.map((g) => ({
      kind: "grid",
      agentIdx: -1,
      node: g.snap_node,
      lat: g.lat,
      lng: g.lon,
      comp: g.snap_comp,
      score: g.score,
      grid: g,
      high: g.rank <= 5,
    })),
  ];

  // Dijkstra from each unique node
  const uniqueNodes = [...new Set(stops.map((s) => s.node))];
  const distCache = new Map();
  uniqueNodes.forEach((ni) => {
    distCache.set(ni, dijkstra(adj, ni));
  });

  const n = stops.length;
  const mat = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const si = stops[i];
      const sj = stops[j];
      if (si.comp === sj.comp) {
        const d = distCache.get(si.node).dist.get(sj.node);
        if (d !== undefined) {
          mat[i][j] = d;
          continue;
        }
      }
      mat[i][j] = vehicleMinutes(
        { lat: si.lat, lng: si.lng },
        { lat: sj.lat, lng: sj.lng }
      );
    }
  }

  // PATH_CHEAPEST 스타일: 각 요원 루프에 미방문 격자 중 (이동+체류) 최소이면서 budget 내 삽입
  const assigned = new Set();
  const routes = agents.map((_, ai) => ({
    agentIdx: ai,
    stopIndices: [ai], // start at agent depot
    minutes: 0,
    grids: [],
  }));

  const gridIndices = stops
    .map((s, i) => (s.kind === "grid" ? i : -1))
    .filter((i) => i >= 0)
    .sort((a, b) => {
      // 높음(상위5) 먼저, 그다음 score
      const ga = stops[a];
      const gb = stops[b];
      if (ga.high !== gb.high) return ga.high ? -1 : 1;
      return gb.score - ga.score;
    });

  let improved = true;
  while (improved) {
    improved = false;
    for (const gi of gridIndices) {
      if (assigned.has(gi)) continue;
      let best = null;
      for (const route of routes) {
        const last = route.stopIndices[route.stopIndices.length - 1];
        const travel = mat[last][gi];
        const cost = travel + ROUTE_DEV_SOLVER.DWELL;
        // 복귀 비용 대략: 격→depot
        const back = mat[gi][route.agentIdx];
        if (route.minutes + cost + back > ROUTE_DEV_SOLVER.BUDGET) continue;
        if (!best || cost < best.cost) {
          best = { route, cost, travel };
        }
      }
      if (best) {
        best.route.stopIndices.push(gi);
        best.route.minutes += best.cost;
        best.route.grids.push(stops[gi].grid);
        assigned.add(gi);
        improved = true;
      }
    }
  }

  // 내(요원0) 경로 좌표 전개
  const myRoute = routes[0];
  const pathPoints = [];
  const legMeta = [];
  for (let k = 0; k < myRoute.stopIndices.length - 1; k++) {
    const i = myRoute.stopIndices[k];
    const j = myRoute.stopIndices[k + 1];
    const si = stops[i];
    const sj = stops[j];
    let leg = [];
    let mode = "vehicle";
    if (si.comp === sj.comp) {
      const { prev, dist } = distCache.get(si.node);
      if (dist.has(sj.node)) {
        const np = reconstructPath(prev, si.node, sj.node);
        if (np) {
          leg = pathToLatLng(np, edgeMap, edgeKey, nodes);
          mode = "trail";
        }
      }
    }
    if (!leg.length) {
      leg = [
        { lat: si.lat, lng: si.lng },
        { lat: sj.lat, lng: sj.lng },
      ];
      mode = "vehicle";
    }
    // 격자 접근 마지막 도보(비안내): snap → 격자 중심
    if (sj.kind === "grid" && sj.grid) {
      leg.push({ lat: sj.grid.lat, lng: sj.grid.lon });
    }
    if (k === 0) pathPoints.push(...leg);
    else pathPoints.push(...leg.slice(1));
    legMeta.push({ mode, minutes: mat[i][j], to: sj.grid?.grid_id || "depot" });
  }

  return {
    routes: routes.map((r) => ({
      agentIdx: r.agentIdx,
      isMe: r.agentIdx === 0,
      minutes: Math.round(r.minutes),
      grids: r.grids,
      count: r.grids.length,
    })),
    myPath: pathPoints,
    myGrids: myRoute.grids,
    myMinutes: Math.round(myRoute.minutes),
    visited: assigned.size,
    totalGrids: grids.length,
    meSnap,
    matSample: { sameCompHint: "trail/road minutes", crossComp: "vehicle+transfer" },
  };
}

function nearestNetworkNode(nodes, lat, lng) {
  let best = nodes[0];
  let bestD = Infinity;
  for (const n of nodes) {
    const d = haversineM({ lat, lng }, { lat: n.lat, lng: n.lon });
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return { i: best.i, distM: Math.round(bestD), node: best };
}
