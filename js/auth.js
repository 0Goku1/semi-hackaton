// ==========================================
// 코리요 지킴이 - 인증 및 구역 연동 코어 시스템
// 파일명: js/auth.js
// ==========================================

// 🏢 [업데이트 완료] 화성시 구청별 최종 세부 관리지역(읍·면·동) 데이터 매핑
const hscRegionData = {
    "효행구": ["봉담읍", "매송면", "비봉면", "정남면", "기배동"],
    "병점구": ["진안동", "병점1동", "병점2동", "반월동", "화산동"],
    "만세구": ["우정읍", "향남읍", "남양읍", "마도면", "송산면", "서신면", "팔탄면", "장안면", "양감면", "새솔동"],
    "동탄구": ["동탄1동", "동탄2동", "동탄3동", "동탄4동", "동탄5동", "동탄6동", "동탄7동", "동탄8동", "동탄9동"]
};

// 🗺️ 구청 선택 시 세부 관리지역 옵션을 동적으로 변경하는 함수
function updateDongOptions() {
    const guSelect = document.getElementById('signup-gu');
    const regionSelect = document.getElementById('signup-region');
    if (!guSelect || !regionSelect) return;
    
    const selectedGu = guSelect.value;
    regionSelect.innerHTML = '<option value="" disabled selected>세부 관리지역(읍·면·동) 선택</option>';

    // 변경된 hscRegionData 기준 동적 렌더링
    if (selectedGu && hscRegionData[selectedGu]) {
        hscRegionData[selectedGu].forEach(dong => {
            const option = document.createElement('option');
            option.value = dong;
            option.textContent = dong;
            regionSelect.appendChild(option);
        });
    }
}

// 👁️ 비밀번호 보이기/숨기기 토글 함수 (SVG 그래픽 스위칭)
function togglePasswordVisibility(inputId, button) {
    const passwordInput = document.getElementById(inputId);
    if (!passwordInput) return;
    
    const eyeOpenSVG = `
        <svg class="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff6f00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>
    `;
    
    const eyeClosedSVG = `
        <svg class="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
    `;

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        button.innerHTML = eyeOpenSVG;
    } else {
        passwordInput.type = 'password';
        button.innerHTML = eyeClosedSVG;
    }
}

// 📝 회원가입 처리 함수
function handleSignup(event) {
    if (event) event.preventDefault();

    const userName = document.getElementById('user_name').value.trim();
    const userId = document.getElementById('signup-id').value.trim();
    const userPw = document.getElementById('signup-pw').value;
    const userGu = document.getElementById('signup-gu').value;
    const userRegion = document.getElementById('signup-region').value;

    // 아이디 및 비밀번호 정규식 유효성 검사 규칙
    const idRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,8}$/;
    const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,10}$/;

    if (!idRegex.test(userId)) {
        alert("아이디는 영문과 숫자를 조합하여 6~8자로 입력해 주세요.");
        return false;
    }

    if (!pwRegex.test(userPw)) {
        alert("비밀번호는 영문과 숫자를 조합하여 8~10자로 입력해 주세요.");
        return false;
    }

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const isDuplicate = users.some(user => user.id === userId);
    if (isDuplicate) {
        alert("이미 존재하는 아이디입니다.");
        return false;
    }

    // 가상 DB 객체 구조 일치화
    const newUser = { id: userId, pw: userPw, name: userName, gu: userGu, region: userRegion };
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));

    alert(`🎉 ${userName} 님, 회원가입이 완료되었습니다!\n로그인 화면으로 이동합니다.`);
    window.location.replace("login.html");
    return false;
}

// 🔑 로그인 처리 함수
function handleLogin(event) {
    if (event) event.preventDefault();

    const loginId = document.getElementById('login-id').value.trim();
    const loginPw = document.getElementById('login-pw').value;

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const matchedUser = users.find(user => user.id === loginId && user.pw === loginPw);

    if (matchedUser) {
        localStorage.setItem('currentUser', JSON.stringify({
            name: matchedUser.name,
            gu: matchedUser.gu,
            region: matchedUser.region
        }));
        
        alert(`🟢 ${matchedUser.name} 지킴이님, 환영합니다!\n담당 구역: [${matchedUser.gu} ${matchedUser.region}] 순찰을 시작합니다.`);
        window.location.href = "index.html";
        return true;
    } else {
        alert("아이디 또는 비밀번호가 올바르지 않습니다.");
        return false;
    }
}