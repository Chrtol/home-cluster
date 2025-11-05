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
  ExternalLink,
  ChevronDown,
  ChevronUp,
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
  const [selectedAgeCategory, setSelectedAgeCategory] = useState('');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState(new Set());
  const [expandedTemplates, setExpandedTemplates] = useState(new Set());
  const [templateEdits, setTemplateEdits] = useState({});

  // Import modal
  const [importModalOpen, setImportModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Initialize species filter with household species (matched to template species for case consistency)
    if (templates.length > 0 && reptiles.length > 0 && speciesFilter.length === 0) {
      const householdSpecies = [...new Set(reptiles.map(r => r.species.toLowerCase()))];
      const allTemplateSpecies = [...new Set(templates.map(t => t.species).filter(Boolean))];

      // Find template species that match household species (case-insensitive)
      const matchedSpecies = allTemplateSpecies.filter(templateSpecies =>
        householdSpecies.includes(templateSpecies.toLowerCase())
      );

      setSpeciesFilter(matchedSpecies);
    }
  }, [templates, reptiles]);

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

    // Filter by species (multi-select) - case-insensitive
    if (speciesFilter.length > 0) {
      const lowerCaseFilters = speciesFilter.map(s => s.toLowerCase());
      filtered = filtered.filter(t =>
        !t.species || lowerCaseFilters.includes(t.species.toLowerCase())
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

  // Super-grouping: Group templates by source + species
  function groupTemplates(templates) {
    const sourceGroups = {};
    const generalTemplates = [];
    const ungrouped = [];

    // First pass: Group species-specific templates and collect general templates
    templates.forEach(template => {
      const nameParts = template.name.split(' - ');

      // Extract source if template follows "Source - ..." pattern
      if (nameParts.length >= 2) {
        const source = nameParts[0].trim();

        if (template.species) {
          // Species-specific template
          const groupKey = `${source} - ${template.species}`;

          if (!sourceGroups[groupKey]) {
            sourceGroups[groupKey] = {
              source: source,
              groupName: groupKey,
              templates: [],
              species: new Set(),
              ageCategories: new Set(),
              scheduleTypes: new Set(),
              is_default: template.is_default,
            };
          }

          sourceGroups[groupKey].templates.push(template);
          sourceGroups[groupKey].species.add(template.species);
          if (template.age_category) sourceGroups[groupKey].ageCategories.add(template.age_category);
          if (template.schedule_type) sourceGroups[groupKey].scheduleTypes.add(template.schedule_type);
        } else {
          // General template (species=None) - save for second pass
          generalTemplates.push({ template, source });
        }
      } else {
        // Templates without a source prefix remain ungrouped
        ungrouped.push({ templates: [template], groupName: null });
      }
    });

    // Second pass: Add general templates to matching species groups
    generalTemplates.forEach(({ template, source }) => {
      let addedToAnyGroup = false;

      if (template.age_category) {
        // Age-based general template (e.g., "Juvenile - Weekly Weighing")
        // Add to ALL species groups that have this age category
        Object.keys(sourceGroups).forEach(groupKey => {
          const group = sourceGroups[groupKey];
          // Add if the group has templates with this age category
          if (group.templates.some(t => t.age_category === template.age_category)) {
            group.templates.push(template);
            group.ageCategories.add(template.age_category);
            if (template.schedule_type) group.scheduleTypes.add(template.schedule_type);
            addedToAnyGroup = true;
          }
        });
      } else {
        // General template with no age (e.g., supplements)
        // Add to all groups with the same source
        Object.keys(sourceGroups).forEach(groupKey => {
          if (sourceGroups[groupKey].source === source) {
            sourceGroups[groupKey].templates.push(template);
            if (template.schedule_type) sourceGroups[groupKey].scheduleTypes.add(template.schedule_type);
            addedToAnyGroup = true;
          }
        });
      }

      // If no species groups exist, create a general group
      if (!addedToAnyGroup) {
        const groupKey = template.age_category
          ? `${source} - ${template.age_category}`
          : `${source} - General`;

        if (!sourceGroups[groupKey]) {
          sourceGroups[groupKey] = {
            source: source,
            groupName: groupKey,
            templates: [],
            species: new Set(),
            ageCategories: new Set(),
            scheduleTypes: new Set(),
            is_default: template.is_default,
          };
        }
        sourceGroups[groupKey].templates.push(template);
        if (template.age_category) sourceGroups[groupKey].ageCategories.add(template.age_category);
        if (template.schedule_type) sourceGroups[groupKey].scheduleTypes.add(template.schedule_type);
      }
    });

    // Convert sets to arrays and sort templates within each group
    const finalGroups = Object.values(sourceGroups).map(group => {
      // Sort templates by: species presence -> age_category -> schedule_type
      group.templates.sort((a, b) => {
        // Sort by species presence (species-specific before general)
        if (a.species && !b.species) return -1;
        if (!a.species && b.species) return 1;
        if (a.species && b.species && a.species !== b.species) {
          return a.species.localeCompare(b.species);
        }

        // Then by age category (null age goes last)
        if (a.age_category && !b.age_category) return -1;
        if (!a.age_category && b.age_category) return 1;
        if (a.age_category && b.age_category && a.age_category !== b.age_category) {
          return a.age_category.localeCompare(b.age_category);
        }

        // Finally by schedule type
        if (a.schedule_type !== b.schedule_type) {
          return a.schedule_type.localeCompare(b.schedule_type);
        }

        return 0;
      });

      return {
        ...group,
        species: Array.from(group.species),
        ageCategories: Array.from(group.ageCategories),
        scheduleTypes: Array.from(group.scheduleTypes),
      };
    });

    // Only create groups if there are 2+ templates from same source
    const validGroups = [];
    finalGroups.forEach(group => {
      if (group.templates.length >= 2) {
        validGroups.push(group);
      } else {
        ungrouped.push({ templates: group.templates, groupName: null });
      }
    });

    return [...validGroups, ...ungrouped];
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
    setSelectedAgeCategory('');

    // Initialize all templates as selected
    if (selectedTemplate.groupName && selectedTemplate.templates) {
      setSelectedTemplateIds(new Set(selectedTemplate.templates.map(t => t.id)));
    } else if (selectedTemplate.id) {
      setSelectedTemplateIds(new Set([selectedTemplate.id]));
    }

    // Reset editing state
    setExpandedTemplates(new Set());
    setTemplateEdits({});

    setApplyModalOpen(true);
  }

  function toggleTemplateSelection(templateId) {
    setSelectedTemplateIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(templateId)) {
        newSet.delete(templateId);
      } else {
        newSet.add(templateId);
      }
      return newSet;
    });
  }

  function toggleTemplateExpansion(templateId) {
    setExpandedTemplates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(templateId)) {
        newSet.delete(templateId);
      } else {
        newSet.add(templateId);
      }
      return newSet;
    });
  }

  function updateTemplateEdit(templateId, field, value) {
    setTemplateEdits(prev => ({
      ...prev,
      [templateId]: {
        ...(prev[templateId] || {}),
        [field]: value
      }
    }));
  }

  async function handleApplyTemplate() {
    if (!selectedReptile) {
      alert('Please select a reptile');
      return;
    }

    if (!selectedAgeCategory && selectedTemplate?.groupName) {
      alert('Please select an age category for your reptile');
      return;
    }

    if (selectedTemplateIds.size === 0) {
      alert('Please select at least one schedule to create');
      return;
    }

    try {
      // Get list of templates to apply based on selected IDs
      let templatesToApply = [];

      if (selectedTemplate.groupName && selectedTemplate.templates) {
        // Grouped template: filter to only selected templates
        templatesToApply = selectedTemplate.templates.filter(t => selectedTemplateIds.has(t.id));
      } else {
        // Single template
        templatesToApply = [selectedTemplate];
      }

      if (templatesToApply.length === 0) {
        alert('No schedules selected');
        return;
      }

      // Create parent-child relationships for multiple schedules
      let parentScheduleId = null;

      for (let i = 0; i < templatesToApply.length; i++) {
        const template = templatesToApply[i];
        const edits = templateEdits[template.id] || {};
        const hasEdits = Object.keys(edits).length > 0;

        let response;

        if (hasEdits) {
          // If there are edits, create schedule directly with custom data
          const scheduleData = {
            reptile_id: parseInt(selectedReptile),
            schedule_name: template.name,
            schedule_type: template.schedule_type,
            schedule_rule: template.schedule_rule,
            enabled: true,
            frequency_days: edits.frequency_days ?? template.frequency_days,
            days_of_week: template.days_of_week,
            day_of_month: template.day_of_month,
            food_category: edits.food_category ?? template.food_category,
            time_slot: template.time_slot,
            health_category: template.health_category,
            supplement: template.supplement,
            time_window_enabled: edits.time_window_enabled ?? template.time_window_enabled,
            earliest_time: edits.earliest_time ?? template.earliest_time,
            latest_time: edits.latest_time ?? template.latest_time,
            reminder_minutes_before: template.reminder_minutes_before,
            notes: edits.notes ?? template.notes,
            parent_schedule_id: parentScheduleId,
          };

          response = await axios.post(`${API_BASE_URL}/api/schedules`, scheduleData, {
            withCredentials: true
          });
        } else {
          // No edits, use the template application API
          response = await api.applyTemplateToReptile(
            template.id,
            selectedReptile,
            parentScheduleId
          );
        }

        // First template becomes the parent
        if (i === 0) {
          parentScheduleId = response.data?.id || response.schedule_id;
        }
      }

      const message = templatesToApply.length > 1
        ? `Successfully created ${templatesToApply.length} schedules!`
        : 'Schedule created successfully!';
      alert(message);

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
        if (template.frequency_days === 1) {
          return 'Daily';
        }
        return `Every ${template.frequency_days} days`;
      case 'days_of_week':
        const days = template.days_of_week?.split(',').map(d => {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          return dayNames[parseInt(d)];
        }).join(', ');
        if (!days) return 'Days of week';
        // If only one day, say "Weekly on [Day]"
        if (days.split(', ').length === 1) {
          return `Weekly on ${days}`;
        }
        return days;
      case 'monthly':
        return `Monthly on day ${template.day_of_month}`;
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

  // Generate 2-week preview for grouped templates
  function generateTwoWeekPreview(templates) {
    const preview = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Generate 14 days
    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);

      const daySchedules = [];

      // Check each template to see if it occurs on this day
      templates.forEach(template => {
        let occurs = false;

        if (template.schedule_rule === 'every_x_days') {
          // For "every X days", check if dayOffset is divisible by frequency
          if (dayOffset % (template.frequency_days || 1) === 0) {
            occurs = true;
          }
        } else if (template.schedule_rule === 'days_of_week' && template.days_of_week) {
          // For specific days of week
          const targetDays = template.days_of_week.split(',').map(d => parseInt(d));
          if (targetDays.includes(date.getDay())) {
            occurs = true;
          }
        } else if (template.schedule_rule === 'monthly' && template.day_of_month) {
          // For monthly schedules
          if (date.getDate() === template.day_of_month) {
            occurs = true;
          }
        }

        if (occurs) {
          daySchedules.push(template);
        }
      });

      // Only include days that have at least one schedule
      if (daySchedules.length > 0) {
        preview.push({
          date: date,
          dateStr: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          schedules: daySchedules,
        });
      }
    }

    return preview;
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
                /* Super-Group Template Card - Source Level */
                <>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                        {group.groupName}
                        {group.is_default && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded">
                            Default
                          </span>
                        )}
                      </h3>
                      <div className="flex flex-wrap gap-2 text-xs mb-3">
                        <span className="px-2 py-1 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 font-medium">
                          {group.templates.length} Templates
                        </span>
                        {group.species.length > 0 && (
                          <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            {group.species.length} Species
                          </span>
                        )}
                        {group.scheduleTypes.length > 0 && (
                          <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                            {group.scheduleTypes.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Summary of covered species */}
                  {group.species.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Covers:</div>
                      <div className="flex flex-wrap gap-1">
                        {group.species.map((species, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {species}
                          </span>
                        ))}
                        {group.ageCategories.map((age, idx) => (
                          <span key={`age-${idx}`} className="px-2 py-0.5 rounded text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            {age}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sample templates preview (first 3) */}
                  <div className="space-y-1 mb-4">
                    {group.templates.slice(0, 3).map((template, idx) => (
                      <div key={template.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <span className={`w-2 h-2 rounded-full ${
                          template.schedule_type === 'feeding' ? 'bg-orange-500' :
                          template.schedule_type === 'supplement' ? 'bg-green-500' :
                          template.schedule_type === 'misting' ? 'bg-blue-500' :
                          template.schedule_type === 'weighing' ? 'bg-purple-500' : 'bg-gray-500'
                        }`}></span>
                        <span className="truncate">{template.name.split(' - ').slice(1).join(' - ')}</span>
                      </div>
                    ))}
                    {group.templates.length > 3 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 italic pl-4">
                        +{group.templates.length - 3} more...
                      </div>
                    )}
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
                      View & Customize
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
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {selectedTemplate.is_default && (
                        <span className="inline-block text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded">
                          Default Template
                        </span>
                      )}
                      <span className="inline-block text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-2 py-1 rounded">
                        {selectedTemplate.templates.length} Schedules
                      </span>
                      {selectedTemplate.templates[0]?.source_url && (
                        <a
                          href={selectedTemplate.templates[0].source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink size={12} />
                          {selectedTemplate.templates[0].source_name || 'View Source'}
                        </a>
                      )}
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

                  {/* Right Column - 2-Week Calendar Preview */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 max-h-[600px] overflow-y-auto">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2 text-lg sticky top-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 pb-2">
                      <Calendar size={20} />
                      2-Week Schedule Preview
                    </h3>

                    <div className="space-y-2">
                      {(() => {
                        const preview = generateTwoWeekPreview(selectedTemplate.templates);

                        if (preview.length === 0) {
                          return (
                            <div className="text-center py-8">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                No scheduled activities in the next 2 weeks
                              </p>
                            </div>
                          );
                        }

                        return preview.slice(0, 10).map((day, idx) => (
                          <div key={idx} className="bg-white/70 dark:bg-gray-800/70 rounded-lg border border-blue-200/50 dark:border-blue-700/50 overflow-hidden">
                            <div className="bg-white/90 dark:bg-gray-800/90 px-3 py-2 border-b border-blue-200/50 dark:border-blue-700/50">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {day.dateStr}
                              </span>
                            </div>
                            <div className="p-3 space-y-2">
                              {day.schedules.map((schedule, schedIdx) => (
                                <div key={schedIdx} className="flex items-start gap-2">
                                  <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                                    schedule.schedule_type === 'feeding' ? 'bg-orange-500' :
                                    schedule.schedule_type === 'supplement' ? 'bg-green-500' :
                                    schedule.schedule_type === 'misting' ? 'bg-blue-500' :
                                    schedule.schedule_type === 'weighing' ? 'bg-purple-500' : 'bg-gray-500'
                                  }`}></div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(schedule.schedule_type)}`}>
                                        {schedule.schedule_type}
                                      </span>
                                      {schedule.time_window_enabled && (
                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                          {formatTime(schedule.earliest_time)}
                                        </span>
                                      )}
                                    </div>
                                    {schedule.food_category && (
                                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                        {schedule.food_category}
                                      </div>
                                    )}
                                    {schedule.name && (
                                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 truncate">
                                        {schedule.name.split(' - ').pop()}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}

                      {generateTwoWeekPreview(selectedTemplate.templates).length > 10 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2 italic">
                          Showing first 10 days with activities...
                        </p>
                      )}
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
                      Customize & Apply Template
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
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {selectedTemplate.is_default && (
                        <span className="inline-block text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded">
                          Default Template
                        </span>
                      )}
                      {selectedTemplate.source_url && (
                        <a
                          href={selectedTemplate.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink size={12} />
                          {selectedTemplate.source_name || 'View Source'}
                        </a>
                      )}
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
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Upcoming Occurrences:</div>
                        <div className="space-y-2">
                          {(() => {
                            const today = new Date();
                            const upcomingDates = [];

                            if (selectedTemplate.schedule_rule === 'every_x_days') {
                              // Show next 3 occurrences for "every X days"
                              for (let i = 0; i < 3; i++) {
                                const date = new Date(today);
                                date.setDate(date.getDate() + (i * (selectedTemplate.frequency_days || 1)));
                                upcomingDates.push(date);
                              }
                            } else if (selectedTemplate.schedule_rule === 'days_of_week' && selectedTemplate.days_of_week) {
                              // Show next 3 matching days of week
                              const targetDays = selectedTemplate.days_of_week.split(',').map(d => parseInt(d));
                              let checkDate = new Date(today);
                              while (upcomingDates.length < 3) {
                                if (targetDays.includes(checkDate.getDay())) {
                                  upcomingDates.push(new Date(checkDate));
                                }
                                checkDate.setDate(checkDate.getDate() + 1);
                              }
                            } else if (selectedTemplate.schedule_rule === 'monthly' && selectedTemplate.day_of_month) {
                              // Show next 3 months
                              for (let i = 0; i < 3; i++) {
                                const date = new Date(today.getFullYear(), today.getMonth() + i, selectedTemplate.day_of_month);
                                if (date >= today) upcomingDates.push(date);
                              }
                            }

                            return upcomingDates.slice(0, 3).map((date, idx) => {
                              const isToday = date.toDateString() === today.toDateString();
                              const isTomorrow = date.toDateString() === new Date(today.getTime() + 86400000).toDateString();
                              const dayStr = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

                              return (
                                <div key={idx} className="flex items-center gap-2 text-sm">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  <span className="text-gray-700 dark:text-gray-300">{dayStr}</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {selectedTemplate.time_window_enabled ? formatTime(selectedTemplate.earliest_time) : 'All day'}
                                  </span>
                                </div>
                              );
                            });
                          })()}
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
                      Customize & Apply
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
                {selectedTemplate?.groupName ? 'Customize & Apply Schedules' : 'Apply Template to Reptile'}
              </h2>
              <button
                onClick={() => setApplyModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            {selectedTemplate?.groupName ? (
              /* Grouped Template - Checkboxes for Selection */
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Select schedules to create from <strong>{selectedTemplate.groupName}</strong>:
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedTemplateIds(new Set(selectedTemplate.templates.map(t => t.id)))}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      All
                    </button>
                    <button
                      onClick={() => setSelectedTemplateIds(new Set())}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      None
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-96 overflow-y-auto">
                  <div className="space-y-2">
                    {selectedTemplate.templates
                      .filter(template => !selectedAgeCategory || !template.age_category || template.age_category === selectedAgeCategory)
                      .map((template) => {
                      const isExpanded = expandedTemplates.has(template.id);
                      const edits = templateEdits[template.id] || {};
                      const displayData = { ...template, ...edits };

                      return (
                        <div
                          key={template.id}
                          className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                        >
                          {/* Header row with checkbox and expand button */}
                          <div className="flex items-start gap-3 p-2 bg-white dark:bg-gray-800">
                            <input
                              type="checkbox"
                              checked={selectedTemplateIds.has(template.id)}
                              onChange={() => toggleTemplateSelection(template.id)}
                              className="mt-1 w-4 h-4 text-green-600 rounded focus:ring-green-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(template.schedule_type)}`}>
                                  {template.schedule_type}
                                </span>
                                <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                  {template.name.split(' - ').slice(1).join(' - ')}
                                </span>
                              </div>
                              {!isExpanded && (
                                <>
                                  {displayData.time_window_enabled && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {formatTime(displayData.earliest_time)} - {formatTime(displayData.latest_time)}
                                    </div>
                                  )}
                                  {displayData.food_category && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {displayData.food_category}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleTemplateExpansion(template.id)}
                              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
                              title="Edit schedule details"
                            >
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                          </div>

                          {/* Expandable editing section */}
                          {isExpanded && (
                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 space-y-3">
                              {/* Time Window */}
                              <div>
                                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  <input
                                    type="checkbox"
                                    checked={displayData.time_window_enabled ?? false}
                                    onChange={(e) => updateTemplateEdit(template.id, 'time_window_enabled', e.target.checked)}
                                    className="w-3 h-3 text-green-600 rounded"
                                  />
                                  Time Window
                                </label>
                                {displayData.time_window_enabled && (
                                  <div className="grid grid-cols-2 gap-2 mt-1">
                                    <input
                                      type="time"
                                      value={displayData.earliest_time || ''}
                                      onChange={(e) => updateTemplateEdit(template.id, 'earliest_time', e.target.value)}
                                      className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                      placeholder="Earliest"
                                    />
                                    <input
                                      type="time"
                                      value={displayData.latest_time || ''}
                                      onChange={(e) => updateTemplateEdit(template.id, 'latest_time', e.target.value)}
                                      className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                      placeholder="Latest"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Food Category (for feeding schedules) */}
                              {template.schedule_type === 'feeding' && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Food Category
                                  </label>
                                  <select
                                    value={displayData.food_category || ''}
                                    onChange={(e) => updateTemplateEdit(template.id, 'food_category', e.target.value)}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                  >
                                    <option value="">Select category...</option>
                                    <option value="insects">Insects</option>
                                    <option value="salad">Salad</option>
                                    <option value="frozen">Frozen</option>
                                    <option value="prepared">Prepared</option>
                                    <option value="mixed">Mixed</option>
                                    <option value="other">Other</option>
                                  </select>
                                </div>
                              )}

                              {/* Notes */}
                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Notes
                                </label>
                                <textarea
                                  value={displayData.notes || ''}
                                  onChange={(e) => updateTemplateEdit(template.id, 'notes', e.target.value)}
                                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                  rows="2"
                                  placeholder="Add any custom notes..."
                                />
                              </div>

                              {/* Frequency (for every_x_days schedules) */}
                              {template.schedule_rule === 'every_x_days' && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Frequency (days)
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={displayData.frequency_days || ''}
                                    onChange={(e) => updateTemplateEdit(template.id, 'frequency_days', parseInt(e.target.value))}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {selectedTemplateIds.size} of {selectedTemplate.templates.length} schedules selected
                </div>
              </div>
            ) : (
              /* Single Template Info */
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Creating schedule from: <strong>{selectedTemplate?.name}</strong>
              </p>
            )}

            <div className="mb-4">
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

            {selectedTemplate?.groupName && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Age Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedAgeCategory}
                  onChange={(e) => {
                    setSelectedAgeCategory(e.target.value);
                    // Filter templates when age changes
                    if (e.target.value && selectedTemplate.templates) {
                      const filtered = selectedTemplate.templates.filter(t =>
                        !t.age_category || t.age_category === e.target.value
                      );
                      setSelectedTemplateIds(new Set(filtered.map(t => t.id)));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select age...</option>
                  <option value="hatchling">Hatchling</option>
                  <option value="juvenile">Juvenile</option>
                  <option value="adult">Adult</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This will filter schedules to match your reptile's age
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleApplyTemplate}
                disabled={selectedTemplateIds.size === 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {selectedTemplate?.groupName
                  ? `Create ${selectedTemplateIds.size} Schedule${selectedTemplateIds.size !== 1 ? 's' : ''}`
                  : 'Create Schedule'}
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
