const dummyDangerZones = [
    {
        id: "DZ_001",
        type: "불법소각 민원",     // 위험 종류
        lat: 37.2164851600941,   // 위도 
        lng: 126.934789483585,   // 경도
        dangerLevel: "HIGH",     // 위험도 (HIGH, MEDIUM, LOW)
        address: "경기 화성시 효행구 봉담읍 상리 383-2",
        description: "최근 24시간 소각 민원 2회 발생"
      },
      {
      id: "DZ_002",
      type: "건조 경보 지역",      
      lat: 37.0682642857681,     
      lng: 126.793275965747,     
      dangerLevel: "MEDIUM",     
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
  
  // 동선 데이터
  // ※ 메인 화면 동선은 app.js에서 실시간 길찾기 API로 생성 (USER_001 현재 위치 → DZ_001)