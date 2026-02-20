import { useState, useEffect } from 'react';
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
import axiosInstance from '@/utils/axiosInstance';

export default function ChangeAlertsTab() {
  const [reptiles, setReptiles] = useState([]);
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [activationModalOpen, setActivationModalOpen] = useState(false);
  const [expandedReptiles, setExpandedReptiles] = useState(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reptilesRes, configsRes] = await Promise.all([
        axiosInstance.get('/api/reptiles'),
        axiosInstance.get('/api/change-alerts/configs')
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

  const handleApplyPreset = async (reptileId, presetId) => {
    try {
      await axiosInstance.post('/api/change-alerts/presets/apply', {
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
      await axiosInstance.post('/api/change-alerts/presets/bulk-apply', {
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
      {/* Activation prompt - only when no ChangeAlertConfig rows exist */}
      {!hasAnyAlerts && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <div className="flex items-start gap-3">
              <Sparkles className="h-6 w-6 text-primary mt-1" />
              <div className="flex-1">
                <CardTitle>Get Started with Change Alerts</CardTitle>
                <CardDescription className="mt-2">
                  Enable smart notifications when your reptiles' feeding patterns, weight, or measurements change significantly.
                  We'll configure sensible defaults based on each reptile's species.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setActivationModalOpen(true)}>
              Set Up Alerts
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions Card - only when alerts exist */}
      {hasAnyAlerts && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant="outline" onClick={handleBulkApplyToAll}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset All to Species Defaults
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Per-Reptile List */}
      {hasAnyAlerts && reptiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alert Settings by Reptile</CardTitle>
            <CardDescription>Click to expand and customize</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {reptiles.map(reptile => {
              const reptileConfigs = configs[reptile.id] || [];
              const isExpanded = expandedReptiles.has(reptile.id);

              return (
                <Collapsible key={reptile.id} open={isExpanded} onOpenChange={() => toggleExpanded(reptile.id)}>
                  <CollapsibleTrigger className="w-full py-3 hover:bg-muted/50 transition-colors">
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
                  <CollapsibleContent className="pt-4 pb-2 space-y-4">
                    <PresetSuggestion
                      reptile={reptile}
                      onApply={(presetId) => handleApplyPreset(reptile.id, presetId)}
                    />
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        Advanced settings
                      </summary>
                      <ManualOverrideForm
                        reptileId={reptile.id}
                        configs={reptileConfigs}
                        onSave={loadData}
                      />
                    </details>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> Change alerts compare recent activity to historical baselines.
          You'll be notified when feeding patterns shift, weight changes significantly, or measurements
          show unexpected growth. Each alert type has a cooldown period to prevent notification fatigue.
        </AlertDescription>
      </Alert>

      {/* Activation Modal */}
      <ChangeAlertActivationFlow
        open={activationModalOpen}
        onOpenChange={setActivationModalOpen}
        reptiles={reptiles}
        onComplete={loadData}
      />
    </div>
  );
}

function AlertTypeBadges({ configs }) {
  if (configs.length === 0) {
    return <Badge variant="outline">No alerts</Badge>;
  }

  const enabledConfigs = configs.filter(c => c.enabled);
  if (enabledConfigs.length === 0) {
    return <Badge variant="outline">Disabled</Badge>;
  }

  const typeLabels = {
    feeding: 'Feed',
    weight: 'Weight',
    measurement_svl: 'SVL',
    measurement_total_length: 'Length',
    measurement_head_width: 'Head',
    measurement_body_girth: 'Girth',
  };

  return (
    <div className="flex gap-1">
      {enabledConfigs.slice(0, 3).map(config => (
        <Badge key={config.id} variant="secondary" className="text-xs">
          {typeLabels[config.alert_type] || config.alert_type}
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
      const response = await axiosInstance.get('/api/change-alerts/presets');
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
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          No preset available for {reptile.species}. Use advanced settings below to configure manually.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="bg-muted/50">
      <CardHeader>
        <CardTitle className="text-base">Suggested Preset</CardTitle>
        <CardDescription>{suggestedPreset.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{suggestedPreset.description}</p>
        <Button
          variant="secondary"
          onClick={handleApply}
          disabled={applying}
          className="w-full"
        >
          {applying ? 'Applying...' : 'Apply Preset'}
        </Button>
      </CardContent>
    </Card>
  );
}

function ManualOverrideForm({ reptileId, configs, onSave }) {
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Initialize form data from configs
    const initial = {};
    configs.forEach(config => {
      initial[config.alert_type] = {
        enabled: config.enabled,
        cooldown_days: config.cooldown_days,
        threshold_type: config.threshold_type,
        threshold_increase: config.threshold_increase,
        threshold_decrease: config.threshold_decrease,
        window_days: config.window_days,
        rolling_average_window: config.rolling_average_window,
      };
    });
    setFormData(initial);
  }, [configs]);

  const handleSave = async (alertType) => {
    setSaving(true);
    try {
      const config = configs.find(c => c.alert_type === alertType);
      if (config) {
        await axiosInstance.put(`/api/change-alerts/configs/${config.id}`, formData[alertType]);
      } else {
        await axiosInstance.post('/api/change-alerts/configs', {
          reptile_id: reptileId,
          alert_type: alertType,
          ...formData[alertType]
        });
      }
      await onSave();
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setSaving(false);
    }
  };

  const alertTypes = ['feeding', 'weight', 'measurement_svl', 'measurement_total_length'];

  return (
    <div className="mt-4 space-y-4 pl-4">
      {alertTypes.map(alertType => {
        const data = formData[alertType] || {};
        const typeLabel = alertType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        return (
          <Card key={alertType}>
            <CardHeader>
              <CardTitle className="text-sm">{typeLabel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor={`${alertType}-enabled`}>Enabled</Label>
                <Switch
                  id={`${alertType}-enabled`}
                  checked={data.enabled || false}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({
                      ...prev,
                      [alertType]: { ...prev[alertType], enabled: checked }
                    }))
                  }
                />
              </div>
              {data.enabled && (
                <>
                  {data.window_days !== undefined && (
                    <div className="space-y-2">
                      <Label htmlFor={`${alertType}-window`}>Window Days</Label>
                      <Input
                        id={`${alertType}-window`}
                        type="number"
                        value={data.window_days || ''}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            [alertType]: { ...prev[alertType], window_days: parseInt(e.target.value) }
                          }))
                        }
                      />
                    </div>
                  )}
                  {data.threshold_decrease !== undefined && (
                    <div className="space-y-2">
                      <Label htmlFor={`${alertType}-threshold`}>Threshold %</Label>
                      <Input
                        id={`${alertType}-threshold`}
                        type="number"
                        value={data.threshold_decrease || ''}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            [alertType]: { ...prev[alertType], threshold_decrease: parseInt(e.target.value) }
                          }))
                        }
                      />
                    </div>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handleSave(alertType)}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
