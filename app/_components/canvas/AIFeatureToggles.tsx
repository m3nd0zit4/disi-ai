import React from 'react';
import { Brain, Info } from 'lucide-react';

interface AIFeatureTogglesProps {
  thinkingEnabled: boolean;
  onThinkingChange: (enabled: boolean) => void;
  modelSupportsThinking: boolean;
}

export function AIFeatureToggles({
  thinkingEnabled,
  onThinkingChange,
  modelSupportsThinking,
}: AIFeatureTogglesProps) {
  if (!modelSupportsThinking) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
      {/* Extended Thinking Toggle (model feature, not a tool) */}
      {modelSupportsThinking && (
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={thinkingEnabled}
              onChange={(e) => onThinkingChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:bg-blue-600"></div>
          </label>
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Extended Thinking
          </span>
          <div className="group relative inline-block">
            <Info className="w-3.5 h-3.5 text-neutral-500 cursor-help" />
            <div className="invisible group-hover:visible absolute z-10 w-64 p-2 mt-2 text-xs text-white bg-neutral-900 rounded-lg shadow-lg -left-28">
              Enable extended thinking for deeper reasoning.
              <br />
              <span className="text-amber-400">Note: This increases token usage and cost.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
