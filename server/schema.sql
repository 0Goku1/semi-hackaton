-- fire_db: 회원 + 순찰 보고서 (PostGIS와 별도 일반 테이블)
-- EC2에서: python setup_db.py  또는  psql … -f schema.sql
-- 요원 시드: python scripts/seed_patrol_officers.py --yes

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    login_id        VARCHAR(20) NOT NULL UNIQUE,
    password_hash   TEXT        NOT NULL,
    name            VARCHAR(50) NOT NULL,
    gu              VARCHAR(20) NOT NULL,
    region          VARCHAR(30) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'officer'
                      CHECK (role IN ('officer', 'dev', 'admin')),
    available       BOOLEAN     NOT NULL DEFAULT TRUE,
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기존 EC2 테이블용 (CREATE IF NOT EXISTS 만으로는 컬럼이 안 붙음)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'officer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS available BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

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
