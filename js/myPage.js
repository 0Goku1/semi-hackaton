// ==========================================================================
// 코리요 지킴이 - 내 정보 관리(구역/비밀번호) 핵심 비즈니스 로직
// 파일명: js/myPage.js
// ==========================================================================

// 🏢 화성시 구청별 세부 관리지역 데이터 매핑
const myPageRegionData = {
  "효행구": ["봉담읍", "매송면", "비봉면", "정남면", "기배동"],
  "병점구": ["진안동", "병점1동", "병점2동", "반월동", "화산동"],
  "만세구": ["우정읍", "향남읍", "남양읍", "마도면", "송산면", "서신면", "팔탄면", "장안면", "양감면", "새솔동"],
  "동탄구": ["동탄1동", "동탄2동", "동탄3동", "동탄4동", "동탄5동", "동탄6동", "동탄7동", "동탄8동", "동탄9동"]
};

// 👁️ 비밀번호 보이기/숨기기 토글 안전 버전
function togglePagePassword(inputId, button) {
  const inputField = document.getElementById(inputId);
  if (!inputField) return;

  const eyeOpenSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff6f00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  const eyeClosedSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

  if (inputField.type === "password") {
      inputField.type = "text";
      button.innerHTML = eyeOpenSVG;
  } else {
      inputField.type = "password";
      button.innerHTML = eyeClosedSVG;
  }
}

// 🔄 구역 변경 / 비밀번호 변경 탭 전환 상호작용
function switchTab(tab) {
  const tabs = document.querySelectorAll('.tab-btn');
  const regionForm = document.getElementById('region-form');
  const passwordForm = document.getElementById('password-form');

  if (tab === 'region') {
      tabs[0].classList.add('active');
      tabs[1].classList.remove('active');
      regionForm.classList.remove('hidden');
      passwordForm.classList.add('hidden');
  } else {
      tabs[0].classList.remove('active');
      tabs[1].classList.add('active');
      regionForm.classList.add('hidden');
      passwordForm.classList.remove('hidden');
  }
}

// 🗺️ 담당 구청 변경 시 소속 읍면동 리스트 동적 리렌더링
function handleGuChange() {
  const guSelect = document.getElementById("modal-signup-gu");
  const regionSelect = document.getElementById("modal-signup-region");
  if (!guSelect || !regionSelect) return;
  
  const selectedGu = guSelect.value;
  regionSelect.innerHTML = "";

  // 매핑 데이터 주입
  if (myPageRegionData[selectedGu]) {
      myPageRegionData[selectedGu].forEach(dong => {
          const option = document.createElement("option");
          option.value = dong;
          option.textContent = dong;
          regionSelect.appendChild(option);
      });
  }
}

// 🏢 변경된 행정 구역 데이터 로컬 스토리지 업데이트 및 동기화
function saveUpdatedRegion(e) {
  e.preventDefault();
  const gu = document.getElementById("modal-signup-gu").value;
  const region = document.getElementById("modal-signup-region").value;
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const users = JSON.parse(localStorage.getItem("users") || "[]");

  if (currentUser) {
      currentUser.gu = gu;
      currentUser.region = region;
      localStorage.setItem("currentUser", JSON.stringify(currentUser));

      const userIndex = users.findIndex(u => u.name === currentUser.name);
      if (userIndex !== -1) {
          users[userIndex].gu = gu;
          users[userIndex].region = region;
          localStorage.setItem("users", JSON.stringify(users));
      }

      alert("🟢 담당 행정 구역 정보가 정상적으로 수정 및 저장되었습니다.");
      window.location.replace("index.html");
  }
  return false;
}

// 🔑 비밀번호 변경 프로세스
function changePassword(e) {
  e.preventDefault();
  const currentPw = document.getElementById('current-password').value;
  const newPw = document.getElementById('new-password').value;
  const confirmPw = document.getElementById('new-password-confirm').value;
  
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const users = JSON.parse(localStorage.getItem("users") || "[]");

  if (!currentUser) return false;

  const userIndex = users.findIndex(u => u.name === currentUser.name);
  
  if (userIndex !== -1) {
      if (users[userIndex].pw !== currentPw) {
          alert("❌ 현재 비밀번호가 일치하지 않습니다. 다시 확인해 주세요.");
          return false;
      }
    
      const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,10}$/;
      if (!pwRegex.test(newPw)) {
          alert("⚠️ 새 비밀번호는 영문과 숫자를 조합하여 8~10자로 입력해 주세요.");
          return false;
      }

      if (newPw !== confirmPw) {
          alert("❌ 새 비밀번호 확인 입력이 일치하지 않습니다.");
          return false;
      }
    
      users[userIndex].pw = newPw;
      localStorage.setItem("users", JSON.stringify(users));
    
      alert("🔒 보안 정보 변경 성공!\n안전한 순찰을 위해 다시 로그인해 주세요.");
      localStorage.removeItem('currentUser');
      window.location.replace("login.html");
  }
  return false;
}

// 🚀 화면 초기 진입 라이프사이클 처리 (HTML의 class="user-name-field" 구조와 완벽히 동기화)
document.addEventListener("DOMContentLoaded", function () {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  if (currentUser) {
      // 🛠️ 핵심 수정: 에러 원인이었던 성명 인풋(class)을 안전하게 찾아서 주입
      const nameFields = document.querySelectorAll(".user-name-field");
      nameFields.forEach(el => {
          el.value = currentUser.name || "";
      });
    
      // 구청 데이터 바인딩
      const guSelect = document.getElementById("modal-signup-gu");
      if (guSelect && currentUser.gu) {
          guSelect.value = currentUser.gu;
      }
    
      // 세부 관리지역 리스트 생성 및 바인딩
      handleGuChange();
      
      const regionSelect = document.getElementById("modal-signup-region");
      if (regionSelect && currentUser.region) {
          regionSelect.value = currentUser.region;
      }
  } else {
      handleGuChange();
  }
});