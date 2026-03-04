/**
 * RLM streaming: StreamProcessor consumes a stream of NormalizedChunk (from mapAISDKStreamToChunks).
 */

export {
  StreamProcessor,
  type StreamProcessorConfig,
  type NormalizedChunk,
  type StreamCitation,
} from "./processor";
export type { NormalizedToolEvent, SearchPhase } from "./types";
export { toStreamCitation, toStreamCitations, getDomain } from "./utils";
