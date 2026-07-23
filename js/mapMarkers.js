// 지도 마커 — me.png(본인), DiceBear 이니셜(팀원)

const ME_MARKER_IMAGE = "images/markers/me.png";

function getProfileAvatarUrl(name) {
  return (
    "https://api.dicebear.com/7.x/initials/svg?backgroundColor=FF6F00&seed=" +
    encodeURIComponent(name || "me")
  );
}

function getGivenName(name) {
  if (!name) return "";
  const trimmed = name.trim();
  return trimmed.length >= 3 ? trimmed.slice(1) : trimmed;
}

function getMemberMarkerColor(isPatrolling) {
  return isPatrolling ? "#9E9E9E" : "#1E88E5";
}

function getDisplayUserName(fallbackName) {
  try {
    if (typeof ApiClient !== "undefined") {
      const current = ApiClient.getCurrentUser();
      if (current && current.name && current.name.trim()) {
        return current.name.trim();
      }
    }
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
  img.onerror = () => {
    img.onerror = null;
    img.src = getProfileAvatarUrl(displayName);
  };
  wrap.appendChild(img);

  return wrap;
}

function createMemberMarkerElement(user) {
  const isPatrolling = user.status === "PATROLLING";
  const statusLabel = isPatrolling ? "순찰 중" : "대기 중";
  const statusClass = isPatrolling ? "patrolling" : "resting";

  const wrap = document.createElement("div");
  wrap.className = `map-marker map-marker-member map-marker-member--${statusClass}`;

  const label = document.createElement("span");
  label.className = "map-marker-member-name";
  label.textContent = getGivenName(user.name);
  label.style.backgroundColor = getMemberMarkerColor(isPatrolling);
  wrap.appendChild(label);

  const tooltip = document.createElement("span");
  tooltip.className = "map-marker-member-tooltip";
  tooltip.textContent = statusLabel;
  wrap.appendChild(tooltip);

  return wrap;
}
