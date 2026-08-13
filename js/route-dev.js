/**
 * 동선 레이어 DEV
 * - Hw_Ri 기준 화성시 전 구역 500m 격자
 * - 시작점: index와 같이 GPS 기본 / DEV 토글로 화성시청 (routeDevStartPos.js)
 */
const DEFAULT_CENTER =
  typeof RouteDevStartPos !== "undefined"
    ? RouteDevStartPos.cityHall()
    : { lat: 37.1995372034835, lng: 126.831477350332 };

let map = null;
let network = null;
let allGridsPayload = null;
let gridLayer = null;
/** 배정·마커에 쓰는 시작 좌표 (TOP me_lat/me_lng 와 동일) */
let myPos = { ...DEFAULT_CENTER };
let mePosSource = "gps";
let meMarkerOverlay = null;
let state = "idle";
let routeOverlays = [];
let startPosBusy = false;

function typeLabel(t) {
  return (typeof ROUTE_DEV_TYPE_KO !== "undefined" && ROUTE_DEV_TYPE_KO[t]) || t;
}

function priorityGrids() {
  const fromAll =
    allGridsPayload && allGridsPayload.grids
      ? allGridsPayload.grids.filter((g) => g.is_priority)
      : [];
  if (fromAll.length) {
    return fromAll
      .slice()
      .sort((a, b) => (a.risk_rank || 99) - (b.risk_rank || 99));
  }
  return typeof ROUTE_DEV_GRIDS !== "undefined"
    ? ROUTE_DEV_GRIDS.slice().sort((a, b) => a.rank - b.rank)
    : [];
}

function hideSplash(msg) {
  const splash = document.getElementById("route-dev-splash");
  if (!splash) return;
  if (msg) {
    const t = splash.querySelector(".route-dev-splash-text");
    if (t) t.textContent = msg;
  }
  splash.classList.add("fade-out");
  setTimeout(() => splash.parentNode && splash.remove(), 400);
}

function syncDevStartPosUi() {
  const R = window.RouteDevStartPos;
  if (!R) return;
  const btn = document.getElementById("btn-dev-start-pos");
  const chip = document.getElementById("dev-start-status");
  const hall = R.isHallMode();
  if (btn) {
    btn.textContent = R.buttonLabel();
    btn.dataset.mode = R.getMode();
    btn.classList.toggle("is-on", hall);
    btn.setAttribute("aria-pressed", hall ? "true" : "false");
    btn.disabled = !!startPosBusy;
  }
  if (chip) {
    const fb =
      mePosSource === "gps" &&
      Math.abs(myPos.lat - DEFAULT_CENTER.lat) < 1e-6 &&
      Math.abs(myPos.lng - DEFAULT_CENTER.lng) < 1e-6
        ? " (GPS 폴백)"
        : "";
    chip.textContent = `${R.statusLabel()}${fb} · ${R.formatCoords(myPos.lat, myPos.lng)}`;
    chip.classList.toggle("is-dev-hall", hall);
    chip.classList.toggle("is-gps", !hall);
  }
}

function drawMeMarker() {
  if (!map) return;
  const ll = new kakao.maps.LatLng(myPos.lat, myPos.lng);
  if (meMarkerOverlay) {
    try {
      meMarkerOverlay.setPosition(ll);
      meMarkerOverlay.setMap(map);
      return;
    } catch (_) {
      try {
        meMarkerOverlay.setMap(null);
      } catch (_) {
        /* ignore */
      }
      meMarkerOverlay = null;
    }
  }
  const name =
    typeof getDisplayUserName === "function" ? getDisplayUserName("정승우") : "정승우";
  const content =
    typeof createMeMarkerElement === "function"
      ? createMeMarkerElement(name)
      : name;
  meMarkerOverlay = new kakao.maps.CustomOverlay({
    map,
    position: ll,
    content,
    xAnchor: 0.5,
    yAnchor: 0.5,
    zIndex: 20,
  });
}

/** index처럼 내 위치(또는 시청) 중심으로 주변 표시 */
function focusStartOnMap() {
  if (!map) return;
  drawMeMarker();
  map.setLevel(5);
  map.setCenter(new kakao.maps.LatLng(myPos.lat, myPos.lng));
}

function resetAssignmentForNewStart() {
  clearRouteOverlays();
  lastMyRoute = null;
  state = "idle";
  document.getElementById("btn-start-patrol")?.classList.add("hidden");
  const actionBtn = document.getElementById("action-btn");
  if (actionBtn) {
    actionBtn.textContent = "동선 찾기";
    actionBtn.disabled = false;
  }
}

async function applyResolvedStart() {
  const R = window.RouteDevStartPos;
  if (!R) {
    myPos = { ...DEFAULT_CENTER };
    mePosSource = "gps";
    return myPos;
  }
  const pos = await R.resolveStart();
  myPos = { lat: pos.lat, lng: pos.lng };
  mePosSource = pos.mode;
  return myPos;
}

/**
 * 토글:
 * - 기본(GPS): 버튼 "시청으로 이동" (꺼짐)
 * - 클릭 → 시청 모드, 버튼 점등 + "내 위치로 이동"
 * - 다시 클릭 → GPS, 점등 해제 + "시청으로 이동"
 * myPos 가 곧 TOP me_lat/me_lng
 */
async function toggleDevStartPos() {
  const R = window.RouteDevStartPos;
  if (!R || startPosBusy) return;
  startPosBusy = true;
  syncDevStartPosUi();

  try {
    const goingToHall = !R.isHallMode();
    R.setMode(goingToHall ? R.MODE_HALL : R.MODE_GPS);

    if (goingToHall) {
      myPos = R.cityHall();
      mePosSource = R.MODE_HALL;
    } else {
      const gps = R.getCachedGps() || (await R.fetchGps());
      if (gps) {
        myPos = { lat: gps.lat, lng: gps.lng };
        mePosSource = R.MODE_GPS;
      } else {
        // index와 동일: GPS 실패 시 시청 좌표 폴백 (모드는 gps)
        myPos = R.cityHall();
        mePosSource = R.MODE_GPS;
      }
    }

    resetAssignmentForNewStart();
    focusStartOnMap();
    syncDevStartPosUi();

    const title = document.getElementById("panel-title");
    if (title) {
      title.innerHTML =
        `${R.statusLabel()}<br>` +
        `<span class="panel-summary">이 좌표로 동선 찾기 · ${R.formatCoords(
          myPos.lat,
          myPos.lng
        )}</span>`;
    }
  } finally {
    startPosBusy = false;
    syncDevStartPosUi();
  }
}

window.__routeDevToggleStartPos = toggleDevStartPos;

async function loadAssets() {
  const base = "route-dev-data";
  const [netRes, trailRes, roadRes, gridsRes] = await Promise.all([
    fetch(`${base}/route_dev_network.json`),
    fetch(`${base}/route_dev_trails.geojson`),
    fetch(`${base}/route_dev_roads.geojson`),
    fetch(`${base}/route_dev_hwaseong_grids.json`),
  ]);

  if (!gridsRes.ok) {
    throw new Error(
      "route_dev_hwaseong_grids.json 로드 실패 — python analysis/16_export_hwaseong_grids.py 후 HTTP로 여세요"
    );
  }
  allGridsPayload = await gridsRes.json();

  if (netRes.ok) network = await netRes.json();
  else network = { grids: [], nodes: [], edges: [], meta: {} };

  const trails = trailRes.ok ? await trailRes.json() : null;
  const roads = roadRes.ok ? await roadRes.json() : null;
  return { trails, roads };
}

function drawGeoLines(fc, color, weight) {
  if (!fc || !fc.features || !map) return;
  fc.features.forEach((f) => {
    const g = f.geometry;
    if (!g) return;
    const lines =
      g.type === "LineString"
        ? [g.coordinates]
        : g.type === "MultiLineString"
          ? g.coordinates
          : [];
    lines.forEach((coords) => {
      if (!coords || coords.length < 2) return;
      const path = coords.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng));
      new kakao.maps.Polyline({
        path,
        strokeWeight: weight,
        strokeColor: color,
        strokeOpacity: 0.7,
        strokeStyle: "solid",
        zIndex: 1,
      }).setMap(map);
    });
  });
}

function clearRouteOverlays() {
  routeOverlays.forEach((o) => o.setMap && o.setMap(null));
  routeOverlays = [];
}

function openGridInfo(g) {
  const body = document.getElementById("grid-info-body");
  const sheet = document.getElementById("grid-info-sheet");
  const backdrop = document.getElementById("sheet-backdrop");
  if (!body || !sheet) return;
  body.innerHTML =
    typeof formatGridInfoHtml === "function" ? formatGridInfoHtml(g) : "";
  sheet.classList.add("open");
  sheet.setAttribute("aria-hidden", "false");
  backdrop?.classList.add("open");
  closeRankDetail();
}

function closeGridInfo() {
  const sheet = document.getElementById("grid-info-sheet");
  const backdrop = document.getElementById("sheet-backdrop");
  sheet?.classList.remove("open");
  sheet?.setAttribute("aria-hidden", "true");
  if (!document.getElementById("detail-sheet")?.classList.contains("open")) {
    backdrop?.classList.remove("open");
  }
}

function openRankDetail() {
  document.getElementById("detail-sheet")?.classList.add("open");
  document.getElementById("sheet-backdrop")?.classList.add("open");
  closeGridInfo();
  document.getElementById("detail-sheet")?.setAttribute("aria-hidden", "false");
}

function closeRankDetail() {
  document.getElementById("detail-sheet")?.classList.remove("open");
  document.getElementById("detail-sheet")?.setAttribute("aria-hidden", "true");
  if (!document.getElementById("grid-info-sheet")?.classList.contains("open")) {
    document.getElementById("sheet-backdrop")?.classList.remove("open");
  }
}

function closeAllSheets() {
  closeGridInfo();
  closeRankDetail();
  closeOfficerSheet();
  document.getElementById("sheet-backdrop")?.classList.remove("open");
}

function renderRankUi() {
  const list = document.getElementById("rank-list");
  const detail = document.getElementById("detail-list");
  const ranked = priorityGrids();
  const top5 = ranked.slice(0, 5);

  if (list) {
    list.innerHTML = top5
      .map((g) => {
        const rank = g.risk_rank || g.rank || "";
        const score = g.score != null ? g.score : "";
        return `<li><button type="button" class="rank-item" data-grid-id="${g.grid_id}">
          <span class="rank-num">${rank}</span>
          <span class="rank-meta">
            <span class="rank-grid">${g.grid_id}</span>
            <span class="rank-score">HIGH${score !== "" ? " · " + score : ""}</span>
          </span>
        </button></li>`;
      })
      .join("");
    list.querySelectorAll(".rank-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        gridLayer?.focus(btn.dataset.gridId, { openInfo: false });
      });
      btn.addEventListener("dblclick", (e) => {
        e.preventDefault();
        gridLayer?.focus(btn.dataset.gridId, { openInfo: true });
      });
    });
  }

  if (detail) {
    detail.innerHTML = ranked
      .map((g) => {
        const rank = g.risk_rank || g.rank || "";
        const typeKo = g.primary_type_ko || typeLabel(g.type);
        const emd = (g.emd_names && g.emd_names[0]) || g.emd_name || "";
        return `<li><button type="button" class="detail-item" data-grid-id="${g.grid_id}">
          <span class="detail-rank">${rank}</span>
          <span class="detail-body">
            <strong>${g.grid_id}</strong>
            <span>${emd} · ${typeKo}</span>
          </span>
          <span class="detail-badge">위험도 높음</span>
        </button></li>`;
      })
      .join("");
    detail.querySelectorAll(".detail-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        gridLayer?.focus(btn.dataset.gridId, { openInfo: true });
        closeRankDetail();
      });
    });
  }
}

function updatePanelIdle() {
  const title = document.getElementById("panel-title");
  const m = allGridsPayload?.meta || {};
  const n = m.count || gridLayer?.size || 0;
  const farm = m.farm_count || 0;
  const p = m.priority_count || 0;
  if (title) {
    title.innerHTML =
      `화성 격자 ${n.toLocaleString()} · 농지 ${farm.toLocaleString()} · 우선 ${p}<br>` +
      `<span class="panel-summary">Hw_Ri · 더블클릭 상세 · 빨간 테두리 = 위험(방문 목표)</span>`;
  }
  syncDevStartPosUi();
}

function drawAssignRoute(myRoute) {
  clearRouteOverlays();
  if (!myRoute) return;
  const bounds = new kakao.maps.LatLngBounds();

  (myRoute.legs || []).forEach((leg) => {
    const coords = leg.coords || [];
    if (coords.length < 2) return;
    const color =
      leg.mode === "vehicle" ? "#1E88E5" : leg.mode === "trail" ? "#2E7D32" : "#FF6F00";
    const path = coords.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng));
    path.forEach((pt) => bounds.extend(pt));
    const line = new kakao.maps.Polyline({
      path,
      strokeWeight: leg.mode === "access" ? 4 : 6,
      strokeColor: color,
      strokeOpacity: 0.92,
      strokeStyle: leg.mode === "access" ? "shortdash" : "solid",
      zIndex: 12,
    });
    line.setMap(map);
    routeOverlays.push(line);
  });

  (myRoute.stops || []).forEach((s, idx) => {
    const pos = new kakao.maps.LatLng(s.lat, s.lon);
    bounds.extend(pos);
    const flag =
      `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;` +
      `background:#FF5722;color:#fff;font-size:11px;font-weight:800;border-radius:50% 50% 50% 0;` +
      `transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);">` +
      `<span style="transform:rotate(45deg);">${idx + 1}</span></div>`;
    routeOverlays.push(
      new kakao.maps.CustomOverlay({
        map,
        position: pos,
        content: flag,
        xAnchor: 0.5,
        yAnchor: 1,
        zIndex: 15,
      })
    );
    if (gridLayer && gridLayer.select) gridLayer.select(s.grid_id);
  });

  if (!bounds.isEmpty()) map.setBounds(bounds);
}

let lastMyRoute = null;
let officersDoc = null;
let officerFilter = "all"; // all | available | unavailable

function openOfficerSheet() {
  document.getElementById("officer-sheet")?.classList.add("open");
  document.getElementById("sheet-backdrop")?.classList.add("open");
  closeGridInfo();
  closeRankDetail();
  renderOfficers();
}

function closeOfficerSheet() {
  document.getElementById("officer-sheet")?.classList.remove("open");
  if (
    !document.getElementById("grid-info-sheet")?.classList.contains("open") &&
    !document.getElementById("detail-sheet")?.classList.contains("open")
  ) {
    document.getElementById("sheet-backdrop")?.classList.remove("open");
  }
}

function cycleOfficerFilter() {
  const order = ["all", "available", "unavailable"];
  const labels = { all: "전체", available: "가용만", unavailable: "비가용만" };
  officerFilter = order[(order.indexOf(officerFilter) + 1) % order.length];
  const btn = document.getElementById("btn-officer-filter");
  if (btn) {
    btn.dataset.mode = officerFilter;
    btn.textContent = labels[officerFilter];
  }
  renderOfficers();
}

function renderOfficers() {
  const list = document.getElementById("officer-list");
  const sum = document.getElementById("officer-summary");
  if (!list || !officersDoc) return;
  const officers = officersDoc.officers || [];
  const avail = officers.filter((o) => o.available).length;
  const filtered = officers.filter((o) => {
    if (officerFilter === "available") return !!o.available;
    if (officerFilter === "unavailable") return !o.available;
    return true;
  });

  if (!filtered.length) {
    list.innerHTML =
      `<li class="officer-row"><div class="meta">표시할 요원이 없습니다</div></li>`;
  } else {
    list.innerHTML = filtered
      .map(
        (o) => `<li class="officer-row">
      <div>
        <div class="name">${o.name}${o.is_me ? " (나)" : ""}</div>
        <div class="meta">${o.id}</div>
      </div>
      <div class="officer-row-actions">
        <button type="button" class="officer-toggle ${o.available ? "on" : "off"}" data-id="${o.id}">
          ${o.available ? "가용" : "비가용"}
        </button>
        <button type="button" class="officer-del" data-del="${o.id}" aria-label="삭제" ${o.is_me ? "disabled" : ""}>×</button>
      </div>
    </li>`
      )
      .join("");
  }

  if (sum) {
    sum.textContent = `총 ${officers.length} · 가용 ${avail} · 비가용 ${officers.length - avail}`;
  }

  list.querySelectorAll(".officer-toggle").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const o = officers.find((x) => x.id === id);
      if (!o) return;
      const next = !o.available;
      try {
        await PatrolApi.patchOfficer(id, { available: next });
        o.available = next;
        renderOfficers();
      } catch (e) {
        alert("요원 상태 변경 실패: " + e.message);
      }
    });
  });

  list.querySelectorAll(".officer-del").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.del;
      if (!id || !confirm(`요원 ${id} 을(를) 삭제할까요?`)) return;
      try {
        await PatrolApi.deleteOfficer(id);
        officersDoc.officers = officers.filter((x) => x.id !== id);
        renderOfficers();
      } catch (e) {
        alert("삭제 실패: " + e.message);
      }
    });
  });
}

async function loadOfficersSafe() {
  try {
    officersDoc = await PatrolApi.getOfficers();
    renderOfficers();
  } catch (e) {
    console.warn("[officers]", e);
    officersDoc = null;
  }
}

async function onAddOfficer(e) {
  e.preventDefault();
  const nameEl = document.getElementById("officer-add-name");
  const availEl = document.getElementById("officer-add-available");
  const name = (nameEl?.value || "").trim();
  if (!name) return;
  try {
    const res = await PatrolApi.addOfficer({
      name,
      available: !!availEl?.checked,
      lat: myPos?.lat ?? 37.1995,
      lng: myPos?.lng ?? 126.8312,
      is_me: false,
    });
    if (!officersDoc) officersDoc = { officers: [] };
    officersDoc.officers.push(res.officer);
    if (nameEl) nameEl.value = "";
    renderOfficers();
    const listEl = document.getElementById("officer-list");
    if (listEl) listEl.scrollTop = listEl.scrollHeight;
  } catch (err) {
    alert("추가 실패: " + err.message);
  }
}

async function runFindRoute() {
  const btn = document.getElementById("action-btn");
  const startBtn = document.getElementById("btn-start-patrol");
  const title = document.getElementById("panel-title");
  const loading = document.getElementById("loading-overlay");
  const loadText = loading?.querySelector(".loading-text");

  if (loading) loading.classList.remove("hidden");
  if (loadText) loadText.textContent = "OR-Tools TOP 배정 중…";
  if (btn) btn.disabled = true;
  if (startBtn) startBtn.classList.add("hidden");
  state = "loading";

  try {
    // 토글된 현재 myPos 를 배정 시작점으로 사용 (필요 시 GPS 캐시 갱신)
    await applyResolvedStart();
    focusStartOnMap();
    syncDevStartPosUi();
    const startHint =
      typeof RouteDevStartPos !== "undefined"
        ? ` · ${RouteDevStartPos.statusLabel()}`
        : "";
    const result = await PatrolApi.assign({
      me_lat: myPos.lat,
      me_lng: myPos.lng,
      enrich_geometry: true,
      time_limit_s: 2.0,
    });
    if (!result.ok) throw new Error(result.error || "배정 실패");

    const my = result.routes.find((r) => r.is_me) || result.routes[0] || null;
    lastMyRoute = my;
    drawAssignRoute(my);

    const nAvail = (officersDoc?.officers || []).filter((o) => o.available).length;
    const assignedStops = result.routes.reduce((a, r) => a + (r.stops?.length || 0), 0);
    const myStops = (my?.stops || []).length;
    const emptyHint =
      myStops === 0 && assignedStops > 0
        ? " · 내 배정 0(다른 요원에 배분·또는 시작점 원거리)"
        : "";
    if (title) {
      title.innerHTML =
        `내 동선 ${myStops}격자 · ${Math.round(my?.minutes || 0)}분<br>` +
        `<span class="panel-summary">OR-Tools · 가용 ${nAvail}명 · 전체배정 ${assignedStops}` +
        ` · 미배정 ${result.unassigned?.length || 0}` +
        ` · ${result.meta?.elapsed_s ?? "?"}s${startHint}${emptyHint}</span>`;
    }
    if (startBtn && my?.stops?.length) startBtn.classList.remove("hidden");
    if (btn) {
      btn.textContent = "다시 배정";
      btn.disabled = false;
    }
    state = "ready";
    localStorage.setItem("routeDevAssignment", JSON.stringify({ at: Date.now(), result, my }));
  } catch (err) {
    console.error(err);
    if (title) {
      title.innerHTML =
        `배정 API 실패<br><span class="panel-summary">${err.message}<br>` +
        `서버: cd server && uvicorn main:app --port 8000</span>`;
    }
    if (btn) btn.disabled = false;
    state = "idle";
  } finally {
    if (loading) loading.classList.add("hidden");
  }
}

function startPatrolFromAssignment() {
  if (!lastMyRoute?.stops?.length) {
    alert("먼저 동선 찾기로 배정하세요.");
    return;
  }
  const session = {
    officer_id: lastMyRoute.officer_id,
    officer_name: lastMyRoute.officer_name,
    minutes: lastMyRoute.minutes,
    stops: lastMyRoute.stops.map((s) => ({ ...s, status: "pending" })),
    legs: lastMyRoute.legs || [],
    started_at: Date.now(),
  };
  localStorage.setItem("patrolSession", JSON.stringify(session));
  window.location.href = "patrol-run.html";
}

function initGridLayer() {
  const grids = allGridsPayload?.grids || [];
  if (!grids.length || typeof createRouteDevGridLayer !== "function") {
    console.warn("[route-dev] 전체 격자 데이터 없음");
    return;
  }

  gridLayer = createRouteDevGridLayer({
    map,
    grids,
    onSelect: (g) => {
      document.querySelectorAll(".rank-item, .detail-item").forEach((el) => {
        el.classList.toggle("is-active", el.dataset.gridId === g.grid_id);
      });
      const title = document.getElementById("panel-title");
      if (title && state === "idle") {
        title.innerHTML =
          `선택 ${g.grid_id}<br>` +
          `<span class="panel-summary">${g.primary_type_ko} · 더블클릭 시 상세</span>`;
      }
    },
    onOpenInfo: (g) => openGridInfo(g),
  });
  gridLayer.draw();
  // fitAll 하지 않음 — index 동선찾기처럼 내 위치(시작점) 주변만 표시
  focusStartOnMap();
}

let uiEventsBound = false;

function bindUiEvents() {
  if (uiEventsBound) return;
  uiEventsBound = true;

  window.__routeDevToggleStartPos = toggleDevStartPos;

  document.getElementById("btn-open-detail")?.addEventListener("click", openRankDetail);
  document.getElementById("btn-close-detail")?.addEventListener("click", closeRankDetail);
  document.getElementById("btn-close-grid-info")?.addEventListener("click", closeGridInfo);
  document.getElementById("btn-officers")?.addEventListener("click", openOfficerSheet);
  document.getElementById("btn-close-officers")?.addEventListener("click", closeOfficerSheet);
  document.getElementById("btn-officer-filter")?.addEventListener("click", cycleOfficerFilter);
  document.getElementById("officer-add-form")?.addEventListener("submit", onAddOfficer);
  document.getElementById("btn-start-patrol")?.addEventListener("click", startPatrolFromAssignment);
  document.getElementById("sheet-backdrop")?.addEventListener("click", closeAllSheets);
  document.getElementById("action-btn")?.addEventListener("click", () => {
    if (state === "idle" || state === "ready") runFindRoute();
  });
  window.addEventListener("resize", () => map && map.relayout());
}

async function init() {
  bindUiEvents();

  // index와 동일: 먼저 GPS(또는 시청 모드면 시청)로 중심 잡기
  const R = window.RouteDevStartPos;
  if (R && R.isHallMode()) {
    myPos = R.cityHall();
    mePosSource = R.MODE_HALL;
  } else if (R) {
    const gps = await R.fetchGps();
    if (gps) {
      myPos = gps;
      mePosSource = R.MODE_GPS;
    } else {
      myPos = { ...DEFAULT_CENTER };
      mePosSource = R.MODE_GPS;
    }
  }

  map = new kakao.maps.Map(document.getElementById("map"), {
    center: new kakao.maps.LatLng(myPos.lat, myPos.lng),
    level: 5,
    disableDoubleClickZoom: true,
  });
  focusStartOnMap();
  syncDevStartPosUi();

  // 로드 전에 눌러 둔 클릭 처리
  const pendingBtn = document.getElementById("btn-dev-start-pos");
  if (pendingBtn?.dataset.pendingClick === "1") {
    delete pendingBtn.dataset.pendingClick;
    toggleDevStartPos();
  }

  let trails = null;
  let roads = null;
  try {
    ({ trails, roads } = await loadAssets());
    const m = network?.meta || {};
    const gm = allGridsPayload?.meta || {};
    const metaEl = document.getElementById("net-meta");
    if (metaEl) {
      metaEl.textContent =
        `화성 ${gm.count?.toLocaleString?.() || "?"}격자 · 리 ${gm.ri_count || "?"} · 등산로 ${m.trail_km || "?"}km`;
    }
  } catch (e) {
    console.warn(e);
    hideSplash(String(e.message || e));
    allGridsPayload = { meta: { count: 0 }, grids: [] };
    network = { grids: [], nodes: [], edges: [], meta: {} };
  }

  if (trails) drawGeoLines(trails, "#2E7D32", 3);
  if (roads) drawGeoLines(roads, "#5D4037", 3);
  initGridLayer();
  renderRankUi();
  updatePanelIdle();
  await loadOfficersSafe();
  focusStartOnMap();
  syncDevStartPosUi();

  setTimeout(() => map && map.relayout(), 200);
  hideSplash();
}

if (typeof kakao !== "undefined" && kakao.maps) {
  kakao.maps.load(init);
} else {
  bindUiEvents();
  hideSplash("카카오 SDK 없음");
}
