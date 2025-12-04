import React, { useState, useEffect } from 'react';
import axios from 'axios';

const NotificationTemplatesTab = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // Form state
  const [templateName, setTemplateName] = useState('');
  const [triggerType, setTriggerType] = useState('schedule_reminder');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [titleTemplate, setTitleTemplate] = useState('');
  const [channelType, setChannelType] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Discord config state
  const [discordColor, setDiscordColor] = useState('#2E5BFF'); // Default blue
  const [discordIncludeFields, setDiscordIncludeFields] = useState(['scheduled_date', 'schedule_type', 'notes']);
  const [discordFooterText, setDiscordFooterText] = useState('Reptile Tracker');

  useEffect(() => {
    fetchTemplates();
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

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTriggerType('schedule_reminder');
    setMessageTemplate('');
    setTitleTemplate('');
    setChannelType('');
    setIsActive(true);
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
        is_active: isActive
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

  const insertVariable = (variable) => {
    setMessageTemplate(prev => prev + `{${variable}}`);
  };

  const availableVariables = {
    schedule_reminder: ['reptile_name', 'schedule_name', 'schedule_type', 'emoji', 'time_window', 'time_window_display', 'notes', 'scheduled_date', 'due_date', 'food_category', 'supplement_name'],
    overdue_alert: ['reptile_name', 'schedule_name', 'schedule_type', 'missed_date', 'food_category', 'supplement_name'],
    feeding_logged: ['reptile_name', 'user_name', 'food_list'],
    custom: ['reptile_name', 'schedule_name', 'schedule_type', 'emoji', 'time_window', 'time_window_display', 'notes', 'scheduled_date', 'due_date', 'missed_date', 'food_category', 'supplement_name']
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
        <button
          onClick={handleAddTemplate}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          + Add Custom Template
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      {/* System Templates */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">System Templates</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          These are default templates. Click "Customize" to create your own editable version.
        </p>
        <div className="space-y-3">
          {groupedTemplates.system.map(template => {
            // Check if user already has a custom version of this template
            const hasCustomVersion = groupedTemplates.custom.some(
              t => t.trigger_type === template.trigger_type &&
                   t.channel_type === template.channel_type
            );

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
                      {hasCustomVersion && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                          Customized
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
                      disabled={hasCustomVersion}
                      className={`px-3 py-1 text-sm rounded ${
                        hasCustomVersion
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800'
                      }`}
                      title={hasCustomVersion ? 'You already have a custom version of this template' : 'Create a customizable copy'}
                    >
                      Customize
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Templates */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Custom Templates</h3>
        {groupedTemplates.custom.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 italic">No custom templates yet. Create one to get started!</p>
        ) : (
          <div className="space-y-3">
            {groupedTemplates.custom.map(template => (
              <div
                key={template.id}
                className={`p-4 border border-gray-200 dark:border-gray-700 rounded ${template.is_active ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900 opacity-60'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{template.name}</h4>
                      <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                        {template.trigger_type.replace('_', ' ')}
                      </span>
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
                        className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
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
                        {['scheduled_date', 'schedule_type', 'notes', 'time_window', 'food_category', 'missed_date'].map(field => (
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
    </div>
  );
};

export default NotificationTemplatesTab;
