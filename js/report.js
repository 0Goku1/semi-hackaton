window.addEventListener('DOMContentLoaded', () => {
    const savedTime = localStorage.getItem("patrolTime");
    const timeInput = document.getElementById('patrol-time');
    if (savedTime) {
        timeInput.value = savedTime; 
    } else {
        timeInput.value = "45분 (14:00 ~ 14:45)"; 
    }
});

document.getElementById('btn-submit-report').addEventListener('click', () => {
    const notes = document.getElementById('patrol-notes').value;
    
    if(!notes.trim()) {
        alert("순찰 기록이나 특이사항을 한 줄이라도 적어 주세요!");
        return;
    }

    alert("순찰 기록이 성공적으로 등록되었습니다. 메인 대시보드로 돌아갑니다! 🟢");
    window.location.href = "index.html";
});