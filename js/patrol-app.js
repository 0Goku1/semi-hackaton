// 순찰 페이지 — GPS 추적, 동선 표시, 타이머

const DEST_ZONE = dummyDangerZones.find(z => z.id === PATROL_ROUTE_CONFIG.destinationId);
const PATROL_FOLLOW_LEVEL = 3;

let mapRef = null;
let routePolyline = null;
let locationOverlay = null;
let hasGpsFix = false;
let latestLatlng = null;
let patrolOrigin = null;
let watchId = null;

let seconds = 0;
let timerInterval = null;
let isStandby = false;
let startTime = null;

function getPatrolCurrentUser() {
  try {
    const raw = localStorage.getItem("currentUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

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

function toggleStandby() {
  const btn   = document.getElementById("btnStandby");
  const badge = document.getElementById("statusBadge");
  const title = document.getElementById("patrol-header-title");

  if (!isStandby) {
    clearInterval(timerInterval);
    timerInterval = null;
    isStandby     = true;

    btn.textContent = "▶ 순찰 재개";
    btn.classList.replace("btn-ghost", "btn-standby-on");

    badge.textContent = "● 대기중";
    badge.classList.replace("status-active", "status-standby");

    if (title) title.textContent = "순찰 일시 대기";
  } else {
    startTimer();
    isStandby = false;

    btn.textContent = "⏸ 순찰 대기";
    btn.classList.replace("btn-standby-on", "btn-ghost");

    badge.textContent = "● 순찰중";
    badge.classList.replace("status-standby", "status-active");

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
  const currentUser = getPatrolCurrentUser();

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
    originLat:        patrolOrigin?.lat ?? null,
    originLng:        patrolOrigin?.lng ?? null,
    userGu:           currentUser?.gu ?? "효행구",
    userRegion:       currentUser?.region ?? "봉담읍",
    status:           "COMPLETED",
  }));

  document.getElementById("timerDisplay").textContent = formatTime(seconds);
  window.location.href = "patrol-report.html";
}

let patrolSplashHidden = false;
function hidePatrolSplash() {
  if (patrolSplashHidden) return;
  patrolSplashHidden = true;
  const splash = document.getElementById("patrol-splash");
  if (!splash) return;
  splash.classList.add("fade-out");
  setTimeout(() => splash.remove(), 600);
}

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
}

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

function startLocationTracking() {
  if (!navigator.geolocation) return;

  watchId = navigator.geolocation.watchPosition(
    async (pos) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const latlng = new kakao.maps.LatLng(lat, lng);

      latestLatlng = latlng;

      if (!hasGpsFix && accuracy < 100) {
        hasGpsFix = true;
        patrolOrigin = { lat, lng };
        mapRef.setLevel(PATROL_FOLLOW_LEVEL);
        mapRef.setCenter(latlng);
        hidePatrolSplash();

        try {
          const { points } = await buildPatrolRoutePoints({ lat, lng });
          const kakaoPoints = points.map(
            (p) => new kakao.maps.LatLng(p.lat, p.lng)
          );
          if (kakaoPoints.length) kakaoPoints[0] = latestLatlng || latlng;
          drawPatrolRoute(kakaoPoints);
          mapRef.setLevel(PATROL_FOLLOW_LEVEL);
          mapRef.setCenter(latestLatlng || latlng);
        } catch (e) {
          console.warn("동선 계산 실패:", e.message);
          drawPatrolRoute([
            latestLatlng || latlng,
            new kakao.maps.LatLng(DEST_ZONE.lat, DEST_ZONE.lng),
          ]);
          mapRef.setLevel(PATROL_FOLLOW_LEVEL);
          mapRef.setCenter(latestLatlng || latlng);
        }
      } else if (hasGpsFix) {
        mapRef.panTo(latlng);
      }

      updateLocationDot(latlng);
    },
    (err) => {
      console.warn("GPS 오류:", err.message);
      hidePatrolSplash();
    },
    {
      enableHighAccuracy: true,
      maximumAge:         0,
      timeout:            15000,
    }
  );

  setTimeout(hidePatrolSplash, 10000);
}

function initPatrolMap() {
  const currentUser = getPatrolCurrentUser();
  const userGu = currentUser?.gu ?? "효행구";
  const userRegion = currentUser?.region ?? "봉담읍";

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
      level: PATROL_FOLLOW_LEVEL,
    });

    new kakao.maps.CustomOverlay({
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
      map: mapRef,
    });

    startLocationTracking();
    startTime = new Date();
    startTimer();
  });
}

kakao.maps.load(initPatrolMap);
