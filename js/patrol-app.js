// ============================================================
//  patrol-app.js  —  순찰 페이지 (상태별 타이틀 스위칭 및 유저 세션 연동)
//  경로: OSRM 도보 API  (출발 = GPS 현재위치, 도착 = DZ_001)
// ============================================================

const DEST_ZONE = dummyDangerZones.find(z => z.id === "DZ_001");

// ── 상태 변수 ──────────────────────────────────────────────
let mapRef          = null;
let routePolyline   = null;
let locationOverlay = null;
let destOverlay     = null;
let hasGpsFix       = false;
let latestLatlng    = null;   
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
    userGu:           finalGu,
    userRegion:       finalRegion,
    status:           "COMPLETED",
  }));

  document.getElementById("timerDisplay").textContent = formatTime(seconds);
  window.location.href = "patrol-report.html";
}

// ============================================================
//  OSRM 도보 경로 API
// ============================================================
async function fetchOsrmRoute(startLat, startLng) {
  const url =
    `https://router.project-osrm.org/route/v1/foot/` +
    `${startLng},${startLat};${DEST_ZONE.lng},${DEST_ZONE.lat}` +
    `?overview=full&geometries=geojson`;

  const res  = await fetch(url);
  const data = await res.json();

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error("OSRM: 경로 없음");
  }

  return data.routes[0].geometry.coordinates.map(
    ([lng, lat]) => new kakao.maps.LatLng(lat, lng)
  );
}

// ============================================================
//  경로 폴리라인
// ============================================================
function drawOsrmRoute(kakaoPoints) {
  if (routePolyline) routePolyline.setMap(null);

  routePolyline = new kakao.maps.Polyline({
    path:          kakaoPoints,
    strokeWeight:  5,
    strokeColor:   "#ff6b35",
    strokeOpacity: 0.9,
    strokeStyle:   "solid",
  });
  routePolyline.setMap(mapRef);

  const bounds = new kakao.maps.LatLngBounds();
  kakaoPoints.forEach(p => bounds.extend(p));
  mapRef.setBounds(bounds);
}

// ============================================================
//  내 위치 파란 점
// ============================================================
function updateLocationDot(latlng) {
  if (locationOverlay) {
    locationOverlay.setPosition(latlng);
  } else {
    locationOverlay = new kakao.maps.CustomOverlay({
      position: latlng,
      content:  '<div class="my-location-dot"></div>',
      yAnchor:  0.5,
      xAnchor:  0.5,
      zIndex:   5,
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
        mapRef.setCenter(latlng);

        try {
          const routePoints = await fetchOsrmRoute(lat, lng);
          if (latestLatlng) routePoints[0] = latestLatlng;
          drawOsrmRoute(routePoints);
        } catch (e) {
          console.warn("OSRM 실패 → 직선:", e.message);
          drawOsrmRoute([
            latestLatlng || latlng,
            new kakao.maps.LatLng(DEST_ZONE.lat, DEST_ZONE.lng),
          ]);
        }
      }

      updateLocationDot(latlng);
    },
    (err) => { console.warn("GPS 오류:", err.message); },
    {
      enableHighAccuracy: true,
      maximumAge:         0,
      timeout:            15000,
    }
  );
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
          level: 7 
      });

      destOverlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(DEST_ZONE.lat, DEST_ZONE.lng),
          content: `<div style="
            background:#ff3b30;color:white;
            font-size:11px;font-weight:800;
            padding:4px 10px;border-radius:20px;
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
            white-space:nowrap;border:2px solid white;">
            🎯 ${DEST_ZONE.type}
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