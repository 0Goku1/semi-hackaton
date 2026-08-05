# -*- coding: utf-8 -*-
"""grid.py 검증: 왕복 정확도, 실제 데이터 적용, 성능"""
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import grid

print("=" * 70)
print("1. 기본 왕복 검증")
gid = grid.encode(954154.5, 1917704.1, res=500)
print(f"  수원 ASOS 좌표 → {gid}")
print(f"  경위도 입력    → {grid.from_lonlat(126.9830, 37.2571, res=500)}")
print(f"  셀 중심 복원   → {grid.decode(gid, 500)}")
print(f"  셀 경계        → {grid.cell_bounds(gid, 500)}")
print(f"  경위도 복원    → {tuple(round(v, 6) for v in grid.to_lonlat(gid, 500))}")
print(f"  DB 키 형식     → {grid.encode(954154.5, 1917704.1, res=500, sep='')}")

print("\n2. 해상도별 자리수/왕복 무결성")
rng = np.random.default_rng(7)
xs = rng.uniform(914_000, 970_000, 20_000)
ys = rng.uniform(1_890_000, 1_922_000, 20_000)
for res in (100, 500, 1000):
    ids = grid.encode(xs, ys, res=res)
    # ID로부터 셀 경계를 복원해 원래 좌표가 그 안에 들어오는지 확인
    ok = 0
    for i in rng.choice(len(ids), 500, replace=False):
        a, b, c, d = grid.cell_bounds(ids[i], res)
        if a <= xs[i] < c and b <= ys[i] < d:
            ok += 1
    print(f"  res={res:>4}m  자리수={grid._digits(res)}  고유ID={len(set(ids)):>6,}  "
          f"포함검증 {ok}/500  샘플={ids[0]}")

print("\n3. 성능 (벡터화)")
for n in (10_000, 100_000, 1_000_000):
    xx = rng.uniform(914_000, 970_000, n)
    yy = rng.uniform(1_890_000, 1_922_000, n)
    t0 = time.perf_counter()
    grid.encode(xx, yy, res=500)
    el = time.perf_counter() - t0
    print(f"  {n:>9,}건 → {el*1000:7.1f} ms")

print("\n4. 잘못된 입력 방어 (경위도를 그대로 넣은 경우)")
try:
    grid.encode(126.98, 37.25, res=500)
except ValueError as e:
    print(f"  정상 차단: {str(e)[:80]}...")

print("\n5. 실제 데이터 적용: 화성 임상도 → 500m 격자")
import geopandas as gpd

DATA = Path(__file__).resolve().parent.parent / "data"
im = gpd.read_file(DATA / "임상도(1대5000)_화성시" / "TB_FGDI_FS_IM5000_41590.shp", encoding="cp949")
t0 = time.perf_counter()
g500 = grid.grid_polygons(*im.total_bounds, res=500)
forest = g500[g500.intersects(im.union_all())]
el = time.perf_counter() - t0
print(f"  격자 폴리곤 {len(g500):,}개 생성 + 산림 교차 필터: {el:.1f}s")
print(f"  산림과 겹치는 500m 셀: {len(forest):,}개")
print(f"  ID 중복: {len(forest) - forest['grid_id'].nunique()}건")
print(f"  샘플 ID: {forest['grid_id'].head(3).tolist()}")

print("\n6. 등산로 라인에 격자 ID 부여 (동선 그래프용)")
tr = gpd.read_file(DATA / "등산로_화성시" / "TB_FGDI_WG_MT_WAY_41590.shp", encoding="cp949")
tr2 = grid.assign_grid(tr, res=500)
print(f"  등산로 {len(tr2)}개 → 대표점 격자 ID 부여 완료")
print(f"  점유 격자 수: {tr2['grid_id'].nunique()}개")
print(f"  샘플: {tr2[['MNTN_NM', 'grid_id']].head(3).to_dict('records')}")
print("\n검증 완료")
