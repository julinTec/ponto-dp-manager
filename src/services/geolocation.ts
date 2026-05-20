export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export class GeolocationError extends Error {
  code: "unsupported" | "denied" | "unavailable" | "timeout" | "unknown";
  constructor(code: GeolocationError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export function getCurrentPosition(options?: PositionOptions): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new GeolocationError("unsupported", "Geolocalização não suportada neste dispositivo"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }),
      (err) => {
        const map = {
          1: "denied",
          2: "unavailable",
          3: "timeout",
        } as const;
        const code = (map[err.code as 1 | 2 | 3] ?? "unknown") as GeolocationError["code"];
        const msg =
          code === "denied"
            ? "Permissão de localização negada. Habilite no navegador."
            : code === "unavailable"
            ? "Não foi possível obter sua localização."
            : code === "timeout"
            ? "Tempo esgotado ao buscar localização. Tente novamente."
            : "Erro desconhecido ao obter localização.";
        reject(new GeolocationError(code, msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
        ...options,
      }
    );
  });
}
