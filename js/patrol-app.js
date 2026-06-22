// ============================================================
//  patrol-app.js  —  순찰 페이지 (상태별 타이틀 스위칭 및 유저 세션 연동)
//  경로: index.html / patrol-report.html 과 동일한 공통 모듈(patrolRoute.js) 사용
//        1단계 OSRM(현재위치→DZ_001) + 2단계 수동 경유지(SO_001~017→DZ_003)
//  내 위치: 파란 핀(.my-location-dot)이 GPS 받아 실시간 이동
// ============================================================

// 최종 도착지 (공통 모듈 설정과 동일: DZ_003)
const DEST_ZONE = dummyDangerZones.find(z => z.id === PATROL_ROUTE_CONFIG.destinationId);

// 도보 이동 화면 줌 레벨 (낮을수록 확대 — index.html 보다 세밀하게)
const PATROL_FOLLOW_LEVEL = 3;

// ── 상태 변수 ──────────────────────────────────────────────
let mapRef          = null;
let routePolyline   = null;
let locationOverlay = null;
let destOverlay     = null;
let hasGpsFix       = false;
let latestLatlng    = null;   
let patrolOrigin    = null;   // 순찰 시작(첫 GPS) 좌표 → 보고서 OSRM 1단계 출발점으로 저장
let watchId         = null;

let seconds       = 0;
let timerInterval = null;
let isStandby     = false;
let startTime     = null;

// ============================================================
//  타이머
// ============================================================
function formatTime(s) {
  const h   = String(Math.floor(s / 3600)).padStart(2, "0");
  const m   = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    seconds++;
    document.getElementById("timerDisplay").textContent = formatTime(seconds);
  }, 1000);
}

// ============================================================
//  버튼 핸들러 (타이틀 텍스트 유기적 매핑 추가)
// ============================================================
function toggleStandby() {
  const btn   = document.getElementById("btnStandby");
  const badge = document.getElementById("statusBadge");
  const title = document.getElementById("patrol-header-title"); // 💡 상단 메인 타이틀 ID 캐싱

  if (!isStandby) {
    clearInterval(timerInterval);
    timerInterval = null;
    isStandby     = true;
    
    btn.textContent = "▶ 순찰 재개";
    btn.classList.replace("btn-ghost", "btn-standby-on");
    
    badge.textContent = "● 대기중";
    badge.classList.replace("status-active", "status-standby");
    
    // 💡 대기중 상태로 바뀔 때 왼쪽 타이틀도 함께 변경
    if (title) title.textContent = "순찰 일시 대기";
  } else {
    startTimer();
    isStandby = false;
    
    btn.textContent = "⏸ 순찰 대기";
    btn.classList.replace("btn-standby-on", "btn-ghost");
    
    badge.textContent = "● 순찰중";
    badge.classList.replace("status-standby", "status-active");
    
    // 💡 순찰을 재개하면 원래 타이틀로 완벽 복구
    if (title) title.textContent = "순찰 진행 중";
  }
}

function endPatrol() {
  clearInterval(timerInterval);
  timerInterval = null;

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  const mainUser = dummyUsers.find(u => u.isMain);
  
  // 가입 시 설정되었던 유저 세션 정보를 로깅 데이터에 함께 포함
  const currentUserRaw = sessionStorage.getItem("currentUser");
  let finalGu = "효행구";
  let finalRegion = "봉담읍";

  if (currentUserRaw) {
      const user = JSON.parse(currentUserRaw);
      finalGu = user.gu;
      finalRegion = user.region;
  }

  localStorage.setItem("patrolLog", JSON.stringify({
    agentId:          mainUser.id,
    agentName:        mainUser.name,
    startTime:        startTime?.toISOString() ?? null,
    endTime:          new Date().toISOString(),
    elapsedSeconds:   seconds,
    elapsedFormatted: formatTime(seconds),
    targetZoneId:     DEST_ZONE.id,
    targetZoneType:   DEST_ZONE.type,
    destination:      DEST_ZONE.address,
    originLat:        patrolOrigin?.lat ?? null,  // 보고서 동선(OSRM 1단계) 출발점
    originLng:        patrolOrigin?.lng ?? null,
    userGu:           finalGu,
    userRegion:       finalRegion,
    status:           "COMPLETED",
  }));

  document.getElementById("timerDisplay").textContent = formatTime(seconds);
  window.location.href = "patrol-report.html";
}

// ============================================================
//  로딩 스플래시 (위치 확인 동안 어색한 지도 가림)
// ============================================================
let patrolSplashHidden = false;
function hidePatrolSplash() {
  if (patrolSplashHidden) return;
  patrolSplashHidden = true;
  const splash = document.getElementById("patrol-splash");
  if (!splash) return;
  splash.classList.add("fade-out");
  setTimeout(() => splash.remove(), 600);
}

// ============================================================
//  경로 폴리라인 (공통 모듈이 계산한 전체 동선을 하나의 실선으로)
// ============================================================
function drawPatrolRoute(kakaoPoints) {
  if (routePolyline) routePolyline.setMap(null);

  routePolyline = new kakao.maps.Polyline({
    path:          kakaoPoints,
    strokeWeight:  6,
    strokeColor:   PATROL_ROUTE_CONFIG.color,
    strokeOpacity: 0.95,
    strokeStyle:   "solid",
  });
  routePolyline.setMap(mapRef);
  // ※ 도보 이동 화면이므로 전체 경로에 맞춘 줌아웃(setBounds)은 하지 않는다.
  //    내 위치 중심 + 확대 레벨 유지는 GPS 콜백에서 처리한다.
}

// ============================================================
//  내 위치 파란 점
// ============================================================
function updateLocationDot(latlng) {
  if (locationOverlay) {
    locationOverlay.setPosition(latlng);
  } else {
    const dot = document.createElement("div");
    dot.className = "my-location-dot";

    locationOverlay = new kakao.maps.CustomOverlay({
      position: latlng,
      content: dot,
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: 5,
    });
    locationOverlay.setMap(mapRef);
  }
}

// ============================================================
//  GPS 실시간 추적
// ============================================================
function startLocationTracking() {
  if (!navigator.geolocation) return;

  watchId = navigator.geolocation.watchPosition(
    async (pos) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const latlng = new kakao.maps.LatLng(lat, lng);

      latestLatlng = latlng;

      if (!hasGpsFix && accuracy < 100) {
        hasGpsFix = true;
        patrolOrigin = { lat, lng }; // 순찰 시작 좌표 기록 (보고서 동선 재현용)
        // 도보 화면: 내 위치를 중심으로 + 확대 레벨로 고정
        mapRef.setLevel(PATROL_FOLLOW_LEVEL);
        mapRef.setCenter(latlng);
        hidePatrolSplash(); // 위치 확정 → 로딩 스플래시 제거

        try {
          // index / report 와 동일한 전체 동선 계산 (현재위치 → DZ_001 → SO_xxx → DZ_003)
          const { points } = await buildPatrolRoutePoints({ lat, lng });
          const kakaoPoints = points.map(
            (p) => new kakao.maps.LatLng(p.lat, p.lng)
          );
          // 시작점을 실제 현재 위치로 보정
          if (kakaoPoints.length) kakaoPoints[0] = latestLatlng || latlng;
          drawPatrolRoute(kakaoPoints);
          // 경로를 그린 뒤에도 화면 중심/확대는 내 위치 기준으로 유지
          mapRef.setLevel(PATROL_FOLLOW_LEVEL);
          mapRef.setCenter(latestLatlng || latlng);
        } catch (e) {
          console.warn("동선 계산 실패 → 직선 대체:", e.message);
          drawPatrolRoute([
            latestLatlng || latlng,
            new kakao.maps.LatLng(DEST_ZONE.lat, DEST_ZONE.lng),
          ]);
          mapRef.setLevel(PATROL_FOLLOW_LEVEL);
          mapRef.setCenter(latestLatlng || latlng);
        }
      } else if (hasGpsFix) {
        // 이동 중: 내 위치가 항상 화면 중심이 되도록 부드럽게 따라가기
        mapRef.panTo(latlng);
      }

      updateLocationDot(latlng);
    },
    (err) => {
      console.warn("GPS 오류:", err.message);
      hidePatrolSplash(); // 위치 실패해도 무한 로딩 방지
    },
    {
      enableHighAccuracy: true,
      maximumAge:         0,
      timeout:            15000,
    }
  );

  // 혹시 위치 확정 이벤트가 안 와도 10초 후 강제로 스플래시 제거 (fallback)
  setTimeout(hidePatrolSplash, 10000);
}

// ============================================================
//  🎯 지도 초기화 (가입 세션 데이터 연동)
// ============================================================
function initPatrolMap() {
  const currentUserRaw = sessionStorage.getItem("currentUser");
  let userGu = "효행구";      
  let userRegion = "봉담읍";  

  if (currentUserRaw) {
      const user = JSON.parse(currentUserRaw);
      userGu = user.gu;          
      userRegion = user.region;  
  }

  const headerSub = document.getElementById("patrol-header-sub");
  if (headerSub) {
      headerSub.textContent = `화성시 산불감시 · ${userGu} ${userRegion}`;
  }

  const geocoder = new kakao.maps.services.Geocoder();
  const searchAddress = `경기도 화성시 ${userRegion}`;

  geocoder.addressSearch(searchAddress, function(result, status) {
      let centerLat = DEST_ZONE.lat;
      let centerLng = DEST_ZONE.lng;

      if (status === kakao.maps.services.Status.OK) {
          centerLat = parseFloat(result[0].y);
          centerLng = parseFloat(result[0].x);
      }

      mapRef = new kakao.maps.Map(document.getElementById("map"), {
          center: new kakao.maps.LatLng(centerLat, centerLng),
          level: PATROL_FOLLOW_LEVEL // 도보 화면이므로 확대된 레벨로 시작 (GPS fix 후 내 위치로 재중심)
      });

      destOverlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(DEST_ZONE.lat, DEST_ZONE.lng),
          content: `<div style="
            background:#ff3b30;color:white;
            font-size:11px;font-weight:800;
            padding:4px 10px;border-radius:20px;
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
            white-space:nowrap;border:2px solid white;">
            ${DEST_ZONE.type}
          </div>`,
          yAnchor: 1.8,
          xAnchor: 0.5,
      });
      destOverlay.setMap(mapRef);

      startLocationTracking();
      startTime = new Date();
      startTimer();
  });
}

kakao.maps.load(initPatrolMap);