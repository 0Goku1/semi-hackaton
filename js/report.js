document.addEventListener("DOMContentLoaded", () => {
  if (typeof ApiClient !== "undefined" && !ApiClient.requireAuthPage()) return;

  const timeInput = document.getElementById("patrol-time");
  const patrolLog = (() => {
    try {
      return JSON.parse(localStorage.getItem("patrolLog") || "null");
    } catch (e) {
      return null;
    }
  })();

  if (timeInput) {
    if (patrolLog && patrolLog.elapsedSeconds != null) {
      const sec = Number(patrolLog.elapsedSeconds) || 0;
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      timeInput.value = m > 0 ? `${m}분 ${s}초` : `${s}초`;
    } else if (patrolLog && patrolLog.elapsedFormatted) {
      timeInput.value = patrolLog.elapsedFormatted;
    } else {
      timeInput.value = "기록 없음";
    }
  }

  const mapContainer = document.getElementById("report-map");
  if (mapContainer && typeof kakao !== "undefined" && kakao.maps) {
    new kakao.maps.Map(mapContainer, {
      center: new kakao.maps.LatLng(37.1995, 126.8312),
      level: 5,
    });
  }

  const submitBtn = document.getElementById("btn-submit-report");
  if (!submitBtn) return;

  submitBtn.addEventListener("click", async () => {
    const notes = (document.getElementById("patrol-notes") || {}).value || "";
    const weather = (document.getElementById("weather-status") || {}).value || "";
    const user = ApiClient.getCurrentUser() || {};
    const zone =
      (user.gu && user.region && `${user.gu} ${user.region}`) ||
      (patrolLog && patrolLog.destination) ||
      "담당 구역";
    const timeSpent = (timeInput && timeInput.value) || "기록 없음";

    submitBtn.disabled = true;
    try {
      await ApiClient.createReport({
        zone,
        time_spent: timeSpent,
        weather,
        notes: notes.trim() || "특이사항 없음",
        status: "정상 완료",
      });
      window.location.href = "my-reports.html";
    } catch (err) {
      alert(err.message || "순찰 기록 등록에 실패했습니다.");
      submitBtn.disabled = false;
    }
  });
});
