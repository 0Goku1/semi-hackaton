"""
코리요 지킴이 FastAPI — 회원 / 순찰 보고서 API
실행: uvicorn main:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import os
import re
import json
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
ALLOWED_ROLES = frozenset({"officer", "dev", "admin"})
# 가입 시 기본 근무 좌표 (화성시청)
DEFAULT_LAT = 37.1995372034835
DEFAULT_LNG = 126.831477350332

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
    role: str = "officer"  # officer | dev (admin 은 시드/수동만)


class LoginIn(BaseModel):
    login_id: str
    password: str


class UserOut(BaseModel):
    id: int
    login_id: str
    name: str
    gu: str
    region: str
    role: str = "officer"


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
        role=row.get("role") or "officer",
    )


USER_SELECT = "id, login_id, name, gu, region, role"


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
                f"SELECT {USER_SELECT} FROM users WHERE id = %s",
                (user_id,),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "사용자를 찾을 수 없습니다.")
    return row_to_user(row)


def get_optional_user(
    creds: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)],
) -> Optional[UserOut]:
    if creds is None or not creds.credentials:
        return None
    try:
        return get_current_user(creds)
    except HTTPException:
        return None


def load_officers_from_db(me_user_id: Optional[int] = None) -> list[dict]:
    """users 테이블 → 배정/UI용 officers 목록 (id=login_id)."""
    with get_conn() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute(
                """
                SELECT id, login_id, name, role, available, lat, lng
                FROM users
                WHERE role IN ('officer', 'dev', 'admin')
                ORDER BY id
                """
            )
            rows = cur.fetchall()
    officers = []
    for r in rows:
        lat = r["lat"] if r["lat"] is not None else DEFAULT_LAT
        lng = r["lng"] if r["lng"] is not None else DEFAULT_LNG
        officers.append(
            {
                "id": r["login_id"],
                "db_id": r["id"],
                "name": r["name"],
                "role": r["role"],
                "available": bool(r["available"]) if r["available"] is not None else True,
                "is_me": me_user_id is not None and r["id"] == me_user_id,
                "lat": float(lat),
                "lng": float(lng),
            }
        )
    return officers


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
    role = (body.role or "officer").strip().lower()
    if role not in ("officer", "dev"):
        raise HTTPException(400, "역할은 officer 또는 dev 만 선택할 수 있습니다.")

    password_hash = hash_password(body.password)
    try:
        with get_conn() as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(
                    """
                    INSERT INTO users (
                      login_id, password_hash, name, gu, region,
                      role, available, lat, lng
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, TRUE, %s, %s)
                    RETURNING id, login_id, name, gu, region, role
                    """,
                    (
                        body.login_id,
                        password_hash,
                        body.name.strip(),
                        body.gu,
                        body.region,
                        role,
                        DEFAULT_LAT,
                        DEFAULT_LNG,
                    ),
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
                f"""
                SELECT password_hash, {USER_SELECT}
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
                f"""
                UPDATE users SET name = %s, gu = %s, region = %s
                WHERE id = %s
                RETURNING {USER_SELECT}
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


# ----- 순찰 배정 (DB 불필요 · TOP + OR-Tools) -----

PROC_DIR = Path(os.getenv("DATA_ROOT", "").strip() or Path(__file__).resolve().parents[1]) / "data" / "processed"
RISK_PATH = PROC_DIR / "risk_grids.json"
OFFICERS_PATH = PROC_DIR / "officers.json"
POOL_PATH = PROC_DIR / "patrol_pool_state.json"


class AssignIn(BaseModel):
    risk_grids: Optional[list[dict]] = None  # None이면 risk_grids.json
    officer_id: Optional[str] = None  # 특정 요원 경로만 상세 geometry
    me_lat: Optional[float] = None
    me_lng: Optional[float] = None
    enrich_geometry: bool = True
    time_limit_s: float = 2.0


class CompleteStopIn(BaseModel):
    grid_id: str
    officer_id: str


class CompletePatrolIn(BaseModel):
    officer_id: str
    grid_ids: list[str]
    notes: str = ""


def _read_pool() -> dict:
    if POOL_PATH.exists():
        return json.loads(POOL_PATH.read_text(encoding="utf-8"))
    return {"schema": "koriyo.patrol_pool.v1", "completed_grid_ids": [], "in_progress": {}}


def _write_pool(data: dict) -> None:
    POOL_PATH.parent.mkdir(parents=True, exist_ok=True)
    POOL_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


@app.get("/patrol/risk-grids")
def get_risk_grids():
    if not RISK_PATH.exists():
        raise HTTPException(404, "risk_grids.json 없음")
    raw = json.loads(RISK_PATH.read_text(encoding="utf-8"))
    from patrol_core import resolve_risk_grids

    return {"grids": resolve_risk_grids(raw), "path": str(RISK_PATH.name)}


@app.put("/patrol/risk-grids")
def put_risk_grids(body: dict):
    """위험등급 레이어가 JSON만 갈아끼울 때 사용."""
    from patrol_core import resolve_risk_grids, save_json

    grids = resolve_risk_grids(body if "grids" in body or isinstance(body, list) else body)
    save_json(RISK_PATH, {"schema": "koriyo.risk_grids.v1", "grids": grids})
    return {"ok": True, "count": len(grids)}


@app.get("/patrol/officers")
def get_officers(
    user: Annotated[Optional[UserOut], Depends(get_optional_user)] = None,
):
    me_id = user.id if user else None
    officers = load_officers_from_db(me_id)
    return {
        "schema": "koriyo.officers.v1",
        "source": "users",
        "officers": officers,
    }


@app.put("/patrol/officers")
def put_officers(_body: dict):
    raise HTTPException(
        410,
        "officers.json 일괄 교체는 폐기되었습니다. users 테이블·회원가입을 사용하세요.",
    )


@app.patch("/patrol/officers/{officer_id}")
def patch_officer(officer_id: str, body: dict):
    """officer_id = login_id. available / lat / lng / name 갱신."""
    allowed = {k: v for k, v in body.items() if k in ("available", "lat", "lng", "name")}
    if not allowed:
        raise HTTPException(400, "변경할 필드 없음 (available, lat, lng, name)")
    sets = []
    vals = []
    for k, v in allowed.items():
        sets.append(f"{k} = %s")
        vals.append(v)
    vals.append(officer_id)
    with get_conn() as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute(
                f"""
                UPDATE users SET {", ".join(sets)}
                WHERE login_id = %s
                RETURNING id, login_id, name, role, available, lat, lng
                """,
                vals,
            )
            row = cur.fetchone()
        conn.commit()
    if not row:
        raise HTTPException(404, "officer not found")
    return {
        "ok": True,
        "officer": {
            "id": row["login_id"],
            "name": row["name"],
            "role": row["role"],
            "available": bool(row["available"]),
            "is_me": False,
            "lat": float(row["lat"] if row["lat"] is not None else DEFAULT_LAT),
            "lng": float(row["lng"] if row["lng"] is not None else DEFAULT_LNG),
        },
    }


class OfficerAddIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    available: bool = True
    lat: float = DEFAULT_LAT
    lng: float = DEFAULT_LNG
    login_id: Optional[str] = None
    password: str = "Officer1pass"
    gu: str = "효행구"
    region: str = "봉담읍"


@app.post("/patrol/officers/add")
def add_officer(body: OfficerAddIn):
    """DEV: users에 officer 역할 계정 추가."""
    login_id = (body.login_id or "").strip()
    if not login_id:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM users WHERE login_id LIKE 'officer%'"
                )
                n = int(cur.fetchone()[0]) + 1
        login_id = f"officer{n:02d}"
    if not LOGIN_ID_RE.match(login_id):
        raise HTTPException(400, "login_id 형식이 올바르지 않습니다.")
    if not PASSWORD_RE.match(body.password):
        raise HTTPException(400, "password 형식이 올바르지 않습니다.")

    try:
        with get_conn() as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(
                    """
                    INSERT INTO users (
                      login_id, password_hash, name, gu, region,
                      role, available, lat, lng
                    ) VALUES (%s, %s, %s, %s, %s, 'officer', %s, %s, %s)
                    RETURNING id, login_id, name, role, available, lat, lng
                    """,
                    (
                        login_id,
                        hash_password(body.password),
                        body.name.strip(),
                        body.gu,
                        body.region,
                        body.available,
                        body.lat,
                        body.lng,
                    ),
                )
                row = cur.fetchone()
            conn.commit()
    except psycopg.Error as exc:
        if getattr(exc, "sqlstate", None) == "23505":
            raise HTTPException(409, "이미 있는 login_id") from exc
        raise HTTPException(503, f"DB 오류: {exc}") from exc

    return {
        "ok": True,
        "officer": {
            "id": row["login_id"],
            "name": row["name"],
            "role": row["role"],
            "available": bool(row["available"]),
            "is_me": False,
            "lat": float(row["lat"]),
            "lng": float(row["lng"]),
        },
    }


@app.delete("/patrol/officers/{officer_id}")
def delete_officer(officer_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM users
                WHERE login_id = %s AND role = 'officer'
                RETURNING id
                """,
                (officer_id,),
            )
            row = cur.fetchone()
        conn.commit()
    if not row:
        raise HTTPException(
            404,
            "삭제 실패 (없거나 officer 역할이 아님 — dev/admin 은 삭제 불가)",
        )
    return {"ok": True, "deleted": officer_id}


@app.get("/patrol/pool")
def get_pool():
    return _read_pool()


@app.post("/patrol/pool/reset")
def reset_pool():
    data = {"schema": "koriyo.patrol_pool.v1", "completed_grid_ids": [], "in_progress": {}}
    _write_pool(data)
    return data


@app.post("/patrol/assign")
def patrol_assign(
    body: AssignIn,
    user: Annotated[Optional[UserOut], Depends(get_optional_user)] = None,
):
    """가용 요원 × 위험격자 TOP+OR-Tools 배정. 완료된 격자는 후보에서 제외."""
    try:
        from patrol_core import assign_patrol, load_json, resolve_risk_grids
    except ImportError as exc:
        raise HTTPException(500, f"patrol_core import 실패: {exc}") from exc

    if body.risk_grids is not None:
        grids = body.risk_grids
    else:
        if not RISK_PATH.exists():
            raise HTTPException(404, "risk_grids.json 없음")
        grids = resolve_risk_grids(load_json(RISK_PATH))

    me_id = user.id if user else None
    officers = load_officers_from_db(me_id)
    if not officers:
        raise HTTPException(404, "배정 가능한 요원이 users 에 없습니다.")

    # 내 시작점 반영 (프론트가 보낸 좌표 그대로 — DEV 시청/실GPS 선택은 클라이언트)
    if body.me_lat is not None and body.me_lng is not None:
        for o in officers:
            if o.get("is_me"):
                o["lat"] = body.me_lat
                o["lng"] = body.me_lng
                break
        else:
            # 로그인 없이 배정: 가용 1명을 임시 is_me
            for o in officers:
                if o.get("available"):
                    o["is_me"] = True
                    o["lat"] = body.me_lat
                    o["lng"] = body.me_lng
                    break

    pool = _read_pool()
    completed = set(pool.get("completed_grid_ids") or [])

    result = assign_patrol(
        grids,
        officers,
        completed_ids=completed,
        time_limit_s=body.time_limit_s,
        enrich_geometry=body.enrich_geometry,
    )

    # 요청 시 특정 요원만 남기거나, geometry는 is_me 위주 유지
    if body.officer_id:
        result["routes"] = [r for r in result["routes"] if r["officer_id"] == body.officer_id]
        for r in result["routes"]:
            if not r.get("is_me"):
                # 다른 요원 상세 좌표는 유지하되 용량 큰 legs는 요약 가능 — 일단 유지
                pass

    # in_progress 기록
    for r in result.get("routes", []):
        pool.setdefault("in_progress", {})[r["officer_id"]] = [
            s["grid_id"] for s in r.get("stops", [])
        ]
    _write_pool(pool)

    result["pool"] = pool
    return result


@app.post("/patrol/complete-stop")
def complete_stop(body: CompleteStopIn):
    """격자 1개 순찰 체크 → 전역 완료 풀에 넣어 재배정 후보에서 제외."""
    pool = _read_pool()
    done = set(pool.get("completed_grid_ids") or [])
    done.add(body.grid_id)
    pool["completed_grid_ids"] = sorted(done)
    prog = pool.setdefault("in_progress", {}).get(body.officer_id) or []
    pool["in_progress"][body.officer_id] = [g for g in prog if g != body.grid_id]
    _write_pool(pool)
    remaining = pool["in_progress"].get(body.officer_id) or []
    return {
        "ok": True,
        "grid_id": body.grid_id,
        "remaining": remaining,
        "all_done": len(remaining) == 0,
        "pool": pool,
    }


@app.post("/patrol/complete-all")
def complete_all(body: CompletePatrolIn):
    """할당 구역 전부 확인 후 일괄 완료 표시(보고서 작성 직전)."""
    pool = _read_pool()
    done = set(pool.get("completed_grid_ids") or [])
    done.update(body.grid_ids)
    pool["completed_grid_ids"] = sorted(done)
    pool.setdefault("in_progress", {})[body.officer_id] = []
    _write_pool(pool)
    return {"ok": True, "completed": body.grid_ids, "pool": pool}
