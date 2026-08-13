# -*- coding: utf-8 -*-
"""순찰 배정 코어: 등산로·임도 네트워크 + TOP(OR-Tools) + 차량/도보 경로 합성."""
from __future__ import annotations

import json
import math
import os
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import networkx as nx
import numpy as np
from ortools.constraint_solver import pywrapcp, routing_enums_pb2

# 프로젝트 루트: server/ 의 상위. EC2에서는 DATA_ROOT 로 덮어쓸 수 있음.
# 예) export DATA_ROOT=/home/ubuntu/koriyo
_ROOT_ENV = os.getenv("DATA_ROOT", "").strip()
ROOT = Path(_ROOT_ENV) if _ROOT_ENV else Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
WEB = ROOT / "route-dev-data"
NETWORK_CANDIDATES = [
    WEB / "route_dev_network.json",
    PROC / "route_dev_network.json",
    Path(__file__).resolve().parent / "data" / "route_dev_network.json",
]

VEH_KMH = 30.0
DETOUR = 1.4
TRANSFER_MIN = 6.0
DWELL_MIN = 15
BUDGET_MIN = 180
WALK_KMH = 3.4

# 접근 유형 (추후 근접/원격 감시 UI 확장용)
ACCESS_ENTER_M = 300
ACCESS_NEAR_M = 1000


@dataclass
class Stop:
    grid_id: str
    score: float
    lat: float
    lon: float
    node: int
    comp: int
    snap_dist_m: float
    access_type: str  # enter | near | remote


@dataclass
class Officer:
    id: str
    name: str
    available: bool
    is_me: bool
    lat: float
    lng: float
    node: int = -1
    comp: int = -1


def _haversine_m(lat1, lon1, lat2, lon2) -> float:
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _vehicle_minutes(lat1, lon1, lat2, lon2) -> float:
    return _haversine_m(lat1, lon1, lat2, lon2) * DETOUR / 1000 / VEH_KMH * 60 + TRANSFER_MIN


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def resolve_risk_grids(raw: Any) -> list[dict]:
    """[{grid_id, score}] 또는 {grids:[...]} 모두 허용."""
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict) and "grids" in raw:
        return raw["grids"]
    raise ValueError("risk_grids JSON은 배열 또는 {grids:[...]} 형식이어야 합니다")


class PatrolNetwork:
    def __init__(self, path: Optional[Path] = None):
        p = path
        if p is None:
            p = next((c for c in NETWORK_CANDIDATES if c.exists()), None)
        if p is None:
            raise FileNotFoundError(
                "route_dev_network.json 없음. analysis/14_export_route_dev_assets.py 실행 필요"
            )
        self.path = p
        self.raw = load_json(p)
        self.nodes = self.raw["nodes"]
        self.edges = self.raw["edges"]
        self.G = nx.Graph()
        for e in self.edges:
            self.G.add_edge(e["u"], e["v"], minutes=float(e["minutes"]), src=e.get("src"), coords=e.get("coords"))
        self._edge_map = {}
        for e in self.edges:
            a, b = e["u"], e["v"]
            self._edge_map[(min(a, b), max(a, b))] = e

    def nearest_node(self, lat: float, lon: float) -> tuple[int, float]:
        best_i, best_d = 0, 1e18
        for n in self.nodes:
            d = _haversine_m(lat, lon, n["lat"], n["lon"])
            if d < best_d:
                best_d, best_i = d, n["i"]
        return best_i, best_d

    def node_ll(self, i: int) -> tuple[float, float]:
        n = self.nodes[i]
        return n["lat"], n["lon"]

    def node_comp(self, i: int) -> int:
        return int(self.nodes[i]["comp"])

    def dijkstra_minutes(self, src: int) -> dict[int, float]:
        return nx.single_source_dijkstra_path_length(self.G, src, weight="minutes")

    def path_coords(self, src: int, dst: int) -> list[list[float]]:
        """[lng, lat] 목록. 실패 시 양 끝점만."""
        try:
            nodes = nx.shortest_path(self.G, src, dst, weight="minutes")
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            la, lo = self.node_ll(src)
            lb, lob = self.node_ll(dst)
            return [[lo, la], [lob, lb]]
        coords: list[list[float]] = []
        for a, b in zip(nodes, nodes[1:]):
            e = self._edge_map.get((min(a, b), max(a, b)))
            seg = (e.get("coords") if e else None) or []
            if not seg:
                la, lo = self.node_ll(a)
                lb, lob = self.node_ll(b)
                seg = [[lo, la], [lob, lb]]
            # 방향
            nlat, nlon = self.node_ll(a)
            if seg:
                d0 = abs(seg[0][0] - nlon) + abs(seg[0][1] - nlat)
                d1 = abs(seg[-1][0] - nlon) + abs(seg[-1][1] - nlat)
                if d1 < d0:
                    seg = list(reversed(seg))
            for j, c in enumerate(seg):
                if coords and j == 0:
                    continue
                coords.append([float(c[0]), float(c[1])])
        return coords


def fetch_vehicle_route(lat1, lon1, lat2, lon2) -> tuple[list[list[float]], float]:
    """카카오 모빌리티(있으면) → OSRM driving → 직선 추정.

    Returns: coords [[lng,lat],...], minutes
    """
    kakao_key = os.getenv("KAKAO_REST_KEY", "").strip()
    if kakao_key:
        try:
            url = "https://apis-navi.kakaomobility.com/v1/directions"
            body = json.dumps(
                {
                    "origin": {"x": lon1, "y": lat1},
                    "destination": {"x": lon2, "y": lat2},
                    "priority": "RECOMMEND",
                }
            ).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=body,
                headers={
                    "Authorization": f"KakaoAK {kakao_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            routes = data.get("routes") or []
            if routes:
                r0 = routes[0]
                secs = r0.get("summary", {}).get("duration", 0)
                coords = []
                for sec in r0.get("sections", []):
                    for road in sec.get("roads", []):
                        v = road.get("vertexes") or []
                        for i in range(0, len(v), 2):
                            coords.append([float(v[i]), float(v[i + 1])])
                if coords:
                    return coords, max(1.0, float(secs) / 60.0 + TRANSFER_MIN)
        except Exception as e:
            print(f"[patrol] Kakao vehicle failed: {e}")

    # OSRM driving
    try:
        url = (
            f"https://router.project-osrm.org/route/v1/driving/"
            f"{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson"
        )
        with urllib.request.urlopen(url, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        route = (data.get("routes") or [None])[0]
        if data.get("code") == "Ok" and route:
            coords = [[c[0], c[1]] for c in route["geometry"]["coordinates"]]
            minutes = float(route["duration"]) / 60.0 + TRANSFER_MIN
            return coords, minutes
    except Exception as e:
        print(f"[patrol] OSRM driving failed: {e}")

    minutes = _vehicle_minutes(lat1, lon1, lat2, lon2)
    return [[lon1, lat1], [lon2, lat2]], minutes


def access_type_for(dist_m: float) -> str:
    if dist_m <= ACCESS_ENTER_M:
        return "enter"
    if dist_m <= ACCESS_NEAR_M:
        return "near"
    return "remote"


def build_travel_matrix(
    net: PatrolNetwork,
    officers: list[Officer],
    stops: list[Stop],
) -> np.ndarray:
    points = []
    for o in officers:
        points.append({"kind": "agent", "node": o.node, "comp": o.comp, "lat": o.lat, "lon": o.lng})
    for s in stops:
        points.append({"kind": "grid", "node": s.node, "comp": s.comp, "lat": s.lat, "lon": s.lon})

    n = len(points)
    mat = np.zeros((n, n), dtype=float)
    cache: dict[int, dict[int, float]] = {}
    for i, p in enumerate(points):
        if p["node"] not in cache:
            try:
                cache[p["node"]] = net.dijkstra_minutes(p["node"])
            except Exception:
                cache[p["node"]] = {}
        dist = cache[p["node"]]
        for j, q in enumerate(points):
            if i == j:
                continue
            if p["comp"] == q["comp"] and q["node"] in dist:
                mat[i, j] = float(dist[q["node"]])
            else:
                mat[i, j] = _vehicle_minutes(p["lat"], p["lon"], q["lat"], q["lon"])
    return mat


def solve_top(
    mat: np.ndarray,
    n_agents: int,
    scores: list[float],
    budget: int = BUDGET_MIN,
    dwell: int = DWELL_MIN,
    time_limit_s: float = 2.0,
) -> list[list[int]]:
    """stops index in mat: 0..n_agents-1 agents, n_agents.. grids.
    Returns list of grid-local indices (0-based into scores) per agent in visit order.
    """
    n = mat.shape[0]
    n_grids = n - n_agents
    if n_grids <= 0 or n_agents <= 0:
        return [[] for _ in range(max(0, n_agents))]

    mgr = pywrapcp.RoutingIndexManager(
        n, n_agents, list(range(n_agents)), list(range(n_agents))
    )
    routing = pywrapcp.RoutingModel(mgr)

    def cb(from_i, to_i):
        i, j = mgr.IndexToNode(from_i), mgr.IndexToNode(to_i)
        extra = dwell if j >= n_agents else 0
        return int(mat[i, j] + extra)

    transit = routing.RegisterTransitCallback(cb)
    routing.SetArcCostEvaluatorOfAllVehicles(transit)
    routing.AddDimension(transit, 0, int(budget), True, "Time")

    for k in range(n_agents, n):
        score = scores[k - n_agents]
        # 높음(>=0.85) 사실상 필수, 그 외 선택
        pen = 100_000 if score >= 0.85 else max(200, int(score * 800))
        routing.AddDisjunction([mgr.NodeToIndex(k)], pen)

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    params.time_limit.FromMilliseconds(int(time_limit_s * 1000))

    sol = routing.SolveWithParameters(params)
    routes: list[list[int]] = [[] for _ in range(n_agents)]
    if not sol:
        return routes

    for v in range(n_agents):
        idx = routing.Start(v)
        while not routing.IsEnd(idx):
            node = mgr.IndexToNode(idx)
            if node >= n_agents:
                routes[v].append(node - n_agents)
            idx = sol.Value(routing.NextVar(idx))
    return routes


def enrich_leg_geometry(
    net: PatrolNetwork,
    officers: list[Officer],
    stops: list[Stop],
    route_grid_idxs: list[int],
    officer_idx: int,
) -> tuple[list[dict], float]:
    """요원 경로 legs + 총 분."""
    seq = [officers[officer_idx]]
    for gi in route_grid_idxs:
        seq.append(stops[gi])

    legs = []
    total = 0.0
    for a, b in zip(seq, seq[1:]):
        a_node = a.node if isinstance(a, Officer) else a.node
        b_node = b.node if isinstance(b, Officer) else b.node
        a_lat = a.lat if isinstance(a, Officer) else a.lat
        a_lon = a.lng if isinstance(a, Officer) else a.lon
        b_lat = b.lat if isinstance(b, Officer) else b.lat
        b_lon = b.lng if isinstance(b, Officer) else b.lon
        a_comp = a.comp if isinstance(a, Officer) else a.comp
        b_comp = b.comp if isinstance(b, Officer) else b.comp
        to_id = None if isinstance(b, Officer) else b.grid_id

        if a_comp == b_comp and a_node >= 0 and b_node >= 0:
            try:
                dist = net.dijkstra_minutes(a_node)
                minutes = float(dist.get(b_node, _vehicle_minutes(a_lat, a_lon, b_lat, b_lon)))
            except Exception:
                minutes = _vehicle_minutes(a_lat, a_lon, b_lat, b_lon)
            coords = net.path_coords(a_node, b_node)
            mode = "trail"
        else:
            coords, minutes = fetch_vehicle_route(a_lat, a_lon, b_lat, b_lon)
            mode = "vehicle"

        # 격자 접근 마지막 구간 (스냅→격자 중심)
        if not isinstance(b, Officer):
            snap_lat, snap_lon = net.node_ll(b_node)
            if coords:
                coords = coords + [[b.lon, b.lat]]
            access_min = b.snap_dist_m / 1000 / WALK_KMH * 60
            minutes += access_min
            legs.append(
                {
                    "mode": mode,
                    "minutes": round(minutes - access_min, 1),
                    "coords": coords[:-1] if len(coords) > 1 else coords,
                    "to_grid_id": None,
                }
            )
            legs.append(
                {
                    "mode": "access",
                    "minutes": round(access_min, 1),
                    "coords": [[snap_lon, snap_lat], [b.lon, b.lat]],
                    "to_grid_id": to_id,
                    "access_type": b.access_type,
                }
            )
            total += minutes + DWELL_MIN
        else:
            legs.append(
                {
                    "mode": mode,
                    "minutes": round(minutes, 1),
                    "coords": coords,
                    "to_grid_id": to_id,
                }
            )
            total += minutes

    return legs, total


def assign_patrol(
    risk_grids: list[dict],
    officers_raw: list[dict],
    completed_ids: Optional[set[str]] = None,
    budget: int = BUDGET_MIN,
    time_limit_s: float = 2.0,
    enrich_geometry: bool = True,
) -> dict:
    t0 = time.perf_counter()
    completed_ids = completed_ids or set()
    net = PatrolNetwork()

    # 가용 요원만
    officers: list[Officer] = []
    for o in officers_raw:
        if not o.get("available", True):
            continue
        lat, lng = float(o["lat"]), float(o["lng"])
        node, _ = net.nearest_node(lat, lng)
        officers.append(
            Officer(
                id=str(o["id"]),
                name=str(o.get("name") or o["id"]),
                available=True,
                is_me=bool(o.get("is_me")),
                lat=lat,
                lng=lng,
                node=node,
                comp=net.node_comp(node),
            )
        )
    if not officers:
        return {
            "ok": False,
            "error": "가용 요원이 없습니다",
            "routes": [],
            "unassigned": risk_grids,
            "meta": {},
        }

    # me 를 앞으로 (표시·기본 선택)
    officers.sort(key=lambda x: (0 if x.is_me else 1, x.id))

    stops: list[Stop] = []
    skipped_completed = []
    for g in risk_grids:
        gid = g["grid_id"]
        if gid in completed_ids:
            skipped_completed.append(gid)
            continue
        # grid center from national grid if possible
        try:
            import sys

            sys.path.insert(0, str(ROOT / "src"))
            import grid as G

            cx, cy = G.decode(gid, res=G.GRID_RES)
            from pyproj import Transformer

            lon, lat = Transformer.from_crs(5179, 4326, always_xy=True).transform(cx, cy)
        except Exception:
            lat = float(g.get("lat") or 37.2)
            lon = float(g.get("lon") or 126.83)
        node, dist = net.nearest_node(lat, lon)
        stops.append(
            Stop(
                grid_id=gid,
                score=float(g.get("score", 0.5)),
                lat=float(lat),
                lon=float(lon),
                node=node,
                comp=net.node_comp(node),
                snap_dist_m=float(dist),
                access_type=access_type_for(dist),
            )
        )

    if not stops:
        return {
            "ok": True,
            "routes": [],
            "unassigned": [],
            "completed_excluded": skipped_completed,
            "meta": {"message": "배정할 위험 격자 없음(모두 순찰 완료)"},
        }

    mat = build_travel_matrix(net, officers, stops)
    scores = [s.score for s in stops]
    routes_idx = solve_top(mat, len(officers), scores, budget=budget, time_limit_s=time_limit_s)

    assigned = set()
    out_routes = []
    for oi, gidxs in enumerate(routes_idx):
        assigned.update(gidxs)
        legs = []
        total_min = 0.0
        if enrich_geometry and gidxs:
            legs, total_min = enrich_leg_geometry(net, officers, stops, gidxs, oi)
        else:
            # minutes only from matrix
            cur = oi
            for gi in gidxs:
                j = len(officers) + gi
                total_min += float(mat[cur, j]) + DWELL_MIN
                cur = j

        out_routes.append(
            {
                "officer_id": officers[oi].id,
                "officer_name": officers[oi].name,
                "is_me": officers[oi].is_me,
                "minutes": round(total_min, 1),
                "stops": [
                    {
                        "grid_id": stops[gi].grid_id,
                        "score": stops[gi].score,
                        "lat": stops[gi].lat,
                        "lon": stops[gi].lon,
                        "access_type": stops[gi].access_type,
                        "snap_dist_m": round(stops[gi].snap_dist_m, 1),
                        "status": "pending",
                    }
                    for gi in gidxs
                ],
                "legs": legs,
            }
        )

    unassigned = [
        {"grid_id": stops[i].grid_id, "score": stops[i].score}
        for i in range(len(stops))
        if i not in assigned
    ]

    return {
        "ok": True,
        "routes": out_routes,
        "unassigned": unassigned,
        "completed_excluded": skipped_completed,
        "unavailable_officers": [
            o["id"] for o in officers_raw if not o.get("available", True)
        ],
        "meta": {
            "n_agents": len(officers),
            "n_risk": len(stops),
            "n_assigned": len(assigned),
            "budget_min": budget,
            "dwell_min": DWELL_MIN,
            "solver": "OR-Tools TOP (PATH_CHEAPEST_ARC + GLS)",
            "network": str(net.path.name),
            "vehicle": "Kakao REST if KAKAO_REST_KEY else OSRM driving",
            "elapsed_s": round(time.perf_counter() - t0, 3),
        },
    }
