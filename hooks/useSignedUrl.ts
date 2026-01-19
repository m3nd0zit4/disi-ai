import { useState, useEffect } from "react";

/**
 * Custom hook to fetch a signed URL for a storage item.
 * 
 * @param storageId The storage ID/key to fetch a signed URL for.
 * @param fallbackUrl An optional fallback URL (e.g. a local blob URL).
 * @returns The signed URL or fallback URL.
 */
export function useSignedUrl(storageId?: string, fallbackUrl?: string | null) {
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);
  const [prevStorageId, setPrevStorageId] = useState<string | undefined>(storageId);

  if (storageId !== prevStorageId) {
    setPrevStorageId(storageId);
    setFetchedUrl(null);
  }

  useEffect(() => {
    // If we have a fallback URL (like a local blob), we don't need to fetch
    if (fallbackUrl || !storageId) {
      return;
    }

    const controller = new AbortController();
    
    // Fetch fresh signed URL whenever storageId is present and no fallback exists
    fetch(`/api/file?key=${encodeURIComponent(storageId)}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to fetch signed URL: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        if (!controller.signal.aborted && data.url) {
          setFetchedUrl(data.url);
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error("Failed to load signed URL", err);
        }
      });

    return () => controller.abort();
  }, [storageId, fallbackUrl]);

  return fallbackUrl || fetchedUrl;
}
