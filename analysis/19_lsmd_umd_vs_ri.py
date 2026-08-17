# -*- coding: utf-8 -*-
"""LSMD 읍면동 경계 요약 (RI 대체 완료 후 유지용 점검).

Hw_Ri / Hw_ri_B 는 삭제됨. 격자 경계는 analysis/16_export_hwaseong_grids.py 가
LSMD_ADM_SECT_UMD (COL_ADM_SE=41590) 만 사용.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

import geopandas as gpd
from shapely.ops import unary_union

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
DATA = Path(__file__).resolve().parents[1] / "data"


def main():
    folder = next(p for p in DATA.iterdir() if p.is_dir() and p.name.startswith("LSMD_ADM_SECT_UMD"))
    shp = next(folder.glob("*.shp"))
    g = gpd.read_file(shp, encoding="cp949")
    hw = g[g["COL_ADM_SE"].astype(str) == "41590"].to_crs(5179)
    city = unary_union(hw.geometry.values)
    names = sorted(hw["EMD_NM"].astype(str).unique())
    print(f"shp={shp.name} CRS→5179")
    print(f"화성 읍면동 {len(hw)} · 면적 {city.area/1e6:.2f} km²")
    print(f"동 {[n for n in names if n.endswith('동')]}")
    print(f"읍면 {[n for n in names if n.endswith('읍') or n.endswith('면')]}")


if __name__ == "__main__":
    main()
