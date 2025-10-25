import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Clock } from 'lucide-react';
import * as api from '../utils/scheduleTemplateApi';
import axios from 'axios';
import { getUserTimeFormat, getDayNames, getDayNumbers } from '../utils/dateFormatting';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

function ScheduleTemplateForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const userTimeFormat = getUserTimeFormat();
  const [supplements, setSupplements] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [species, setSpecies] = useState('');
  const [ageCategory, setAgeCategory] = useState('');
  const [scheduleType, setScheduleType] = useState('feeding');
  const [scheduleRule, setScheduleRule] = useState('days_of_week');
  const [foodCategory, setFoodCategory] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [healthCategory, setHealthCategory] = useState('');
  const [frequencyDays, setFrequencyDays] = useState('');
  const [daysOfWeek, setDaysOfWeek] = useState([]);
  const [dayOfMonth, setDayOfMonth] = useState('');
  const [supplementId, setSupplementId] = useState('');
  const [notes, setNotes] = useState('');

  // Time window fields
  const [timeWindowEnabled, setTimeWindowEnabled] = useState(false);
  const [earliestTime, setEarliestTime] = useState('');
  const [latestTime, setLatestTime] = useState('');
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState('');

  // Time picker state for earliest time
  const [earliestHours, setEarliestHours] = useState(9);
  const [earliestMinutes, setEarliestMinutes] = useState(0);
  const [earliestPeriod, setEarliestPeriod] = useState('AM');

  // Time picker state for latest time
  const [latestHours, setLatestHours] = useState(4);
  const [latestMinutes, setLatestMinutes] = useState(0);
  const [latestPeriod, setLatestPeriod] = useState('PM');

  // Build weekDays array respecting first day of week preference
  const dayNumbers = getDayNumbers();
  const dayNames = getDayNames();
  const weekDays = dayNumbers.map((dayNum, index) => ({
    value: dayNum,
    label: dayNames[index]
  }));

  useEffect(() => {
    fetchSupplements();
    if (isEditing) {
      fetchTemplateData();
    }
  }, []);

  // Update time strings when picker values change
  useEffect(() => {
    let hour24 = earliestHours;
    if (userTimeFormat === '12h') {
      if (earliestPeriod === 'PM' && earliestHours !== 12) {
        hour24 = earliestHours + 12;
      } else if (earliestPeriod === 'AM' && earliestHours === 12) {
        hour24 = 0;
      }
    }
    setEarliestTime(`${String(hour24).padStart(2, '0')}:${String(earliestMinutes).padStart(2, '0')}`);
  }, [earliestHours, earliestMinutes, earliestPeriod, userTimeFormat]);

  useEffect(() => {
    let hour24 = latestHours;
    if (userTimeFormat === '12h') {
      if (latestPeriod === 'PM' && latestHours !== 12) {
        hour24 = latestHours + 12;
      } else if (latestPeriod === 'AM' && latestHours === 12) {
        hour24 = 0;
      }
    }
    setLatestTime(`${String(hour24).padStart(2, '0')}:${String(latestMinutes).padStart(2, '0')}`);
  }, [latestHours, latestMinutes, latestPeriod, userTimeFormat]);

  async function fetchSupplements() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/supplements`, { withCredentials: true });
      setSupplements(response.data);
    } catch (error) {
      console.error('Error fetching supplements:', error);
    }
  }

  async function fetchTemplateData() {
    try {
      setLoading(true);
      const template = await api.getScheduleTemplate(id);

      setName(template.name || '');
      setDescription(template.description || '');
      setSpecies(template.species || '');
      setAgeCategory(template.age_category || '');
      setScheduleType(template.schedule_type || 'feeding');
      setScheduleRule(template.schedule_rule || 'days_of_week');
      setFoodCategory(template.food_category || '');
      setTimeSlot(template.time_slot || '');
      setHealthCategory(template.health_category || '');
      setFrequencyDays(template.frequency_days || '');
      setDaysOfWeek(template.days_of_week ? template.days_of_week.split(',').map(d => parseInt(d)) : []);
      setDayOfMonth(template.day_of_month || '');
      setSupplementId(template.supplement_id || '');
      setNotes(template.notes || '');
      setTimeWindowEnabled(template.time_window_enabled || false);
      setReminderMinutesBefore(template.reminder_minutes_before || '');

      // Parse times
      if (template.earliest_time) {
        parseTimeString(template.earliest_time, 'earliest');
      }
      if (template.latest_time) {
        parseTimeString(template.latest_time, 'latest');
      }
    } catch (error) {
      console.error('Error fetching template:', error);
      alert('Failed to load template');
    } finally {
      setLoading(false);
    }
  }

  function parseTimeString(timeString, type) {
    const [hours, minutes] = timeString.split(':').map(Number);

    if (type === 'earliest') {
      if (userTimeFormat === '12h') {
        if (hours === 0) {
          setEarliestHours(12);
          setEarliestPeriod('AM');
        } else if (hours < 12) {
          setEarliestHours(hours);
          setEarliestPeriod('AM');
        } else if (hours === 12) {
          setEarliestHours(12);
          setEarliestPeriod('PM');
        } else {
          setEarliestHours(hours - 12);
          setEarliestPeriod('PM');
        }
      } else {
        setEarliestHours(hours);
      }
      setEarliestMinutes(minutes);
    } else {
      if (userTimeFormat === '12h') {
        if (hours === 0) {
          setLatestHours(12);
          setLatestPeriod('AM');
        } else if (hours < 12) {
          setLatestHours(hours);
          setLatestPeriod('AM');
        } else if (hours === 12) {
          setLatestHours(12);
          setLatestPeriod('PM');
        } else {
          setLatestHours(hours - 12);
          setLatestPeriod('PM');
        }
      } else {
        setLatestHours(hours);
      }
      setLatestMinutes(minutes);
    }
  }

  function toggleDayOfWeek(day) {
    setDaysOfWeek(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Validation
    if (!name.trim()) {
      alert('Please enter a template name');
      return;
    }

    if (scheduleRule === 'every_x_days' && (!frequencyDays || frequencyDays < 1)) {
      alert('Please enter a valid frequency in days');
      return;
    }

    if (scheduleRule === 'days_of_week' && daysOfWeek.length === 0) {
      alert('Please select at least one day of the week');
      return;
    }

    if (scheduleRule === 'monthly' && (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31)) {
      alert('Please enter a valid day of the month (1-31)');
      return;
    }

    const templateData = {
      name: name.trim(),
      description: description.trim() || null,
      species: species.trim() || null,
      age_category: ageCategory || null,
      schedule_type: scheduleType,
      schedule_rule: scheduleRule,
      food_category: foodCategory || null,
      time_slot: timeSlot || null,
      health_category: healthCategory || null,
      frequency_days: scheduleRule === 'every_x_days' ? parseInt(frequencyDays) : null,
      days_of_week: scheduleRule === 'days_of_week' ? daysOfWeek.sort((a, b) => a - b).join(',') : null,
      day_of_month: scheduleRule === 'monthly' ? parseInt(dayOfMonth) : null,
      supplement_id: supplementId || null,
      notes: notes.trim() || null,
      time_window_enabled: timeWindowEnabled,
      earliest_time: timeWindowEnabled && earliestTime ? earliestTime : null,
      latest_time: timeWindowEnabled && latestTime ? latestTime : null,
      reminder_minutes_before: reminderMinutesBefore ? parseInt(reminderMinutesBefore) : null,
    };

    try {
      setLoading(true);
      if (isEditing) {
        await api.updateScheduleTemplate(id, templateData);
        alert('Template updated successfully!');
      } else {
        await api.createScheduleTemplate(templateData);
        alert('Template created successfully!');
      }
      navigate('/schedule-templates');
    } catch (error) {
      console.error('Error saving template:', error);
      alert(error.response?.data?.detail || 'Failed to save template');
    } finally {
      setLoading(false);
    }
  }

  if (loading && isEditing) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/schedule-templates')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {isEditing ? 'Edit Template' : 'Create Schedule Template'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
            Basic Information
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Template Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Juvenile Bearded Dragon Daily Feeding"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this schedule template..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Species (optional)
              </label>
              <input
                type="text"
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                placeholder="e.g., Bearded Dragon"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Leave empty for general templates
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Age Category (optional)
              </label>
              <select
                value={ageCategory}
                onChange={(e) => setAgeCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">All Ages</option>
                <option value="hatchling">Hatchling</option>
                <option value="juvenile">Juvenile</option>
                <option value="adult">Adult</option>
                <option value="senior">Senior</option>
              </select>
            </div>
          </div>
        </div>

        {/* Schedule Configuration */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
            Schedule Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Schedule Type *
              </label>
              <select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              >
                <option value="feeding">Feeding</option>
                <option value="misting">Misting</option>
                <option value="weighing">Weighing</option>
                <option value="supplement">Supplement</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Schedule Rule *
              </label>
              <select
                value={scheduleRule}
                onChange={(e) => setScheduleRule(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              >
                <option value="days_of_week">Specific Days of Week</option>
                <option value="every_x_days">Every X Days</option>
                <option value="monthly">Monthly (Specific Day)</option>
              </select>
            </div>
          </div>

          {/* Schedule Rule Parameters */}
          {scheduleRule === 'every_x_days' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Frequency (days) *
              </label>
              <input
                type="number"
                value={frequencyDays}
                onChange={(e) => setFrequencyDays(e.target.value)}
                min="1"
                placeholder="e.g., 3"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
            </div>
          )}

          {scheduleRule === 'days_of_week' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Days of Week *
              </label>
              <div className="flex flex-wrap gap-2">
                {weekDays.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDayOfWeek(day.value)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      daysOfWeek.includes(day.value)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {scheduleRule === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Day of Month (1-31) *
              </label>
              <input
                type="number"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                min="1"
                max="31"
                placeholder="e.g., 15"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
            </div>
          )}

          {/* Type-specific fields */}
          {scheduleType === 'feeding' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Food Category
              </label>
              <select
                value={foodCategory}
                onChange={(e) => setFoodCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Not specified</option>
                <option value="insects">Insects</option>
                <option value="salad">Salad</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
          )}

          {scheduleType === 'misting' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Time Slot
              </label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Not specified</option>
                <option value="morning">Morning</option>
                <option value="midday">Midday</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
              </select>
            </div>
          )}

          {scheduleType === 'weighing' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Health Category
              </label>
              <select
                value={healthCategory}
                onChange={(e) => setHealthCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Not specified</option>
                <option value="weight_check">Weight Check</option>
                <option value="bathing">Bathing</option>
                <option value="shedding_check">Shedding Check</option>
              </select>
            </div>
          )}

          {scheduleType === 'supplement' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Supplement
              </label>
              <select
                value={supplementId}
                onChange={(e) => setSupplementId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Select supplement...</option>
                {supplements.map(supplement => (
                  <option key={supplement.id} value={supplement.id}>
                    {supplement.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Time Window */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={timeWindowEnabled}
              onChange={(e) => setTimeWindowEnabled(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
              id="timeWindow"
            />
            <label htmlFor="timeWindow" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Clock size={16} />
              Enable Time Window
            </label>
          </div>

          {timeWindowEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Earliest Time
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={earliestHours}
                    onChange={(e) => setEarliestHours(Math.min(userTimeFormat === '12h' ? 12 : 23, Math.max(userTimeFormat === '12h' ? 1 : 0, parseInt(e.target.value) || 0)))}
                    min={userTimeFormat === '12h' ? '1' : '0'}
                    max={userTimeFormat === '12h' ? '12' : '23'}
                    className="w-16 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center"
                  />
                  <span className="self-center text-gray-600 dark:text-gray-400">:</span>
                  <input
                    type="number"
                    value={earliestMinutes}
                    onChange={(e) => setEarliestMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                    min="0"
                    max="59"
                    className="w-16 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center"
                  />
                  {userTimeFormat === '12h' && (
                    <select
                      value={earliestPeriod}
                      onChange={(e) => setEarliestPeriod(e.target.value)}
                      className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Latest Time
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={latestHours}
                    onChange={(e) => setLatestHours(Math.min(userTimeFormat === '12h' ? 12 : 23, Math.max(userTimeFormat === '12h' ? 1 : 0, parseInt(e.target.value) || 0)))}
                    min={userTimeFormat === '12h' ? '1' : '0'}
                    max={userTimeFormat === '12h' ? '12' : '23'}
                    className="w-16 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center"
                  />
                  <span className="self-center text-gray-600 dark:text-gray-400">:</span>
                  <input
                    type="number"
                    value={latestMinutes}
                    onChange={(e) => setLatestMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                    min="0"
                    max="59"
                    className="w-16 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center"
                  />
                  {userTimeFormat === '12h' && (
                    <select
                      value={latestPeriod}
                      onChange={(e) => setLatestPeriod(e.target.value)}
                      className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reminder (minutes before latest time)
                </label>
                <input
                  type="number"
                  value={reminderMinutesBefore}
                  onChange={(e) => setReminderMinutesBefore(e.target.value)}
                  min="0"
                  placeholder="e.g., 30"
                  className="w-full md:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Save size={20} />
            {loading ? 'Saving...' : (isEditing ? 'Update Template' : 'Create Template')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/schedule-templates')}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default ScheduleTemplateForm;
