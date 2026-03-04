/**
 * Verifica y lista todas las tools del agente: registry (comunes) + built-in por proveedor.
 * Uso: npx tsx scripts/verify-agent-tools.ts
 */

import { getRegisteredToolNames, getTool, getAISDKToolsForNames } from "../lib/agent/tools/registry";
import {
  getBuiltInToolsForProvider,
  getAvailableToolNames,
  BUILTIN_TOOL_SLUGS,
} from "../lib/agent/built-in-tools";
import { PROVIDER_OPTIMAL_CONFIGS } from "../lib/aiServices/configs/provider-configs";

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (GPT)",
  google: "Google (Gemini)",
  xai: "xAI (Grok)",
  deepseek: "DeepSeek",
};

function main() {
  console.log("=== Verificación de tools del agente ===\n");

  // ---- 1) Tools del registry (comunes a todos los modelos) ----
  const names = getRegisteredToolNames();
  console.log("1) TOOLS DEL REGISTRY (comunes a todos los modelos)");
  console.log("   Total:", names.length);
  if (names.length === 0) {
    console.log("   (ninguna) Revisa lib/agent/tools/registry.ts\n");
  } else {
    for (const name of names) {
      const def = getTool(name);
      if (!def) {
        console.log(`   - ${name}: NO ENCONTRADA`);
        process.exit(1);
      }
      console.log(`   - ${name}`);
    }
    console.log("");
  }

  // ---- 2) Verificar adapter AI SDK para el registry ----
  try {
    const sdkTools = getAISDKToolsForNames(names);
    const count = Object.keys(sdkTools).length;
    console.log("2) ADAPTER AI SDK (registry)");
    console.log(`   ${count} tool(s) listas para streamText.\n`);
    if (names.length > 0 && count !== names.length) {
      console.warn("   Aviso: esperado", names.length, ", obtenido", count, "\n");
    }
  } catch (e) {
    console.error("Error al resolver tools para AI SDK:", e);
    process.exit(1);
  }

  const toolUiTools = ["get_weather", "geo_map"];
  const hasToolUi = toolUiTools.every((t) => names.includes(t));
  if (hasToolUi) {
    console.log("   Tool UI tools (get_weather, geo_map): presentes. Verificar payloads: npm run test:tool-ui-tools\n");
  }

  // ---- 3) Built-in por proveedor (ejemplo por proveedor) ----
  console.log("3) TOOLS BUILT-IN POR PROVEEDOR (ejemplo por proveedor)");
  const providers = Object.keys(PROVIDER_OPTIMAL_CONFIGS) as Array<keyof typeof PROVIDER_OPTIMAL_CONFIGS>;
  for (const provider of providers) {
    const configs = PROVIDER_OPTIMAL_CONFIGS[provider];
    if (!configs || typeof configs !== "object") continue;
    const modelIds = Object.keys(configs);
    const exampleModel = modelIds[0] ?? "default";
    const builtIn = getBuiltInToolsForProvider(provider, exampleModel);
    const label = PROVIDER_LABELS[provider] ?? provider;
    console.log(`   ${label} (ej. ${exampleModel}):`);
    if (builtIn.length === 0) {
      console.log("      (ninguna built-in)");
    } else {
      builtIn.forEach((slug) => console.log(`      - ${slug}`));
    }
  }
  console.log("");

  // ---- 4) Lista combinada (registry + built-in) por proveedor ----
  console.log("4) TODAS LAS TOOLS POR PROVEEDOR (registry + built-in)");
  for (const provider of providers) {
    const configs = PROVIDER_OPTIMAL_CONFIGS[provider];
    if (!configs || typeof configs !== "object") continue;
    const modelIds = Object.keys(configs);
    const exampleModel = modelIds[0] ?? "default";
    const all = getAvailableToolNames(provider, exampleModel, names, { webSearchEnabled: true });
    const label = PROVIDER_LABELS[provider] ?? provider;
    console.log(`   ${label}: ${all.join(", ")}`);
  }

  console.log("\n--- Slugs built-in soportados en el sistema ---");
  console.log("   ", Object.keys(BUILTIN_TOOL_SLUGS).join(", "));

  console.log("\n=== OK ===");
  console.log("\nComando para ejecutar este script:\n  npx tsx scripts/verify-agent-tools.ts\n");
}

main();
