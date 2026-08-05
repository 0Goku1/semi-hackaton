# -*- coding: utf-8 -*-
"""
500m 격자 확정에 따른 전체 지표 재계산.

격자 해상도를 500m(국가지점번호 체계)로 통일하기로 결정했으므로,
100m 기준으로 산출했던 문서 수치를 전부 다시 계산한다.
이 스크립트 출력이 docs/FIRE_RISK_PREPROCESSING.md, docs/FEATURE_SCHEMA.md의 유일한 근거다.

출력 항목
  A. 유효 셀 수 (임상도 / 입지토양도 / 양쪽 교집합)
  B. 격자당 산림 점유율 분포
  C. 근접도 — 등산로 vs 임도, 임계값별 셀 비율 및 상관
  D. 수종 혼합도 (전수)
  E. 정적 피처 면적가중 집계 (경사·방위·고도·침엽수비율·영급·수고)
  F. 결측률
  G. 테이블 규모
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from pathlib import Path
import numpy as np
import pandas as pd
import geopandas as gpd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import grid as G

DATA = Path(r"d:\Workspace\semi-hackaton\data")
IM = DATA / "임상도(1대5000)_화성시" / "TB_FGDI_FS_IM5000_41590.shp"
IJ = DATA / "산림입지토양도(1대5000)_화성시" / "TB_FGDI_FS_IJ5000_PG_41590.shp"
TRAIL = DATA / "등산로_화성시" / "TB_FGDI_WG_MT_WAY_41590.shp"
ROAD = DATA / "임도망도(산길)_전국" / "TB_FGDI_FS_ID300_ALL.shp"

RES = G.GRID_RES  # 프로젝트 전역 해상도 (500m)
CELL_AREA = RES * RES

pd.set_option("display.width", 200)


def hdr(t):
    print("\n" + "=" * 90)
    print(f"### {t}")
    print("=" * 90)


def wmean(df, col, wcol="a"):
    """면적가중 평균 (결측 제외)"""
    d = df[[col, wcol]].dropna()
    return np.nan if d.empty else np.average(d[col], weights=d[wcol])


def wmode(df, col, wcol="a"):
    """면적가중 최빈값"""
    d = df[[col, wcol]].dropna()
    return np.nan if d.empty else d.groupby(col)[wcol].sum().idxmax()


hdr("로드")
im = gpd.read_file(IM, encoding="cp949")
ij = gpd.read_file(IJ, encoding="cp949")
tr = gpd.read_file(TRAIL, encoding="cp949")[["geometry"]]
rd = gpd.read_file(ROAD, encoding="cp949")[["geometry"]]
if rd.crs != im.crs:
    rd = rd.to_crs(im.crs)

im = im[im.geometry.notna() & ~im.geometry.is_empty]
ij = ij[ij.geometry.notna() & ~ij.geometry.is_empty]
print(f"임상도    {len(im):,}폴리곤  {im.area.sum()/1e6:.1f} km²")
print(f"입지토양도 {len(ij):,}폴리곤  {ij.area.sum()/1e6:.1f} km²")
print(f"등산로     {len(tr):,}구간   {tr.length.sum()/1000:.1f} km")

minx, miny, maxx, maxy = im.total_bounds
from shapely.geometry import box
pad = 3000
rd = rd[rd.intersects(box(minx - pad, miny - pad, maxx + pad, maxy + pad))]
print(f"임도(화성) {len(rd):,}구간   {rd.length.sum()/1000:.1f} km")

cells = G.grid_polygons(minx, miny, maxx, maxy, res=RES)
print(f"\nextent 격자 {len(cells):,}개 (국가지점번호 {RES}m, EPSG:5179)")


hdr("A. 유효 셀 수")
ov_im = gpd.overlay(cells, im[["FRTP_CD", "KOFTR_GROU", "AGCLS_CD", "HEIGHT", "geometry"]],
                    how="intersection", keep_geom_type=True)
ov_im["a"] = ov_im.area
ov_ij = gpd.overlay(cells, ij[["LOCTN_GRDN", "EIGHT_AGL", "LOCTN_ALTT", "geometry"]],
                    how="intersection", keep_geom_type=True)
ov_ij["a"] = ov_ij.area

cell_im = set(ov_im["grid_id"])
cell_ij = set(ov_ij["grid_id"])
both = cell_im & cell_ij
print(f"임상도가 걸치는 셀      {len(cell_im):,}개")
print(f"입지토양도가 걸치는 셀   {len(cell_ij):,}개")
print(f"양 레이어 모두 있는 셀   {len(both):,}개  ← 학습·추론 대상")
print(f"임상도만 있는 셀        {len(cell_im - cell_ij):,}개")
print(f"입지토양도만 있는 셀     {len(cell_ij - cell_im):,}개")

# 산림 점유율 문턱을 걸어 '학습 대상 셀'을 정의한다.
# 점유율 하한이 없으면 산림이 0.1%만 걸친 셀까지 들어와 라벨 대비 노이즈가 된다.
_fa = ov_im.groupby("grid_id")["a"].sum() / CELL_AREA
print(f"\n{'산림 점유율 하한':>16}{'셀 수':>9}{'포함 산림면적':>15}{'면적 비중':>10}")
_tot = ov_im["a"].sum()
for thr in (0.0, 0.05, 0.10, 0.25, 0.50):
    ids = set(_fa[_fa >= thr].index) & both
    area = ov_im[ov_im["grid_id"].isin(ids)]["a"].sum()
    print(f"{f'{thr:.0%} 이상':>16}{len(ids):>9,}{area/1e6:>13.1f} km²{area/_tot:>10.1%}")
print("→ 10% 하한이면 셀 수를 크게 줄이면서 산림면적은 대부분 보존")


hdr("B. 격자당 산림 점유율 분포")
fa = ov_im.groupby("grid_id")["a"].sum().rename("forest_a").reset_index()
fa["ratio"] = fa["forest_a"] / CELL_AREA
tot_a = fa["forest_a"].sum()
print(f"산림 총면적 {tot_a/1e6:.1f} km² / 격자 총면적 {len(fa)*CELL_AREA/1e6:.1f} km² "
      f"= 평균 점유율 {tot_a/(len(fa)*CELL_AREA):.1%}")
bins = [0, .05, .10, .25, .50, .75, 1.01]
labs = ["0~5%", "5~10%", "10~25%", "25~50%", "50~75%", "75~100%"]
fa["bin"] = pd.cut(fa["ratio"], bins, labels=labs, right=False)
t = fa.groupby("bin", observed=True).agg(셀수=("grid_id", "size"), 면적_km2=("forest_a", lambda s: s.sum()/1e6))
t["셀_비중%"] = (t["셀수"] / len(fa) * 100).round(1)
t["면적_비중%"] = (t["면적_km2"] / (tot_a/1e6) * 100).round(1)
t["면적_km2"] = t["면적_km2"].round(1)
print(t.to_string())


hdr("C. 근접도 — 등산로 vs 임도")
fc = cells[cells["grid_id"].isin(fa["grid_id"])].merge(fa[["grid_id", "ratio"]], on="grid_id")
tr_u, rd_u = tr.geometry.union_all(), rd.geometry.union_all()
fc["d_trail"] = fc.geometry.distance(tr_u)
fc["d_road"] = fc.geometry.distance(rd_u)
print(f"대상 셀 {len(fc):,}개 (격자 경계 기준 거리, 0이면 격자 관통)\n")
print(pd.DataFrame({
    "등산로(m)": fc["d_trail"].describe(percentiles=[.25, .5, .75, .9]),
    "임도(m)": fc["d_road"].describe(percentiles=[.25, .5, .75, .9]),
}).round(0).to_string())

print(f"\n{'임계값':>8}{'등산로 이내':>12}{'임도 이내':>11}")
for thr in (0, 100, 250, 500, 1000, 2000, 5000):
    lab = "관통(0m)" if thr == 0 else f"{thr}m"
    print(f"{lab:>8}{(fc['d_trail']<=thr).mean():>11.1%}{(fc['d_road']<=thr).mean():>11.1%}")
print(f"\n두 근접도 상관계수 (Pearson): {fc['d_trail'].corr(fc['d_road']):.3f}")
print("→ 상관이 낮으면 임도를 등산로로 교체하는 것은 정보 손실이 아니라 대체 불가한 개선")


hdr("D. 수종 혼합도 (전수)")
g = ov_im.groupby("grid_id")
nsp = g["KOFTR_GROU"].nunique()
print(f"셀 내 수종 수: 중앙 {nsp.median():.0f}종, 평균 {nsp.mean():.1f}종, 최대 {nsp.max()}종")
print(f"2종 이상 섞인 셀: {(nsp>=2).mean():.1%}   (단일 수종 셀 {(nsp==1).mean():.1%})")
share = ov_im.groupby(["grid_id", "KOFTR_GROU"])["a"].sum().groupby("grid_id").apply(
    lambda s: s.max() / s.sum())
print(f"최빈 수종 면적 점유율: 중앙 {share.median():.1%}, 하위25% {share.quantile(.25):.1%}")
print(f"최빈 수종이 면적 50% 미만인 셀: {(share<0.5).mean():.1%}")

frtp = ov_im.groupby(["grid_id", "FRTP_CD"])["a"].sum().groupby("grid_id").apply(
    lambda s: s.max() / s.sum())
print(f"\n침/활/혼 대분류 기준으로도 최빈 점유율 중앙 {frtp.median():.1%}, "
      f"2개 이상 섞인 셀 {(ov_im.groupby('grid_id')['FRTP_CD'].nunique()>=2).mean():.1%}")


hdr("E. 정적 피처 면적가중 집계 (500m 셀 단위)")
# 침엽수 비율 — FRTP_CD 1=침엽수
ov_im["FRTP_CD"] = pd.to_numeric(ov_im["FRTP_CD"], errors="coerce")
conif = ov_im[ov_im["FRTP_CD"] == 1].groupby("grid_id")["a"].sum()
allf = ov_im.groupby("grid_id")["a"].sum()
cr = (conif.reindex(allf.index).fillna(0) / allf).rename("conifer_ratio")
print(f"conifer_ratio: 평균 {cr.mean():.3f}, 중앙 {cr.median():.3f}, "
      f"0인 셀 {(cr==0).mean():.1%}, 0.5 이상 셀 {(cr>=0.5).mean():.1%}")
print(f"  화성 전체 침엽수 면적 비율: {conif.sum()/allf.sum():.1%}")

for col, name, unit in (("LOCTN_GRDN", "경사도", "°"), ("LOCTN_ALTT", "고도", "m")):
    ov_ij[col] = pd.to_numeric(ov_ij[col], errors="coerce")
    s = ov_ij.groupby("grid_id").apply(lambda d: wmean(d, col), include_groups=False).dropna()
    print(f"\n{name} 셀 면적가중 평균 ({unit}): n={len(s):,}, "
          f"중앙 {s.median():.1f}, 사분위 {s.quantile(.25):.1f}~{s.quantile(.75):.1f}, "
          f"표준편차 {s.std():.3f}, 최대 {s.max():.1f}")

# 사면방위 — EIGHT_AGL은 8방위 코드가 아니라 연속 각도(도). -1은 결측(평탄지)
ov_ij["EIGHT_AGL"] = pd.to_numeric(ov_ij["EIGHT_AGL"], errors="coerce")
va = ov_ij[(ov_ij["EIGHT_AGL"] >= 0) & (ov_ij["EIGHT_AGL"] <= 360)].copy()
print(f"\nEIGHT_AGL: 연속 각도(0~360°), 고유값 {ov_ij['EIGHT_AGL'].nunique():,}개, "
      f"-1(평탄/결측) {(ov_ij['EIGHT_AGL'] < 0).mean():.1%}")
print("→ 코드가 아니므로 최빈값이 아니라 sin/cos 면적가중 평균으로 집계해야 한다")

rad = np.deg2rad(va["EIGHT_AGL"].values)
va["sin"], va["cos"] = np.sin(rad), np.cos(rad)
gg = va.groupby("grid_id")
asp = pd.DataFrame({
    "aspect_sin": gg.apply(lambda d: np.average(d["sin"], weights=d["a"]), include_groups=False),
    "aspect_cos": gg.apply(lambda d: np.average(d["cos"], weights=d["a"]), include_groups=False),
})
asp["deg"] = (np.degrees(np.arctan2(asp["aspect_sin"], asp["aspect_cos"])) + 360) % 360
asp["R"] = np.hypot(asp["aspect_sin"], asp["aspect_cos"])  # 방위 집중도 0~1
print(f"aspect_sin 범위 {asp['aspect_sin'].min():.2f}~{asp['aspect_sin'].max():.2f}, "
      f"aspect_cos 범위 {asp['aspect_cos'].min():.2f}~{asp['aspect_cos'].max():.2f}  (n={len(asp):,})")
print(f"방위 집중도 R: 중앙 {asp['R'].median():.2f} "
      f"(1이면 셀 전체가 한 방향, 0이면 방위가 상쇄되어 사실상 평탄)")

edges = [0, 22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5, 360.1]
names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N "]
asp["dir8"] = pd.cut(asp["deg"], edges, labels=names, right=False)
vc = asp["dir8"].value_counts(normalize=True)
vc = vc.groupby(vc.index.astype(str).str.strip(), observed=True).sum().reindex(
    ["N", "NE", "E", "SE", "S", "SW", "W", "NW"])
print("\n셀 면적가중 합성 사면방위 8방위 분포(%)")
print((vc * 100).round(1).to_string())
south = vc.reindex(["SE", "S", "SW"]).sum()
print(f"남향계(SE+S+SW) 합계: {south:.1%}")

for col, name in (("AGCLS_CD", "영급"), ("HEIGHT", "수고(m)")):
    ov_im[col] = pd.to_numeric(ov_im[col], errors="coerce")
    s = ov_im.groupby("grid_id").apply(lambda d: wmean(d, col), include_groups=False).dropna()
    print(f"\n{name} 면적가중 평균: n={len(s):,}, 중앙 {s.median():.1f}, "
          f"사분위 {s.quantile(.25):.1f}~{s.quantile(.75):.1f}")


hdr("F. 결측률 (원본 폴리곤 기준)")
for gdf, name, cols in ((im, "임상도", ["FRTP_CD", "KOFTR_GROU", "AGCLS_CD", "HEIGHT"]),
                        (ij, "입지토양도", ["LOCTN_GRDN", "EIGHT_AGL", "LOCTN_ALTT"])):
    print(f"\n[{name}]")
    for c in cols:
        s = pd.to_numeric(gdf[c], errors="coerce")
        neg = (s < 0).mean()
        print(f"  {c:>12}: null {s.isna().mean():>6.1%}, 음수(-99 등) {neg:>6.1%}, "
              f"고유값 {s.nunique():>5}")


hdr("G. 테이블 규모")
n = len(both)
print(f"grid_static     : {n:,}행 (1회 구축)")
print(f"weather_hourly  : 관측소 수 × 8,760행/년 (격자와 무관)")
print(f"학습 행렬(1년,시간): {n:,} × 8,760 = {n*8760:,}행")
print(f"단일 테이블로 합쳤을 때와 동일하지만, 정적 피처 반복 저장은 회피")
print(f"\n실시간 추론 1회 대상: {n:,}행 (현재 시각 한 단면)")
print(f"\n[참고] 100m 격자였다면: 16,141행 × 8,760 = {16141*8760:,}행 "
      f"({16141*8760/(n*8760):.1f}배)")
