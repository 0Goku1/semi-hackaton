#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EC2 fire_db: users 테이블 확장 → 기존 회원/보고서 삭제 → 가상 순찰 요원 30명 시드.

개발자(본인) 계정은 이 스크립트에 넣지 않음.
  → signup HTML에 role 옵션 추가 후 앱에서 직접 가입.

실행 (EC2):
  cd ~/semi-hackaton/server
  source ~/semi-hackaton/venv/bin/activate   # venv 경로가 다르면 맞게
  python ../scripts/seed_patrol_officers.py --yes

옵션:
  --yes       확인 없이 실행 (없으면 대화형 확인)
  --dry-run   SQL만 출력, DB 미변경
  --password  요원 공통 비밀번호 (기본 Officer1pass)
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import bcrypt

try:
    import psycopg
except ImportError:
    print("psycopg 필요: pip install 'psycopg[binary]'", file=sys.stderr)
    raise SystemExit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

ROOT = Path(__file__).resolve().parents[1]
SERVER_DIR = ROOT / "server"
ENV_PATH = SERVER_DIR / ".env"

# 화성시 일대에 흩뿌린 시드 좌표 (가상 근무 시작점)
OFFICERS = [
    ("officer01", "김민수", "효행구", "봉담읍", 37.1995, 126.8315),
    ("officer02", "이서연", "병점구", "병점동", 37.2201, 126.9495),
    ("officer03", "박지훈", "동탄구", "반송동", 37.2244, 126.9847),
    ("officer04", "최유진", "병점구", "진안동", 37.2273, 126.9644),
    ("officer05", "정하늘", "효행구", "기안동", 37.2113, 126.9696),
    ("officer06", "강동현", "만세구", "향남읍", 37.2050, 126.8200),
    ("officer07", "윤서아", "만세구", "남양읍", 37.1800, 126.8500),
    ("officer08", "임도윤", "만세구", "마도면", 37.1600, 126.8800),
    ("officer09", "한지우", "만세구", "송산면", 37.1450, 126.7000),
    ("officer10", "오세진", "만세구", "서신면", 37.1500, 126.7200),
    ("officer11", "신예린", "만세구", "우정읍", 37.0900, 126.7700),
    ("officer12", "조현우", "만세구", "장안면", 37.0950, 126.8000),
    ("officer13", "배수빈", "동탄구", "청계동", 37.0700, 126.9200),
    ("officer14", "황준서", "동탄구", "영천동", 37.1000, 126.9600),
    ("officer15", "송지민", "효행구", "비봉면", 37.1300, 126.8700),
    ("officer16", "류하린", "효행구", "매송면", 37.2100, 126.8100),
    ("officer17", "문채원", "효행구", "기배동", 37.2500, 126.8000),
    ("officer18", "안성호", "효행구", "화산동", 37.2300, 126.7500),
    ("officer19", "권나윤", "병점구", "능동", 37.2150, 127.0100),
    ("officer20", "홍태영", "동탄구", "방교동", 37.2000, 127.0300),
    ("officer21", "서다은", "동탄구", "금곡동", 37.1900, 126.9900),
    ("officer22", "남준혁", "병점구", "진안동", 37.2050, 126.9400),
    ("officer23", "구민재", "효행구", "봉담읍", 37.2180, 126.9000),
    ("officer24", "양서준", "만세구", "향남읍", 37.1850, 126.8300),
    ("officer25", "백지호", "동탄구", "반월동", 37.2400, 126.9700),
    ("officer26", "심유나", "효행구", "배양동", 37.1750, 126.9100),
    ("officer27", "노경민", "병점구", "기산동", 37.2320, 126.9300),
    ("officer28", "전소희", "동탄구", "목동", 37.1650, 126.9500),
    ("officer29", "유재원", "만세구", "팔탄면", 37.1550, 126.8600),
    ("officer30", "하은재", "효행구", "안녕동", 37.1950, 126.8600),
]


def load_database_url() -> str:
    if load_dotenv:
        load_dotenv(ENV_PATH)
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        raise SystemExit(f"DATABASE_URL 없음. {ENV_PATH} 확인")
    return url


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


MIGRATE_SQL = [
    """
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'officer'
    """,
    """
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS available BOOLEAN NOT NULL DEFAULT TRUE
    """,
    """
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION
    """,
    """
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_role_check
          CHECK (role IN ('officer', 'dev', 'admin'));
      END IF;
    END $$
    """,
]


def main() -> None:
    parser = argparse.ArgumentParser(description="시드: 순찰 요원 30명")
    parser.add_argument("--yes", action="store_true", help="확인 생략")
    parser.add_argument("--dry-run", action="store_true", help="DB 미변경")
    parser.add_argument(
        "--password",
        default="Officer1pass",
        help="요원 공통 비밀번호 (영문+숫자, 8자+)",
    )
    args = parser.parse_args()

    if len(OFFICERS) != 30:
        raise SystemExit(f"OFFICERS 개수 오류: {len(OFFICERS)}")

    print(f".env: {ENV_PATH}")
    print(f"요원 수: {len(OFFICERS)}")
    print(f"공통 비번: {args.password}")
    print("역할: 전부 officer (dev/admin 은 signup UI 이후 직접 가입)")
    print("주의: patrol_reports + users 전부 삭제 후 재삽입")

    if not args.yes and not args.dry_run:
        ans = input("계속할까요? [y/N] ").strip().lower()
        if ans not in ("y", "yes"):
            print("취소")
            return

    if args.dry_run:
        print("--- MIGRATE ---")
        for s in MIGRATE_SQL:
            print(s.strip(), ";\n")
        print("--- TRUNCATE patrol_reports, users RESTART IDENTITY CASCADE ---")
        print(f"--- INSERT {len(OFFICERS)} officers ---")
        return

    url = load_database_url()
    pw_hash = hash_password(args.password)

    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            for stmt in MIGRATE_SQL:
                cur.execute(stmt)

            cur.execute(
                "TRUNCATE TABLE patrol_reports, users RESTART IDENTITY CASCADE"
            )

            for login_id, name, gu, region, lat, lng in OFFICERS:
                cur.execute(
                    """
                    INSERT INTO users (
                      login_id, password_hash, name, gu, region,
                      role, available, lat, lng
                    ) VALUES (
                      %s, %s, %s, %s, %s,
                      'officer', TRUE, %s, %s
                    )
                    """,
                    (login_id, pw_hash, name, gu, region, lat, lng),
                )

            cur.execute(
                "SELECT id, login_id, name, role, available, lat, lng "
                "FROM users ORDER BY id"
            )
            rows = cur.fetchall()
        conn.commit()

    print(f"완료: {len(rows)}명")
    for r in rows[:5]:
        print(" ", r)
    if len(rows) > 5:
        print(f"  ... 외 {len(rows) - 5}명")
    print()
    print("로그인 예: officer01 /", args.password)
    print("다음: signup HTML에 role(dev/officer) 추가 → 본인 개발 계정 가입")


if __name__ == "__main__":
    main()
