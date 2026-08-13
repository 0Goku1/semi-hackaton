# -*- coding: utf-8 -*-
"""화성 팜맵(HsFram.csv) → 500m 국가지점번호 격자 배정.

입력: Farm Map 필지 CSV (WKT MULTIPOLYGON, EPSG:5179 좌표)
출력:
  1) parcel_contacts.csv  — 필지 1행 + 대표점 기준 grid_id (접촉점 수집 스키마)
  2) grid_farm_overlap.csv — 필지∩격자 면적 (피처/노출용, 한 필지가 여러 격자 가능)

격자 ID는 반드시 src/grid.py 의 encode / from_lonlat 만 사용한다.
동일 (ORIGIN, GRID_RES=500) 이면 같은 셀의 어떤 lon/lat 도 같은 grid_id 를 받는다.
"""
from __future__ import annotations

import argparse
import io
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import geopandas as gpd
from shapely import wkt as shapely_wkt
from shapely.geometry import Point

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import grid as G

TYPE_MAP = {
    "논": "paddy",
    "밭": "field",
    "시설": "facility",
    "과수": "orchard",
}
TYPE_CODE_MAP = {1: "paddy", 2: "field", 3: "orchard", 4: "facility"}

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_IN = ROOT / "data" / "HsFram.csv"
DEFAULT_OUT = ROOT / "data" / "processed"


def map_type(row) -> str:
    nm = row.get("INTPR_NM")
    if isinstance(nm, str) and nm in TYPE_MAP:
        return TYPE_MAP[nm]
    cd = row.get("INTPR_CD")
    try:
        return TYPE_CODE_MAP[int(cd)]
    except (TypeError, ValueError, KeyError):
        return "unknown"


def load_farms(path: Path) -> gpd.GeoDataFrame:
    usecols = [
        "FMAP_INNB",
        "INTPR_CD",
        "INTPR_NM",
        "LGL_EMD_NM",
        "AREA",
        "WKT",
    ]
    # 컬럼명 변형 대비 — 실제 헤더 확인
    head = pd.read_csv(path, encoding="utf-8", nrows=0)
    cols = list(head.columns)
    wkt_col = next((c for c in cols if c.upper() in ("WKT", "GEOMETRY", "GEOM")), None)
    if wkt_col is None:
        raise SystemExit(f"WKT 컬럼 없음: {cols[:20]}")

    want = [c for c in usecols if c in cols or c == "WKT"]
    if "WKT" in want and wkt_col != "WKT":
        want = [wkt_col if c == "WKT" else c for c in want]

    df = pd.read_csv(path, encoding="utf-8", usecols=want)
    if wkt_col != "WKT":
        df = df.rename(columns={wkt_col: "WKT"})

    if "INTPR_NM" in df.columns:
        df["type"] = df["INTPR_NM"].map(TYPE_MAP)
    else:
        df["type"] = df["INTPR_CD"].map(TYPE_CODE_MAP)
    df["type"] = df["type"].fillna("unknown")
    df = df[df["type"] != "unknown"].copy()
    if "FMAP_INNB" in df.columns:
        df["parcel_id"] = df["FMAP_INNB"].astype(str)
    else:
        df["parcel_id"] = np.arange(1, len(df) + 1).astype(str)
    df["source"] = "farmmap_hsfram"

    geoms = df["WKT"].map(shapely_wkt.loads)
    gdf = gpd.GeoDataFrame(df.drop(columns=["WKT"]), geometry=geoms, crs=5179)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].copy()
    return gdf


def parcel_contacts(gdf: gpd.GeoDataFrame) -> pd.DataFrame:
    """필지 대표점 → grid_id + WGS84 lon/lat (접촉점 CSV 스키마)."""
    pts = gdf.geometry.representative_point()
    grid_ids = [str(v) for v in np.atleast_1d(G.encode(pts.x.values, pts.y.values))]
    lon, lat = G._tf(5179, 4326).transform(pts.x.values, pts.y.values)

    out = pd.DataFrame(
        {
            "id": gdf["parcel_id"].astype(str),
            "grid_id": grid_ids,
            "type": gdf["type"].values,
            "lon": lon,
            "lat": lat,
            "source": gdf["source"].values,
            "area_m2": gdf["AREA"].values if "AREA" in gdf.columns else gdf.geometry.area,
            "emd_name": gdf["LGL_EMD_NM"].values if "LGL_EMD_NM" in gdf.columns else "",
            "intpr_nm": gdf["INTPR_NM"].values if "INTPR_NM" in gdf.columns else "",
            "x_5179": pts.x.values,
            "y_5179": pts.y.values,
        }
    )
    return out


def grid_overlap(gdf: gpd.GeoDataFrame) -> pd.DataFrame:
    """필지∩500m격자 면적. 한 필지가 여러 격자에 걸치면 여러 행."""
    minx, miny, maxx, maxy = gdf.total_bounds
    cells = G.grid_polygons(minx, miny, maxx, maxy, res=G.GRID_RES)
    farm = gdf[["parcel_id", "type", "source", "geometry"]].copy()
    inter = gpd.overlay(farm, cells, how="intersection", keep_geom_type=False)
    inter["overlap_area_m2"] = inter.geometry.area
    inter = inter[inter["overlap_area_m2"] > 1.0]  # 수치 노이즈 제거
    # 격자당·타입별 집계 (필지 단위 원본도 남기려면 아래 groupby 전 저장)
    detail = inter[["grid_id", "parcel_id", "type", "source", "overlap_area_m2"]].copy()
    agg = (
        detail.groupby(["grid_id", "type"], as_index=False)
        .agg(
            parcel_count=("parcel_id", "nunique"),
            overlap_area_m2=("overlap_area_m2", "sum"),
        )
    )
    agg["overlap_ratio"] = agg["overlap_area_m2"] / float(G.GRID_RES * G.GRID_RES)
    agg["source"] = "farmmap_hsfram"
    return detail, agg


def verify_grid_consistency(contacts: pd.DataFrame, n_samples: int = 200, seed: int = 42) -> dict:
    """같은 격자 안 임의 점·원본 lon/lat 이 동일 grid_id 를 받는지 검증."""
    rng = np.random.default_rng(seed)
    ok_roundtrip = 0
    ok_jitter = 0
    ok_from_lonlat = 0
    n = min(n_samples, len(contacts))
    sample = contacts.sample(n=n, random_state=seed)

    for _, row in sample.iterrows():
        gid = row["grid_id"]
        # 1) lon/lat → from_lonlat
        gid2 = str(G.from_lonlat(row["lon"], row["lat"]))
        if gid2 == gid:
            ok_from_lonlat += 1

        # 2) encode(x,y) 재계산
        gid3 = str(G.encode(row["x_5179"], row["y_5179"]))
        if gid3 == gid:
            ok_roundtrip += 1

        # 3) 셀 내부 랜덤 점 → 동일 ID
        minx, miny, maxx, maxy = G.cell_bounds(gid)
        # 경계는 다음 셀에 속할 수 있으므로 안쪽으로 1m
        jx = rng.uniform(minx + 1, maxx - 1)
        jy = rng.uniform(miny + 1, maxy - 1)
        if str(G.encode(jx, jy)) == gid:
            ok_jitter += 1

        # 4) 셀 중심 decode → encode
        cx, cy = G.decode(gid)
        assert str(G.encode(cx, cy)) == gid

    # 인접 셀은 다른 ID
    gid0 = sample.iloc[0]["grid_id"]
    minx, miny, maxx, maxy = G.cell_bounds(gid0)
    neighbor = str(G.encode(maxx + 1, (miny + maxy) / 2))
    different_neighbor = neighbor != gid0

    return {
        "n": n,
        "from_lonlat_match": ok_from_lonlat,
        "encode_roundtrip": ok_roundtrip,
        "interior_jitter_match": ok_jitter,
        "neighbor_differs": different_neighbor,
        "grid_res": G.GRID_RES,
        "origin": (G.ORIGIN_X, G.ORIGIN_Y),
    }


def main():
    ap = argparse.ArgumentParser(description="HsFram → 500m grid_id 배정")
    ap.add_argument("--input", type=Path, default=DEFAULT_IN)
    ap.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--skip-overlap", action="store_true", help="면적 오버레이 생략(빠름)")
    args = ap.parse_args()

    t0 = time.time()
    print(f"입력: {args.input}")
    print(f"격자: GRID_RES={G.GRID_RES}m  ORIGIN=({G.ORIGIN_X}, {G.ORIGIN_Y})  CRS=EPSG:5179")

    gdf = load_farms(args.input)
    print(f"필지 로드: {len(gdf):,}  면적 {gdf.geometry.area.sum()/1e6:.1f} km²")
    print("타입 분포:\n", gdf["type"].value_counts().to_string())

    contacts = parcel_contacts(gdf)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    cpath = args.out_dir / "hsfram_parcel_contacts.csv"
    contacts.drop(columns=["x_5179", "y_5179"]).to_csv(cpath, index=False, encoding="utf-8-sig")
    print(f"\n[OK] parcel contacts → {cpath}  ({len(contacts):,}행)")
    print(f"     유일 grid_id: {contacts['grid_id'].nunique():,}")

    # 내부 검증용 좌표 포함본
    contacts.to_csv(
        args.out_dir / "hsfram_parcel_contacts_with_5179.csv",
        index=False,
        encoding="utf-8-sig",
    )

    if not args.skip_overlap:
        print("\n오버레이(필지∩격자) 계산 중…")
        detail, agg = grid_overlap(gdf)
        dpath = args.out_dir / "hsfram_grid_overlap_detail.csv"
        apath = args.out_dir / "hsfram_grid_farm_agg.csv"
        detail.to_csv(dpath, index=False, encoding="utf-8-sig")
        agg.to_csv(apath, index=False, encoding="utf-8-sig")
        print(f"[OK] overlap detail → {dpath}  ({len(detail):,}행)")
        print(f"[OK] grid×type agg → {apath}  ({len(agg):,}행, grids={agg['grid_id'].nunique():,})")

    print("\n" + "=" * 72)
    print("격자 ID 일관성 검증")
    print("=" * 72)
    v = verify_grid_consistency(contacts)
    for k, val in v.items():
        print(f"  {k}: {val}")
    all_ok = (
        v["from_lonlat_match"] == v["n"]
        and v["encode_roundtrip"] == v["n"]
        and v["interior_jitter_match"] == v["n"]
        and v["neighbor_differs"]
    )
    print(f"\n결과: {'PASS — 동일 셀이면 동일 grid_id 보장' if all_ok else 'FAIL'}")
    print(f"소요: {time.time()-t0:.1f}s")

    print(
        """
시스템 요약
  · 격자 경계 = floor((x - ORIGIN) / 500) — 결정적(deterministic)
  · 접촉점/기상/산불이 WGS84면 반드시 G.from_lonlat(lon, lat)
  · 팜맵처럼 이미 5179면 G.encode(x, y)
  · res·ORIGIN·sep 를 스크립트마다 다르게 쓰면 ID가 갈라짐 → 항상 grid.GRID_RES 사용
  · 셀 경계선(정확히 maxx)은 동쪽/북쪽 인접 셀에 속함 (반열린 구간)
"""
    )


if __name__ == "__main__":
    main()
