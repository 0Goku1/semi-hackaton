# 코리요 지킴이 백엔드 (FastAPI)

배포·테이블 생성: 상위 문서 [`docs/EC2_DEPLOY.md`](../docs/EC2_DEPLOY.md)

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # DATABASE_URL, JWT_SECRET 수정
python setup_db.py
uvicorn main:app --host 0.0.0.0 --port 8000
```

API 문서: `http://<host>:8000/docs`
