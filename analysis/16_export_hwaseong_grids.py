# -*- coding: utf-8 -*-
"""Hw_Ri(화성 리 경계) 기준 — 화성시 전 구역 500m 격자화.

1) 리 폴리곤 union → 화성시 영역
2) grid.grid_polygons(extent) 생성 후 영역과 교차하는 셀만 채택
3) 셀별 대표 리명·리코드, (있으면) 팜맵 속성·우선 20 플래그 병합

출력:
  data/processed/route_dev_hwaseong_grids.json
  route-dev-data/route_dev_hwaseong_grids.json
"""
from __future__ import annotations

import json
import io
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import geopandas as gpd
from shapely import wkt as shapely_wkt
from shapely.ops import unary_union
from pyproj import Transformer

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import grid as G

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
WEB = ROOT / "route-dev-data"
HW_RI = Path(r"c:\Users\flash\Downloads\Hw_Ri.csv")
FARM_JSON = WEB / "route_dev_all_grids.json"
TF = Transformer.from_crs(5179, 4326, always_xy=True)

RANK_LIST = []  # farm JSON의 is_priority / risk_rank 를 따름
PRIORITY = set()
TYPE_KO = {"paddy": "논", "field": "밭", "facility": "시설", "orchard": "과수"}


def ll(x, y):
    lon, lat = TF.transform(float(x), float(y))
    return float(lon), float(lat)


def load_ri(path: Path) -> gpd.GeoDataFrame:
    df = pd.read_csv(path, encoding="utf-8")
    # 화성시만
    if "객체시군구코드" in df.columns:
        df = df[df["객체시군구코드"].astype(str) == "41590"].copy()
    geoms = df["WKT"].map(shapely_wkt.loads)
    gdf = gpd.GeoDataFrame(df, geometry=geoms, crs=5179)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].copy()
    gdf["리명"] = gdf["리명"].astype(str)
    gdf["리코드"] = gdf["리코드"].astype(str)
    return gdf


def main():
    print(f"Hw_Ri: {HW_RI}")
    ri = load_ri(HW_RI)
    print(f"리 폴리곤 {len(ri)}개  면적 {ri.geometry.area.sum()/1e6:.1f} km²")

    city = unary_union(ri.geometry.values)
    minx, miny, maxx, maxy = city.bounds
    cells = G.grid_polygons(minx, miny, maxx, maxy, res=G.GRID_RES)
    print(f"extent 격자 후보 {len(cells):,}개")

    # 화성 영역과 교차하는 셀만
    cells = cells[cells.intersects(city)].copy()
    cells["overlap_m2"] = cells.geometry.intersection(city).area
    cells = cells[cells["overlap_m2"] > 1.0].copy()
    print(f"화성 교차 격자 {len(cells):,}개")

    # 셀 ↔ 리 공간조인 (대표 리 = 교차면적 최대)
    joined = gpd.overlay(
        cells[["grid_id", "geometry"]],
        ri[["리명", "리코드", "geometry"]],
        how="intersection",
        keep_geom_type=False,
    )
    joined["a"] = joined.geometry.area
    top = (
        joined.sort_values("a", ascending=False)
        .groupby("grid_id", as_index=False)
        .first()[["grid_id", "리명", "리코드"]]
    )
    ri_names = (
        joined.groupby("grid_id")["리명"]
        .agg(lambda s: sorted(set(s.astype(str)))[:8])
        .to_dict()
    )

    cells = cells.merge(top, on="grid_id", how="left")

    farm_by_id = {}
    priority_from_farm = {}
    if FARM_JSON.exists():
        farm = json.loads(FARM_JSON.read_text(encoding="utf-8"))
        for g in farm.get("grids", []):
            farm_by_id[g["grid_id"]] = g
            if g.get("is_priority"):
                priority_from_farm[g["grid_id"]] = g.get("risk_rank")
        print(f"팜맵 격자 병합 {len(farm_by_id):,}개  priority={len(priority_from_farm)}")
    PRIORITY = set(priority_from_farm.keys())

    rows = []
    for _, row in cells.iterrows():
        gid = row["grid_id"]
        minx, miny, maxx, maxy = G.cell_bounds(gid, res=G.GRID_RES)
        clon, clat = ll((minx + maxx) / 2, (miny + maxy) / 2)
        sw_lon, sw_lat = ll(minx, miny)
        ne_lon, ne_lat = ll(maxx, maxy)

        farm = farm_by_id.get(gid)
        types = farm["types"] if farm else {}
        primary = farm["primary_type"] if farm else None
        primary_ko = farm.get("primary_type_ko") if farm else None
        if not primary_ko and primary:
            primary_ko = TYPE_KO.get(primary, primary)

        risk_rank = priority_from_farm.get(gid)
        emd = ri_names.get(gid) or ([] if pd.isna(row.get("리명")) else [str(row["리명"])])

        rows.append(
            {
                "grid_id": gid,
                "name": gid,
                "lat": round(clat, 7),
                "lon": round(clon, 7),
                "bounds": {
                    "sw": {"lat": round(sw_lat, 7), "lng": round(sw_lon, 7)},
                    "ne": {"lat": round(ne_lat, 7), "lng": round(ne_lon, 7)},
                },
                "ri_name": None if pd.isna(row.get("리명")) else str(row["리명"]),
                "ri_code": None if pd.isna(row.get("리코드")) else str(row["리코드"]),
                "emd_names": emd,
                "city_overlap_m2": round(float(row["overlap_m2"]), 1),
                "city_overlap_ratio": round(float(row["overlap_m2"]) / (G.GRID_RES ** 2), 6),
                "has_farm": farm is not None,
                "primary_type": primary,
                "primary_type_ko": primary_ko or "—",
                "types": types,
                "parcel_count": int(farm["parcel_count"]) if farm else 0,
                "farm_area_m2": float(farm["farm_area_m2"]) if farm else 0.0,
                "farm_ratio": float(farm["farm_ratio"]) if farm else 0.0,
                "source": "hw_ri_41590",
                "is_priority": gid in PRIORITY,
                "risk_rank": risk_rank,
                "danger_level": "위험도 높음" if gid in PRIORITY else ("농지" if farm else "일반"),
            }
        )

    rows.sort(
        key=lambda r: (
            0 if r["is_priority"] else 1,
            r["risk_rank"] or 999,
            0 if r["has_farm"] else 1,
            r["grid_id"],
        )
    )

    payload = {
        "meta": {
            "count": len(rows),
            "ri_count": int(len(ri)),
            "farm_count": sum(1 for r in rows if r["has_farm"]),
            "priority_count": sum(1 for r in rows if r["is_priority"]),
            "grid_res_m": G.GRID_RES,
            "crs_cell": "EPSG:5179",
            "boundary": "Hw_Ri.csv (객체시군구코드=41590)",
            "city_area_km2": round(city.area / 1e6, 2),
            "note": "화성시 리 경계와 교차하는 모든 500m 격자",
        },
        "grids": rows,
    }

    PROC.mkdir(parents=True, exist_ok=True)
    WEB.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    (PROC / "route_dev_hwaseong_grids.json").write_text(text, encoding="utf-8")
    (WEB / "route_dev_hwaseong_grids.json").write_text(text, encoding="utf-8")
    print(
        f"OK grids={len(rows)} farm={payload['meta']['farm_count']} "
        f"priority={payload['meta']['priority_count']} ({len(text)/1e6:.2f} MB)"
    )


if __name__ == "__main__":
    main()
