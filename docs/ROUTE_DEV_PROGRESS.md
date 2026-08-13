# 동선 레이어 · 순찰 배정 — 팀 / AI 핸드오프

> **이 문서의 목적**  
> 특정 개인 메모가 아니라, **언제 어디서든 AI 어시스턴트·팀원이** 현재 진행·백엔드 상태·함정을 바로 이어받을 수 있게 하는 정본이다.  
> 새 세션/다른 사람 AI에게 넘길 때 **이 파일부터** 읽히면 된다.
>
> 관련 상세: API `docs/PATROL_ASSIGN_API.md` · 설계 `docs/PATROL_ROUTE_OPTIMIZATION.md` · EC2 기초 `docs/EC2_DEPLOY.md`  
> 마지막 갱신: **2026-08-13**

---

## 0. 프로젝트·역할 맥락 (30초)

| 항목 | 내용 |
|------|------|
| 제품 | 화성시 산불 지킴이 (팀명 정양이 / 코리요 계열) |
| 격자 | 국가지점번호 **EPSG:5179**, `GRID_RES = 500` (`src/grid.py`) |
| 전략 | 산–사람 접촉 × 기상 → 위험격자 → **순찰 우선순위·동선** (ML 화재예측이 1순위 아님) |
| 이 문서 담당 범위 | **route-dev / TOP+OR-Tools 배정 / 순찰 체크·보고 / EC2 `/patrol/*`** |
| 메인 앱 | `index.html` 동선은 아직 **구 정적 로직**. DEV(`route-dev.html`) 검증 후 이식 예정 |

---

## 1. 한 줄 현황 (2026-08-13)

위험격자 JSON + 가용 요원 → **TOP + OR-Tools** → 차량(카카오/OSRM) + 도보(등산로·임도) → 순찰 체크(완료 풀) → 일괄 보고 **파이프라인은 구현·EC2 기동까지 완료**.

「내 동선 0격자」는 **원거리 GPS가 is_me 시작점을 덮어쓰던 문제**로 확인 → **§6 수정 반영(2026-08-13)**. EC2에 `server/main.py` + `js/route-dev.js` 재배포·하드 리프레시 필요.

위험 score 레이어는 **`data/processed/risk_grids.json`만 교체**하면 동선 파트와 독립.

---

## 2. 백엔드 · EC2 상태 (운영 사실)

| 항목 | 값 / 상태 |
|------|-----------|
| EC2 API | `http://13.209.67.39:8000` |
| 코드 트리 (EC2) | `~/semi-hackaton/` (`server/`, `data/`, `route-dev-data/`) |
| 프로세스 | tmux 세션명 **`fire_api`**, `uvicorn main:app --host 0.0.0.0 --port 8000` |
| venv | `~/semi-hackaton/venv` |
| 프론트 API 베이스 | `js/secrets.js` → `API_BASE_URL: "http://13.209.67.39:8000"` |
| 회원/보고 DB | EC2 PostgreSQL (`users`, `patrol_reports`) — 배정 JSON과는 별개 |
| 배정 상태 | **파일 JSON** (`data/processed/*.json`), DB 아님 |

### 기동 절차 (팀이 쓰는 메모 — 정상)

```bash
cd ~/semi-hackaton/server
source ~/semi-hackaton/venv/bin/activate
tmux kill-session -t fire_api 2>/dev/null
tmux new-session -d -s fire_api
tmux send-keys -t fire_api "cd ~/semi-hackaton/server" C-m
tmux send-keys -t fire_api "source ~/semi-hackaton/venv/bin/activate" C-m
tmux send-keys -t fire_api "uvicorn main:app --host 0.0.0.0 --port 8000" C-m
# 확인
sleep 2
tmux capture-pane -pt fire_api -S -30
curl -s http://127.0.0.1:8000/patrol/risk-grids | head -c 200; echo
```

- tmux `send-keys`를 한 줄(`&&`)로 합쳐도 **동일 목적**. 여러 줄이 읽기·디버깅에 유리.
- attach: `tmux attach -t fire_api` / 나올 때 `Ctrl+b` → `d` (`Ctrl+C`는 서버 종료).

### EC2는 GUI가 없다

SSH 기본은 **터미널만**. `ls` / `cat` / `curl`로 확인.  
로컬에서 파일을 보려면 **WinSCP / VS Code Remote-SSH / scp**.

### 배포 시 꼭 알아야 할 함정

1. **브랜치 푸시**  
   - 작업 커밋이 `feature/grid500-analysis-docs`에 있는데 `git push origin temp`만 하면 **로컬 `temp`만** 올라감 → `Everything up-to-date`인데 EC2엔 `patrol_core` 없음.  
   - EC2가 `temp`를 pull한다면:  
     `git push origin HEAD:temp`  
     또는 feature를 push 후 EC2에서 그 브랜치 checkout.

2. **gitignore 데이터** (`.gitignore`: `data/*`)  
   - pull만으로는 안 옴. **scp/WinSCP로 별도 업로드** 필요:  
     - `data/processed/risk_grids.json`  
     - `data/processed/officers.json`  
     - `data/processed/patrol_pool_state.json`  
   - `route-dev-data/route_dev_network.json` 은 git 추적됨 (pull에 포함되는 것이 정상).

3. **PowerShell**  
   - `$HOST`는 예약 변수 → `$EC2` 등 다른 이름 사용.

4. **경로 기대값** (`server/main.py`, `patrol_core.py`)  
   - 기본 루트 = `server/`의 상위 (= `~/semi-hackaton`).  
   - `DATA_ROOT` env로 덮어쓰기 가능.  
   - 네트워크 후보: `route-dev-data/route_dev_network.json` → `data/processed/...` → `server/data/...`.

5. **의존성**  
   - 배정 엔진: `ortools`, `networkx`, `numpy`, `pyproj` 등 (`server/requirements.txt`).  
   - `/docs`에 `/patrol/assign` 없으면 **옛 main.py** (데이터 문제가 아님).

### 헬스체크

| 확인 | 기대 |
|------|------|
| `http://13.209.67.39:8000/docs` | `/patrol/assign`, `/patrol/risk-grids`, `/patrol/officers` |
| `GET /patrol/risk-grids` | grids JSON |
| 프론트 `route-dev.html` 동선 찾기 | Not Found 없이 OR-Tools 요약 문구 |

---

## 3. 코드 · 데이터 경로 맵

### 입력 · 상태 JSON
| 경로 | 역할 | git |
|------|------|-----|
| `data/processed/risk_grids.json` | 위험격자 정본 `[{grid_id, score}, …]` | **ignore** |
| `data/processed/risk_grids.example.json` | 스키마 예시 | (로컬) |
| `data/processed/officers.json` | 가용/비가용 · `is_me` · lat/lng | **ignore** |
| `data/processed/patrol_pool_state.json` | 완료 격자 · in_progress | **ignore** |
| `route-dev-data/route_dev_network.json` | 등산로·임도 그래프 캐시 | tracked |

### 서버
| 경로 | 역할 |
|------|------|
| `server/patrol_core.py` | TOP+OR-Tools · 비용행렬 · 차량/도보 geometry |
| `server/main.py` | `/patrol/*` + 기존 회원·보고 API |
| `server/.env` | `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `KAKAO_REST_KEY` |
| `server/requirements.txt` | fastapi, uvicorn, ortools, … |

### 프론트 (DEV)
| 경로 | 역할 |
|------|------|
| `route-dev.html` + `js/route-dev.js` | 격자 지도 · 요원 · 동선 찾기 · 순찰 시작 |
| `js/patrolApi.js` | API 클라이언트 |
| `patrol-run.html` + `js/patrol-run.js` | 격자 체크 → 완료 풀 |
| `patrol-report.html` + `js/report.js` | 일괄 보고서 |
| `js/secrets.js` | `API_BASE_URL`, 카카오 키 |
| `css/route-dev.css`, `css/patrol.css` 등 | UI |

### 설계·분석 근거
| 경로 | 역할 |
|------|------|
| `docs/PATROL_ROUTE_OPTIMIZATION.md` | TOP·2계층·OR-Tools |
| `analysis/14_export_route_dev_assets.py` | 네트워크 export |
| `src/grid.py` | 국가지점번호 500m |

### 메인 앱 (미이식)
| 경로 | 상태 |
|------|------|
| `index.html` + `js/app.js` + `js/patrolRoute.js` | 구 정적 동선 유지 |

---

## 4. API 요약

| Method | Path | 설명 |
|--------|------|------|
| GET | `/patrol/risk-grids` | 위험 격자 |
| PUT | `/patrol/risk-grids` | JSON 교체 |
| GET/PATCH | `/patrol/officers` | 요원 |
| POST | `/patrol/officers/add` 등 | 요원 추가·삭제 (main.py 참고) |
| POST | `/patrol/assign` | TOP 배정 + geometry |
| POST | `/patrol/complete-stop` | 1격자 완료 |
| POST | `/patrol/complete-all` | 일괄 완료 |
| POST | `/patrol/pool/reset` | 풀 초기화 |

상세 스키마·예시: **`docs/PATROL_ASSIGN_API.md`**

### 배정 배타성
- OR-Tools: 격자 노드를 차량(요원) **1명만** 방문 → 초기 배정 중복 없음.  
- 순찰 중 체크 → `completed_grid_ids` → 이후 assign 후보 제외.  
- 체크마다 자동 전역 재TOP **아님** → UI **「다시 배정」**.

### 지도 경로 색
| 색 | mode | 의미 |
|----|------|------|
| 파랑 | `vehicle` | 차량 (카카오 REST → OSRM) |
| 초록 | `trail` | 등산로·임도 |
| 주황 점선 | `access` | 망 스냅 → 격자 중심 |

`access_type`: `enter` / `near` / `remote` (필드만, UX 분기는 추후).

---

## 5. 체크리스트

### 완료
- [x] 위험격자 JSON 스키마 · 파일 교체 입력
- [x] 요원 가용/비가용 · UI(필터·추가·삭제)
- [x] TOP + OR-Tools 서버 배정
- [x] 등산로·임도 도보 · 차량 geometry
- [x] 요원 간 격자 중복 배정 없음
- [x] 순찰 체크 → 완료 풀 → 재배정 제외
- [x] 일괄 보고서 흐름 (DEV)
- [x] route-dev / patrol-run DEV UI
- [x] EC2에 `/patrol/*` 코드 배포 · uvicorn 기동 · JSON·네트워크 배치
- [x] `secrets.js` API_BASE_URL → EC2

### 진행 중 / 버그
- [x] **「내 동선 0격자 · 0분」** — 작전구역 밖 GPS 무시 (§6, 배포·확인만 남음)
- [ ] `KAKAO_REST_KEY` EC2 `.env` 반영 여부·차량 경로 품질 확인
- [ ] 등산로·임도 단절(다수 컴포넌트) · 데이터 보완 (의도적 후순위)
- [ ] 근접/원격 감시 UX
- [ ] 체크 시 즉시 전역 재TOP (현재 수동 재배정)
- [ ] `index.html` 메인에 DEV 파이프라인 이식

### 의도적 비범위
- 위험 score ML/기상 산출 (타 파트 JSON 공급)
- 근무 출퇴근 실시스템 (지금은 officers.json 토글)

---

## 6. 버그 수정: 내 동선 0격자 · 0분 (2026-08-13)

### 증상
- 하단: `내 동선 0격자 · 0분` + `전체배정 19` 등 → 엔진은 도는데 **is_me만 0**.

### 원인
`POST /patrol/assign`의 `me_lat`/`me_lng`(브라우저 GPS)가 `is_me` 요원 좌표를 덮어씀.  
개발 PC/폰이 **화성 밖**(서울 등)이면 TOP이 나에게 격자 0개, 나머지 가용 요원에 몰아줌.

### 수정
| 위치 | 내용 |
|------|------|
| `server/main.py` | bbox `lat 37.05–37.35`, `lng 126.55–127.15` **안일 때만** GPS 반영. 밖이면 `officers.json` 유지 |
| `js/route-dev.js` | 동일 theater 가드. 밖이면 배정·마커 시작점을 officers/`DEFAULT_CENTER`. 패널에 시작점 출처 힌트 |

### 배포·확인
1. 코드 push 후 EC2 `git pull` + uvicorn 재시작 (`main.py`).
2. 프론트는 로컬/정적 서빙이면 **하드 리프레시** (`route-dev.js`).
3. 동선 찾기 → `내 동선 N격자`(N>0) 또는 요약에 `시작점 officers.json(GPS 구역 밖)`.
4. 그래도 0이면 Network 탭에서 `routes[].is_me` / `stops` 확인 (별 이슈).

---

## 7. 프론트 “내” 표시와의 관계

- 지도 me 마커 기본 표시명: `route-dev.js`에서 `getDisplayUserName("정승우")` 등.  
- 배정의 `is_me`는 **`officers.json`의 `is_me: true`** 가 소스 오브 트루스.  
- 로그인 유저와 officers `is_me` 자동 동기화는 **아직 없음**.

---

## 8. 새 AI 세션 시작용 프롬프트 (복붙)

```text
docs/ROUTE_DEV_PROGRESS.md 를 읽고 동선/순찰 배정 작업을 이어가 줘.
EC2 API http://13.209.67.39:8000 에 /patrol/* 기동됨. data/processed JSON은 scp로 올려 둔 상태.
§6 GPS theater 가드는 코드 반영됨 — EC2 pull·uvicorn 재시작·route-dev 하드 리프레시 후 내 동선 N격자 확인.
다음 우선: index.html 이식 또는 차량 경로(KAKAO_REST_KEY)·체크 시 재TOP 등 §5 미완 항목.
```

---

## 9. 문서 유지 규칙

이 파일을 갱신할 때 최소한 반영할 것:
1. **§1 한 줄 현황** 날짜·막힌 이슈  
2. **§2 백엔드 사실** (URL, 경로, 기동법 변경 시)  
3. **§5 체크리스트** 완료/미완  
4. **열린 버그**는 증상·가설·다음 액션을 §6 형식으로  

팀원 AI에게 넘길 때는 이 파일 경로만 알려도 맥락이 전달되어야 한다.
