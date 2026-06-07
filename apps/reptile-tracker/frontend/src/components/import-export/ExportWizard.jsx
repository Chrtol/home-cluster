import { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ReptileAvatar from '@/components/ReptileAvatar';
import { WizardStepIndicator } from './WizardStepIndicator';
import { Check, ArrowRight, ArrowLeft, Download, Loader2, Home } from 'lucide-react';
import axios from 'axios';

/**
 * 3-step export wizard per UI-SPEC D-26:
 * Step 1: Select export type (JSON for transfer, ZIP for backup)
 * Step 2: Select reptiles to export (grouped by household)
 * Step 3: Select destination household (for transfers) + Confirm
 */
export default function ExportWizard({ open, onOpenChange, reptiles: propReptiles }) {
  const [step, setStep] = useState(1);
  const [exportType, setExportType] = useState(null); // 'transfer' or 'zip'
  const [reptiles, setReptiles] = useState(propReptiles || []);
  const [households, setHouseholds] = useState([]);
  const [selectedReptiles, setSelectedReptiles] = useState(new Set());
  const [destinationHouseholdId, setDestinationHouseholdId] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [taskStatus, setTaskStatus] = useState(null);
  const [transferResult, setTransferResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Group reptiles by household (API returns household as object, not household_id)
  const reptilesByHousehold = useMemo(() => {
    const grouped = {};
    reptiles.forEach(r => {
      const hId = r.household?.id ?? r.household_id ?? 0;
      if (!grouped[hId]) grouped[hId] = [];
      grouped[hId].push(r);
    });
    return grouped;
  }, [reptiles]);

  // Get household IDs that have selected reptiles (these can't be destinations)
  const sourceHouseholdIds = useMemo(() => {
    const ids = new Set();
    reptiles.forEach(r => {
      if (selectedReptiles.has(r.id)) {
        ids.add(r.household?.id ?? r.household_id);
      }
    });
    return ids;
  }, [reptiles, selectedReptiles]);

  // Fetch reptiles and households when wizard opens
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      Promise.all([
        propReptiles?.length > 0 ? Promise.resolve({ data: propReptiles }) : axios.get('/api/reptiles'),
        axios.get('/api/households/me')
      ])
        .then(([reptilesRes, householdsRes]) => {
          const fetched = reptilesRes.data || [];
          setReptiles(fetched);
          setSelectedReptiles(new Set(fetched.map(r => r.id)));
          setHouseholds(householdsRes.data || []);
        })
        .catch(err => console.error('Failed to fetch data:', err))
        .finally(() => setIsLoading(false));
    }
  }, [open, propReptiles]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setExportType(null);
      setDestinationHouseholdId(null);
      setTaskId(null);
      setTaskStatus(null);
      setTransferResult(null);
    }
  }, [open]);

  // Poll for task completion per D-28
  useEffect(() => {
    if (!taskId) return;
    let errorCount = 0;
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`/api/exports/${taskId}/status`);
        errorCount = 0; // Reset on success
        setTaskStatus(response.data);
        if (response.data.status === 'complete' || response.data.status === 'failed') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Failed to fetch export status:', err);
        errorCount++;
        // After 3 consecutive errors, show error state
        if (errorCount >= 3) {
          setTaskStatus({ status: 'failed', error: 'Unable to check export status. The task may still be running in the background.' });
          clearInterval(interval);
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [taskId]);

  const handleReptileToggle = (id) => {
    setSelectedReptiles(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDirectTransfer = async () => {
    setIsSubmitting(true);
    try {
      const response = await axios.post('/api/reptiles/transfer', {
        reptile_ids: Array.from(selectedReptiles),
        destination_household_id: destinationHouseholdId,
      });
      setTransferResult(response.data);
      setTaskStatus({ status: 'complete' });
    } catch (error) {
      console.error('Failed to transfer:', error);
      setTaskStatus({ status: 'failed', error: error.response?.data?.detail || 'Failed to transfer reptiles' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartExport = async () => {
    // For direct transfers, use the transfer endpoint
    if (exportType === 'transfer') {
      return handleDirectTransfer();
    }

    // For file exports (zip), use the export endpoint
    setIsSubmitting(true);
    try {
      const response = await axios.post('/api/exports', {
        reptile_ids: Array.from(selectedReptiles),
        export_type: exportType,
        is_transfer: false,
      });
      const newTaskId = response.data.task_id;
      setTaskId(newTaskId);
      setTaskStatus({ status: 'pending' });
      // Save to localStorage so Settings page can track it
      localStorage.setItem('pending_export_task_id', newTaskId);
    } catch (error) {
      console.error('Failed to start export:', error);
      setTaskStatus({ status: 'failed', error: error.response?.data?.detail || 'Failed to start export' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = () => {
    if (!taskId) return;
    window.location.href = `/api/exports/${taskId}/download`;
    onOpenChange(false);
  };

  const canProceed = () => {
    if (step === 1) return exportType !== null;
    if (step === 2) return selectedReptiles.size > 0;
    if (step === 3) {
      // For download, task must be complete
      if (taskStatus?.status === 'complete') return true;
      return false;
    }
    return false;
  };

  // Export steps: 1=Starting, 2=Collecting, 3=Serializing, 4=Storing, 5=Complete
  const getStepNumber = (status, stepName) => {
    if (status === 'complete') return 5;
    if (status === 'failed') return 0;
    switch (stepName) {
      case 'collecting': return 2;
      case 'serializing': return 3;
      case 'storing': return 4;
      default: return 1; // pending/starting
    }
  };

  const getStepLabel = (status, stepName) => {
    if (status === 'complete') return 'Complete';
    if (status === 'failed') return 'Failed';
    switch (stepName) {
      case 'collecting': return 'Collecting data...';
      case 'serializing': return 'Preparing file...';
      case 'storing': return 'Saving export...';
      default: return 'Starting...';
    }
  };

  // Step 1: Export type selection
  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="font-medium">What would you like to do?</h3>
      </div>
      <div className="grid gap-3">
        {[
          { id: 'transfer', label: 'Transfer to Another Household', desc: 'Move reptiles to another household you have access to. Instant, no file needed.' },
          { id: 'zip', label: 'Export Backup', desc: 'Create a backup file with all data and photos. Use for archiving or transferring to another device.' },
        ].map(opt => (
          <button
            key={opt.id}
            onClick={() => setExportType(opt.id)}
            className={`
              p-4 rounded-lg border-2 text-left transition-all
              ${exportType === opt.id
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
              }
            `}
          >
            <div className="font-medium">{opt.label}</div>
            <div className="text-sm text-muted-foreground">{opt.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );

  // Helper to toggle all reptiles in a household
  const handleHouseholdToggle = (householdId) => {
    const householdReptiles = reptilesByHousehold[householdId] || [];
    const allSelected = householdReptiles.every(r => selectedReptiles.has(r.id));

    setSelectedReptiles(prev => {
      const next = new Set(prev);
      householdReptiles.forEach(r => {
        if (allSelected) {
          next.delete(r.id);
        } else {
          next.add(r.id);
        }
      });
      return next;
    });
  };

  // Get household name by ID
  const getHouseholdName = (householdId) => {
    if (!householdId || isNaN(householdId)) return 'Unknown Household';
    const household = households.find(h => h.id === householdId);
    return household?.name || `Household ${householdId}`;
  };

  // Step 2: Reptile selection grouped by household
  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="font-medium">
          {exportType === 'transfer' ? 'Select reptiles to transfer' : 'Select reptiles to backup'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {exportType === 'transfer' ? 'Choose which reptiles to move to another household' : 'Choose which reptiles to include in the backup'}
        </p>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : reptiles.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No reptiles found
        </div>
      ) : (
        <>
          <div className="flex justify-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => setSelectedReptiles(new Set(reptiles.map(r => r.id)))}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedReptiles(new Set())}>
              Deselect All
            </Button>
          </div>

          {/* Group reptiles by household */}
          <div className="space-y-6">
            {Object.entries(reptilesByHousehold).map(([householdId, householdReptiles]) => {
              const hId = parseInt(householdId, 10) || 0;
              const allSelected = householdReptiles.every(r => selectedReptiles.has(r.id));

              return (
                <div key={householdId} className="space-y-3">
                  {/* Household header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Home size={16} className="text-muted-foreground" />
                      <span className="font-medium text-sm">{getHouseholdName(hId)}</span>
                      <span className="text-xs text-muted-foreground">
                        ({householdReptiles.filter(r => selectedReptiles.has(r.id)).length}/{householdReptiles.length})
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleHouseholdToggle(hId)}
                      className="text-xs h-7"
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>

                  {/* Reptiles in this household */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {householdReptiles.map(reptile => {
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
                            <span className="text-sm font-medium text-center line-clamp-1">{reptile.name}</span>
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
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  // Get selected reptile names for summary
  const getSelectedReptileNames = () => {
    return reptiles
      .filter(r => selectedReptiles.has(r.id))
      .map(r => r.name)
      .slice(0, 3)
      .join(', ') + (selectedReptiles.size > 3 ? ` +${selectedReptiles.size - 3} more` : '');
  };

  // Step 3: Destination selection (for transfers) + Confirm and export
  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="font-medium">
          {exportType === 'transfer' ? 'Choose destination & confirm' : 'Review your backup'}
        </h3>
      </div>

      {/* For transfers: show destination household selector */}
      {exportType === 'transfer' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground">
            Transfer to household:
          </label>
          <div className="space-y-2">
            {households.map(household => {
              const isSource = sourceHouseholdIds.has(household.id);
              const isSelected = destinationHouseholdId === household.id;

              return (
                <button
                  key={household.id}
                  onClick={() => !isSource && setDestinationHouseholdId(household.id)}
                  disabled={isSource}
                  className={`
                    w-full p-3 rounded-lg border-2 text-left transition-all flex items-center gap-3
                    ${isSource
                      ? 'border-border bg-muted/50 opacity-50 cursor-not-allowed'
                      : isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50 bg-background'
                    }
                  `}
                >
                  <Home size={18} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                  <div className="flex-1">
                    <div className="font-medium">{household.name}</div>
                    {isSource && (
                      <div className="text-xs text-muted-foreground">
                        Contains selected reptiles
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <Check size={18} className="text-primary" />
                  )}
                </button>
              );
            })}
          </div>
          {households.length > 0 && households.every(h => sourceHouseholdIds.has(h.id)) && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              All your households contain selected reptiles. The import wizard will let you create a new household or transfer on a different device.
            </p>
          )}
        </div>
      )}

      {/* Summary card - only show before action is taken */}
      {!transferResult && !taskId && (
        <Card className="p-4">
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Action:</span>{' '}
              {exportType === 'transfer' ? 'Direct Transfer' : 'Export Backup (ZIP)'}
            </div>
            <div>
              <span className="text-muted-foreground">Reptiles:</span>{' '}
              {selectedReptiles.size} ({getSelectedReptileNames()})
            </div>
            {exportType === 'transfer' && destinationHouseholdId && (
              <div>
                <span className="text-muted-foreground">Destination:</span>{' '}
                {getHouseholdName(destinationHouseholdId)}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Action button - only show before action is taken */}
      {!transferResult && !taskId && (
        <Button
          onClick={handleStartExport}
          disabled={isSubmitting || (exportType === 'transfer' && !destinationHouseholdId && households.some(h => !sourceHouseholdIds.has(h.id)))}
          className="w-full"
        >
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{exportType === 'transfer' ? 'Transferring...' : 'Starting...'}</>
          ) : exportType === 'transfer' ? (
            'Transfer Now'
          ) : (
            'Generate Backup'
          )}
        </Button>
      )}

      {/* Direct transfer result */}
      {transferResult && (
        <div className="space-y-4">
          <Card className={`p-4 ${taskStatus?.status === 'complete' ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'}`}>
            <div className="flex items-center gap-3">
              {taskStatus?.status === 'complete' ? (
                <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
              ) : (
                <span className="h-5 w-5 text-red-500 flex-shrink-0">✕</span>
              )}
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {taskStatus?.status === 'complete' ? 'Transfer Complete!' : 'Transfer Failed'}
                </p>
                {taskStatus?.status === 'complete' && (
                  <p className="text-sm text-muted-foreground">
                    Moved {transferResult.transferred_count} reptile{transferResult.transferred_count !== 1 ? 's' : ''} to {transferResult.destination_household_name}
                  </p>
                )}
                {taskStatus?.error && (
                  <p className="text-sm text-red-500">{taskStatus.error}</p>
                )}
              </div>
            </div>
          </Card>
          {taskStatus?.status === 'complete' && (
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Done
            </Button>
          )}
        </div>
      )}

      {/* File export progress - only for ZIP exports */}
      {taskId && (
        <div className="space-y-4">
          <Card className={`p-4 ${taskStatus?.status === 'complete' ? 'border-green-500/50 bg-green-500/10' : taskStatus?.status === 'failed' ? 'border-red-500/50 bg-red-500/10' : 'border-primary/50 bg-primary/10'}`}>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {(taskStatus?.status === 'pending' || taskStatus?.status === 'progress') && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary flex-shrink-0" />
                )}
                {taskStatus?.status === 'complete' && (
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                )}
                {taskStatus?.status === 'failed' && (
                  <span className="h-5 w-5 text-red-500 flex-shrink-0">✕</span>
                )}
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {taskStatus?.status === 'failed' ? 'Export failed' : getStepLabel(taskStatus?.status, taskStatus?.step)}
                  </p>
                  {taskStatus?.error && (
                    <p className="text-sm text-red-500">{taskStatus.error}</p>
                  )}
                </div>
              </div>
              {/* Stepped progress bar */}
              {(taskStatus?.status === 'pending' || taskStatus?.status === 'progress' || taskStatus?.status === 'complete') && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((stepNum) => (
                      <div
                        key={stepNum}
                        className={`h-2 flex-1 rounded-full transition-colors ${
                          stepNum <= getStepNumber(taskStatus?.status, taskStatus?.step)
                            ? 'bg-primary'
                            : 'bg-secondary'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Step {getStepNumber(taskStatus?.status, taskStatus?.step)}/5
                  </p>
                </div>
              )}
            </div>
          </Card>
          {(taskStatus?.status === 'pending' || taskStatus?.status === 'progress') && (
            <p className="text-xs text-center text-muted-foreground">
              You can close this window. Check Settings → Import/Export for status.
            </p>
          )}
          {taskStatus?.status === 'complete' && (
            <Button onClick={handleDownload} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Download Backup
            </Button>
          )}
        </div>
      )}

      {/* Error state for direct transfer */}
      {taskStatus?.status === 'failed' && !transferResult && !taskId && (
        <Card className="p-4 border-red-500/50 bg-red-500/10">
          <div className="flex items-center gap-3">
            <span className="h-5 w-5 text-red-500 flex-shrink-0">✕</span>
            <div className="flex-1">
              <p className="font-medium text-foreground">Transfer Failed</p>
              {taskStatus?.error && (
                <p className="text-sm text-red-500">{taskStatus.error}</p>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex flex-col p-0 overflow-hidden sm:max-w-lg">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle>Export Data</SheetTitle>
        </SheetHeader>

        <div className="flex-1 p-6 overflow-y-auto">
          <WizardStepIndicator currentStep={step} totalSteps={3} labels={['Type', 'Reptiles', 'Confirm']} />
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        <SheetFooter className="px-6 py-4 border-t border-border flex justify-between">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={taskId !== null}>
              <ArrowLeft className="h-4 w-4 mr-2" />Back
            </Button>
          ) : <div />}
          {step < 3 && (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Next<ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
