import { useState } from 'react';
import { Download, Upload, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import ExportWizard from './import-export/ExportWizard';
import ImportWizard from './import-export/ImportWizard';

/**
 * Profile menu dropdown with user info and import/export actions.
 * Opens upward from the sidebar user section.
 */
export default function ProfileMenuDropdown({ user, reptiles = [], currentHouseholdName }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-full flex items-center gap-2 px-2 py-1.5 min-w-0 hover:bg-secondary rounded-lg transition-colors"
        >
          <div className="w-7 h-7 flex-shrink-0 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-medium text-primary">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-medium text-foreground truncate">{user?.name || 'User'}</p>
          </div>
        </button>

        {menuOpen && (
          <>
            {/* Backdrop to close menu */}
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />

            {/* Dropdown menu - opens upward */}
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-card rounded-lg shadow-xl border border-border overflow-hidden z-50">
              <button
                onClick={() => { setExportOpen(true); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors"
              >
                <Download size={16} />Export Data
              </button>
              <button
                onClick={() => { setImportOpen(true); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors"
              >
                <Upload size={16} />Import Data
              </button>
              <div className="border-t border-border" />
              <Link
                to="/settings"
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors"
              >
                <Settings size={16} />Settings
              </Link>
            </div>
          </>
        )}
      </div>

      <ExportWizard open={exportOpen} onOpenChange={setExportOpen} reptiles={reptiles} />
      <ImportWizard open={importOpen} onOpenChange={setImportOpen} currentHouseholdName={currentHouseholdName} />
    </>
  );
}
