import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const NotificationTemplatesTab = () => {
  const [templates, setTemplates] = useState([]);
  const [reptiles, setReptiles] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // Accordion state for collapsible sections
  const [expandedGroups, setExpandedGroups] = useState({});
  const [systemTemplatesExpanded, setSystemTemplatesExpanded] = useState(true);
  const [customGroupsExpanded, setCustomGroupsExpanded] = useState({});
  const [helpSectionExpanded, setHelpSectionExpanded] = useState(false);

  // Form state
  const [templateName, setTemplateName] = useState('');
  const [triggerType, setTriggerType] = useState('schedule_reminder');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [titleTemplate, setTitleTemplate] = useState('');
  const [channelType, setChannelType] = useState('');
  const [isActive, setIsActive] = useState(true);

  // New filter fields
  const [reptileFilter, setReptileFilter] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState('');
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState('');
  const [foodCategoryFilter, setFoodCategoryFilter] = useState('');
  const [priority, setPriority] = useState(100);
  const [appliesToDescription, setAppliesToDescription] = useState('');
  const [groupId, setGroupId] = useState('');

  // Group form state
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupColor, setGroupColor] = useState('#3B82F6');
  const [groupIcon, setGroupIcon] = useState('');
  const [groupSortOrder, setGroupSortOrder] = useState(0);
  const [groupEnabled, setGroupEnabled] = useState(true);
  const [groupDefaultPriority, setGroupDefaultPriority] = useState(0);
  const [groupIgnoreQuietHours, setGroupIgnoreQuietHours] = useState(false);

  // Discord config state
  const [discordColor, setDiscordColor] = useState('#2E5BFF'); // Default blue
  const [discordIncludeFields, setDiscordIncludeFields] = useState(['scheduled_date', 'schedule_type', 'notes']);
  const [discordFooterText, setDiscordFooterText] = useState('Reptile Tracker');

  // Ref for message template textarea
  const messageTemplateRef = useRef(null);

  useEffect(() => {
    fetchTemplates();
    fetchReptiles();
    fetchSchedules();
    fetchGroups();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/notification-templates/');
      setTemplates(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError('Failed to load notification templates');
    } finally {
      setLoading(false);
    }
  };

  const fetchReptiles = async () => {
    try {
      const response = await axios.get('/api/reptiles/?include_inactive=true');
      setReptiles(response.data);
    } catch (err) {
      console.error('Error fetching reptiles:', err);
    }
  };

  const fetchSchedules = async () => {
    try {
      // Fetch schedules from all reptiles (including inactive ones)
      const reptilesResponse = await axios.get('/api/reptiles/?include_inactive=true');
      const allSchedules = [];

      for (const reptile of reptilesResponse.data) {
        try {
          const schedulesResponse = await axios.get(`/api/schedules/reptile/${reptile.id}`);
          schedulesResponse.data.forEach(schedule => {
            allSchedules.push({
              ...schedule,
              reptile_name: reptile.name
            });
          });
        } catch (err) {
          console.error(`Error fetching schedules for reptile ${reptile.id}:`, err);
        }
      }

      setSchedules(allSchedules);
    } catch (err) {
      console.error('Error fetching schedules:', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await axios.get('/api/template-groups/');
      setGroups(response.data);
    } catch (err) {
      console.error('Error fetching template groups:', err);
    }
  };

  const handleAddGroup = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupDescription('');
    setGroupColor('#3B82F6');
    setGroupIcon('');
    setGroupSortOrder(0);
    setGroupEnabled(true);
    setGroupDefaultPriority(0);
    setGroupIgnoreQuietHours(false);
    setShowGroupModal(true);
  };

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description || '');
    setGroupColor(group.color || '#3B82F6');
    setGroupIcon(group.icon || '');
    setGroupSortOrder(group.sort_order || 0);
    setGroupEnabled(group.enabled !== undefined ? group.enabled : true);
    setGroupDefaultPriority(group.default_priority || 0);
    setGroupIgnoreQuietHours(group.ignore_quiet_hours || false);
    setShowGroupModal(true);
  };

  const handleSaveGroup = async () => {
    try {
      const groupData = {
        name: groupName,
        description: groupDescription,
        color: groupColor,
        icon: groupIcon,
        sort_order: groupSortOrder,
        enabled: groupEnabled,
        default_priority: groupDefaultPriority,
        ignore_quiet_hours: groupIgnoreQuietHours,
      };

      if (editingGroup) {
        await axios.put(`/api/template-groups/${editingGroup.id}`, groupData);
      } else {
        await axios.post('/api/template-groups/', groupData);
      }

      await fetchGroups();
      setShowGroupModal(false);
    } catch (err) {
      console.error('Error saving group:', err);
      setError(err.response?.data?.detail || 'Failed to save group');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!confirm('Are you sure? Templates in this group will not be deleted, but will become ungrouped.')) {
      return;
    }

    try {
      await axios.delete(`/api/template-groups/${groupId}`);
      await fetchGroups();
      await fetchTemplates(); // Refresh templates to update group assignments
    } catch (err) {
      console.error('Error deleting group:', err);
      setError(err.response?.data?.detail || 'Failed to delete group');
    }
  };

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTriggerType('schedule_reminder');
    setMessageTemplate('');
    setTitleTemplate('');
    setChannelType('');
    setIsActive(true);
    // Reset filter fields
    setReptileFilter('');
    setScheduleFilter('');
    setScheduleTypeFilter('');
    setFoodCategoryFilter('');
    setPriority(100);
    setAppliesToDescription('');
    setGroupId('');
    // Reset Discord config to defaults
    setDiscordColor('#2E5BFF');
    setDiscordIncludeFields(['scheduled_date', 'schedule_type', 'notes']);
    setDiscordFooterText('Reptile Tracker');
    setShowModal(true);
  };

  const handleEditTemplate = (template) => {
    // Only allow editing custom templates
    if (template.template_type !== 'custom') {
      alert('System templates cannot be edited');
      return;
    }

    setEditingTemplate(template);
    setTemplateName(template.name);
    setTriggerType(template.trigger_type);
    setMessageTemplate(template.message_template);
    setTitleTemplate(template.title_template || '');
    setChannelType(template.channel_type || '');
    setIsActive(template.is_active);

    // Load filter fields
    setReptileFilter(template.reptile_id ? String(template.reptile_id) : '');
    setScheduleFilter(template.schedule_id ? String(template.schedule_id) : '');
    setScheduleTypeFilter(template.schedule_type_filter || '');
    setFoodCategoryFilter(template.food_category_filter || '');
    setPriority(template.priority || 100);
    setAppliesToDescription(template.applies_to_description || '');
    setGroupId(template.group_id ? String(template.group_id) : '');

    // Load Discord config if present
    if (template.discord_config) {
      // Convert integer color to hex
      const colorInt = template.discord_config.color || 3447003;
      const colorHex = '#' + colorInt.toString(16).padStart(6, '0');
      setDiscordColor(colorHex);
      setDiscordIncludeFields(template.discord_config.include_fields || []);
      setDiscordFooterText(template.discord_config.footer_text || 'Reptile Tracker');
    } else {
      // Reset to defaults
      setDiscordColor('#2E5BFF');
      setDiscordIncludeFields(['scheduled_date', 'schedule_type', 'notes']);
      setDiscordFooterText('Reptile Tracker');
    }

    setShowModal(true);
  };

  const handleSaveTemplate = async () => {
    try {
      const payload = {
        name: templateName.trim(),
        trigger_type: triggerType,
        message_template: messageTemplate.trim(),
        title_template: titleTemplate.trim() || null,
        channel_type: channelType.trim() || null,
        is_active: isActive,
        // Add filter fields
        reptile_id: reptileFilter ? parseInt(reptileFilter) : null,
        schedule_id: scheduleFilter ? parseInt(scheduleFilter) : null,
        schedule_type_filter: scheduleTypeFilter || null,
        food_category_filter: foodCategoryFilter || null,
        priority: priority,
        applies_to_description: appliesToDescription.trim() || null,
        group_id: groupId ? parseInt(groupId) : null
      };

      // Add Discord config if channel type is discord or all channels
      if (channelType === 'discord' || channelType === '') {
        // Convert hex color to integer
        const colorInt = parseInt(discordColor.replace('#', ''), 16);
        payload.discord_config = {
          color: colorInt,
          include_fields: discordIncludeFields,
          footer_text: discordFooterText.trim()
        };
      } else {
        payload.discord_config = null;
      }

      if (editingTemplate) {
        // Update existing
        await axios.patch(
          `/api/notification-templates/${editingTemplate.id}`,
          payload
        );
      } else {
        // Create new
        await axios.post(
          '/api/notification-templates/',
          payload
        );
      }

      setShowModal(false);
      fetchTemplates();
    } catch (err) {
      console.error('Error saving template:', err);
      alert(err.response?.data?.detail || 'Failed to save template');
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await axios.delete(`/api/notification-templates/${templateId}`);
      fetchTemplates();
    } catch (err) {
      console.error('Error deleting template:', err);
      alert(err.response?.data?.detail || 'Failed to delete template');
    }
  };

  const handleCopyTemplate = async (template) => {
    try {
      await axios.post(`/api/notification-templates/${template.id}/copy`);
      fetchTemplates();
      alert('Template copied successfully! You can now edit your custom version.');
    } catch (err) {
      console.error('Error copying template:', err);
      alert(err.response?.data?.detail || 'Failed to copy template');
    }
  };

  const getSampleData = (triggerType) => {
    const baseData = {
      reptile_name: 'Spyro',
      schedule_name: 'Daily Feeding',
      schedule_type: 'feeding',
      emoji: '🍽️',
      time_window: '\nTime window: 12:00 - 18:00',
      time_window_display: '12:00 - 18:00',
      notes: '\nNotes: Offer crickets dusted with calcium',
      scheduled_date: '2025-12-04',
      due_date: '2025-12-04',
      food_category: 'Insects/Worms',
      supplement_name: 'Calcium, Multivitamin',
    };

    if (triggerType === 'overdue_alert') {
      return {
        ...baseData,
        missed_date: '2025-12-03',
      };
    }

    return baseData;
  };

  const renderTemplate = (template, text) => {
    const sampleData = getSampleData(template.trigger_type);

    // Replace variables in the template (supports both {var} and {{var}} formats)
    let rendered = text;
    Object.keys(sampleData).forEach((key) => {
      // Match both single {key} and double {{key}} curly braces
      const regex = new RegExp(`{{?\\s*${key}\\s*}}?`, 'g');
      rendered = rendered.replace(regex, sampleData[key]);
    });

    // Convert markdown to HTML
    // Bold: **text** -> <strong>text</strong>
    rendered = rendered.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text* -> <em>text</em>
    rendered = rendered.replace(/\*(.+?)\*/g, '<em>$1</em>');

    return rendered;
  };

  const handlePreviewTemplate = (template) => {
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  const handleToggleActive = async (template) => {
    // Only allow toggling custom templates
    if (template.template_type !== 'custom') {
      return;
    }

    try {
      await axios.patch(
        `/api/notification-templates/${template.id}`,
        { is_active: !template.is_active }
      );
      fetchTemplates();
    } catch (err) {
      console.error('Error toggling template:', err);
      alert('Failed to toggle template');
    }
  };

  const toggleGroup = (triggerType) => {
    setExpandedGroups(prev => ({
      ...prev,
      [triggerType]: !prev[triggerType]
    }));
  };

  const getReptileName = (reptileId) => {
    const reptile = reptiles.find(r => r.id === reptileId);
    return reptile ? reptile.name : `ID: ${reptileId}`;
  };

  const getScheduleName = (scheduleId) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    return schedule ? `${schedule.name} (${schedule.reptile_name})` : `ID: ${scheduleId}`;
  };

  const renderFilterBadges = (template) => {
    const badges = [];

    if (template.group_id) {
      const group = groups.find(g => g.id === template.group_id);
      if (group) {
        badges.push(
          <span
            key="group"
            className="px-2 py-0.5 text-xs rounded font-medium"
            style={{
              backgroundColor: group.color || '#3B82F6',
              color: '#FFFFFF'
            }}
          >
            {group.icon ? `${group.icon} ` : '📁 '}{group.name}
          </span>
        );
      }
    }

    if (template.reptile_id) {
      badges.push(
        <span key="reptile" className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
          Reptile: {getReptileName(template.reptile_id)}
        </span>
      );
    }

    if (template.schedule_id) {
      badges.push(
        <span key="schedule" className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
          Schedule: {getScheduleName(template.schedule_id)}
        </span>
      );
    }

    if (template.schedule_type_filter) {
      badges.push(
        <span key="type" className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded">
          Type: {template.schedule_type_filter}
        </span>
      );
    }

    if (template.food_category_filter) {
      badges.push(
        <span key="food" className="px-2 py-0.5 text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded">
          Food: {template.food_category_filter}
        </span>
      );
    }

    if (template.priority !== 100) {
      badges.push(
        <span key="priority" className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
          Priority: {template.priority}
        </span>
      );
    }

    return badges;
  };

  const insertVariable = (variable) => {
    const textarea = messageTemplateRef.current;
    if (!textarea) {
      // Fallback if ref is not available
      setMessageTemplate(prev => prev + `{${variable}}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = messageTemplate;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const variableText = `{${variable}}`;

    // Insert variable at cursor position
    const newText = before + variableText + after;
    setMessageTemplate(newText);

    // Set cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + variableText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const availableVariables = {
    schedule_reminder: ['reptile_name', 'schedule_name', 'schedule_type', 'emoji', 'time_window', 'time_window_display', 'notes', 'scheduled_date', 'due_date', 'food_category', 'supplement_name', 'schedule_url'],
    overdue_alert: ['reptile_name', 'schedule_name', 'schedule_type', 'missed_date', 'food_category', 'supplement_name', 'schedule_url'],
    feeding_logged: ['reptile_name', 'user_name', 'food_list'],
    custom: ['reptile_name', 'schedule_name', 'schedule_type', 'emoji', 'time_window', 'time_window_display', 'notes', 'scheduled_date', 'due_date', 'missed_date', 'food_category', 'supplement_name', 'schedule_url']
  };

  const groupedTemplates = {
    system: templates.filter(t => t.template_type === 'system'),
    custom: templates.filter(t => t.template_type === 'custom')
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-900 dark:text-white">Loading templates...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Notification Templates</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Customize notification messages with variables. System templates are read-only.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleAddGroup}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600"
          >
            📁 Manage Groups
          </button>
          <button
            onClick={handleAddTemplate}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            + Add Custom Template
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Help Section */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200">How Template Matching Works</h3>
          <button
            onClick={() => setHelpSectionExpanded(!helpSectionExpanded)}
            className="px-3 py-1 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
          >
            {helpSectionExpanded ? 'Hide' : 'Show'}
          </button>
        </div>

        {helpSectionExpanded && (
          <>
            <p className="text-sm mb-2 mt-3 text-blue-800 dark:text-blue-300">
              When sending a notification, the system finds the <strong>most specific</strong> template that matches:
            </p>
            <ol className="text-sm space-y-1 ml-4 list-decimal text-blue-800 dark:text-blue-300">
              <li>Templates you create take priority over system templates</li>
              <li>More specific filters win (schedule-specific &gt; reptile-specific &gt; type-specific &gt; generic)</li>
              <li>Within same specificity, lower priority number wins</li>
            </ol>

            <div className="mt-3">
              <p className="text-sm font-medium mb-1 text-blue-900 dark:text-blue-200">Examples:</p>
              <ul className="text-sm space-y-1 ml-4 list-disc text-blue-800 dark:text-blue-300">
                <li>Template for "Luna" + "Morning Feeding" = Used only for that specific schedule</li>
                <li>Template for "Luna" + "feeding type" = Used for all of Luna's feeding schedules</li>
                <li>Template for "feeding type" = Used for all feeding schedules (any reptile)</li>
                <li>Generic template = Used when nothing more specific matches</li>
              </ul>
            </div>
          </>
        )}
      </div>

      {/* System Templates */}
      <div className="mb-8">
        <button
          onClick={() => setSystemTemplatesExpanded(!systemTemplatesExpanded)}
          className="w-full flex items-center justify-between p-3 mb-3 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">
              {systemTemplatesExpanded ? '▼' : '▶'}
            </span>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              System Templates
            </h3>
            <span className="px-2 py-0.5 text-xs bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded">
              {groupedTemplates.system.length} templates
            </span>
          </div>
        </button>

        {systemTemplatesExpanded && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              These are default templates. Click "Customize" to create your own editable version.
            </p>
            <div className="space-y-3">
          {groupedTemplates.system.map(template => {
            // Count how many custom templates exist for this trigger type
            const customCount = groupedTemplates.custom.filter(
              t => t.trigger_type === template.trigger_type &&
                   (t.channel_type === template.channel_type || (!t.channel_type && !template.channel_type))
            ).length;

            return (
              <div
                key={template.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{template.name}</h4>
                      <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                        {template.trigger_type.replace('_', ' ')}
                      </span>
                      {template.channel_type && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                          {template.channel_type}
                        </span>
                      )}
                      {customCount > 0 && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                          {customCount} custom {customCount === 1 ? 'version' : 'versions'}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-sm">
                      <div className="text-gray-600 dark:text-gray-400">
                        <strong className="text-gray-900 dark:text-gray-200">Title:</strong> {template.title_template || 'N/A'}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 mt-1">
                        <strong className="text-gray-900 dark:text-gray-200">Message:</strong> {template.message_template}
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex gap-2">
                    <button
                      onClick={() => handlePreviewTemplate(template)}
                      className="px-3 py-1 text-sm rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleCopyTemplate(template)}
                      className="px-3 py-1 text-sm rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800"
                      title="Create a customizable copy of this template"
                    >
                      Customize
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
            </div>
          </>
        )}
      </div>

      {/* Custom Templates */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Custom Templates</h3>
        {groupedTemplates.custom.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 italic">No custom templates yet. Create one to get started!</p>
        ) : (
          <div className="space-y-3">
            {/* Group custom templates by trigger_type */}
            {Object.entries(
              groupedTemplates.custom.reduce((groups, template) => {
                const key = template.trigger_type;
                if (!groups[key]) groups[key] = [];
                groups[key].push(template);
                return groups;
              }, {})
            ).map(([triggerType, templates]) => {
              const isExpanded = expandedGroups[triggerType] !== false; // Default to expanded
              const activeCount = templates.filter(t => t.is_active).length;
              const triggerLabel = triggerType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

              return (
                <div key={triggerType} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(triggerType)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {triggerLabel}
                      </h4>
                      <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                        {templates.length} {templates.length === 1 ? 'template' : 'templates'}
                      </span>
                      {activeCount < templates.length && (
                        <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                          {templates.length - activeCount} inactive
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Group Content */}
                  {isExpanded && (
                    <div className="p-3 space-y-3 bg-white dark:bg-gray-900">
                      {templates.map(template => (
                        <div
                          key={template.id}
                          className={`p-4 border border-gray-200 dark:border-gray-700 rounded ${template.is_active ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900 opacity-60'}`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h5 className="font-semibold text-gray-900 dark:text-white">{template.name}</h5>
                                {template.channel_type && (
                                  <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                                    {template.channel_type}
                                  </span>
                                )}
                                {!template.is_active && (
                                  <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                                    Inactive
                                  </span>
                                )}
                                {renderFilterBadges(template)}
                              </div>
                              {template.applies_to_description && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 italic mt-1">
                                  {template.applies_to_description}
                                </p>
                              )}
                              <div className="mt-2 text-sm">
                                <div className="text-gray-600 dark:text-gray-400">
                                  <strong className="text-gray-900 dark:text-gray-200">Title:</strong> {template.title_template || 'N/A'}
                                </div>
                                <div className="text-gray-600 dark:text-gray-400 mt-1">
                                  <strong className="text-gray-900 dark:text-gray-200">Message:</strong> {template.message_template}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => handlePreviewTemplate(template)}
                                className="px-3 py-1 text-sm rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800"
                              >
                                Preview
                              </button>
                              <button
                                onClick={() => handleToggleActive(template)}
                                className={`px-3 py-1 text-sm rounded ${template.is_active ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-800' : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800'}`}
                              >
                                {template.is_active ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => handleEditTemplate(template)}
                                className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Template Editor Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-200">Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="My Custom Template"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-200">Trigger Type</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="schedule_reminder">Schedule Reminder</option>
                  <option value="overdue_alert">Overdue Alert</option>
                  <option value="feeding_logged">Feeding Logged</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-200">Channel Type (Optional)</label>
                <select
                  value={channelType}
                  onChange={(e) => setChannelType(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">All Channels</option>
                  <option value="discord">Discord Only</option>
                  <option value="pushover">Pushover Only</option>
                  <option value="generic">Generic Webhook Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-200">Group (Optional)</label>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">No Group</option>
                  {groups
                    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
                    .map(g => (
                      <option key={g.id} value={g.id}>
                        {g.icon ? `${g.icon} ` : ''}{g.name}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Organize templates into custom groups for easier management
                </p>
              </div>

              {/* Template Matching Filters */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <h4 className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-200">Template Filters (Optional)</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  Apply this template only to specific reptiles, schedules, or types. More specific filters = higher priority.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Specific Reptile</label>
                    <select
                      value={reptileFilter}
                      onChange={(e) => setReptileFilter(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">All Reptiles</option>
                      {reptiles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Specific Schedule</label>
                    <select
                      value={scheduleFilter}
                      onChange={(e) => setScheduleFilter(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">All Schedules</option>
                      {schedules.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.reptile_name})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Schedule Type Filter</label>
                    <select
                      value={scheduleTypeFilter}
                      onChange={(e) => setScheduleTypeFilter(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">All Schedule Types</option>
                      <option value="feeding">Feeding</option>
                      <option value="misting">Misting</option>
                      <option value="weighing">Weighing</option>
                      <option value="health">Health</option>
                      <option value="supplement">Supplement</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Food Category Filter</label>
                    <select
                      value={foodCategoryFilter}
                      onChange={(e) => setFoodCategoryFilter(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">All Food Categories</option>
                      <option value="insects">Insects/Worms</option>
                      <option value="salad">Salad/Greens</option>
                      <option value="frozen">Frozen Prey (Rodents)</option>
                      <option value="prepared">Prepared Foods</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Priority (Lower = Higher Priority)
                    </label>
                    <input
                      type="number"
                      value={priority}
                      onChange={(e) => setPriority(parseInt(e.target.value) || 100)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      min="0"
                      max="999"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Use to control which template wins when multiple match. Default: 100
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={appliesToDescription}
                      onChange={(e) => setAppliesToDescription(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      placeholder="e.g., 'Urgent alerts for Luna'"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Friendly description of when this template applies
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-200">Title Template</label>
                <input
                  type="text"
                  value={titleTemplate}
                  onChange={(e) => setTitleTemplate(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Schedule Reminder - {reptile_name}"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-200">Message Template</label>
                <textarea
                  ref={messageTemplateRef}
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={4}
                  placeholder="{emoji} Reminder: {schedule_name} for {reptile_name}"
                />
                <div className="mt-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Available variables:</p>
                  <div className="flex flex-wrap gap-1">
                    {availableVariables[triggerType].map(variable => (
                      <button
                        key={variable}
                        onClick={() => insertVariable(variable)}
                        className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-800/40 text-green-800 dark:text-green-200 rounded border border-green-300 dark:border-green-700"
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-900 dark:text-gray-200">
                  Active
                </label>
              </div>

              {/* Discord Configuration */}
              {(channelType === 'discord' || channelType === '') && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <h4 className="text-sm font-medium mb-3 text-gray-900 dark:text-gray-200">Discord Embed Settings (Optional)</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                    Customize how this template appears in Discord. The message template will be used as the embed description.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-200">Embed Color</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={discordColor}
                          onChange={(e) => setDiscordColor(e.target.value)}
                          className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={discordColor}
                          onChange={(e) => setDiscordColor(e.target.value)}
                          className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                          placeholder="#2E5BFF"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-200">Include Fields</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['scheduled_date', 'schedule_type', 'notes', 'time_window', 'food_category', 'missed_date', 'schedule_link'].map(field => (
                          <label key={field} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={discordIncludeFields.includes(field)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setDiscordIncludeFields([...discordIncludeFields, field]);
                                } else {
                                  setDiscordIncludeFields(discordIncludeFields.filter(f => f !== field));
                                }
                              }}
                              className="rounded"
                            />
                            <span>{field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Select which fields to display as structured embed fields below the description
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-200">Footer Text</label>
                      <input
                        type="text"
                        value={discordFooterText}
                        onChange={(e) => setDiscordFooterText(e.target.value)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Reptile Tracker"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!templateName.trim() || !messageTemplate.trim()}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              Template Preview - {previewTemplate.name}
            </h3>

            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                This preview shows how your template will look with sample data.
              </p>
            </div>

            <div className="space-y-4">
              {previewTemplate.title_template && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Title:
                  </label>
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg">
                    <p
                      className="font-semibold text-gray-900 dark:text-white whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: renderTemplate(previewTemplate, previewTemplate.title_template) }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Message:
                </label>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg">
                  <p
                    className="text-gray-900 dark:text-white whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: renderTemplate(previewTemplate, previewTemplate.message_template) }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Template Information:
                </label>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <p><strong>Trigger Type:</strong> {previewTemplate.trigger_type.replace('_', ' ')}</p>
                  {previewTemplate.channel_type && (
                    <p><strong>Channel Type:</strong> {previewTemplate.channel_type}</p>
                  )}
                  <p><strong>Type:</strong> {previewTemplate.template_type === 'system' ? 'System Template' : 'Custom Template'}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Management Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              {editingGroup ? 'Edit Group' : 'Create Group'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-200">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Luna's Templates"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-200">Description (Optional)</label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  rows={2}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="All notification templates for Luna"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-200">Icon (Optional)</label>
                  <input
                    type="text"
                    value={groupIcon}
                    onChange={(e) => setGroupIcon(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="🦎"
                    maxLength={4}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Emoji or symbol</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-200">Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={groupColor}
                      onChange={(e) => setGroupColor(e.target.value)}
                      className="h-10 w-16 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={groupColor}
                      onChange={(e) => setGroupColor(e.target.value)}
                      className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="#3B82F6"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-200">Sort Order</label>
                <input
                  type="number"
                  value={groupSortOrder}
                  onChange={(e) => setGroupSortOrder(parseInt(e.target.value) || 0)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Lower numbers appear first</p>
              </div>

              {/* Group Settings */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <h4 className="text-sm font-medium mb-3 text-gray-900 dark:text-gray-200">Group Settings</h4>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Enabled</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Master on/off switch for all templates in this group</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={groupEnabled}
                      onChange={(e) => setGroupEnabled(e.target.checked)}
                      className="h-5 w-5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Default Priority Modifier</label>
                    <input
                      type="number"
                      value={groupDefaultPriority}
                      onChange={(e) => setGroupDefaultPriority(parseInt(e.target.value) || 0)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Added to each template's priority. Negative values = higher priority. (e.g., -50 for critical alerts)
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ignore Quiet Hours</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Send notifications even during quiet hours</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={groupIgnoreQuietHours}
                      onChange={(e) => setGroupIgnoreQuietHours(e.target.checked)}
                      className="h-5 w-5"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between items-center">
              <div>
                {editingGroup && (
                  <button
                    onClick={() => {
                      handleDeleteGroup(editingGroup.id);
                      setShowGroupModal(false);
                    }}
                    className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded hover:bg-red-700 dark:hover:bg-red-600"
                  >
                    Delete Group
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowGroupModal(false)}
                  className="px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveGroup}
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
                >
                  {editingGroup ? 'Update Group' : 'Create Group'}
                </button>
              </div>
            </div>

            {/* List of Existing Groups */}
            {!editingGroup && groups.length > 0 && (
              <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-medium mb-3 text-gray-900 dark:text-gray-200">Existing Groups</h4>
                <div className="space-y-2">
                  {groups
                    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
                    .map(group => (
                      <div
                        key={group.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: group.color || '#3B82F6' }}
                          />
                          {group.icon && <span className="text-lg">{group.icon}</span>}
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{group.name}</div>
                            {group.description && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">{group.description}</div>
                            )}
                          </div>
                          {!group.enabled && (
                            <span className="text-xs px-2 py-0.5 bg-gray-300 dark:bg-gray-600 rounded text-gray-700 dark:text-gray-300">
                              Disabled
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleEditGroup(group)}
                          className="px-3 py-1 text-sm bg-gray-600 dark:bg-gray-500 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-600"
                        >
                          Edit
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationTemplatesTab;
