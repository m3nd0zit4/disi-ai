"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Leaf, X, Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/hooks/use-toast";

interface KGSuggestionToastProps {
  candidateId: Id<"seedCandidates">;
  title: string;
  score: number;
  reasons: string[];
  onAccept?: () => void;
  onReject?: () => void;
  onDismiss?: () => void;
}

export function KGSuggestionToast({
  candidateId,
  title,
  score,
  reasons,
  onAccept,
  onReject,
  onDismiss,
}: KGSuggestionToastProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const acceptCandidate = useMutation(api.knowledge_garden.seedCandidates.acceptCandidate);
  const rejectCandidate = useMutation(api.knowledge_garden.seedCandidates.rejectCandidate);
  const gardenSettings = useQuery(api.users.settings.getGardenSettings);
  const knowledgeBases = useQuery(api.knowledge_garden.knowledgeBases.list);

  // Get default KB or first available
  const defaultKbId = gardenSettings?.defaultKbId || knowledgeBases?.[0]?._id;

  const handleAccept = async () => {
    if (!defaultKbId) {
      toast({
        title: "No Knowledge Base",
        description: "Please create a Knowledge Base first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await acceptCandidate({ candidateId, kbId: defaultKbId });
      toast({
        title: "Saved to Knowledge Garden",
        description: "Content has been added as a seed.",
      });
      onAccept?.();
    } catch (error) {
      console.error("[KGSuggestionToast] Failed to accept:", error);
      toast({
        title: "Failed to save",
        description: error instanceof Error ? error.message : "Could not save to Knowledge Garden",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      await rejectCandidate({ candidateId });
      onReject?.();
    } catch (error) {
      console.error("[KGSuggestionToast] Failed to reject:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-card/95 backdrop-blur-xl border border-emerald-500/20 rounded-2xl shadow-xl p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 shrink-0">
            <Leaf className="w-4 h-4 text-emerald-500" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground">
                Save to Knowledge Garden?
              </h4>
              <button
                onClick={onDismiss}
                className="p-1 rounded-lg hover:bg-muted transition-colors shrink-0"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {title}
            </p>

            <div className="flex items-center gap-2 mt-3">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    score >= 0.8 ? "bg-emerald-500" : score >= 0.6 ? "bg-amber-500" : "bg-red-500"
                  )}
                  style={{ width: `${score * 100}%` }}
                />
              </div>
              <span className={cn(
                "text-[10px] font-bold",
                score >= 0.8 ? "text-emerald-500" : score >= 0.6 ? "text-amber-500" : "text-red-500"
              )}>
                {Math.round(score * 100)}%
              </span>
            </div>

            {isExpanded && reasons.length > 0 && (
              <div className="mt-3 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                {reasons.map((reason, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-emerald-500/50 mt-1.5 shrink-0" />
                    <span className="text-[10px] text-muted-foreground leading-tight">{reason}</span>
                  </div>
                ))}
              </div>
            )}

            {reasons.length > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Why this suggestion?
                  </>
                )}
              </button>
            )}

            <div className="flex items-center gap-2 mt-4">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReject}
                disabled={isLoading}
                className="flex-1 h-8 text-xs hover:bg-red-500/10 hover:text-red-500"
              >
                <X className="w-3 h-3 mr-1" />
                Skip
              </Button>
              <Button
                size="sm"
                onClick={handleAccept}
                disabled={isLoading || !defaultKbId}
                className="flex-1 h-8 text-xs bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {isLoading ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Check className="w-3 h-3 mr-1" />
                )}
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Provider component to show KG suggestions for pending candidates
 */
export function KGSuggestionProvider({ children }: { children: React.ReactNode }) {
  const pendingCandidates = useQuery(api.knowledge_garden.seedCandidates.listPending, { limit: 1 });
  const gardenSettings = useQuery(api.users.settings.getGardenSettings);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Only show suggestions in assisted mode and when garden is active
  const shouldShow = gardenSettings?.isActive && gardenSettings?.feedMode === "assisted";

  // Get the first pending candidate that hasn't been dismissed
  const currentCandidate = pendingCandidates?.find(
    (c: { _id: string }) => !dismissedIds.has(c._id)
  );

  const handleDismiss = () => {
    if (currentCandidate) {
      setDismissedIds((prev) => new Set(prev).add(currentCandidate._id));
    }
  };

  const handleAccept = () => {
    if (currentCandidate) {
      setDismissedIds((prev) => new Set(prev).add(currentCandidate._id));
    }
  };

  const handleReject = () => {
    if (currentCandidate) {
      setDismissedIds((prev) => new Set(prev).add(currentCandidate._id));
    }
  };

  return (
    <>
      {children}
      {shouldShow && currentCandidate && (
        <KGSuggestionToast
          candidateId={currentCandidate._id}
          title={currentCandidate.title}
          score={currentCandidate.evaluationScore}
          reasons={currentCandidate.evaluationReasons}
          onAccept={handleAccept}
          onReject={handleReject}
          onDismiss={handleDismiss}
        />
      )}
    </>
  );
}
