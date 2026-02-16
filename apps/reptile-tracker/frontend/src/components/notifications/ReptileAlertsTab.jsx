import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { differenceInMonths } from 'date-fns';

function ReptileAlertsTab() {
  const [searchParams] = useSearchParams();
  const preselectedReptile = searchParams.get('reptile');

  const [reptiles, setReptiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedReptile, setExpandedReptile] = useState(null); // Only one expanded at a time
  const [savingId, setSavingId] = useState(null);

  // Form state for inline editing
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadReptiles();
  }, []);

  useEffect(() => {
    if (preselectedReptile && reptiles.length > 0) {
      setExpandedReptile(parseInt(preselectedReptile));
    }
  }, [preselectedReptile, reptiles]);

  const loadReptiles = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/reptiles');
      setReptiles(res.data);
    } catch (err) {
      console.error('Failed to load reptiles:', err);
      setError('Failed to load reptiles');
    } finally {
      setLoading(false);
    }
  };

  const getAgeCategory = (reptile) => {
    if (!reptile.birth_date) return 'adult';
    const ageMonths = differenceInMonths(new Date(), new Date(reptile.birth_date));
    if (ageMonths < 6) return 'hatchling';
    if (ageMonths < 18) return 'juvenile';
    return 'adult';
  };

  const getDefaultThresholds = (reptile) => {
    const ageCategory = getAgeCategory(reptile);

    // Age-aware defaults
    if (ageCategory === 'hatchling') {
      return { gain: 25, loss: 10 }; // Babies grow fast but shouldn't lose much
    } else if (ageCategory === 'juvenile') {
      return { gain: 15, loss: 8 }; // Juveniles still growing
    } else {
      return { gain: 10, loss: 5 }; // Adults change slowly
    }
  };

  const handleToggleExpand = (reptileId) => {
    if (expandedReptile === reptileId) {
      setExpandedReptile(null);
      setFormData({});
    } else {
      const reptile = reptiles.find(r => r.id === reptileId);
      setExpandedReptile(reptileId);

      // Initialize form with current values or defaults
      const defaults = getDefaultThresholds(reptile);
      setFormData({
        weight_alerts_enabled: reptile.weight_alerts_enabled || false,
        weight_alert_gain_threshold_percent: reptile.weight_alert_gain_threshold_percent ?? defaults.gain,
        weight_alert_loss_threshold_percent: reptile.weight_alert_loss_threshold_percent ?? defaults.loss,
        weight_alert_cooldown_days: reptile.weight_alert_cooldown_days ?? null, // null = inherit
      });
    }
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async (reptileId) => {
    setSavingId(reptileId);
    setError('');
    setSuccess('');

    try {
      const reptile = reptiles.find(r => r.id === reptileId);
      const updates = {
        weight_alerts_enabled: formData.weight_alerts_enabled,
        weight_alert_gain_threshold_percent: parseFloat(formData.weight_alert_gain_threshold_percent) || null,
        weight_alert_loss_threshold_percent: parseFloat(formData.weight_alert_loss_threshold_percent) || null,
        weight_alert_cooldown_days: formData.weight_alert_cooldown_days,
      };

      const res = await axios.patch(`/api/reptiles/${reptileId}`, updates);
      setReptiles(reptiles.map(r => r.id === reptileId ? res.data : r));
      setExpandedReptile(null);
      setFormData({});
      setSuccess(`Weight alert settings saved for ${reptile?.name || 'reptile'}`);

      // Clear success after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to save:', err);
      setError(err.response?.data?.detail || 'Failed to save weight alert settings');
    } finally {
      setSavingId(null);
    }
  };

  const getAlertStatusText = (reptile) => {
    if (!reptile.weight_alerts_enabled) {
      return 'Disabled';
    }

    const defaults = getDefaultThresholds(reptile);
    const gainThreshold = reptile.weight_alert_gain_threshold_percent ?? defaults.gain;
    const lossThreshold = reptile.weight_alert_loss_threshold_percent ?? defaults.loss;

    return `Enabled: +${gainThreshold}% / -${lossThreshold}%`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-muted-foreground">Loading reptiles...</div>
      </div>
    );
  }

  if (reptiles.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No reptiles yet. Add a reptile to configure weight alerts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-800 dark:text-green-200 text-sm">{success}</p>
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-bold mb-4 text-foreground">Weight Alert Settings per Reptile</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Configure weight change alert thresholds for each of your reptiles. Alerts are sent when weight changes exceed the thresholds you set.
        </p>

        <div className="space-y-3">
          {reptiles.map((reptile) => {
            const isExpanded = expandedReptile === reptile.id;
            const ageCategory = getAgeCategory(reptile);
            const defaults = getDefaultThresholds(reptile);

            return (
              <Collapsible.Root
                key={reptile.id}
                open={isExpanded}
                onOpenChange={() => handleToggleExpand(reptile.id)}
              >
                <div className="border border-border rounded-lg overflow-hidden">
                  {/* Header */}
                  <Collapsible.Trigger asChild>
                    <button className="w-full flex items-center justify-between p-4 bg-card hover:bg-secondary transition-colors">
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        <div className="text-left">
                          <div className="font-semibold text-foreground">{reptile.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {reptile.species} • Age category: {ageCategory}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {getAlertStatusText(reptile)}
                      </div>
                    </button>
                  </Collapsible.Trigger>

                  {/* Expanded Content */}
                  <Collapsible.Content className="bg-card border-t border-border">
                    <div className="p-4 space-y-4">
                      {/* Enable/Disable Toggle */}
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.weight_alerts_enabled || false}
                          onChange={(e) => handleFormChange('weight_alerts_enabled', e.target.checked)}
                          className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-foreground">Enable Weight Alerts</div>
                          <div className="text-sm text-muted-foreground">
                            Get notified when {reptile.name}'s weight changes significantly
                          </div>
                        </div>
                      </label>

                      {formData.weight_alerts_enabled && (
                        <div className="ml-7 space-y-4 pt-2 border-t border-border">
                          {/* Age Category Info */}
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              <strong>Age category: {ageCategory}</strong> — Recommended defaults: +{defaults.gain}% gain / -{defaults.loss}% loss
                            </p>
                          </div>

                          {/* Gain Threshold */}
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Weight Gain Threshold (%)
                            </label>
                            <input
                              type="number"
                              value={formData.weight_alert_gain_threshold_percent ?? ''}
                              onChange={(e) => handleFormChange('weight_alert_gain_threshold_percent', e.target.value)}
                              min="1"
                              max="500"
                              step="0.1"
                              className="input-field w-32"
                              placeholder={defaults.gain.toString()}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Alert when weight increases by this percentage (1-500%)
                            </p>
                          </div>

                          {/* Loss Threshold */}
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Weight Loss Threshold (%)
                            </label>
                            <input
                              type="number"
                              value={formData.weight_alert_loss_threshold_percent ?? ''}
                              onChange={(e) => handleFormChange('weight_alert_loss_threshold_percent', e.target.value)}
                              min="0"
                              max="100"
                              step="0.1"
                              className="input-field w-32"
                              placeholder={defaults.loss.toString()}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Alert when weight decreases by this percentage (0-100%)
                            </p>
                          </div>

                          {/* Cooldown Period */}
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Cooldown Period
                            </label>
                            <select
                              value={formData.weight_alert_cooldown_days === null ? 'inherit' : formData.weight_alert_cooldown_days}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleFormChange('weight_alert_cooldown_days', val === 'inherit' ? null : parseInt(val));
                              }}
                              className="w-full px-3 py-2 bg-background border border-input rounded-md"
                            >
                              <option value="inherit">Inherit global setting (7 days)</option>
                              <option value="0">No cooldown</option>
                              <option value="1">1 day</option>
                              <option value="3">3 days</option>
                              <option value="7">7 days</option>
                              <option value="14">14 days</option>
                              <option value="30">30 days</option>
                            </select>

                            {formData.weight_alert_cooldown_days === 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Alert will trigger on every weight log. Useful for monitoring sick reptiles.
                              </p>
                            )}
                          </div>

                          {/* Save Button */}
                          <div className="flex gap-3 pt-2">
                            <button
                              onClick={() => handleSave(reptile.id)}
                              disabled={savingId === reptile.id}
                              className="btn-primary"
                            >
                              {savingId === reptile.id ? 'Saving...' : 'Save Settings'}
                            </button>
                            <button
                              onClick={() => {
                                setExpandedReptile(null);
                                setFormData({});
                              }}
                              className="btn-secondary"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {!formData.weight_alerts_enabled && (
                        <div className="ml-7 pt-2">
                          <button
                            onClick={() => handleSave(reptile.id)}
                            disabled={savingId === reptile.id}
                            className="btn-primary"
                          >
                            {savingId === reptile.id ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      )}
                    </div>
                  </Collapsible.Content>
                </div>
              </Collapsible.Root>
            );
          })}
        </div>
      </div>

      {/* Info Card */}
      <div className="card bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
        <h3 className="font-bold text-foreground mb-3">How Weight Alerts Work</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            • Alerts are triggered when a reptile's weight changes by more than the configured percentage compared to their previous weight
          </p>
          <p>
            • Thresholds are age-aware: hatchlings have higher gain thresholds since they grow rapidly, adults have lower thresholds
          </p>
          <p>
            • Cooldown period prevents notification spam — configure this in Global Settings
          </p>
          <p>
            • You can customize thresholds per reptile to account for individual growth patterns or health conditions
          </p>
        </div>
      </div>
    </div>
  );
}

export default ReptileAlertsTab;
