/**
 * 활성 순찰 — 할당 격자 체크 / 실시간 완료 풀 반영 / 일괄 보고서
 */
let session = null;
let map = null;
let overlays = [];

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem("patrolSession") || "null");
  } catch (e) {
    return null;
  }
}

function saveSession(s) {
  localStorage.setItem("patrolSession", JSON.stringify(s));
}

function hideSplash() {
  const el = document.getElementById("patrol-run-splash");
  if (!el) return;
  el.classList.add("fade-out");
  setTimeout(() => el.remove(), 400);
}

function clearOverlays() {
  overlays.forEach((o) => o.setMap && o.setMap(null));
  overlays = [];
}

function drawSessionOnMap() {
  if (!map || !session) return;
  clearOverlays();
  const bounds = new kakao.maps.LatLngBounds();

  (session.legs || []).forEach((leg) => {
    const coords = leg.coords || [];
    if (coords.length < 2) return;
    const color =
      leg.mode === "vehicle" ? "#1E88E5" : leg.mode === "trail" ? "#2E7D32" : "#FF6F00";
    const path = coords.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng));
    path.forEach((p) => bounds.extend(p));
    const line = new kakao.maps.Polyline({
      path,
      strokeWeight: leg.mode === "access" ? 4 : 6,
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeStyle: leg.mode === "access" ? "shortdash" : "solid",
    });
    line.setMap(map);
    overlays.push(line);
  });

  (session.stops || []).forEach((s, i) => {
    const done = s.status === "done";
    const pos = new kakao.maps.LatLng(s.lat, s.lon);
    bounds.extend(pos);
    const html =
      `<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;` +
      `font-size:12px;font-weight:800;color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);` +
      `background:${done ? "#2E7D32" : "#ff3b30"};">${i + 1}</div>`;
    overlays.push(
      new kakao.maps.CustomOverlay({
        map,
        position: pos,
        content: html,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 10,
      })
    );
  });

  if (!bounds.isEmpty()) map.setBounds(bounds);
}

function renderStopList() {
  const list = document.getElementById("stop-list");
  if (!list || !session) return;
  list.innerHTML = (session.stops || [])
    .map((s, i) => {
      const done = s.status === "done";
      return `<li class="stop-row ${done ? "done" : ""}">
        <label>
          <input type="checkbox" data-grid-id="${s.grid_id}" ${done ? "checked disabled" : ""} />
          <span class="stop-idx">${i + 1}</span>
          <span class="stop-body">
            <strong>${s.grid_id}</strong>
            <small>score ${s.score} · ${s.access_type || "enter"}</small>
          </span>
        </label>
      </li>`;
    })
    .join("");

  list.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", async () => {
      if (!cb.checked) return;
      await markStopDone(cb.dataset.gridId);
    });
  });

  updateProgress();
}

function updateProgress() {
  const stops = session?.stops || [];
  const done = stops.filter((s) => s.status === "done").length;
  const el = document.getElementById("progress-text");
  if (el) el.textContent = `${done} / ${stops.length} 구역 확인`;
  const btn = document.getElementById("btn-finish-report");
  if (btn) btn.disabled = !(stops.length && done === stops.length);
}

async function markStopDone(gridId) {
  const stop = session.stops.find((s) => s.grid_id === gridId);
  if (!stop || stop.status === "done") return;
  stop.status = "done";
  stop.checked_at = Date.now();
  saveSession(session);
  renderStopList();
  drawSessionOnMap();

  try {
    const res = await PatrolApi.completeStop(gridId, session.officer_id);
    if (res.all_done) {
      document.getElementById("panel-hint").textContent =
        "할당 구역 전부 확인됨 · 보고서 작성으로 이동하세요";
    } else {
      document.getElementById("panel-hint").textContent =
        `완료 반영 · 남은 ${res.remaining.length}구역 (재배정 후보에서 제외됨)`;
    }
  } catch (e) {
    console.warn(e);
    document.getElementById("panel-hint").textContent =
      "로컬 체크됨 (API 미연결 시 서버 풀은 미반영): " + e.message;
  }
}

async function finishAndReport() {
  const ids = (session.stops || []).map((s) => s.grid_id);
  try {
    await PatrolApi.completeAll(session.officer_id, ids, "");
  } catch (e) {
    console.warn(e);
  }

  const elapsed = Math.floor((Date.now() - (session.started_at || Date.now())) / 1000);
  localStorage.setItem(
    "patrolLog",
    JSON.stringify({
      elapsedSeconds: elapsed,
      destination: ids.join(", "),
      grid_ids: ids,
      officer_id: session.officer_id,
      status: "COMPLETED",
      zones: session.stops,
    })
  );
  window.location.href = "patrol-report.html";
}

function initMap() {
  session = loadSession();
  if (!session || !session.stops?.length) {
    hideSplash();
    alert("활성 순찰 세션이 없습니다. 동선 레이어 DEV에서 배정하세요.");
    window.location.href = "route-dev.html";
    return;
  }

  const first = session.stops[0];
  map = new kakao.maps.Map(document.getElementById("map"), {
    center: new kakao.maps.LatLng(first.lat, first.lon),
    level: 7,
  });

  document.getElementById("run-title").textContent = `${session.officer_name} 순찰`;
  document.getElementById("run-sub").textContent =
    `${session.stops.length}격자 · 약 ${Math.round(session.minutes || 0)}분`;

  drawSessionOnMap();
  renderStopList();
  document.getElementById("btn-finish-report")?.addEventListener("click", finishAndReport);
  hideSplash();
}

if (typeof kakao !== "undefined" && kakao.maps) {
  kakao.maps.load(initMap);
}
