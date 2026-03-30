const cache = new Map<string, string>();

export async function reverseGeocode(gpsApprox: string): Promise<string> {
  if (cache.has(gpsApprox)) return cache.get(gpsApprox)!;
  const parts = gpsApprox.split(",");
  if (parts.length !== 2) return gpsApprox;
  const [lat, lng] = parts.map(Number);
  if (isNaN(lat) || isNaN(lng)) return gpsApprox;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "User-Agent": "Radrr/1.0" } }
    );
    const data = await res.json();
    const city =
      data.address?.city ??
      data.address?.town ??
      data.address?.village ??
      data.address?.county ??
      "";
    const country = data.address?.country ?? "";
    const name = [city, country].filter(Boolean).join(", ") || gpsApprox;
    cache.set(gpsApprox, name);
    return name;
  } catch {
    cache.set(gpsApprox, gpsApprox);
    return gpsApprox;
  }
}
