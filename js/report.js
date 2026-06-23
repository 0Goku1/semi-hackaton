// 순찰 기록 보고서 — patrolLog 읽기, 지도 동선, 기록 등록

function readPatrolLog() {
    try {
        const raw = localStorage.getItem("patrolLog");
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.warn("[report] patrolLog 파싱 실패:", e);
        return null;
    }
}

function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);

    if (hours > 0) return `${hours}시간 ${minutes}분`;
    if (minutes > 0) return `${minutes}분`;
    return "1분 미만";
}

function formatClock(isoString) {
    if (!isoString) return null;
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return null;

    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

function buildPatrolTimeLabel(log) {
    const duration = formatDuration(log.elapsedSeconds);
    const start = formatClock(log.startTime);
    const end = formatClock(log.endTime);

    if (start && end) return `${duration} (${start} ~ ${end})`;
    return duration;
}

// 보고서 미니 지도 — patrolRoute.js 공통 모듈 사용
async function initReportMap(log) {
    const mapContainer = document.getElementById('report-map');
    if (!mapContainer) return;

    const origin =
        log && log.originLat != null && log.originLng != null
            ? { lat: parseFloat(log.originLat), lng: parseFloat(log.originLng) }
            : null;

    const { points, destination } = await buildPatrolRoutePoints(origin);
    const linePath = points.map((p) => new kakao.maps.LatLng(p.lat, p.lng));
    if (!linePath.length) return;

    const map = new kakao.maps.Map(mapContainer, {
        center: linePath[0],
        level: 5,
        draggable: false,
        zoomable: false,
    });

    const bounds = new kakao.maps.LatLngBounds();
    linePath.forEach((point) => bounds.extend(point));
    map.setBounds(bounds);

    const polyline = new kakao.maps.Polyline({
        path: linePath,
        strokeWeight: 6,
        strokeColor: PATROL_ROUTE_CONFIG.color,
        strokeOpacity: 0.9,
        strokeStyle: 'solid',
    });
    polyline.setMap(map);

    new kakao.maps.Marker({
        position: linePath[0],
        map: map,
    });

    const targetZoneType =
        (destination && destination.type) ||
        (log && log.targetZoneType) ||
        "산불 위험 구역";
    const contentHtml = `
        <div style="background:#FF3B30; color:white; font-size:10px; font-weight:800; padding:3px 8px; border-radius:20px; box-shadow:0 2px 6px rgba(0,0,0,0.2); white-space:nowrap; border:1.5px solid white;">
            ${targetZoneType}
        </div>`;

    new kakao.maps.CustomOverlay({
        position: linePath[linePath.length - 1],
        content: contentHtml,
        yAnchor: 1.6,
        xAnchor: 0.5,
        map: map,
    });

    window.addEventListener('resize', function () {
        map.setBounds(bounds);
    });
}

window.addEventListener("DOMContentLoaded", () => {
    const timeInput = document.getElementById("patrol-time");
    const log = readPatrolLog();

    if (log) {
        timeInput.value = buildPatrolTimeLabel(log);
    } else {
        timeInput.value = "기록된 순찰 시간 없음";
    }

    if (typeof kakao !== 'undefined' && kakao.maps) {
        initReportMap(log);
    } else {
        console.error("카카오맵 라이브러리 로드 실패");
    }
});

// 순찰 기록 등록
document.getElementById("btn-submit-report").addEventListener("click", () => {
    const notes = document.getElementById("patrol-notes").value;
    const weather = document.getElementById("weather-status").value;
    const submitBtn = document.getElementById("btn-submit-report");

    if (!notes.trim()) {
        alert("순찰 기록이나 특이사항을 한 줄이라도 적어 주세요!");
        return;
    }

    const log = readPatrolLog() || {};
    const currentUser = JSON.parse(localStorage.getItem("currentUser")) || {};
    const userZone = `${currentUser.gu || '효행구'} ${currentUser.region || '봉담읍 일대'}`;

    const now = new Date();
    const dateString = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

    const newReport = {
        id: Date.now(),
        date: dateString,
        zone: userZone,
        time: buildPatrolTimeLabel(log),
        weather: weather,
        notes: notes.trim(),
        author: currentUser.name || "익명 대원",
        status: weather.includes("단계3") || weather.includes("단계4") || weather.includes("단계5") ? "이상 발견" : "정상 완료"
    };

    let patrolReports = JSON.parse(localStorage.getItem("patrolReports")) || [];
    patrolReports.unshift(newReport);
    localStorage.setItem("patrolReports", JSON.stringify(patrolReports));

    submitBtn.disabled = true;

    const existingMsg = document.getElementById("success-inline-msg");
    if (existingMsg) existingMsg.remove();

    const successBanner = document.createElement("div");
    successBanner.id = "success-inline-msg";
    successBanner.style.cssText = `
        background-color: #fff0e6;
        color: #ff6f00;
        font-size: 14px;
        font-weight: 700;
        text-align: center;
        padding: 14px;
        border-radius: 12px;
        margin-bottom: 16px;
        border: 1px solid #ffdbcc;
        width: 100%;
        box-sizing: border-box;
        animation: fadeIn 0.25s ease;
    `;
    successBanner.innerHTML = "순찰 기록이 등록되었습니다.<br><span style='font-size:12px; font-weight:500; color:#666;'>잠시 후 완료 내역 목록으로 이동합니다.</span>";

    // 등록 버튼 위에 안내 배너 삽입
    submitBtn.parentNode.insertBefore(successBanner, submitBtn);

    setTimeout(() => {
        window.location.href = "my-reports.html";
    }, 1500);
});
