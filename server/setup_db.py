"""
EC2에서 실행:  python setup_db.py
fire_db에 users / patrol_reports 테이블을 생성합니다.
"""
from pathlib import Path

from dotenv import load_dotenv
import os
import psycopg

load_dotenv(Path(__file__).resolve().parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit("DATABASE_URL 이 .env 에 없습니다. .env.example 을 참고하세요.")

STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS users (
        id              SERIAL PRIMARY KEY,
        login_id        VARCHAR(8)  NOT NULL UNIQUE,
        password_hash   TEXT        NOT NULL,
        name            VARCHAR(50) NOT NULL,
        gu              VARCHAR(20) NOT NULL,
        region          VARCHAR(30) NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS patrol_reports (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        report_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
        zone            TEXT        NOT NULL,
        time_spent      TEXT        NOT NULL,
        weather         TEXT        NOT NULL,
        notes           TEXT        NOT NULL DEFAULT '',
        status          VARCHAR(20) NOT NULL DEFAULT '정상 완료',
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_patrol_reports_user_id ON patrol_reports(user_id)
    """,
]

with psycopg.connect(DATABASE_URL) as conn:
    with conn.cursor() as cur:
        for stmt in STATEMENTS:
            cur.execute(stmt)
    conn.commit()

print("OK: schema applied (users, patrol_reports)")
