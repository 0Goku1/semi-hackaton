# -*- coding: utf-8 -*-
"""화성시 전 구역 500m 격자화 — LSMD 읍면동(법정동) 경계.

1) data/LSMD_ADM_SECT_UMD_*/ 경기도 shp
2) COL_ADM_SE == 41590 (화성시) 필터 → union
3) EPSG:5186 → 5179 변환 후 grid.grid_polygons 교차 셀 채택
4) 셀별 대표 읍면동명·코드, (있으면) 팜맵 속성 병합

출력:
  data/processed/route_dev_hwaseong_grids.json
  route-dev-data/route_dev_hwaseong_grids.json

관련: analysis/19_lsmd_umd_vs_ri.py (UMD가 RI 대체 가능함을 검증)
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd
from pyproj import Transformer
from shapely.ops import unary_union

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import grid as G

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
WEB = ROOT / "route-dev-data"
DATA = ROOT / "data"
FARM_JSON = WEB / "route_dev_all_grids.json"
TF = Transformer.from_crs(5179, 4326, always_xy=True)
TYPE_KO = {"paddy": "논", "field": "밭", "facility": "시설", "orchard": "과수"}
HW_SGG = "41590"


def ll(x, y):
    lon, lat = TF.transform(float(x), float(y))
    return float(lon), float(lat)


def find_umd_shp() -> Path:
    for p in DATA.iterdir():
        if p.is_dir() and p.name.startswith("LSMD_ADM_SECT_UMD"):
            shps = list(p.glob("*.shp"))
            if shps:
                return shps[0]
    raise FileNotFoundError("data/LSMD_ADM_SECT_UMD_*/ *.shp 없음")


def load_hwaseong_umd(shp: Path) -> gpd.GeoDataFrame:
    # .cst = EUC-KR → geopandas/fiona 에 encoding 전달
    gdf = gpd.read_file(shp, encoding="cp949")
    if "COL_ADM_SE" not in gdf.columns:
        raise KeyError(f"COL_ADM_SE 없음: {list(gdf.columns)}")
    hw = gdf[gdf["COL_ADM_SE"].astype(str) == HW_SGG].copy()
    if hw.empty:
        raise ValueError(f"화성시({HW_SGG}) 행 없음")
    hw = hw.to_crs(5179)
    hw = hw[hw.geometry.notna() & ~hw.geometry.is_empty].copy()
    hw["읍면동명"] = hw["EMD_NM"].astype(str)
    hw["읍면동코드"] = hw["EMD_CD"].astype(str)
    return hw[["읍면동명", "읍면동코드", "geometry"]]


def main():
    shp = find_umd_shp()
    print(f"UMD shp: {shp}")
    umd = load_hwaseong_umd(shp)
    print(f"화성 읍면동 {len(umd)}행  CRS→5179")
    print(f"이름: {sorted(umd['읍면동명'].unique())}")

    city = unary_union(umd.geometry.values)
    print(f"union 면적 {city.area/1e6:.2f} km²  type={city.geom_type}")

    minx, miny, maxx, maxy = city.bounds
    cells = G.grid_polygons(minx, miny, maxx, maxy, res=G.GRID_RES)
    print(f"extent 격자 후보 {len(cells):,}개")

    cells = cells[cells.intersects(city)].copy()
    cells["overlap_m2"] = cells.geometry.intersection(city).area
    cells = cells[cells["overlap_m2"] > 1.0].copy()
    print(f"화성 UMD 교차 격자 {len(cells):,}개")

    joined = gpd.overlay(
        cells[["grid_id", "geometry"]],
        umd,
        how="intersection",
        keep_geom_type=False,
    )
    joined["a"] = joined.geometry.area
    top = (
        joined.sort_values("a", ascending=False)
        .groupby("grid_id", as_index=False)
        .first()[["grid_id", "읍면동명", "읍면동코드"]]
    )
    emd_names = (
        joined.groupby("grid_id")["읍면동명"]
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
    priority = set(priority_from_farm.keys())

    rows = []
    for _, row in cells.iterrows():
        gid = row["grid_id"]
        cminx, cminy, cmaxx, cmaxy = G.cell_bounds(gid, res=G.GRID_RES)
        clon, clat = ll((cminx + cmaxx) / 2, (cminy + cmaxy) / 2)
        sw_lon, sw_lat = ll(cminx, cminy)
        ne_lon, ne_lat = ll(cmaxx, cmaxy)

        farm = farm_by_id.get(gid)
        types = farm["types"] if farm else {}
        primary = farm["primary_type"] if farm else None
        primary_ko = farm.get("primary_type_ko") if farm else None
        if not primary_ko and primary:
            primary_ko = TYPE_KO.get(primary, primary)

        risk_rank = priority_from_farm.get(gid)
        names = emd_names.get(gid) or (
            [] if pd.isna(row.get("읍면동명")) else [str(row["읍면동명"])]
        )
        emd_name = None if pd.isna(row.get("읍면동명")) else str(row["읍면동명"])
        emd_code = None if pd.isna(row.get("읍면동코드")) else str(row["읍면동코드"])

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
                "emd_name": emd_name,
                "emd_code": emd_code,
                # 하위 호환: 예전 ri_* 키
                "ri_name": emd_name,
                "ri_code": emd_code,
                "emd_names": names,
                "city_overlap_m2": round(float(row["overlap_m2"]), 1),
                "city_overlap_ratio": round(
                    float(row["overlap_m2"]) / (G.GRID_RES ** 2), 6
                ),
                "has_farm": farm is not None,
                "primary_type": primary,
                "primary_type_ko": primary_ko or "—",
                "types": types,
                "parcel_count": int(farm["parcel_count"]) if farm else 0,
                "farm_area_m2": float(farm["farm_area_m2"]) if farm else 0.0,
                "farm_ratio": float(farm["farm_ratio"]) if farm else 0.0,
                "source": "lsmd_umd_41590",
                "is_priority": gid in priority,
                "risk_rank": risk_rank,
                "danger_level": (
                    "위험도 높음"
                    if gid in priority
                    else ("농지" if farm else "일반")
                ),
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
            "emd_count": int(len(umd)),
            "farm_count": sum(1 for r in rows if r["has_farm"]),
            "priority_count": sum(1 for r in rows if r["is_priority"]),
            "grid_res_m": G.GRID_RES,
            "crs_cell": "EPSG:5179",
            "boundary": "LSMD_ADM_SECT_UMD (COL_ADM_SE=41590, EPSG:5186→5179)",
            "boundary_shp": shp.name,
            "city_area_km2": round(city.area / 1e6, 2),
            "emd_names": sorted(umd["읍면동명"].unique()),
            "note": "화성시 법정동(읍면동) 경계와 교차하는 모든 500m 격자",
        },
        "grids": rows,
    }

    PROC.mkdir(parents=True, exist_ok=True)
    WEB.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    out_proc = PROC / "route_dev_hwaseong_grids.json"
    out_web = WEB / "route_dev_hwaseong_grids.json"
    out_proc.write_text(text, encoding="utf-8")
    out_web.write_text(text, encoding="utf-8")
    print(
        f"OK grids={len(rows)} farm={payload['meta']['farm_count']} "
        f"priority={payload['meta']['priority_count']} "
        f"area={payload['meta']['city_area_km2']}km² ({len(text)/1e6:.2f} MB)"
    )
    print(f"→ {out_web}")


if __name__ == "__main__":
    main()
