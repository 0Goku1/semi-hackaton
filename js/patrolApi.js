/**
 * 순찰 배정 API 클라이언트 (route-dev / patrol-run)
 * SECRETS.API_BASE_URL 예: http://127.0.0.1:8000
 */
function patrolApiBase() {
  const raw =
    (typeof SECRETS !== "undefined" && SECRETS.API_BASE_URL) ||
    "http://127.0.0.1:8000";
  return String(raw).replace(/\/$/, "");
}

async function patrolFetch(path, options = {}) {
  const url = patrolApiBase() + path;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  // 로그인 세션이 있으면 is_me 매칭용으로 전달
  try {
    const token = localStorage.getItem("accessToken");
    if (token && !headers.Authorization) {
      headers.Authorization = "Bearer " + token;
    }
  } catch (_) {
    /* ignore */
  }
  const res = await fetch(url, {
    ...options,
    headers,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    throw new Error(`API 응답 파싱 실패 (${res.status})`);
  }
  if (!res.ok) {
    const msg = (data && (data.detail || data.error || data.message)) || res.statusText;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

const PatrolApi = {
  getRiskGrids: () => patrolFetch("/patrol/risk-grids"),
  getOfficers: () => patrolFetch("/patrol/officers"),
  patchOfficer: (id, body) =>
    patrolFetch(`/patrol/officers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  getPool: () => patrolFetch("/patrol/pool"),
  resetPool: () => patrolFetch("/patrol/pool/reset", { method: "POST", body: "{}" }),
  assign: (body) =>
    patrolFetch("/patrol/assign", { method: "POST", body: JSON.stringify(body || {}) }),
  completeStop: (grid_id, officer_id) =>
    patrolFetch("/patrol/complete-stop", {
      method: "POST",
      body: JSON.stringify({ grid_id, officer_id }),
    }),
  completeAll: (officer_id, grid_ids, notes) =>
    patrolFetch("/patrol/complete-all", {
      method: "POST",
      body: JSON.stringify({ officer_id, grid_ids, notes: notes || "" }),
    }),
  addOfficer: (body) =>
    patrolFetch("/patrol/officers/add", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteOfficer: (id) =>
    patrolFetch(`/patrol/officers/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};
