-- EC2 PostgreSQL: users / 관련 테이블 구조 확인용
-- 사용: psql -d fire_db -f scripts/ec2_inspect_users.sql
--   또는 아래를 복사해 SSH 세션에서 실행 후 결과를 채팅에 붙여넣기

\echo '=== databases (참고) ==='
SELECT current_database();

\echo '=== public 테이블 목록 ==='
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

\echo '=== users 컬럼 ==='
SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

\echo '=== users 샘플 (최대 5행, 비밀번호 해시 제외) ==='
SELECT id, login_id, name, gu, region, created_at
FROM users
ORDER BY id
LIMIT 5;

\echo '=== users 행 수 ==='
SELECT COUNT(*) AS user_count FROM users;

\echo '=== patrol_reports 컬럼 (있으면) ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'patrol_reports'
ORDER BY ordinal_position;
