const DEFAULT_CENTER = { lat: 37.1995, lng: 126.8312 }; // 위치 권한 거부 시 fallback (화성시청 부근)

// 동선 설정/계산은 js/patrolRoute.js (PATROL_ROUTE_CONFIG, buildPatrolRoutePoints) 공통 모듈 사용

const MIN_LOADING_MS = 1500;



let map;

let routeLines = []; // 경로 폴리라인 모음

const mainUser = dummyUsers.find((user) => user.isMain) || dummyUsers[0];



/* 현재 위치 가져오기 (실패 시 기본 좌표) */

function getMyPosition() {

  return new Promise((resolve) => {

    if (!navigator.geolocation) {

      resolve(DEFAULT_CENTER);

      return;

    }



    navigator.geolocation.getCurrentPosition(

      (position) => {

        resolve({

          lat: position.coords.latitude,

          lng: position.coords.longitude,

        });

      },

      (err) => {

        console.warn("[위치 조회 실패] 기본 좌표(화성시청)로 대체합니다.", err);

        resolve(DEFAULT_CENTER);

      },

      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }

    );

  });

}



/* 지도 초기화 (USER_001 위치 = 현재 위치) */

async function initMap() {

  const myPos = await getMyPosition();



  mainUser.lat = myPos.lat;

  mainUser.lng = myPos.lng;



  const container = document.getElementById("map");

  map = new kakao.maps.Map(container, {

    center: new kakao.maps.LatLng(myPos.lat, myPos.lng),

    level: 5,

  });



  renderUsers();

  drawDangerZones();

  setupPanelInteraction();

  setupMapRelayout();

  hideAppSplashWhenReady();

}



/* 초기 스플래시("산불 위험 구역 확인 중") 숨김 */
function hideAppSplashWhenReady() {
  const splash = document.getElementById("app-splash");
  if (!splash) return;

  let hidden = false;
  const hide = () => {
    if (hidden) return;
    hidden = true;
    splash.classList.add("fade-out");
    setTimeout(() => splash.remove(), 600);
  };

  kakao.maps.event.addListener(map, "tilesloaded", hide);
  setTimeout(hide, 8000); // fallback
}



/* 프레임 크기 변경 시 카카오맵 리사이즈 */

function setupMapRelayout() {

  const relayout = () => {

    if (map) map.relayout();

  };



  window.addEventListener("resize", relayout);

  setTimeout(relayout, 100);

}



/* 사용자 마커 렌더링 */

function renderUsers() {
  dummyUsers.forEach((user) => {
    const position = new kakao.maps.LatLng(user.lat, user.lng);
    const content = user.isMain
      ? createMeMarkerElement(getLoggedInUserName())
      : createMemberMarkerElement(user);

    new kakao.maps.CustomOverlay({
      map,
      position,
      content,
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: user.isMain ? 4 : 3,
    });
  });
}



/* 위험지역 시각화 — Circle + 커스텀 라벨 */
const DANGER_LEVEL_KEY = {
  "위험도 높음": "HIGH",
  "위험도 중간": "MEDIUM",
  "위험도 낮음": "LOW",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

const DANGER_ZONE_STYLE = {
  HIGH:   { radius: 300, color: "#ff3b30", strokeStyle: "solid" },
  MEDIUM: { radius: 300, color: "#ff9500", strokeStyle: "solid" },
  LOW:    { radius: 300, color: "#34c759", strokeStyle: "dashed" },
};

function getDangerZoneStyle(dangerLevel) {
  const key = DANGER_LEVEL_KEY[dangerLevel] || "LOW";
  return DANGER_ZONE_STYLE[key];
}

function drawDangerZones() {
  dummyDangerZones.forEach((h) => {
    const { radius, color, strokeStyle } = getDangerZoneStyle(h.dangerLevel);
    const center = new kakao.maps.LatLng(h.lat, h.lng);

    // 위험 구역 원
    const circle = new kakao.maps.Circle({
      center,
      radius,
      strokeWeight: 2,
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeStyle,
      fillColor: color,
      fillOpacity: 0.18,
    });
    circle.setMap(map);

    // 구역 라벨
    const labelHtml = `<div style="margin-left:14px; font-size:10px; font-weight:700; color:${color}; background:rgba(255,255,255,0.88); padding:3px 8px; border-radius:10px; border:1.5px solid ${color}44; white-space:nowrap; box-shadow:0 1px 4px rgba(0,0,0,0.15); pointer-events:none; line-height:1.35;">${h.type}<br><span style="font-size:9px; font-weight:800;">${h.dangerLevel}</span></div>`;

    const label = new kakao.maps.CustomOverlay({
      position: center,
      content: labelHtml,
      xAnchor: 0,
      yAnchor: 0.5,
      clickable: false,
      zIndex: 3,
    });
    label.setMap(map);
  });
}



function estimateDistanceMeters(origin, destination) {

  const R = 6371000;

  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(destination.lat - origin.lat);

  const dLng = toRad(destination.lng - origin.lng);

  const a =

    Math.sin(dLat / 2) ** 2 +

    Math.cos(toRad(origin.lat)) * Math.cos(toRad(destination.lat)) * Math.sin(dLng / 2) ** 2;



  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

}



function formatDistance(meters) {

  if (!meters) return "";

  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;

}



function formatDuration(seconds) {

  if (!seconds) return "";

  const minutes = Math.max(1, Math.round(seconds / 60));

  return `약 ${minutes}분`;

}



function buildRouteSummaryText(routeResult) {

  const distanceText = formatDistance(routeResult.distance);

  const durationText = formatDuration(routeResult.duration);



  if (distanceText && durationText) return `${distanceText} · ${durationText}`;
  if (distanceText) return distanceText;
  return "";

}



/* API 경로로 Polyline 그리기 */

async function drawRoute() {
  const origin = { lat: mainUser.lat, lng: mainUser.lng };

  clearRouteLines();

  const { points, destination } = await buildPatrolRoutePoints(origin);

  if (points.length >= 2) {
    drawRouteLine(points, "solid", 6, 0.95);
  }

  drawStopMarkers(destination);

  let totalDistance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalDistance += estimateDistanceMeters(points[i], points[i + 1]);
  }

  const bounds = new kakao.maps.LatLngBounds();
  points.forEach((p) => bounds.extend(new kakao.maps.LatLng(p.lat, p.lng)));
  map.setBounds(bounds);

  const estDuration = Math.round((totalDistance / 4000) * 3600);

  return { distance: totalDistance, duration: estDuration };
}

/* 경로 폴리라인 그리기 / 정리 */
function drawRouteLine(points, strokeStyle, strokeWeight, strokeOpacity) {
  const path = points.map((p) => new kakao.maps.LatLng(p.lat, p.lng));
  const line = new kakao.maps.Polyline({
    path,
    strokeWeight,
    strokeColor: PATROL_ROUTE_CONFIG.color,
    strokeOpacity,
    strokeStyle,
  });
  line.setMap(map);
  routeLines.push(line);
}

function clearRouteLines() {
  routeLines.forEach((line) => line.setMap(null));
  routeLines = [];
}

/* 도착지 마커 */
let stopMarkerOverlays = [];

function drawStopMarkers(destination) {
  stopMarkerOverlays.forEach((overlay) => overlay.setMap(null));
  stopMarkerOverlays = [];

  if (destination) {
    const flag = `<div style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; background:${PATROL_ROUTE_CONFIG.color}; color:#fff; font-size:14px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.35);"><span style="transform:rotate(45deg);">★</span></div>`;

    const overlay = new kakao.maps.CustomOverlay({
      map,
      position: new kakao.maps.LatLng(destination.lat, destination.lng),
      content: flag,
      xAnchor: 0.5,
      yAnchor: 1,
      zIndex: 6,
    });
    stopMarkerOverlays.push(overlay);
  }
}



/* 하단 패널 인터랙션 (대기 → 로딩 → 경로 배정 완료) */

function setupPanelInteraction() {

  const panelTitle = document.getElementById("panel-title");

  const actionBtn = document.getElementById("action-btn");

  const loadingOverlay = document.getElementById("loading-overlay");

  const loadingText = loadingOverlay.querySelector(".loading-text");



  let state = "idle";



  actionBtn.addEventListener("click", async () => {

    if (state === "idle") {

      loadingText.textContent = "최적 동선 계산 중...";

      loadingOverlay.style.opacity = "1";

      loadingOverlay.classList.remove("hidden");

      actionBtn.disabled = true;



      const loadingDelay = new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS));



      try {

        const [routeResult] = await Promise.all([drawRoute(), loadingDelay]);

        const summaryText = buildRouteSummaryText(routeResult);



        loadingOverlay.style.opacity = "0";

        setTimeout(() => loadingOverlay.classList.add("hidden"), 400);



        if (summaryText) {
          panelTitle.innerHTML =
            `최적 순찰 경로 배정 완료<br><span class="panel-summary">${summaryText}</span>`;
        } else {
          panelTitle.textContent = "최적 순찰 경로 배정 완료";
        }

        actionBtn.textContent = "순찰 시작";

        actionBtn.classList.remove("btn-primary");

        actionBtn.classList.add("btn-success");

        state = "ready";

      } catch (err) {

        console.error("[동선 찾기 실패]", err);

        loadingOverlay.classList.add("hidden");

        panelTitle.textContent = "동선 계산 실패 · 다시 시도해주세요";

      } finally {

        actionBtn.disabled = false;

      }

    } else if (state === "ready") {

      window.location.href = "patrol.html";

    }

  });

}



/* 로그인된 사용자 이름 적용 */
function getLoggedInUserName() {
  return getDisplayUserName(mainUser?.name);
}

function applyProfileUser() {
  const userName = getLoggedInUserName();
  // 성을 뗀 이름 부분만 표시 ("정승우" -> "승우")
  const givenName = getGivenName(userName);
  const avatarUrl =
    "https://api.dicebear.com/7.x/initials/svg?backgroundColor=FF6F00&seed=" +
    encodeURIComponent(givenName);

  const nameEl = document.querySelector(".profile-menu-name");
  if (nameEl) nameEl.textContent = givenName;

  document.querySelectorAll("#profile-avatar, .profile-menu-avatar").forEach((img) => {
    img.src = avatarUrl;
  });
}

/* 우측 상단 원형 프로필 메뉴 토글 */
function setupProfileMenu() {
  const profileBtn = document.getElementById("profile-btn");
  const profileMenu = document.getElementById("profile-menu");
  if (!profileBtn || !profileMenu) return;

  applyProfileUser();

  const openMenu = () => {
    profileMenu.classList.remove("hidden");
    profileBtn.setAttribute("aria-expanded", "true");
  };

  const closeMenu = () => {
    profileMenu.classList.add("hidden");
    profileBtn.setAttribute("aria-expanded", "false");
  };

  profileBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = profileBtn.getAttribute("aria-expanded") === "true";
    isOpen ? closeMenu() : openMenu();
  });

  // 메뉴 바깥 클릭 시 닫기
  document.addEventListener("click", (event) => {
    if (!profileMenu.contains(event.target) && !profileBtn.contains(event.target)) {
      closeMenu();
    }
  });

  // ESC로 닫기
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  // 로그아웃: 세션 정리 후 로그인 페이지로 이동
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (event) => {
      event.preventDefault();
      logout();
    });
  }
}

/* 로그아웃 — 로그인 세션 정리 후 login.html 이동 */
function logout() {
  localStorage.removeItem("signup-name");
  localStorage.removeItem("currentUser");
  sessionStorage.clear();
  window.location.href = "login.html";
}

setupProfileMenu();
kakao.maps.load(initMap);

