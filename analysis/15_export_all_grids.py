# -*- coding: utf-8 -*-
"""시스템 전체 팜맵 격자(unique grid_id) → route-dev 지도용 JSON.

입력: data/processed/hsfram_grid_farm_agg.csv (+ contacts로 읍면동)
출력: data/processed/route_dev_all_grids.json
      route-dev-data/route_dev_all_grids.json (웹 fetch용 복사)
"""
from __future__ import annotations

import json
import io
import sys
from pathlib import Path

import pandas as pd
from pyproj import Transformer

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import grid as G

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
WEB = ROOT / "route-dev-data"
AGG = PROC / "hsfram_grid_farm_agg.csv"
CONTACTS = PROC / "hsfram_parcel_contacts.csv"
TF = Transformer.from_crs(5179, 4326, always_xy=True)

PRIORITY = {
    "다바 081 187", "다바 086 199", "다사 067 028", "다사 081 024", "다사 093 010",
    "다바 104 199", "다사 058 009", "다바 069 199", "다바 072 198", "다사 077 037",
    "다사 061 012", "다바 098 193", "다바 072 195", "다사 081 004", "다사 077 025",
    "다사 105 000", "다사 054 017", "다사 089 007", "다바 079 190", "다사 085 006",
}

TYPE_KO = {"paddy": "논", "field": "밭", "facility": "시설", "orchard": "과수"}


def ll(x, y):
    lon, lat = TF.transform(x, y)
    return float(lon), float(lat)


def main():
    agg = pd.read_csv(AGG, encoding="utf-8-sig")
    emd_map = {}
    if CONTACTS.exists():
        c = pd.read_csv(CONTACTS, encoding="utf-8-sig", usecols=["grid_id", "emd_name"])
        emd_map = (
            c.dropna(subset=["emd_name"])
            .groupby("grid_id")["emd_name"]
            .agg(lambda s: sorted(set(s.astype(str)))[:5])
            .to_dict()
        )

    rows = []
    for gid, g in agg.groupby("grid_id"):
        minx, miny, maxx, maxy = G.cell_bounds(gid, res=G.GRID_RES)
        clon, clat = ll((minx + maxx) / 2, (miny + maxy) / 2)
        sw_lon, sw_lat = ll(minx, miny)
        ne_lon, ne_lat = ll(maxx, maxy)

        types = {}
        for _, r in g.iterrows():
            t = str(r["type"])
            types[t] = {
                "label_ko": TYPE_KO.get(t, t),
                "parcel_count": int(r["parcel_count"]),
                "overlap_area_m2": round(float(r["overlap_area_m2"]), 1),
                "overlap_ratio": round(float(r["overlap_ratio"]), 6),
            }
        primary = max(types.items(), key=lambda kv: kv[1]["overlap_area_m2"])[0]
        total_area = sum(v["overlap_area_m2"] for v in types.values())
        total_parcels = sum(v["parcel_count"] for v in types.values())
        total_ratio = min(1.0, total_area / float(G.GRID_RES * G.GRID_RES))

        rank_list = [
            "다바 081 187", "다바 086 199", "다사 067 028", "다사 081 024", "다사 093 010",
            "다바 104 199", "다사 058 009", "다바 069 199", "다바 072 198", "다사 077 037",
            "다사 061 012", "다바 098 193", "다바 072 195", "다사 081 004", "다사 077 025",
            "다사 105 000", "다사 054 017", "다사 089 007", "다바 079 190", "다사 085 006",
        ]
        risk_rank = rank_list.index(gid) + 1 if gid in PRIORITY else None

        rows.append(
            {
                "grid_id": gid,
                "name": gid,  # 국가지점번호 = 표시 이름
                "lat": round(clat, 7),
                "lon": round(clon, 7),
                "bounds": {
                    "sw": {"lat": round(sw_lat, 7), "lng": round(sw_lon, 7)},
                    "ne": {"lat": round(ne_lat, 7), "lng": round(ne_lon, 7)},
                },
                "primary_type": primary,
                "primary_type_ko": TYPE_KO.get(primary, primary),
                "types": types,
                "parcel_count": int(total_parcels),
                "farm_area_m2": round(total_area, 1),
                "farm_ratio": round(total_ratio, 6),
                "emd_names": emd_map.get(gid, []),
                "source": "farmmap_hsfram",
                "is_priority": gid in PRIORITY,
                "risk_rank": risk_rank,
                "danger_level": "위험도 높음" if gid in PRIORITY else "일반",
            }
        )

    rows.sort(key=lambda r: (0 if r["is_priority"] else 1, r["risk_rank"] or 999, r["grid_id"]))

    payload = {
        "meta": {
            "count": len(rows),
            "grid_res_m": G.GRID_RES,
            "crs_cell": "EPSG:5179",
            "source_agg": str(AGG.name),
            "priority_count": sum(1 for r in rows if r["is_priority"]),
            "note": "전체 팜맵 교차 격자. 더블클릭 시 상세. is_priority=임시 TOP20 위험 후보",
        },
        "grids": rows,
    }

    PROC.mkdir(parents=True, exist_ok=True)
    WEB.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    (PROC / "route_dev_all_grids.json").write_text(text, encoding="utf-8")
    (WEB / "route_dev_all_grids.json").write_text(text, encoding="utf-8")
    print(f"grids={len(rows)} priority={payload['meta']['priority_count']}")
    print(f"→ {WEB / 'route_dev_all_grids.json'} ({len(text)/1e6:.2f} MB)")


if __name__ == "__main__":
    main()
