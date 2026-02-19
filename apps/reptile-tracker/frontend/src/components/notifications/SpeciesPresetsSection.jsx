import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, ChevronDown, Check } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function SpeciesPresetsSection({ reptileId, reptileName, onApplied }) {
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const res = await axios.get('/api/change-alerts/presets');
      setPresets(res.data);
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
  };

  const handleApply = async () => {
    if (!selectedPreset) return;

    setApplying(true);
    setError('');
    setApplied(false);

    try {
      await axios.post('/api/change-alerts/presets/apply', {
        preset_id: selectedPreset,
        reptile_id: reptileId,
      });

      setApplied(true);
      setSelectedPreset('');

      // Notify parent to refresh
      if (onApplied) {
        onApplied();
      }

      // Reset applied state after 3 seconds
      setTimeout(() => setApplied(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to apply preset');
    } finally {
      setApplying(false);
    }
  };

  const selectedPresetData = presets.find(p => p.id === selectedPreset);

  return (
    <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-purple-500" />
        <h4 className="font-semibold text-foreground">Quick Setup with Species Preset</h4>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Apply a preset tailored to {reptileName}'s species for recommended alert settings.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Select value={selectedPreset} onValueChange={setSelectedPreset}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a species preset..." />
            </SelectTrigger>
            <SelectContent>
              {presets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  <div>
                    <div className="font-medium">{preset.name}</div>
                    {preset.description && (
                      <div className="text-xs text-muted-foreground">{preset.description}</div>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <button
          onClick={handleApply}
          disabled={!selectedPreset || applying}
          className={`btn-primary whitespace-nowrap ${applied ? 'bg-green-600 hover:bg-green-700' : ''}`}
        >
          {applying ? (
            'Applying...'
          ) : applied ? (
            <>
              <Check className="w-4 h-4 mr-1" />
              Applied!
            </>
          ) : (
            'Apply Preset'
          )}
        </button>
      </div>

      {selectedPresetData && (
        <div className="mt-3 p-3 bg-background/50 rounded-md text-sm">
          <p className="font-medium mb-2">This preset will configure:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            {Object.entries(selectedPresetData.alerts).map(([alertType, settings]) => {
              if (settings.enabled === false) return null;
              const typeLabel = alertType === 'feeding'
                ? 'Feeding alerts'
                : alertType.replace('measurement_', '').toUpperCase() + ' measurement alerts';
              return (
                <li key={alertType}>
                  {typeLabel} ({settings.cooldown_days} day cooldown)
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {error && (
        <p className="text-red-500 text-sm mt-2">{error}</p>
      )}
    </div>
  );
}

export default SpeciesPresetsSection;
