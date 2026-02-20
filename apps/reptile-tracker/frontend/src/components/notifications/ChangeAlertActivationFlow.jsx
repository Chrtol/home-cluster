import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import ReptileAvatar from '@/components/ReptileAvatar';
import { Check } from 'lucide-react';
import axiosInstance from '@/utils/axiosInstance';

export default function ChangeAlertActivationFlow({ open, onOpenChange, reptiles, onComplete }) {
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
      await axiosInstance.post('/api/change-alerts/presets/bulk-apply', {
        reptile_ids: Array.from(selectedReptiles),
        alert_types: alertTypes
      });
      onComplete();
      onOpenChange(false);
      // Reset state
      setStep(1);
      setSelectedReptiles(new Set(reptiles.map(r => r.id)));
      setAlertTypes({ feeding: true, weight: true, measurements: true });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && 'Step 1: Select Reptiles'}
            {step === 2 && 'Step 2: Select Alert Types'}
            {step === 3 && 'Step 3: Confirm'}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Select Reptiles */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                Deselect All
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {reptiles.map(reptile => {
                const isSelected = selectedReptiles.has(reptile.id);
                return (
                  <button
                    key={reptile.id}
                    onClick={() => handleReptileToggle(reptile.id)}
                    className={`
                      relative p-3 rounded-lg border-2 transition-all
                      ${isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                      }
                    `}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <ReptileAvatar reptile={reptile} size="md" />
                      <span className="text-sm font-medium text-center">
                        {reptile.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {reptile.species}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                        <Check size={14} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => setStep(2)}
                disabled={selectedCount === 0}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Select Alert Types */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="feeding-alerts" className="text-base font-medium">
                    Feeding Alerts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when feeding patterns change significantly
                  </p>
                </div>
                <Switch
                  id="feeding-alerts"
                  checked={alertTypes.feeding}
                  onCheckedChange={() => handleAlertTypeToggle('feeding')}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="weight-alerts" className="text-base font-medium">
                    Weight Alerts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Track significant weight gains or losses
                  </p>
                </div>
                <Switch
                  id="weight-alerts"
                  checked={alertTypes.weight}
                  onCheckedChange={() => handleAlertTypeToggle('weight')}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="measurement-alerts" className="text-base font-medium">
                    Measurement Alerts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Monitor changes in length, girth, and other measurements
                  </p>
                </div>
                <Switch
                  id="measurement-alerts"
                  checked={alertTypes.measurements}
                  onCheckedChange={() => handleAlertTypeToggle('measurements')}
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => setStep(3)}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="p-6 bg-muted/50 rounded-lg space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Reptiles Selected</p>
                <p className="text-2xl font-bold">{selectedCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Alert Types Enabled</p>
                <p className="text-lg font-medium">{enabledAlertTypes || 'None'}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                We'll use sensible defaults based on each reptile's species and age category.
              </p>
              <p>
                You can customize individual settings later from the Change Alerts tab.
              </p>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                onClick={handleEnableAlerts}
                disabled={isSubmitting || selectedCount === 0}
              >
                {isSubmitting ? 'Enabling...' : 'Enable Alerts'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
