import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, Info, RefreshCw, Sparkles } from 'lucide-react';
import ReptileAvatar from '@/components/ReptileAvatar';
import ChangeAlertActivationFlow from './ChangeAlertActivationFlow';
import axios from 'axios';

// Friendly display names for alert types
const ALERT_TYPE_LABELS = {
  feeding: 'Feeding',
  weight: 'Weight',
  measurement_svl: 'SVL (Snout-Vent Length)',
  measurement_total_length: 'Total Length',
  measurement_head_width: 'Head Width',
  measurement_body_girth: 'Body Girth',
  measurement_tail_length: 'Tail Length',
  measurement_shell_length: 'Shell Length',
  measurement_humidity: 'Humidity',
  measurement_temperature: 'Temperature',
};

// Short labels for badges
const ALERT_TYPE_BADGE_LABELS = {
  feeding: 'Feed',
  weight: 'Weight',
  measurement_svl: 'SVL',
  measurement_total_length: 'Length',
  measurement_head_width: 'Head',
  measurement_body_girth: 'Girth',
  measurement_tail_length: 'Tail',
  measurement_shell_length: 'Shell',
  measurement_humidity: 'Humid',
  measurement_temperature: 'Temp',
};

export default function ChangeAlertsTab() {
  const [reptiles, setReptiles] = useState([]);
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedReptiles, setExpandedReptiles] = useState(new Set());
  const [togglingReptiles, setTogglingReptiles] = useState(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reptilesRes, configsRes] = await Promise.all([
        axios.get('/api/reptiles'),
        axios.get('/api/change-alerts/configs')
      ]);

      setReptiles(reptilesRes.data);

      // Group configs by reptile_id
      const configsByReptile = {};
      configsRes.data.forEach(config => {
        if (!configsByReptile[config.reptile_id]) {
          configsByReptile[config.reptile_id] = [];
        }
        configsByReptile[config.reptile_id].push(config);
      });
      setConfigs(configsByReptile);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasAnyAlerts = Object.keys(configs).length > 0;

  const toggleExpanded = (reptileId) => {
    setExpandedReptiles(prev => {
      const next = new Set(prev);
      if (next.has(reptileId)) {
        next.delete(reptileId);
      } else {
        next.add(reptileId);
      }
      return next;
    });
  };

  // Check if any alerts are enabled for a reptile
  const isReptileAlertsEnabled = (reptileId) => {
    const reptileConfigs = configs[reptileId] || [];
    return reptileConfigs.some(c => c.enabled);
  };

  // Toggle all alerts for a reptile on/off
  const handleToggleReptileAlerts = async (reptileId, enable) => {
    const reptileConfigs = configs[reptileId] || [];
    if (reptileConfigs.length === 0) return;

    setTogglingReptiles(prev => new Set(prev).add(reptileId));
    try {
      // Update all configs for this reptile
      await axios.post('/api/change-alerts/bulk-update', {
        reptile_ids: [reptileId],
        alert_types: reptileConfigs.map(c => c.alert_type),
        settings: { enabled: enable }
      });
      await loadData();
    } catch (error) {
      console.error('Failed to toggle reptile alerts:', error);
    } finally {
      setTogglingReptiles(prev => {
        const next = new Set(prev);
        next.delete(reptileId);
        return next;
      });
    }
  };

  const handleApplyPreset = async (reptileId, presetId) => {
    try {
      await axios.post('/api/change-alerts/presets/apply', {
        reptile_id: reptileId,
        preset_id: presetId
      });
      await loadData();
    } catch (error) {
      console.error('Failed to apply preset:', error);
    }
  };

  const handleBulkApplyToAll = async () => {
    try {
      await axios.post('/api/change-alerts/presets/bulk-apply', {
        reptile_ids: reptiles.map(r => r.id),
        alert_types: {
          feeding: true,
          weight: true,
          measurements: true
        }
      });
      await loadData();
    } catch (error) {
      console.error('Failed to bulk apply:', error);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Inline activation wizard - only when no ChangeAlertConfig rows exist */}
      {!hasAnyAlerts && reptiles.length > 0 && (
        <ChangeAlertActivationFlow
          reptiles={reptiles}
          onComplete={loadData}
        />
      )}

      {/* Per-Reptile List */}
      {hasAnyAlerts && reptiles.length > 0 && (
        <Card className="border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Alert Settings by Reptile</CardTitle>
                <CardDescription>Click to expand and customize</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={handleBulkApplyToAll} className="text-muted-foreground hover:text-foreground">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="divide-y">
            {reptiles.map(reptile => {
              const reptileConfigs = configs[reptile.id] || [];
              const isExpanded = expandedReptiles.has(reptile.id);
              const alertsEnabled = isReptileAlertsEnabled(reptile.id);
              const isToggling = togglingReptiles.has(reptile.id);
              const hasConfigs = reptileConfigs.length > 0;

              return (
                <Collapsible key={reptile.id} open={isExpanded} onOpenChange={() => toggleExpanded(reptile.id)}>
                  <div className="flex items-center py-3">
                    {/* Master toggle for all alerts - only show if reptile has configs */}
                    {hasConfigs && (
                      <div
                        className="pr-3 flex items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Switch
                          checked={alertsEnabled}
                          onCheckedChange={(checked) => handleToggleReptileAlerts(reptile.id, checked)}
                          disabled={isToggling}
                          aria-label={`Toggle all alerts for ${reptile.name}`}
                        />
                      </div>
                    )}
                    <CollapsibleTrigger className="flex-1 hover:bg-muted/50 transition-colors rounded-lg px-2 py-1 -my-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ReptileAvatar reptile={reptile} size="sm" />
                          <span className="font-medium">{reptile.name}</span>
                          <span className="text-muted-foreground text-sm">({reptile.species})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertTypeBadges configs={reptileConfigs} />
                          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="pt-4 pb-2 space-y-4 ml-10">
                    <PresetSuggestion
                      reptile={reptile}
                      onApply={(presetId) => handleApplyPreset(reptile.id, presetId)}
                    />
                    <ManualOverrideForm
                      reptileId={reptile.id}
                      configs={reptileConfigs}
                      onSave={loadData}
                    />
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Info Card - only show when alerts are configured */}
      {hasAnyAlerts && (
        <Alert className="border-0">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>How it works:</strong> Change alerts compare recent activity to historical baselines.
            You'll be notified when feeding patterns shift, weight changes significantly, or measurements
            show unexpected growth. Each alert type has a cooldown period to prevent notification fatigue.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function AlertTypeBadges({ configs }) {
  if (configs.length === 0) {
    return <Badge variant="outline">No alerts</Badge>;
  }

  const enabledConfigs = configs.filter(c => c.enabled);
  if (enabledConfigs.length === 0) {
    return <Badge variant="outline" className="text-muted-foreground">All off</Badge>;
  }

  return (
    <div className="flex gap-1">
      {enabledConfigs.slice(0, 3).map(config => (
        <Badge key={config.id} variant="secondary" className="text-xs">
          {ALERT_TYPE_BADGE_LABELS[config.alert_type] || config.alert_type.replace('measurement_', '').toUpperCase()}
        </Badge>
      ))}
      {enabledConfigs.length > 3 && (
        <Badge variant="secondary" className="text-xs">
          +{enabledConfigs.length - 3}
        </Badge>
      )}
    </div>
  );
}

function PresetSuggestion({ reptile, onApply }) {
  const [presets, setPresets] = useState([]);
  const [suggestedPreset, setSuggestedPreset] = useState(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const response = await axios.get('/api/change-alerts/presets');
      setPresets(response.data);

      // Auto-match preset based on species and age
      const match = autoMatchPreset(reptile.species, reptile.age_category, response.data);
      setSuggestedPreset(match);
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  };

  const autoMatchPreset = (species, ageCategory, presetList) => {
    const normalizedSpecies = species.toLowerCase().replace(/ /g, '_');
    const ageMapping = {
      hatchling: 'juvenile',
      juvenile: 'juvenile',
      adult: 'adult',
      gravid: 'adult',
    };
    const presetAge = ageMapping[ageCategory] || 'adult';
    const fullKey = `${normalizedSpecies}_${presetAge}`;

    // Try full key first
    let match = presetList.find(p => p.id === fullKey);
    if (match) return match;

    // Try species-only key
    match = presetList.find(p => p.id === normalizedSpecies);
    return match || null;
  };

  const handleApply = async () => {
    if (!suggestedPreset) return;
    setApplying(true);
    try {
      await onApply(suggestedPreset.id);
    } finally {
      setApplying(false);
    }
  };

  if (!suggestedPreset) {
    return null; // No preset available, just show manual settings
  }

  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-2 text-sm">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-muted-foreground">Suggested:</span>
        <span className="font-medium">{suggestedPreset.name}</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleApply}
        disabled={applying}
      >
        {applying ? 'Applying...' : 'Apply'}
      </Button>
    </div>
  );
}

function ManualOverrideForm({ reptileId, configs, onSave }) {
  // Default values for each alert type
  const alertTypeDefaults = {
    feeding: { enabled: false, window_days: 14, threshold_decrease: 30, cooldown_days: 7 },
    weight: { enabled: false, threshold_type: 'percentage', threshold_increase: 10, threshold_decrease: 5, cooldown_days: 7 },
    measurement_svl: { enabled: false, threshold_type: 'percentage', threshold_increase: 10, threshold_decrease: 5, rolling_average_window: 3, cooldown_days: 14 },
    measurement_total_length: { enabled: false, threshold_type: 'percentage', threshold_increase: 10, threshold_decrease: 5, rolling_average_window: 3, cooldown_days: 14 },
  };

  const [formData, setFormData] = useState({});
  const [savingTypes, setSavingTypes] = useState(new Set());
  const debounceTimers = useRef({});

  useEffect(() => {
    // Initialize form data: merge defaults with existing configs
    const initial = {};
    Object.keys(alertTypeDefaults).forEach(alertType => {
      const existingConfig = configs.find(c => c.alert_type === alertType);
      if (existingConfig) {
        initial[alertType] = {
          ...alertTypeDefaults[alertType],
          enabled: existingConfig.enabled,
          cooldown_days: existingConfig.cooldown_days ?? alertTypeDefaults[alertType].cooldown_days,
          threshold_type: existingConfig.threshold_type ?? alertTypeDefaults[alertType].threshold_type,
          threshold_increase: existingConfig.threshold_increase ?? alertTypeDefaults[alertType].threshold_increase,
          threshold_decrease: existingConfig.threshold_decrease ?? alertTypeDefaults[alertType].threshold_decrease,
          window_days: existingConfig.window_days ?? alertTypeDefaults[alertType].window_days,
          rolling_average_window: existingConfig.rolling_average_window ?? alertTypeDefaults[alertType].rolling_average_window,
        };
      } else {
        initial[alertType] = { ...alertTypeDefaults[alertType] };
      }
    });
    setFormData(initial);
  }, [configs]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  const saveConfig = useCallback(async (alertType, data) => {
    setSavingTypes(prev => new Set(prev).add(alertType));
    try {
      // PATCH creates if doesn't exist, updates if exists
      await axios.patch(`/api/change-alerts/reptile/${reptileId}/${alertType}`, data);
      await onSave();
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setSavingTypes(prev => {
        const next = new Set(prev);
        next.delete(alertType);
        return next;
      });
    }
  }, [reptileId, onSave]);

  const handleChange = useCallback((alertType, updates) => {
    setFormData(prev => {
      const newData = { ...prev, [alertType]: { ...prev[alertType], ...updates } };

      // Debounce the save - 500ms for typing, immediate for toggles
      const isToggle = 'enabled' in updates;
      const delay = isToggle ? 0 : 500;

      clearTimeout(debounceTimers.current[alertType]);
      debounceTimers.current[alertType] = setTimeout(() => {
        saveConfig(alertType, newData[alertType]);
      }, delay);

      return newData;
    });
  }, [saveConfig]);

  const alertTypes = ['feeding', 'weight', 'measurement_svl', 'measurement_total_length'];
  const isFeedingType = (type) => type === 'feeding';
  const isMeasurementType = (type) => type.startsWith('measurement_');

  return (
    <div className="space-y-3">
      {alertTypes.map(alertType => {
        const data = formData[alertType] || alertTypeDefaults[alertType];
        const typeLabel = ALERT_TYPE_LABELS[alertType] || alertType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const isSaving = savingTypes.has(alertType);

        return (
          <div key={alertType} className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{typeLabel}</span>
                {isSaving && <span className="text-xs text-muted-foreground">Saving...</span>}
              </div>
              <Switch
                id={`${alertType}-enabled`}
                checked={data.enabled || false}
                onCheckedChange={(checked) => handleChange(alertType, { enabled: checked })}
              />
            </div>
            {data.enabled && (
              <div className="mt-3 space-y-3 text-sm">
                {/* Feeding alerts use window_days */}
                {isFeedingType(alertType) && (
                  <div className="flex items-center gap-3">
                    <Label htmlFor={`${alertType}-window`} className="text-muted-foreground whitespace-nowrap">Window</Label>
                    <Input
                      id={`${alertType}-window`}
                      type="number"
                      className="w-20 h-8"
                      value={data.window_days ?? ''}
                      onChange={(e) => handleChange(alertType, { window_days: parseInt(e.target.value) || null })}
                    />
                    <span className="text-muted-foreground text-xs">days</span>
                  </div>
                )}

                {/* Measurement alerts use rolling average */}
                {isMeasurementType(alertType) && (
                  <div className="flex items-center gap-3">
                    <Label htmlFor={`${alertType}-rolling`} className="text-muted-foreground whitespace-nowrap">Rolling avg</Label>
                    <Input
                      id={`${alertType}-rolling`}
                      type="number"
                      className="w-20 h-8"
                      value={data.rolling_average_window ?? ''}
                      onChange={(e) => handleChange(alertType, { rolling_average_window: parseInt(e.target.value) || null })}
                    />
                    <span className="text-muted-foreground text-xs">measurements</span>
                  </div>
                )}

                {/* Thresholds */}
                <div className="flex items-center gap-3 flex-wrap">
                  <Label className="text-muted-foreground">Thresholds</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-xs">+</span>
                    <Input
                      type="number"
                      className="w-16 h-8"
                      value={data.threshold_increase ?? ''}
                      onChange={(e) => handleChange(alertType, { threshold_increase: parseInt(e.target.value) || null })}
                    />
                    <span className="text-muted-foreground text-xs">%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-xs">-</span>
                    <Input
                      type="number"
                      className="w-16 h-8"
                      value={data.threshold_decrease ?? ''}
                      onChange={(e) => handleChange(alertType, { threshold_decrease: parseInt(e.target.value) || null })}
                    />
                    <span className="text-muted-foreground text-xs">%</span>
                  </div>
                </div>

                {/* Cooldown */}
                <div className="flex items-center gap-3">
                  <Label htmlFor={`${alertType}-cooldown`} className="text-muted-foreground whitespace-nowrap">Cooldown</Label>
                  <Input
                    id={`${alertType}-cooldown`}
                    type="number"
                    className="w-20 h-8"
                    value={data.cooldown_days ?? ''}
                    onChange={(e) => handleChange(alertType, { cooldown_days: parseInt(e.target.value) || null })}
                  />
                  <span className="text-muted-foreground text-xs">days</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
