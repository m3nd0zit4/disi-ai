/**
 * Unit test for the weather adapter: mocked fetch, assert payload shape and condition code mapping.
 *
 * Usage: npx tsx tests/weather-adapter-test.ts
 */

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const mockGeocoding = {
  results: [
    { latitude: 40.4168, longitude: -3.7038, name: "Madrid", timezone: "Europe/Madrid" },
  ],
};

const mockForecast = {
  latitude: 40.4168,
  longitude: -3.7038,
  timezone: "Europe/Madrid",
  current: {
    temperature_2m: 18.5,
    weather_code: 1,
    wind_speed_10m: 12,
  },
  daily: {
    time: ["2026-03-03", "2026-03-04", "2026-03-05"],
    weather_code: [0, 1, 2],
    temperature_2m_min: [8, 9, 10],
    temperature_2m_max: [18, 19, 20],
  },
};

const originalFetch = globalThis.fetch;

async function main() {
  console.log("=== Weather adapter test (mocked fetch) ===\n");

  (globalThis as unknown as { fetch: typeof fetch }).fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url.startsWith(GEOCODING_URL)) {
      return new Response(JSON.stringify(mockGeocoding), { status: 200 });
    }
    if (url.startsWith(FORECAST_URL)) {
      return new Response(JSON.stringify(mockForecast), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  };

  try {
    const { fetchWeatherForLocation } = await import("../lib/agent/adapters/weather");
    const payload = await fetchWeatherForLocation("Madrid", "celsius");

    if (!payload.id || !payload.location?.name) {
      console.log("FAIL: payload missing id or location.name");
      process.exit(1);
    }
    if (payload.location.name !== "Madrid") {
      console.log("FAIL: location.name expected Madrid, got", payload.location.name);
      process.exit(1);
    }
    if (payload.units.temperature !== "celsius") {
      console.log("FAIL: units.temperature expected celsius, got", payload.units.temperature);
      process.exit(1);
    }
    if (typeof payload.current.temperature !== "number") {
      console.log("FAIL: current.temperature should be number");
      process.exit(1);
    }
    const validConditions = [
      "clear", "partly-cloudy", "cloudy", "overcast", "fog", "drizzle", "rain",
      "heavy-rain", "thunderstorm", "snow", "sleet", "hail", "windy",
    ];
    if (!validConditions.includes(payload.current.conditionCode)) {
      console.log("FAIL: invalid conditionCode", payload.current.conditionCode);
      process.exit(1);
    }
    if (!Array.isArray(payload.forecast) || payload.forecast.length < 1) {
      console.log("FAIL: forecast must be non-empty array");
      process.exit(1);
    }
    if (payload.time?.localTimeOfDay != null && (payload.time.localTimeOfDay < 0 || payload.time.localTimeOfDay > 1)) {
      console.log("FAIL: localTimeOfDay must be 0..1");
      process.exit(1);
    }

    console.log("   fetchWeatherForLocation('Madrid', 'celsius'): OK");
    console.log("   id:", payload.id);
    console.log("   location:", payload.location.name);
    console.log("   current conditionCode:", payload.current.conditionCode);
    console.log("   forecast days:", payload.forecast.length);
    console.log("\n=== OK ===");
  } finally {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
