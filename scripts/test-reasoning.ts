import { resolveNodeContext } from "@/lib/reasoning/context";
import { buildReasoningPrompt } from "@/lib/reasoning/prompt";
import { ReasoningNode, ReasoningEdge } from "@/lib/reasoning/types";

// Mock Data
const nodes: ReasoningNode[] = [
  { id: "1", type: "input", data: { text: "Define a cat", role: "instruction" }, position: { x: 0, y: 0 } },
  { id: "2", type: "response", data: { output: "A cat is a small carnivorous mammal.", role: "context" }, position: { x: 0, y: 100 } },
  { id: "3", type: "response", data: { output: "Translate to Spanish", role: "instruction" }, position: { x: 0, y: 200 } },
];

const edges: ReasoningEdge[] = [
  { source: "1", target: "2" },
  { source: "2", target: "3" },
];

async function testReasoning() {
  console.log("--- Testing Context Resolution ---");
  const context = resolveNodeContext("3", nodes, edges);
  console.log("Resolved Context Items:", context.items.length);
  
  context.items.forEach(item => {
    console.log(`- Source: ${item.sourceNodeId}, Role: ${item.role}, Content: ${item.content}`);
  });

  console.log("\n--- Testing Prompt Assembly ---");
  const messages = buildReasoningPrompt("System Prompt", context, "Translate to Spanish");
  console.log("System Message:");
  console.log(messages.find(m => m.role === "system")?.content);
  console.log("\nUser Message:");
  console.log(messages.find(m => m.role === "user")?.content);
}

testReasoning().catch(console.error);
