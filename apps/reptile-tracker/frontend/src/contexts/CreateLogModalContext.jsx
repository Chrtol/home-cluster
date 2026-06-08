import { createContext, useContext, useState, useCallback } from 'react';

/**
 * CreateLogModalContext - Provides global access to CreateLogModal from anywhere
 *
 * Usage:
 * 1. Wrap your app with CreateLogModalProvider (at App.jsx level)
 * 2. Render CreateLogModal inside the provider, consuming context state
 * 3. In any component, call useCreateLogModal().openCreateLog to open the modal
 *
 * Per D-01: Modal is mounted at app root, available from any page
 * Per D-02: No memory - always reset to default state on open
 */
const CreateLogModalContext = createContext(null);

export function CreateLogModalProvider({ children }) {
  // Modal state - managed directly in context (no registration pattern)
  const [open, setOpen] = useState(false);
  const [logType, setLogType] = useState('feeding');
  const [reptileId, setReptileId] = useState(null);
  const [prefillData, setPrefillData] = useState(null);

  // Open the modal with specified parameters
  // Per D-02: Always reset to fresh state on open
  const openCreateLog = useCallback((type, reptile = null, prefill = null) => {
    setLogType(type || 'feeding');
    setReptileId(reptile);
    setPrefillData(prefill);
    setOpen(true);
  }, []);

  // Close the modal and reset state
  const closeCreateLog = useCallback(() => {
    setOpen(false);
    // Reset state on close for clean next open
    setLogType('feeding');
    setReptileId(null);
    setPrefillData(null);
  }, []);

  return (
    <CreateLogModalContext.Provider value={{
      // State for CreateLogModal component
      open,
      logType,
      reptileId,
      prefillData,
      // Actions
      openCreateLog,
      closeCreateLog,
      setOpen,
    }}>
      {children}
    </CreateLogModalContext.Provider>
  );
}

/**
 * Hook for components that want to interact with the modal
 * Returns openCreateLog for opening, and modal state for rendering
 */
export function useCreateLogModal() {
  const context = useContext(CreateLogModalContext);
  if (!context) {
    // Return no-op if not in provider (shouldn't happen in normal usage)
    return {
      openCreateLog: () => false,
      closeCreateLog: () => {},
      open: false,
      logType: 'feeding',
      reptileId: null,
      prefillData: null,
      setOpen: () => {},
    };
  }
  return context;
}

export default CreateLogModalContext;
