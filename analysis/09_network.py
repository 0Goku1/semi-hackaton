"""
순찰 동선 최적화 설계용 네트워크 검증.

확인 항목
1) 등산로 데이터의 소요시간 필드(PMNTN_UPPL/GODN)가 실제 이동시간으로 쓸 수 있는가
2) 등산로+임도를 그래프로 합쳤을 때 연결 구조 (컴포넌트 개수 = 산이 몇 덩어리로 끊기는가)
3) 네트워크가 커버하는 500m 격자 수
4) OR-Tools로 20개 위험격자 x 요원 5명 배정이 실제로 몇 초에 풀리는가
"""

import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from pathlib import Path
import numpy as np
import pandas as pd
import geopandas as gpd
import networkx as nx
from shapely.geometry import Point, box
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import grid as G

DATA = Path(r"d:\Workspace\semi-hackaton\data")
TRAIL = DATA / "등산로_화성시" / "TB_FGDI_WG_MT_WAY_41590.shp"
ROAD_ALL = DATA / "임도망도(산길)_전국" / "TB_FGDI_FS_ID300_ALL.shp"
FOREST = DATA / "임상도(1대5000)_화성시" / "TB_FGDI_FS_IM5000_41590.shp"

pd.set_option("display.width", 220)
pd.set_option("display.max_columns", 40)


def hdr(t):
    print("\n" + "=" * 96)
    print(f"### {t}")
    print("=" * 96)


# ────────────────────────────────────────────────────────────────────
hdr("1. 등산로 소요시간 필드 검증")

tr = gpd.read_file(TRAIL, encoding="cp949")
print(f"등산로 구간 수: {len(tr)}, CRS: {tr.crs}")

# 실제 geometry 길이(m) vs 명시된 길이(PMNTN_LT)
tr["geom_len_m"] = tr.geometry.length
sub = tr[["PMNTN_LT", "geom_len_m", "PMNTN_UPPL", "PMNTN_GODN", "PMNTN_DFFL"]].copy()
print("\n--- 길이/시간 필드 기술통계 ---")
print(sub.describe().to_string())

# PMNTN_LT 단위 추정
ratio = (tr["geom_len_m"] / tr["PMNTN_LT"].replace(0, np.nan)).dropna()
print(f"\ngeom_len_m / PMNTN_LT 중위수 = {ratio.median():.1f}")
print("  → 1000 근처면 PMNTN_LT 단위는 km, 1 근처면 m")

# 소요시간에서 역산한 속도
ok = tr[(tr["PMNTN_UPPL"] > 0) & (tr["geom_len_m"] > 0)].copy()
ok["up_kmh"] = (ok["geom_len_m"] / 1000) / (ok["PMNTN_UPPL"] / 60)
ok["down_kmh"] = (ok["geom_len_m"] / 1000) / (ok["PMNTN_GODN"].replace(0, np.nan) / 60)
print("\n--- 소요시간 역산 보행속도 (km/h) ---")
print(ok[["up_kmh", "down_kmh"]].describe(percentiles=[.05, .25, .5, .75, .95]).to_string())

print("\n--- 상행 대비 하행 시간비 ---")
r = (ok["PMNTN_GODN"] / ok["PMNTN_UPPL"].replace(0, np.nan)).dropna()
print(f"하행/상행 중위수 = {r.median():.3f}  (1보다 작으면 내려올 때 더 빠름 = 물리적으로 타당)")

print("\n--- 결측 ---")
for c in ["PMNTN_LT", "PMNTN_UPPL", "PMNTN_GODN", "PMNTN_DFFL"]:
    s = tr[c]
    print(f"  {c:>12}: null={s.isna().mean():.1%}, zero={(s == 0).mean():.1%}")

print("\n--- 난이도(PMNTN_DFFL) 분포 ---")
print(tr["PMNTN_DFFL"].value_counts(dropna=False).to_string())

print("\n--- 샘플 10건 (길이 vs 상행/하행 분) ---")
print(ok[["PMNTN_LT", "geom_len_m", "PMNTN_UPPL", "PMNTN_GODN", "up_kmh"]].head(10).to_string())


# ────────────────────────────────────────────────────────────────────
hdr("2. 네트워크 그래프 구축 & 연결성")

# 화성 경계(임상도 전체 extent)로 임도 클립
fo = gpd.read_file(FOREST, encoding="cp949")
hs_bounds = fo.total_bounds
hs_box = box(*hs_bounds)

rd = gpd.read_file(ROAD_ALL, encoding="cp949")
rd = rd.to_crs(tr.crs) if rd.crs != tr.crs else rd
rd_hs = rd[rd.intersects(hs_box)].copy()
print(f"임도 전국 {len(rd)}건 → 화성 extent 내 {len(rd_hs)}건")
print(f"등산로 총연장 {tr.geometry.length.sum()/1000:.1f} km")
print(f"임도   총연장 {rd_hs.geometry.length.sum()/1000:.1f} km")


def build_graph(gdfs, snap=5.0):
    """라인 끝점을 snap(m) 격자로 반올림해 노드화 → 무향 그래프."""
    Gr = nx.Graph()
    for tag, gdf in gdfs:
        for idx, geom in zip(gdf.index, gdf.geometry):
            if geom is None or geom.is_empty:
                continue
            parts = geom.geoms if geom.geom_type == "MultiLineString" else [geom]
            for p in parts:
                cs = list(p.coords)
                a = (round(cs[0][0] / snap) * snap, round(cs[0][1] / snap) * snap)
                b = (round(cs[-1][0] / snap) * snap, round(cs[-1][1] / snap) * snap)
                if a == b:
                    continue
                L = p.length
                if Gr.has_edge(a, b) and Gr[a][b]["length"] <= L:
                    continue
                Gr.add_edge(a, b, length=L, src=tag, sid=idx)
    return Gr


for snap in (1.0, 5.0, 20.0, 50.0):
    g = build_graph([("trail", tr), ("road", rd_hs)], snap=snap)
    comps = sorted(nx.connected_components(g), key=len, reverse=True)
    lens = []
    for c in comps:
        lens.append(sum(d["length"] for _, _, d in g.subgraph(c).edges(data=True)))
    lens = np.array(lens)
    print(f"\nsnap={snap:>5.1f}m  노드={g.number_of_nodes():>5}  엣지={g.number_of_edges():>5}  "
          f"컴포넌트={len(comps):>4}")
    print(f"  최대 컴포넌트: 노드 {len(comps[0])}개, 연장 {lens[0]/1000:.1f} km "
          f"(전체 {lens.sum()/1000:.1f} km의 {lens[0]/lens.sum():.1%})")
    print(f"  연장 1km 이상 컴포넌트 수: {(lens >= 1000).sum()}, "
          f"이들 합계 {lens[lens>=1000].sum()/1000:.1f} km ({lens[lens>=1000].sum()/lens.sum():.1%})")

# 채택 스냅으로 상세
SNAP = 20.0
g = build_graph([("trail", tr), ("road", rd_hs)], snap=SNAP)
comps = sorted(nx.connected_components(g), key=len, reverse=True)
print(f"\n--- snap={SNAP}m 채택, 상위 10개 컴포넌트 ---")
for i, c in enumerate(comps[:10]):
    sg = g.subgraph(c)
    L = sum(d["length"] for _, _, d in sg.edges(data=True))
    srcs = pd.Series([d["src"] for _, _, d in sg.edges(data=True)]).value_counts().to_dict()
    xs = [n[0] for n in c]; ys = [n[1] for n in c]
    cx, cy = np.mean(xs), np.mean(ys)
    print(f"  #{i+1:>2}: 노드 {len(c):>4}, 연장 {L/1000:>6.2f} km, 구성 {srcs}, "
          f"중심격자 {G.encode(cx, cy, res=G.GRID_RES)}")

# 등산로 단독 그래프
gt = build_graph([("trail", tr)], snap=SNAP)
ct = sorted(nx.connected_components(gt), key=len, reverse=True)
print(f"\n등산로만: 컴포넌트 {len(ct)}개, 최대 노드 {len(ct[0])}")
gr_ = build_graph([("road", rd_hs)], snap=SNAP)
cr = sorted(nx.connected_components(gr_), key=len, reverse=True)
print(f"임도만  : 컴포넌트 {len(cr)}개, 최대 노드 {len(cr[0])}")
print("→ 등산로+임도 합친 컴포넌트 수가 각각의 합보다 작으면 두 망이 실제로 접속됨")


# ────────────────────────────────────────────────────────────────────
hdr("3. 네트워크가 커버하는 500m 격자")

# 등산로/임도가 통과하는 격자 (조밀 샘플링)
def touched_cells(gdf, res=G.GRID_RES, step=100):
    ids = set()
    for geom in gdf.geometry:
        if geom is None or geom.is_empty:
            continue
        parts = geom.geoms if geom.geom_type == "MultiLineString" else [geom]
        for p in parts:
            n = max(2, int(p.length / step) + 1)
            for t in np.linspace(0, p.length, n):
                pt = p.interpolate(t)
                ids.add(G.encode(pt.x, pt.y, res=res))
    return ids


c_tr = touched_cells(tr)
c_rd = touched_cells(rd_hs)
print(f"등산로 통과 500m 격자: {len(c_tr)}개")
print(f"임도   통과 500m 격자: {len(c_rd)}개")
print(f"합집합: {len(c_tr | c_rd)}개  (교집합 {len(c_tr & c_rd)}개)")

# 산림 전체 격자 대비 커버율
forest_cells = set()
for geom in fo.geometry:
    if geom is None or geom.is_empty:
        continue
    c = geom.centroid
    forest_cells.add(G.encode(c.x, c.y, res=G.GRID_RES))
print(f"\n임상도 폴리곤이 존재하는 500m 격자: {len(forest_cells)}개")
cov = len(forest_cells & (c_tr | c_rd)) / len(forest_cells)
print(f"그 중 등산로/임도가 통과하는 격자: {len(forest_cells & (c_tr|c_rd))}개 ({cov:.1%})")
print("→ 나머지는 도보 접근 경로가 데이터에 없는 격자 = 도로망 보강 필요 구간")


# ────────────────────────────────────────────────────────────────────
hdr("4. 컴포넌트 간 이격거리 (차량 이동 필요량)")

# 컴포넌트별 중심과 상호 직선거리 → 산 사이를 차량으로 얼마나 이동해야 하는가
big = [c for c in comps if sum(d["length"] for _, _, d in g.subgraph(c).edges(data=True)) >= 1000]
cents = np.array([[np.mean([n[0] for n in c]), np.mean([n[1] for n in c])] for c in big])
print(f"연장 1km 이상 컴포넌트 {len(big)}개 중심 간 직선거리(m)")
D = np.sqrt(((cents[:, None, :] - cents[None, :, :]) ** 2).sum(-1))
off = D[np.triu_indices(len(big), 1)]
print(f"  최소 {off.min():,.0f} / 중위 {np.median(off):,.0f} / 최대 {off.max():,.0f}")
nn = np.where(np.eye(len(big), dtype=bool), np.inf, D).min(axis=1)
print(f"  각 컴포넌트의 최근접 이웃까지: 중위 {np.median(nn):,.0f}m, 최대 {nn.max():,.0f}m")
print("→ 도보로 잇기 불가능한 거리. 산 사이는 차량(도로망) 이동이 전제되어야 함")


# ────────────────────────────────────────────────────────────────────
hdr("5. OR-Tools 배정 성능 실측 (2계층 이동모델: 도보 등산로 + 차량 도로)")

import time
from ortools.constraint_solver import routing_enums_pb2, pywrapcp

rng = np.random.default_rng(42)

# 이동시간 가중치: 등산로는 공식 실측 소요시간, 임도는 도보 4km/h
up_lookup = tr["PMNTN_UPPL"].to_dict()
gw = g.copy()
for a, b, d in gw.edges(data=True):
    if d["src"] == "trail":
        m = up_lookup.get(d["sid"], 0)
        d["minutes"] = float(m) if m and m > 0 else d["length"] / 1000 / 4.0 * 60
    else:
        d["minutes"] = d["length"] / 1000 / 4.0 * 60

# 위험격자 20개 + 요원 5명을 네트워크 전역에서 샘플 (컴포넌트 분산)
all_nodes = np.array([n for c in big for n in c])
node_comp = np.array([i for i, c in enumerate(big) for _ in c])
pick = rng.choice(len(all_nodes), size=25, replace=False)
pts = [tuple(all_nodes[i]) for i in pick]
pcomp = [node_comp[i] for i in pick]
agent_nodes, risk_nodes = pts[:5], pts[5:]
stops, scomp = agent_nodes + risk_nodes, pcomp[:5] + pcomp[5:]

VEH_KMH = 30.0      # 지방도/산간도로 평균
DETOUR = 1.4        # 직선거리 → 실도로 우회계수
TRANSFER = 6.0      # 하차/주차/들머리 진입 고정비용(분)

t0 = time.perf_counter()
mat = np.zeros((len(stops), len(stops)))
for i, s in enumerate(stops):
    dist = nx.single_source_dijkstra_path_length(gw, s, weight="minutes")
    for j, t in enumerate(stops):
        if i == j:
            continue
        if scomp[i] == scomp[j] and t in dist:
            mat[i, j] = dist[t]                       # 같은 산: 도보 등산로
        else:
            straight = np.hypot(s[0] - t[0], s[1] - t[1])
            mat[i, j] = straight * DETOUR / 1000 / VEH_KMH * 60 + TRANSFER  # 다른 산: 차량
t_mat = time.perf_counter() - t0
print(f"시간행렬 {len(stops)}x{len(stops)} 산출: {t_mat*1000:.1f} ms")
same = np.array([mat[i, j] for i in range(len(stops)) for j in range(len(stops))
                 if i != j and scomp[i] == scomp[j]])
diff = np.array([mat[i, j] for i in range(len(stops)) for j in range(len(stops))
                 if i != j and scomp[i] != scomp[j]])
print(f"  같은 산 내 도보 이동(분): n={len(same)}, 중위 {np.median(same):.1f}, 최대 {same.max():.1f}")
print(f"  다른 산 차량 이동(분)  : n={len(diff)}, 중위 {np.median(diff):.1f}, 최대 {diff.max():.1f}")

# 위험등급: 앞 5개 '높음'(필수 방문), 뒤 15개 '보통'(선택)
grade = ["높음"] * 5 + ["보통"] * 15
DWELL = 15  # 격자당 순찰 체류 15분
BUDGET = 180  # 요원당 3시간

N = len(stops)
mgr = pywrapcp.RoutingIndexManager(N, len(agent_nodes), list(range(len(agent_nodes))),
                                   list(range(len(agent_nodes))))
routing = pywrapcp.RoutingModel(mgr)

def cb(fi, ti):
    i, j = mgr.IndexToNode(fi), mgr.IndexToNode(ti)
    dwell = DWELL if j >= len(agent_nodes) else 0
    return int(mat[i, j] + dwell)

tidx = routing.RegisterTransitCallback(cb)
routing.SetArcCostEvaluatorOfAllVehicles(tidx)
routing.AddDimension(tidx, 0, BUDGET, True, "Time")

# 보통 등급은 미방문 허용(페널티), 높음은 필수
for k in range(len(agent_nodes), N):
    if grade[k - len(agent_nodes)] == "보통":
        routing.AddDisjunction([mgr.NodeToIndex(k)], 300)

prm = pywrapcp.DefaultRoutingSearchParameters()
prm.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
prm.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
prm.time_limit.FromSeconds(5)

t0 = time.perf_counter()
sol = routing.SolveWithParameters(prm)
t_sol = time.perf_counter() - t0
print(f"\nOR-Tools 배정 해결: {t_sol:.2f} s, status={routing.status()}")

if sol:
    visited = 0
    for v in range(len(agent_nodes)):
        idx = routing.Start(v)
        seq, tot = [], 0
        while not routing.IsEnd(idx):
            n = mgr.IndexToNode(idx)
            if n >= len(agent_nodes):
                seq.append(f"{grade[n-len(agent_nodes)]}#{n-len(agent_nodes)}")
            nxt = sol.Value(routing.NextVar(idx))
            tot += routing.GetArcCostForVehicle(idx, nxt, v)
            idx = nxt
        visited += len(seq)
        print(f"  요원{v+1}: {len(seq)}격자 / {tot}분  {' → '.join(seq) if seq else '(배정없음)'}")
    print(f"\n총 방문 격자 {visited}/20  (높음 5개 전부 포함 여부 확인)")
else:
    print("해 없음")
