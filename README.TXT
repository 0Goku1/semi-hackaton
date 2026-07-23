================================================================================
  코리요 지킴이 — 화성시 산불·화재 감시 순찰 시스템
  (semi-hackaton / 해커톤 프론트엔드)
================================================================================

1. 프로젝트 개요
--------------------------------------------------------------------------------
경기도 화성시 산림·화재 감시원을 위한 모바일 웹 애플리케이션입니다.
감시원이 담당 구역의 산불 위험 구역을 확인하고, 최적 순찰 동선을 배정받아
현장 순찰을 수행한 뒤, 순찰 기록 보고서를 작성·등록하는 전 과정을 지원합니다.

  - 대상 지역 : 화성시 (효행구·병점구·만세구·동탄구)
  - UI 형태   : 9:16 모바일 프레임 (#phone-frame) 기반 반응형
  - 데이터    : EC2 FastAPI + PostgreSQL (회원·순찰기록) + 더미 지도 데이터(dummyData.js)
  - API       : http://13.209.67.39:8000  (팀원용: docs/TEAM_API_GUIDE.md)
  - 지도      : Kakao Maps JavaScript API
  - 경로      : OSRM 도보 API + 수동 하이브리드 동선


2. 기술 스택
--------------------------------------------------------------------------------
  Frontend   HTML5, CSS3, Vanilla JavaScript (프레임워크 없음)
  지도       Kakao Maps SDK (services 라이브러리 — Geocoder)
  경로 API   OSRM (router.project-osrm.org, foot 프로필)
  아바타     DiceBear Initials API (팀원 마커·프로필 fallback)
  저장소     JWT(accessToken) + currentUser 캐시 / 순찰 세션(patrolLog)은 localStorage
  백엔드     FastAPI (server/) + PostgreSQL fire_db on AWS EC2
  키·URL     js/secrets.js (gitignore) — js/secrets.example.js 복사 후 작성


3. 빠른 시작
--------------------------------------------------------------------------------

  [1] 저장소 클론 후 프로젝트 폴더로 이동

  [2] API·키 설정
      cp js/secrets.example.js js/secrets.js  (Windows: 복사)

        const SECRETS = {
          KAKAO_JS_KEY: "카카오_JavaScript_키",
          API_BASE_URL: "http://13.209.67.39:8000"
        };

      카카오 개발자 콘솔에서 JavaScript 키 발급, 플랫폼에
      http://localhost:3000 (또는 사용 포트) 등록.

      API 테스트: http://13.209.67.39:8000/docs
      팀원 통신 가이드: docs/TEAM_API_GUIDE.md

  [3] 로컬 서버 실행
      파일을 직접 열면(file://) 지도·GPS·fetch가 제한될 수 있습니다.
      반드시 HTTP 서버로 실행하세요.

        npx serve .
        python -m http.server 8080
        VS Code Live Server

  [4] 브라우저 접속
      http://localhost:포트/login.html  (또는 index.html)

      권장: Chrome / Edge, 위치 권한 허용 (순찰 GPS 추적용)


4. 사용자 흐름 (전체 시나리오)
--------------------------------------------------------------------------------

  login.html
      회원 로그인 → localStorage.currentUser 저장
      │
  index.html  (메인 지도 대시보드)
      · 현재 GPS 위치 기반 지도 표시
      · 위험 구역(DZ_001~003) 원형 오버레이 + 한글 라벨
      · 팀원 마커 (본인 me.png / 팀원 DiceBear 이니셜)
      · [동선 찾기] → OSRM+수동 경로 계산 → 주황 실선 표시
      · [순찰 시작] → patrol.html 이동
      │
  patrol.html  (순찰 진행)
      · GPS 실시간 추적 (파란 핀, 내 위치 중심 확대)
      · 공통 동선 모듈로 전체 경로 표시
      · 타이머 / 순찰 대기 / 순찰 종료
      · 종료 시 patrolLog 저장 → patrol-report.html
      │
  patrol-report.html  (순찰 보고서 작성)
      · 소요 시간·동선 미니맵 표시
      · 기상 단계·특이사항 입력 → patrolReports 누적 저장
      │
  my-reports.html  (내 순찰 기록)
      · 로그인 유저(author) 본인 작성 기록만 필터링 표시

  부가 페이지
      signup.html      회원가입 (구청·읍면동 선택)
      myPage.html      담당 구역 변경 / 비밀번호 변경
      notifications.html  알림 목록 (정적 UI)


5. 디렉터리 구조
--------------------------------------------------------------------------------

  semi-hackaton/
  │
  ├── index.html              메인 지도 대시보드
  ├── login.html              로그인
  ├── signup.html             회원가입
  ├── patrol.html             순찰 진행 (GPS 추적)
  ├── patrol-report.html      순찰 보고서 작성
  ├── my-reports.html         내 순찰 기록 목록
  ├── myPage.html             내 정보 (구역·비밀번호)
  ├── notifications.html      알림 (정적)
  │
  ├── js/
  │   ├── secrets.js          API 키 (직접 생성, git 제외)
  │   ├── auth.js             회원가입·로그인
  │   ├── app.js              메인 지도·동선·패널·프로필
  │   ├── patrol-app.js       순찰 페이지 (GPS·타이머)
  │   ├── patrolRoute.js      순찰 동선 공통 모듈 ★
  │   ├── report.js           보고서·미니맵·기록 등록
  │   ├── mapMarkers.js       지도 마커 (me.png / DiceBear)
  │   ├── myPage.js           내 정보 수정
  │   └── dummyData.js        위험구역·경유지·팀원 더미 데이터
  │
  ├── css/
  │   ├── style.css           글로벌 변수·공통
  │   ├── index.css           메인 지도·프로필·마커
  │   ├── patrol.css          순찰 페이지
  │   ├── report.css          보고서·로그인 프레임
  │   ├── login.css           로그인·회원가입
  │   └── subPage.css         서브 페이지 카드 레이아웃
  │
  ├── images/markers/
  │   └── me.png              본인 위치 마커 (index.html 전용)
  │
  └── koriyo-logo.jpg         로고


6. 핵심 기능 상세
--------------------------------------------------------------------------------

6-1. 메인 지도 (index.html + app.js)
  - Geolocation으로 본인 위치 표시, 실패 시 화성시청 좌표 fallback
  - 위험 구역 3곳을 dangerLevel별 색상 원 + 라벨로 표시
  - 팀원 마커
      · 본인(USER_001) : me.png 원형 마커 (주황 테두리)
      · 이다영(순찰중) : 회색 DiceBear 이니셜
      · 양정빈(대기중) : 파란색 DiceBear 이니셜
  - 프로필 : localStorage.currentUser 이름 → 성 제외 표시 (예: 정승우→승우)
  - [동선 찾기] : patrolRoute.js로 경로 계산 후 Polyline 렌더링
  - 초기 스플래시 : "산불 위험 구역 확인 중..."

6-2. 순찰 동선 (patrolRoute.js) ★ 공통 모듈
  index.html / patrol.html / patrol-report.html 세 화면이 동일 모듈 사용.

  1단계  현재위치(origin) → DZ_001
         OSRM 도보 API (실제 도로 좌표)
  2단계  DZ_001 → SO_001~SO_017 → DZ_003
         dummyWaypoints 수동 좌표 (주황 실선)

  설정 (PATROL_ROUTE_CONFIG)
    osrmViaId     : "DZ_001"   (OSRM 경유 종료점)
    destinationId : "DZ_003"   (최종 도착지)
    color         : "#FF5722"  (동선 색상)

6-3. 순찰 진행 (patrol.html + patrol-app.js)
  - 파란 핀(.my-location-dot) GPS 실시간 추적 (me.png 미사용)
  - 지도 레벨 3 고정, panTo로 내 위치 중심 유지 (도보 내비 느낌)
  - 로딩 스플래시 : "순찰 시작 중..." (GPS fix 전까지 지도 가림)
  - 순찰 종료 시 patrolLog 저장 (originLat/Lng 포함 → 보고서 OSRM 재현용)

6-4. 순찰 보고서 (patrol-report.html + report.js)
  - patrolLog 기반 소요 시간 표시
  - 미니 지도에 공통 동선 렌더링 (드래그·줌 잠금)
  - 기상 5단계 선택 + 특이사항 입력
  - 등록 시 patrolReports 배열에 author 필드와 함께 저장

6-5. 인증 (auth.js)
  - 회원가입 : 이름·아이디·비밀번호·구청·읍면동 → localStorage.users
  - 로그인   : currentUser = { name, gu, region }
  - 아이디   : 영문+숫자 6~8자 / 비밀번호 : 영문+숫자 8~10자


7. localStorage 데이터 구조
--------------------------------------------------------------------------------

  users          회원 배열
                 [{ name, id, pw, gu, region }, ...]

  currentUser    로그인 세션
                 { name, gu, region }

  patrolLog      최근 1회 순찰 세션 (순찰 종료 시 덮어씀)
                 {
                   agentId, agentName,
                   startTime, endTime,
                   elapsedSeconds, elapsedFormatted,
                   targetZoneId, targetZoneType, destination,
                   originLat, originLng,
                   userGu, userRegion,
                   status: "COMPLETED"
                 }

  patrolReports  누적 보고서 배열 (my-reports.html에서 author 필터)
                 [{
                   id, date, zone, time, weather, notes,
                   author, status
                 }, ...]


8. 더미 데이터 (js/dummyData.js)
--------------------------------------------------------------------------------

  dummyDangerZones   위험 구역 3곳
    DZ_001  불법소각 민원   (위험도 높음) — OSRM 1단계 종료점
    DZ_002  건조 경보 지역 (위험도 중간)
    DZ_003  산불 위험 구역 (위험도 낮음) — 순찰 최종 도착지

  dummyWaypoints     수동 경유지 SO_001 ~ SO_017
                     lat/lng를 지도에서 직접 수정하여 동선 조정

  dummyUsers         감시원 위치·상태
    USER_001  정승우  isMain:true   PATROLLING
    USER_002  이다영  PATROLLING    (회색 마커)
    USER_003  양정빈  WAITING       (파란 마커)


9. 동선·데이터 수정 가이드
--------------------------------------------------------------------------------

  경유지 좌표 변경
    → js/dummyData.js 의 dummyWaypoints 배열 lat/lng 수정
    → index / patrol / report 세 화면에 자동 반영

  OSRM 경유점·도착지 변경
    → js/patrolRoute.js 의 PATROL_ROUTE_CONFIG 수정
    → dummyDangerZones 에 해당 id 구역이 있어야 함

  위험 구역 추가·수정
    → js/dummyData.js 의 dummyDangerZones 수정
    → app.js drawDangerZones()가 자동 렌더링

  팀원 위치·상태 변경
    → dummyUsers 의 lat/lng/status 수정
    → status: PATROLLING(회색) / WAITING(파란색)


10. 화면별 스크립트 로드 순서 (참고)
--------------------------------------------------------------------------------

  index.html
    secrets.js → dummyData.js → patrolRoute.js → mapMarkers.js
    → (카카오 SDK) → app.js

  patrol.html
    dummyData.js → patrolRoute.js → secrets.js
    → (카카오 SDK + services) → patrol-app.js

  patrol-report.html
    secrets.js → (카카오 SDK) → dummyData.js → patrolRoute.js → report.js


11. 알려진 제한사항
--------------------------------------------------------------------------------

  - OSRM 외부 API : 네트워크 필요, 과도한 호출 시 rate limit 가능
  - GPS : HTTPS / localhost / 앱(위치 권한) 환경에서 동작
  - notifications.html : 정적 UI (실시간 푸시 미연동)
  - 보고서 상세 조회 : "준비 중" alert (미구현)
  - API는 HTTP(EC2) — 앱에서 cleartext 허용 설정 필요 (이미 반영)


12. 폴더 역할 / 문서
--------------------------------------------------------------------------------

  android/     Capacitor Android 앱 (Android Studio에서 Open)
  server/      FastAPI 백엔드 소스 — 실제 실행은 AWS EC2
  js/api.js    프론트 ↔ EC2 API 통신 (핵심)
  docs/TEAM_API_GUIDE.md   팀원 API 치트시트
  docs/EC2_DEPLOY.md       서버 담당자 EC2 배포 메모

  향후: PostGIS 데이터셋 · 위험구역 예측 · 동선 최적화 모델


================================================================================
  코리요 지킴이 — 화성시 산불감시 해커톤
  문의·수정 : 프로젝트 팀 저장소 이슈 또는 팀 채널
================================================================================
