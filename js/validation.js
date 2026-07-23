/**
 * 회원 아이디·비밀번호 규칙 (프론트·백엔드 동일)
 */
(function (global) {
  const LOGIN_ID_RE = /^[A-Za-z0-9_]{4,20}$/;
  const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

  const MESSAGES = {
    loginId: "아이디는 4~20자, 영문·숫자·_(언더스코어)만 사용할 수 있습니다.",
    password: "비밀번호는 8~64자이며, 영문과 숫자를 각각 1자 이상 포함해야 합니다.",
  };

  global.AuthValidation = {
    LOGIN_ID_RE,
    PASSWORD_RE,
    MESSAGES,
    isValidLoginId: (id) => LOGIN_ID_RE.test(String(id || "").trim()),
    isValidPassword: (pw) => PASSWORD_RE.test(String(pw || "")),
  };
})(window);
