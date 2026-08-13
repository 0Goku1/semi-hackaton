/**
 * 동선 DEV — 화성시 전 구역 격자 레이어 (Hw_Ri 기준)
 * - 일반 시역 격자 / 농지 포함 / 임시 HIGH 우선
 * - 클릭: 선택 / 더블클릭: 상세
 */
const GridLayerStyle = {
  city: {
    strokeWeight: 1,
    strokeColor: "#90A4AE",
    strokeOpacity: 0.45,
    fillColor: "#CFD8DC",
    fillOpacity: 0.12,
  },
  farm: {
    strokeWeight: 1,
    strokeColor: "#FF8A65",
    strokeOpacity: 0.55,
    fillColor: "#FFCCBC",
    fillOpacity: 0.2,
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

  grids.forEach((g) => byId.set(g.grid_id, g));

  function applyStyle(rect, style) {
    rect.setOptions({
      strokeWeight: style.strokeWeight,
      strokeColor: style.strokeColor,
      strokeOpacity: style.strokeOpacity,
      fillColor: style.fillColor,
      fillOpacity: style.fillOpacity,
    });
  }

  function baseStyleFor(g) {
    if (g.is_priority) return GridLayerStyle.priority;
    if (g.has_farm) return GridLayerStyle.farm;
    return GridLayerStyle.city;
  }

  function paintSelection() {
    rectById.forEach((rect, id) => {
      const g = byId.get(id);
      if (!g) return;
      if (id === selectedId) applyStyle(rect, GridLayerStyle.selected);
      else applyStyle(rect, baseStyleFor(g));
    });
  }

  function select(gridId, { openInfo } = { openInfo: false }) {
    const g = byId.get(gridId);
    if (!g) return;
    selectedId = gridId;
    paintSelection();
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
      const rect = new kakao.maps.Rectangle({
        bounds: new kakao.maps.LatLngBounds(
          new kakao.maps.LatLng(sw.lat, sw.lng),
          new kakao.maps.LatLng(ne.lat, ne.lng)
        ),
        clickable: true,
        zIndex: g.is_priority ? 5 : g.has_farm ? 3 : 2,
        ...baseStyleFor(g),
      });
      rect.setMap(map);
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
    grids.forEach((g) => {
      bounds.extend(new kakao.maps.LatLng(g.bounds.sw.lat, g.bounds.sw.lng));
      bounds.extend(new kakao.maps.LatLng(g.bounds.ne.lat, g.bounds.ne.lng));
    });
    map.setBounds(bounds);
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
      : g.ri_name || "—";
  const risk = g.is_priority
    ? `위험도 높음 (임시 #${g.risk_rank})`
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
      <div><dt>대표 리</dt><dd>${g.ri_name || "—"} ${g.ri_code ? "(" + g.ri_code + ")" : ""}</dd></div>
      <div><dt>리·동</dt><dd>${emd}</dd></div>
      <div><dt>시역 점유</dt><dd>${((g.city_overlap_ratio || 0) * 100).toFixed(1)}% (${((g.city_overlap_m2 || 0) / 10000).toFixed(2)} ha)</dd></div>
      <div><dt>농지 포함</dt><dd>${g.has_farm ? "예" : "아니오"}</dd></div>
      <div><dt>필지 수</dt><dd>${(g.parcel_count || 0).toLocaleString()}개</dd></div>
      <div><dt>농지 면적</dt><dd>${((g.farm_area_m2 || 0) / 10000).toFixed(3)} ha</dd></div>
      <div><dt>농지 점유율</dt><dd>${((g.farm_ratio || 0) * 100).toFixed(1)}%</dd></div>
      <div><dt>중심 좌표</dt><dd>${g.lat.toFixed(5)}, ${g.lon.toFixed(5)}</dd></div>
      <div><dt>출처</dt><dd>${g.source || "—"}</dd></div>
    </dl>
    <table class="grid-info-table">
      <thead><tr><th>유형</th><th>필지</th><th>면적</th></tr></thead>
      <tbody>${typeRows || "<tr><td colspan='3'>농지 없음</td></tr>"}</tbody>
    </table>
    <p class="grid-info-hint">Hw_Ri 화성시(41590) ∩ 국가지점번호 500m</p>
  `;
}
