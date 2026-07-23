/**
 * 메인 지도 (index.html)
 * - JWT 세션 확인
 * - 카카오맵 + 위험구역 + 팀원 마커
 * - 동선 찾기 (patrolRoute.js)
 */
const DEFAULT_CENTER = { lat: 37.1995, lng: 126.8312 }; // 화성시청 fallback

let map;
let routeLines = [];
let stopMarkerOverlays = [];
let state = "idle";
let mainUser =
  (typeof dummyUsers !== "undefined" && dummyUsers.find((u) => u.isMain)) ||
  { name: "정승우", isMain: true, lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng };

const DANGER_LEVEL_KEY = {
  "위험도 높음": "HIGH",
  "위험도 중간": "MEDIUM",
  "위험도 낮음": "LOW",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

const DANGER_ZONE_STYLE = {
  HIGH: { radius: 300, color: "#ff3b30", strokeStyle: "solid" },
  MEDIUM: { radius: 300, color: "#ff9500", strokeStyle: "solid" },
  LOW: { radius: 300, color: "#34c759", strokeStyle: "dashed" },
};

function hideSplash() {
  const splash = document.getElementById("app-splash");
  if (!splash) return;
  splash.classList.add("fade-out");
  setTimeout(() => {
    if (splash.parentNode) splash.remove();
  }, 400);
}

function hideAppSplashWhenReady() {
  const splash = document.getElementById("app-splash");
  if (!splash) return;

  let hidden = false;
  const hide = () => {
    if (hidden) return;
    hidden = true;
    hideSplash();
  };

  if (map && typeof kakao !== "undefined") {
    kakao.maps.event.addListener(map, "tilesloaded", hide);
  }
  setTimeout(hide, 2500);
}

function applyLoggedInProfile() {
  if (typeof ApiClient === "undefined") return;
  if (!ApiClient.getToken()) {
    window.location.replace("login.html");
    return false;
  }

  const user = ApiClient.getCurrentUser();
  if (user && user.name) {
    const given =
      typeof getGivenName === "function" ? getGivenName(user.name) : user.name;
    const nameEl = document.querySelector(".profile-menu-name");
    if (nameEl) nameEl.textContent = user.name;
    const avatar = document.getElementById("profile-avatar");
    const menuAvatar = document.querySelector(".profile-menu-avatar");
    const url =
      typeof getProfileAvatarUrl === "function" ? getProfileAvatarUrl(given) : null;
    if (url && avatar) avatar.src = url;
    if (url && menuAvatar) menuAvatar.src = url;
  }
  return true;
}

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
      () => resolve(DEFAULT_CENTER),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

function getDangerZoneStyle(dangerLevel) {
  const key = DANGER_LEVEL_KEY[dangerLevel] || "LOW";
  return DANGER_ZONE_STYLE[key];
}

function drawDangerZones() {
  if (typeof dummyDangerZones === "undefined" || !map) return;

  dummyDangerZones.forEach((h) => {
    const { radius, color, strokeStyle } = getDangerZoneStyle(h.dangerLevel);
    const center = new kakao.maps.LatLng(h.lat, h.lng);

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

    const labelHtml =
      `<div style="margin-left:14px;font-size:10px;font-weight:700;color:${color};` +
      `background:rgba(255,255,255,0.88);padding:3px 8px;border-radius:10px;` +
      `border:1.5px solid ${color}44;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.15);` +
      `pointer-events:none;line-height:1.35;">${h.type}<br>` +
      `<span style="font-size:9px;font-weight:800;">${h.dangerLevel}</span></div>`;

    new kakao.maps.CustomOverlay({
      map,
      position: center,
      content: labelHtml,
      xAnchor: 0,
      yAnchor: 0.5,
      clickable: false,
      zIndex: 3,
    });
  });
}

function renderUsers() {
  if (typeof dummyUsers === "undefined" || !map) return;
  const displayName =
    typeof getDisplayUserName === "function"
      ? getDisplayUserName(mainUser.name)
      : mainUser.name;

  dummyUsers.forEach((user) => {
    const position = new kakao.maps.LatLng(user.lat, user.lng);
    const content = user.isMain
      ? typeof createMeMarkerElement === "function"
        ? createMeMarkerElement(displayName)
        : displayName
      : typeof createMemberMarkerElement === "function"
        ? createMemberMarkerElement(user)
        : user.name;

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

function setupMapRelayout() {
  const relayout = () => {
    if (map) map.relayout();
  };
  window.addEventListener("resize", relayout);
  setTimeout(relayout, 100);
  setTimeout(relayout, 500);
}

async function initMap() {
  const myPos = await getMyPosition();
  mainUser.lat = myPos.lat;
  mainUser.lng = myPos.lng;

  if (typeof dummyUsers !== "undefined") {
    const me = dummyUsers.find((u) => u.isMain);
    if (me) {
      me.lat = myPos.lat;
      me.lng = myPos.lng;
    }
  }

  const container = document.getElementById("map");
  if (!container) {
    hideSplash();
    return;
  }

  map = new kakao.maps.Map(container, {
    center: new kakao.maps.LatLng(myPos.lat, myPos.lng),
    level: 5,
  });

  renderUsers();
  drawDangerZones();
  setupMapRelayout();
  hideAppSplashWhenReady();
}

function clearRouteLines() {
  routeLines.forEach((line) => line.setMap(null));
  routeLines = [];
}

function drawRouteLine(points) {
  if (!map || !points || points.length < 2) return;
  const color =
    (typeof PATROL_ROUTE_CONFIG !== "undefined" && PATROL_ROUTE_CONFIG.color) ||
    "#FF5722";
  const path = points.map((p) => new kakao.maps.LatLng(p.lat, p.lng));
  const line = new kakao.maps.Polyline({
    path,
    strokeWeight: 6,
    strokeColor: color,
    strokeOpacity: 0.95,
    strokeStyle: "solid",
  });
  line.setMap(map);
  routeLines.push(line);
}

function drawStopMarkers(destination) {
  stopMarkerOverlays.forEach((o) => o.setMap(null));
  stopMarkerOverlays = [];
  if (!destination || !map) return;

  const color =
    (typeof PATROL_ROUTE_CONFIG !== "undefined" && PATROL_ROUTE_CONFIG.color) ||
    "#FF5722";
  const flag =
    `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;` +
    `background:${color};color:#fff;font-size:14px;border-radius:50% 50% 50% 0;` +
    `transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);">` +
    `<span style="transform:rotate(45deg);">🏁</span></div>`;

  stopMarkerOverlays.push(
    new kakao.maps.CustomOverlay({
      map,
      position: new kakao.maps.LatLng(destination.lat, destination.lng),
      content: flag,
      xAnchor: 0.5,
      yAnchor: 1,
      zIndex: 6,
    })
  );
}

function estimateDistanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

async function drawRoute() {
  const origin = { lat: mainUser.lat, lng: mainUser.lng };
  clearRouteLines();

  if (typeof buildPatrolRoutePoints !== "function") {
    return { distance: 1200, duration: 900 };
  }

  const { points, destination } = await buildPatrolRoutePoints(origin);
  if (points.length >= 2) drawRouteLine(points);
  drawStopMarkers(destination);

  let totalDistance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalDistance += estimateDistanceMeters(points[i], points[i + 1]);
  }

  const bounds = new kakao.maps.LatLngBounds();
  points.forEach((p) => bounds.extend(new kakao.maps.LatLng(p.lat, p.lng)));
  map.setBounds(bounds);

  return {
    distance: totalDistance,
    duration: Math.round((totalDistance / 4000) * 3600),
  };
}

async function simulateRouteDrawing() {
  const actionBtn = document.getElementById("action-btn");
  const panelTitle = document.getElementById("panel-title");
  const loadingOverlay = document.getElementById("loading-overlay");

  if (loadingOverlay) loadingOverlay.classList.remove("hidden");
  if (actionBtn) actionBtn.disabled = true;

  let summary = "1.2km · 약 15분";
  try {
    if (map && typeof kakao !== "undefined") {
      const result = await drawRoute();
      const km = (result.distance / 1000).toFixed(1);
      const min = Math.max(1, Math.round(result.duration / 60));
      summary = `${km}km · 약 ${min}분`;
    } else {
      await new Promise((r) => setTimeout(r, 800));
    }
  } catch (err) {
    console.warn("route draw failed", err);
    await new Promise((r) => setTimeout(r, 500));
  }

  if (loadingOverlay) loadingOverlay.classList.add("hidden");
  if (panelTitle) {
    panelTitle.innerHTML =
      `최적 순찰 경로 배정 완료<br><span class="panel-summary">${summary}</span>`;
  }
  if (actionBtn) {
    actionBtn.textContent = "순찰 시작";
    actionBtn.classList.remove("btn-primary");
    actionBtn.classList.add("btn-success");
    state = "ready";
    actionBtn.disabled = false;
  }
}

function setupPanelInteraction() {
  const actionBtn = document.getElementById("action-btn");
  if (!actionBtn) return;

  actionBtn.addEventListener("click", async () => {
    if (state === "idle") {
      state = "loading";
      await simulateRouteDrawing();
    } else if (state === "ready") {
      window.location.href = "patrol.html";
    }
  });
}

function setupProfileMenuNavigation() {
  const profileBtn = document.getElementById("profile-btn");
  const profileMenu = document.getElementById("profile-menu");
  if (!profileBtn || !profileMenu) return;

  profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    profileMenu.classList.toggle("hidden");
  });

  document.addEventListener("click", () => {
    profileMenu.classList.add("hidden");
  });

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof ApiClient !== "undefined") ApiClient.clearSession();
      else {
        localStorage.removeItem("currentUser");
        localStorage.removeItem("accessToken");
      }
      window.location.replace("login.html");
    });
  }
}

function startApp() {
  if (!applyLoggedInProfile()) return;

  setupPanelInteraction();
  setupProfileMenuNavigation();

  if (typeof kakao === "undefined" || !kakao.maps) {
    console.warn("Kakao Maps SDK missing");
    setTimeout(hideSplash, 800);
    return;
  }

  kakao.maps.load(function () {
    initMap().catch((err) => {
      console.error(err);
      hideSplash();
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}
