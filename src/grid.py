# -*- coding: utf-8 -*-
"""국가지점번호 체계 기반 격자 ID 변환

근거: 도로명주소법 시행령 제37조
  - 좌표계: UTM-K (EPSG:5179)
  - 기준점: UTM-K 원점에서 서쪽 300km, 남쪽 700km → (700000, 1300000)
  - 100km 블록마다 한글 문자 2자(동쪽/북쪽), 그 안을 res 단위로 분할

기준점이 500의 배수이므로 500m 격자도 경계가 정확히 맞는다.
법정 체계에 500m 단위는 없지만(10m/100m/1km/10km/100km), 정렬은 동일하다.

프로젝트 격자 해상도는 GRID_RES(=500m)로 통일한다. 위험도 예측 격자와
순찰 배정 격자가 같은 ID를 써야 "위험 격자를 순찰 대상으로 그대로 넘긴다"는
파이프라인이 성립하기 때문이다. 해상도를 바꿀 일이 생기면 이 상수만 고친다.
근거와 트레이드오프는 docs/FEATURE_SCHEMA.md의 '격자 해상도 500m 확정' 참조.

사용 예:
    >>> encode(954154.5, 1917704.1, res=500)
    '다사 108 035'
    >>> from_lonlat(126.9830, 37.2571, res=500)
    '다사 108 035'
    >>> decode('다사 108 035', res=500)          # 셀 중심 좌표
    (954250.0, 1917750.0)
    >>> cell_bounds('다사 108 035', res=500)     # 셀 경계
    (954000.0, 1917500.0, 954500.0, 1918000.0)
"""
from __future__ import annotations

import numpy as np

#: 프로젝트 전역 격자 해상도(m). 모든 스크립트는 이 값을 import 해서 쓴다.
GRID_RES = 500

ORIGIN_X = 700_000
ORIGIN_Y = 1_300_000
BLOCK = 100_000
HANGUL = np.array(list("가나다라마바사아자차카타파하"))
_HANGUL_IDX = {c: i for i, c in enumerate("가나다라마바사아자차카타파하")}

# 남한 대략 범위 (EPSG:5179) — 입력 오류 조기 검출용
VALID_X = (700_000, 1_400_000)
VALID_Y = (1_400_000, 2_100_000)


def _digits(res: int) -> int:
    """블록 안 인덱스를 표기할 자리수 (res=500 → 200칸 → 3자리)"""
    if BLOCK % res != 0:
        raise ValueError(f"res={res}는 100km를 정수 분할하지 못합니다")
    return len(str(BLOCK // res - 1))


def encode(x, y, res: int = GRID_RES, sep: str = " "):
    """EPSG:5179 좌표 → 격자 ID. 스칼라와 배열 모두 지원.

    sep=" "  → '다사 108 035' (표시용)
    sep=""   → '다사108035'   (DB 키용)
    """
    x = np.asarray(x, dtype="float64")
    y = np.asarray(y, dtype="float64")
    scalar = x.ndim == 0
    x, y = np.atleast_1d(x), np.atleast_1d(y)

    bad = (
        (x < VALID_X[0]) | (x > VALID_X[1]) | (y < VALID_Y[0]) | (y > VALID_Y[1])
        | ~np.isfinite(x) | ~np.isfinite(y)
    )
    if bad.any():
        raise ValueError(
            f"EPSG:5179 범위를 벗어난 좌표 {int(bad.sum())}건. "
            f"경위도를 넣었거나 좌표계가 다를 수 있습니다. 첫 값: ({x[bad][0]}, {y[bad][0]})"
        )

    dx, dy = x - ORIGIN_X, y - ORIGIN_Y
    bx = (dx // BLOCK).astype("int64")
    by = (dy // BLOCK).astype("int64")
    w = _digits(res)
    ix = ((dx % BLOCK) // res).astype("int64")
    iy = ((dy % BLOCK) // res).astype("int64")

    block = np.char.add(HANGUL[bx], HANGUL[by])
    sx = np.char.zfill(ix.astype(str), w)
    sy = np.char.zfill(iy.astype(str), w)
    out = np.char.add(np.char.add(np.char.add(block, sep), sx), np.char.add(sep, sy))
    return out[0] if scalar else out


def decode(grid_id: str, res: int = GRID_RES) -> tuple[float, float]:
    """격자 ID → 셀 중심 좌표 (EPSG:5179)"""
    minx, miny, maxx, maxy = cell_bounds(grid_id, res)
    return (minx + maxx) / 2, (miny + maxy) / 2


def cell_bounds(grid_id: str, res: int = GRID_RES) -> tuple[float, float, float, float]:
    """격자 ID → 셀 경계 (minx, miny, maxx, maxy)"""
    s = grid_id.replace(" ", "")
    w = _digits(res)
    if len(s) != 2 + 2 * w:
        raise ValueError(f"ID 형식 오류: {grid_id!r} (res={res}면 한글2자 + 숫자{w}자리 x2)")
    bx, by = _HANGUL_IDX[s[0]], _HANGUL_IDX[s[1]]
    ix, iy = int(s[2 : 2 + w]), int(s[2 + w :])
    minx = ORIGIN_X + bx * BLOCK + ix * res
    miny = ORIGIN_Y + by * BLOCK + iy * res
    return minx, miny, minx + res, miny + res


# ---------- 경위도 입출력 (기상 관측소, 산불 이력 등) ----------

def _tf(src: int, dst: int):
    from pyproj import Transformer

    return Transformer.from_crs(src, dst, always_xy=True)


def from_lonlat(lon, lat, res: int = GRID_RES, sep: str = " "):
    """WGS84 경위도 → 격자 ID. 기상청 지점정보, 산불 이력 좌표에 사용."""
    x, y = _tf(4326, 5179).transform(np.asarray(lon), np.asarray(lat))
    return encode(x, y, res, sep)


def to_lonlat(grid_id: str, res: int = GRID_RES) -> tuple[float, float]:
    """격자 ID → 셀 중심 경위도 (지도 표출용)"""
    x, y = decode(grid_id, res)
    return _tf(5179, 4326).transform(x, y)


# ---------- GeoDataFrame 헬퍼 ----------

def assign_grid(gdf, res: int = GRID_RES, col: str = "grid_id", sep: str = " "):
    """점 GeoDataFrame에 격자 ID 컬럼 추가. CRS가 5179가 아니면 자동 변환.

    폴리곤/라인이면 대표점(중심)을 기준으로 부여하므로,
    면적가중 집계가 필요한 임상도·토양도에는 이 함수를 쓰지 말고
    격자 폴리곤과 overlay 하십시오.
    """
    g = gdf.to_crs(5179) if gdf.crs and gdf.crs.to_epsg() != 5179 else gdf.copy()
    pts = g.geometry if g.geom_type.iloc[0] == "Point" else g.geometry.representative_point()
    out = gdf.copy()
    out[col] = [str(v) for v in np.atleast_1d(encode(pts.x.values, pts.y.values, res, sep))]
    return out


def grid_polygons(minx, miny, maxx, maxy, res: int = GRID_RES, sep: str = " "):
    """주어진 범위를 덮는 격자 폴리곤 GeoDataFrame 생성 (기준점 스냅).

    임상도·입지토양도를 면적가중 집계할 때 이 폴리곤과 overlay 한다.
    """
    import geopandas as gpd
    from shapely.geometry import box

    x0 = ORIGIN_X + np.floor((minx - ORIGIN_X) / res) * res
    y0 = ORIGIN_Y + np.floor((miny - ORIGIN_Y) / res) * res
    xs = np.arange(x0, maxx + res, res)
    ys = np.arange(y0, maxy + res, res)
    cells, ids = [], []
    for xi in xs[:-1]:
        for yi in ys[:-1]:
            cells.append(box(xi, yi, xi + res, yi + res))
            ids.append(str(encode(xi + res / 2, yi + res / 2, res, sep)))
    return gpd.GeoDataFrame({"grid_id": ids}, geometry=cells, crs=5179)
