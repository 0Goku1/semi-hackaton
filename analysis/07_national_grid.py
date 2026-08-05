# -*- coding: utf-8 -*-
"""국가지점번호 격자를 화성 산림에 실제 적용 (도로명주소법 시행령 제37조)

기준점: UTM-K(EPSG:5179) 원점에서 서쪽 300km, 남쪽 700km → (700000, 1300000)
100km 블록마다 한글 문자 2자, 그 안을 GRID_RES 단위로 분할.

해상도는 src/grid.py의 GRID_RES(=500m) 하나만 참조한다. 인코딩 구현도
src/grid.py를 그대로 쓴다 (초기에는 이 스크립트가 별도 구현을 갖고 있었으나
모듈로 옮긴 뒤 중복을 제거했다).
"""
import sys
from pathlib import Path
import geopandas as gpd
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from grid import GRID_RES, ORIGIN_X, ORIGIN_Y, encode, decode

DATA = Path(r"d:\Workspace\semi-hackaton\data")
OUT = open(Path(r"d:\Workspace\semi-hackaton\analysis\07_national_grid_result.txt"), "w", encoding="utf-8")
def p(*a): print(*a, file=OUT)

RES = GRID_RES
p(f"격자 해상도: {RES}m (src/grid.py GRID_RES)")

im = gpd.read_file(DATA / "임상도(1대5000)_화성시" / "TB_FGDI_FS_IM5000_41590.shp", encoding="cp949")
ij = gpd.read_file(DATA / "산림입지토양도(1대5000)_화성시" / "TB_FGDI_FS_IJ5000_PG_41590.shp", encoding="cp949")
p(f"임상도 CRS: {im.crs}  bounds: {im.total_bounds}")

# 국가지점번호 기준점에 스냅한 격자 중심점 생성
minx, miny, maxx, maxy = im.total_bounds
x0 = ORIGIN_X + np.floor((minx - ORIGIN_X) / RES) * RES
y0 = ORIGIN_Y + np.floor((miny - ORIGIN_Y) / RES) * RES
xs = np.arange(x0 + RES / 2, maxx + RES, RES)
ys = np.arange(y0 + RES / 2, maxy + RES, RES)
cx, cy = np.meshgrid(xs, ys)
pts = gpd.GeoDataFrame(geometry=gpd.points_from_xy(cx.ravel(), cy.ravel()), crs=im.crs)
p(f"\nbbox 격자: {len(xs)} x {len(ys)} = {len(pts):,}셀 (국가지점번호 기준점 스냅)")

# 중심점 포함 방식. 셀이 커지면 이 방식은 보수적이 되므로
# 실제 학습 대상 셀 정의는 면적 교차 기반인 12_grid500_features.py를 따른다.
forest = gpd.sjoin(pts, im[["geometry"]], how="inner", predicate="within").drop(columns="index_right")
forest = forest[~forest.index.duplicated()]
soil = gpd.sjoin(pts, ij[["geometry"]], how="inner", predicate="within").drop(columns="index_right")
soil = soil[~soil.index.duplicated()]
both = forest.index.intersection(soil.index)
p(f"임상도 내부: {len(forest):,}셀 / 입지토양도 내부: {len(soil):,}셀 / 양쪽 유효: {len(both):,}셀")
p("  (중심점 포함 기준. 면적 교차 기준 학습 대상 셀 수는 12_grid500_features.py 참조)")

cells = forest.loc[both].copy()
cells["grid_id"] = [encode(g.x, g.y, res=RES) for g in cells.geometry]
p(f"\n생성된 격자 ID 예시 20개:")
for gid in cells["grid_id"].head(20):
    p(f"  {gid}")

p(f"\nID 중복 검사: 고유 ID {cells['grid_id'].nunique():,} / 전체 {len(cells):,} → "
  f"{'중복 없음 (1:1 대응 확인)' if cells['grid_id'].nunique() == len(cells) else '중복 발생!'}")

prefix = cells["grid_id"].str[:2]
p(f"\n100km 블록 접두 분포 (화성이 걸친 블록):")
p(prefix.value_counts().to_string())

# 격자 ID → 좌표 역변환 검증
sample = cells.iloc[0]
rx, ry = decode(sample["grid_id"], res=RES)
p(f"\n역변환 검증: {sample['grid_id']} → ({rx:.1f}, {ry:.1f}) / 원본 ({sample.geometry.x:.1f}, {sample.geometry.y:.1f})")
p(f"  오차: {abs(rx - sample.geometry.x):.3f}m, {abs(ry - sample.geometry.y):.3f}m")

# WGS84 변환 확인 (지도 표출용)
w = cells.head(3).to_crs(4326)
p(f"\nWGS84 변환 샘플 (지도 표출용):")
for gid, g in zip(cells["grid_id"].head(3), w.geometry):
    p(f"  {gid} → lat {g.y:.6f}, lon {g.x:.6f}")

OUT.close()
print("done")
