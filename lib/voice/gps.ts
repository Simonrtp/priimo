export function watchDevicePosition(
  onPos: (pos: { latitude: number; longitude: number }) => void,
): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return () => undefined;
  const id = navigator.geolocation.watchPosition(
    (pos) => onPos({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
    () => undefined,
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

export function readDevicePosition(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 60_000 },
    );
  });
}
