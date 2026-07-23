# 오늘 작업: AWS EC2 + DB 연동 (1번)

> 목표: 로그인 · 회원가입 · 회원정보 · 순찰 기록까지 FastAPI(`http://13.209.67.39:8000`) + PostgreSQL(`fire_db`)로 연동한다.  
> 화면(HTML)은 유지하고, **데이터 계층만** 서버로 교체한다.

---

## 확정된 결정

| 항목 | 결정 |
|------|------|
| 백엔드 위치 | 이 레포 `server/` |
| API Base | `http://13.209.67.39:8000` |
| DB | PostgreSQL `fire_db` (PostGIS는 2~3단계에서 사용) |
| 인증 | JWT Bearer, 만료 7일 |
| 클라이언트 저장 | `accessToken` + `currentUser` 캐시만 (회원/보고서는 DB가 소스) |
| ID 규칙 | 영문+숫자 6~8자 / 비밀번호 영문+숫자 8~10자 |
| 회원가입 | `name` 필드 사용 (`#user_name`) |
| EC2/DB 적용 | **본인 담당** — 로컬 PC에서 DB 직접 접속 불필요. EC2에서 Python 스크립트로 테이블 생성 |
| 오늘 범위 | signup / login / me / password / patrol-reports 전부 |

---

## 작업 순서 (체크리스트)

### A. 레포에 백엔드 코드 준비 (Cursor)

- [x] `server/schema.sql` — users, patrol_reports
- [x] `server/setup_db.py` — EC2에서 실행해 테이블 생성
- [x] `server/main.py` — FastAPI 엔드포인트
- [x] `server/requirements.txt`, `server/.env.example`
- [x] `docs/EC2_DEPLOY.md` — EC2 배포·재시작 절차

### B. EC2에서 적용 (본인 + AI)

- [ ] EC2에 `server/` 업로드 (scp / git pull)
- [ ] `server/.env` 작성 (`DATABASE_URL`, `JWT_SECRET`)
- [ ] `pip install -r requirements.txt`
- [ ] `python setup_db.py` 로 테이블 생성
- [ ] tmux에서 uvicorn 재시작
- [ ] 브라우저에서 `http://13.209.67.39:8000/docs` 에 새 API 보이는지 확인

### C. 프론트 연동 (Cursor)

- [x] `js/api.js` — fetch 래퍼
- [x] `js/auth.js` / `myPage.js` / `report.js` / `my-reports` API 연동
- [x] `js/secrets.js`에 `API_BASE_URL` 추가 (gitignore)
- [x] `js/secrets.example.js` 커밋용 템플릿
- [x] `docs/TODAY_AWS_AUTH.md` + `.cursor/rules/aws-auth-integration.mdc`

### D. 검증

- [ ] `/docs`에서 signup → login → me 수동 호출
- [ ] 웹 `npx serve .` 에서 가입 → 로그인 → 구역변경 → 보고서 등록 → 목록
- [ ] (이후) 앱 WebView + cleartext HTTP

---

## API 요약

| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/signup` | 없음 |
| POST | `/auth/login` | 없음 |
| GET | `/users/me` | Bearer |
| PATCH | `/users/me` | Bearer |
| PATCH | `/users/me/password` | Bearer |
| POST | `/patrol-reports` | Bearer |
| GET | `/patrol-reports/me` | Bearer |

자세한 요청/응답은 `http://13.209.67.39:8000/docs` (배포 후) 또는 `server/main.py` 참고.

---

## 시크릿 / gitignore

| 파일 | git |
|------|-----|
| `js/secrets.js` | 제외 (카카오 키 + API URL) |
| `js/secrets.example.js` | 커밋 |
| `server/.env` | 제외 |
| `server/.env.example` | 커밋 |

---

## 다음 단계 (오늘 이후)

2. 데이터셋(PostGIS/SHP) 연동  
3. 위험구역 예측 · 동선 최적화 모델
