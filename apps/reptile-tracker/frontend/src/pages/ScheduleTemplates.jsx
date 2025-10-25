import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Filter,
  Download,
  Upload,
  Copy,
  Edit,
  Trash2,
  CheckCircle,
  Settings,
  Clock,
  Calendar,
  X,
} from 'lucide-react';
import * as api from '../utils/scheduleTemplateApi';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

function ScheduleTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [reptiles, setReptiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [speciesFilter, setSpeciesFilter] = useState('');
  const [ageCategoryFilter, setAgeCategoryFilter] = useState('');
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState('');
  const [includeDefaults, setIncludeDefaults] = useState(true);

  // Apply template modal
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedReptile, setSelectedReptile] = useState('');

  // Import modal
  const [importModalOpen, setImportModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [speciesFilter, ageCategoryFilter, scheduleTypeFilter, includeDefaults]);

  async function loadData() {
    try {
      setLoading(true);
      const [templatesData, reptilesData] = await Promise.all([
        api.listScheduleTemplates({
          species: speciesFilter || undefined,
          age_category: ageCategoryFilter || undefined,
          schedule_type: scheduleTypeFilter || undefined,
          include_defaults: includeDefaults,
        }),
        axios.get(`${API_BASE_URL}/api/reptiles`, { withCredentials: true }),
      ]);

      setTemplates(templatesData);
      setReptiles(reptilesData.data);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load schedule templates');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    try {
      const data = await api.exportScheduleTemplates();
      const filename = `schedule-templates-${new Date().toISOString().split('T')[0]}.json`;
      api.downloadJSON(data, filename);
    } catch (error) {
      console.error('Error exporting templates:', error);
      alert('Failed to export templates');
    }
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const jsonData = await api.parseJSONFile(file);
      await api.importScheduleTemplates(jsonData);
      alert(`Successfully imported ${jsonData.templates?.length || 0} templates`);
      setImportModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error importing templates:', error);
      alert('Failed to import templates. Please check the file format.');
    }
  }

  async function handleDuplicate(templateId) {
    try {
      const newTemplate = await api.duplicateScheduleTemplate(templateId);
      alert('Template duplicated successfully! You can now customize it.');
      loadData();
    } catch (error) {
      console.error('Error duplicating template:', error);
      alert('Failed to duplicate template');
    }
  }

  async function handleDelete(templateId, templateName) {
    if (!confirm(`Are you sure you want to delete "${templateName}"?`)) return;

    try {
      await api.deleteScheduleTemplate(templateId);
      alert('Template deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert(error.response?.data?.detail || 'Failed to delete template');
    }
  }

  function openApplyModal(template) {
    setSelectedTemplate(template);
    setSelectedReptile('');
    setApplyModalOpen(true);
  }

  async function handleApplyTemplate() {
    if (!selectedReptile) {
      alert('Please select a reptile');
      return;
    }

    try {
      await api.applyTemplateToReptile(selectedTemplate.id, selectedReptile);
      alert('Schedule created successfully!');
      setApplyModalOpen(false);
      navigate('/calendar');
    } catch (error) {
      console.error('Error applying template:', error);
      alert(error.response?.data?.detail || 'Failed to apply template');
    }
  }

  function formatScheduleRule(template) {
    switch (template.schedule_rule) {
      case 'every_x_days':
        return `Every ${template.frequency_days} days`;
      case 'days_of_week':
        const days = template.days_of_week?.split(',').map(d => {
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          return dayNames[parseInt(d)];
        }).join(', ');
        return days || 'Days of week';
      case 'monthly':
        return `Monthly (day ${template.day_of_month})`;
      default:
        return template.schedule_rule;
    }
  }

  function getTypeColor(type) {
    const colors = {
      feeding: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
      misting: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      weighing: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
      supplement: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    };
    return colors[type] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }

  // Get unique species and age categories from templates
  const uniqueSpecies = [...new Set(templates.map(t => t.species).filter(Boolean))];
  const uniqueAgeCategories = [...new Set(templates.map(t => t.age_category).filter(Boolean))];

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Schedule Templates
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Reusable schedule recommendations based on species and age
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => navigate('/schedule-templates/new')}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Create Template
        </button>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Filter size={20} />
          Filters
        </button>

        <button
          onClick={handleExport}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Download size={20} />
          Export
        </button>

        <button
          onClick={() => setImportModalOpen(true)}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Upload size={20} />
          Import
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Species
              </label>
              <select
                value={speciesFilter}
                onChange={(e) => setSpeciesFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">All Species</option>
                {uniqueSpecies.map(species => (
                  <option key={species} value={species}>{species}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Age Category
              </label>
              <select
                value={ageCategoryFilter}
                onChange={(e) => setAgeCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">All Ages</option>
                <option value="hatchling">Hatchling</option>
                <option value="juvenile">Juvenile</option>
                <option value="adult">Adult</option>
                <option value="senior">Senior</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Schedule Type
              </label>
              <select
                value={scheduleTypeFilter}
                onChange={(e) => setScheduleTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">All Types</option>
                <option value="feeding">Feeding</option>
                <option value="misting">Misting</option>
                <option value="weighing">Weighing</option>
                <option value="supplement">Supplement</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeDefaults}
                  onChange={(e) => setIncludeDefaults(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Include Defaults
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Templates List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">No schedule templates found</p>
          <button
            onClick={() => navigate('/schedule-templates/new')}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg inline-flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            Create Your First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <div
              key={template.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {template.name}
                    {template.is_default && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded">
                        Default
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded ${getTypeColor(template.schedule_type)}`}>
                      {template.schedule_type}
                    </span>
                    {template.species && (
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                        {template.species}
                      </span>
                    )}
                    {template.age_category && (
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                        {template.age_category}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              {template.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {template.description}
                </p>
              )}

              {/* Schedule Details */}
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Calendar size={16} />
                  <span>{formatScheduleRule(template)}</span>
                </div>

                {template.time_window_enabled && (
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Clock size={16} />
                    <span>
                      {template.earliest_time} - {template.latest_time}
                    </span>
                  </div>
                )}

                {template.food_category && (
                  <div className="text-gray-600 dark:text-gray-400">
                    Food: {template.food_category}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => openApplyModal(template)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors font-medium"
                >
                  <CheckCircle size={16} />
                  Use
                </button>

                <button
                  onClick={() => handleDuplicate(template.id)}
                  className="bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-lg transition-colors"
                  title="Duplicate & Customize"
                >
                  <Copy size={16} />
                </button>

                {!template.is_default && (
                  <>
                    <button
                      onClick={() => navigate(`/schedule-templates/edit/${template.id}`)}
                      className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>

                    <button
                      onClick={() => handleDelete(template.id, template.name)}
                      className="bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Apply Template Modal */}
      {applyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Apply Template to Reptile
              </h2>
              <button
                onClick={() => setApplyModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Creating schedule from: <strong>{selectedTemplate?.name}</strong>
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Reptile
              </label>
              <select
                value={selectedReptile}
                onChange={(e) => setSelectedReptile(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Choose a reptile...</option>
                {reptiles.map(reptile => (
                  <option key={reptile.id} value={reptile.id}>
                    {reptile.name} ({reptile.species})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleApplyTemplate}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Create Schedule
              </button>
              <button
                onClick={() => setApplyModalOpen(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Import Templates
              </h2>
              <button
                onClick={() => setImportModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Select a JSON file to import schedule templates.
            </p>

            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-800"
            />

            <button
              onClick={() => setImportModalOpen(false)}
              className="mt-4 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScheduleTemplates;
