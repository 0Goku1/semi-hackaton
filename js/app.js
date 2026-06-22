const DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 };

function getMyPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(DEFAULT_CENTER);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => resolve(DEFAULT_CENTER),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}

async function initMap() {
  const { lat, lng } = await getMyPosition();
  const container = document.getElementById("map");
  const options = {
    center: new kakao.maps.LatLng(lat, lng),
    level: 3,
  };
  new kakao.maps.Map(container, options);
}

kakao.maps.load(initMap);
