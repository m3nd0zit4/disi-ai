import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { buildReasoningPrompt } from "@/lib/reasoning/prompt";
import { distillContext } from "@/lib/reasoning/distillation";
import { ReasoningContext, ReasoningContextItem, SemanticRole } from "@/lib/reasoning/types";
import { generateTextWithAISDK } from "@/lib/ai-sdk-adapter";
import { executeRLMStreaming, StreamStatus, RLMOutput, type ToolEvent } from "@/lib/rlm";
import { getOptimalConfig, supportsWebSearch, supportsThinking } from "@/lib/aiServices/configs/provider-configs";
import { getRegisteredToolNames } from "@/lib/agent/tools/registry";
import { getBuiltInToolsToEnable } from "@/lib/agent/built-in-tools";
import { computeRequestCostFromUsage, type TokenUsageForCost } from "@/lib/billing/cost";
import type { NodeExecutionInputs, NodeExecutionResult } from "../types";
import type { BaseAIService } from "@/lib/aiServices/base";

export interface TextHandlerParams {
  canvasId: Id<"canvas">;
  nodeId: string;
  inputs: NodeExecutionInputs;
  service: BaseAIService;
  targetModelId: string;
  effectiveProviderName: string;
  effectiveApiKey: string | undefined;
  userId?: Id<"users">;
  convex: { mutation: (fn: unknown, args: unknown) => Promise<unknown>; action: (fn: unknown, args: unknown) => Promise<unknown> };
  api: { canvas: { canvas: { updateNodeDataInternal: unknown } } };
  withRetry: <T>(fn: () => Promise<T>, name: string) => Promise<T>;
  log: (level: "INFO" | "WARN" | "ERROR", message: string, context?: Record<string, unknown>) => void;
}

export async function handleTextGeneration(params: TextHandlerParams): Promise<NodeExecutionResult> {
  const {
    canvasId,
    nodeId,
    inputs,
    service,
    targetModelId,
    userId,
    effectiveProviderName,
    effectiveApiKey,
    convex,
    api,
    withRetry,
    log,
  } = params;

  const { prompt, text, systemPrompt, temperature, provider } = inputs;

  const baseItems = (inputs.context as ReasoningContextItem[]) || [];
  const kbItems: ReasoningContextItem[] = Array.isArray(inputs.kbContext)
    ? inputs.kbContext.map((kb) => ({
        sourceNodeId: `kb-${kb.id ?? "unknown"}`,
        nodeType: "knowledge",
        role: "knowledge" as SemanticRole,
        content: `[${kb.title ?? "Knowledge"}]\n${kb.content ?? ""}`.trim(),
        importance: 4,
      }))
    : [];

  const rawContext: ReasoningContext = (inputs.reasoningContext as ReasoningContext) || {
    targetNodeId: nodeId,
    items: [...baseItems, ...kbItems],
  };

  log("INFO", "AI Worker context received", {
    itemCount: rawContext.items.length,
    kbContextCount: kbItems.length,
    targetNodeId: nodeId,
  });

  const userPrompt = prompt || text || "";

  const useRLM = inputs.rlmEnabled !== false;
  const estimatedContextTokens =
    (rawContext as { totalTokens?: number })?.totalTokens ??
    Math.ceil(rawContext.items.reduce((sum, item) => sum + item.content.length, 0) / 4);
  const FULL_RLM_TOKEN_THRESHOLD = 250_000;
  const autoFullByTokens = estimatedContextTokens >= FULL_RLM_TOKEN_THRESHOLD;
  const rlmMode: "simple" | "full" =
    inputs.rlmMode ??
    (inputs.rlmForceFull || autoFullByTokens
      ? "full"
      : rawContext.items.length <= 2
        ? "simple"
        : "full");

  if (useRLM) {
    const userThinkingEnabled = inputs.thinkingEnabled ?? false;
    const optimalConfig = getOptimalConfig(effectiveProviderName, targetModelId);
    const modelSupportsWebSearch = supportsWebSearch(effectiveProviderName, targetModelId);
    const modelSupportsThinking = supportsThinking(effectiveProviderName, targetModelId);
    const useThinking = userThinkingEnabled && modelSupportsThinking;
    // Always enable provider built-in tools (e.g. web search) when the model supports them,
    // so the model can use search whenever it needs to — no user toggle required.
    const builtInTools = getBuiltInToolsToEnable(effectiveProviderName, targetModelId, {
      webSearchEnabled: true,
    });
    const useWebSearch = modelSupportsWebSearch;

    log("INFO", `Using RLM streaming execution (mode: ${rlmMode})`, {
      modelId: targetModelId,
      provider: effectiveProviderName,
      optimalMaxTokens: optimalConfig.maxTokens,
      webSearch: useWebSearch ? "ENABLED" : "OFF",
      thinking: useThinking ? "ENABLED" : userThinkingEnabled ? "UNSUPPORTED" : "OFF",
      ...(autoFullByTokens && { autoFullByTokens: true, estimatedContextTokens }),
    });

    let lastConvexUpdate = Date.now();
    let accumulatedText = "";
    let lastToolEvent: StreamStatus["toolEvent"] = undefined;
    const toolCallsHistory: ToolEvent[] = [];
    let lastStatus: StreamStatus | null = null;

    const nodeStatusFromPhase = (phase: StreamStatus["phase"]) =>
      phase === "planning" || phase === "researching" || phase === "synthesizing" || phase === "thinking"
        ? "thinking"
        : phase === "searching"
          ? "searching"
          : phase === "streaming"
            ? "streaming"
            : phase === "error"
              ? "error"
              : "complete";

    const pushStreamingUpdate = (data: Record<string, unknown>) => {
      convex
        .mutation(api.canvas.canvas.updateNodeDataInternal, { canvasId, nodeId, data })
        .catch((err) => log("WARN", `Convex streaming update failed: ${err}`));
    };

    const onStreamStatus = async (status: StreamStatus) => {
      const now = Date.now();
      lastStatus = status;
      if (status.toolEvent) {
        lastToolEvent = status.toolEvent;
        const ev = status.toolEvent;
        if (ev.status === "processing") {
          toolCallsHistory.push({
            tool: ev.tool,
            status: "processing",
            callId: ev.callId,
            input: ev.input,
            steps: ev.steps,
            uiType: ev.uiType,
            uiProps: ev.uiProps,
          });
        } else {
          let idx = toolCallsHistory.length - 1;
          while (idx >= 0) {
            const entry = toolCallsHistory[idx];
            if (entry.tool === ev.tool && entry.status === "processing") {
              entry.status = ev.status;
              entry.resultsCount = ev.resultsCount;
              entry.error = ev.error;
              entry.output = ev.output;
              entry.steps = ev.steps;
              entry.uiType = ev.uiType;
              entry.uiProps = ev.uiProps;
              break;
            }
            idx--;
          }
          if (idx < 0) {
            toolCallsHistory.push({
              tool: ev.tool,
              status: ev.status,
              resultsCount: ev.resultsCount,
              error: ev.error,
              input: ev.input,
              output: ev.output,
              callId: ev.callId,
              steps: ev.steps,
              uiType: ev.uiType,
              uiProps: ev.uiProps,
            });
          }
        }
      }
      const candidate = status.currentText ?? "";
      if (candidate.length >= accumulatedText.length) accumulatedText = candidate;

      const shouldUpdate =
        status.isFinal ||
        !!status.toolEvent ||
        status.phase === "planning" ||
        status.phase === "researching" ||
        status.phase === "synthesizing" ||
        status.phase === "thinking" ||
        status.phase === "searching" ||
        status.phase === "error" ||
        (status.phase === "streaming" &&
          (now - lastConvexUpdate > 40 || status.currentText.length - accumulatedText.length > 20));

      if (shouldUpdate) {
        lastConvexUpdate = now;
        const nodeStatus = nodeStatusFromPhase(status.phase);
        let progressMessage = "";
        if (status.progress) {
          const { currentStep, totalSteps, stepDescription, currentWorker, totalWorkers } = status.progress;
          progressMessage =
            currentWorker && totalWorkers
              ? `Step ${currentStep}/${totalSteps}: ${stepDescription} (${currentWorker}/${totalWorkers})`
              : `Step ${currentStep}/${totalSteps}: ${stepDescription}`;
        }
        pushStreamingUpdate({
          text: accumulatedText,
          status: nodeStatus,
          ...(progressMessage ? { progressMessage } : {}),
          ...(status.thinkingContent ? { thinkingContent: status.thinkingContent } : {}),
          ...(status.error ? { error: status.error } : {}),
          ...(lastToolEvent
            ? {
                toolStatus: lastToolEvent.status,
                toolName: lastToolEvent.tool,
                toolResultsCount: lastToolEvent.resultsCount,
                toolInput: lastToolEvent.input,
                toolOutput: lastToolEvent.output,
                toolCallId: lastToolEvent.callId,
                toolSteps: lastToolEvent.steps,
                toolUiType: lastToolEvent.uiType,
                toolUiProps: lastToolEvent.uiProps,
              }
            : {}),
          ...(toolCallsHistory.length > 0 ? { toolCallsHistory: [...toolCallsHistory] } : {}),
        });
      }
    };

    // Push once so UI shows "thinking" / tools state immediately (process-node already set "thinking", this refreshes with tools hint)
    pushStreamingUpdate({
      text: "",
      status: "thinking",
      ...(inputs.toolNames?.length
        ? { progressMessage: "Iniciando agente y herramientas…" }
        : {}),
    });

    const HEARTBEAT_MS = 280;
    const heartbeat = setInterval(() => {
      if (!lastStatus) return;
      const nodeStatus = nodeStatusFromPhase(lastStatus.phase);
      let progressMessage = "";
      if (lastStatus.progress) {
        const { currentStep, totalSteps, stepDescription, currentWorker, totalWorkers } = lastStatus.progress;
        progressMessage =
          currentWorker && totalWorkers
            ? `Step ${currentStep}/${totalSteps}: ${stepDescription} (${currentWorker}/${totalWorkers})`
            : `Step ${currentStep}/${totalSteps}: ${stepDescription}`;
      }
      pushStreamingUpdate({
        text: accumulatedText,
        status: nodeStatus,
        ...(progressMessage ? { progressMessage } : {}),
        ...(lastStatus.thinkingContent ? { thinkingContent: lastStatus.thinkingContent } : {}),
        ...(lastStatus.error ? { error: lastStatus.error } : {}),
        ...(lastToolEvent
          ? {
              toolStatus: lastToolEvent.status,
              toolName: lastToolEvent.tool,
              toolResultsCount: lastToolEvent.resultsCount,
              toolInput: lastToolEvent.input,
              toolOutput: lastToolEvent.output,
              toolCallId: lastToolEvent.callId,
              toolSteps: lastToolEvent.steps,
              toolUiType: lastToolEvent.uiType,
              toolUiProps: lastToolEvent.uiProps,
            }
          : {}),
        ...(toolCallsHistory.length > 0 ? { toolCallsHistory: [...toolCallsHistory] } : {}),
      });
    }, HEARTBEAT_MS);

    const userRlm = inputs.rlmSettings;
    let rlmResult: RLMOutput;
    try {
    try {
      rlmResult = await executeRLMStreaming(userPrompt, rawContext, {
      config: {
        mode: userRlm?.mode ?? rlmMode,
        modelId: targetModelId,
        provider: effectiveProviderName,
        enableReasoning: userRlm?.enableReasoning ?? false,
        tokenBudget: userRlm?.tokenBudget ?? 16000,
        enableCache: userRlm?.enableCache ?? true,
        maxDepth: userRlm?.maxDepth,
        maxChildCalls: userRlm?.maxChildCalls,
      },
      apiKey: effectiveApiKey,
      systemPrompt,
      streaming: {
        enabled: true,
        onStatus: onStreamStatus,
        batchSize: 28,
        updateInterval: 50,
      },
      webSearchEnabled: useWebSearch,
      thinkingEnabled: useThinking,
      toolNames: (inputs.toolNames?.length ? inputs.toolNames : getRegisteredToolNames()),
      maxSteps: inputs.maxSteps ?? 8,
      builtInTools: builtInTools.length > 0 ? builtInTools : undefined,
    });
    } finally {
      clearInterval(heartbeat);
    }

    const fullText = rlmResult!.content.markdown;
    // Never overwrite with shorter text (keep longest from stream vs. final result)
    const finalText =
      fullText.length >= accumulatedText.length ? fullText : accumulatedText;
    const tokenCount = rlmResult.metadata?.tokensUsed || Math.ceil(finalText.length / 4);
    const finalReasoning = rlmResult.reasoning?.summary ?? "";

    log("INFO", `RLM completed: mode=${rlmResult.metadata?.mode}, depth=${rlmResult.metadata?.depthUsed}, subCalls=${rlmResult.metadata?.subCalls}`);

    await withRetry(
      () =>
        convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
          canvasId,
          nodeId,
          data: {
            text: finalText,
            status: "complete",
            ...(finalReasoning ? { thinkingContent: finalReasoning } : {}),
            ...(rlmResult.citations && rlmResult.citations.length > 0 ? { citations: rlmResult.citations } : {}),
            progressMessage: undefined,
            ...(lastToolEvent
              ? {
                  toolStatus: lastToolEvent.status,
                  toolName: lastToolEvent.tool,
                  toolResultsCount: lastToolEvent.resultsCount,
                  toolInput: lastToolEvent.input,
                  toolOutput: lastToolEvent.output,
                  toolCallId: lastToolEvent.callId,
                  toolSteps: lastToolEvent.steps,
                }
              : {}),
            ...(toolCallsHistory.length > 0 ? { toolCallsHistory: [...toolCallsHistory] } : {}),
          },
        }),
      "updateNodeDataInternal (RLM complete)"
    );

    const usageForCost: TokenUsageForCost =
      (rlmResult.metadata as { tokenUsage?: TokenUsageForCost } | undefined)?.tokenUsage ?? { totalTokens: tokenCount };
    const costResult = computeRequestCostFromUsage(
      effectiveProviderName,
      targetModelId,
      usageForCost
    );
    if (userId) {
      const secret = process.env.USAGE_RECORD_SECRET ?? process.env.FILE_WORKER_SECRET;
      if (secret) {
        try {
          await convex.action(api.usage_actions.recordUsage, {
            secret,
            userId,
            modelId: targetModelId,
            provider: effectiveProviderName,
            category: "reasoning",
            providerModelId: targetModelId,
            tokens: tokenCount,
            cost: costResult.costUSD,
          });
        } catch (err) {
          log("WARN", "Failed to record usage", { error: err instanceof Error ? err.message : String(err) });
        }
      }
    }
    return { text: finalText, tokens: tokenCount, cost: costResult.costUSD };
    } catch (err) {
      throw err;
    }
  }

  // ========== LEGACY STREAMING PATH (fallback) ==========
  const contextBudget = 4000;
  const distilledContext = distillContext(rawContext, { maxTokens: contextBudget });

  log("INFO", `Context distilled: ${rawContext.items.length} -> ${distilledContext.items.length} items (${distilledContext.totalTokens} tokens)`);

  const messages = buildReasoningPrompt(systemPrompt, distilledContext, userPrompt);

  if (messages.length === 0) {
    throw new Error("No messages to send to AI");
  }

  const GENERATION_TIMEOUT_MS = 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    log("WARN", `Generation timed out for node ${nodeId}, aborting...`);
    controller.abort();
  }, GENERATION_TIMEOUT_MS);

  let stream: AsyncIterable<unknown>;
  try {
    stream = await service.generateStreamResponse({
      model: targetModelId,
      messages: messages as { role: "system" | "user" | "assistant"; content: string }[],
      temperature: temperature || 0.7,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  let fullText = "";
  let lastUpdateTime = Date.now();
  let hasStartedStreaming = false;
  /** Usage from provider stream when available (input+output), so we charge correctly including tools. */
  let streamUsageTotal: number | null = null;

  const providerLower = ((provider as string) || "openai").toLowerCase();

  for await (const chunk of stream) {
    let content = "";
    if (providerLower === "google" || providerLower === "gemini") {
      content = (chunk as { text?: () => string }).text?.() || "";
    } else if (providerLower === "anthropic" || providerLower === "claude") {
      const c = chunk as { type?: string; delta?: { type?: string; text?: string }; usage?: { input_tokens?: number; output_tokens?: number } };
      if (c.type === "content_block_delta" && c.delta?.type === "text_delta") {
        content = c.delta.text || "";
      }
      if (c.type === "message_delta" && c.usage) {
        const in_ = c.usage.input_tokens ?? 0;
        const out_ = c.usage.output_tokens ?? 0;
        streamUsageTotal = in_ + out_;
      }
    } else {
      const c = chunk as {
        choices?: { [i: number]: { delta?: { content?: string }; finish_reason?: string } };
        usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
      };
      content = c.choices?.[0]?.delta?.content || "";
      if (c.usage) {
        const total = c.usage.total_tokens ?? (c.usage.prompt_tokens != null && c.usage.completion_tokens != null ? c.usage.prompt_tokens + c.usage.completion_tokens : null);
        if (total != null && total > 0) streamUsageTotal = total;
      }
    }

    if (content) {
      fullText += content;
      const tokenCount = Math.ceil(fullText.length / 4);

      if (!hasStartedStreaming) {
        hasStartedStreaming = true;
        await withRetry(
          () =>
            convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
              canvasId,
              nodeId,
              data: { status: "streaming" },
            }),
          "updateNodeDataInternal (start streaming)"
        );
      }

      const now = Date.now();
      if (tokenCount % 10 === 0 || now - lastUpdateTime > 500) {
        await withRetry(
          () =>
            convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
              canvasId,
              nodeId,
              data: { text: fullText },
            }),
          "updateNodeDataInternal (streaming update)"
        );
        lastUpdateTime = now;
      }
    }
  }

  const tokenCount = streamUsageTotal != null && streamUsageTotal > 0 ? streamUsageTotal : Math.ceil(fullText.length / 4);

  await withRetry(
    () =>
      convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
        canvasId,
        nodeId,
        data: { text: fullText, status: "complete" },
      }),
    "updateNodeDataInternal (text complete)"
  );

  const costResult = computeRequestCostFromUsage(
    effectiveProviderName,
    targetModelId,
    { totalTokens: tokenCount }
  );
  if (userId) {
    const secret = process.env.USAGE_RECORD_SECRET ?? process.env.FILE_WORKER_SECRET;
    if (secret) {
      try {
        await convex.action(api.usage_actions.recordUsage, {
          secret,
          userId,
          modelId: targetModelId,
          provider: effectiveProviderName,
          category: "reasoning",
          providerModelId: targetModelId,
          tokens: tokenCount,
          cost: costResult.costUSD,
        });
      } catch (err) {
        log("WARN", "Failed to record usage", { error: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  return { text: fullText, tokens: tokenCount, cost: costResult.costUSD };
}

export interface ResumeContinuationParams {
  canvasId: Id<"canvas">;
  nodeId: string;
  toolResult: unknown;
  pendingToolCall: { tool: string; args?: Record<string, unknown>; callId?: string };
  currentText: string;
  effectiveProviderName: string;
  targetModelId: string;
  effectiveApiKey: string | undefined;
  userId?: Id<"users">;
  convex: { mutation: (fn: unknown, args: unknown) => Promise<unknown>; action: (fn: unknown, args: unknown) => Promise<unknown> };
  api: { canvas: { canvas: { updateNodeDataInternal: unknown } }; usage_actions: { recordUsage: unknown } };
  withRetry: <T>(fn: () => Promise<T>, name: string) => Promise<T>;
  log: (level: "INFO" | "WARN" | "ERROR", message: string, context?: Record<string, unknown>) => void;
}

/**
 * After user confirms a tool, run one model call to continue the response and append to the node.
 */
export async function handleResumeContinuation(params: ResumeContinuationParams): Promise<NodeExecutionResult> {
  const {
    canvasId,
    nodeId,
    toolResult,
    pendingToolCall,
    currentText,
    effectiveProviderName,
    targetModelId,
    effectiveApiKey,
    userId,
    convex,
    api,
    withRetry,
    log,
  } = params;

  const resultStr =
    typeof toolResult === "object" && toolResult !== null
      ? JSON.stringify(toolResult, null, 2)
      : String(toolResult);
  const userMessage = `The user confirmed the following action.\nTool: ${pendingToolCall.tool}\nResult: ${resultStr}\n\nContinue your response briefly based on this result.`;

  const response = await generateTextWithAISDK(
    effectiveProviderName,
    targetModelId,
    effectiveApiKey ?? "",
    [{ role: "user", content: userMessage }],
    { maxTokens: 1500 }
  );

  const continuation = response.content?.trim() ?? "";
  const fullText = currentText ? `${currentText}\n\n${continuation}` : continuation;
  const tokenCount = typeof response.tokens === "number" ? response.tokens : (response.tokens as { total?: number })?.total ?? Math.ceil(fullText.length / 4);

  await withRetry(
    () =>
      convex.mutation(api.canvas.canvas.updateNodeDataInternal, {
        canvasId,
        nodeId,
        data: { text: fullText, status: "complete", agentState: "completed", pendingToolCall: undefined },
      }),
    "updateNodeDataInternal (resume continuation)"
  );

  const { computeRequestCostFromUsage } = await import("@/lib/billing/cost");
  const costResult = computeRequestCostFromUsage(effectiveProviderName, targetModelId, {
    totalTokens: tokenCount,
  });
  if (userId) {
    const secret = process.env.USAGE_RECORD_SECRET ?? process.env.FILE_WORKER_SECRET;
    if (secret) {
      try {
        await convex.action(api.usage_actions.recordUsage, {
          secret,
          userId,
          modelId: targetModelId,
          provider: effectiveProviderName,
          category: "reasoning",
          providerModelId: targetModelId,
          tokens: tokenCount,
          cost: costResult.costUSD,
        });
      } catch (err) {
        log("WARN", "Failed to record usage", { error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  log("INFO", "Resume continuation completed", { nodeId, tokenCount });
  return { text: continuation, tokens: tokenCount, cost: costResult.costUSD };
}
