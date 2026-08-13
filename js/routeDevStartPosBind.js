/**
 * REMOVABLE DEV — 시작점 버튼 클릭을 스크립트 로드 즉시 위임.
 * route-dev.js 로드/카카오 init 전이라도 클릭이 먹히게 함.
 */
(function bindDevStartPosClick() {
  function handler(e) {
    const btn = e.target && e.target.closest && e.target.closest("#btn-dev-start-pos");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof window.__routeDevToggleStartPos === "function") {
      window.__routeDevToggleStartPos();
    } else {
      console.warn("[DEV-START-POS] toggle handler not ready yet");
      btn.dataset.pendingClick = "1";
    }
  }
  // click 만 사용 (touchend+click 이중 토글 방지)
  document.addEventListener("click", handler, true);
})();
