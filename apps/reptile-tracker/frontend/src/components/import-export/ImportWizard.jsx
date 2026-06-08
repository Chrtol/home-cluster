import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WizardStepIndicator } from './WizardStepIndicator';
import { ArrowRight, ArrowLeft, Upload, Loader2, AlertTriangle, CheckCircle, Plus } from 'lucide-react';
import axios from 'axios';

/**
 * 4-step import wizard per UI-SPEC D-27:
 * Step 1: Upload file (JSON or ZIP)
 * Step 2: Preview imported data with conflict warnings
 * Step 3: Select destination household
 * Step 4: Confirm and commit import
 */
export default function ImportWizard({ open, onOpenChange }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewToken, setPreviewToken] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState(null);
  const [createNewHousehold, setCreateNewHousehold] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch households when wizard opens
  useEffect(() => {
    if (open) {
      const fetchHouseholds = async () => {
        try {
          const res = await axios.get('/api/households/me');
          setHouseholds(res.data);
          // Default to first household
          if (res.data.length > 0) {
            setSelectedHouseholdId(res.data[0].id);
          }
        } catch (e) {
          console.error('Failed to load households', e);
        }
      };
      fetchHouseholds();
    }
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setFile(null);
      setPreview(null);
      setPreviewToken(null);
      setSelectedHouseholdId(null);
      setCreateNewHousehold(false);
      setNewHouseholdName('');
      setResult(null);
      setError(null);
      setIsDragging(false);
    }
  }, [open]);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      // Validate file type
      const validTypes = ['.json', '.zip', 'application/json', 'application/zip'];
      const isValid = validTypes.some(type =>
        droppedFile.name.endsWith(type) || droppedFile.type === type
      );
      if (isValid) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Please drop a .json or .zip file');
      }
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
      console.log('Preview response:', response.data);
      setPreview(response.data);
      setPreviewToken(response.data.preview_token);
      console.log('Set previewToken to:', response.data.preview_token);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to parse import file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCommit = async () => {
    console.log('handleCommit called, previewToken:', previewToken);
    if (!previewToken) {
      setError('Preview token missing. Please re-upload the file.');
      return;
    }
    setIsCommitting(true);
    setError(null);

    try {
      const response = await axios.post('/api/exports/imports/commit', {
        preview_token: previewToken,
        household_id: createNewHousehold ? null : selectedHouseholdId,
        create_new_household: createNewHousehold,
        new_household_name: createNewHousehold ? newHouseholdName : null,
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
    if (step === 3) {
      if (createNewHousehold) {
        return newHouseholdName.trim() !== '';
      }
      return selectedHouseholdId !== null;
    }
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
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragging
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/50'
          }
        `}
      >
        <Upload className={`mx-auto h-12 w-12 mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
        {file ? (
          <div>
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div>
            <p className="font-medium">{isDragging ? 'Drop file here' : 'Click or drag file here'}</p>
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
  const handleHouseholdSelect = (value) => {
    if (value === 'new') {
      setCreateNewHousehold(true);
      setSelectedHouseholdId(null);
    } else {
      setCreateNewHousehold(false);
      setSelectedHouseholdId(parseInt(value));
    }
  };

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="font-medium">Choose Destination</h3>
        <p className="text-sm text-muted-foreground">Select a household to import into</p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Destination Household</label>
        <Select
          value={createNewHousehold ? 'new' : (selectedHouseholdId?.toString() || '')}
          onValueChange={handleHouseholdSelect}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a household" />
          </SelectTrigger>
          <SelectContent>
            {households.map((h) => (
              <SelectItem key={h.id} value={h.id.toString()}>
                {h.name}
              </SelectItem>
            ))}
            <SelectItem value="new">
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create New Household
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {createNewHousehold && (
        <div className="space-y-2">
          <label className="text-sm font-medium">New Household Name</label>
          <input
            type="text"
            value={newHouseholdName}
            onChange={(e) => setNewHouseholdName(e.target.value)}
            placeholder="Enter household name"
            className="w-full px-3 py-2 border border-border rounded-lg bg-background"
          />
        </div>
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
