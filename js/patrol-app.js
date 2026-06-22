// ============================================================
//  patrol-app.js  —  순찰 페이지
//  경로: OSRM 도보 API  (출발 = GPS 현재위치, 도착 = DZ_001)
// ============================================================

const DEST_ZONE = dummyDangerZones.find(z => z.id === "DZ_001");

// ── 상태 변수 ──────────────────────────────────────────────
let mapRef          = null;
let routePolyline   = null;
let locationOverlay = null;
let destOverlay     = null;
let hasGpsFix       = false;
let latestLatlng    = null;   // ✅ 버그2 수정: 이름 하나로 통일
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
//  버튼 핸들러
// ============================================================
function toggleStandby() {
  const btn   = document.getElementById("btnStandby");
  const badge = document.getElementById("statusBadge");

  if (!isStandby) {
    clearInterval(timerInterval);
    timerInterval = null;
    isStandby     = true;
    btn.textContent = "▶ 순찰 재개";
    btn.classList.replace("btn-ghost", "btn-standby-on");
    badge.textContent = "● 대기중";
    badge.classList.replace("status-active", "status-standby");
  } else {
    startTimer();
    isStandby = false;
    btn.textContent = "⏸ 순찰 대기";
    btn.classList.replace("btn-standby-on", "btn-ghost");
    badge.textContent = "● 순찰중";
    badge.classList.replace("status-standby", "status-active");
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
  // 새 탭(보고서 페이지)에서도 읽어야 하므로 localStorage 사용
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
    status:           "COMPLETED",
  }));

  document.getElementById("timerDisplay").textContent = formatTime(seconds);

  // 순찰 종료 → 같은 탭에서 보고서 작성 페이지로 이동
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
      // ✅ 버그1 수정: accuracy 도 함께 꺼내기
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const latlng = new kakao.maps.LatLng(lat, lng);

      // ✅ 버그2 수정: 통일된 이름 latestLatlng 사용
      latestLatlng = latlng;

      if (!hasGpsFix && accuracy < 100) {
        hasGpsFix = true;
        mapRef.setCenter(latlng);

        try {
          const routePoints = await fetchOsrmRoute(lat, lng);
          // OSRM 응답 대기 중 더 정확한 위치가 왔으면 첫 점 교체
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
//  지도 초기화
// ============================================================
function initPatrolMap() {
  const me = dummyUsers.find(u => u.isMain);
  mapRef = new kakao.maps.Map(document.getElementById("map"), {
    center: new kakao.maps.LatLng(
      (me.lat + DEST_ZONE.lat) / 2,
      (me.lng + DEST_ZONE.lng) / 2
    ),
    level: 7,
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
}

kakao.maps.load(initPatrolMap);
