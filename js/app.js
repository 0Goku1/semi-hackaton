let routeLines = [];

const dummyUsers = [
  { id: 1, name: "정승우", isMain: true },
  { id: 2, name: "김대원", isMain: false },
  { id: 3, name: "이수진", isMain: false }
];

const mainUser = dummyUsers.find((user) => user.isMain) || dummyUsers[0];

// 스플래시 화면을 안전하게 닫고 메인 UI를 보여주는 함수
function hideSplash() {
  const splash = document.getElementById("app-splash");
  if (!splash) return;
  splash.classList.add("fade-out");
  setTimeout(() => {
    splash.remove();
  }, 400);
}

function initApp() {
  if (typeof ApiClient !== "undefined") {
    if (!ApiClient.getToken()) {
      window.location.replace("login.html");
      return;
    }
    const user = ApiClient.getCurrentUser();
    if (user && user.name) {
      const given = typeof getGivenName === "function" ? getGivenName(user.name) : user.name;
      const nameEl = document.querySelector(".profile-menu-name");
      if (nameEl) nameEl.textContent = user.name;
      const avatar = document.getElementById("profile-avatar");
      const menuAvatar = document.querySelector(".profile-menu-avatar");
      const url =
        typeof getProfileAvatarUrl === "function"
          ? getProfileAvatarUrl(given)
          : null;
      if (url && avatar) avatar.src = url;
      if (url && menuAvatar) menuAvatar.src = url;
    }
  }

  setupPanelInteraction();
  setupProfileMenuNavigation();

  // "산불 위험 구역 확인 중..." 스플래시를 잠시 보여준 뒤 깔끔하게 닫고 메인 유지
  setTimeout(hideSplash, 1200);
}

// 순찰 경로 탐색 시뮬레이션
async function simulateRouteDrawing() {
  const actionBtn = document.getElementById("action-btn");
  const panelTitle = document.getElementById("panel-title");
  const loadingOverlay = document.getElementById("loading-overlay");

  if (loadingOverlay) loadingOverlay.classList.remove("hidden");
  if (actionBtn) actionBtn.disabled = true;

  await new Promise(r => setTimeout(r, 800));

  if (loadingOverlay) loadingOverlay.classList.add("hidden");
  if (panelTitle) {
    panelTitle.innerHTML = `최적 순찰 경로 배정 완료<br><span class="panel-summary">1.2km · 약 15분</span>`;
  }
  
  if (actionBtn) {
    actionBtn.textContent = "순찰 시작";
    actionBtn.classList.remove("btn-primary");
    actionBtn.classList.add("btn-success");
    state = "ready";
    actionBtn.disabled = false;
  }
}

let state = "idle";

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

// 상단 프로필 메뉴 라우팅
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

  const myPageBtn = document.getElementById("menu-mypage");
  const notiBtn = document.getElementById("menu-notifications");
  const reportsBtn = document.getElementById("menu-reports");
  const logoutBtn = document.getElementById("logout-btn");

  if (myPageBtn) myPageBtn.addEventListener("click", () => window.location.href = "myPage.html");
  if (notiBtn) notiBtn.addEventListener("click", () => window.location.href = "notifications.html");
  if (reportsBtn) reportsBtn.addEventListener("click", () => window.location.href = "my-reports.html");
  
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof ApiClient !== "undefined") {
        ApiClient.clearSession();
      } else {
        localStorage.removeItem("currentUser");
        localStorage.removeItem("accessToken");
      }
      window.location.replace("login.html");
    });
  }
}

document.addEventListener("DOMContentLoaded", initApp);