"""탐색 시간제한별 해 품질 → 발표용 '몇 초에 답이 나오는가' 근거."""
import sys, io, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
import numpy as np
from ortools.constraint_solver import routing_enums_pb2, pywrapcp

rng = np.random.default_rng(7)
N_RISK, N_AGENT, DWELL, BUDGET = 20, 5, 15, 180

# 화성 산악 분포를 모사: 6개 산 클러스터에 위험격자 분산
clusters = rng.uniform([180_000, 1_920_000], [210_000, 1_950_000], size=(6, 2))
pts, cid = [], []
for i in range(N_RISK + N_AGENT):
    c = i % 6
    pts.append(clusters[c] + rng.normal(0, 600, 2))
    cid.append(c)
pts = np.array(pts)

n = len(pts)
mat = np.zeros((n, n))
for i in range(n):
    for j in range(n):
        if i == j:
            continue
        d = np.hypot(*(pts[i] - pts[j]))
        if cid[i] == cid[j]:
            mat[i, j] = d / 1000 / 3.4 * 60          # 도보 3.4km/h (등산로 실측)
        else:
            mat[i, j] = d * 1.4 / 1000 / 30 * 60 + 6  # 차량 30km/h + 환승 6분

grade = ["높음"] * 5 + ["보통"] * 15


def solve(limit_s, strategy, meta):
    mgr = pywrapcp.RoutingIndexManager(n, N_AGENT, list(range(N_AGENT)), list(range(N_AGENT)))
    routing = pywrapcp.RoutingModel(mgr)

    def cb(fi, ti):
        i, j = mgr.IndexToNode(fi), mgr.IndexToNode(ti)
        return int(mat[i, j] + (DWELL if j >= N_AGENT else 0))

    t = routing.RegisterTransitCallback(cb)
    routing.SetArcCostEvaluatorOfAllVehicles(t)
    routing.AddDimension(t, 0, BUDGET, True, "Time")
    for k in range(N_AGENT, n):
        # 보통: 낮은 페널티로 미방문 허용 / 높음: 큰 페널티로 사실상 필수화
        pen = 400 if grade[k - N_AGENT] == "보통" else 100_000
        routing.AddDisjunction([mgr.NodeToIndex(k)], pen)

    p = pywrapcp.DefaultRoutingSearchParameters()
    p.first_solution_strategy = strategy
    p.local_search_metaheuristic = meta
    if limit_s:
        p.time_limit.FromMilliseconds(int(limit_s * 1000))
    t0 = time.perf_counter()
    sol = routing.SolveWithParameters(p)
    el = time.perf_counter() - t0
    if not sol:
        return el, None, None, None
    cost, visited, high = 0, 0, 0
    for v in range(N_AGENT):
        idx = routing.Start(v)
        while not routing.IsEnd(idx):
            nn_ = mgr.IndexToNode(idx)
            if nn_ >= N_AGENT:
                visited += 1
                if grade[nn_ - N_AGENT] == "높음":
                    high += 1
            nxt = sol.Value(routing.NextVar(idx))
            cost += routing.GetArcCostForVehicle(idx, nxt, v)
            idx = nxt
    return el, cost, visited, high


FS = routing_enums_pb2.FirstSolutionStrategy
LS = routing_enums_pb2.LocalSearchMetaheuristic

print(f"{'설정':<34}{'실행(s)':>9}{'총비용(분)':>11}{'방문':>6}{'높음':>6}")
print("-" * 68)
el, c, v, h = solve(None, FS.PATH_CHEAPEST_ARC, LS.UNSET)
print(f"{'초기해만 (탐색개선 없음)':<34}{el:>9.3f}{c:>11}{v:>6}{h:>6}")
for lim in (0.2, 0.5, 1.0, 2.0, 5.0, 10.0):
    el, c, v, h = solve(lim, FS.PATH_CHEAPEST_ARC, LS.GUIDED_LOCAL_SEARCH)
    print(f"{f'GLS 제한 {lim}s':<34}{el:>9.3f}{c:>11}{v:>6}{h:>6}")

# 규모 확장: 위험격자 개수를 늘리면?
print("\n--- 규모 확장 (GLS 2s 고정) ---")
print(f"{'위험격자':>8}{'요원':>6}{'노드':>6}{'실행(s)':>9}{'방문':>6}")
for nr, na in ((20, 5), (50, 5), (100, 10), (200, 15), (500, 20)):
    N_RISK, N_AGENT = nr, na
    grade = ["높음"] * max(1, nr // 4) + ["보통"] * (nr - max(1, nr // 4))
    pts2, cid2 = [], []
    for i in range(nr + na):
        c = i % 16
        cl = rng.uniform([180_000, 1_920_000], [210_000, 1_950_000]) if i < 16 else clusters[c % 6]
        pts2.append(cl + rng.normal(0, 600, 2)); cid2.append(c % 6)
    pts2 = np.array(pts2); n = len(pts2)
    d = np.sqrt(((pts2[:, None] - pts2[None]) ** 2).sum(-1))
    same = np.array(cid2)[:, None] == np.array(cid2)[None]
    mat = np.where(same, d / 1000 / 3.4 * 60, d * 1.4 / 1000 / 30 * 60 + 6)
    np.fill_diagonal(mat, 0)
    el, c_, v, h = solve(2.0, FS.PATH_CHEAPEST_ARC, LS.GUIDED_LOCAL_SEARCH)
    print(f"{nr:>8}{na:>6}{n:>6}{el:>9.3f}{'-' if v is None else v:>6}")
