// ==========================================
// 코리요 지킴이 가상 DB & 인증 시스템 (localStorage)
// 파일명: js/auth.js
// ==========================================

// 🏢 스크린샷 데이터 기반 화성시 4개 구청별 정확한 관할 구역 정의
const hscRegionData = {
    "효행구": ["봉담읍", "매송면", "비봉면", "정남면", "기배동"],
    "병점구": ["진안동", "병점1동", "병점2동", "반월동", "화산동"],
    "만세구": ["우정읍", "향남읍", "남양읍", "마도면", "송산면", "서신면", "팔탄면", "장안면", "양감면", "새솔동"],
    "동탄구": ["동탄1동", "동탄2동", "동탄3동", "동탄4동", "동탄5동", "동탄6동", "동탄7동", "동탄8동", "동탄9동"]
};

/**
 * 구청 선택 시 세부 읍면동 리스트를 자동으로 바꿔주는 함수
 */
function updateDongOptions() {
    const guSelect = document.getElementById("signup-gu");
    const dongSelect = document.getElementById("signup-region");
    const selectedGu = guSelect.value;

    // 기존 옵션 초기화
    dongSelect.innerHTML = '<option value="" disabled selected>세부 관리지역(읍·면·동) 선택</option>';

    if (selectedGu && hscRegionData[selectedGu]) {
        // 선택한 구에 해당하는 동 리스트를 순회하며 option 생성
        hscRegionData[selectedGu].forEach(dong => {
            const option = document.createElement("option");
            option.value = dong;
            option.textContent = dong;
            dongSelect.appendChild(option);
        });
    }
}

/**
 * 1. 회원가입 처리 (데이터 저장)
 */
function handleSignup(event) {
    event.preventDefault(); 
    
    const userId = document.getElementById("signup-id").value.trim();
    const userPw = document.getElementById("signup-pw").value;
    const userGu = document.getElementById("signup-gu").value;
    const userRegion = document.getElementById("signup-region").value; 
    
    if (!userGu || !userRegion) {
        alert("관리지역을 모두 선택해 주세요!");
        return false;
    }

    if (localStorage.getItem(`user_${userId}`)) {
        alert("이미 존재하는 아이디입니다. 다른 아이디를 사용해 주세요.");
        return false;
    }
    
    const userData = {
        id: userId,
        pw: userPw,
        gu: userGu,
        region: userRegion, 
        signupDate: new Date().toLocaleDateString()
    };
    
    localStorage.setItem(`user_${userId}`, JSON.stringify(userData));
    
    alert(`🎉 회원가입이 완료되었습니다!\n소속: 화성시 ${userGu} ${userRegion}\n로그인 화면으로 이동합니다.`);
    window.location.href = "login.html";
    return false;
}

/**
 * 2. 로그인 처리 (데이터 검증)
 */
function handleLogin(event) {
    event.preventDefault();
    
    const inputId = document.getElementById("username").value.trim();
    const inputPw = document.getElementById("password").value;
    
    const storedUser = localStorage.getItem(`user_${inputId}`);
    
    if (!storedUser) {
        alert("등록되지 않은 아이디입니다. 회원가입을 먼저 진행해 주세요.");
        return false;
    }
    
    const user = JSON.parse(storedUser);
    
    if (user.pw === inputPw) {
        alert(`🟢 ${user.id} 지킴이님, 환영합니다!\n담당 구역: [${user.gu} ${user.region}] 순찰을 시작합니다.`);
        
        localStorage.setItem("currentUser", inputId);
        window.location.href = "index.html";
    } else {
        alert("❌ 비밀번호가 일치하지 않습니다. 다시 확인해 주세요.");
    }
    
    return false;
}

/**
 * 3. 회원 탈퇴 (데이터 삭제)
 */
function deleteAccount() {
    const currentUserId = localStorage.getItem("currentUser");
    
    if (!currentUserId) {
        alert("로그인된 정보가 없습니다.");
        return;
    }
    
    if (confirm("정말로 탈퇴하시겠습니까? 저장된 모든 순찰 기록과 회원 정보가 영구 삭제됩니다.")) {
        localStorage.removeItem(`user_${currentUserId}`);
        localStorage.removeItem("currentUser");
        
        alert("회원 탈퇴 및 가상 DB 내 데이터 기록 삭제가 완료되었습니다.");
        window.location.href = "login.html";
    }
}