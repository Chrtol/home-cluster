import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import ReptileAvatar from '@/components/ReptileAvatar';
import { Check, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import axios from 'axios';

/**
 * Inline 3-step activation wizard for enabling change alerts.
 * Appears directly on the page (not as a modal) when user has no configs.
 */
export default function ChangeAlertActivationFlow({ reptiles, onComplete }) {
  const [step, setStep] = useState(1);
  const [selectedReptiles, setSelectedReptiles] = useState(() =>
    new Set(reptiles.map(r => r.id))
  );
  const [alertTypes, setAlertTypes] = useState({
    feeding: true,
    weight: true,
    measurements: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset selection when reptiles change
  useEffect(() => {
    setSelectedReptiles(new Set(reptiles.map(r => r.id)));
  }, [reptiles]);

  const handleReptileToggle = (reptileId) => {
    setSelectedReptiles(prev => {
      const next = new Set(prev);
      if (next.has(reptileId)) {
        next.delete(reptileId);
      } else {
        next.add(reptileId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedReptiles(new Set(reptiles.map(r => r.id)));
  };

  const handleDeselectAll = () => {
    setSelectedReptiles(new Set());
  };

  const handleAlertTypeToggle = (type) => {
    setAlertTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const handleEnableAlerts = async () => {
    setIsSubmitting(true);
    try {
      await axios.post('/api/change-alerts/presets/bulk-apply', {
        reptile_ids: Array.from(selectedReptiles),
        alert_types: alertTypes
      });
      onComplete();
    } catch (error) {
      console.error('Failed to enable alerts:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = selectedReptiles.size;
  const enabledAlertTypes = Object.entries(alertTypes)
    .filter(([_, enabled]) => enabled)
    .map(([type]) => type.charAt(0).toUpperCase() + type.slice(1))
    .join(', ');

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className={`
            flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors
            ${step === s
              ? 'bg-primary text-primary-foreground'
              : step > s
                ? 'bg-primary/20 text-primary'
                : 'bg-muted text-muted-foreground'
            }
          `}
        >
          {step > s ? <Check size={16} /> : s}
        </div>
      ))}
    </div>
  );

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <CardTitle>Get Started with Change Alerts</CardTitle>
        <CardDescription>
          Enable smart notifications when your reptiles' feeding patterns, weight, or measurements change.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {stepIndicator}

        {/* Step 1: Select Reptiles */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h3 className="font-medium">Step 1: Select Reptiles</h3>
              <p className="text-sm text-muted-foreground">Choose which reptiles to enable alerts for</p>
            </div>

            <div className="flex justify-center gap-2 mb-4">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                Deselect All
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {reptiles.map(reptile => {
                const isSelected = selectedReptiles.has(reptile.id);
                return (
                  <button
                    key={reptile.id}
                    onClick={() => handleReptileToggle(reptile.id)}
                    className={`
                      relative p-3 rounded-lg border-2 transition-all text-left
                      ${isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50 bg-background'
                      }
                    `}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <ReptileAvatar reptile={reptile} size="md" />
                      <span className="text-sm font-medium text-center line-clamp-1">
                        {reptile.name}
                      </span>
                      <span className="text-xs text-muted-foreground text-center line-clamp-1">
                        {reptile.species}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5">
                        <Check size={12} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Select Alert Types */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h3 className="font-medium">Step 2: Select Alert Types</h3>
              <p className="text-sm text-muted-foreground">Choose which changes to monitor</p>
            </div>

            <div className="space-y-3 max-w-md mx-auto">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-background">
                <div className="space-y-0.5">
                  <Label htmlFor="feeding-alerts" className="text-base font-medium cursor-pointer">
                    Feeding Alerts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when feeding patterns change
                  </p>
                </div>
                <Switch
                  id="feeding-alerts"
                  checked={alertTypes.feeding}
                  onCheckedChange={() => handleAlertTypeToggle('feeding')}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-background">
                <div className="space-y-0.5">
                  <Label htmlFor="weight-alerts" className="text-base font-medium cursor-pointer">
                    Weight Alerts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Track significant weight changes
                  </p>
                </div>
                <Switch
                  id="weight-alerts"
                  checked={alertTypes.weight}
                  onCheckedChange={() => handleAlertTypeToggle('weight')}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-background">
                <div className="space-y-0.5">
                  <Label htmlFor="measurement-alerts" className="text-base font-medium cursor-pointer">
                    Measurement Alerts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Monitor length and girth changes
                  </p>
                </div>
                <Switch
                  id="measurement-alerts"
                  checked={alertTypes.measurements}
                  onCheckedChange={() => handleAlertTypeToggle('measurements')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h3 className="font-medium">Step 3: Confirm Setup</h3>
              <p className="text-sm text-muted-foreground">Review and enable alerts</p>
            </div>

            <div className="max-w-md mx-auto p-6 bg-muted/50 rounded-lg space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Reptiles Selected</span>
                <span className="text-xl font-bold">{selectedCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Alert Types</span>
                <span className="font-medium">{enabledAlertTypes || 'None'}</span>
              </div>
            </div>

            <div className="max-w-md mx-auto text-center space-y-2 text-sm text-muted-foreground">
              <p>
                We'll configure sensible defaults based on each reptile's species.
              </p>
              <p>
                You can customize settings for each reptile afterward.
              </p>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        {step > 1 ? (
          <Button variant="outline" onClick={() => setStep(step - 1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        ) : (
          <div /> // Spacer
        )}

        {step < 3 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={step === 1 && selectedCount === 0}
          >
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleEnableAlerts}
            disabled={isSubmitting || selectedCount === 0}
          >
            {isSubmitting ? 'Enabling...' : 'Enable Alerts'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
