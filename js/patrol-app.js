let mapRef = null;
let seconds = 0;
let timerInterval = null;
let isStandby = false;

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    seconds++;
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    const display = document.getElementById("timerDisplay");
    if (display) display.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

function toggleStandby() {
  const btn = document.getElementById("btnStandby");
  const badge = document.getElementById("statusBadge");
  isStandby = !isStandby;
  if (isStandby) {
    clearInterval(timerInterval);
    timerInterval = null;
    btn.textContent = "▶ 순찰 재개";
    badge.textContent = "● 대기중";
  } else {
    startTimer();
    btn.textContent = "⏸ 순찰 대기";
    badge.textContent = "● 순찰중";
  }
}

function endPatrol() {
  clearInterval(timerInterval);
  localStorage.setItem("patrolLog", JSON.stringify({
    elapsedSeconds: seconds,
    targetZoneType: "불법소각 민원",
    destination: "경기도 화성시 봉담읍 상리",
    status: "COMPLETED"
  }));
  window.location.href = "patrol-report.html";
}

function initPatrolMap() {
  const splash = document.getElementById("patrol-splash");
  if (splash) setTimeout(() => splash.remove(), 500);

  mapRef = new kakao.maps.Map(document.getElementById("map"), {
    center: new kakao.maps.LatLng(37.1995, 126.8312),
    level: 3,
  });
  startTimer();
}

if (typeof kakao !== 'undefined' && kakao.maps) {
  kakao.maps.load(initPatrolMap);
}