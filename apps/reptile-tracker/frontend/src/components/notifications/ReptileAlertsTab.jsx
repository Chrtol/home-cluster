import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ArrowRight } from 'lucide-react';

function ReptileAlertsTab() {
  return (
    <div className="space-y-6">
      {/* Redirect Notice */}
      <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-800/50 rounded-lg">
            <TrendingUp size={32} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-2 text-foreground">Weight Alerts Have Moved</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Weight alert settings are now part of the new <strong>Change Alerts</strong> system, which includes feeding trend alerts and measurement growth alerts in addition to weight change alerts.
            </p>
            <Link
              to="/notifications?tab=change-alerts"
              className="inline-flex items-center gap-2 btn-primary"
            >
              Go to Change Alerts
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="card">
        <h3 className="font-bold text-foreground mb-3">What's in Change Alerts?</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Weight Alerts:</strong> Get notified when a reptile's weight changes significantly (same functionality as before, now with more customization options)
          </p>
          <p>
            <strong>Feeding Alerts:</strong> Detect when feeding frequency drops below expected rates based on recent history
          </p>
          <p>
            <strong>Measurement Alerts:</strong> Track unusual growth rate changes for measurements like SVL, total length, and more
          </p>
          <p className="pt-2">
            All alerts support global defaults and per-reptile overrides, with customizable thresholds and cooldown periods.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ReptileAlertsTab;
