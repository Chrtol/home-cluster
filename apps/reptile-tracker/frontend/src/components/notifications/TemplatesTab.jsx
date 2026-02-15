import React from 'react';
import NotificationTemplatesTab from '../NotificationTemplatesTab';

/**
 * TemplatesTab - Wrapper for the existing NotificationTemplatesTab
 *
 * The existing NotificationTemplatesTab already provides:
 * - Modal editor with live preview
 * - Template CRUD operations
 * - Group management
 * - Variable insertion
 *
 * This wrapper simply renders the existing component in the Notifications page context.
 */
export default function TemplatesTab() {
  return <NotificationTemplatesTab />;
}
