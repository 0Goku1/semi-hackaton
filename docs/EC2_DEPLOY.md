# EC2에 백엔드 배포하기 (본인 담당용)

서버: `http://13.209.67.39:8000`  
이미 FastAPI + tmux로 루트 `/` 만 떠 있는 상태. 아래는 **회원/순찰 API를 올리는** 절차.

> DB는 EC2 안의 PostgreSQL에만 붙으면 됩니다.  
> 집 PC에서 DB에 직접 접속할 필요 없습니다.  
> `setup_db.py` 를 **EC2에서** 실행하면 테이블이 만들어집니다.

---

## 1. 코드 올리기

로컬(Windows)에서 예:

```bash
scp -r server ubuntu@13.209.67.39:~/koriyo-server
```

또는 EC2에서 git clone/pull 후 `server/` 폴더로 이동.

---

## 2. 가상환경 + 패키지

```bash
cd ~/koriyo-server   # 실제 경로에 맞게
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## 3. `.env` 만들기

```bash
cp .env.example .env
nano .env
```

채울 값 예시:

```env
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/fire_db
JWT_SECRET=긴랜덤문자열아무거나
CORS_ORIGINS=*
```

- `USER` / `PASSWORD`: EC2 PostgreSQL 계정 (본인이 만든 것)
- `fire_db`: 이미 준비된 DB 이름
- `JWT_SECRET`: 아무 긴 문자열 (로그인 토큰 서명용)

---

## 4. 테이블 생성 (Python 스크립트)

```bash
source .venv/bin/activate
python setup_db.py
```

성공 시 `users`, `patrol_reports` 테이블이 생깁니다.  
여러 번 실행해도 `IF NOT EXISTS` 라 안전합니다.

수동으로 확인:

```bash
psql -d fire_db -c "\dt"
```

---

## 5. FastAPI 재시작 (tmux)

기존에 돌리던 uvicorn을 끄고 새 `main.py`로 띄웁니다.

```bash
tmux ls
tmux attach -t 세션이름
# Ctrl+C 로 기존 서버 중지

cd ~/koriyo-server
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
# Ctrl+B 누른 뒤 D → tmux 분리
```

새 tmux 세션으로 시작하려면:

```bash
tmux new -s fastapi
cd ~/koriyo-server && source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
# Ctrl+B, D
```

---

## 6. 확인

1. 브라우저: [http://13.209.67.39:8000/docs](http://13.209.67.39:8000/docs)  
   → signup / login / users / patrol-reports 보이면 OK
2. `/docs`에서 Try it out으로 회원가입 → 로그인 테스트
3. 프론트 `js/secrets.js`의 `API_BASE_URL`이 `http://13.209.67.39:8000` 인지 확인

---

## 자주 막히는 것

| 증상 | 확인 |
|------|------|
| `Connection refused` | uvicorn이 떠 있는지, 보안그룹 8000 포트 열림 |
| DB 연결 실패 | `.env`의 `DATABASE_URL`, PostgreSQL 실행 여부 |
| CORS 에러 | `CORS_ORIGINS=*` 인지, 서버 재시작했는지 |
| 프론트만 실패 | 브라우저 F12 Network에서 API 응답 코드 확인 |

막히면 `/docs` 스크린샷 + 터미널 에러 메시지를 팀에 공유하면 됩니다.
