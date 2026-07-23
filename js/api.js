/**
 * FastAPI 클라이언트
 * SECRETS.API_BASE_URL 필요 (js/secrets.js)
 */
(function (global) {
  const TOKEN_KEY = "accessToken";
  const USER_KEY = "currentUser";

  function apiBase() {
    if (typeof SECRETS === "undefined" || !SECRETS.API_BASE_URL) {
      throw new Error("SECRETS.API_BASE_URL 이 없습니다. js/secrets.js 를 확인하세요.");
    }
    return SECRETS.API_BASE_URL.replace(/\/$/, "");
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function updateCachedUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  async function api(path, options = {}) {
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      options.headers || {}
    );
    const token = getToken();
    if (options.auth !== false && token) {
      headers.Authorization = "Bearer " + token;
    }

    let res;
    try {
      res = await fetch(apiBase() + path, {
        method: options.method || "GET",
        headers,
        body: options.body != null ? JSON.stringify(options.body) : undefined,
      });
    } catch (err) {
      const e = new Error("서버에 연결할 수 없습니다. 네트워크·API 주소를 확인하세요.");
      e.cause = err;
      throw e;
    }

    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { detail: text };
      }
    }

    if (!res.ok) {
      let message = "요청에 실패했습니다.";
      if (data) {
        if (typeof data.detail === "string") message = data.detail;
        else if (Array.isArray(data.detail)) {
          message = data.detail.map((d) => d.msg || JSON.stringify(d)).join("\n");
        } else if (data.message) message = data.message;
      }
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      if (res.status === 401 && options.redirectOn401 !== false) {
        clearSession();
      }
      throw err;
    }
    return data;
  }

  function requireAuthPage() {
    if (!getToken()) {
      window.location.replace("login.html");
      return false;
    }
    return true;
  }

  global.ApiClient = {
    api,
    getToken,
    getCurrentUser,
    setSession,
    clearSession,
    updateCachedUser,
    requireAuthPage,
    signup: (body) => api("/auth/signup", { method: "POST", body, auth: false }),
    login: (body) => api("/auth/login", { method: "POST", body, auth: false }),
    getMe: () => api("/users/me"),
    updateMe: (body) => api("/users/me", { method: "PATCH", body }),
    changePassword: (body) => api("/users/me/password", { method: "PATCH", body }),
    createReport: (body) => api("/patrol-reports", { method: "POST", body }),
    listMyReports: () => api("/patrol-reports/me"),
  };
})(window);
