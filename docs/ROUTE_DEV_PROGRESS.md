# 동선 레이어 · 순찰 배정 — 개발 진행 상황

마지막 갱신: 2026-08-12

---

## 한 줄 요약

위험격자 JSON + 가용 요원 → **TOP + OR-Tools** 배정 → 차량(카카오/OSRM) + 도보(등산로·임도) 경로 → 순찰 체크(완료 풀 제외) → 일괄 보고서.  
위험등급 점수 레이어는 **JSON만 교체**하면 동선 파트와 독립.

---

## Not Found 이슈 (즉시 실행)

| 원인 | 설명 |
|------|------|
| EC2에 `/patrol/*` 미배포 | 구 서버엔 회원 API만 있음 → **404** |
| 로컬/EC2 URL 혼선 | `secrets.js`의 `API_BASE_URL`을 **EC2로 통일**: `http://13.209.67.39:8000` |

배포 파일·절차: **`docs/EC2_DEPLOY.md` §7**

프론트 요원 UI: 스크롤·필터·이름 추가·삭제 가능 (`route-dev.html` 요원 시트).

---

## 코드 경로 맵

### 입력 · 상태 JSON
| 경로 | 역할 |
|------|------|
| `data/processed/risk_grids.json` | 위험격자 `[{grid_id, score}, …]` **갈아끼우기 정본** |
| `data/processed/risk_grids.example.json` | 스키마 예시 |
| `data/processed/officers.json` | 요원 가용/비가용 · `is_me` |
| `data/processed/patrol_pool_state.json` | 순찰 완료 격자 풀 · in_progress |
| `route-dev-data/route_dev_network.json` | 등산로·임도 가중 그래프 캐시 |

### 서버 (배정 엔진)
| 경로 | 역할 |
|------|------|
| `server/patrol_core.py` | TOP+OR-Tools · 2계층 비용 · 차량/도보 geometry |
| `server/main.py` | `/patrol/*` REST |
| `server/.env` | `KAKAO_REST_KEY`, CORS 등 (gitignore) |
| `server/requirements.txt` | ortools, networkx, … |
| `docs/PATROL_ASSIGN_API.md` | API 사용법 |

### 프론트
| 경로 | 역할 |
|------|------|
| `route-dev.html` + `js/route-dev.js` | 격자 지도 · 요원 토글 · 동선 찾기 · 순찰 시작 |
| `js/patrolApi.js` | API 클라이언트 |
| `patrol-run.html` + `js/patrol-run.js` | 격자 체크 · 완료 풀 반영 · 보고서 이동 |
| `patrol-report.html` + `js/report.js` | 일괄 보고서 |
| `js/secrets.js` | `API_BASE_URL`, `KAKAO_JS_KEY`, `KAKAO_REST_KEY`(참고) |
| `css/route-dev.css`, `css/patrol-run.css` | DEV/순찰 UI |

### 설계 · 분석 (근거)
| 경로 | 역할 |
|------|------|
| `docs/PATROL_ROUTE_OPTIMIZATION.md` | TOP·2계층·OR-Tools 설계 |
| `analysis/09_network.py` | 네트워크 실측 |
| `analysis/10_solver_bench.py` | 솔버 벤치 |
| `analysis/14_export_route_dev_assets.py` | 네트워크 GeoJSON export |
| `src/grid.py` | 국가지점번호 500m |

### 메인 앱 (아직 미이식)
| 경로 | 상태 |
|------|------|
| `index.html` + `js/app.js` + `js/patrolRoute.js` | **구 정적 동선** 유지. DEV 검증 후 이식 예정 |

---

## 배정 배타성 (Q4)

**초기 배정:** OR-Tools Routing은 격자(고객) 노드를 **차량(요원) 1명만** 방문.  
스모크: 20격자 → 6명 배분, `len(ids)==len(set(ids))` → **중복 없음**.

**순찰 중 체크:** `POST /patrol/complete-stop` → `patrol_pool_state.json`의 `completed_grid_ids`에 추가 → 이후 `/patrol/assign` 후보에서 **제외**.  
다른 요원의 “이미 배정된 미완료 격자”는 솔버가 한 번에 나눠 가지므로 겹치지 않음.  
체크마다 전원 자동 재TOP은 하지 않음 → **다시 배정** 버튼으로 재계산.

---

## 경로 모드 (지도 색)

| 색 | mode | 의미 |
|----|------|------|
| 파랑 | `vehicle` | 산 사이 차량 (카카오 REST → 없으면 OSRM driving) |
| 초록 | `trail` | 같은 컴포넌트 등산로·임도 |
| 주황 점선 | `access` | 망 스냅 → 격자 중심 (비안내 접근) |

`access_type`: `enter` / `near` / `remote` (UI 분기는 추후)

---

## 현재 상황 재정리 (체크리스트)

### 완료
- [x] 위험격자 JSON 스키마 · 파일 교체만으로 입력
- [x] 요원 가용/비가용 · 총원 파악 (`officers.json` + UI)
- [x] TOP + OR-Tools 서버 배정
- [x] 등산로·임도 네트워크 기반 도보 구간
- [x] 차량 구간 (카카오 REST / OSRM fallback)
- [x] 요원 간 격자 **중복 배정 없음**
- [x] 순찰 체크 → 완료 풀 → 재배정 시 후보 제외
- [x] 전 구역 확인 후 일괄 보고서 흐름
- [x] route-dev / patrol-run DEV UI

### 진행 중 / 주의
- [ ] **로컬 또는 EC2에 신규 `/patrol/*` 배포·기동** (미기동 시 Not Found)
- [ ] `KAKAO_REST_KEY` 서버 `.env` 반영 후 차량 경로 품질 확인
- [ ] 등산로·임도 단절(24 컴포넌트) · 접속점 0 — 데이터 보완 예정(의도적 skip)
- [ ] 근접/원격 감시 UX (필드만 존재)
- [ ] 체크 시 **즉시 전역 재TOP** (현재는 풀 제외 + 수동 재배정)
- [ ] `index.html` 메인 동선 찾기에 DEV 파이프라인 이식

### 의도적 비범위
- 위험 score 산출 ML/기상 레이어 (타 파트 JSON 공급)
- 근무 출퇴근 실시스템 연동 (지금은 officers.json 토글)

---

## API 요약

| Method | Path | 설명 |
|--------|------|------|
| GET | `/patrol/risk-grids` | 위험 격자 |
| PUT | `/patrol/risk-grids` | JSON 교체 |
| GET/PATCH | `/patrol/officers` | 요원 |
| POST | `/patrol/assign` | TOP 배정 + geometry |
| POST | `/patrol/complete-stop` | 1격자 완료 |
| POST | `/patrol/complete-all` | 일괄 완료 |
| POST | `/patrol/pool/reset` | 풀 초기화 |

상세: `docs/PATROL_ASSIGN_API.md`
