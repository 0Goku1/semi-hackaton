# -*- coding: utf-8 -*-
"""1) 각 데이터의 좌표 표현 형태 비교  2) 500m 격자 전환 비용/정보손실  3) 변환 성능 벤치마크

해상도를 500m로 확정할 때 근거가 된 스크립트다. 100m/500m/1000m를 나란히
비교하는 것이 목적이므로 해상도가 여러 개 하드코딩돼 있는 것이 정상이다.
확정 이후의 500m 실측 수치는 analysis/12_grid500_features.py(전수 계산)를 따른다.
여기 수종 혼합도는 400셀 표본이라 12번 결과와 소수점 단위 차이가 있다.
"""
from pathlib import Path
import time
import geopandas as gpd
import numpy as np
import pandas as pd
from pyproj import Transformer
from shapely.geometry import box

DATA = Path(r"d:\Workspace\semi-hackaton\data")
OUT = open(Path(r"d:\Workspace\semi-hackaton\analysis\08_grid500_result.txt"), "w", encoding="utf-8")
def p(*a): print(*a, file=OUT)

im = gpd.read_file(DATA / "임상도(1대5000)_화성시" / "TB_FGDI_FS_IM5000_41590.shp", encoding="cp949")
ij = gpd.read_file(DATA / "산림입지토양도(1대5000)_화성시" / "TB_FGDI_FS_IJ5000_PG_41590.shp", encoding="cp949")
tr = gpd.read_file(DATA / "등산로_화성시" / "TB_FGDI_WG_MT_WAY_41590.shp", encoding="cp949")

# ===== 1. 좌표 표현 형태 비교 =====
p("=" * 78)
p("1. 각 데이터의 좌표 표현 형태")
p(f"\n[등산로_화성시] CRS={tr.crs.to_string()}")
p(f"  좌표 관련 속성 컬럼: {[c for c in tr.columns if any(k in c.upper() for k in ('XCRD','YCRD','LAT','LON','CRD'))] or '없음 (geometry만)'}")
p(f"  첫 선형 좌표 3점: {list(tr.geometry.iloc[0].coords)[:3]}")

p(f"\n[임상도] CRS={im.crs.to_string()} / 좌표 속성 컬럼: "
  f"{[c for c in im.columns if any(k in c.upper() for k in ('XCRD','YCRD','LAT','LON'))] or '없음 (geometry만)'}")

p(f"\n[입지토양도] CRS={ij.crs.to_string()}")
p(f"  좌표 속성 컬럼 존재: ARA_XCRD, ARA_YCRD")
p(f"  샘플: {ij['ARA_XCRD'].iloc[0]}, {ij['ARA_YCRD'].iloc[0]}")

# ARA_XCRD/YCRD 가 어느 좌표계인지 역추적
cen = ij.geometry.centroid
ara_x = pd.to_numeric(ij["ARA_XCRD"], errors="coerce")
ara_y = pd.to_numeric(ij["ARA_YCRD"], errors="coerce")
p("\n  → ARA_XCRD/YCRD 좌표계 역추적 (geometry 중심점을 후보 CRS로 변환해 비교)")
for epsg, name in [(5186, "중부원점TM(EPSG:5186)"), (5185, "서부원점(5185)"),
                   (5187, "동부원점(5187)"), (5174, "중부원점 구성과(5174)")]:
    t = Transformer.from_crs(5179, epsg, always_xy=True)
    gx, gy = t.transform(cen.x.values, cen.y.values)
    dx = np.abs(gx - ara_x.values)
    dy = np.abs(gy - ara_y.values)
    p(f"     {name:28s} 중앙오차 x={np.nanmedian(dx):10.1f}m  y={np.nanmedian(dy):10.1f}m")

# ===== 2. 500m 격자 전환 =====
p("\n" + "=" * 78)
p("2. 500m 격자 전환: 셀 수와 정보 손실")
ORIGIN_X, ORIGIN_Y = 700_000, 1_300_000

def make_cells(res):
    minx, miny, maxx, maxy = im.total_bounds
    x0 = ORIGIN_X + np.floor((minx - ORIGIN_X) / res) * res
    y0 = ORIGIN_Y + np.floor((miny - ORIGIN_Y) / res) * res
    xs = np.arange(x0 + res / 2, maxx + res, res)
    ys = np.arange(y0 + res / 2, maxy + res, res)
    cx, cy = np.meshgrid(xs, ys)
    pts = gpd.GeoDataFrame(geometry=gpd.points_from_xy(cx.ravel(), cy.ravel()), crs=im.crs)
    inside = gpd.sjoin(pts, im[["geometry"]], how="inner", predicate="within")
    inside = inside[~inside.index.duplicated()]
    return len(pts), len(inside)

for res in (100, 500, 1000):
    total, inside = make_cells(res)
    p(f"  {res:4d}m 격자 → bbox {total:>9,}셀 / 산림내부 {inside:>7,}셀")

# 500m 셀 내 혼합도 (100m와 비교) — 400셀 표본. 전수 결과는 12번 스크립트 참조
p("\n  500m 셀 내 수종 혼합도 (100m 결과: 2종이상 86.8%, 최빈점유 중앙 70.4%)")
res = 500
minx, miny, maxx, maxy = im.total_bounds
x0 = ORIGIN_X + np.floor((minx - ORIGIN_X) / res) * res
y0 = ORIGIN_Y + np.floor((miny - ORIGIN_Y) / res) * res
xs = np.arange(x0, maxx + res, res)
ys = np.arange(y0, maxy + res, res)
polys, ids = [], []
for xi in xs[:-1]:
    for yi in ys[:-1]:
        polys.append(box(xi, yi, xi + res, yi + res))
g500 = gpd.GeoDataFrame({"cell_id": range(len(polys))}, geometry=polys, crs=im.crs)
g500 = g500[g500.geometry.intersects(im.union_all())]
p(f"  산림과 교차하는 500m 셀: {len(g500):,}개")

sample = g500.sample(n=min(400, len(g500)), random_state=1)
ov = gpd.overlay(sample, im[["KOFTR_GROU", "FRTP_CD", "geometry"]], how="intersection")
ov["a"] = ov.geometry.area
grp = ov.groupby("cell_id")
nsp = grp["KOFTR_GROU"].nunique()
p(f"  셀 내 수종 개수: 중앙값 {nsp.median():.0f}종, 평균 {nsp.mean():.1f}종, 최대 {nsp.max()}종")
p(f"  2종 이상 섞인 셀 비율: {(nsp >= 2).mean():.1%}")
share = ov.groupby("cell_id").apply(lambda d: d.groupby("KOFTR_GROU")["a"].sum().max() / d["a"].sum(),
                                    include_groups=False)
p(f"  최빈 수종 면적 점유율: 중앙값 {share.median():.1%}, 하위25% {share.quantile(.25):.1%}")
p(f"  최빈 수종이 50% 미만인 셀 비율: {(share < 0.5).mean():.1%}")

# 경사도 분산 손실
ijc = ij.copy()
ijc["cx"] = ijc.geometry.centroid.x
ijc["cy"] = ijc.geometry.centroid.y
for res in (100, 500):
    kx = ((ijc["cx"] - ORIGIN_X) // res).astype(int)
    ky = ((ijc["cy"] - ORIGIN_Y) // res).astype(int)
    agg = ijc.groupby([kx, ky])["LOCTN_GRDN"].mean()
    p(f"\n  경사도 격자평균의 표준편차 @{res}m: {agg.std():.3f}° (셀 {len(agg):,}개)")

# ===== 3. 변환 성능 벤치마크 =====
p("\n" + "=" * 78)
p("3. 좌표 → 격자ID 변환 성능 (벡터화 numpy)")
HANGUL = np.array(["가", "나", "다", "라", "마", "바", "사", "아", "자", "차"])

def to_grid_id_vec(x, y, res=500):
    dx, dy = x - ORIGIN_X, y - ORIGIN_Y
    bx = (dx // 100_000).astype(int)
    by = (dy // 100_000).astype(int)
    per = int(100_000 // res)
    ix = ((dx % 100_000) // res).astype(int)
    iy = ((dy % 100_000) // res).astype(int)
    w = len(str(per - 1))
    return np.char.add(
        np.char.add(np.char.add(HANGUL[bx], HANGUL[by]), " "),
        np.char.add(np.char.add(np.char.zfill(ix.astype(str), w), " "),
                    np.char.zfill(iy.astype(str), w)))

rng = np.random.default_rng(0)
for n in (10_000, 100_000, 1_000_000):
    xx = rng.uniform(914_000, 970_000, n)
    yy = rng.uniform(1_890_000, 1_922_000, n)
    t0 = time.perf_counter()
    out = to_grid_id_vec(xx, yy, 500)
    el = time.perf_counter() - t0
    p(f"  {n:>9,}개 좌표 → {el*1000:8.1f} ms  (초당 {n/el/1e6:.1f}M건)  샘플: {out[0]}")

# 경위도 입력(기상 관측소) → 격자ID
p("\n  경위도(WGS84) 입력 케이스: 수원 ASOS(119) lat 37.2571 lon 126.9830")
t = Transformer.from_crs(4326, 5179, always_xy=True)
sx, sy = t.transform(126.9830, 37.2571)
p(f"    EPSG:5179 변환 → ({sx:.1f}, {sy:.1f})")
p(f"    500m 격자ID → {to_grid_id_vec(np.array([sx]), np.array([sy]), 500)[0]}")

# 등산로 라인 → 통과 격자 목록
p("\n  등산로 라인 → 통과 500m 격자 (동선 그래프용)")
t0 = time.perf_counter()
joined = gpd.sjoin(g500, tr[["PMNTN_SN", "geometry"]], how="inner", predicate="intersects")
el = time.perf_counter() - t0
p(f"    등산로 201개 × 500m격자 {len(g500)}개 공간조인: {el*1000:.0f} ms")
p(f"    등산로가 지나는 격자 수: {joined['cell_id'].nunique():,}개 (전체 {len(g500):,}개 중)")

OUT.close()
print("done")
