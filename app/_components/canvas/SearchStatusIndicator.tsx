import React from 'react';
import { Search, Globe, Twitter } from 'lucide-react';

interface SearchStatusIndicatorProps {
  searchType: 'web' | 'x' | 'google' | null;
  query?: string;
}

export function SearchStatusIndicator({ searchType, query }: SearchStatusIndicatorProps) {
  if (!searchType) return null;

  const icons = {
    web: Globe,
    x: Twitter,
    google: Globe,
  };

  const labels = {
    web: 'Searching web',
    x: 'Searching X',
    google: 'Searching Google',
  };

  const Icon = icons[searchType];

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg">
      <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-pulse" />
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
          {labels[searchType]}
        </p>
        {query && (
          <p className="text-xs text-blue-700 dark:text-blue-300 truncate">
            {query}
          </p>
        )}
      </div>
    </div>
  );
}
