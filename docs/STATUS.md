# 진행 현황 & 앞으로 할 일

최종 갱신: 2026-07-23  
상세 API(팀원용): [`TEAM_API_GUIDE.md`](./TEAM_API_GUIDE.md)  
EC2 배포(서버 담당용): [`EC2_DEPLOY.md`](./EC2_DEPLOY.md)

---

## 1. 지금까지 한 것

### 완료 ✅

| 영역 | 내용 |
|------|------|
| 백엔드 코드 | `server/main.py` — signup/login/me/password/patrol-reports |
| DB 스키마 | `users`, `patrol_reports` + `setup_db.py` |
| EC2 기동 | `http://13.209.67.39:8000/docs` 에 API 전부 노출 확인됨 |
| 의존성 | `server/requirements.txt` (실환경에 맞게 수정됨) |
| 시크릿 분리 | `js/secrets.js` / `server/.env` → `.gitignore` |
| 프론트 데이터층 | `js/api.js` + auth/myPage/report/my-reports 를 API 호출로 교체 |
| 팀/배포 문서 | `TEAM_API_GUIDE.md`, `EC2_DEPLOY.md` |

### 아직 미완 ❌ (중요)

| 영역 | 내용 |
|------|------|
| E2E 검증 | `/docs` 또는 웹에서 **실제 가입→로그인→구역→보고서→목록** 한 사이클 통과 확인 |
| Capacitor 앱 이전 | `webDir` 오류, sync/assets 미비, 위치 권한, cleartext HTTP, JDK/빌드 |
| 카카오/메인 무한로딩 | 도메인 등록·SDK 실패 시 스플래시 고착 — 앱/웹 모두 점검 필요 |
| README 최신화 | 루트 `README.TXT` 가 아직 localStorage 목업 기준 |
| 커밋/공유 | 팀원이 `secrets.example` + API 가이드를 보고 바로 붙을 수 있게 push |

---

## 2. 아키텍처가 “소규모에 맞는지”

**맞습니다.** 해커톤·소규모 MVP에서 흔한 구성입니다.

```
[예전] 내 PC에 PostgreSQL + FastAPI 실행
       → PC 끄면/잠들면 팀원·앱이 전부 접속 불가

[지금] EC2(클라우드 PC)에 24시간 FastAPI + PostgreSQL
       → 팀원/앱이 언제든 http://13.209.67.39:8000 으로 통신
```

EC2를 쓰는 핵심 이유:
1. **항상 켜져 있는 공용 서버** (개인 PC를 켜둘 필요 없음)
2. **공인 IP**로 웹·앱·팀원 노트북이 같은 API를 봄
3. 프리티어로 비용 거의 없이 실서비스에 가까운 형태 연습

대안(나중에): Railway, Render, Supabase 등 — 지금은 EC2 + 직접 FastAPI도 충분히 타당합니다.

---

## 3. 당신(이어받은 사람)의 의무 = “기반을 끝낸 뒤 팀원이 URL만 쓰게”

역할 한 줄:

> 웹→앱 이전 이슈를 정리하고, **서버 주소·시크릿·gitignore·requirements·문서**까지  
> “팀원이 EC2를 몰라도 `TEAM_API_GUIDE`만 보고 프론트를 붙일 수 있는 상태”로 만든다.

팀원에게 전달할 메시지 초안:

> API Base는 `http://13.209.67.39:8000` 이야.  
> 문서는 `docs/TEAM_API_GUIDE.md`, 테스트는 `/docs`.  
> 로컬에서는 `secrets.example.js` → `secrets.js` 복사하고 `npx serve .` 하면 돼.  
> EC2/DB는 건드리지 말고, 서버 죽으면 나한테 말해.

---

## 4. 당신이 지금 더 해야 할 일 (우선순위)

### P0 — 오늘 1번 “연동 확인” 끝내기

1. [ ] `/docs`에서 Try it out: signup → login → Authorize(토큰) → GET `/users/me` → POST report → GET reports  
2. [ ] 실패 시 EC2 로그/`DATABASE_URL`/테이블 존재 여부 확인 (`setup_db.py` 재실행)  
3. [ ] 로컬 `npx serve .` 로 동일 플로우 (가입·로그인·마이페이지·보고서)  
4. [ ] 카카오 콘솔에 `localhost` 등록 + 메인 무한로딩 해소 확인

### P1 — 팀 인수인계용 정리

5. [ ] `docs/TEAM_API_GUIDE.md` 팀 채널에 공유  
6. [ ] 루트 `README.TXT`를 “API 연동 버전”으로 짧게 갱신 (또는 README에 TEAM 가이드 링크)  
7. [ ] 변경분 커밋·push (`secrets.js`/`.env` 미포함 확인)

### P2 — 웹→앱 이전 완성

8. [ ] `capacitor.config.json` 의 `webDir` → `"."` 등으로 수정  
9. [ ] `@capacitor/core` 등 package.json 정리 → `npx cap sync android`  
10. [ ] AndroidManifest: 위치 권한 + cleartext(HTTP) 허용  
11. [ ] Android Studio로 빌드·실기/에뮬 확인 (Cursor만으로는 최종 화면 검증 불가)

### 이후 (계획 2·3)

- PostGIS/데이터셋 연동  
- 위험구역 예측 · 동선 최적화

---

## 체크 한눈에

| # | 항목 | 상태 |
|---|------|------|
| API 코드 + EC2 docs | ✅ |
| 프론트 API 연동 코드 | ✅ |
| E2E(실제 가입~보고서) | ⬜ 당신 검증 필요 |
| 팀원용 URL 문서 | ✅ `TEAM_API_GUIDE.md` |
| gitignore / requirements | ✅ (requirements는 실환경 수정 반영) |
| Capacitor 앱 완전 이전 | ⬜ |
| 데이터셋·예측 모델 | ⬜ 다음 단계 |
