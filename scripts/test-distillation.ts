import { distillContext } from "../lib/reasoning/distillation";
import { ReasoningContext, ReasoningContextItem } from "../lib/reasoning/types";

async function testDistillation() {
  console.log("--- Starting Context Distillation Test ---");

  const mockItems: ReasoningContextItem[] = [
    {
      sourceNodeId: "node-1",
      nodeType: "input",
      role: "instruction",
      content: "Always use a professional tone and format the output in Markdown.",
      importance: 5,
    },
    {
      sourceNodeId: "node-2",
      nodeType: "display",
      role: "knowledge",
      content: "The company was founded in 2020 and specializes in AI solutions for healthcare. " + "A".repeat(5000), // Large content
      importance: 3,
    },
    {
      sourceNodeId: "node-3",
      nodeType: "input",
      role: "constraint",
      content: "Do not use emojis.",
      importance: 4,
    },
    {
      sourceNodeId: "node-4",
      nodeType: "response",
      role: "history",
      content: "Previous interaction: User asked about pricing.",
      importance: 2,
    },
    {
        sourceNodeId: "node-5",
        nodeType: "display",
        role: "knowledge",
        content: "Detailed technical specs: " + "B".repeat(2000),
        importance: 1,
    }
  ];

  const rawContext: ReasoningContext = {
    targetNodeId: "target-node",
    items: mockItems,
  };

  console.log(`Original items: ${rawContext.items.length}`);
  
  const distilled = distillContext(rawContext, { maxTokens: 1000 });

  console.log(`Distilled items: ${distilled.items.length}`);
  console.log(`Is distilled: ${distilled.isDistilled}`);
  console.log(`Total tokens (estimated): ${distilled.totalTokens}`);

  console.log("\nDistilled Items Summary:");
  distilled.items.forEach((item, i) => {
    const contentPreview = item.content.length > 50 ? item.content.substring(0, 50) + "..." : item.content;
    console.log(`${i+1}. [${item.role.toUpperCase()}] (Imp: ${item.importance}) - Length: ${item.content.length} ${item.isSummarized ? "[SUMMARIZED]" : ""} | Preview: ${contentPreview}`);
  });

  // Verify priorities
  const firstItem = distilled.items[0];
  if (firstItem.role === "instruction") {
    console.log("\n✅ SUCCESS: Instruction has highest priority.");
  } else {
    console.log("\n❌ FAILURE: Instruction should be first.");
  }

  const hasConstraint = distilled.items.some(i => i.role === "constraint");
  if (hasConstraint) {
    console.log("✅ SUCCESS: Constraint was preserved.");
  } else {
    console.log("❌ FAILURE: Constraint should have been preserved.");
  }

  console.log("\n--- Test Complete ---");
}

testDistillation().catch(console.error);
