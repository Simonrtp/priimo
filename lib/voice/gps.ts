export type DevicePosition = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  headingDeg: number | null;
  speedMs: number | null;
};

export type WatchPositionOptions = {
  /** Coupe le watch quand l'onglet n'est plus visible (batterie). Défaut true. */
  pauseWhenHidden?: boolean;
};

function fromCoords(coords: GeolocationCoordinates): DevicePosition {
  const heading =
    typeof coords.heading === 'number' && Number.isFinite(coords.heading) ? coords.heading : null;
  const accuracy =
    typeof coords.accuracy === 'number' && Number.isFinite(coords.accuracy) ? coords.accuracy : null;
  const speed =
    typeof coords.speed === 'number' && Number.isFinite(coords.speed) ? coords.speed : null;
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracyM: accuracy,
    headingDeg: heading,
    speedMs: speed,
  };
}

/**
 * Suivi continu de la position. Ne demande la permission qu'à l'appel.
 * Coupe automatiquement en arrière-plan si `pauseWhenHidden`.
 */
export function watchDevicePosition(
  onPos: (pos: DevicePosition) => void,
  opts?: WatchPositionOptions,
): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return () => undefined;

  const pauseWhenHidden = opts?.pauseWhenHidden !== false;
  let watchId: number | null = null;
  let stopped = false;

  function start() {
    if (stopped || watchId != null) return;
    watchId = navigator.geolocation.watchPosition(
      (pos) => onPos(fromCoords(pos.coords)),
      () => undefined,
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 2_000 },
    );
  }

  function stopWatch() {
    if (watchId == null) return;
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  function onVisibility() {
    if (!pauseWhenHidden) return;
    if (document.visibilityState === 'hidden') stopWatch();
    else start();
  }

  start();
  if (pauseWhenHidden && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }

  return () => {
    stopped = true;
    stopWatch();
    if (pauseWhenHidden && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}

export function readDevicePosition(): Promise<DevicePosition | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(fromCoords(pos.coords)),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 60_000 },
    );
  });
}

/** Demande explicite (recentrer / démarrer tournée) — haute précision. */
export function requestDevicePosition(): Promise<DevicePosition | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(fromCoords(pos.coords)),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}
