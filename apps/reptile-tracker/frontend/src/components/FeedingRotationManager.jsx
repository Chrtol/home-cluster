import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { getDayNames, getDayNumbers } from '../utils/dateFormatting';

export default function FeedingRotationManager({ reptileId, reptileName }) {
  const [rotations, setRotations] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRotation, setEditingRotation] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    rotation_type: 'supplement',
    supplement_id: '',
    trigger_mode: 'feeding_count',
    every_n_feedings: 2,
    applies_to_category: '',
    counting_mode: 'category_only',
    application_mode: 'any_feeding',
    schedule_days_of_week: [],
    schedule_frequency_days: 7,
    priority: 10,
    enabled: true,
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [reptileId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rotationsRes, supplementsRes] = await Promise.all([
        axios.get(`/api/feeding-rotations/reptile/${reptileId}`),
        axios.get('/api/supplements')
      ]);
      setRotations(rotationsRes.data);
      setSupplements(supplementsRes.data);
    } catch (error) {
      console.error('Error fetching rotation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = async () => {
    try {
      const response = await axios.get(`/api/feeding-rotations/reptile/${reptileId}/preview`, {
        params: { preview_count: 14 } // Show 2 weeks
      });
      setPreview(response.data);
      setShowPreview(true);
    } catch (error) {
      console.error('Error fetching preview:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Prepare data based on trigger mode
      const submitData = {
        ...formData,
        schedule_days_of_week: formData.trigger_mode === 'schedule_based'
          ? formData.schedule_days_of_week.join(',')
          : null
      };

      if (editingRotation) {
        await axios.patch(`/api/feeding-rotations/${editingRotation.id}`, submitData);
      } else {
        await axios.post('/api/feeding-rotations', {
          ...submitData,
          reptile_id: reptileId
        });
      }
      await fetchData();
      resetForm();
    } catch (error) {
      console.error('Error saving rotation:', error);
      alert('Failed to save rotation: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this rotation?')) return;

    try {
      await axios.delete(`/api/feeding-rotations/${id}`);
      await fetchData();
    } catch (error) {
      console.error('Error deleting rotation:', error);
      alert('Failed to delete rotation');
    }
  };

  const handleEdit = (rotation) => {
    setEditingRotation(rotation);
    setFormData({
      rotation_type: rotation.rotation_type,
      supplement_id: rotation.supplement_id || '',
      trigger_mode: rotation.trigger_mode || 'feeding_count',
      every_n_feedings: rotation.every_n_feedings || 2,
      applies_to_category: rotation.applies_to_category || '',
      counting_mode: rotation.counting_mode || 'category_only',
      application_mode: rotation.application_mode,
      schedule_days_of_week: rotation.schedule_days_of_week
        ? rotation.schedule_days_of_week.split(',').map(d => parseInt(d))
        : [],
      schedule_frequency_days: rotation.schedule_frequency_days || 7,
      priority: rotation.priority,
      enabled: rotation.enabled,
      notes: rotation.notes || ''
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingRotation(null);
    setFormData({
      rotation_type: 'supplement',
      supplement_id: '',
      trigger_mode: 'feeding_count',
      every_n_feedings: 2,
      applies_to_category: '',
      counting_mode: 'category_only',
      application_mode: 'any_feeding',
      schedule_days_of_week: [],
      schedule_frequency_days: 7,
      priority: 10,
      enabled: true,
      notes: ''
    });
  };

  const toggleDayOfWeek = (day) => {
    const days = [...formData.schedule_days_of_week];
    const index = days.indexOf(day);
    if (index > -1) {
      days.splice(index, 1);
    } else {
      days.push(day);
      days.sort((a, b) => a - b);
    }
    setFormData({ ...formData, schedule_days_of_week: days });
  };

  const getDayName = (dayNum) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayNum];
  };

  const dayNumbers = getDayNumbers();
  const dayNames = getDayNames(true); // Get short names

  const getPriorityLabel = (priority) => {
    if (priority === 1) return 'Highest';
    if (priority <= 3) return 'High';
    if (priority <= 7) return 'Medium';
    return 'Low';
  };

  const getSupplementName = (supplementId) => {
    const supplement = supplements.find(s => s.id === supplementId);
    return supplement?.name || 'Unknown';
  };

  if (loading) {
    return <div className="text-gray-600 dark:text-gray-400">Loading rotations...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Supplement Rotation</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Automatically apply supplements based on feeding count or schedule
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchPreview}
            className="btn-secondary text-sm"
          >
            Preview
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <Plus size={18} />
            Add Rule
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Rotation Schedule Preview
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Next 2 weeks for {reptileName}
                </p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-4">
              {preview.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No supplements scheduled for the next 2 weeks
                </div>
              ) : (
                <div className="space-y-3">
                  {preview.map((day, idx) => (
                    <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {day.date_display}
                        </span>
                      </div>
                      <div className="p-4 space-y-3">
                        {day.feedings.map((feeding, feedIdx) => (
                          <div key={feedIdx} className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-700">
                                {feeding.food_category}
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                #{feeding.feeding_number}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2 justify-end">
                              {feeding.supplements.map((supplement, suppIdx) => (
                                <span
                                  key={suppIdx}
                                  className="px-3 py-1 rounded-full text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700"
                                >
                                  {supplement.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card mb-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
            {editingRotation ? 'Edit' : 'Add'} Rotation Rule
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Supplement *
                </label>
                <select
                  value={formData.supplement_id}
                  onChange={(e) => setFormData({ ...formData, supplement_id: e.target.value })}
                  required
                  className="input-field"
                >
                  <option value="">Select supplement</option>
                  {supplements.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Trigger Mode *
                </label>
                <select
                  value={formData.trigger_mode}
                  onChange={(e) => setFormData({ ...formData, trigger_mode: e.target.value })}
                  required
                  className="input-field"
                >
                  <option value="feeding_count">Every N Feedings</option>
                  <option value="schedule_based">Specific Days</option>
                </select>
              </div>

              {formData.trigger_mode === 'feeding_count' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Every N Feedings *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.every_n_feedings}
                    onChange={(e) => setFormData({ ...formData, every_n_feedings: parseInt(e.target.value) })}
                    required
                    className="input-field"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Apply supplement every {formData.every_n_feedings} feeding(s)
                  </p>
                </div>
              )}

              {formData.trigger_mode === 'schedule_based' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Days of Week *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {dayNumbers.map((day, index) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDayOfWeek(day)}
                        className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                          formData.schedule_days_of_week.includes(day)
                            ? 'bg-primary-500 border-primary-500 text-white'
                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary-400 dark:hover:border-primary-500'
                        }`}
                      >
                        {dayNames[index]}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {formData.schedule_days_of_week.length === 0
                      ? 'Select at least one day'
                      : `Applies on: ${formData.schedule_days_of_week.map(d => getDayName(d)).join(', ')}`
                    }
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Applies To
                </label>
                <select
                  value={formData.applies_to_category}
                  onChange={(e) => setFormData({ ...formData, applies_to_category: e.target.value })}
                  className="input-field"
                >
                  <option value="">All feedings</option>
                  <option value="insects">Insects only</option>
                  <option value="salad">Salad only</option>
                  <option value="mixed">Mixed only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority *
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  required
                  className="input-field"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Lower number = higher priority (1 = highest)
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input-field"
                rows="2"
              />
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                {editingRotation ? 'Update' : 'Create'} Rotation
              </button>
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rotation List */}
      <div className="space-y-3">
        {rotations.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p className="mb-4">No rotation rules configured</p>
            <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
              <Plus size={18} className="inline mr-2" />
              Add your first rule
            </button>
          </div>
        ) : (
          rotations.map(rotation => (
            <div
              key={rotation.id}
              className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {rotation.supplement?.name}
                    </span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      Priority: {rotation.priority} ({getPriorityLabel(rotation.priority)})
                    </span>
                    {!rotation.enabled && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                        Disabled
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {rotation.trigger_mode === 'schedule_based' ? (
                      <>
                        {rotation.schedule_days_of_week
                          ? rotation.schedule_days_of_week.split(',').map(d => getDayName(parseInt(d))).join(', ')
                          : 'No days selected'
                        }
                      </>
                    ) : (
                      <>
                        Every {rotation.every_n_feedings} feeding{rotation.every_n_feedings > 1 ? 's' : ''}
                      </>
                    )}
                    {rotation.applies_to_category && ` • ${rotation.applies_to_category} only`}
                  </div>

                  {rotation.notes && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      {rotation.notes}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(rotation)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Edit rotation"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(rotation.id)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Delete rotation"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {rotations.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-900 dark:text-blue-300">
            <strong>How it works:</strong> When logging a feeding, the system counts all feedings for {reptileName} and suggests the appropriate supplement based on these rules. If multiple rules trigger, the one with the highest priority (lowest number) is used.
          </p>
        </div>
      )}
    </div>
  );
}
