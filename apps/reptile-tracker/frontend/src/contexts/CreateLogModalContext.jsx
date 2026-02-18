import { createContext, useContext, useState, useCallback } from 'react';

/**
 * CreateLogModalContext - Provides global access to open CreateLogModal from anywhere
 *
 * Usage:
 * 1. Wrap your app with CreateLogModalProvider
 * 2. In Dashboard, call useCreateLogModalRegistration() to register the modal opener
 * 3. In Layout/other components, call useCreateLogModal() to get openCreateLog function
 */
const CreateLogModalContext = createContext(null);

export function CreateLogModalProvider({ children }) {
  // Store the registered opener function from Dashboard
  const [registeredOpener, setRegisteredOpener] = useState(null);

  // Function for Dashboard to register its modal opener
  const registerOpener = useCallback((openerFn) => {
    setRegisteredOpener(() => openerFn);
  }, []);

  // Function for Dashboard to unregister when unmounting
  const unregisterOpener = useCallback(() => {
    setRegisteredOpener(null);
  }, []);

  // Function that other components call to open the modal
  const openCreateLog = useCallback((logType, reptileId = null, prefill = null) => {
    if (registeredOpener) {
      registeredOpener(logType, reptileId, prefill);
      return true;
    }
    return false; // Modal not available (not on Dashboard)
  }, [registeredOpener]);

  return (
    <CreateLogModalContext.Provider value={{
      openCreateLog,
      registerOpener,
      unregisterOpener,
      isRegistered: !!registeredOpener
    }}>
      {children}
    </CreateLogModalContext.Provider>
  );
}

/**
 * Hook for components that want to OPEN the modal (Layout, QuickLogForm, etc.)
 */
export function useCreateLogModal() {
  const context = useContext(CreateLogModalContext);
  if (!context) {
    // Return a no-op if not in provider
    return { openCreateLog: () => false, isRegistered: false };
  }
  return { openCreateLog: context.openCreateLog, isRegistered: context.isRegistered };
}

/**
 * Hook for Dashboard to REGISTER its modal opener
 */
export function useCreateLogModalRegistration() {
  const context = useContext(CreateLogModalContext);
  if (!context) {
    return { registerOpener: () => {}, unregisterOpener: () => {} };
  }
  return { registerOpener: context.registerOpener, unregisterOpener: context.unregisterOpener };
}

export default CreateLogModalContext;
