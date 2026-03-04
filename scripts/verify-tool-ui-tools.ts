/**
 * Verifies that get_weather and geo_map tools return payloads
 * that pass the Tool UI schema validation (safeParseSerializable*).
 *
 * Usage: npx tsx scripts/verify-tool-ui-tools.ts
 */

import { getTool } from "../lib/agent/tools/registry";
import { safeParseSerializableWeatherWidget } from "../components/tool-ui/weather-widget/schema";
import { safeParseSerializableGeoMap } from "../components/tool-ui/geo-map/schema";

async function main() {
  console.log("=== Verificación Tool UI (get_weather, geo_map) ===\n");

  const checks: Array<{ name: string; run: () => Promise<boolean> }> = [
    {
      name: "get_weather",
      run: async () => {
        const def = getTool("get_weather");
        if (!def) {
          console.log("   get_weather: NO ENCONTRADA en registry");
          return false;
        }
        const output = await def.execute({ location: "Madrid", units: "celsius" });
        const parsed = safeParseSerializableWeatherWidget(output);
        if (!parsed) {
          console.log("   get_weather: output no pasó safeParseSerializableWeatherWidget");
          return false;
        }
        console.log("   get_weather: OK (payload válido para WeatherWidget)");
        return true;
      },
    },
    {
      name: "geo_map",
      run: async () => {
        const def = getTool("geo_map");
        if (!def) {
          console.log("   geo_map: NO ENCONTRADA en registry");
          return false;
        }
        const output = await def.execute({
          title: "Test",
          markers: [{ lat: 40.4, lng: -3.7, label: "Madrid" }],
        });
        const parsed = safeParseSerializableGeoMap(output);
        if (!parsed) {
          console.log("   geo_map: output no pasó safeParseSerializableGeoMap");
          return false;
        }
        console.log("   geo_map: OK (payload válido para GeoMap)");
        return true;
      },
    },
  ];

  let failed = 0;
  for (const { name, run } of checks) {
    try {
      const ok = await run();
      if (!ok) failed++;
    } catch (e) {
      console.log(`   ${name}: Error -`, e instanceof Error ? e.message : String(e));
      failed++;
    }
  }

  console.log("");
  if (failed > 0) {
    console.log("=== FALLOS:", failed, "===");
    process.exit(1);
  }
  console.log("=== OK ===");
}

main();
