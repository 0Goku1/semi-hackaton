# -*- coding: utf-8 -*-
"""기상 결합 설계 검증: 사면방위(EIGHT_AGL) 실체, WGS84 범위, 격자 설계, 코드 분포 교차"""
import sys
from pathlib import Path
import geopandas as gpd
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from grid import GRID_RES

DATA = Path(r"d:\Workspace\semi-hackaton\data")
OUT = open(Path(r"d:\Workspace\semi-hackaton\analysis\05_fusion_result.txt"), "w", encoding="utf-8")
def p(*a): print(*a, file=OUT)

ij = gpd.read_file(DATA / "산림입지토양도(1대5000)_화성시" / "TB_FGDI_FS_IJ5000_PG_41590.shp", encoding="cp949")
im = gpd.read_file(DATA / "임상도(1대5000)_화성시" / "TB_FGDI_FS_IM5000_41590.shp", encoding="cp949")

p("=" * 80)
p("1. EIGHT_AGL 실체 검증 (사면방위각 가설)")
e = ij["EIGHT_AGL"]
p(e.describe().to_string())
p(f"0~360 범위 내 비율: {((e >= 0) & (e <= 360)).mean():.2%}")
p(f"360 초과 개수: {(e > 360).sum()}")
p(f"히스토그램(45도 구간):")
bins = pd.cut(e, bins=[0,45,90,135,180,225,270,315,360], include_lowest=True)
p(bins.value_counts().sort_index().to_string())

p("\n" + "=" * 80)
p("2. 고도/경사 상세 (지형 위험 피처)")
p(f"고도 LOCTN_ALTT: {ij['LOCTN_ALTT'].describe().to_string()}")
p(f"경사 LOCTN_GRDN 구간 분포:")
p(pd.cut(ij["LOCTN_GRDN"], bins=[0,5,10,15,20,25,30,60]).value_counts().sort_index().to_string())

p("\n" + "=" * 80)
p("3. WGS84 좌표 범위 (기상관측소 매칭용)")
for name, g in [("임상도", im), ("입지토양도", ij)]:
    w = g.to_crs(4326)
    b = w.total_bounds
    p(f"{name}: lon {b[0]:.4f}~{b[2]:.4f}, lat {b[1]:.4f}~{b[3]:.4f}")
cen = im.to_crs(4326).union_all().centroid
p(f"화성 산림 중심: lat {cen.y:.4f}, lon {cen.x:.4f}")
# 수원 ASOS(119) 거리
sw_lat, sw_lon = 37.2571, 126.9830
d = np.hypot((cen.y - sw_lat) * 111, (cen.x - sw_lon) * 88.8)
p(f"수원 ASOS(119)까지 중심 직선거리 ≈ {d:.1f} km")

p("\n" + "=" * 80)
p("4. 침엽수 비율 (연소 위험 핵심 피처) — FRTP_CD 면적 가중")
im["area"] = im.geometry.area
tot = im["area"].sum()
frtp = im.groupby("FRTP_CD")["area"].sum() / tot
p("FRTP_CD 면적비율 (1=침엽수,2=활엽수,3=혼효림 추정):")
p((frtp * 100).round(2).to_string())
p("\nDNST_CD(밀도) 면적비율:")
p((im.groupby("DNST_CD")["area"].sum() / tot * 100).round(2).to_string())
p("\nAGCLS_CD(영급) 면적비율:")
p((im.groupby("AGCLS_CD")["area"].sum() / tot * 100).round(2).to_string())

p("\n" + "=" * 80)
p(f"5. 격자 생성 실험 (실제 셀 수) — 해상도 {GRID_RES}m")
p("   중심점 포함 방식이라 보수적이다. 학습 대상 셀 정의는 면적 교차 기반인")
p("   analysis/12_grid500_features.py 를 따른다.")
minx, miny, maxx, maxy = im.total_bounds
res = GRID_RES
xs = np.arange(np.floor(minx/res)*res, maxx + res, res)
ys = np.arange(np.floor(miny/res)*res, maxy + res, res)
p(f"bbox 격자: {len(xs)-1} x {len(ys)-1} = {(len(xs)-1)*(len(ys)-1):,} 셀")
# 중심점 방식으로 산림 내부 셀만 추정
cx, cy = np.meshgrid(xs[:-1] + res/2, ys[:-1] + res/2)
pts = gpd.GeoDataFrame(geometry=gpd.points_from_xy(cx.ravel(), cy.ravel()), crs=im.crs)
joined = gpd.sjoin(pts, im[["geometry"]], how="inner", predicate="within")
p(f"임상도 폴리곤 내부에 들어오는 {res}m 셀 중심점: {len(joined):,}개")
joined2 = gpd.sjoin(pts, ij[["geometry"]], how="inner", predicate="within")
p(f"입지토양도 폴리곤 내부 {res}m 셀: {len(joined2):,}개")
p(f"→ 두 레이어 모두 값이 있는 셀(교집합 근사): {len(set(joined.index) & set(joined2.index)):,}개")

OUT.close()
print("done")
