/**
 * Knowledge Worthiness Evaluator
 * Analyzes AI response content to determine if it should be saved to Knowledge Garden
 */

export interface EvaluationMetrics {
  wordCount: number;
  sentenceCount: number;
  hasStructure: boolean;
  hasCodeBlocks: boolean;
  hasList: boolean;
  hasHeadings: boolean;
  informationDensity: number;
  uniqueTermsRatio: number;
}

export interface EvaluationResult {
  score: number; // 0-1
  reasons: string[];
  metrics: EvaluationMetrics;
  suggestedTitle: string;
  suggestedTags: string[];
}

export interface EvaluatorConfig {
  minWordCount?: number;      // Default: 50
  minSentenceCount?: number;  // Default: 3
  structureBonus?: number;    // Default: 0.15
  codeBlockBonus?: number;    // Default: 0.1
}

// Stop words for information density calculation
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
  'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
  'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'between', 'under', 'again', 'further', 'then', 'once',
  'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but',
  'if', 'or', 'because', 'until', 'while', 'this', 'that', 'these',
  'those', 'it', 'its', 'i', 'you', 'he', 'she', 'we', 'they', 'my',
  'your', 'his', 'her', 'our', 'their', 'me', 'him', 'us', 'them'
]);

/**
 * Main evaluation function - analyzes text content for knowledge worthiness
 */
export function evaluateForKnowledge(
  text: string,
  config?: EvaluatorConfig
): EvaluationResult {
  const {
    minWordCount = 50,
    minSentenceCount = 3,
    structureBonus = 0.15,
    codeBlockBonus = 0.1,
  } = config || {};

  const metrics = analyzeContent(text);
  const reasons: string[] = [];
  let score = 0;

  // 1. Length check (0-0.25)
  if (metrics.wordCount >= minWordCount) {
    const lengthScore = Math.min(metrics.wordCount / 200, 0.25);
    score += lengthScore;
    reasons.push(`Sufficient length (${metrics.wordCount} words)`);
  } else {
    reasons.push(`Content too short (${metrics.wordCount} < ${minWordCount} words)`);
  }

  // 2. Sentence structure (0-0.2)
  if (metrics.sentenceCount >= minSentenceCount) {
    score += 0.2;
    reasons.push(`Good sentence structure (${metrics.sentenceCount} sentences)`);
  } else {
    reasons.push(`Limited sentence structure (${metrics.sentenceCount} < ${minSentenceCount} sentences)`);
  }

  // 3. Information density (0-0.25)
  const densityScore = metrics.informationDensity * 0.25;
  score += densityScore;
  if (metrics.informationDensity > 0.6) {
    reasons.push(`High information density (${(metrics.informationDensity * 100).toFixed(0)}%)`);
  } else if (metrics.informationDensity > 0.4) {
    reasons.push(`Moderate information density (${(metrics.informationDensity * 100).toFixed(0)}%)`);
  }

  // 4. Structure bonus
  if (metrics.hasStructure) {
    score += structureBonus;
    const structureTypes: string[] = [];
    if (metrics.hasHeadings) structureTypes.push('headings');
    if (metrics.hasList) structureTypes.push('lists');
    reasons.push(`Contains structured content (${structureTypes.join(', ')})`);
  }

  // 5. Code block bonus
  if (metrics.hasCodeBlocks) {
    score += codeBlockBonus;
    reasons.push('Contains code examples');
  }

  // 6. Unique terms ratio (0-0.15)
  const termsScore = metrics.uniqueTermsRatio * 0.15;
  score += termsScore;
  if (metrics.uniqueTermsRatio > 0.7) {
    reasons.push(`High vocabulary diversity (${(metrics.uniqueTermsRatio * 100).toFixed(0)}% unique terms)`);
  }

  // Clamp score between 0 and 1
  score = Math.min(Math.max(score, 0), 1);

  return {
    score,
    reasons,
    metrics,
    suggestedTitle: extractTitle(text),
    suggestedTags: extractTags(text),
  };
}

/**
 * Analyze content and return metrics
 */
function analyzeContent(text: string): EvaluationMetrics {
  // Word count
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Sentence count (split by . ! ?)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = sentences.length;

  // Structure detection
  const hasHeadings = /^#{1,6}\s/m.test(text) || /<h[1-6]>/i.test(text) || /^\*\*[^*]+\*\*$/m.test(text);
  const hasList = /^[-*]\s/m.test(text) || /^\d+\.\s/m.test(text) || /^•\s/m.test(text);
  const hasCodeBlocks = /```[\s\S]*?```/.test(text) || /`[^`]+`/.test(text);
  const hasStructure = hasHeadings || hasList;

  // Unique terms ratio
  const normalizedWords = words.map(w => w.toLowerCase().replace(/[^\w]/g, ''));
  const uniqueWords = new Set(normalizedWords.filter(w => w.length > 0));
  const uniqueTermsRatio = uniqueWords.size / Math.max(wordCount, 1);

  // Information density: ratio of content words to total words
  const contentWords = normalizedWords.filter(w => w.length > 2 && !STOP_WORDS.has(w));
  const informationDensity = contentWords.length / Math.max(wordCount, 1);

  return {
    wordCount,
    sentenceCount,
    hasStructure,
    hasCodeBlocks,
    hasList,
    hasHeadings,
    informationDensity,
    uniqueTermsRatio,
  };
}

/**
 * Extract a suggested title from the content
 */
function extractTitle(text: string): string {
  // Try to extract markdown heading
  const headingMatch = text.match(/^#{1,6}\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim().slice(0, 100);
  }

  // Try to extract bold text at the start
  const boldMatch = text.match(/^\*\*([^*]+)\*\*/m);
  if (boldMatch) {
    return boldMatch[1].trim().slice(0, 100);
  }

  // Otherwise use first sentence
  const firstSentence = text.split(/[.!?\n]/)[0]?.trim();
  if (firstSentence && firstSentence.length > 10 && firstSentence.length <= 100) {
    return firstSentence;
  }
  if (firstSentence && firstSentence.length > 100) {
    return firstSentence.slice(0, 97) + '...';
  }

  // Fallback with date
  const now = new Date();
  return `AI Response ${now.toISOString().split('T')[0]}`;
}

/**
 * Extract suggested tags from the content
 */
function extractTags(text: string): string[] {
  const tags: string[] = [];
  const lowerText = text.toLowerCase();

  // Detect content types
  if (/```[\s\S]*?```/.test(text)) {
    tags.push('code');

    // Try to detect programming language
    const langMatch = text.match(/```(\w+)/);
    if (langMatch && langMatch[1]) {
      const lang = langMatch[1].toLowerCase();
      if (['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c', 'cpp', 'csharp', 'ruby', 'php', 'swift', 'kotlin'].includes(lang)) {
        tags.push(lang);
      }
    }
  }

  // Detect content patterns
  if (/\bhow to\b/i.test(text) || /\bsteps?\s+to\b/i.test(text)) {
    tags.push('tutorial');
  }
  if (/\bexample[s]?\b/i.test(text) || /\bfor instance\b/i.test(text)) {
    tags.push('examples');
  }
  if (/\bexplain/i.test(text) || /\bwhat is\b/i.test(text)) {
    tags.push('explanation');
  }
  if (/\bcompare\b/i.test(text) || /\bvs\.?\b/i.test(text) || /\bdifference between\b/i.test(text)) {
    tags.push('comparison');
  }
  if (/\bstep[s]?\s+\d/i.test(text) || /\b\d+\.\s+/m.test(text)) {
    tags.push('step-by-step');
  }
  if (/\bwarning\b/i.test(text) || /\bcaution\b/i.test(text) || /\bimportant\b/i.test(text)) {
    tags.push('important');
  }
  if (/\bapi\b/i.test(text) || /\bendpoint\b/i.test(text)) {
    tags.push('api');
  }
  if (/\bdatabase\b/i.test(text) || /\bsql\b/i.test(text) || /\bquery\b/i.test(text)) {
    tags.push('database');
  }

  // Always add ai-generated tag
  tags.push('ai-generated');

  // Remove duplicates and limit to 5 tags
  return [...new Set(tags)].slice(0, 5);
}

/**
 * Quick check if content meets minimum threshold for evaluation
 */
export function shouldEvaluate(text: string, minWordCount: number = 50): boolean {
  if (!text || typeof text !== 'string') return false;
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  return wordCount >= minWordCount;
}

/**
 * Generate idempotency key for a candidate
 */
export function generateIdempotencyKey(
  canvasId: string,
  nodeId: string,
  contentHash?: string
): string {
  const timestamp = Date.now();
  const base = `${canvasId}-${nodeId}-${timestamp}`;
  if (contentHash) {
    return `${base}-${contentHash.slice(0, 8)}`;
  }
  return base;
}
