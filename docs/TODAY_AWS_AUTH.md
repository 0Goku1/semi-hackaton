# 오늘 작업: AWS EC2 + DB 연동 (1번)

> **최신 현황은 [`STATUS.md`](./STATUS.md) 를 보세요.**  
> 팀원 API 안내: [`TEAM_API_GUIDE.md`](./TEAM_API_GUIDE.md)

목표: 로그인 · 회원가입 · 회원정보 · 순찰 기록까지 FastAPI(`http://13.209.67.39:8000`) + PostgreSQL(`fire_db`)로 연동한다.  
화면(HTML)은 유지하고, **데이터 계층만** 서버로 교체한다.

---

## 확정된 결정

| 항목 | 결정 |
|------|------|
| 백엔드 위치 | 이 레포 `server/` |
| API Base | `http://13.209.67.39:8000` |
| DB | PostgreSQL `fire_db` (PostGIS는 2~3단계에서 사용) |
| 인증 | JWT Bearer, 만료 7일 |
| 클라이언트 저장 | `accessToken` + `currentUser` 캐시만 (회원/보고서는 DB가 소스) |
| ID 규칙 | 아이디 4~20자(영문·숫자·_) / 비밀번호 8~64자(영문+숫자 각 1+) |
| 회원가입 | `name` 필드 사용 (`#user_name`) |
| EC2/DB 적용 | **본인 담당** — EC2에서 `setup_db.py`로 테이블 생성 |
| 오늘 범위 | signup / login / me / password / patrol-reports 전부 |

---

## 체크리스트

### A. 백엔드 코드 — ✅
### B. EC2 `/docs` API 노출 — ✅ (스크린샷 기준)
### C. 프론트 API 연동 코드 — ✅
### D. E2E 검증 — ⬜ (`STATUS.md` P0)
### E. Capacitor 앱 이전 완성 — ⬜ (`STATUS.md` P2)

---

## 다음 단계 (오늘 이후)

2. 데이터셋(PostGIS/SHP) 연동  
3. 위험구역 예측 · 동선 최적화 모델
