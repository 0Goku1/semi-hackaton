const DEFAULT_CENTER = { lat: 37.1995, lng: 126.8312 }; // 위치 권한 거부 시 fallback (화성시청 부근)

const TARGET_ZONE_ID = "DZ_001";

const ROUTE_COLOR = "#FF5722";

const MIN_LOADING_MS = 1500;



let map;

let routePolyline = null;

const mainUser = dummyUsers.find((user) => user.isMain) || dummyUsers[0];



/* --------------------------------------------------------------------------

   현재 위치 가져오기 (실패 시 기본 좌표)

   -------------------------------------------------------------------------- */

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



/* --------------------------------------------------------------------------

   지도 초기화 (USER_001 위치 = 현재 위치)

   -------------------------------------------------------------------------- */

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

  renderDangerZones();

  setupPanelInteraction();

  setupMapRelayout();

}



/* --------------------------------------------------------------------------

   프레임 크기 변경 시 카카오맵 리사이즈

   -------------------------------------------------------------------------- */

function setupMapRelayout() {

  const relayout = () => {

    if (map) map.relayout();

  };



  window.addEventListener("resize", relayout);

  setTimeout(relayout, 100);

}



/* --------------------------------------------------------------------------

   사용자 마커 렌더링

   -------------------------------------------------------------------------- */

function renderUsers() {

  dummyUsers.forEach((user) => {

    const position = new kakao.maps.LatLng(user.lat, user.lng);



    if (user.isMain) {

      new kakao.maps.Marker({ map, position, title: `${user.name} (나)` });

      return;

    }



    const isPatrolling = user.status === "PATROLLING";

    const pin = document.createElement("div");

    pin.className = `member-pin ${isPatrolling ? "patrolling" : "resting"}`;

    pin.title = `${user.name} (${isPatrolling ? "순찰중" : "휴식중"})`;



    new kakao.maps.CustomOverlay({

      map,

      position,

      content: pin,

      xAnchor: 0.5,

      yAnchor: 0.5,

    });

  });

}



/* --------------------------------------------------------------------------

   위험지역 마커 렌더링

   -------------------------------------------------------------------------- */

function renderDangerZones() {

  dummyDangerZones.forEach((zone) => {

    const pin = document.createElement("div");

    pin.className = `danger-pin ${zone.dangerLevel.toLowerCase()}`;

    pin.title = `${zone.type} · ${zone.address}`;



    new kakao.maps.CustomOverlay({

      map,

      position: new kakao.maps.LatLng(zone.lat, zone.lng),

      content: pin,

      xAnchor: 0.5,

      yAnchor: 0.5,

    });

  });

}



function getTargetZone() {

  return dummyDangerZones.find((zone) => zone.id === TARGET_ZONE_ID);

}



/* --------------------------------------------------------------------------

   도보 길찾기 API (카카오 → OSRM → fallback 순)

   -------------------------------------------------------------------------- */

async function fetchWalkingRoute(origin, destination) {

  if (SECRETS.KAKAO_REST_KEY) {

    try {

      const kakaoRoute = await fetchKakaoWalkingRoute(origin, destination);

      return { ...kakaoRoute, provider: "kakao" };

    } catch (err) {

      console.warn("[카카오 도보 길찾기 실패] OSRM으로 대체합니다.", err);

    }

  }



  try {

    const osrmRoute = await fetchOsrmWalkingRoute(origin, destination);

    return { ...osrmRoute, provider: "osrm" };

  } catch (err) {

    console.warn("[OSRM 길찾기 실패] fallback 경로를 사용합니다.", err);

  }



  return {

    path: buildFallbackRoute(origin, destination),

    distance: estimateDistanceMeters(origin, destination),

    duration: null,

    provider: "fallback",

  };

}



async function fetchKakaoWalkingRoute(origin, destination) {

  const url = new URL("https://apis-navi.kakaomobility.com/affiliate/walking/v1/directions");

  url.searchParams.set("origin", `${origin.lng},${origin.lat}`);

  url.searchParams.set("destination", `${destination.lng},${destination.lat}`);

  url.searchParams.set("priority", "DISTANCE");

  url.searchParams.set("summary", "false");



  const res = await fetch(url.toString(), {

    headers: {

      Authorization: `KakaoAK ${SECRETS.KAKAO_REST_KEY}`,

      service: "hwaseong-patrol",

    },

  });



  if (!res.ok) throw new Error(`Kakao API ${res.status}`);



  const data = await res.json();

  const route = data.routes?.[0];

  if (!route || route.result_code !== 0) {

    throw new Error(route?.result_message || "카카오 길찾기 결과 없음");

  }



  const path = [];

  route.sections?.forEach((section) => {

    section.roads?.forEach((road) => {

      const vertexes = road.vertexes || [];

      for (let i = 0; i < vertexes.length; i += 2) {

        path.push({ lat: vertexes[i + 1], lng: vertexes[i] });

      }

    });

  });



  if (path.length < 2) throw new Error("카카오 경로 좌표 없음");



  return {

    path,

    distance: route.summary?.distance ?? null,

    duration: route.summary?.duration ?? null,

  };

}



async function fetchOsrmWalkingRoute(origin, destination) {

  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;

  const url = `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson`;



  const res = await fetch(url);

  if (!res.ok) throw new Error(`OSRM API ${res.status}`);



  const data = await res.json();

  const route = data.routes?.[0];

  if (data.code !== "Ok" || !route) throw new Error("OSRM 경로 없음");



  const path = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));



  return {

    path,

    distance: route.distance,

    duration: route.duration,

  };

}



function buildFallbackRoute(origin, destination) {

  const points = [origin];

  const steps = 12;



  for (let i = 1; i < steps; i++) {

    const t = i / steps;

    const lat = origin.lat + (destination.lat - origin.lat) * t;

    const lng = origin.lng + (destination.lng - origin.lng) * t;

    const wave = Math.sin(t * Math.PI) * 0.0012 * (i % 2 === 0 ? 1 : -1);

    points.push({ lat: lat + wave, lng: lng - wave * 0.6 });

  }



  points.push(destination);

  return points;

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



/* --------------------------------------------------------------------------

   API 경로로 Polyline 그리기

   -------------------------------------------------------------------------- */

async function drawRoute() {

  const destination = getTargetZone();

  if (!destination) return;



  const origin = { lat: mainUser.lat, lng: mainUser.lng };

  const routeResult = await fetchWalkingRoute(origin, destination);



  if (routePolyline) routePolyline.setMap(null);



  const path = routeResult.path.map((point) => new kakao.maps.LatLng(point.lat, point.lng));



  routePolyline = new kakao.maps.Polyline({

    path,

    strokeWeight: 6,

    strokeColor: ROUTE_COLOR,

    strokeOpacity: 0.95,

    strokeStyle: "solid",

  });

  routePolyline.setMap(map);



  const bounds = new kakao.maps.LatLngBounds();

  path.forEach((latlng) => bounds.extend(latlng));

  map.setBounds(bounds);



  return routeResult;

}



/* --------------------------------------------------------------------------

   하단 패널 인터랙션 (대기 → 로딩 → 경로 배정 완료)

   -------------------------------------------------------------------------- */

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



kakao.maps.load(initMap);

