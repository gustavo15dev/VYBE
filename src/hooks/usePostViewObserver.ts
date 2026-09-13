import { useEffect, useRef } from 'react';
import { recordPostView } from '../services/socialService';

interface UsePostViewObserverOptions {
  postId: string;
  currentUid?: string;
  minDurationMs?: number; // default 1500ms (1.5 seconds)
  enabled?: boolean;
}

/**
 * Hook to automatically register a post view when visible on screen for >= minDurationMs (e.g. 1.5s).
 * Enforces the requirement: "Conta como visualização quando o post fica visível na tela por X segundos (ex: 1-2 segundos), não só passar rápido no scroll"
 */
export function usePostViewObserver({
  postId,
  currentUid,
  minDurationMs = 1500,
  enabled = true,
}: UsePostViewObserverOptions) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!enabled || !postId || !currentUid || hasTriggeredRef.current) return;

    const el = elementRef.current;
    if (!el) return;

    // Check if browser supports IntersectionObserver
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          // Post is at least 50% visible: start timer
          if (!timerRef.current && !hasTriggeredRef.current) {
            timerRef.current = setTimeout(() => {
              recordPostView(postId, currentUid);
              hasTriggeredRef.current = true;
              if (el) observer.unobserve(el);
            }, minDurationMs);
          }
        } else {
          // User scrolled away before reaching the required duration: cancel timer
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        }
      },
      {
        threshold: [0.5],
      }
    );

    observer.observe(el);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      observer.disconnect();
    };
  }, [postId, currentUid, minDurationMs, enabled]);

  return elementRef;
}
