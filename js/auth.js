// 회원가입·로그인

const signupRegionData = {
  "효행구": ["봉담읍", "매송면", "비봉면", "정남면", "기배동"],
  "병점구": ["진안동", "병점1동", "병점2동", "반월동", "화산동"],
  "만세구": ["우정읍", "향남읍", "남양읍", "마도면", "송산면", "서신면", "팔탄면", "장안면", "양감면", "새솔동"],
  "동탄구": ["동탄1동", "동탄2동", "동탄3동", "동탄4동", "동탄5동", "동탄6동", "동탄7동", "동탄8동", "동탄9동"]
};

function updateDongOptions() {
  const guSelect = document.getElementById("signup-gu");
  const regionSelect = document.getElementById("signup-region");

  if (!guSelect || !regionSelect) return;

  const selectedGu = guSelect.value;

  regionSelect.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "세부 관리지역(읍·면·동) 선택";
  defaultOption.disabled = true;
  defaultOption.selected = true;
  regionSelect.appendChild(defaultOption);

  if (signupRegionData[selectedGu]) {
    signupRegionData[selectedGu].forEach(dong => {
      const option = document.createElement("option");
      option.value = dong;
      option.textContent = dong;
      regionSelect.appendChild(option);
    });
  }
}

function handleSignup(e) {
  if (e) e.preventDefault();

  const nameInput = document.getElementById("user_name");
  const idInput = document.getElementById("signup-id");
  const pwInput = document.getElementById("signup-pw");
  const guSelect = document.getElementById("signup-gu");
  const regionSelect = document.getElementById("signup-region");

  if (!nameInput || !idInput || !pwInput || !guSelect || !regionSelect) return false;

  idInput.setCustomValidity("");
  pwInput.setCustomValidity("");

  const idRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,8}$/;
  if (!idRegex.test(idInput.value.trim())) {
    idInput.setCustomValidity("아이디는 영문과 숫자를 조합하여 6~8자로 입력해 주세요.");
    idInput.reportValidity();
    return false;
  }

  const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,10}$/;
  if (!pwRegex.test(pwInput.value.trim())) {
    pwInput.setCustomValidity("비밀번호는 영문과 숫자를 조합하여 8~10자로 입력해 주세요.");
    pwInput.reportValidity();
    return false;
  }

  const users = JSON.parse(localStorage.getItem("users") || "[]");

  if (users.some(u => u.id === idInput.value.trim())) {
    idInput.setCustomValidity("이미 존재하는 아이디입니다.");
    idInput.reportValidity();
    return false;
  }

  users.push({
    name: nameInput.value.trim(),
    id: idInput.value.trim(),
    pw: pwInput.value.trim(),
    gu: guSelect.value,
    region: regionSelect.value
  });
  localStorage.setItem("users", JSON.stringify(users));

  window.location.replace("login.html");
  return false;
}

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

  localStorage.setItem("currentUser", JSON.stringify({
    name: user.name || user.id,
    gu: user.gu || "만세구",
    region: user.region || "향남읍"
  }));

  window.location.replace("index.html");
  return false;
}

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

document.addEventListener("DOMContentLoaded", () => {
  const signupIdEl = document.getElementById("signup-id");
  const signupPwEl = document.getElementById("signup-pw");

  if (signupIdEl) signupIdEl.addEventListener("input", () => signupIdEl.setCustomValidity(""));
  if (signupPwEl) signupPwEl.addEventListener("input", () => signupPwEl.setCustomValidity(""));

  const guSelect = document.getElementById("signup-gu");
  if (guSelect && guSelect.value) {
    updateDongOptions();
  }
});
