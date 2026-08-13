# 원본 공간데이터

이 폴더의 shapefile은 **git에 올리지 않습니다.** 총 243MB이고 단일 파일 최대 96MB로 GitHub 권장 한도(50MB)를 넘습니다. 아래 목록대로 각자 내려받아 같은 경로에 두면 `analysis/`, `src/` 스크립트가 그대로 동작합니다.

취득처: 산림청 **산림공간정보서비스** (https://map.forest.go.kr) — 회원가입 후 자료신청·다운로드
`41590` = 화성시 법정동코드

## 파일 목록

| 폴더 | 파일 | 크기 |
|------|------|------|
| `등산로_전국/` | `TB_FGDI_WG_MT_WAY_ALL.shp` (+ dbf/prj/shx) | 96.0 MB |
| `등산로_화성시/` | `TB_FGDI_WG_MT_WAY_41590.shp` (+ dbf/prj/shx) | 0.3 MB |
| `임도망도(산길)_전국/` | `TB_FGDI_FS_ID300_ALL.shp` (+ dbf/prj/shx) | 36.6 MB |
| `임도망도(산길)_전국/` | `데이터베이스설계서_FRT002601.xlsx` (컬럼 정의서) | 0.04 MB |
| `임상도(1대5000)_화성시/` | `TB_FGDI_FS_IM5000_41590.shp` (+ dbf/prj/shx) | 29.3 MB |
| `산림입지토양도(1대5000)_화성시/` | `TB_FGDI_FS_IJ5000_PG_41590.shp` (+ dbf/prj/shx) | 28.5 MB |
| *(루트)* | `HsFram.csv` | 팜맵(화성) — git 제외, 로컬 보관 |

## 팜맵 (HsFram)

- 경로: `data/HsFram.csv` (Downloads가 아니라 **이 경로를 정본**으로 씀)
- 변환: `python analysis/13_hsfram_to_grid.py` → `data/processed/hsfram_parcel_contacts.csv` 등
- 대용량이라 gitignore 대상일 수 있음. 팀원은 동일 파일명을 `data/`에 두면 됨.

## 읽을 때 주의사항

- **인코딩**: 속성 테이블이 `cp949`입니다. `gpd.read_file(path, encoding="cp949")`로 읽어야 한글 컬럼값이 깨지지 않습니다.
- **좌표계**: `geometry`는 전부 **EPSG:5179 (UTM-K)** 입니다.
- **`ARA_XCRD` / `ARA_YCRD` 컬럼은 쓰지 마세요.** 산림입지토양도의 이 두 컬럼은 `geometry`와 다른 **EPSG:5181 (Korea 2000 중부원점)** 값이 들어 있습니다. 같은 좌표계로 착각하면 약 100km 오차가 발생합니다. 위치가 필요하면 `geometry`에서 뽑으세요.
- **결측 표기**: 임상도·입지토양도에 `-99` 센티널이 섞여 있습니다. 0으로 채우면 라벨과 반대 방향으로 학습됩니다.

## 사용처

| 데이터 | 용도 | 소비 스크립트 |
|--------|------|---------------|
| 임상도, 산림입지토양도 | 산불 위험도 예측 (정적 피처) | `analysis/05_fusion_check.py`, `06_schema_check.py`, `08_grid500_check.py` |
| 등산로, 임도망도 | 순찰 동선 최적화 (이동 네트워크) | `analysis/09_network.py` |

분석 결론은 `docs/FIRE_RISK_PREPROCESSING.md`, `docs/PATROL_ROUTE_OPTIMIZATION.md`에 정리되어 있습니다.
