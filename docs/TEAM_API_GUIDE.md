# 팀 공용: API 통신 가이드

> 프론트(웹/앱) 개발자는 **이 문서만** 보면 서버와 붙일 수 있습니다.  
> EC2·PostgreSQL 내부 설정은 서버 담당자만 건드리면 됩니다.

---

## 한 줄 요약

```
앱/웹  ←→  http://13.209.67.39:8000  (FastAPI)
                ↓
           PostgreSQL fire_db
```

- **Base URL:** `http://13.209.67.39:8000`
- **Swagger(테스트용):** http://13.209.67.39:8000/docs
- **프론트 설정 파일:** `js/secrets.js` (git 제외) ← `js/secrets.example.js` 복사해서 만들기
- **공통 클라이언트:** `js/api.js` 의 `ApiClient` 사용

```js
// js/secrets.js 예시
const SECRETS = {
  KAKAO_JS_KEY: "본인_카카오_키",
  API_BASE_URL: "http://13.209.67.39:8000"
};
```

---

## 인증 규칙

1. `POST /auth/signup` 또는 `POST /auth/login`
2. 로그인 응답의 `access_token`을 `localStorage.accessToken`에 저장
3. 보호 API 호출 시 헤더: `Authorization: Bearer <access_token>`
4. `currentUser`는 UI 표시용 캐시일 뿐, **회원/순찰 데이터의 진실은 DB**

아이디: **4~20자**, 영문·숫자·`_`  
비밀번호: **8~64자**, 영문과 숫자를 각각 1자 이상 포함

---

## 엔드포인트 치트시트

| Method | Path | 토큰 | 용도 |
|--------|------|------|------|
| GET | `/` | ❌ | 서버 생존 확인 |
| POST | `/auth/signup` | ❌ | 회원가입 |
| POST | `/auth/login` | ❌ | 로그인 → JWT |
| GET | `/users/me` | ✅ | 내 정보 |
| PATCH | `/users/me` | ✅ | 구역/이름 수정 |
| PATCH | `/users/me/password` | ✅ | 비밀번호 변경 |
| POST | `/patrol-reports` | ✅ | 순찰 기록 등록 |
| GET | `/patrol-reports/me` | ✅ | 내 순찰 기록 목록 |

### Signup body
```json
{
  "login_id": "guard01",
  "password": "pass1234ab",
  "name": "정승우",
  "gu": "효행구",
  "region": "봉담읍"
}
```

### Login body
```json
{ "login_id": "guard01", "password": "pass1234ab" }
```

### Login 응답
```json
{
  "access_token": "...",
  "token_type": "bearer",
  "user": { "id": 1, "login_id": "guard01", "name": "정승우", "gu": "효행구", "region": "봉담읍" }
}
```

### Patrol report body
```json
{
  "zone": "효행구 봉담읍",
  "time_spent": "15분 3초",
  "weather": "단계1",
  "notes": "특이사항 없음",
  "status": "정상 완료"
}
```

`js/api.js` 를 쓰면 위 호출을 직접 짜지 않아도 됩니다.

```js
await ApiClient.signup({ ... });
const data = await ApiClient.login({ login_id, password });
ApiClient.setSession(data.access_token, data.user);
await ApiClient.getMe();
await ApiClient.createReport({ ... });
await ApiClient.listMyReports();
```

---

로컬에서 프론트만 확인할 때:

```bash
cp js/secrets.example.js js/secrets.js   # 최초 1회
npx serve .
```

앱(Android) 빌드 전에 **반드시**:

```bash
npm install
npm run cap:sync
```

그다음 Android Studio에서 `android/` 폴더 Open → Run.

카카오 지도(앱): 개발자 콘솔 Web 플랫폼에 `https://localhost` 등록.

---

## 하지 말 것

- `users` / `patrolReports` 를 localStorage에 “DB처럼” 쌓지 말 것
- `server/.env`, `js/secrets.js` 를 git에 올리지 말 것
- EC2 IP/포트를 프론트에 하드코딩 난발하지 말 것 → `SECRETS.API_BASE_URL`만 사용

---

## 서버가 죽은 것 같을 때

1. http://13.209.67.39:8000/docs 가 열리는지
2. 안 열리면 **서버 담당자**에게 uvicorn/tmux 확인 요청
3. 프론트 개발자는 URL을 바꾸지 말고 대기
