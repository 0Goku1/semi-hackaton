# -*- coding: utf-8 -*-
"""contact CSV → routeDevData.js + route_dev_all_grids.json (사이트 반영, overlay 없음)."""
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
CONTACTS = PROC / "hsfram_parcel_contacts.csv"
TYPE_KO = {"paddy": "논", "field": "밭", "facility": "시설", "orchard": "과수"}
TF = Transformer.from_crs(5179, 4326, always_xy=True)


def main():
    contacts = pd.read_csv(CONTACTS, encoding="utf-8-sig")
    print(f"contacts {len(contacts):,}  grids {contacts.grid_id.nunique():,}")
    print(contacts["type"].value_counts().to_string())

    # --- 20 샘플 → routeDevData.js ---
    g = contacts.groupby("grid_id").first().reset_index()
    s = g.sample(n=min(20, len(g)), random_state=42).reset_index(drop=True)
    samples = []
    for i, r in s.iterrows():
        samples.append(
            {
                "id": str(r["id"]),
                "grid_id": r["grid_id"],
                "type": r["type"],
                "lon": float(r["lon"]),
                "lat": float(r["lat"]),
                "emd_name": str(r.get("emd_name") or ""),
                "score": int(98 - i * 2),
                "dangerLevel": "위험도 높음",
                "rank": int(i + 1),
            }
        )

    lines = [
        "/**",
        " * 동선 최적화 레이어 개발용 더미.",
        " * data/processed/hsfram_parcel_contacts.csv 유일격자 seed=42 샘플 20.",
        " */",
        "const ROUTE_DEV_TYPE_KO = {",
        '  paddy: "논",',
        '  field: "밭",',
        '  facility: "시설",',
        '  orchard: "과수",',
        "};",
        "",
        "const ROUTE_DEV_GRIDS = [",
    ]
    for row in samples:
        lines.append("  " + json.dumps(row, ensure_ascii=False) + ",")
    lines.append("].map((g, i) => ({ ...g, rank: g.rank ?? (i + 1) }));")
    lines.append("")
    (ROOT / "js" / "routeDevData.js").write_text("\n".join(lines), encoding="utf-8")
    print(f"routeDevData.js ← {len(samples)} grids")

    # --- all_grids (contact 집계) ---
    priority = {r["grid_id"] for r in samples}
    rank_list = [r["grid_id"] for r in samples]
    agg = (
        contacts.groupby(["grid_id", "type"])
        .agg(parcel_count=("id", "count"), area_m2=("area_m2", "sum"))
        .reset_index()
    )
    emd = (
        contacts.dropna(subset=["emd_name"])
        .groupby("grid_id")["emd_name"]
        .agg(lambda s: sorted(set(s.astype(str)))[:5])
        .to_dict()
    )

    out = []
    for gid, sub in agg.groupby("grid_id"):
        minx, miny, maxx, maxy = G.cell_bounds(gid, res=G.GRID_RES)
        clon, clat = TF.transform((minx + maxx) / 2, (miny + maxy) / 2)
        swlon, swlat = TF.transform(minx, miny)
        nelon, nelat = TF.transform(maxx, maxy)
        types = {}
        for _, r in sub.iterrows():
            t = r["type"]
            types[t] = {
                "label_ko": TYPE_KO.get(t, t),
                "parcel_count": int(r["parcel_count"]),
                "overlap_area_m2": round(float(r["area_m2"]), 1),
                "overlap_ratio": round(float(r["area_m2"]) / (G.GRID_RES**2), 6),
            }
        primary = max(types.items(), key=lambda kv: kv[1]["overlap_area_m2"])[0]
        total_area = sum(v["overlap_area_m2"] for v in types.values())
        total_parcels = sum(v["parcel_count"] for v in types.values())
        risk_rank = rank_list.index(gid) + 1 if gid in priority else None
        out.append(
            {
                "grid_id": gid,
                "name": gid,
                "lat": round(float(clat), 7),
                "lon": round(float(clon), 7),
                "bounds": {
                    "sw": {"lat": round(float(swlat), 7), "lng": round(float(swlon), 7)},
                    "ne": {"lat": round(float(nelat), 7), "lng": round(float(nelon), 7)},
                },
                "primary_type": primary,
                "primary_type_ko": TYPE_KO.get(primary, primary),
                "types": types,
                "parcel_count": int(total_parcels),
                "farm_area_m2": round(total_area, 1),
                "farm_ratio": round(min(1.0, total_area / (G.GRID_RES**2)), 6),
                "emd_names": emd.get(gid, []),
                "source": "farmmap_hsfram_contact",
                "is_priority": gid in priority,
                "risk_rank": risk_rank,
                "danger_level": "위험도 높음" if gid in priority else "일반",
            }
        )
    out.sort(key=lambda r: (0 if r["is_priority"] else 1, r["risk_rank"] or 999, r["grid_id"]))
    payload = {
        "meta": {
            "count": len(out),
            "grid_res_m": G.GRID_RES,
            "crs_cell": "EPSG:5179",
            "source": "hsfram_parcel_contacts (contact-only)",
            "priority_count": sum(1 for r in out if r["is_priority"]),
            "note": "대표점 배정 contact 집계",
        },
        "grids": out,
    }
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    PROC.mkdir(parents=True, exist_ok=True)
    WEB.mkdir(parents=True, exist_ok=True)
    (PROC / "route_dev_all_grids.json").write_text(text, encoding="utf-8")
    (WEB / "route_dev_all_grids.json").write_text(text, encoding="utf-8")
    print(f"all_grids {len(out):,}  ({len(text)/1e6:.2f} MB)")


if __name__ == "__main__":
    main()
