const dummyDangerZones = [
    {
        id: "DZ_001",
        type: "불법소각 민원",
        lat: 37.2164851600941,
        lng: 126.934789483585,
        dangerLevel: "HIGH",
        address: "경기 화성시 효행구 봉담읍 상리 383-2",
        description: "최근 24시간 소각 민원 2회 발생"
      },
      {
      id: "DZ_002",
      type: "건조 경보 지역",      // 위험 종류
      lat: 37.0682642857681,     // 위도 
      lng: 126.793275965747,     // 경도 (카카오맵 x축)
      dangerLevel: "MEDIUM",       // 위험도 (HIGH, MEDIUM, LOW)
      address: "경기 화성시 만세구 우정읍 화산리",
      description: "건조 경보 지역"
    }
  ];
  
  // 2. 사용자(감시원) 위치 및 상태 데이터
  const dummyUsers = [
    {
      id: "USER_001",
      name: "정승우",
      isMain: true,              // [앱 화면의 주인공] 
      lat: 37.1995,              // ※ app.js에서 브라우저 현재 위치로 덮어씀 (아래는 fallback 좌표)
      lng: 126.8312,
      status: "PATROLLING",      // 상태: PATROLLING(순찰중)
    },
    {
      id: "USER_002",
      name: "이다영",
      isMain: false,             // 다른 동료 감시원
      lat: 37.22006682467144,
      lng: 126.94954170852772,
      status: "RESTING",         // 상태: PATROLLING(순찰중)
    },
    {
      id: "USER_003",
      name: "양정빈",
      isMain: false,
      lat: 37.224391702598055,
      lng: 126.98467595639282,
      status: "RESTING",        // 상태: RESTING(휴식중) - 맵에서 회색 마커로 처리
    }
  ];
  
  // 3. 동선 안내 (폴리라인) 데이터
  // ※ 메인 화면 동선은 app.js에서 실시간 길찾기 API로 생성 (USER_001 현재 위치 → DZ_001)
  // 아래는 참고용 더미 경로 (백업/다른 페이지용)
  const dummyRoutes = {
    // 사용자1(USER_001) → DZ_001 (화성시 남양읍, 불법소각 민원)
    // ※ 출발지는 app.js에서 현재 위치로 보정해 사용
    USER_001: [
      { lat: 37.1995, lng: 126.8312 }, // 출발지 (메인 사용자 현재 위치)
      { lat: 37.2005, lng: 126.8300 }, // 중간 경유지 1
      { lat: 37.2015, lng: 126.8305 }, // 중간 경유지 2
      { lat: 37.2025, lng: 126.8312 }  // 도착지 (DZ_001)
    ],

    // 사용자2(USER_002) → DZ_002 (화성시 송산면, 건조경보 구역)
    USER_002: [
      { lat: 37.22006682467144, lng: 126.94954170852772 }, // 출발지 (이다영 현재 위치)
      { lat: 37.2120, lng: 126.9100 },                      // 중간 경유지 1
      { lat: 37.2050, lng: 126.8800 },                      // 중간 경유지 2
      { lat: 37.2000, lng: 126.8550 },                      // 중간 경유지 3
      { lat: 37.1950, lng: 126.8350 }                       // 도착지 (DZ_002)
    ]
  };

  // 메인 사용자(USER_001) 기본 동선 — app.js에서 사용
  const dummyRoute = dummyRoutes.USER_001;