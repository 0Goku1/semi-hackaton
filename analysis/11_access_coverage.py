"""
접근 경로 커버율 재검증.

09_network.py의 '2,290개 중 172개(7.5%)'는 두 가지 이유로 실제보다 비관적일 수 있다.
  (a) 격자 판정을 임상도 폴리곤 '중심점'으로 했다 → 산림이 조금만 걸친 격자도 산림격자로 셈
  (b) 접근 가능 판정을 '격자를 관통'으로 했다 → 격자 밖 200m 지점의 등산로는 미커버로 셈

그래서 다시 계산한다.
  1) 500m 격자별 실제 산림 면적(면적가중 overlay)
  2) 격자별 최근접 등산로/임도 거리
  3) 산림면적 구간 × 접근거리 구간 교차표
  → "순찰 대상이 될 만한 격자"의 접근성이 실제로 어느 수준인지
"""

import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from pathlib import Path
import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import box

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import grid as G

DATA = Path(r"d:\Workspace\semi-hackaton\data")
TRAIL = DATA / "등산로_화성시" / "TB_FGDI_WG_MT_WAY_41590.shp"
ROAD_ALL = DATA / "임도망도(산길)_전국" / "TB_FGDI_FS_ID300_ALL.shp"
FOREST = DATA / "임상도(1대5000)_화성시" / "TB_FGDI_FS_IM5000_41590.shp"

RES = G.GRID_RES  # 프로젝트 전역 해상도 (500m)
CELL_AREA = RES * RES  # 250,000 m² = 25 ha

pd.set_option("display.width", 200)


def hdr(t):
    print("\n" + "=" * 92)
    print(f"### {t}")
    print("=" * 92)


hdr("0. 로드")
fo = gpd.read_file(FOREST, encoding="cp949")[["geometry"]]
fo = fo[fo.geometry.notna() & ~fo.geometry.is_empty].copy()
print(f"임상도 폴리곤 {len(fo)}건, 총면적 {fo.area.sum()/1e6:.1f} km²")

tr = gpd.read_file(TRAIL, encoding="cp949")[["geometry"]]
print(f"등산로 {len(tr)}구간, 총연장 {tr.length.sum()/1000:.1f} km")

rd = gpd.read_file(ROAD_ALL, encoding="cp949")[["geometry"]]
if rd.crs != fo.crs:
    rd = rd.to_crs(fo.crs)
minx, miny, maxx, maxy = fo.total_bounds
pad = 3000
rd = rd[rd.intersects(box(minx - pad, miny - pad, maxx + pad, maxy + pad))].copy()
print(f"임도(화성 주변) {len(rd)}건, 총연장 {rd.length.sum()/1000:.1f} km")


hdr("1. 500m 격자별 실제 산림 면적")
cells = G.grid_polygons(minx, miny, maxx, maxy, res=RES)
print(f"extent 전체 격자 {len(cells)}개")

inter = gpd.overlay(cells, fo, how="intersection", keep_geom_type=True)
inter["a"] = inter.area
agg = inter.groupby("grid_id", as_index=False)["a"].sum()
agg["forest_ratio"] = agg["a"] / CELL_AREA

cells = cells.merge(agg, on="grid_id", how="left")
cells["a"] = cells["a"].fillna(0.0)
cells["forest_ratio"] = cells["forest_ratio"].fillna(0.0)

fc = cells[cells["a"] > 0].copy()
print(f"산림이 조금이라도 걸친 격자: {len(fc)}개")
print(f"  → 이 격자들의 산림면적 합 {fc['a'].sum()/1e6:.1f} km² "
      f"(격자 총면적 {len(fc)*CELL_AREA/1e6:.1f} km²의 {fc['a'].sum()/(len(fc)*CELL_AREA):.1%})")

print("\n--- 격자당 산림 점유율 분포 ---")
bins = [0, 0.05, 0.10, 0.25, 0.50, 0.75, 1.01]
labels = ["0~5%", "5~10%", "10~25%", "25~50%", "50~75%", "75~100%"]
fc["ratio_bin"] = pd.cut(fc["forest_ratio"], bins=bins, labels=labels, right=False)
t = fc.groupby("ratio_bin", observed=True).agg(
    격자수=("grid_id", "size"), 산림면적_km2=("a", lambda s: s.sum() / 1e6)
)
t["격자_비중"] = (t["격자수"] / len(fc) * 100).round(1)
t["면적_비중"] = (t["산림면적_km2"] / (fc["a"].sum() / 1e6) * 100).round(1)
print(t.to_string())
print("\n→ 점유율 낮은 격자가 개수는 많지만 산림면적 기여는 작다면,")
print("  '격자 개수 기준 커버율'은 실제 순찰 필요량을 과대표현한 것")


hdr("2. 격자별 최근접 등산로 / 임도 거리")
tr_u = tr.geometry.union_all()
rd_u = rd.geometry.union_all()
net_u = tr.geometry.union_all().union(rd_u)

fc["d_trail"] = fc.geometry.distance(tr_u)
fc["d_road"] = fc.geometry.distance(rd_u)
fc["d_net"] = fc.geometry.distance(net_u)

print("격자 경계에서 최근접 등산로까지 거리(m) — 0이면 격자를 관통")
print(fc["d_trail"].describe(percentiles=[.1, .25, .5, .75, .9]).round(0).to_string())
print("\n최근접 임도까지 거리(m)")
print(fc["d_road"].describe(percentiles=[.1, .25, .5, .75, .9]).round(0).to_string())

print("\n--- 접근거리 임계값별 커버 격자 수 (등산로 ∪ 임도) ---")
print(f"{'임계값':>10}{'격자수':>9}{'전체대비':>9}{'포함 산림면적':>15}{'면적대비':>9}")
tot_n, tot_a = len(fc), fc["a"].sum()
for thr in (0, 100, 250, 500, 1000, 2000):
    m = fc["d_net"] <= thr
    lab = "관통(0m)" if thr == 0 else f"{thr}m 이내"
    print(f"{lab:>10}{m.sum():>9}{m.sum()/tot_n:>8.1%}"
          f"{fc.loc[m,'a'].sum()/1e6:>13.1f} km²{fc.loc[m,'a'].sum()/tot_a:>9.1%}")


hdr("3. 산림 점유율 × 접근거리 교차표")
fc["acc_bin"] = pd.cut(
    fc["d_net"], [0, 1, 250, 500, 1000, 1e9],
    labels=["관통", "≤250m", "≤500m", "≤1km", ">1km"], right=False,
)
ct = pd.crosstab(fc["ratio_bin"], fc["acc_bin"], dropna=False)
print("격자 수")
print(ct.to_string())
print("\n행 기준 비율(%) — 산림이 많은 격자일수록 접근성이 좋은지 확인")
print((ct.div(ct.sum(axis=1), axis=0) * 100).round(1).to_string())


hdr("4. '순찰 대상이 될 만한 격자'만 놓고 본 커버율")
for thr_ratio, name in ((0.25, "산림 25% 이상"), (0.50, "산림 50% 이상"), (0.75, "산림 75% 이상")):
    s = fc[fc["forest_ratio"] >= thr_ratio]
    if len(s) == 0:
        continue
    print(f"\n{name} 격자 {len(s)}개 (산림면적 {s['a'].sum()/1e6:.1f} km², "
          f"전체 산림의 {s['a'].sum()/tot_a:.1%})")
    for thr in (0, 250, 500, 1000):
        m = s["d_net"] <= thr
        lab = "관통" if thr == 0 else f"≤{thr}m"
        print(f"    {lab:>7}: {m.sum():>4}개 ({m.sum()/len(s):>5.1%})")
    print(f"    최근접 접근점까지 거리 중위 {s['d_net'].median():.0f}m, "
          f"90분위 {s['d_net'].quantile(0.9):.0f}m")


hdr("5. 상위 산림 격자 20개의 접근 상태")
top = fc.nlargest(20, "a")[["grid_id", "forest_ratio", "d_trail", "d_road", "d_net"]].copy()
top["forest_ratio"] = (top["forest_ratio"] * 100).round(1)
for c in ("d_trail", "d_road", "d_net"):
    top[c] = top[c].round(0).astype(int)
top.columns = ["격자ID", "산림%", "등산로거리m", "임도거리m", "최근접m"]
print(top.to_string(index=False))
