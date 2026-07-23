// 회원가입·로그인 — FastAPI 연동

const signupRegionData = {
  효행구: ["봉담읍", "매송면", "비봉면", "정남면", "기배동"],
  병점구: ["진안동", "병점1동", "병점2동", "반월동", "화산동"],
  만세구: ["우정읍", "향남읍", "남양읍", "마도면", "송산면", "서신면", "팔탄면", "장안면", "양감면", "새솔동"],
  동탄구: ["동탄1동", "동탄2동", "동탄3동", "동탄4동", "동탄5동", "동탄6동", "동탄7동", "동탄8동", "동탄9동"],
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
    signupRegionData[selectedGu].forEach((dong) => {
      const option = document.createElement("option");
      option.value = dong;
      option.textContent = dong;
      regionSelect.appendChild(option);
    });
  }
}

async function handleSignup(e) {
  if (e) e.preventDefault();

  const name = (document.getElementById("user_name") || {}).value?.trim() || "";
  const loginId = (document.getElementById("signup-id") || {}).value?.trim() || "";
  const password = (document.getElementById("signup-pw") || {}).value || "";
  const gu = (document.getElementById("signup-gu") || {}).value || "";
  const region = (document.getElementById("signup-region") || {}).value || "";

  if (!name) {
    alert("성명을 입력해 주세요.");
    return false;
  }
  if (!AuthValidation.isValidLoginId(loginId)) {
    alert(AuthValidation.MESSAGES.loginId);
    return false;
  }
  if (!AuthValidation.isValidPassword(password)) {
    alert(AuthValidation.MESSAGES.password);
    return false;
  }
  if (!gu || !region) {
    alert("관리 구청과 세부 지역을 선택해 주세요.");
    return false;
  }

  try {
    await ApiClient.signup({
      login_id: loginId,
      password,
      name,
      gu,
      region,
    });
    alert("회원가입이 완료되었습니다. 로그인해 주세요.");
    window.location.replace("login.html");
  } catch (err) {
    alert(err.message || "회원가입에 실패했습니다.");
  }
  return false;
}

async function handleLogin(e) {
  if (e) e.preventDefault();

  const loginId = (document.getElementById("login-id") || {}).value?.trim() || "";
  const password = (document.getElementById("login-pw") || {}).value || "";

  if (!loginId || !password) {
    alert("아이디와 비밀번호를 입력해 주세요.");
    return false;
  }

  try {
    const data = await ApiClient.login({ login_id: loginId, password });
    ApiClient.setSession(data.access_token, data.user);
    window.location.replace("index.html");
  } catch (err) {
    alert(err.message || "로그인에 실패했습니다.");
  }
  return false;
}

function togglePasswordVisibility(inputId, buttonEl) {
  const passwordInput = document.getElementById(inputId);
  if (!passwordInput) return;
  passwordInput.type = passwordInput.type === "password" ? "text" : "password";
}

document.addEventListener("DOMContentLoaded", () => {
  const guSelect = document.getElementById("signup-gu");
  if (guSelect && guSelect.value) updateDongOptions();
});
