# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "js" / "route-dev.js"
text = p.read_text(encoding="utf-8")
start = text.index("function drawSolvedRoute")
end = text.index("function initGridLayer")

new = r'''function drawAssignRoute(myRoute) {
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

function openOfficerSheet() {
  document.getElementById("officer-sheet")?.classList.add("open");
  document.getElementById("sheet-backdrop")?.classList.add("open");
  closeGridInfo();
  closeRankDetail();
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

function renderOfficers() {
  const list = document.getElementById("officer-list");
  const sum = document.getElementById("officer-summary");
  if (!list || !officersDoc) return;
  const officers = officersDoc.officers || [];
  const avail = officers.filter((o) => o.available).length;
  list.innerHTML = officers
    .map(
      (o) => `<li class="officer-row">
      <div>
        <div class="name">${o.name}${o.is_me ? " (나)" : ""}</div>
        <div class="meta">${o.id}</div>
      </div>
      <button type="button" class="officer-toggle ${o.available ? "on" : "off"}" data-id="${o.id}">
        ${o.available ? "가용" : "비가용"}
      </button>
    </li>`
    )
    .join("");
  if (sum) {
    sum.textContent = `총 ${officers.length}명 · 가용 ${avail}명 · 비가용 ${officers.length - avail}명`;
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
    if (title) {
      title.innerHTML =
        `내 동선 ${(my?.stops || []).length}격자 · ${Math.round(my?.minutes || 0)}분<br>` +
        `<span class="panel-summary">OR-Tools · 가용 ${nAvail}명 · 전체배정 ${assignedStops}` +
        ` · 미배정 ${result.unassigned?.length || 0}` +
        ` · ${result.meta?.elapsed_s ?? "?"}s</span>`;
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

'''

# keep existing closeAllSheets if present later; replace old draw+run block
p.write_text(text[:start] + new + text[end:], encoding="utf-8")
print("OK patched route-dev.js")
