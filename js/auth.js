// 회원가입·로그인 (디자인 시제품 모드 - 조건 없는 즉시 이동)

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

// 회원가입 버튼 클릭 시 조건 없이 메인으로 이동
function handleSignup(e) {
  if (e) e.preventDefault();
  
  localStorage.setItem("currentUser", JSON.stringify({
    name: "정승우",
    gu: "효행구",
    region: "봉담읍"
  }));

  window.location.replace("index.html");
  return false;
}

// 로그인 버튼 클릭 시 조건 없이 메인으로 이동
function handleLogin(e) {
  if (e) e.preventDefault();
  
  localStorage.setItem("currentUser", JSON.stringify({
    name: "정승우",
    gu: "효행구",
    region: "봉담읍"
  }));

  window.location.replace("index.html");
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