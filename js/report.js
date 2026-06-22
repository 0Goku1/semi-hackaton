// ============================================================
//  report.js — 순찰 기록 보고서 (동선 길이에 따른 자동 비율 조절 버전)
//  patrol-app.js 가 localStorage("patrolLog") 에 저장한
//  실제 데이터 규격을 읽어 처리하며, 지도 축척을 자동으로 계산한다.
// ============================================================

/**
 * 1. 로컬스토리지에서 다영이가 저장한 순찰 로그 데이터 읽기 (기존 유지)
 */
function readPatrolLog() {
    try {
        const raw = localStorage.getItem("patrolLog");
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.warn("[report] patrolLog 파싱 실패:", e);
        return null;
    }
}

/**
 * 2. 초 단위를 "1시간 5분" / "12분" / "1분 미만" 형태로 변환 (기존 유지)
 */
function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);

    if (hours > 0) return `${hours}시간 ${minutes}분`;
    if (minutes > 0) return `${minutes}분`;
    return "1분 미만";
}

/**
 * 3. ISO 시간 문자열을 "14:05" 형식의 시각으로 변환 (기존 유지)
 */
function formatClock(isoString) {
    if (!isoString) return null;
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return null;

    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

/**
 * 4. 상단 인풋창에 들어갈 최종 시간 텍스트 조합 (기존 유지)
 */
function buildPatrolTimeLabel(log) {
    const duration = formatDuration(log.elapsedSeconds);
    const start = formatClock(log.startTime);
    const end = formatClock(log.endTime);

    if (start && end) return `${duration} (${start} ~ ${end})`;
    return duration;
}

/**
 * 🗺️ 5. index.html 과 동일한 순찰 동선을 그리는 고정형 미니 지도
 *    js/patrolRoute.js 의 buildPatrolRoutePoints() 공통 모듈을 그대로 호출한다.
 *     - 1단계: 순찰 시작 좌표(originLat/originLng) → DZ_001 (OSRM 도보)
 *     - 2단계: DZ_001 → SO_001~SO_017 → DZ_003 (수동 경유지)
 */
async function initReportMap(log) {
    const mapContainer = document.getElementById('report-map');
    if (!mapContainer) return;

    // 📍 순찰 시작 좌표(OSRM 1단계 출발점) — patrolLog 에 저장돼 있으면 사용, 없으면 DZ_001 부터 시작
    const origin =
        log && log.originLat != null && log.originLng != null
            ? { lat: parseFloat(log.originLat), lng: parseFloat(log.originLng) }
            : null;

    // 🔗 index.html(app.js) 과 동일한 동선 계산 (공통 모듈)
    const { points, destination } = await buildPatrolRoutePoints(origin);
    const linePath = points.map((p) => new kakao.maps.LatLng(p.lat, p.lng));
    if (!linePath.length) return;

    // 1) 드래그/줌 잠금된 고정 지도
    const map = new kakao.maps.Map(mapContainer, {
        center: linePath[0],
        level: 5,
        draggable: false, // 🚫 시연 중 마우스 드래그로 지도 날아감 방지
        zoomable: false,  // 🚫 마우스 휠 확대/축소 잠금
    });

    // 2) 🔥 전체 동선이 미니맵에 꽉 차도록 바운더리 자동 계산
    const bounds = new kakao.maps.LatLngBounds();
    linePath.forEach((point) => bounds.extend(point));
    map.setBounds(bounds);

    // 🟠 동선 주황 실선 (index 와 동일 색상)
    const polyline = new kakao.maps.Polyline({
        path: linePath,
        strokeWeight: 6,
        strokeColor: PATROL_ROUTE_CONFIG.color,
        strokeOpacity: 0.9,
        strokeStyle: 'solid',
    });
    polyline.setMap(map);

    // 🚩 출발지 마커 핀 꽂기
    new kakao.maps.Marker({
        position: linePath[0],
        map: map,
    });

    // 🎯 도착지 뱃지형 오버레이 설정
    const targetZoneType =
        (destination && destination.type) ||
        (log && log.targetZoneType) ||
        "산불 주의 구역";
    const contentHtml = `
        <div style="background:#FF3B30; color:white; font-size:10px; font-weight:800; padding:3px 8px; border-radius:20px; box-shadow:0 2px 6px rgba(0,0,0,0.2); white-space:nowrap; border:1.5px solid white;">
            🎯 ${targetZoneType}
        </div>`;

    new kakao.maps.CustomOverlay({
        position: linePath[linePath.length - 1],
        content: contentHtml,
        yAnchor: 1.6,
        xAnchor: 0.5,
        map: map,
    });

    // 📱 리사이즈 시에도 자동 맞춤 비율 상시 고정
    window.addEventListener('resize', function () {
        map.setBounds(bounds);
    });
}

/**
 * 6. 페이지가 켜지자마자 실행되는 메인 오케스트레이션 (기존 유지)
 */
window.addEventListener("DOMContentLoaded", () => {
    const timeInput = document.getElementById("patrol-time");
    const log = readPatrolLog();

    if (log) {
        timeInput.value = buildPatrolTimeLabel(log);
    } else {
        timeInput.value = "기록된 순찰 시간 없음";
    }

    // 🗺️ 자동 축척 제어형 미니 지도 렌더링 가동
    if (typeof kakao !== 'undefined' && kakao.maps) {
        initReportMap(log);
    } else {
        console.error("카카오맵 라이브러리 대기 중 에러 발생");
    }
});

/**
 * 7. 🔥 [수정] 하단 [순찰 기록 등록] 클릭 시 데이터를 누적하여 리스트 화면으로 연동
 */
document.getElementById("btn-submit-report").addEventListener("click", () => {
    const notes = document.getElementById("patrol-notes").value;
    const weather = document.getElementById("weather-status").value;

    if (!notes.trim()) {
        alert("순찰 기록이나 특이사항을 한 줄이라도 적어 주세요!");
        return;
    }

    const log = readPatrolLog() || {};
    const currentUser = JSON.parse(localStorage.getItem("currentUser")) || {};
    const userZone = `${currentUser.gu || '효행구'} ${currentUser.region || '봉담읍 일대'}`;

    const now = new Date();
    const dateString = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

    // 새로운 순찰 완료 기록 데이터 객체화
    const newReport = {
        id: Date.now(),
        date: dateString,
        zone: userZone,
        time: buildPatrolTimeLabel(log),
        weather: weather,
        notes: notes.trim(),
        status: weather.includes("단계3") || weather.includes("단계4") || weather.includes("단계5") ? "이상 발견" : "정상 완료"
    };

    // 로컬스토리지에 기존 누적 리스트가 있으면 가져오고 없으면 빈 배열로 시작
    let patrolReports = JSON.parse(localStorage.getItem("patrolReports")) || [];
    
    // 최신 항목이 맨 앞으로 오도록 추가
    patrolReports.unshift(newReport);

    // 배열 전체를 로컬스토리지에 재저장
    localStorage.setItem("patrolReports", JSON.stringify(patrolReports));

    alert("순찰 기록이 성공적으로 등록되었습니다. 완료 내역 목록으로 이동합니다.");
    window.location.href = "my-reports.html";
});