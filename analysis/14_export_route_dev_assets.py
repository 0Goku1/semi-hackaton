# -*- coding: utf-8 -*-
"""동선 레이어 DEV용 자산 export.

등산로(화성) + 임도(화성 clip) →
  1) GeoJSON (WGS84, 지도 오버레이)
  2) 가중 그래프 JSON (분 단위, 2계층 이동비용용)
  3) 임시 20격자의 최근접 네트워크 스냅

출력: data/processed/route_dev_*
프론트: route-dev.html 이 fetch 해서 TOP 배정에 사용.
"""
from __future__ import annotations

import json
import sys
import io
from pathlib import Path

import numpy as np
import geopandas as gpd
import networkx as nx
from shapely.geometry import box, mapping
from pyproj import Transformer

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import grid as G

DATA = Path(r"d:\Workspace\semi-hackaton\data")
OUT = DATA / "processed"
TRAIL = DATA / "등산로_화성시" / "TB_FGDI_WG_MT_WAY_41590.shp"
ROAD_ALL = DATA / "임도망도(산길)_전국" / "TB_FGDI_FS_ID300_ALL.shp"
FOREST = DATA / "임상도(1대5000)_화성시" / "TB_FGDI_FS_IM5000_41590.shp"

SNAP = 20.0
SIMPLIFY = 8.0  # m — 웹 GeoJSON 경량화
TF = Transformer.from_crs(5179, 4326, always_xy=True)

# routeDevData.js 와 동일 seed=42 20격자 (lon/lat)
GRIDS = [
    {"grid_id": "다바 081 187", "type": "paddy", "lon": 126.831911174, "lat": 37.04022889, "emd_name": "장안면", "score": 98, "rank": 1},
    {"grid_id": "다바 086 199", "type": "field", "lon": 126.86130233, "lat": 37.0967472134, "emd_name": "장안면", "score": 96, "rank": 2},
    {"grid_id": "다사 067 028", "type": "field", "lon": 126.7526908188, "lat": 37.2230120697, "emd_name": "송산면", "score": 94, "rank": 3},
    {"grid_id": "다사 081 024", "type": "field", "lon": 126.8330461405, "lat": 37.2055296073, "emd_name": "남양읍", "score": 92, "rank": 4},
    {"grid_id": "다사 093 010", "type": "field", "lon": 126.8975756977, "lat": 37.1450934904, "emd_name": "팔탄면", "score": 90, "rank": 5},
    {"grid_id": "다바 104 199", "type": "field", "lon": 126.9632758382, "lat": 37.0971509626, "emd_name": "양감면", "score": 88, "rank": 6},
    {"grid_id": "다사 058 009", "type": "field", "lon": 126.7045400119, "lat": 37.1407015038, "emd_name": "서신면", "score": 86, "rank": 7},
    {"grid_id": "다바 069 199", "type": "paddy", "lon": 126.7670473588, "lat": 37.0940171259, "emd_name": "우정읍", "score": 84, "rank": 8},
    {"grid_id": "다바 072 198", "type": "field", "lon": 126.7817190742, "lat": 37.0905314053, "emd_name": "우정읍", "score": 82, "rank": 9},
    {"grid_id": "다사 077 037", "type": "paddy", "lon": 126.8065619045, "lat": 37.2673704421, "emd_name": "남양읍", "score": 80, "rank": 10},
    {"grid_id": "다사 061 012", "type": "orchard", "lon": 126.717514763, "lat": 37.1503736314, "emd_name": "서신면", "score": 78, "rank": 11},
    {"grid_id": "다바 098 193", "type": "field", "lon": 126.9268000273, "lat": 37.067947549, "emd_name": "양감면", "score": 76, "rank": 12},
    {"grid_id": "다바 072 195", "type": "paddy", "lon": 126.7825203859, "lat": 37.0742780824, "emd_name": "우정읍", "score": 74, "rank": 13},
    {"grid_id": "다사 081 004", "type": "field", "lon": 126.831013867, "lat": 37.1178643721, "emd_name": "장안면", "score": 72, "rank": 14},
    {"grid_id": "다사 077 025", "type": "field", "lon": 126.8102281181, "lat": 37.2124135579, "emd_name": "남양읍", "score": 70, "rank": 15},
    {"grid_id": "다사 105 000", "type": "field", "lon": 126.9683119232, "lat": 37.0978828377, "emd_name": "양감면", "score": 68, "rank": 16},
    {"grid_id": "다사 054 017", "type": "field", "lon": 126.6819780456, "lat": 37.1758743336, "emd_name": "서신면", "score": 66, "rank": 17},
    {"grid_id": "다사 089 007", "type": "field", "lon": 126.8791068725, "lat": 37.1308856409, "emd_name": "팔탄면", "score": 64, "rank": 18},
    {"grid_id": "다바 079 190", "type": "field", "lon": 126.8228728867, "lat": 37.0548841408, "emd_name": "장안면", "score": 62, "rank": 19},
    {"grid_id": "다사 085 006", "type": "field", "lon": 126.8554985044, "lat": 37.1273714982, "emd_name": "팔탄면", "score": 60, "rank": 20},
]


def to_lonlat(x, y):
    lon, lat = TF.transform(x, y)
    return float(lon), float(lat)


def build_graph(gdfs, snap=SNAP):
    Gr = nx.Graph()
    for tag, gdf in gdfs:
        for idx, row in gdf.iterrows():
            geom = row.geometry
            if geom is None or geom.is_empty:
                continue
            parts = geom.geoms if geom.geom_type == "MultiLineString" else [geom]
            for p in parts:
                cs = list(p.coords)
                a = (round(cs[0][0] / snap) * snap, round(cs[0][1] / snap) * snap)
                b = (round(cs[-1][0] / snap) * snap, round(cs[-1][1] / snap) * snap)
                if a == b:
                    continue
                L = float(p.length)
                if Gr.has_edge(a, b) and Gr[a][b]["length"] <= L:
                    continue
                minutes = None
                if tag == "trail":
                    m = row.get("PMNTN_UPPL")
                    try:
                        m = float(m)
                    except (TypeError, ValueError):
                        m = 0
                    minutes = m if m > 0 else L / 1000 / 4.0 * 60
                else:
                    minutes = L / 1000 / 4.0 * 60
                # 경로 복원용 좌표 (5179)
                Gr.add_edge(
                    a,
                    b,
                    length=L,
                    minutes=float(minutes),
                    src=tag,
                    coords=[(float(x), float(y)) for x, y in cs],
                )
    return Gr


def lines_to_geojson(gdf, kind: str):
    feats = []
    simp = gdf.geometry.simplify(SIMPLIFY, preserve_topology=True)
    g2 = gdf.copy()
    g2 = g2.set_geometry(simp).to_crs(4326)
    for _, row in g2.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue
        props = {"kind": kind}
        if kind == "trail":
            props["up_min"] = float(row["PMNTN_UPPL"]) if row.get("PMNTN_UPPL") == row.get("PMNTN_UPPL") else None
            props["down_min"] = float(row["PMNTN_GODN"]) if row.get("PMNTN_GODN") == row.get("PMNTN_GODN") else None
        feats.append({"type": "Feature", "properties": props, "geometry": mapping(geom)})
    return {"type": "FeatureCollection", "features": feats}


def nearest_node(Gr, x, y):
    best, best_d = None, 1e18
    for n in Gr.nodes:
        d = (n[0] - x) ** 2 + (n[1] - y) ** 2
        if d < best_d:
            best, best_d = n, d
    return best, float(np.sqrt(best_d))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    print("로드…")
    tr = gpd.read_file(TRAIL, encoding="cp949")
    fo = gpd.read_file(FOREST, encoding="cp949")
    hs_box = box(*fo.total_bounds)
    rd = gpd.read_file(ROAD_ALL, encoding="cp949")
    rd = rd.to_crs(tr.crs) if rd.crs != tr.crs else rd
    rd_hs = rd[rd.intersects(hs_box)].copy()
    print(f"등산로 {len(tr)}  임도(화성) {len(rd_hs)}")

    # GeoJSON
    trails_gj = lines_to_geojson(tr, "trail")
    roads_gj = lines_to_geojson(rd_hs, "road")
    (OUT / "route_dev_trails.geojson").write_text(
        json.dumps(trails_gj, ensure_ascii=False), encoding="utf-8"
    )
    (OUT / "route_dev_roads.geojson").write_text(
        json.dumps(roads_gj, ensure_ascii=False), encoding="utf-8"
    )
    print(f"GeoJSON trails={len(trails_gj['features'])} roads={len(roads_gj['features'])}")

    # Graph
    Gr = build_graph([("trail", tr), ("road", rd_hs)], snap=SNAP)
    comps = list(nx.connected_components(Gr))
    node_comp = {}
    for i, c in enumerate(comps):
        for n in c:
            node_comp[n] = i

    nodes = []
    node_index = {}
    for i, n in enumerate(Gr.nodes):
        lon, lat = to_lonlat(n[0], n[1])
        node_index[n] = i
        nodes.append(
            {
                "i": i,
                "x": n[0],
                "y": n[1],
                "lon": lon,
                "lat": lat,
                "comp": int(node_comp[n]),
            }
        )

    edges = []
    for a, b, d in Gr.edges(data=True):
        coords_ll = [to_lonlat(x, y) for x, y in d.get("coords", [a, b])]
        edges.append(
            {
                "u": node_index[a],
                "v": node_index[b],
                "minutes": round(float(d["minutes"]), 3),
                "length_m": round(float(d["length"]), 1),
                "src": d["src"],
                "coords": [[round(lon, 6), round(lat, 6)] for lon, lat in coords_ll],
            }
        )

    # 격자 스냅 (WGS84 → 5179)
    tf_in = Transformer.from_crs(4326, 5179, always_xy=True)
    snaps = []
    for g in GRIDS:
        x, y = tf_in.transform(g["lon"], g["lat"])
        nn, dist = nearest_node(Gr, x, y)
        lon, lat = to_lonlat(nn[0], nn[1])
        snaps.append(
            {
                **g,
                "snap_node": node_index[nn],
                "snap_comp": int(node_comp[nn]),
                "snap_dist_m": round(dist, 1),
                "snap_lon": lon,
                "snap_lat": lat,
                "dangerLevel": "위험도 높음",
            }
        )

    net = {
        "meta": {
            "crs_graph": "EPSG:5179",
            "snap_m": SNAP,
            "n_nodes": len(nodes),
            "n_edges": len(edges),
            "n_components": len(comps),
            "trail_km": round(tr.geometry.length.sum() / 1000, 2),
            "road_km": round(rd_hs.geometry.length.sum() / 1000, 2),
            "model": "2-layer: same-comp trail/road minutes; cross-comp vehicle 30km/h +6min",
        },
        "nodes": nodes,
        "edges": edges,
        "grids": snaps,
    }
    (OUT / "route_dev_network.json").write_text(
        json.dumps(net, ensure_ascii=False), encoding="utf-8"
    )
    print(
        f"network nodes={len(nodes)} edges={len(edges)} comps={len(comps)} grids={len(snaps)}"
    )
    print(f"→ {OUT}")


if __name__ == "__main__":
    main()
