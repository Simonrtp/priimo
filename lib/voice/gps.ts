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
  /** Haute précision GPS (tournée / navigation). Défaut true en watch. */
  highAccuracy?: boolean;
  /** Ignorer les mises à jour si déplacement < N mètres. Défaut 0. */
  minUpdateM?: number;
  maximumAge?: number;
};

function distanceM(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6_371_000;
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δφ = ((b.latitude - a.latitude) * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

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
  const highAccuracy = opts?.highAccuracy !== false;
  const minUpdateM = opts?.minUpdateM ?? 0;
  const maximumAge = opts?.maximumAge ?? (highAccuracy ? 1_500 : 4_000);
  let watchId: number | null = null;
  let stopped = false;
  let lastPos: DevicePosition | null = null;

  function emit(pos: DevicePosition) {
    if (minUpdateM > 0 && lastPos) {
      const moved = distanceM(lastPos, pos);
      const accuracyBetter =
        pos.accuracyM != null &&
        lastPos.accuracyM != null &&
        pos.accuracyM < lastPos.accuracyM - 5;
      if (moved < minUpdateM && !accuracyBetter) return;
    }
    lastPos = pos;
    onPos(pos);
  }

  function start() {
    if (stopped || watchId != null) return;
    watchId = navigator.geolocation.watchPosition(
      (pos) => emit(fromCoords(pos.coords)),
      () => undefined,
      {
        enableHighAccuracy: highAccuracy,
        timeout: highAccuracy ? 15_000 : 12_000,
        maximumAge,
      },
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
