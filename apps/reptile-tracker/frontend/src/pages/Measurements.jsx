import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Plus, Trash2, Edit2, Ruler, Weight } from 'lucide-react';
import { formatDateTime } from '../utils/dateFormatting';

// Predefined measurement types based on common reptile measurements
const MEASUREMENT_TYPES = {
  weight: { label: 'Weight', icon: Weight, units: ['g', 'kg', 'oz', 'lb'] },
  svl: { label: 'Snout-Vent Length (SVL)', icon: Ruler, units: ['cm', 'mm', 'in'] },
  total_length: { label: 'Total Length', icon: Ruler, units: ['cm', 'mm', 'in'] },
  shell_length: { label: 'Shell Length', icon: Ruler, units: ['cm', 'mm', 'in'] },
  shell_width: { label: 'Shell Width', icon: Ruler, units: ['cm', 'mm', 'in'] },
  tail_length: { label: 'Tail Length', icon: Ruler, units: ['cm', 'mm', 'in'] },
  head_width: { label: 'Head Width', icon: Ruler, units: ['cm', 'mm', 'in'] },
  custom: { label: 'Custom Measurement', icon: Ruler, units: ['cm', 'mm', 'in', 'g', 'kg'] }
};

export default function Measurements() {
  const { reptileId } = useParams();
  const navigate = useNavigate();
  const [reptile, setReptile] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState('all');

  // Form state
  const [measurementType, setMeasurementType] = useState('weight');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('g');
  const [customLabel, setCustomLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [measuredAt, setMeasuredAt] = useState(new Date().toISOString().slice(0, 16));

  useEffect(() => {
    loadReptile();
    loadMeasurements();
  }, [reptileId, filterType]);

  const loadReptile = async () => {
    try {
      const response = await axios.get(`/api/reptiles/${reptileId}`);
      setReptile(response.data);
    } catch (error) {
      console.error('Failed to load reptile:', error);
    }
  };

  const loadMeasurements = async () => {
    try {
      setLoading(true);
      const params = filterType !== 'all' ? { measurement_type: filterType } : {};
      const response = await axios.get(`/api/measurements/reptile/${reptileId}`, { params });
      setMeasurements(response.data);
    } catch (error) {
      console.error('Failed to load measurements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!value || parseFloat(value) <= 0) {
      alert('Please enter a valid measurement value');
      return;
    }

    if (measurementType === 'custom' && !customLabel.trim()) {
      alert('Please provide a label for your custom measurement');
      return;
    }

    try {
      await axios.post('/api/measurements', {
        reptile_id: parseInt(reptileId),
        measurement_type: measurementType,
        value: parseFloat(value),
        unit,
        custom_label: measurementType === 'custom' ? customLabel : null,
        notes: notes.trim() || null,
        measured_at: new Date(measuredAt).toISOString()
      });

      // Reset form
      setValue('');
      setNotes('');
      setCustomLabel('');
      setMeasuredAt(new Date().toISOString().slice(0, 16));
      setShowForm(false);

      // Reload measurements
      loadMeasurements();
    } catch (error) {
      console.error('Failed to save measurement:', error);
      alert('Failed to save measurement. Please try again.');
    }
  };

  const handleDelete = async (measurementId) => {
    if (!confirm('Are you sure you want to delete this measurement?')) {
      return;
    }

    try {
      await axios.delete(`/api/measurements/${measurementId}`);
      loadMeasurements();
    } catch (error) {
      console.error('Failed to delete measurement:', error);
      alert('Failed to delete measurement. Please try again.');
    }
  };

  const getDisplayLabel = (measurement) => {
    if (measurement.measurement_type === 'custom') {
      return measurement.custom_label;
    }
    return MEASUREMENT_TYPES[measurement.measurement_type]?.label || measurement.measurement_type;
  };

  if (loading && !reptile) {
    return <div className="p-6 text-gray-500">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pb-20 md:pb-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/reptiles/${reptileId}`)}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Measurements
              </h1>
              {reptile && (
                <p className="text-gray-600 dark:text-gray-400">
                  {reptile.name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={20} />
            Add Measurement
          </button>
        </div>

        {/* Add Measurement Form */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Record New Measurement
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Measurement Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Measurement Type
                  </label>
                  <select
                    value={measurementType}
                    onChange={(e) => {
                      setMeasurementType(e.target.value);
                      // Set default unit for the selected type
                      const defaultUnit = MEASUREMENT_TYPES[e.target.value]?.units[0];
                      if (defaultUnit) setUnit(defaultUnit);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {Object.entries(MEASUREMENT_TYPES).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Custom Label (only for custom type) */}
                {measurementType === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Custom Label
                    </label>
                    <input
                      type="text"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      placeholder="e.g., Neck Circumference"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required={measurementType === 'custom'}
                    />
                  </div>
                )}

                {/* Value */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Value
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                {/* Unit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {MEASUREMENT_TYPES[measurementType]?.units.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                {/* Date/Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Measured At
                  </label>
                  <input
                    type="datetime-local"
                    value={measuredAt}
                    onChange={(e) => setMeasuredAt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Any observations or context about this measurement..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Save Measurement
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter by Type
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Measurements</option>
            {Object.entries(MEASUREMENT_TYPES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Measurements List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading measurements...</div>
          ) : measurements.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center border border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400">
                No measurements recorded yet. Click "Add Measurement" to get started!
              </p>
            </div>
          ) : (
            measurements.map((measurement) => (
              <div
                key={measurement.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {getDisplayLabel(measurement)}
                      </h3>
                      <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                        {measurement.value} {measurement.unit}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      {formatDateTime(new Date(measurement.measured_at))}
                    </p>
                    {measurement.notes && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        {measurement.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(measurement.id)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2"
                    title="Delete measurement"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
