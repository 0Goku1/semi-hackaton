// 내 정보 — FastAPI 연동 (구역 변경, 비밀번호 변경)

const myPageRegionData = {
  효행구: ["봉담읍", "매송면", "비봉면", "정남면", "기배동"],
  병점구: ["진안동", "병점1동", "병점2동", "반월동", "화산동"],
  만세구: ["우정읍", "향남읍", "남양읍", "마도면", "송산면", "서신면", "팔탄면", "장안면", "양감면", "새솔동"],
  동탄구: ["동탄1동", "동탄2동", "동탄3동", "동탄4동", "동탄5동", "동탄6동", "동탄7동", "동탄8동", "동탄9동"],
};

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

function switchTab(tab) {
  const tabs = document.querySelectorAll(".tab-btn");
  const regionForm = document.getElementById("region-form");
  const passwordForm = document.getElementById("password-form");

  if (!regionForm || !passwordForm) return;

  if (tab === "region") {
    tabs[0].classList.add("active");
    tabs[1].classList.remove("active");
    regionForm.classList.remove("hidden");
    passwordForm.classList.add("hidden");
  } else {
    tabs[0].classList.remove("active");
    tabs[1].classList.add("active");
    regionForm.classList.add("hidden");
    passwordForm.classList.remove("hidden");
  }
}

function handleGuChange() {
  const guSelect = document.getElementById("modal-signup-gu");
  const regionSelect = document.getElementById("modal-signup-region");
  if (!guSelect || !regionSelect) return;

  const selectedGu = guSelect.value;
  regionSelect.innerHTML = "";

  if (myPageRegionData[selectedGu]) {
    myPageRegionData[selectedGu].forEach((dong) => {
      const option = document.createElement("option");
      option.value = dong;
      option.textContent = dong;
      regionSelect.appendChild(option);
    });
  }
}

async function saveUpdatedRegion(e) {
  if (e && typeof e.preventDefault === "function") e.preventDefault();

  const gu = document.getElementById("modal-signup-gu").value;
  const region = document.getElementById("modal-signup-region").value;

  try {
    const user = await ApiClient.updateMe({ gu, region });
    ApiClient.updateCachedUser(user);
    window.location.replace("index.html");
  } catch (err) {
    alert(err.message || "구역 저장에 실패했습니다.");
  }
  return false;
}

async function changePassword(e) {
  if (e && typeof e.preventDefault === "function") e.preventDefault();

  const currentPwEl = document.getElementById("current-password");
  const newPwEl = document.getElementById("new-password");
  const confirmPwEl = document.getElementById("new-password-confirm");

  const currentPw = currentPwEl.value;
  const newPw = newPwEl.value;
  const confirmPw = confirmPwEl.value;

  currentPwEl.setCustomValidity("");
  newPwEl.setCustomValidity("");
  confirmPwEl.setCustomValidity("");

  const pwRegex = AuthValidation.PASSWORD_RE;
  if (!pwRegex.test(newPw)) {
    newPwEl.setCustomValidity(AuthValidation.MESSAGES.password);
    newPwEl.reportValidity();
    return false;
  }

  if (newPw !== confirmPw) {
    confirmPwEl.setCustomValidity("새 비밀번호 확인 입력이 일치하지 않습니다.");
    confirmPwEl.reportValidity();
    return false;
  }

  try {
    await ApiClient.changePassword({
      current_password: currentPw,
      new_password: newPw,
    });
  } catch (err) {
    currentPwEl.setCustomValidity(err.message || "비밀번호 변경에 실패했습니다.");
    currentPwEl.reportValidity();
    return false;
  }

  ApiClient.clearSession();

  const formGroupBtn = confirmPwEl.closest("form").querySelector(".edit-btn-group");
  const existingSuccessMsg = document.getElementById("success-inline-msg");
  if (existingSuccessMsg) existingSuccessMsg.remove();

  const successMessage = document.createElement("div");
  successMessage.id = "success-inline-msg";
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
  successMessage.innerHTML =
    "보안 정보 변경 성공!<br><span style='font-size:12px; font-weight:500; color:#666;'>안전한 순찰을 위해 잠시 후 로그인 화면으로 이동합니다.</span>";

  formGroupBtn.parentNode.insertBefore(successMessage, formGroupBtn);

  setTimeout(() => {
    window.location.replace("login.html");
  }, 1800);

  return false;
}

async function loadMyPageData() {
  if (!ApiClient.requireAuthPage()) return;

  try {
    const currentUser = await ApiClient.getMe();
    ApiClient.updateCachedUser(currentUser);

    const nameFields = document.querySelectorAll(".user-name-field");
    nameFields.forEach((el) => {
      el.value = currentUser.name || currentUser.login_id || "";
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
  } catch (err) {
    alert(err.message || "회원 정보를 불러오지 못했습니다.");
    ApiClient.clearSession();
    window.location.replace("login.html");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadMyPageData();

  const currentPwEl = document.getElementById("current-password");
  const newPwEl = document.getElementById("new-password");
  const confirmPwEl = document.getElementById("new-password-confirm");

  if (currentPwEl) currentPwEl.addEventListener("input", () => currentPwEl.setCustomValidity(""));
  if (newPwEl) newPwEl.addEventListener("input", () => newPwEl.setCustomValidity(""));
  if (confirmPwEl) confirmPwEl.addEventListener("input", () => confirmPwEl.setCustomValidity(""));
});
