"""
코리요 지킴이 FastAPI — 회원 / 순찰 보고서 API
실행: uvicorn main:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import os
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Optional

import bcrypt
import psycopg
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field

load_dotenv(Path(__file__).resolve().parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-insecure-secret")
JWT_ALG = "HS256"
JWT_EXPIRE_DAYS = 7
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

LOGIN_ID_RE = re.compile(r"^[A-Za-z0-9_]{4,20}$")
PASSWORD_RE = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,64}$")

bearer_scheme = HTTPBearer(auto_error=False)

app = FastAPI(title="코리요 지킴이 API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----- models -----

class SignupIn(BaseModel):
    login_id: str
    password: str
    name: str = Field(min_length=1, max_length=50)
    gu: str
    region: str


class LoginIn(BaseModel):
    login_id: str
    password: str


class UserOut(BaseModel):
    id: int
    login_id: str
    name: str
    gu: str
    region: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    gu: Optional[str] = None
    region: Optional[str] = None


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str


class PatrolReportIn(BaseModel):
    zone: str
    time_spent: str
    weather: str
    notes: str = ""
    status: str = "정상 완료"
    report_date: Optional[date] = None


class PatrolReportOut(BaseModel):
    id: int
    date: str
    zone: str
    time: str
    weather: str
    notes: str
    author: str
    status: str


# ----- helpers -----

def get_conn():
    if not DATABASE_URL:
        raise HTTPException(503, "DATABASE_URL 미설정")
    return psycopg.connect(DATABASE_URL)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except ValueError:
        return False


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire},
        JWT_SECRET,
        algorithm=JWT_ALG,
    )


def validate_credentials(login_id: str, password: str) -> None:
    if not LOGIN_ID_RE.match(login_id):
        raise HTTPException(
            400,
            "아이디는 4~20자, 영문·숫자·_(언더스코어)만 사용할 수 있습니다.",
        )
    if not PASSWORD_RE.match(password):
        raise HTTPException(
            400,
            "비밀번호는 8~64자이며, 영문과 숫자를 각각 1자 이상 포함해야 합니다.",
        )


def row_to_user(row) -> UserOut:
    return UserOut(
        id=row["id"],
        login_id=row["login_id"],
        name=row["name"],
        gu=row["gu"],
        region=row["region"],
    )


def get_current_user(
    creds: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)],
) -> UserOut:
    if creds is None or not creds.credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "로그인이 필요합니다.")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = int(payload.get("sub", 0))
    except (JWTError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "유효하지 않은 토큰입니다.")

    with get_conn() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute(
                "SELECT id, login_id, name, gu, region FROM users WHERE id = %s",
                (user_id,),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "사용자를 찾을 수 없습니다.")
    return row_to_user(row)


# ----- routes -----

@app.get("/")
def read_root():
    return {"message": "화성시 산불 감지 백엔드 서버가 정상 작동 중입니다!"}


@app.get("/health/db")
def health_db():
    """DB 연결·users 테이블 상태 확인 (배포/디버그용)"""
    if not DATABASE_URL:
        raise HTTPException(503, "DATABASE_URL 미설정 (.env 확인)")
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT to_regclass('public.users')")
                users_table = cur.fetchone()[0]
                user_count = None
                if users_table:
                    cur.execute("SELECT COUNT(*) FROM users")
                    user_count = cur.fetchone()[0]
        return {
            "ok": True,
            "users_table": users_table is not None,
            "user_count": user_count,
        }
    except psycopg.Error as exc:
        raise HTTPException(503, f"DB 연결 실패: {exc}") from exc


@app.get("/health/crypto")
def health_crypto():
    """bcrypt 해싱 동작 확인 (passlib 이슈 배포 검증용)"""
    try:
        sample = hash_password("test1234")
        ok = verify_password("test1234", sample)
        return {"ok": ok, "backend": "bcrypt-direct"}
    except Exception as exc:
        raise HTTPException(503, f"비밀번호 해싱 실패: {type(exc).__name__}: {exc}") from exc


@app.post("/auth/signup", response_model=UserOut, status_code=201)
def signup(body: SignupIn):
    validate_credentials(body.login_id, body.password)
    if not body.gu or not body.region:
        raise HTTPException(400, "관리 구청과 세부 지역을 선택해 주세요.")

    password_hash = hash_password(body.password)
    try:
        with get_conn() as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(
                    """
                    INSERT INTO users (login_id, password_hash, name, gu, region)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id, login_id, name, gu, region
                    """,
                    (body.login_id, password_hash, body.name.strip(), body.gu, body.region),
                )
                row = cur.fetchone()
            conn.commit()
    except psycopg.Error as exc:
        sqlstate = getattr(exc, "sqlstate", None)
        if sqlstate == "23505":
            raise HTTPException(409, "이미 존재하는 아이디입니다.") from exc
        if sqlstate == "42P01":
            raise HTTPException(
                503,
                "users 테이블이 없습니다. EC2에서 python setup_db.py 를 실행하세요.",
            ) from exc
        raise HTTPException(503, f"DB 오류 ({sqlstate}): {exc}") from exc
    except Exception as exc:
        raise HTTPException(
            500,
            f"가입 처리 실패 ({type(exc).__name__}): {exc}",
        ) from exc
    return row_to_user(row)


@app.post("/auth/login", response_model=TokenOut)
def login(body: LoginIn):
    with get_conn() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute(
                """
                SELECT id, login_id, password_hash, name, gu, region
                FROM users WHERE login_id = %s
                """,
                (body.login_id,),
            )
            row = cur.fetchone()

    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "아이디 또는 비밀번호가 올바르지 않습니다.")

    user = row_to_user(row)
    return TokenOut(access_token=create_access_token(user.id), user=user)


@app.get("/users/me", response_model=UserOut)
def get_me(user: Annotated[UserOut, Depends(get_current_user)]):
    return user


@app.patch("/users/me", response_model=UserOut)
def update_me(
    body: UserUpdateIn,
    user: Annotated[UserOut, Depends(get_current_user)],
):
    if body.gu is None and body.region is None and body.name is None:
        raise HTTPException(400, "변경할 항목이 없습니다.")
    if (body.gu is None) != (body.region is None):
        raise HTTPException(400, "구청과 세부 지역은 함께 변경해야 합니다.")

    name = body.name.strip() if body.name else user.name
    gu = body.gu if body.gu is not None else user.gu
    region = body.region if body.region is not None else user.region

    with get_conn() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute(
                """
                UPDATE users SET name = %s, gu = %s, region = %s
                WHERE id = %s
                RETURNING id, login_id, name, gu, region
                """,
                (name, gu, region, user.id),
            )
            row = cur.fetchone()
        conn.commit()
    return row_to_user(row)


@app.patch("/users/me/password")
def change_password(
    body: PasswordChangeIn,
    user: Annotated[UserOut, Depends(get_current_user)],
):
    if not PASSWORD_RE.match(body.new_password):
        raise HTTPException(
            400,
            "새 비밀번호는 8~64자이며, 영문과 숫자를 각각 1자 이상 포함해야 합니다.",
        )

    with get_conn() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute("SELECT password_hash FROM users WHERE id = %s", (user.id,))
            row = cur.fetchone()
            if not row or not verify_password(body.current_password, row["password_hash"]):
                raise HTTPException(400, "현재 비밀번호가 일치하지 않습니다.")
            cur.execute(
                "UPDATE users SET password_hash = %s WHERE id = %s",
                (hash_password(body.new_password), user.id),
            )
        conn.commit()
    return {"message": "비밀번호가 변경되었습니다. 다시 로그인해 주세요."}


@app.post("/patrol-reports", response_model=PatrolReportOut, status_code=201)
def create_report(
    body: PatrolReportIn,
    user: Annotated[UserOut, Depends(get_current_user)],
):
    report_date = body.report_date or date.today()
    with get_conn() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute(
                """
                INSERT INTO patrol_reports
                    (user_id, report_date, zone, time_spent, weather, notes, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, report_date, zone, time_spent, weather, notes, status
                """,
                (
                    user.id,
                    report_date,
                    body.zone,
                    body.time_spent,
                    body.weather,
                    body.notes.strip() or "특이사항 없음",
                    body.status,
                ),
            )
            row = cur.fetchone()
        conn.commit()

    return PatrolReportOut(
        id=row["id"],
        date=row["report_date"].strftime("%Y.%m.%d"),
        zone=row["zone"],
        time=row["time_spent"],
        weather=row["weather"],
        notes=row["notes"],
        author=user.name,
        status=row["status"],
    )


@app.get("/patrol-reports/me", response_model=list[PatrolReportOut])
def list_my_reports(user: Annotated[UserOut, Depends(get_current_user)]):
    with get_conn() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute(
                """
                SELECT id, report_date, zone, time_spent, weather, notes, status
                FROM patrol_reports
                WHERE user_id = %s
                ORDER BY created_at DESC, id DESC
                """,
                (user.id,),
            )
            rows = cur.fetchall()

    return [
        PatrolReportOut(
            id=r["id"],
            date=r["report_date"].strftime("%Y.%m.%d"),
            zone=r["zone"],
            time=r["time_spent"],
            weather=r["weather"],
            notes=r["notes"],
            author=user.name,
            status=r["status"],
        )
        for r in rows
    ]
