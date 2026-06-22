// ==========================================================================
//  report.js — 순찰 기록 보고서 (동선 길이에 따른 자동 비율 조절 버전)
//  patrol-app.js 가 localStorage("patrolLog") 에 저장한
//  실제 데이터 규격을 읽어 처리하며, 지도 축척을 자동으로 계산한다.
// ==========================================================================

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
 * 🗺️ 5. 동선 길이에 맞춰 비율과 중심점이 자동 조절되는 고정형 지도 함수 (기존 유지)
 */
function initReportMap(log) {
    const mapContainer = document.getElementById('report-map');
    if (!mapContainer) return;

    let destLat = 37.2164851600941; 
    let destLng = 126.934789483585;

    if (log && log.lat && log.lng) {
        destLat = parseFloat(log.lat);
        destLng = parseFloat(log.lng);
    }

    const linePath = [
        new kakao.maps.LatLng(destLat - 0.0020, destLng - 0.0025), 
        new kakao.maps.LatLng(destLat - 0.0010, destLng - 0.0012), 
        new kakao.maps.LatLng(destLat - 0.0004, destLng + 0.0003), 
        new kakao.maps.LatLng(destLat, destLng)                    
    ];

    const mapOption = {
        center: linePath[0], 
        level: 3,            
        draggable: false,    
        zoomable: false      
    };

    const map = new kakao.maps.Map(mapContainer, mapOption);
    const bounds = new kakao.maps.LatLngBounds();
    linePath.forEach(point => bounds.extend(point));
    map.setBounds(bounds);

    const polyline = new kakao.maps.Polyline({
        path: linePath,
        strokeWeight: 6,           
        strokeColor: '#FF6B00',    
        strokeOpacity: 0.9,        
        strokeStyle: 'solid'       
    });
    polyline.setMap(map);

    new kakao.maps.Marker({
        position: linePath[0],
        map: map
    });

    const targetZoneType = log ? log.targetZoneType : "불법소각 민원";
    const contentHtml = `
        <div style="background:#FF3B30; color:white; font-size:10px; font-weight:800; padding:3px 8px; border-radius:20px; box-shadow:0 2px 6px rgba(0,0,0,0.2); white-space:nowrap; border:1.5px solid white;">
            🎯 ${targetZoneType}
        </div>`;

    new kakao.maps.CustomOverlay({
        position: linePath[linePath.length - 1],
        content: contentHtml,
        yAnchor: 1.6,
        xAnchor: 0.5,
        map: map
    });

    window.addEventListener('resize', function() {
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

    if (typeof kakao !== 'undefined' && kakao.maps) {
        initReportMap(log);
    } else {
        console.error("카카오맵 라이브러리 대기 중 에러 발생");
    }
});

/**
 * 7. 🔥 [디자인 퀄리티 전면 업그레이드] 순찰 기록 등록 및 예쁜 인라인 배너 안내
 */
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

    // 새로운 순찰 완료 기록 데이터 객체화
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

    // 🚨 [구린 모달 제거 및 인라인 안내 배너 구현]
    // 버튼 중복 클릭 방지
    submitBtn.disabled = true;

    // 기존에 혹시 남아있을지 모를 안내 배너 제거
    const existingMsg = document.getElementById("success-inline-msg");
    if (existingMsg) existingMsg.remove();

    // 부드럽고 친절한 주황색 톤 안내 배너 생성
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
    successBanner.innerHTML = "✅ 순찰 기록이 성공적으로 등록되었습니다.<br><span style='font-size:12px; font-weight:500; color:#666;'>잠시 후 완료 내역 목록으로 자동 이동합니다.</span>";

    // 등록 버튼 바로 위에 이쁘게 끼워 넣기
    submitBtn.parentNode.insertBefore(successBanner, submitBtn);

    // 대원이 인지할 수 있도록 1.5초 대기 후 목록 레이아웃으로 화면 이동
    setTimeout(() => {
        window.location.href = "my-reports.html";
    }, 1500);
});