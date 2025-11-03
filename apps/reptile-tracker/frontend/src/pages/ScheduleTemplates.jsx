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
  Eye,
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
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [reptiles, setReptiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state - species is now an array for multi-select
  const [speciesFilter, setSpeciesFilter] = useState([]);
  const [ageCategoryFilter, setAgeCategoryFilter] = useState('');
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState('');
  const [includeDefaults, setIncludeDefaults] = useState(true);

  // View template modal
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Apply template modal
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [selectedReptile, setSelectedReptile] = useState('');

  // Import modal
  const [importModalOpen, setImportModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Initialize species filter with household species
    if (reptiles.length > 0 && speciesFilter.length === 0) {
      const householdSpecies = [...new Set(reptiles.map(r => r.species))];
      setSpeciesFilter(householdSpecies);
    }
  }, [reptiles]);

  useEffect(() => {
    // Client-side filtering
    filterTemplates();
  }, [templates, speciesFilter, ageCategoryFilter, scheduleTypeFilter, includeDefaults]);

  async function loadData() {
    try {
      setLoading(true);
      const [templatesData, reptilesData] = await Promise.all([
        api.listScheduleTemplates({}),
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

  function filterTemplates() {
    let filtered = [...templates];

    // Filter by species (multi-select)
    if (speciesFilter.length > 0) {
      filtered = filtered.filter(t =>
        !t.species || speciesFilter.includes(t.species)
      );
    }

    // Filter by age category
    if (ageCategoryFilter) {
      filtered = filtered.filter(t =>
        !t.age_category || t.age_category === ageCategoryFilter
      );
    }

    // Filter by schedule type
    if (scheduleTypeFilter) {
      filtered = filtered.filter(t => t.schedule_type === scheduleTypeFilter);
    }

    // Filter by defaults
    if (!includeDefaults) {
      filtered = filtered.filter(t => !t.is_default);
    }

    setFilteredTemplates(filtered);
  }

  // Group templates by extracting common prefix (source + species + age)
  function groupTemplates(templates) {
    const groups = {};
    const ungrouped = [];

    templates.forEach(template => {
      // Extract group key: "Source - Species Age" or "Source - Species" or just keep individual
      const nameParts = template.name.split(' - ');

      if (nameParts.length >= 3 && template.species) {
        // e.g., "ReptiFiles - Juvenile Bearded Dragon Daily Feeding"
        // Group key: "ReptiFiles - Juvenile Bearded Dragon" or "ReptiFiles - Adult Bearded Dragon"
        const source = nameParts[0];
        const speciesAge = template.age_category
          ? `${template.age_category.charAt(0).toUpperCase() + template.age_category.slice(1)} ${template.species}`
          : template.species;
        const groupKey = `${source} - ${speciesAge}`;

        if (!groups[groupKey]) {
          groups[groupKey] = {
            groupName: groupKey,
            templates: [],
            species: template.species,
            age_category: template.age_category,
            is_default: template.is_default,
          };
        }
        groups[groupKey].templates.push(template);
      } else {
        // Keep individual templates ungrouped (general schedules, etc.)
        ungrouped.push({ templates: [template], groupName: null });
      }
    });

    // Only create groups if there are 2+ templates
    const finalGroups = [];
    Object.values(groups).forEach(group => {
      if (group.templates.length >= 2) {
        finalGroups.push(group);
      } else {
        // If only one template in group, keep it ungrouped
        ungrouped.push({ templates: group.templates, groupName: null });
      }
    });

    return [...finalGroups, ...ungrouped];
  }

  function toggleSpeciesFilter(species) {
    setSpeciesFilter(prev => {
      if (prev.includes(species)) {
        return prev.filter(s => s !== species);
      } else {
        return [...prev, species];
      }
    });
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
      setViewModalOpen(false);
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
      setViewModalOpen(false);
    } catch (error) {
      console.error('Error deleting template:', error);
      alert(error.response?.data?.detail || 'Failed to delete template');
    }
  }

  function openViewModal(template) {
    setSelectedTemplate(template);
    setViewModalOpen(true);
  }

  function openApplyModal() {
    setViewModalOpen(false);
    setSelectedReptile('');
    setApplyModalOpen(true);
  }

  async function handleApplyTemplate() {
    if (!selectedReptile) {
      alert('Please select a reptile');
      return;
    }

    try {
      // Check if this is a grouped template
      if (selectedTemplate.groupName && selectedTemplate.templates) {
        // Apply grouped template - create parent-child relationships
        let parentScheduleId = null;

        for (let i = 0; i < selectedTemplate.templates.length; i++) {
          const template = selectedTemplate.templates[i];
          const response = await api.applyTemplateToReptile(
            template.id,
            selectedReptile,
            parentScheduleId
          );

          // First template becomes the parent
          if (i === 0) {
            parentScheduleId = response.schedule_id;
          }
        }

        alert(`Complete care schedule created successfully! (${selectedTemplate.templates.length} schedules)`);
      } else {
        // Apply single template
        await api.applyTemplateToReptile(selectedTemplate.id, selectedReptile);
        alert('Schedule created successfully!');
      }

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

  function formatTime(timeString) {
    if (!timeString) return '';
    // Convert HH:MM:SS to HH:MM
    const parts = timeString.split(':');
    return `${parts[0]}:${parts[1]}`;
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

  // Get unique species and age categories from all templates
  const allSpecies = [...new Set(templates.map(t => t.species).filter(Boolean))];
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
          Filters {speciesFilter.length > 0 && `(${speciesFilter.length})`}
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
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Species (Multi-Select)
              </label>
              <div className="flex flex-wrap gap-2" key={speciesFilter.join(',')}>
                {allSpecies.map(species => (
                  <button
                    key={species}
                    onClick={() => toggleSpeciesFilter(species)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      speciesFilter.includes(species)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {species}
                  </button>
                ))}
                {speciesFilter.length > 0 && (
                  <button
                    onClick={() => setSpeciesFilter([])}
                    className="px-3 py-1 rounded-lg text-sm font-medium bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
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
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="includeDefaults"
              checked={includeDefaults}
              onChange={(e) => setIncludeDefaults(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="includeDefaults" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Include Default Templates
            </label>
          </div>
        </div>
      )}

      {/* Templates List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : filteredTemplates.length === 0 ? (
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
          {groupTemplates(filteredTemplates).map((group, groupIdx) => (
            <div
              key={group.groupName || `ungrouped-${groupIdx}`}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow"
            >
              {group.groupName ? (
                /* Grouped Template Card */
                <>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        {group.groupName}
                        {group.is_default && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </h3>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {group.species && (
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            {group.species}
                          </span>
                        )}
                        {group.age_category && (
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                            {group.age_category}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                          {group.templates.length} schedules
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* List of schedules in group */}
                  <div className="space-y-2 mb-4">
                    {group.templates.map((template, idx) => (
                      <div key={template.id} className="flex items-start gap-2 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs ${getTypeColor(template.schedule_type)}`}>
                          {template.schedule_type}
                        </span>
                        <div className="flex-1">
                          <div className="text-gray-900 dark:text-gray-100">{template.name.split(' - ').pop()}</div>
                          {template.time_window_enabled && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {formatTime(template.earliest_time)} - {formatTime(template.latest_time)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => {
                        setSelectedTemplate(group);
                        setViewModalOpen(true);
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors font-medium"
                    >
                      <Eye size={16} />
                      View Complete Schedule
                    </button>
                  </div>
                </>
              ) : (
                /* Ungrouped Single Template Card */
                <>
                  {(() => {
                    const template = group.templates[0];
                    return (
                      <>
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
                                {formatTime(template.earliest_time)} - {formatTime(template.latest_time)}
                              </span>
                            </div>
                          )}

                          {template.food_category && (
                            <div className="text-gray-600 dark:text-gray-400">
                              Food: {template.food_category}
                            </div>
                          )}
                        </div>

                        {/* Actions - Only View button */}
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <button
                            onClick={() => openViewModal(template)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors font-medium"
                          >
                            <Eye size={16} />
                            View
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* View Template Modal - Two Column Layout */}
      {viewModalOpen && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            {/* Check if this is a grouped template or single template */}
            {selectedTemplate.groupName ? (
              /* GROUPED TEMPLATE VIEW */
              <>
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {selectedTemplate.groupName}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedTemplate.is_default && (
                        <span className="inline-block text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded">
                          Default Template
                        </span>
                      )}
                      <span className="inline-block text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-2 py-1 rounded">
                        {selectedTemplate.templates.length} Schedules
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewModalOpen(false)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                  {/* Left Column - All Schedules in Group */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                        <Calendar size={18} />
                        Complete Care Schedule
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        This template includes {selectedTemplate.templates.length} coordinated schedules for complete care.
                      </p>
                    </div>

                    {/* List all schedules in the group */}
                    <div className="space-y-3">
                      {selectedTemplate.templates.map((template, idx) => (
                        <div key={template.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded text-xs ${getTypeColor(template.schedule_type)}`}>
                                  {template.schedule_type}
                                </span>
                                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                  {template.name.split(' - ').pop()}
                                </h4>
                              </div>
                              {template.description && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{template.description}</p>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                              <Calendar size={14} />
                              <span className="text-xs">{formatScheduleRule(template)}</span>
                            </div>
                            {template.time_window_enabled && (
                              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                <Clock size={14} />
                                <span className="text-xs">
                                  {formatTime(template.earliest_time)} - {formatTime(template.latest_time)}
                                </span>
                              </div>
                            )}
                            {template.food_category && (
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                Food: {template.food_category}
                              </div>
                            )}
                            {template.notes && (
                              <div className="text-xs text-gray-600 dark:text-gray-400 italic mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                {template.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      {selectedTemplate.species && (
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 text-sm">Species</h3>
                          <span className="inline-block px-3 py-1 rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 text-sm">
                            {selectedTemplate.species}
                          </span>
                        </div>
                      )}
                      {selectedTemplate.age_category && (
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 text-sm">Age Category</h3>
                          <span className="inline-block px-3 py-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 text-sm">
                            {selectedTemplate.age_category}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column - Combined Preview */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 h-fit sticky top-6">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2 text-lg">
                      <Calendar size={20} />
                      Weekly Overview
                    </h3>

                    <div className="space-y-3">
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 border border-blue-200/50 dark:border-blue-700/50">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Schedule Breakdown</div>
                        <div className="space-y-1">
                          {selectedTemplate.templates.map((template, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <div className={`w-2 h-2 rounded-full ${
                                template.schedule_type === 'feeding' ? 'bg-green-500' :
                                template.schedule_type === 'supplement' ? 'bg-yellow-500' :
                                template.schedule_type === 'misting' ? 'bg-blue-500' :
                                template.schedule_type === 'weighing' ? 'bg-purple-500' : 'bg-gray-500'
                              }`}></div>
                              <span className="text-gray-700 dark:text-gray-300">{template.schedule_type}: {formatScheduleRule(template)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-blue-200 dark:border-blue-700">
                        <p className="text-xs text-gray-600 dark:text-gray-400 italic leading-relaxed">
                          When applied to a reptile, all {selectedTemplate.templates.length} schedules will be created as a coordinated care plan. The calendar will show them as a single grouped event for easy management.
                        </p>
                      </div>

                      {/* Example Week View */}
                      <div className="pt-3 border-t border-blue-200 dark:border-blue-700">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Complete care includes:</div>
                        <div className="space-y-2">
                          {selectedTemplate.templates.map((template, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1"></div>
                              <div className="flex-1">
                                <span className="font-medium text-gray-700 dark:text-gray-300">{template.schedule_type}</span>
                                {template.time_window_enabled && (
                                  <span className="text-gray-500 dark:text-gray-400 ml-1">
                                    @ {formatTime(template.earliest_time)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={openApplyModal}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Use Complete Care Template
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* SINGLE TEMPLATE VIEW - Original Structure */
              <>
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {selectedTemplate.name}
                    </h2>
                    {selectedTemplate.is_default && (
                      <span className="inline-block text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded mt-1">
                        Default Template
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setViewModalOpen(false)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                  {/* Left Column - Template Details */}
                  <div className="space-y-4">
                    {/* Description */}
                    {selectedTemplate.description && (
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Description</h3>
                        <p className="text-gray-600 dark:text-gray-400">{selectedTemplate.description}</p>
                      </div>
                    )}

                    {/* Type and Category Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Schedule Type</h3>
                        <span className={`inline-block px-3 py-1 rounded ${getTypeColor(selectedTemplate.schedule_type)}`}>
                          {selectedTemplate.schedule_type}
                        </span>
                      </div>

                      {selectedTemplate.species && (
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Species</h3>
                          <span className="inline-block px-3 py-1 rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            {selectedTemplate.species}
                          </span>
                        </div>
                      )}

                      {selectedTemplate.age_category && (
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Age Category</h3>
                          <span className="inline-block px-3 py-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                            {selectedTemplate.age_category}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Schedule Details */}
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Schedule Rule</h3>
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <Calendar size={16} />
                        <span>{formatScheduleRule(selectedTemplate)}</span>
                      </div>
                    </div>

                    {selectedTemplate.time_window_enabled && (
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Time Window</h3>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <Clock size={16} />
                          <span>
                            {formatTime(selectedTemplate.earliest_time)} - {formatTime(selectedTemplate.latest_time)}
                          </span>
                        </div>
                      </div>
                    )}

                    {selectedTemplate.food_category && (
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Food Category</h3>
                        <p className="text-gray-600 dark:text-gray-400 capitalize">{selectedTemplate.food_category}</p>
                      </div>
                    )}

                    {/* Notes */}
                    {selectedTemplate.notes && (
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Notes</h3>
                        <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{selectedTemplate.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Right Column - Preview Card */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 h-fit sticky top-6">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2 text-lg">
                      <Calendar size={20} />
                      Schedule Preview
                    </h3>

                    <div className="space-y-3">
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 border border-blue-200/50 dark:border-blue-700/50">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Frequency</div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{formatScheduleRule(selectedTemplate)}</div>
                      </div>

                      {selectedTemplate.time_window_enabled && (
                        <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 border border-blue-200/50 dark:border-blue-700/50">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Time Window</div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {formatTime(selectedTemplate.earliest_time)} - {formatTime(selectedTemplate.latest_time)}
                          </div>
                        </div>
                      )}

                      {selectedTemplate.food_category && (
                        <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 border border-blue-200/50 dark:border-blue-700/50">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Food Type</div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100 capitalize">{selectedTemplate.food_category}</div>
                        </div>
                      )}

                      <div className="pt-3 border-t border-blue-200 dark:border-blue-700">
                        <p className="text-xs text-gray-600 dark:text-gray-400 italic leading-relaxed">
                          This schedule will automatically create recurring events in your calendar when applied to a reptile. Events will be generated based on the schedule rule and will include all specified details.
                        </p>
                      </div>

                      {/* Example Preview Days */}
                      <div className="pt-3 border-t border-blue-200 dark:border-blue-700">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Example Schedule:</div>
                        <div className="space-y-2">
                          {['Today', 'Tomorrow', 'In 2 days'].slice(0, selectedTemplate.schedule_rule === 'every_x_days' && selectedTemplate.frequency_days > 1 ? 2 : 3).map((day, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              <span className="text-gray-700 dark:text-gray-300">{day}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {selectedTemplate.time_window_enabled ? formatTime(selectedTemplate.earliest_time) : 'All day'}
                              </span>
                            </div>
                          ))}
                          <div className="text-xs text-gray-500 dark:text-gray-400 italic">and continues...</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons - Full Width at Bottom */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={openApplyModal}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Use Template
                    </button>

                    <button
                      onClick={() => handleDuplicate(selectedTemplate.id)}
                      className="bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <Copy size={16} />
                      Duplicate
                    </button>

                    <button
                      onClick={() => navigate(`/schedule-templates/edit/${selectedTemplate.id}`)}
                      className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <Edit size={16} />
                      Edit
                    </button>

                    {!selectedTemplate.is_default && (
                      <button
                        onClick={() => handleDelete(selectedTemplate.id, selectedTemplate.name)}
                        className="bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Apply Template Modal */}
      {applyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {selectedTemplate?.groupName ? 'Apply Complete Care Template' : 'Apply Template to Reptile'}
              </h2>
              <button
                onClick={() => setApplyModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            {selectedTemplate?.groupName ? (
              /* Grouped Template Info */
              <div className="mb-4">
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  Creating complete care schedule: <strong>{selectedTemplate.groupName}</strong>
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                    This will create {selectedTemplate.templates.length} coordinated schedules:
                  </p>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    {selectedTemplate.templates.map((template, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        <span>{template.schedule_type}: {template.name.split(' - ').pop()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              /* Single Template Info */
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Creating schedule from: <strong>{selectedTemplate?.name}</strong>
              </p>
            )}

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
                {selectedTemplate?.groupName ? 'Create Complete Schedule' : 'Create Schedule'}
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
