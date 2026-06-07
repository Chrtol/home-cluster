import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WizardStepIndicator } from './WizardStepIndicator';
import { ArrowRight, ArrowLeft, Upload, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import axios from 'axios';

/**
 * 4-step import wizard per UI-SPEC D-27:
 * Step 1: Upload file (JSON or ZIP)
 * Step 2: Preview imported data with conflict warnings
 * Step 3: Select destination household
 * Step 4: Confirm and commit import
 */
export default function ImportWizard({ open, onOpenChange, currentHouseholdName = 'My Household' }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewToken, setPreviewToken] = useState(null);
  const [destination, setDestination] = useState('current'); // 'current' or 'new'
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setFile(null);
      setPreview(null);
      setPreviewToken(null);
      setDestination('current');
      setNewHouseholdName('');
      setResult(null);
      setError(null);
    }
  }, [open]);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/exports/imports/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPreview(response.data);
      setPreviewToken(response.data.preview_token);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to parse import file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCommit = async () => {
    if (!previewToken) return;
    setIsCommitting(true);
    setError(null);

    try {
      const response = await axios.post('/api/exports/imports/commit', {
        preview_token: previewToken,
        destination,
        new_household_name: destination === 'new' ? newHouseholdName : null,
      });
      setResult(response.data);
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.detail || 'Import failed');
    } finally {
      setIsCommitting(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return file !== null;
    if (step === 2) return preview?.valid !== false;
    if (step === 3) return destination === 'current' || (destination === 'new' && newHouseholdName.trim() !== '');
    return false;
  };

  // Step 1: File upload
  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="font-medium">Upload Export File</h3>
        <p className="text-sm text-muted-foreground">Select a .json or .zip export file</p>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".json,.zip"
        className="hidden"
      />

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
      >
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        {file ? (
          <div>
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div>
            <p className="font-medium">Click to select file</p>
            <p className="text-sm text-muted-foreground">JSON or ZIP format</p>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {file && (
        <Button onClick={handleUpload} disabled={isUploading} className="w-full">
          {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</> : 'Analyze File'}
        </Button>
      )}
    </div>
  );

  // Step 2: Preview
  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="font-medium">Preview Import</h3>
      </div>

      {preview && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            {preview.valid ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            <span className="font-medium">{preview.valid ? 'Ready to import' : 'Issues found'}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Reptiles:</span> {preview.reptiles?.length || 0}</div>
            <div><span className="text-muted-foreground">Schedules:</span> {preview.schedules_count || 0}</div>
            <div><span className="text-muted-foreground">Logs:</span> {preview.logs_count || 0}</div>
            <div><span className="text-muted-foreground">Photos:</span> {preview.photos_count || 0}</div>
          </div>

          {preview.warnings?.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-600">Warnings:</p>
              {preview.warnings.map((w, i) => (
                <p key={i} className="text-sm text-muted-foreground">• {w}</p>
              ))}
            </div>
          )}

          {preview.errors?.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">Errors:</p>
              {preview.errors.map((e, i) => (
                <p key={i} className="text-sm text-destructive">• {e}</p>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );

  // Step 3: Household selection
  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="font-medium">Choose Destination</h3>
        <p className="text-sm text-muted-foreground">Where should the imported data go?</p>
      </div>

      <div className="grid gap-3">
        <button
          onClick={() => setDestination('current')}
          className={`
            p-4 rounded-lg border-2 text-left transition-all
            ${destination === 'current'
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/50'
            }
          `}
        >
          <div className="font-medium">Add to {currentHouseholdName}</div>
          <div className="text-sm text-muted-foreground">Import into your current household</div>
        </button>

        <button
          onClick={() => setDestination('new')}
          className={`
            p-4 rounded-lg border-2 text-left transition-all
            ${destination === 'new'
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/50'
            }
          `}
        >
          <div className="font-medium">Create New Household</div>
          <div className="text-sm text-muted-foreground">Start fresh with imported data</div>
        </button>
      </div>

      {destination === 'new' && (
        <input
          type="text"
          value={newHouseholdName}
          onChange={(e) => setNewHouseholdName(e.target.value)}
          placeholder="New household name"
          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
        />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button onClick={handleCommit} disabled={isCommitting || !canProceed()} className="w-full">
        {isCommitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</> : 'Confirm Import'}
      </Button>
    </div>
  );

  // Step 4: Success
  const renderStep4 = () => (
    <div className="space-y-4 text-center">
      <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
      <h3 className="font-medium text-lg">Import Complete!</h3>

      {result && (
        <div className="text-sm text-muted-foreground space-y-1">
          <p>{result.reptiles_created} reptile(s) imported</p>
          <p>{result.logs_created} log entries imported</p>
          {result.templates_created > 0 && <p>{result.templates_created} templates imported</p>}
        </div>
      )}

      <Button onClick={() => onOpenChange(false)} className="w-full">
        Done
      </Button>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex flex-col p-0 overflow-hidden sm:max-w-lg">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle>Import Data</SheetTitle>
        </SheetHeader>

        <div className="flex-1 p-6 overflow-y-auto">
          {step < 4 && (
            <WizardStepIndicator currentStep={step} totalSteps={3} labels={['Upload', 'Preview', 'Import']} />
          )}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>

        {step < 4 && (
          <SheetFooter className="px-6 py-4 border-t border-border flex justify-between">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />Back
              </Button>
            ) : <div />}
            {step === 2 && (
              <Button onClick={() => setStep(3)} disabled={!canProceed()}>
                Next<ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
