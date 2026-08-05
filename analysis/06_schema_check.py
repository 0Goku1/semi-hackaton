# -*- coding: utf-8 -*-
"""팀원 제안 스키마 검증: 임도/등산로 근접도 유효성, 셀 내 수종 혼합도

[대체됨 — 실행하지 말 것] 이 스크립트는 격자 해상도를 100m로 확정하기 전에
작성됐고, 100m 격자 · 3,000셀 표본 기준으로 계산한다. 프로젝트 해상도가
500m(src/grid.py GRID_RES)로 확정되면서 여기서 나온 수치는 더 이상 유효하지 않다.

  현행 근거 스크립트: analysis/12_grid500_features.py (500m 전수 재계산)
  100m ↔ 500m 비교표: docs/FEATURE_SCHEMA.md '격자 해상도 500m 확정'

100m와 500m의 차이를 보여주는 대조군으로만 남겨둔다.
"""
from pathlib import Path
import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import box

DATA = Path(r"d:\Workspace\semi-hackaton\data")
OUT = open(Path(r"d:\Workspace\semi-hackaton\analysis\06_schema_result.txt"), "w", encoding="utf-8")
def p(*a): print(*a, file=OUT)

im = gpd.read_file(DATA / "임상도(1대5000)_화성시" / "TB_FGDI_FS_IM5000_41590.shp", encoding="cp949")
ij = gpd.read_file(DATA / "산림입지토양도(1대5000)_화성시" / "TB_FGDI_FS_IJ5000_PG_41590.shp", encoding="cp949")

# ---------- 100m 격자 중심점 (임상도 내부) — 구 해상도, 대조군용 ----------
res = 100  # 현행 프로젝트 해상도는 src/grid.py의 GRID_RES(=500)
minx, miny, maxx, maxy = im.total_bounds
xs = np.arange(np.floor(minx / res) * res + res / 2, maxx, res)
ys = np.arange(np.floor(miny / res) * res + res / 2, maxy, res)
cx, cy = np.meshgrid(xs, ys)
pts = gpd.GeoDataFrame(geometry=gpd.points_from_xy(cx.ravel(), cy.ravel()), crs=im.crs)
cells = gpd.sjoin(pts, im[["geometry"]], how="inner", predicate="within").drop(columns="index_right")
cells = cells[~cells.index.duplicated()]
p(f"[격자] 100m, 임상도 내부 셀: {len(cells):,}개")

# ---------- 동선 데이터 (화성 주변으로 클립) ----------
hs_area = box(*im.total_bounds).buffer(3000)
imdo = gpd.read_file(DATA / "임도망도(산길)_전국" / "TB_FGDI_FS_ID300_ALL.shp", encoding="cp949")
imdo_hs = imdo[imdo.geometry.intersects(hs_area)]
trail = gpd.read_file(DATA / "등산로_화성시" / "TB_FGDI_WG_MT_WAY_41590.shp", encoding="cp949")
trail_all = gpd.read_file(DATA / "등산로_전국" / "TB_FGDI_WG_MT_WAY_ALL.shp", encoding="cp949")
trail_hs = trail_all[trail_all.geometry.intersects(hs_area)]

p(f"[임도] 화성 주변 세그먼트 {len(imdo_hs)}개, 총연장 {imdo_hs.geometry.length.sum()/1000:.1f}km")
p(f"[등산로_화성파일] {len(trail)}개, {trail.geometry.length.sum()/1000:.1f}km")
p(f"[등산로_전국클립] {len(trail_hs)}개, {trail_hs.geometry.length.sum()/1000:.1f}km")

# ---------- 근접도 계산 ----------
def nearest_dist(cells, lines, label):
    union = lines.union_all()
    d = cells.geometry.distance(union)
    p(f"\n=== {label} 근접도 (m) ===")
    p(f"  min={d.min():.0f}, p10={d.quantile(.1):.0f}, p25={d.quantile(.25):.0f}, "
      f"median={d.median():.0f}, p75={d.quantile(.75):.0f}, p90={d.quantile(.9):.0f}, max={d.max():.0f}")
    p(f"  평균={d.mean():.0f}, 표준편차={d.std():.0f}, 변동계수={d.std()/d.mean():.2f}")
    for th in (100, 250, 500, 1000, 2000, 5000):
        p(f"  {th}m 이내 셀 비율: {(d <= th).mean():.1%}")
    return d

d_imdo = nearest_dist(cells, imdo_hs, "임도")
d_trail = nearest_dist(cells, trail_hs, "등산로")

# 두 피처의 상관 및 결합
p(f"\n임도-등산로 근접도 상관계수(Pearson): {np.corrcoef(d_imdo, d_trail)[0,1]:.3f}")
d_any = np.minimum(d_imdo, d_trail)
p(f"임도∪등산로 통합 근접도: median={np.median(d_any):.0f}m, "
  f"500m 이내 {(d_any<=500).mean():.1%}, 1km 이내 {(d_any<=1000).mean():.1%}")

# ---------- 셀 내 수종 혼합도 ----------
p("\n" + "=" * 70)
p("셀 내 수종 혼합도 검증 (100m 셀에 수종 하나로 지정 가능한가) — 구 해상도 대조군")
grid_cells = gpd.GeoDataFrame(
    geometry=[box(x - res/2, y - res/2, x + res/2, y + res/2) for x, y in zip(cells.geometry.x, cells.geometry.y)],
    crs=im.crs,
).reset_index(drop=True)
grid_cells["cell_id"] = grid_cells.index

sample = grid_cells.sample(n=3000, random_state=42)
ov = gpd.overlay(sample, im[["KOFTR_GROU", "FRTP_CD", "geometry"]], how="intersection")
ov["a"] = ov.geometry.area
g = ov.groupby("cell_id")
n_species = g["KOFTR_GROU"].nunique()
p(f"표본 셀 {len(sample):,}개 기준")
p(f"  셀 내 수종 개수 분포:\n{n_species.value_counts().sort_index().to_string()}")
p(f"  수종 2종 이상 섞인 셀 비율: {(n_species >= 2).mean():.1%}")

# 최빈 수종 점유율
def top_share(df):
    s = df.groupby("KOFTR_GROU")["a"].sum()
    return s.max() / s.sum()
share = ov.groupby("cell_id").apply(top_share, include_groups=False)
p(f"  최빈 수종의 셀 내 면적 점유율: median={share.median():.1%}, p25={share.quantile(.25):.1%}, "
  f"70% 미만인 셀 비율={(share<0.7).mean():.1%}")

n_frtp = g["FRTP_CD"].nunique()
p(f"  임상구분(침/활/혼) 2종 이상 섞인 셀 비율: {(n_frtp >= 2).mean():.1%}")

OUT.close()
print("done")
