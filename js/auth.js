// ==========================================================================
// 코리요 지킴이 - 사용자 인증 및 회원가입 행정 구역 동적 매핑 (HTML 완벽 호환)
// 파일명: js/auth.js
// ==========================================================================

// 🏢 화성시 구청별 세부 관리지역 데이터 매핑
const signupRegionData = {
    "효행구": ["봉담읍", "매송면", "비봉면", "정남면", "기배동"],
    "병점구": ["진안동", "병점1동", "병점2동", "반월동", "화산동"],
    "만세구": ["우정읍", "향남읍", "남양읍", "마도면", "송산면", "서신면", "팔탄면", "장안면", "양감면", "새솔동"],
    "동탄구": ["동탄1동", "동탄2동", "동탄3동", "동탄4동", "동탄5동", "동탄6동", "동탄7동", "동탄8동", "동탄9동"]
  };
  
  /**
   * 🗺️ [회원가입] 구청 선택 변경 시 세부 관리지역 리스트 동적 리렌더링
   * HTML에 명시된 id="signup-gu" 및 onchange="updateDongOptions()"와 직접 연동됩니다.
   */
  function updateDongOptions() {
    const guSelect = document.getElementById("signup-gu");
    const regionSelect = document.getElementById("signup-region");
    
    if (!guSelect || !regionSelect) return;
    
    const selectedGu = guSelect.value;
    
    // 기존 옵션 완벽 초기화
    regionSelect.innerHTML = "";
    
    // 기본 플레이스홀더 옵션 생성 및 추가
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "세부 관리지역(읍·면·동) 선택";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    regionSelect.appendChild(defaultOption);
  
    // 선택한 구청 데이터에 맞는 하위 읍면동 옵션 주입
    if (signupRegionData[selectedGu]) {
        signupRegionData[selectedGu].forEach(dong => {
            const option = document.createElement("option");
            option.value = dong;
            option.textContent = dong;
            regionSelect.appendChild(option);
        });
    }
  }
  
  /**
   * 📝 회원가입 처리 프로세스 (HTML 폼의 onsubmit="return handleSignup(event)"과 매핑)
   */
  function handleSignup(e) {
      if (e) e.preventDefault();
  
      const nameInput = document.getElementById("user_name");
      const idInput = document.getElementById("signup-id");
      const pwInput = document.getElementById("signup-pw");
      const guSelect = document.getElementById("signup-gu");
      const regionSelect = document.getElementById("signup-region");
  
      if (!nameInput || !idInput || !pwInput || !guSelect || !regionSelect) return false;
  
      // 검증 초기화
      idInput.setCustomValidity("");
      pwInput.setCustomValidity("");
  
      // 아이디 제약 조건 검증 (영문+숫자 6~8자)
      const idRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,8}$/;
      if (!idRegex.test(idInput.value.trim())) {
          idInput.setCustomValidity("아이디는 영문과 숫자를 조합하여 6~8자로 입력해 주세요.");
          idInput.reportValidity();
          return false;
      }
  
      // 비밀번호 제약 조건 검증 (영문+숫자 8~10자)
      const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,10}$/;
      if (!pwRegex.test(pwInput.value.trim())) {
          pwInput.setCustomValidity("비밀번호는 영문과 숫자를 조합하여 8~10자로 입력해 주세요.");
          pwInput.reportValidity();
          return false;
      }
  
      const users = JSON.parse(localStorage.getItem("users") || "[]");
      
      // 중복 아이디 검사
      if (users.some(u => u.id === idInput.value.trim())) {
          idInput.setCustomValidity("이미 존재하는 아이디입니다.");
          idInput.reportValidity();
          return false;
      }
  
      // 신규 대원 데이터 저장
      const newUser = {
          name: nameInput.value.trim(),
          id: idInput.value.trim(),
          pw: pwInput.value.trim(),
          gu: guSelect.value,
          region: regionSelect.value
      };
  
      users.push(newUser);
      localStorage.setItem("users", JSON.stringify(users));
  
      // 회원가입 완료 후 바로 로그인 화면으로 이동
      window.location.replace("login.html");
      return false;
  }
  
  /**
   * 🔐 로그인 시도 프로세스 및 입력창 개별 말풍선 안내
   */
  function handleLogin(e) {
      if (e) e.preventDefault();
      
      const idInputEl = document.getElementById("login-id");
      const pwInputEl = document.getElementById("login-pw");
      
      if (!idInputEl || !pwInputEl) return false;
  
      const idInput = idInputEl.value.trim();
      const pwInput = pwInputEl.value.trim();
  
      idInputEl.setCustomValidity("");
      pwInputEl.setCustomValidity("");
  
      if (!idInput) {
          idInputEl.setCustomValidity("아이디를 입력해 주세요.");
          idInputEl.reportValidity();
          return false;
      }
      if (!pwInput) {
          pwInputEl.setCustomValidity("비밀번호를 입력해 주세요.");
          pwInputEl.reportValidity();
          return false;
      }
  
      const users = JSON.parse(localStorage.getItem("users") || "[]");
      const user = users.find(u => (u.id === idInput || u.name === idInput));
  
      if (!user) {
          idInputEl.setCustomValidity("아이디 또는 비밀번호가 올바르지 않습니다.");
          idInputEl.reportValidity();
          return false;
      }
  
      if (user.pw !== pwInput) {
          pwInputEl.setCustomValidity("아이디 또는 비밀번호가 올바르지 않습니다.");
          pwInputEl.reportValidity();
          return false;
      }
  
      const sessionData = {
          name: user.name || user.id,
          gu: user.gu || "만세구",
          region: user.region || "향남읍"
      };
      localStorage.setItem("currentUser", JSON.stringify(sessionData));
  
      window.location.replace("index.html");
      return false;
  }
  
  /**
   * 👀 비밀번호 상시 보기/숨기기 토글 함수
   */
  function togglePasswordVisibility(inputId, buttonEl) {
      const passwordInput = document.getElementById(inputId);
      if (!passwordInput) return;
  
      if (passwordInput.type === "password") {
          passwordInput.type = "text";
          buttonEl.innerHTML = `
              <svg class="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff6f00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
              </svg>
          `;
      } else {
          passwordInput.type = "password";
          buttonEl.innerHTML = `
              <svg class="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
          `;
      }
  }
  
  /**
   * 🚀 초기 실행 및 브라우저 기본 말풍선 리셋용 이벤트 바인딩
   */
  document.addEventListener("DOMContentLoaded", () => {
      const signupIdEl = document.getElementById("signup-id");
      const signupPwEl = document.getElementById("signup-pw");
  
      if (signupIdEl) signupIdEl.addEventListener("input", () => signupIdEl.setCustomValidity(""));
      if (signupPwEl) signupPwEl.addEventListener("input", () => signupPwEl.setCustomValidity(""));
      
      // 혹시 모를 초기 구역 동기화 트리거
      const guSelect = document.getElementById("signup-gu");
      if (guSelect && guSelect.value) {
          updateDongOptions();
      }
  });