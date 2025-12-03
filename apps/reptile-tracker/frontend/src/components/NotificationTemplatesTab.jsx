import React, { useState, useEffect } from 'react';
import axios from 'axios';

const NotificationTemplatesTab = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Form state
  const [templateName, setTemplateName] = useState('');
  const [triggerType, setTriggerType] = useState('schedule_reminder');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [titleTemplate, setTitleTemplate] = useState('');
  const [channelType, setChannelType] = useState('');
  const [isActive, setIsActive] = useState(true);

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
    schedule_reminder: ['reptile_name', 'schedule_name', 'schedule_type', 'emoji', 'time_window', 'notes', 'scheduled_date', 'due_date'],
    overdue_alert: ['reptile_name', 'schedule_name', 'schedule_type', 'missed_date'],
    feeding_logged: ['reptile_name', 'user_name', 'food_list'],
    custom: ['reptile_name', 'schedule_name', 'schedule_type', 'emoji', 'time_window', 'notes', 'scheduled_date', 'due_date', 'missed_date']
  };

  const groupedTemplates = {
    system: templates.filter(t => t.template_type === 'system'),
    custom: templates.filter(t => t.template_type === 'custom')
  };

  if (loading) {
    return <div className="p-6 text-center">Loading templates...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Notification Templates</h2>
          <p className="text-gray-600 mt-1">
            Customize notification messages with variables. System templates are read-only.
          </p>
        </div>
        <button
          onClick={handleAddTemplate}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Custom Template
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      {/* System Templates */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3">System Templates</h3>
        <div className="space-y-3">
          {groupedTemplates.system.map(template => (
            <div
              key={template.id}
              className="p-4 border rounded bg-gray-50"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{template.name}</h4>
                    <span className="px-2 py-0.5 text-xs bg-gray-200 rounded">
                      {template.trigger_type.replace('_', ' ')}
                    </span>
                    {template.channel_type && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                        {template.channel_type}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-sm">
                    <div className="text-gray-600">
                      <strong>Title:</strong> {template.title_template || 'N/A'}
                    </div>
                    <div className="text-gray-600 mt-1">
                      <strong>Message:</strong> {template.message_template}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Templates */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Custom Templates</h3>
        {groupedTemplates.custom.length === 0 ? (
          <p className="text-gray-500 italic">No custom templates yet. Create one to get started!</p>
        ) : (
          <div className="space-y-3">
            {groupedTemplates.custom.map(template => (
              <div
                key={template.id}
                className={`p-4 border rounded ${template.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{template.name}</h4>
                      <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                        {template.trigger_type.replace('_', ' ')}
                      </span>
                      {template.channel_type && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                          {template.channel_type}
                        </span>
                      )}
                      {!template.is_active && (
                        <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-sm">
                      <div className="text-gray-600">
                        <strong>Title:</strong> {template.title_template || 'N/A'}
                      </div>
                      <div className="text-gray-600 mt-1">
                        <strong>Message:</strong> {template.message_template}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleToggleActive(template)}
                      className={`px-3 py-1 text-sm rounded ${template.is_active ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                    >
                      {template.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleEditTemplate(template)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
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
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="My Custom Template"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Trigger Type</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="schedule_reminder">Schedule Reminder</option>
                  <option value="overdue_alert">Overdue Alert</option>
                  <option value="feeding_logged">Feeding Logged</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Channel Type (Optional)</label>
                <select
                  value={channelType}
                  onChange={(e) => setChannelType(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="">All Channels</option>
                  <option value="discord">Discord Only</option>
                  <option value="pushover">Pushover Only</option>
                  <option value="generic">Generic Webhook Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Title Template</label>
                <input
                  type="text"
                  value={titleTemplate}
                  onChange={(e) => setTitleTemplate(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Schedule Reminder - {reptile_name}"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Message Template</label>
                <textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  className="w-full p-2 border rounded"
                  rows={4}
                  placeholder="{emoji} Reminder: {schedule_name} for {reptile_name}"
                />
                <div className="mt-2">
                  <p className="text-xs text-gray-600 mb-1">Available variables:</p>
                  <div className="flex flex-wrap gap-1">
                    {availableVariables[triggerType].map(variable => (
                      <button
                        key={variable}
                        onClick={() => insertVariable(variable)}
                        className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 rounded"
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
                <label htmlFor="isActive" className="text-sm font-medium">
                  Active
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={!templateName.trim() || !messageTemplate.trim()}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationTemplatesTab;
