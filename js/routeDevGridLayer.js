/**
 * 동선 DEV — 화성시 전 구역 격자 레이어 (LSMD 읍면동 기준)
 * - 일반 시역 / 농지(has_farm) / 위험(risk_grids.json → is_priority)
 * - setLayers() · applyRiskFromList()
 */
const GridLayerStyle = {
  city: {
    strokeWeight: 1,
    strokeColor: "#78909C",
    strokeOpacity: 0.65,
    fillColor: "#90A4AE",
    fillOpacity: 0.18,
  },
  farm: {
    strokeWeight: 1.5,
    strokeColor: "#F57C00",
    strokeOpacity: 0.85,
    fillColor: "#FFB74D",
    fillOpacity: 0.32,
  },
  priority: {
    strokeWeight: 2,
    strokeColor: "#ff3b30",
    strokeOpacity: 0.95,
    fillColor: "#ff3b30",
    fillOpacity: 0.28,
  },
  selected: {
    strokeWeight: 3,
    strokeColor: "#E65100",
    strokeOpacity: 1,
    fillColor: "#FF6F00",
    fillOpacity: 0.4,
  },
  hidden: {
    strokeOpacity: 0,
    fillOpacity: 0,
  },
};

const DBLCLICK_MS = 320;

function createRouteDevGridLayer(options) {
  const { map, grids, onSelect, onOpenInfo } = options;

  const byId = new Map();
  const rectById = new Map();
  let selectedId = null;
  let clickTimer = null;
  let lastClickId = null;
  let lastClickAt = 0;
  /** @type {{ city: boolean, farm: boolean, risk: boolean }} */
  let layers = { city: true, farm: true, risk: true };

  grids.forEach((g) => byId.set(g.grid_id, g));

  function applyStyle(rect, style) {
    rect.setOptions({
      strokeWeight: style.strokeWeight ?? 1,
      strokeColor: style.strokeColor ?? "#999",
      strokeOpacity: style.strokeOpacity ?? 0,
      fillColor: style.fillColor ?? "#999",
      fillOpacity: style.fillOpacity ?? 0,
    });
  }

  /** @returns {'priority'|'farm'|'city'|null} */
  function resolveKind(g) {
    if (g.is_priority && layers.risk) return "priority";
    if (g.has_farm && layers.farm) return "farm";
    if (!g.has_farm && layers.city) return "city";
    // 위험 레이어 OFF일 때 농지/시역으로 폴백
    if (g.is_priority && !layers.risk) {
      if (g.has_farm && layers.farm) return "farm";
      if (layers.city) return "city";
    }
    // 농지 셀인데 농지 OFF · 시역 ON → 시역 스타일로라도 표시
    if (g.has_farm && !layers.farm && layers.city) return "city";
    return null;
  }

  function baseStyleFor(g) {
    const kind = resolveKind(g);
    if (kind === "priority") return GridLayerStyle.priority;
    if (kind === "farm") return GridLayerStyle.farm;
    if (kind === "city") return GridLayerStyle.city;
    return GridLayerStyle.hidden;
  }

  function zFor(g) {
    const kind = resolveKind(g);
    if (kind === "priority") return 5;
    if (kind === "farm") return 3;
    if (kind === "city") return 2;
    return 0;
  }

  function paintAll() {
    rectById.forEach((rect, id) => {
      const g = byId.get(id);
      if (!g) return;
      const kind = resolveKind(g);
      const visible = kind !== null;
      rect.setOptions({ clickable: visible, zIndex: zFor(g) });
      if (id === selectedId && visible) applyStyle(rect, GridLayerStyle.selected);
      else applyStyle(rect, baseStyleFor(g));
      // 완전 숨김 시 맵에서 떼면 클릭 성능↑ — 토글 잦으면 setMap 비용; opacity 0 유지
      rect.setMap(visible ? map : null);
    });
  }

  function select(gridId, { openInfo } = { openInfo: false }) {
    const g = byId.get(gridId);
    if (!g) return;
    if (resolveKind(g) === null) return;
    selectedId = gridId;
    paintAll();
    if (typeof onSelect === "function") onSelect(g);
    if (openInfo && typeof onOpenInfo === "function") onOpenInfo(g);
  }

  function handleRectInteraction(gridId) {
    const now = Date.now();
    if (lastClickId === gridId && now - lastClickAt <= DBLCLICK_MS) {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      lastClickId = null;
      lastClickAt = 0;
      select(gridId, { openInfo: true });
      return;
    }
    lastClickId = gridId;
    lastClickAt = now;
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      clickTimer = null;
      select(gridId, { openInfo: false });
    }, DBLCLICK_MS);
  }

  function draw() {
    clear();
    grids.forEach((g) => {
      const sw = g.bounds.sw;
      const ne = g.bounds.ne;
      const kind = resolveKind(g);
      const rect = new kakao.maps.Rectangle({
        bounds: new kakao.maps.LatLngBounds(
          new kakao.maps.LatLng(sw.lat, sw.lng),
          new kakao.maps.LatLng(ne.lat, ne.lng)
        ),
        clickable: kind !== null,
        zIndex: zFor(g),
        ...baseStyleFor(g),
      });
      if (kind !== null) rect.setMap(map);
      rectById.set(g.grid_id, rect);

      kakao.maps.event.addListener(rect, "click", () => {
        handleRectInteraction(g.grid_id);
      });
    });
  }

  function clear() {
    rectById.forEach((rect) => rect.setMap(null));
    rectById.clear();
  }

  function setLayers(next) {
    layers = {
      city: next.city !== false,
      farm: next.farm !== false,
      risk: next.risk !== false,
    };
    paintAll();
    return { ...layers };
  }

  function getLayers() {
    return { ...layers };
  }

  function focus(gridId, { openInfo } = { openInfo: false }) {
    const g = byId.get(gridId);
    if (!g || !map) return;
    select(gridId, { openInfo });
    map.setLevel(Math.min(map.getLevel(), 5));
    map.panTo(new kakao.maps.LatLng(g.lat, g.lon));
  }

  function get(gridId) {
    return byId.get(gridId) || null;
  }

  function fitAll() {
    if (!grids.length || !map) return;
    const bounds = new kakao.maps.LatLngBounds();
    let any = false;
    grids.forEach((g) => {
      if (resolveKind(g) === null) return;
      any = true;
      bounds.extend(new kakao.maps.LatLng(g.bounds.sw.lat, g.bounds.sw.lng));
      bounds.extend(new kakao.maps.LatLng(g.bounds.ne.lat, g.bounds.ne.lng));
    });
    if (!any) {
      grids.forEach((g) => {
        bounds.extend(new kakao.maps.LatLng(g.bounds.sw.lat, g.bounds.sw.lng));
        bounds.extend(new kakao.maps.LatLng(g.bounds.ne.lat, g.bounds.ne.lng));
      });
    }
    map.setBounds(bounds);
  }

  /**
   * risk_grids.json / GET /patrol/risk-grids 목록으로 위험 플래그 동기화.
   * export에 박힌 is_priority 는 무시하고 이 목록만 정본으로 쓴다.
   * @returns {{ matched: number, missing: string[], total: number }}
   */
  function applyRiskFromList(riskList) {
    const raw = Array.isArray(riskList) ? riskList : [];
    const sorted = raw
      .filter((r) => r && r.grid_id)
      .slice()
      .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    const riskMap = new Map();
    sorted.forEach((r, i) => {
      riskMap.set(r.grid_id, {
        score: r.score != null ? Number(r.score) : null,
        risk_rank: i + 1,
      });
    });

    const missing = [];
    riskMap.forEach((_, gid) => {
      if (!byId.has(gid)) missing.push(gid);
    });

    byId.forEach((g) => {
      const hit = riskMap.get(g.grid_id);
      if (hit) {
        g.is_priority = true;
        g.score = hit.score;
        g.risk_rank = hit.risk_rank;
        g.risk_source = "risk_grids";
      } else {
        g.is_priority = false;
        g.score = null;
        g.risk_rank = null;
        g.risk_source = null;
      }
    });

    paintAll();
    return {
      matched: riskMap.size - missing.length,
      missing,
      total: riskMap.size,
    };
  }

  function destroy() {
    if (clickTimer) clearTimeout(clickTimer);
    clear();
    byId.clear();
  }

  return {
    draw,
    clear,
    focus,
    select,
    get,
    fitAll,
    setLayers,
    getLayers,
    applyRiskFromList,
    destroy,
    get selectedId() {
      return selectedId;
    },
    get size() {
      return grids.length;
    },
  };
}

function formatGridInfoHtml(g) {
  if (!g) return "";
  const typeRows = Object.entries(g.types || {})
    .map(([k, v]) => {
      const ko = v.label_ko || k;
      const ha = (v.overlap_area_m2 / 10000).toFixed(3);
      return `<tr><td>${ko}</td><td>${v.parcel_count}필지</td><td>${ha}ha</td></tr>`;
    })
    .join("");

  const emd =
    g.emd_names && g.emd_names.length
      ? g.emd_names.join(", ")
      : g.emd_name || g.ri_name || "—";
  const risk = g.is_priority
    ? `위험 #${g.risk_rank}${g.score != null ? " · " + g.score : ""}`
    : g.has_farm
      ? "농지 포함"
      : "시역 일반";
  const typeLabel =
    g.primary_type_ko && g.primary_type_ko !== "—"
      ? g.primary_type_ko
      : g.has_farm
        ? "농지"
        : "시역";

  return `
    <div class="grid-info-name">${g.name || g.grid_id}</div>
    <div class="grid-info-badges">
      <span class="badge ${g.is_priority ? "badge-high" : g.has_farm ? "badge-type" : "badge-normal"}">${risk}</span>
      <span class="badge badge-type">${typeLabel}</span>
    </div>
    <dl class="grid-info-dl">
      <div><dt>격자 ID</dt><dd>${g.grid_id}</dd></div>
      <div><dt>읍면동</dt><dd>${g.emd_name || g.ri_name || "—"} ${g.emd_code || g.ri_code ? "(" + (g.emd_code || g.ri_code) + ")" : ""}</dd></div>
      <div><dt>포함 구역</dt><dd>${emd}</dd></div>
      <div><dt>시역 점유</dt><dd>${((g.city_overlap_ratio || 0) * 100).toFixed(1)}% (${((g.city_overlap_m2 || 0) / 10000).toFixed(2)} ha)</dd></div>
      <div><dt>농지 포함</dt><dd>${g.has_farm ? "예" : "아니오"}</dd></div>
      <div><dt>필지 수</dt><dd>${(g.parcel_count || 0).toLocaleString()}개</dd></div>
      <div><dt>농지 면적</dt><dd>${((g.farm_area_m2 || 0) / 10000).toFixed(3)} ha</dd></div>
      <div><dt>농지 점유율</dt><dd>${((g.farm_ratio || 0) * 100).toFixed(1)}%</dd></div>
      <div><dt>위험 score</dt><dd>${g.is_priority && g.score != null ? g.score : "—"}</dd></div>
      <div><dt>중심 좌표</dt><dd>${g.lat.toFixed(5)}, ${g.lon.toFixed(5)}</dd></div>
      <div><dt>출처</dt><dd>${g.source || "—"}${g.risk_source ? " · 위험=" + g.risk_source : ""}</dd></div>
    </dl>
    <table class="grid-info-table">
      <thead><tr><th>유형</th><th>필지</th><th>면적</th></tr></thead>
      <tbody>${typeRows || "<tr><td colspan='3'>농지 없음</td></tr>"}</tbody>
    </table>
    <p class="grid-info-hint">LSMD 읍면동 화성시(41590) ∩ 국가지점번호 500m · 농지=HsFram</p>
  `;
}
