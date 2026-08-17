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

function setSignupStatus(message, kind) {
  const el = document.getElementById("signup-status");
  if (!el) {
    if (message) alert(message);
    return;
  }
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    el.classList.remove("is-error", "is-ok");
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle("is-error", kind === "error");
  el.classList.toggle("is-ok", kind === "ok");
}

async function handleSignup(e) {
  if (e) e.preventDefault();

  const submitBtn = document.getElementById("signup-submit-btn");
  const name = (document.getElementById("user_name") || {}).value?.trim() || "";
  const loginId = (document.getElementById("signup-id") || {}).value?.trim() || "";
  const password = (document.getElementById("signup-pw") || {}).value || "";
  const gu = (document.getElementById("signup-gu") || {}).value || "";
  const region = (document.getElementById("signup-region") || {}).value || "";
  const role = (document.getElementById("signup-role") || {}).value || "";

  setSignupStatus("", null);

  if (!name) {
    setSignupStatus("성명을 입력해 주세요.", "error");
    return false;
  }
  if (!AuthValidation.isValidLoginId(loginId)) {
    setSignupStatus(AuthValidation.MESSAGES.loginId, "error");
    return false;
  }
  if (/^officer\d+$/i.test(loginId)) {
    setSignupStatus(
      "officer01~30 은 시드 요원 전용입니다. 다른 아이디를 쓰세요.",
      "error"
    );
    return false;
  }
  if (!AuthValidation.isValidPassword(password)) {
    setSignupStatus(AuthValidation.MESSAGES.password, "error");
    return false;
  }
  if (!gu || !region) {
    setSignupStatus("관리 구청과 세부 지역을 선택해 주세요.", "error");
    return false;
  }
  if (role !== "officer" && role !== "dev") {
    setSignupStatus("계정 역할(officer / dev)을 선택해 주세요.", "error");
    return false;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "가입 중…";
  }

  try {
    await ApiClient.signup({
      login_id: loginId,
      password,
      name,
      gu,
      region,
      role,
    });
    setSignupStatus("가입 완료. 로그인 화면으로 이동합니다…", "ok");
    setTimeout(() => {
      window.location.replace("login.html");
    }, 600);
  } catch (err) {
    const status = err && err.status;
    let msg = (err && err.message) || "회원가입에 실패했습니다.";
    if (status === 409) {
      msg =
        "이미 사용 중인 아이디입니다. 다른 아이디로 가입하거나, 해당 아이디로 로그인해 주세요.";
    } else if (/Failed to fetch|네트워크|연결할 수 없/i.test(msg)) {
      msg = "서버에 연결할 수 없습니다. EC2 API(uvicorn)가 켜져 있는지 확인하세요.";
    }
    setSignupStatus(msg, "error");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "가입하기";
    }
  }
  return false;
}

function setLoginStatus(message, kind) {
  const el = document.getElementById("login-status");
  if (!el) {
    if (message) alert(message);
    return;
  }
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    el.classList.remove("is-error", "is-ok");
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle("is-error", kind === "error");
  el.classList.toggle("is-ok", kind === "ok");
}

function warnIfFileProtocol() {
  if (location.protocol !== "file:") return;
  setLoginStatus(
    "지금 file:// 로 열려 있습니다. 로그인이 불안정합니다. http://localhost:3000/login.html 로 여세요.",
    "error"
  );
}

async function handleLogin(e) {
  if (e) e.preventDefault();

  const submitBtn = document.getElementById("login-submit-btn");
  const loginId = (document.getElementById("login-id") || {}).value?.trim() || "";
  const password = (document.getElementById("login-pw") || {}).value || "";

  setLoginStatus("", null);

  if (!loginId || !password) {
    setLoginStatus("아이디와 비밀번호를 입력해 주세요.", "error");
    return false;
  }

  if (typeof SECRETS === "undefined" || !SECRETS.API_BASE_URL) {
    setLoginStatus("js/secrets.js 의 API_BASE_URL 이 없습니다.", "error");
    return false;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "로그인 중…";
  }

  try {
    const data = await ApiClient.login({ login_id: loginId, password });
    if (!data || !data.access_token) {
      throw new Error("서버 응답에 access_token 이 없습니다.");
    }
    ApiClient.setSession(data.access_token, data.user || null);
    setLoginStatus("로그인 성공. 메인으로 이동합니다…", "ok");
    setTimeout(() => {
      window.location.replace("index.html");
    }, 400);
  } catch (err) {
    let msg = (err && err.message) || "로그인에 실패했습니다.";
    if (/Failed to fetch|네트워크|연결할 수 없/i.test(msg)) {
      msg =
        "서버에 연결할 수 없습니다. EC2 uvicorn 과 API_BASE_URL 을 확인하세요.";
    }
    setLoginStatus(msg, "error");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "로그인";
    }
  }
  return false;
}

function togglePasswordVisibility(inputId, buttonEl) {
  const passwordInput = document.getElementById(inputId);
  if (!passwordInput) return;
  passwordInput.type = passwordInput.type === "password" ? "text" : "password";
}

document.addEventListener("DOMContentLoaded", () => {
  warnIfFileProtocol();
  const guSelect = document.getElementById("signup-gu");
  if (guSelect && guSelect.value) updateDongOptions();
});
