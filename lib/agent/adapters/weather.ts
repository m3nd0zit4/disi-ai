/**
 * Weather adapter for get_weather tool.
 * Fetches current weather and forecast from Open-Meteo (no API key required).
 * Maps WMO weather codes to Tool UI WeatherConditionCode.
 */

export type WeatherConditionCode =
  | "clear"
  | "partly-cloudy"
  | "cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "heavy-rain"
  | "thunderstorm"
  | "snow"
  | "sleet"
  | "hail"
  | "windy";

export type WeatherWidgetPayload = {
  id: string;
  location: { name: string };
  units: { temperature: "celsius" | "fahrenheit" };
  current: {
    temperature: number;
    tempMin: number;
    tempMax: number;
    conditionCode: WeatherConditionCode;
    windSpeed?: number;
    precipitationLevel?: "none" | "light" | "moderate" | "heavy";
    visibility?: number;
  };
  forecast: Array<{
    label: string;
    tempMin: number;
    tempMax: number;
    conditionCode: WeatherConditionCode;
  }>;
  time?: { timeBucket?: number; localTimeOfDay?: number };
  updatedAt?: string;
};

/** WMO weather code (Open-Meteo) -> Tool UI condition code */
const WMO_TO_CONDITION: Record<number, WeatherConditionCode> = {
  0: "clear",
  1: "partly-cloudy",
  2: "partly-cloudy",
  3: "overcast",
  45: "fog",
  48: "fog",
  51: "drizzle",
  53: "drizzle",
  55: "drizzle",
  56: "sleet",
  57: "sleet",
  61: "rain",
  63: "rain",
  65: "heavy-rain",
  66: "sleet",
  67: "sleet",
  71: "snow",
  73: "snow",
  75: "snow",
  77: "snow",
  80: "rain",
  81: "rain",
  82: "heavy-rain",
  85: "snow",
  86: "snow",
  95: "thunderstorm",
  96: "thunderstorm",
  99: "thunderstorm",
};

const FALLBACK_CONDITION: WeatherConditionCode = "cloudy";

function wmoToCondition(wmo: number): WeatherConditionCode {
  return WMO_TO_CONDITION[wmo] ?? FALLBACK_CONDITION;
}

type GeocodingResult = {
  results?: Array<{ latitude: number; longitude: number; name: string; timezone?: string }>;
};

type ForecastResult = {
  latitude: number;
  longitude: number;
  timezone?: string;
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_min?: number[];
    temperature_2m_max?: number[];
  };
};

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/**
 * Fetch weather for a location (city name or "lat,lng").
 * Returns payload matching Tool UI SerializableWeatherWidget.
 */
export async function fetchWeatherForLocation(
  location: string,
  units: "celsius" | "fahrenheit"
): Promise<WeatherWidgetPayload> {
  const trimmed = (location ?? "").trim() || "Unknown";
  let lat: number;
  let lng: number;
  let locationName: string;

  const coordsMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (coordsMatch) {
    lat = parseFloat(coordsMatch[1]);
    lng = parseFloat(coordsMatch[2]);
    locationName = `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  } else {
    const geoRes = await fetch(
      `${GEOCODING_URL}?name=${encodeURIComponent(trimmed)}&count=1&language=es`
    );
    if (!geoRes.ok) throw new Error(`Geocoding failed: ${geoRes.status}`);
    const geo = (await geoRes.json()) as GeocodingResult;
    const first = geo.results?.[0];
    if (!first) throw new Error(`No results for location: ${trimmed}`);
    lat = first.latitude;
    lng = first.longitude;
    locationName = first.name ?? trimmed;
  }

  const tempUnit = units === "fahrenheit" ? "fahrenheit" : "celsius";
  const tempUnitParam = units === "fahrenheit" ? "&temperature_unit=fahrenheit" : "";
  const forecastRes = await fetch(
    `${FORECAST_URL}?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_min,temperature_2m_max&timezone=auto&forecast_days=7${tempUnitParam}`
  );
  if (!forecastRes.ok) throw new Error(`Forecast failed: ${forecastRes.status}`);
  const data = (await forecastRes.json()) as ForecastResult;

  const current = data.current;
  const daily = data.daily;
  const temp = current?.temperature_2m ?? 15;
  const wmoCurrent = current?.weather_code ?? 0;
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60 * 1000;
  const localHour = (now.getTime() - tzOffset) / (24 * 60 * 60 * 1000) % 1;
  const localTimeOfDay = localHour < 0 ? localHour + 1 : localHour;

  const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const forecast = (daily?.time ?? [])
    .slice(0, 7)
    .map((dateStr, i) => {
      const d = new Date(dateStr);
      const label = i === 0 ? "Mañana" : dayLabels[d.getDay()];
      const tempMin = daily?.temperature_2m_min?.[i] ?? temp - 2;
      const tempMax = daily?.temperature_2m_max?.[i] ?? temp + 2;
      const wmo = daily?.weather_code?.[i] ?? 0;
      return {
        label,
        tempMin: Math.round(tempMin * 10) / 10,
        tempMax: Math.round(tempMax * 10) / 10,
        conditionCode: wmoToCondition(wmo),
      };
    });

  if (forecast.length === 0) {
    forecast.push({
      label: "Hoy",
      tempMin: Math.round((temp - 2) * 10) / 10,
      tempMax: Math.round((temp + 2) * 10) / 10,
      conditionCode: wmoToCondition(wmoCurrent),
    });
  }

  const tempRounded = Math.round(temp * 10) / 10;
  const tempMin0 = forecast[0]?.tempMin ?? tempRounded - 2;
  const tempMax0 = forecast[0]?.tempMax ?? tempRounded + 2;

  return {
    id: `weather-${locationName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
    location: { name: locationName },
    units: { temperature: tempUnit },
    current: {
      temperature: tempRounded,
      tempMin: tempMin0,
      tempMax: tempMax0,
      conditionCode: wmoToCondition(wmoCurrent),
      windSpeed: current?.wind_speed_10m,
    },
    forecast,
    time: { localTimeOfDay },
    updatedAt: now.toISOString(),
  };
}
