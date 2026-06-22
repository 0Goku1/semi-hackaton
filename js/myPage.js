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

// 🔄 원래 설계된 CSS 클래스(.hidden) 토글 방식 적용
function switchTab(tab) {
  const tabs = document.querySelectorAll('.tab-btn');
  const regionForm = document.getElementById('region-form');
  const passwordForm = document.getElementById('password-form');

  if (!regionForm || !passwordForm) return;

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
  if (e && typeof e.preventDefault === "function") e.preventDefault();
  
  const gu = document.getElementById("modal-signup-gu").value;
  const region = document.getElementById("modal-signup-region").value;
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const users = JSON.parse(localStorage.getItem("users") || "[]");

  if (currentUser) {
      currentUser.gu = gu;
      currentUser.region = region;
      localStorage.setItem("currentUser", JSON.stringify(currentUser));

      const userIndex = users.findIndex(u => (u.id === currentUser.id || u.name === currentUser.name));
      if (userIndex !== -1) {
          users[userIndex].gu = gu;
          users[userIndex].region = region;
          localStorage.setItem("users", JSON.stringify(users));
      }

      window.location.replace("index.html");
  }
  return false;
}

// 🔑 [예쁜 인라인 안내 디자인 적용] 비밀번호 변경 프로세스
function changePassword(e) {
  if (e && typeof e.preventDefault === "function") {
      e.preventDefault(); 
  }
  
  const currentPwEl = document.getElementById('current-password');
  const newPwEl = document.getElementById('new-password');
  const confirmPwEl = document.getElementById('new-password-confirm');

  const currentPw = currentPwEl.value;
  const newPw = newPwEl.value;
  const confirmPw = confirmPwEl.value;
  
  currentPwEl.setCustomValidity("");
  newPwEl.setCustomValidity("");
  confirmPwEl.setCustomValidity("");
  
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const users = JSON.parse(localStorage.getItem("users") || "[]");

  if (!currentUser) return false;

  const userIndex = users.findIndex(u => (u.name === currentUser.name || u.id === currentUser.id));
  if (userIndex === -1) return false;
  
  // 입력창 하단에 순정 말풍선 에러 매핑
  if (users[userIndex].pw !== currentPw) {
      currentPwEl.setCustomValidity("현재 비밀번호가 일치하지 않습니다.");
      currentPwEl.reportValidity();
      return false;
  }
    
  const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,10}$/;
  if (!pwRegex.test(newPw)) {
      newPwEl.setCustomValidity("영문과 숫자를 조합하여 8~10자로 입력해 주세요.");
      newPwEl.reportValidity();
      return false;
  }

  if (newPw !== confirmPw) {
      confirmPwEl.setCustomValidity("새 비밀번호 확인 입력이 일치하지 않습니다.");
      confirmPwEl.reportValidity();
      return false;
  }
    
  // 데이터 반영 및 세션 끊기
  users[userIndex].pw = newPw;
  localStorage.setItem("users", JSON.stringify(users));
  localStorage.removeItem('currentUser');
    
  // 🚨 [핵심 변경 디자인]: 투박한 모달 없이 폼 맨 아래에 동적으로 세련된 인라인 메시지 생성 및 전개
  const formGroupBtn = confirmPwEl.closest('form').querySelector('.edit-btn-group');
  
  // 기존에 혹시 생성되어 있을지 모를 텍스트박스 제거용
  const existingSuccessMsg = document.getElementById("success-inline-msg");
  if(existingSuccessMsg) existingSuccessMsg.remove();

  const successMessage = document.createElement("div");
  successMessage.id = "success-inline-msg";
  // 코리요 시그니처 주황색 컬러 바탕에 깔끔한 디자인 튜닝
  successMessage.style.cssText = `
    background-color: #fff0e6;
    color: #ff6f00;
    font-size: 13.5px;
    font-weight: 700;
    text-align: center;
    padding: 14px;
    border-radius: 12px;
    margin-bottom: 20px;
    border: 1px solid #ffdbcc;
    animation: fadeIn 0.3s ease;
  `;
  successMessage.innerHTML = "보안 정보 변경 성공!<br><span style='font-size:12px; font-weight:500; color:#666;'>안전한 순찰을 위해 잠시 후 로그인 화면으로 이동합니다.</span>";
  
  // 버튼 컴포넌트 바로 위에 이쁘게 안착
  formGroupBtn.parentNode.insertBefore(successMessage, formGroupBtn);

  // 대원이 텍스트를 읽고 시각적으로 인지할 시간을 준 후 안전하게 스위칭
  setTimeout(() => {
      window.location.replace("login.html");
  }, 1800);

  return false;
}

// 🚀 화면 초기 진입 데이터 매핑
function loadMyPageData() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  if (currentUser) {
      const nameFields = document.querySelectorAll(".user-name-field");
      nameFields.forEach(el => {
          el.value = currentUser.name || currentUser.id || "";
      });
    
      const guSelect = document.getElementById("modal-signup-gu");
      if (guSelect && currentUser.gu) {
          guSelect.value = currentUser.gu;
      }
    
      handleGuChange();
      
      const regionSelect = document.getElementById("modal-signup-region");
      if (regionSelect && currentUser.region) {
          regionSelect.value = currentUser.region;
      }
  } else {
      handleGuChange();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadMyPageData();
  
  const currentPwEl = document.getElementById('current-password');
  const newPwEl = document.getElementById('new-password');
  const confirmPwEl = document.getElementById('new-password-confirm');
  
  if(currentPwEl) currentPwEl.addEventListener("input", () => currentPwEl.setCustomValidity(""));
  if(newPwEl) newPwEl.addEventListener("input", () => newPwEl.setCustomValidity(""));
  if(confirmPwEl) confirmPwEl.addEventListener("input", () => confirmPwEl.setCustomValidity(""));
});