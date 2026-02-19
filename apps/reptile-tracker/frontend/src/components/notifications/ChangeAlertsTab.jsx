import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import SpeciesPresetsSection from './SpeciesPresetsSection';

function ChangeAlertsTab() {
  const [searchParams] = useSearchParams();
  const preselectedReptile = searchParams.get('reptile');

  const [reptiles, setReptiles] = useState([]);
  const [globalSettings, setGlobalSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedReptile, setExpandedReptile] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [savingGlobal, setSavingGlobal] = useState(false);

  // Global form state
  const [globalFormData, setGlobalFormData] = useState({
    // Feeding alerts
    feeding_alert_enabled: false,
    feeding_alert_window_days: 14,
    feeding_alert_threshold_percent: 50,
    feeding_alert_cooldown_days: 7,

    // Measurement alerts
    measurement_alert_enabled: false,
    measurement_alert_types: [],
    measurement_alert_rolling_window_logs: 3,
    measurement_alert_threshold_percent: 10,
    measurement_alert_cooldown_days: 14
  });

  // Per-reptile form state
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (preselectedReptile && reptiles.length > 0) {
      setExpandedReptile(parseInt(preselectedReptile));
    }
  }, [preselectedReptile, reptiles]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load global notification settings
      const settingsRes = await axios.get('/api/notification-settings/me');
      setGlobalSettings(settingsRes.data);

      // Initialize global form data
      setGlobalFormData({
        feeding_alert_enabled: settingsRes.data.feeding_alert_enabled || false,
        feeding_alert_window_days: settingsRes.data.feeding_alert_window_days ?? 14,
        feeding_alert_threshold_percent: settingsRes.data.feeding_alert_threshold_percent ?? 50,
        feeding_alert_cooldown_days: settingsRes.data.feeding_alert_cooldown_days ?? 7,

        measurement_alert_enabled: settingsRes.data.measurement_alert_enabled || false,
        measurement_alert_types: settingsRes.data.measurement_alert_types || [],
        measurement_alert_rolling_window_logs: settingsRes.data.measurement_alert_rolling_window_logs ?? 3,
        measurement_alert_threshold_percent: settingsRes.data.measurement_alert_threshold_percent ?? 10,
        measurement_alert_cooldown_days: settingsRes.data.measurement_alert_cooldown_days ?? 14
      });

      // Load reptiles
      const reptilesRes = await axios.get('/api/reptiles');
      setReptiles(reptilesRes.data);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load change alert settings');
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalFormChange = (field, value) => {
    setGlobalFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleMeasurementTypeToggle = (measurementType) => {
    setGlobalFormData(prev => {
      const types = prev.measurement_alert_types || [];
      const hasType = types.includes(measurementType);

      return {
        ...prev,
        measurement_alert_types: hasType
          ? types.filter(t => t !== measurementType)
          : [...types, measurementType]
      };
    });
  };

  const handleSaveGlobal = async () => {
    setSavingGlobal(true);
    setError('');
    setSuccess('');

    try {
      await axios.post('/api/notification-settings/me', {
        feeding_alert_enabled: globalFormData.feeding_alert_enabled,
        feeding_alert_window_days: parseInt(globalFormData.feeding_alert_window_days) || 14,
        feeding_alert_threshold_percent: parseFloat(globalFormData.feeding_alert_threshold_percent) || 50,
        feeding_alert_cooldown_days: parseInt(globalFormData.feeding_alert_cooldown_days) || 7,

        measurement_alert_enabled: globalFormData.measurement_alert_enabled,
        measurement_alert_types: globalFormData.measurement_alert_types,
        measurement_alert_rolling_window_logs: parseInt(globalFormData.measurement_alert_rolling_window_logs) || 3,
        measurement_alert_threshold_percent: parseFloat(globalFormData.measurement_alert_threshold_percent) || 10,
        measurement_alert_cooldown_days: parseInt(globalFormData.measurement_alert_cooldown_days) || 14
      });

      setSuccess('Global change alert settings saved');
      setTimeout(() => setSuccess(''), 3000);
      await loadData();
    } catch (err) {
      console.error('Failed to save global settings:', err);
      setError(err.response?.data?.detail || 'Failed to save global settings');
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleToggleExpand = (reptileId) => {
    if (expandedReptile === reptileId) {
      setExpandedReptile(null);
      setFormData({});
    } else {
      const reptile = reptiles.find(r => r.id === reptileId);
      setExpandedReptile(reptileId);

      // Initialize form with current values or null (inherit)
      setFormData({
        // Feeding overrides
        feeding_alert_enabled_override: reptile.feeding_alert_enabled_override ?? null,
        feeding_alert_window_days: reptile.feeding_alert_window_days ?? null,
        feeding_alert_threshold_percent: reptile.feeding_alert_threshold_percent ?? null,
        feeding_alert_cooldown_days: reptile.feeding_alert_cooldown_days ?? null,

        // Measurement overrides
        measurement_alert_enabled_override: reptile.measurement_alert_enabled_override ?? null,
        measurement_alert_types: reptile.measurement_alert_types ?? null,
        measurement_alert_rolling_window_logs: reptile.measurement_alert_rolling_window_logs ?? null,
        measurement_alert_threshold_percent: reptile.measurement_alert_threshold_percent ?? null,
        measurement_alert_cooldown_days: reptile.measurement_alert_cooldown_days ?? null
      });
    }
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleReptileMeasurementTypeToggle = (measurementType) => {
    setFormData(prev => {
      // If null, start with empty array (not global default)
      const types = prev.measurement_alert_types ?? [];
      const hasType = types.includes(measurementType);

      return {
        ...prev,
        measurement_alert_types: hasType
          ? types.filter(t => t !== measurementType)
          : [...types, measurementType]
      };
    });
  };

  const handleSaveReptile = async (reptileId) => {
    setSavingId(reptileId);
    setError('');
    setSuccess('');

    try {
      const reptile = reptiles.find(r => r.id === reptileId);
      const updates = {
        feeding_alert_enabled_override: formData.feeding_alert_enabled_override,
        feeding_alert_window_days: formData.feeding_alert_window_days ? parseInt(formData.feeding_alert_window_days) : null,
        feeding_alert_threshold_percent: formData.feeding_alert_threshold_percent ? parseFloat(formData.feeding_alert_threshold_percent) : null,
        feeding_alert_cooldown_days: formData.feeding_alert_cooldown_days !== null && formData.feeding_alert_cooldown_days !== undefined
          ? parseInt(formData.feeding_alert_cooldown_days)
          : null,

        measurement_alert_enabled_override: formData.measurement_alert_enabled_override,
        measurement_alert_types: formData.measurement_alert_types,
        measurement_alert_rolling_window_logs: formData.measurement_alert_rolling_window_logs ? parseInt(formData.measurement_alert_rolling_window_logs) : null,
        measurement_alert_threshold_percent: formData.measurement_alert_threshold_percent ? parseFloat(formData.measurement_alert_threshold_percent) : null,
        measurement_alert_cooldown_days: formData.measurement_alert_cooldown_days !== null && formData.measurement_alert_cooldown_days !== undefined
          ? parseInt(formData.measurement_alert_cooldown_days)
          : null
      };

      const res = await axios.patch(`/api/reptiles/${reptileId}`, updates);
      setReptiles(reptiles.map(r => r.id === reptileId ? res.data : r));
      setExpandedReptile(null);
      setFormData({});
      setSuccess(`Change alert settings saved for ${reptile?.name || 'reptile'}`);

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to save:', err);
      setError(err.response?.data?.detail || 'Failed to save change alert settings');
    } finally {
      setSavingId(null);
    }
  };

  const getReptileAlertStatus = (reptile) => {
    const feedingEnabled = reptile.feeding_alert_enabled_override ?? globalFormData.feeding_alert_enabled;
    const measurementEnabled = reptile.measurement_alert_enabled_override ?? globalFormData.measurement_alert_enabled;

    if (!feedingEnabled && !measurementEnabled) {
      return 'All disabled';
    }

    const parts = [];
    if (feedingEnabled) parts.push('Feeding');
    if (measurementEnabled) parts.push('Measurement');

    return parts.join(' + ') + ' enabled';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-muted-foreground">Loading change alert settings...</div>
      </div>
    );
  }

  const measurementTypes = [
    { value: 'svl', label: 'SVL (Snout-Vent Length)' },
    { value: 'total_length', label: 'Total Length' },
    { value: 'tail_length', label: 'Tail Length' },
    { value: 'head_width', label: 'Head Width' },
    { value: 'other', label: 'Other' }
  ];

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

      {/* Global Feeding Alert Settings */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 text-foreground">Global Feeding Alert Settings</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Get notified when feeding frequency drops significantly. Alerts trigger when the time between feedings exceeds the expected interval by your threshold.
        </p>

        <div className="space-y-4">
          {/* Enable Toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={globalFormData.feeding_alert_enabled}
              onChange={(e) => handleGlobalFormChange('feeding_alert_enabled', e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <div className="flex-1">
              <div className="font-medium text-foreground">Enable Feeding Alerts</div>
              <div className="text-sm text-muted-foreground">
                Alert when feeding frequency drops below expected rate
              </div>
            </div>
          </label>

          {globalFormData.feeding_alert_enabled && (
            <div className="ml-7 space-y-4 pt-2 border-t border-border">
              {/* Window Days */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Baseline Window (days)
                </label>
                <input
                  type="number"
                  value={globalFormData.feeding_alert_window_days}
                  onChange={(e) => handleGlobalFormChange('feeding_alert_window_days', e.target.value)}
                  min="7"
                  max="90"
                  className="input-field w-32"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Calculate expected feeding frequency based on this many days of history (7-90)
                </p>
              </div>

              {/* Threshold */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Alert Threshold (%)
                </label>
                <input
                  type="number"
                  value={globalFormData.feeding_alert_threshold_percent}
                  onChange={(e) => handleGlobalFormChange('feeding_alert_threshold_percent', e.target.value)}
                  min="10"
                  max="500"
                  step="5"
                  className="input-field w-32"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Alert when time between feedings exceeds expected interval by this percentage (10-500%)
                </p>
              </div>

              {/* Cooldown */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Cooldown Period (days)
                </label>
                <input
                  type="number"
                  value={globalFormData.feeding_alert_cooldown_days}
                  onChange={(e) => handleGlobalFormChange('feeding_alert_cooldown_days', e.target.value)}
                  min="0"
                  max="90"
                  className="input-field w-32"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum days between feeding alerts for the same reptile (0-90, 0 = no cooldown)
                </p>
              </div>
            </div>
          )}

          <button
            onClick={handleSaveGlobal}
            disabled={savingGlobal}
            className="btn-primary"
          >
            {savingGlobal ? 'Saving...' : 'Save Global Feeding Settings'}
          </button>
        </div>
      </div>

      {/* Global Measurement Alert Settings */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 text-foreground">Global Measurement Alert Settings</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Get notified when measurement growth rates are unusual. Alerts trigger when the rolling average change exceeds your threshold.
        </p>

        <div className="space-y-4">
          {/* Enable Toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={globalFormData.measurement_alert_enabled}
              onChange={(e) => handleGlobalFormChange('measurement_alert_enabled', e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <div className="flex-1">
              <div className="font-medium text-foreground">Enable Measurement Alerts</div>
              <div className="text-sm text-muted-foreground">
                Alert when measurement growth rates are unusual
              </div>
            </div>
          </label>

          {globalFormData.measurement_alert_enabled && (
            <div className="ml-7 space-y-4 pt-2 border-t border-border">
              {/* Measurement Types */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Alert for Measurement Types
                </label>
                <div className="space-y-2">
                  {measurementTypes.map(mt => (
                    <label key={mt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={globalFormData.measurement_alert_types.includes(mt.value)}
                        onChange={() => handleMeasurementTypeToggle(mt.value)}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-foreground">{mt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Rolling Window */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Rolling Window (logs)
                </label>
                <input
                  type="number"
                  value={globalFormData.measurement_alert_rolling_window_logs}
                  onChange={(e) => handleGlobalFormChange('measurement_alert_rolling_window_logs', e.target.value)}
                  min="2"
                  max="20"
                  className="input-field w-32"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Calculate average change over this many recent logs (2-20)
                </p>
              </div>

              {/* Threshold */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Alert Threshold (%)
                </label>
                <input
                  type="number"
                  value={globalFormData.measurement_alert_threshold_percent}
                  onChange={(e) => handleGlobalFormChange('measurement_alert_threshold_percent', e.target.value)}
                  min="1"
                  max="200"
                  step="1"
                  className="input-field w-32"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Alert when rolling average change exceeds this percentage (1-200%)
                </p>
              </div>

              {/* Cooldown */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Cooldown Period (days)
                </label>
                <input
                  type="number"
                  value={globalFormData.measurement_alert_cooldown_days}
                  onChange={(e) => handleGlobalFormChange('measurement_alert_cooldown_days', e.target.value)}
                  min="0"
                  max="90"
                  className="input-field w-32"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum days between measurement alerts for the same reptile and measurement type (0-90)
                </p>
              </div>
            </div>
          )}

          <button
            onClick={handleSaveGlobal}
            disabled={savingGlobal}
            className="btn-primary"
          >
            {savingGlobal ? 'Saving...' : 'Save Global Measurement Settings'}
          </button>
        </div>
      </div>

      {/* Per-Reptile Overrides */}
      {reptiles.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4 text-foreground">Per-Reptile Overrides</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Customize feeding and measurement alert settings for individual reptiles. Leave blank to inherit global defaults.
          </p>

          <div className="space-y-3">
            {reptiles.map((reptile) => {
              const isExpanded = expandedReptile === reptile.id;

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
                              {reptile.species}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {getReptileAlertStatus(reptile)}
                        </div>
                      </button>
                    </Collapsible.Trigger>

                    {/* Expanded Content */}
                    <Collapsible.Content className="bg-card border-t border-border">
                      <div className="p-4 space-y-6">
                        {/* Species Preset Quick Setup */}
                        <SpeciesPresetsSection
                          reptileId={reptile.id}
                          reptileName={reptile.name}
                          onApplied={() => handleToggleExpand(reptile.id)}
                        />

                        {/* Feeding Alert Overrides */}
                        <div className="space-y-4">
                          <h3 className="font-semibold text-foreground">Feeding Alert Overrides</h3>

                          {/* Enable Override */}
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Enable Feeding Alerts
                            </label>
                            <select
                              value={formData.feeding_alert_enabled_override === null ? 'inherit' : formData.feeding_alert_enabled_override}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleFormChange('feeding_alert_enabled_override',
                                  val === 'inherit' ? null : val === 'true'
                                );
                              }}
                              className="w-full px-3 py-2 bg-background border border-input rounded-md"
                            >
                              <option value="inherit">Inherit global ({globalFormData.feeding_alert_enabled ? 'Enabled' : 'Disabled'})</option>
                              <option value="true">Enable</option>
                              <option value="false">Disable</option>
                            </select>
                          </div>

                          {(formData.feeding_alert_enabled_override ?? globalFormData.feeding_alert_enabled) && (
                            <>
                              {/* Window Days Override */}
                              <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                  Baseline Window (days)
                                </label>
                                <input
                                  type="number"
                                  value={formData.feeding_alert_window_days ?? ''}
                                  onChange={(e) => handleFormChange('feeding_alert_window_days', e.target.value || null)}
                                  min="7"
                                  max="90"
                                  className="input-field w-32"
                                  placeholder={`Global: ${globalFormData.feeding_alert_window_days}`}
                                />
                              </div>

                              {/* Threshold Override */}
                              <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                  Alert Threshold (%)
                                </label>
                                <input
                                  type="number"
                                  value={formData.feeding_alert_threshold_percent ?? ''}
                                  onChange={(e) => handleFormChange('feeding_alert_threshold_percent', e.target.value || null)}
                                  min="10"
                                  max="500"
                                  step="5"
                                  className="input-field w-32"
                                  placeholder={`Global: ${globalFormData.feeding_alert_threshold_percent}`}
                                />
                              </div>

                              {/* Cooldown Override */}
                              <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                  Cooldown Period (days)
                                </label>
                                <input
                                  type="number"
                                  value={formData.feeding_alert_cooldown_days ?? ''}
                                  onChange={(e) => handleFormChange('feeding_alert_cooldown_days', e.target.value || null)}
                                  min="0"
                                  max="90"
                                  className="input-field w-32"
                                  placeholder={`Global: ${globalFormData.feeding_alert_cooldown_days}`}
                                />
                              </div>
                            </>
                          )}
                        </div>

                        {/* Measurement Alert Overrides */}
                        <div className="space-y-4 pt-4 border-t border-border">
                          <h3 className="font-semibold text-foreground">Measurement Alert Overrides</h3>

                          {/* Enable Override */}
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Enable Measurement Alerts
                            </label>
                            <select
                              value={formData.measurement_alert_enabled_override === null ? 'inherit' : formData.measurement_alert_enabled_override}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleFormChange('measurement_alert_enabled_override',
                                  val === 'inherit' ? null : val === 'true'
                                );
                              }}
                              className="w-full px-3 py-2 bg-background border border-input rounded-md"
                            >
                              <option value="inherit">Inherit global ({globalFormData.measurement_alert_enabled ? 'Enabled' : 'Disabled'})</option>
                              <option value="true">Enable</option>
                              <option value="false">Disable</option>
                            </select>
                          </div>

                          {(formData.measurement_alert_enabled_override ?? globalFormData.measurement_alert_enabled) && (
                            <>
                              {/* Measurement Types Override */}
                              <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                  Alert for Measurement Types
                                </label>
                                <div className="space-y-2">
                                  {measurementTypes.map(mt => (
                                    <label key={mt.value} className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={(formData.measurement_alert_types ?? globalFormData.measurement_alert_types).includes(mt.value)}
                                        onChange={() => handleReptileMeasurementTypeToggle(mt.value)}
                                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                                      />
                                      <span className="text-sm text-foreground">{mt.label}</span>
                                    </label>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formData.measurement_alert_types === null && 'Inheriting global types'}
                                </p>
                              </div>

                              {/* Rolling Window Override */}
                              <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                  Rolling Window (logs)
                                </label>
                                <input
                                  type="number"
                                  value={formData.measurement_alert_rolling_window_logs ?? ''}
                                  onChange={(e) => handleFormChange('measurement_alert_rolling_window_logs', e.target.value || null)}
                                  min="2"
                                  max="20"
                                  className="input-field w-32"
                                  placeholder={`Global: ${globalFormData.measurement_alert_rolling_window_logs}`}
                                />
                              </div>

                              {/* Threshold Override */}
                              <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                  Alert Threshold (%)
                                </label>
                                <input
                                  type="number"
                                  value={formData.measurement_alert_threshold_percent ?? ''}
                                  onChange={(e) => handleFormChange('measurement_alert_threshold_percent', e.target.value || null)}
                                  min="1"
                                  max="200"
                                  step="1"
                                  className="input-field w-32"
                                  placeholder={`Global: ${globalFormData.measurement_alert_threshold_percent}`}
                                />
                              </div>

                              {/* Cooldown Override */}
                              <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                  Cooldown Period (days)
                                </label>
                                <input
                                  type="number"
                                  value={formData.measurement_alert_cooldown_days ?? ''}
                                  onChange={(e) => handleFormChange('measurement_alert_cooldown_days', e.target.value || null)}
                                  min="0"
                                  max="90"
                                  className="input-field w-32"
                                  placeholder={`Global: ${globalFormData.measurement_alert_cooldown_days}`}
                                />
                              </div>
                            </>
                          )}
                        </div>

                        {/* Save Buttons */}
                        <div className="flex gap-3 pt-2">
                          <button
                            onClick={() => handleSaveReptile(reptile.id)}
                            disabled={savingId === reptile.id}
                            className="btn-primary"
                          >
                            {savingId === reptile.id ? 'Saving...' : 'Save Overrides'}
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
                    </Collapsible.Content>
                  </div>
                </Collapsible.Root>
              );
            })}
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="card bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
        <h3 className="font-bold text-foreground mb-3">How Change Alerts Work</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Feeding Alerts:</strong> Detect when feeding frequency drops. The system calculates expected feeding intervals based on recent history, then alerts when time between feedings exceeds expected by your threshold.
          </p>
          <p>
            <strong>Measurement Alerts:</strong> Track growth rate changes. Alerts trigger when the rolling average change (over N recent logs) exceeds your threshold percentage.
          </p>
          <p>
            <strong>Cooldown periods:</strong> Prevent notification spam by limiting alert frequency per reptile.
          </p>
          <p>
            <strong>Per-reptile overrides:</strong> Customize settings for individual animals with unique growth patterns or health needs.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ChangeAlertsTab;
