import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * useModalState - URL-driven modal state management hook
 *
 * Manages modal open/close state via URL search params, enabling:
 * - Deep linking (copy URL to share specific modal state)
 * - Browser back/forward navigation to close/reopen modals
 * - Multiple independent modals with different param names
 *
 * @param {string} paramName - URL param name (e.g., 'view', 'create', 'edit')
 * @returns {{
 *   isOpen: boolean,      - true if paramName exists in URL
 *   modalId: string|null, - value of the param (for viewing/editing specific records)
 *   open: (id?: string) => void, - sets param to id or 'new' if no id
 *   close: () => void     - removes the param from URL
 * }}
 *
 * @example
 * const { isOpen, modalId, open, close } = useModalState('view')
 * // URL: /activity?view=123
 * // isOpen = true, modalId = "123"
 *
 * open('456') // URL becomes /activity?view=456
 * close()     // URL becomes /activity
 */
export function useModalState(paramName) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Check if modal is open (param exists in URL)
  const isOpen = searchParams.has(paramName);

  // Get the modal ID (value of the param)
  const modalId = searchParams.get(paramName);

  // Open the modal with optional ID
  const open = useCallback((id) => {
    const params = new URLSearchParams(searchParams);
    params.set(paramName, id ?? 'new');
    setSearchParams(params, { replace: false });
  }, [paramName, searchParams, setSearchParams]);

  // Close the modal by removing the param
  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete(paramName);
    setSearchParams(params, { replace: false });
  }, [paramName, searchParams, setSearchParams]);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => ({
    isOpen,
    modalId,
    open,
    close,
  }), [isOpen, modalId, open, close]);
}

export default useModalState;
