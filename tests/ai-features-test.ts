/**
 * AI Features Test Script
 *
 * Tests web search and extended thinking features across all providers.
 * Uses minimal tokens and budgets to minimize costs.
 *
 * Usage:
 *   npx tsx tests/ai-features-test.ts
 *
 * Required environment variables:
 *   - ANTHROPIC_API_KEY
 *   - OPENAI_API_KEY
 *   - GOOGLE_AI_API_KEY
 *   - XAI_API_KEY
 */

import "dotenv/config";
import { getAIService } from "@/lib/aiServices";
import { buildEnhancedReasoningPrompt } from "@/lib/reasoning/prompt";

interface TestCase {
  name: string;
  provider: string;
  model: string;
  prompt: string;
  webSearch: boolean;
  thinking: boolean;
  maxTokens: number;
  expectedResults: {
    hasCitations?: boolean;
    hasContent: boolean;
    hasThinking?: boolean;
  };
}

const testCases: TestCase[] = [
  {
    name: "Claude Haiku - Web Search",
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    prompt: "What are the latest tech news today?",
    webSearch: true,
    thinking: false,
    maxTokens: 500,
    expectedResults: {
      hasCitations: true,
      hasContent: true,
      hasThinking: false,
    },
  },
  {
    name: "Claude Sonnet - Extended Thinking",
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    prompt: "Explain the quicksort algorithm briefly",
    webSearch: false,
    thinking: true,
    maxTokens: 800,
    expectedResults: {
      hasThinking: true,
      hasContent: true,
      hasCitations: false,
    },
  },
  {
    name: "GPT-4o-mini - Web Search",
    provider: "openai",
    model: "gpt-4o-mini",
    prompt: "Latest AI developments?",
    webSearch: true,
    thinking: false,
    maxTokens: 500,
    expectedResults: {
      hasCitations: true,
      hasContent: true,
    },
  },
  {
    name: "Gemini 2.5 Flash - Google Search",
    provider: "google",
    model: "gemini-2.5-flash",
    prompt: "Current weather in Tokyo?",
    webSearch: true, // Will use Google Search
    thinking: false,
    maxTokens: 300,
    expectedResults: {
      hasCitations: true,
      hasContent: true,
    },
  },
  {
    name: "Grok 3-mini - Web Search",
    provider: "xai",
    model: "grok-3-mini",
    prompt: "Tech trends in 2026?",
    webSearch: true,
    thinking: false,
    maxTokens: 500,
    expectedResults: {
      hasCitations: true,
      hasContent: true,
    },
  },
  {
    name: "DeepSeek Reasoner - Thinking",
    provider: "deepseek",
    model: "deepseek-reasoner",
    prompt: "Solve: What is 15 * 23?",
    webSearch: false,
    thinking: true, // Native reasoning model
    maxTokens: 1000,
    expectedResults: {
      hasThinking: true,
      hasContent: true,
      hasCitations: false,
    },
  },
];

async function runTests() {
  console.log("🧪 Starting AI Features Tests...\n");
  console.log("⚠️  Cost Optimization Enabled:");
  console.log("   - Using cheapest models");
  console.log("   - Limiting tokens to 300-1000");
  console.log("   - Using low thinking budgets");
  console.log("   - Limiting web search uses to 2-3\n");

  let passedTests = 0;
  let failedTests = 0;

  for (const test of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 Test: ${test.name}`);
    console.log(`   Provider: ${test.provider}`);
    console.log(`   Model: ${test.model}`);
    console.log(`   Features: ${test.webSearch ? '🌐 Web Search' : ''} ${test.thinking ? '🧠 Thinking' : ''}`);
    console.log(`   Max Tokens: ${test.maxTokens}`);

    try {
      // Get API key from environment
      const envVarName = `${test.provider.toUpperCase()}_API_KEY`;
      const apiKey = process.env[envVarName];

      if (!apiKey) {
        console.log(`   ⚠️  SKIPPED: ${envVarName} not found`);
        continue;
      }

      // Build enhanced prompt
      const messages = buildEnhancedReasoningPrompt({
        systemPrompt: undefined,
        context: { items: [], isDistilled: false, totalTokens: 0 },
        userInput: test.prompt,
        webSearchEnabled: test.webSearch,
        thinkingEnabled: test.thinking,
        autoDetectTaskType: true,
      });

      const service = getAIService(test.provider, apiKey);

      // Build request with provider-specific configs
      const request: any = {
        model: test.model,
        messages,
        maxTokens: test.maxTokens,
      };

      // Add web search configs (with cost limits)
      if (test.webSearch) {
        if (test.provider === "anthropic") {
          request.webSearch = {
            enabled: true,
            maxUses: 2, // Limit to 2 searches
          };
        } else if (test.provider === "openai") {
          request.webSearch = {
            enabled: true,
          };
        } else if (test.provider === "google") {
          request.googleSearch = {
            enabled: true,
          };
        } else if (test.provider === "xai") {
          request.search = {
            webSearch: {
              enabled: true,
            },
          };
        }
      }

      // Add thinking configs (with minimal budgets)
      if (test.thinking) {
        if (test.provider === "anthropic") {
          request.thinking = {
            enabled: true,
            budgetTokens: 3000, // Minimal budget
          };
        } else if (test.provider === "openai") {
          request.reasoning = {
            enabled: true,
            effort: "low", // Lowest effort
          };
        } else if (test.provider === "google") {
          request.thinking = {
            enabled: true,
            level: "low", // Lowest level
          };
        } else if (test.provider === "deepseek") {
          // DeepSeek reasoner has thinking by default
        }
      }

      console.log(`   ⏳ Calling AI service...`);
      const startTime = Date.now();
      const response = await service.generateResponse(request);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // Extract token info
      const tokens = typeof response.tokens === 'number'
        ? response.tokens
        : response.tokens.total || 0;

      console.log(`   ✅ Response received in ${duration}s`);
      console.log(`   📊 Tokens: ${tokens}`);
      console.log(`   💰 Cost: $${response.cost.toFixed(4)}`);

      // Verify expected results
      let allChecksPassed = true;

      if (test.expectedResults.hasContent) {
        const hasContent = !!response.content && response.content.length > 0;
        console.log(`   ${hasContent ? '✅' : '❌'} Has content: ${hasContent ? 'YES' : 'NO'}`);
        if (!hasContent) allChecksPassed = false;
      }

      if (test.expectedResults.hasThinking !== undefined) {
        const hasThinking = !!response.thinkingContent && response.thinkingContent.length > 0;
        console.log(`   ${hasThinking ? '✅' : '❌'} Has thinking: ${hasThinking ? 'YES' : 'NO'}`);
        if (test.expectedResults.hasThinking && !hasThinking) allChecksPassed = false;
      }

      if (test.expectedResults.hasCitations !== undefined) {
        const citationsCount = response.citations?.length || 0;
        const hasCitations = citationsCount > 0;
        console.log(`   ${hasCitations ? '✅' : '❌'} Has citations: ${citationsCount} sources`);

        // Show first 2 citations if available
        if (hasCitations && response.citations) {
          response.citations.slice(0, 2).forEach((citation, i) => {
            console.log(`      ${i + 1}. ${citation.title || 'Untitled'}`);
            console.log(`         ${citation.url}`);
          });
          if (response.citations.length > 2) {
            console.log(`      ... and ${response.citations.length - 2} more`);
          }
        }

        if (test.expectedResults.hasCitations && !hasCitations) allChecksPassed = false;
      }

      if (allChecksPassed) {
        console.log(`   ✅ Test PASSED`);
        passedTests++;
      } else {
        console.log(`   ❌ Test FAILED: Some checks did not pass`);
        failedTests++;
      }

    } catch (error) {
      console.log(`   ❌ Test FAILED with error:`);
      console.log(`      ${error instanceof Error ? error.message : String(error)}`);
      failedTests++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n✨ Tests completed!`);
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log(`   📊 Total: ${passedTests + failedTests}\n`);

  // Exit with error code if any tests failed
  if (failedTests > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error("\n❌ Fatal error running tests:");
  console.error(error);
  process.exit(1);
});
