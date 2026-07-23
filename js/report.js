document.addEventListener("DOMContentLoaded", () => {
    const timeInput = document.getElementById("patrol-time");
    if (timeInput) timeInput.value = "15분 (시뮬레이션)";
    
    const mapContainer = document.getElementById('report-map');
    if (mapContainer && typeof kakao !== 'undefined' && kakao.maps) {
      new kakao.maps.Map(mapContainer, {
        center: new kakao.maps.LatLng(37.1995, 126.8312),
        level: 5,
      });
    }
  });
  
  const submitBtn = document.getElementById("btn-submit-report");
  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      const notes = document.getElementById("patrol-notes").value;
      const weather = document.getElementById("weather-status").value;
  
      const newReport = {
        id: Date.now(),
        date: "2026.07.22",
        zone: "효행구 봉담읍",
        time: "15분",
        weather: weather,
        notes: notes.trim() || "특이사항 없음",
        author: "정승우",
        status: "정상 완료"
      };
  
      let reports = JSON.parse(localStorage.getItem("patrolReports")) || [];
      reports.unshift(newReport);
      localStorage.setItem("patrolReports", JSON.stringify(reports));
  
      window.location.href = "my-reports.html";
    });
  }