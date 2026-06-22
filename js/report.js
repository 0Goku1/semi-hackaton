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
 * 🗺️ 5. [수정 완료] 동선 길이에 맞춰 비율과 중심점이 자동 조절되는 고정형 지도 함수 (기존 유지)
 */
function initReportMap(log) {
    const mapContainer = document.getElementById('report-map');
    if (!mapContainer) return;

    // 📍 기본 목적지 좌표 설정 (데이터 유실 대비 화성시 봉담읍 상리 민원지 fallback)
    let destLat = 37.2164851600941; 
    let destLng = 126.934789483585;

    // 실시간 로그 데이터가 안전하게 넘어왔다면 해당 위경도로 덮어쓰기
    if (log && log.lat && log.lng) {
        destLat = parseFloat(log.lat);
        destLng = parseFloat(log.lng);
    }

    // 📐 순찰 동선 좌표 배열 (이 배열이 길어지거나 짧아져도 바운더리를 자동 계산함)
    const linePath = [
        new kakao.maps.LatLng(destLat - 0.0020, destLng - 0.0025), // 출발점
        new kakao.maps.LatLng(destLat - 0.0010, destLng - 0.0012), // 경유지 1
        new kakao.maps.LatLng(destLat - 0.0004, destLng + 0.0003), // 경유지 2
        new kakao.maps.LatLng(destLat, destLng)                    // 도착점
    ];

    // 1) 초기 지도 객체 임시 레벨로 선언 (드래그/확대 줌 기능 완벽 차단)
    const mapOption = {
        center: linePath[0], 
        level: 3,            
        draggable: false,    // 🚫 시연 중 마우스 드래그로 지도 날아감 방지
        zoomable: false      // 🚫 마우스 휠 확대/축소 잠금
    };

    const map = new kakao.maps.Map(mapContainer, mapOption);

    // 2) 🔥 [핵심 기능] 모든 노선 좌표를 포함하는 스마트 바운더리 영역 계산
    const bounds = new kakao.maps.LatLngBounds();
    
    // 노선도의 모든 포인트를 바운더리에 등록
    linePath.forEach(point => bounds.extend(point));

    // 계산된 바운더리 크기에 딱 맞춰 지도의 축척 비율(Level)과 중심점을 자동으로 재매핑!
    map.setBounds(bounds);

    // 🟠 코리요 테마 주황색 매핑 라인 정의 (#FF6B00)
    const polyline = new kakao.maps.Polyline({
        path: linePath,
        strokeWeight: 6,           // 선명하게 보이도록 두께 6 설정
        strokeColor: '#FF6B00',    // 브랜드 컬러 주황색
        strokeOpacity: 0.9,        
        strokeStyle: 'solid'       
    });
    polyline.setMap(map);

    // 🚩 출발지 마커 핀 꽂기
    new kakao.maps.Marker({
        position: linePath[0],
        map: map
    });

    // 🎯 도착지 뱃지형 오버레이 설정
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

    // 📱 디바이스 회전이나 브라우저 리사이즈 시에도 자동 맞춤 비율 상시 고정
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