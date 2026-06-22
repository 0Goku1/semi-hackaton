// ============================================================
//  report.js — 순찰 기록 보고서
//  patrol-app.js 가 localStorage("patrolLog") 에 저장한
//  실제 소요 시간 데이터를 읽어 레이블에 표시한다.
//  (새 탭에서 열리므로 localStorage 로 공유)
// ============================================================

function readPatrolLog() {
    try {
        const raw = localStorage.getItem("patrolLog");
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.warn("[report] patrolLog 파싱 실패:", e);
        return null;
    }
}

// 초 → "1시간 5분" / "12분" / "1분 미만" (분 단위까지만 표시)
function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);

    if (hours > 0) return `${hours}시간 ${minutes}분`;
    if (minutes > 0) return `${minutes}분`;
    return "1분 미만";
}

// ISO 문자열 → "14:05"
function formatClock(isoString) {
    if (!isoString) return null;
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return null;

    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

// patrolLog → "12분 34초 (14:00 ~ 14:12)"
function buildPatrolTimeLabel(log) {
    const duration = formatDuration(log.elapsedSeconds);
    const start = formatClock(log.startTime);
    const end = formatClock(log.endTime);

    if (start && end) return `${duration} (${start} ~ ${end})`;
    return duration;
}

window.addEventListener("DOMContentLoaded", () => {
    const timeInput = document.getElementById("patrol-time");
    const log = readPatrolLog();

    if (log) {
        timeInput.value = buildPatrolTimeLabel(log);
    } else {
        // 순찰 데이터가 없을 때(직접 접근 등) 대비한 fallback
        timeInput.value = "기록된 순찰 시간 없음";
    }
});

document.getElementById("btn-submit-report").addEventListener("click", () => {
    const notes = document.getElementById("patrol-notes").value;
    const weather = document.getElementById("weather-status").value;

    if (!notes.trim()) {
        alert("순찰 기록이나 특이사항을 한 줄이라도 적어 주세요!");
        return;
    }

    const log = readPatrolLog() || {};
    localStorage.setItem(
        "patrolReport",
        JSON.stringify({
            ...log,
            weatherStatus: weather,
            notes: notes.trim(),
            reportedAt: new Date().toISOString(),
        })
    );

    alert("순찰 기록이 성공적으로 등록되었습니다. 메인 대시보드로 돌아갑니다! 🟢");
    window.location.href = "index.html";
});
