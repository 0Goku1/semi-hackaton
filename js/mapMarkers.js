// ==========================================================================
// 지도 마커
//  - 나(메인) : images/markers/me.png (로드 실패 시 이니셜 아바타로 대체)
//  - 팀원      : DiceBear 이니셜 아바타 (이름에서 성을 뺀 형태로 표시)
// ==========================================================================
const ME_MARKER_IMAGE = "images/markers/me.png";

function getProfileAvatarUrl(name) {
  return (
    "https://api.dicebear.com/7.x/initials/svg?backgroundColor=FF6F00&seed=" +
    encodeURIComponent(name || "me")
  );
}

// 한국 이름에서 성(첫 글자)을 뺀 이름만 반환 ("이다영" -> "다영")
function getGivenName(name) {
  if (!name) return "";
  const trimmed = name.trim();
  return trimmed.length > 1 ? trimmed.slice(1) : trimmed;
}

function getMemberAvatarUrl(name, isPatrolling) {
  // 순찰중 -> 회색, 대기중 -> 파란색
  const bg = isPatrolling ? "9E9E9E" : "1E88E5";
  return (
    "https://api.dicebear.com/7.x/initials/svg?backgroundColor=" +
    bg +
    "&seed=" +
    encodeURIComponent(getGivenName(name) || "member")
  );
}

// auth.js 로그인 시 저장하는 localStorage "currentUser" 의 이름을 사용
function getDisplayUserName(fallbackName) {
  try {
    const current = JSON.parse(localStorage.getItem("currentUser") || "null");
    if (current && current.name && current.name.trim()) {
      return current.name.trim();
    }
  } catch (e) {}
  return fallbackName || "사용자";
}

function createAvatarImg(src, alt) {
  const img = document.createElement("img");
  img.src = src;
  img.alt = alt;
  img.decoding = "async";
  return img;
}

function createMeMarkerElement(displayName) {
  const wrap = document.createElement("div");
  wrap.className = "map-marker map-marker-me";
  wrap.title = `${displayName} (나)`;

  const img = createAvatarImg(ME_MARKER_IMAGE, `${displayName} (나)`);
  // me.png 로드 실패 시 이니셜 아바타로 대체
  img.onerror = () => {
    img.onerror = null;
    img.src = getProfileAvatarUrl(displayName);
  };
  wrap.appendChild(img);

  return wrap;
}

function createMemberMarkerElement(user) {
  const isPatrolling = user.status === "PATROLLING";
  const statusLabel = isPatrolling ? "순찰중" : "대기중";
  const statusClass = isPatrolling ? "patrolling" : "resting";

  const wrap = document.createElement("div");
  wrap.className = `map-marker map-marker-member map-marker-member--${statusClass}`;
  wrap.title = `${user.name} (${statusLabel})`;

  wrap.appendChild(
    createAvatarImg(getMemberAvatarUrl(user.name, isPatrolling), user.name)
  );

  return wrap;
}
