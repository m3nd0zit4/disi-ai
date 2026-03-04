import { cn } from "@/lib/utils"
import { marked } from "marked"
import { memo, useId, useMemo } from "react"
import ReactMarkdown, { Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { CodeBlock, CodeBlockCode } from "./code-block"
import { parseSemanticTags, hasSemanticTags, SemanticBlock } from "@/lib/markdown/parse-semantic-tags"
import { Reasoning, ReasoningTrigger, ReasoningContent } from "./reasoning"
import { Citation } from "@/components/tool-ui/citation"
import { Tool } from "./tool"

export type Citation = {
  url: string
  title: string
  description?: string
  domain?: string
  favicon?: string
}

export type MarkdownProps = {
  children: string
  id?: string
  className?: string
  components?: Partial<Components>
  /** Citations for inline rendering as Source badges */
  citations?: Citation[]
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown)
  return tokens.map((token) => token.raw)
}

function extractLanguage(className?: string): string {
  if (!className) return "plaintext"
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : "plaintext"
}

/** Favicon only if valid URL (Tool UI schema). */
function validFavicon(v: string | undefined): string | undefined {
  if (!v?.trim() || !/^https?:\/\//i.test(v)) return undefined
  return v.trim()
}

/**
 * Create components with citation support.
 * Inline citation links use Tool UI Citation (inline variant), not PromptKit Source.
 */
function createComponentsWithCitations(citations?: Citation[]): Partial<Components> {
  const citationMap = new Map<string, Citation>()

  if (citations) {
    for (const cit of citations) {
      citationMap.set(cit.url, cit)
      try {
        const domain = new URL(cit.url).hostname
        if (!citationMap.has(domain)) citationMap.set(domain, cit)
      } catch {
        // ignore
      }
    }
  }

  return {
    a: function LinkComponent({ href, children, ...props }) {
      const citation = href ? citationMap.get(href) : undefined
      const matchedCitation =
        citation ||
        (href &&
          Array.from(citationMap.values()).find((c) => {
            try {
              return href.includes(new URL(c.url).hostname)
            } catch {
              return false
            }
          }))

      if (matchedCitation && matchedCitation.url) {
        const domain =
          matchedCitation.domain ||
          (() => {
            try {
              return new URL(matchedCitation.url).hostname.replace(/^www\./, "")
            } catch {
              return ""
            }
          })()
        return (
          <Citation
            id={`md-cite-${domain}-${matchedCitation.url.slice(0, 40)}`}
            href={matchedCitation.url}
            title={matchedCitation.title || domain || "Fuente"}
            snippet={matchedCitation.description}
            domain={domain || undefined}
            favicon={validFavicon(matchedCitation.favicon)}
            variant="inline"
          />
        )
      }

      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
          {...props}
        >
          {children}
        </a>
      )
    },
  }
}

const INITIAL_COMPONENTS: Partial<Components> = {
  h1: ({ children, ...props }) => (
    <h1 className="mt-6 mb-4 text-2xl font-bold tracking-tight scroll-mt-6" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mt-5 mb-3 text-xl font-semibold tracking-tight scroll-mt-6 border-b border-border/60 pb-1" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mt-4 mb-2 text-lg font-semibold scroll-mt-6" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="mt-3 mb-1.5 text-base font-semibold scroll-mt-6" {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, ...props }) => (
    <h5 className="mt-2 mb-1 text-sm font-semibold scroll-mt-6" {...props}>
      {children}
    </h5>
  ),
  h6: ({ children, ...props }) => (
    <h6 className="mt-2 mb-1 text-sm font-medium text-muted-foreground scroll-mt-6" {...props}>
      {children}
    </h6>
  ),
  p: ({ children, ...props }) => (
    <p className="my-2 leading-7" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-3 ml-6 list-disc [&>li]:mt-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-3 ml-6 list-decimal [&>li]:mt-1" {...props}>
      {children}
    </ol>
  ),
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line

    if (isInline) {
      return (
        <span
          className={cn(
            "bg-primary-foreground rounded-sm px-1 font-mono text-sm",
            className
          )}
          {...props}
        >
          {children}
        </span>
      )
    }

    const language = extractLanguage(className)

    return (
      <CodeBlock className={className}>
        <CodeBlockCode code={children as string} language={language} />
      </CodeBlock>
    )
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>
  },
  img: function ImgComponent({ src, alt, ...props }) {
    const displaySrc = src?.startsWith("s3://")
      ? `/api/file?key=${src.replace("s3://", "")}&redirect=true`
      : src;

    return (
      <div className="relative w-full max-w-md my-4 rounded-xl overflow-hidden border bg-muted/50 max-h-[400px] flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displaySrc}
          alt={alt || "Generated image"}
          className="w-full h-auto max-h-full object-contain"
          loading="lazy"
          {...props}
        />
      </div>
    )
  },
}

const MemoizedMarkdownBlock = memo(
  function MarkdownBlock({
    content,
    components = INITIAL_COMPONENTS,
  }: {
    content: string
    components?: Partial<Components>
  }) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    )
  },
  function propsAreEqual(prevProps, nextProps) {
    return prevProps.content === nextProps.content
  }
)

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock"

/**
 * Render a semantic block (reasoning, sources, tool, or text)
 */
function SemanticBlockRenderer({
  block,
  components,
  blockKey,
}: {
  block: SemanticBlock
  components: Partial<Components>
  blockKey: string
}) {
  switch (block.type) {
    case 'reasoning':
      return (
        <Reasoning key={blockKey}>
          <ReasoningTrigger>Show reasoning</ReasoningTrigger>
          <ReasoningContent className="ml-2 border-l-2 border-l-slate-200 px-2 pb-1 dark:border-l-slate-700">
            {block.content}
          </ReasoningContent>
        </Reasoning>
      )

    case 'sources':
      return (
        <div key={blockKey} className="my-4 flex flex-wrap gap-2">
          {block.metadata?.sources?.map((source, i) => {
            let hostname = source.url;
            try {
              hostname = new URL(source.url).hostname;
            } catch {
              // Use URL as-is if parsing fails
            }
            return (
              <Source key={`${blockKey}-source-${i}`} href={source.url}>
                <SourceTrigger label={source.title || hostname} showFavicon />
                {(source.title || source.description) && (
                  <SourceContent
                    title={source.title || ''}
                    description={source.description || ''}
                  />
                )}
              </Source>
            );
          })}
        </div>
      )

    case 'tool':
      if (block.metadata?.toolPart) {
        return (
          <Tool
            key={blockKey}
            className="w-full"
            toolPart={block.metadata.toolPart}
          />
        )
      }
      return null

    case 'text':
    default:
      return (
        <MemoizedMarkdownBlock
          key={blockKey}
          content={block.content}
          components={components}
        />
      )
  }
}

function MarkdownComponent({
  children,
  id,
  className,
  components,
  citations,
}: MarkdownProps) {
  const generatedId = useId()
  const blockId = id ?? generatedId

  // CRITICAL FIX: Semantic tag parsing is DISABLED
  // The model was generating fake <sources> and <tool> tags that got rendered as real data
  // Real sources come from CitationDisplay component via backend events (citations prop)
  // Real reasoning comes from ThinkingDisplay component via backend events (thinkingContent)
  // DO NOT re-enable without understanding the simulation bug this caused
  const useSemanticParsing = false

  // Parse content based on whether it has semantic tags
  const semanticBlocks = useMemo(
    () => (useSemanticParsing ? parseSemanticTags(children) : null),
    [children, useSemanticParsing]
  )

  // Parse as traditional markdown blocks (for backward compatibility)
  const markdownBlocks = useMemo(
    () => (!useSemanticParsing ? parseMarkdownIntoBlocks(children) : null),
    [children, useSemanticParsing]
  )

  // Create components with citation support
  const citationComponents = useMemo(
    () => createComponentsWithCitations(citations),
    [citations]
  )

  // Merge components: citationComponents + INITIAL_COMPONENTS + user components
  // Citation components take precedence for link rendering
  const mergedComponents = useMemo(
    () => ({ ...INITIAL_COMPONENTS, ...citationComponents, ...components }),
    [components, citationComponents]
  )

  // Render semantic blocks if present (currently disabled)
  if (useSemanticParsing && semanticBlocks) {
    return (
      <div className={className}>
        {semanticBlocks.map((block, index) => (
          <SemanticBlockRenderer
            key={`${blockId}-semantic-${index}`}
            block={block}
            components={mergedComponents}
            blockKey={`${blockId}-semantic-${index}`}
          />
        ))}
      </div>
    )
  }

  // Render traditional markdown blocks
  return (
    <div className={className}>
      {markdownBlocks?.map((block, index) => (
        <MemoizedMarkdownBlock
          key={`${blockId}-block-${index}`}
          content={block}
          components={mergedComponents}
        />
      ))}
    </div>
  )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }
