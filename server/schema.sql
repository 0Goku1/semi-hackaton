-- fire_db: 회원 + 순찰 보고서 (PostGIS와 별도 일반 테이블)
-- EC2에서: python setup_db.py  또는  psql -d fire_db -f schema.sql

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    login_id        VARCHAR(20) NOT NULL UNIQUE,
    password_hash   TEXT        NOT NULL,
    name            VARCHAR(50) NOT NULL,
    gu              VARCHAR(20) NOT NULL,
    region          VARCHAR(30) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);

CREATE INDEX IF NOT EXISTS idx_patrol_reports_user_id ON patrol_reports(user_id);
