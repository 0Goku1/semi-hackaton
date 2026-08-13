# 순찰 동선 배정 API (TOP + OR-Tools)

위험등급 레이어는 JSON만 교체하면 된다.

## 입력 JSON

`data/processed/risk_grids.json` (또는 `risk_grids.example.json`):

```json
{
  "schema": "koriyo.risk_grids.v1",
  "grids": [
    { "grid_id": "다사 094 030", "score": 0.87 }
  ]
}
```

배열만 넣어도 된다: `[{ "grid_id": "...", "score": 0.87 }, ...]`

## 요원

`data/processed/officers.json` — `available: true/false`, `is_me`

## 실행

```bash
cd server
pip install -r requirements.txt
# route_dev_network.json 필요 (analysis/14)
uvicorn main:app --host 0.0.0.0 --port 8000
```

프론트 `js/secrets.js` 의 `API_BASE_URL` → `http://127.0.0.1:8000`

## 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/patrol/risk-grids` | 위험 격자 |
| PUT | `/patrol/risk-grids` | JSON 갈아끼우기 |
| GET/PUT/PATCH | `/patrol/officers` | 가용 요원 |
| POST | `/patrol/assign` | TOP+OR-Tools 배정 + 차량/도보 경로 |
| POST | `/patrol/complete-stop` | 격자 1개 순찰 완료 → 후보 제외 |
| POST | `/patrol/complete-all` | 일괄 완료 |
| POST | `/patrol/pool/reset` | 완료 풀 초기화 |

## UI 흐름

1. `route-dev.html` → 요원 토글 → **동선 찾기** (파란=차량, 초록=등산로/임도, 주황점선=접근)
2. **순찰 시작** → `patrol-run.html` 에서 격자 체크
3. 전부 확인 → **보고서 작성** → `patrol-report.html`

## 차량 경로

- `KAKAO_REST_KEY` 있으면 카카오 모빌리티 Directions
- 없으면 OSRM `driving` public 서버
- 둘 다 실패 시 직선×1.4 추정 (분 단위만)
