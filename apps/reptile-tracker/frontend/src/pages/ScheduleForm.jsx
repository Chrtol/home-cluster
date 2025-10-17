import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Save, Clock } from "lucide-react";
import { getUserTimeFormat, getDayNames, getDayNumbers } from "../utils/dateFormatting";

function ScheduleForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const userTimeFormat = getUserTimeFormat();
  const [reptiles, setReptiles] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [schedules, setSchedules] = useState([]); // For dependent schedules
  const [loading, setLoading] = useState(false);

  // Form state
  const [reptileId, setReptileId] = useState("");
  const [name, setName] = useState("");
  const [scheduleType, setScheduleType] = useState("feeding");
  const [scheduleRule, setScheduleRule] = useState("days_of_week");
  const [foodCategory, setFoodCategory] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [healthCategory, setHealthCategory] = useState("");
  const [frequencyDays, setFrequencyDays] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState([]);
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [parentScheduleId, setParentScheduleId] = useState("");
  const [dependentRule, setDependentRule] = useState("every_occurrence");
  const [dependentFrequency, setDependentFrequency] = useState("");
  const [dependentDays, setDependentDays] = useState([]);
  const [supplementId, setSupplementId] = useState("");
  const [notes, setNotes] = useState("");
  const [enabled, setEnabled] = useState(true);

  // Time window fields
  const [timeWindowEnabled, setTimeWindowEnabled] = useState(false);
  const [earliestTime, setEarliestTime] = useState("");
  const [latestTime, setLatestTime] = useState("");
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState("");

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
    fetchReptiles();
    fetchSupplements();
    if (isEditing) {
      fetchScheduleData();
    }
  }, []);

  useEffect(() => {
    if (reptileId) {
      fetchSchedules();
    }
  }, [reptileId]);

  // Update earliestTime string when time picker values change
  useEffect(() => {
    let hour24 = earliestHours;
    if (userTimeFormat === '12h') {
      if (earliestPeriod === 'PM' && earliestHours !== 12) {
        hour24 = earliestHours + 12;
      } else if (earliestPeriod === 'AM' && earliestHours === 12) {
        hour24 = 0;
      }
    }
    const timeString = `${String(hour24).padStart(2, '0')}:${String(earliestMinutes).padStart(2, '0')}`;
    setEarliestTime(timeString);
  }, [earliestHours, earliestMinutes, earliestPeriod, userTimeFormat]);

  // Update latestTime string when time picker values change
  useEffect(() => {
    let hour24 = latestHours;
    if (userTimeFormat === '12h') {
      if (latestPeriod === 'PM' && latestHours !== 12) {
        hour24 = latestHours + 12;
      } else if (latestPeriod === 'AM' && latestHours === 12) {
        hour24 = 0;
      }
    }
    const timeString = `${String(hour24).padStart(2, '0')}:${String(latestMinutes).padStart(2, '0')}`;
    setLatestTime(timeString);
  }, [latestHours, latestMinutes, latestPeriod, userTimeFormat]);

  const fetchScheduleData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/schedules/${id}`);
      const schedule = response.data;

      // Populate form fields with existing schedule data
      setReptileId(schedule.reptile_id);
      setName(schedule.name || "");
      setScheduleType(schedule.schedule_type);
      setScheduleRule(schedule.schedule_rule);
      setFoodCategory(schedule.food_category || "");
      setTimeSlot(schedule.time_slot || "");
      setHealthCategory(schedule.health_category || "");
      setFrequencyDays(schedule.frequency_days || "");
      setDaysOfWeek(schedule.days_of_week ? schedule.days_of_week.split(",").map(Number) : []);
      setDayOfMonth(schedule.day_of_month || "");
      setParentScheduleId(schedule.parent_schedule_id || "");
      setDependentRule(schedule.dependent_rule || "every_occurrence");
      setDependentFrequency(schedule.dependent_frequency || "");
      setDependentDays(schedule.dependent_days ? schedule.dependent_days.split(",").map(Number) : []);
      setSupplementId(schedule.supplement_id || "");
      setNotes(schedule.notes || "");
      setEnabled(schedule.enabled);

      // Time window fields
      setTimeWindowEnabled(schedule.time_window_enabled || false);

      // Parse earliest time
      if (schedule.earliest_time) {
        const [hours, minutes] = schedule.earliest_time.split(':').map(Number);
        if (userTimeFormat === '12h') {
          const period = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours % 12 || 12;
          setEarliestHours(displayHours);
          setEarliestPeriod(period);
        } else {
          setEarliestHours(hours);
        }
        setEarliestMinutes(minutes);
        setEarliestTime(schedule.earliest_time);
      }

      // Parse latest time
      if (schedule.latest_time) {
        const [hours, minutes] = schedule.latest_time.split(':').map(Number);
        if (userTimeFormat === '12h') {
          const period = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours % 12 || 12;
          setLatestHours(displayHours);
          setLatestPeriod(period);
        } else {
          setLatestHours(hours);
        }
        setLatestMinutes(minutes);
        setLatestTime(schedule.latest_time);
      }

      setReminderMinutesBefore(schedule.reminder_minutes_before || "");
    } catch (error) {
      console.error("Error fetching schedule:", error);
      alert("Failed to load schedule data");
      navigate("/calendar");
    } finally {
      setLoading(false);
    }
  };

  const fetchReptiles = async () => {
    try {
      const response = await axios.get("/api/reptiles");
      setReptiles(response.data);
    } catch (error) {
      console.error("Error fetching reptiles:", error);
    }
  };

  const fetchSupplements = async () => {
    try {
      const response = await axios.get("/api/supplements");
      setSupplements(response.data);
    } catch (error) {
      console.error("Error fetching supplements:", error);
    }
  };

  const fetchSchedules = async () => {
    try {
      const response = await axios.get(`/api/schedules/reptile/${reptileId}`);
      // Filter out dependent schedules (can't depend on a dependent schedule)
      // and exclude the current schedule being edited
      const validParentSchedules = response.data.filter(s =>
        s.schedule_rule !== "dependent" && s.id !== parseInt(id)
      );
      setSchedules(validParentSchedules);
    } catch (error) {
      console.error("Error fetching schedules:", error);
    }
  };

  const toggleDayOfWeek = (day) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter(d => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day]);
    }
  };

  const toggleDependentDay = (day) => {
    if (dependentDays.includes(day)) {
      setDependentDays(dependentDays.filter(d => d !== day));
    } else {
      setDependentDays([...dependentDays, day]);
    }
  };

  const handleEarliestHoursChange = (value) => {
    const numValue = parseInt(value) || (userTimeFormat === '12h' ? 12 : 0);
    const maxHours = userTimeFormat === '12h' ? 12 : 23;
    const minHours = userTimeFormat === '12h' ? 1 : 0;
    setEarliestHours(Math.max(minHours, Math.min(maxHours, numValue)));
  };

  const handleEarliestMinutesChange = (value) => {
    const numValue = parseInt(value) || 0;
    setEarliestMinutes(Math.max(0, Math.min(59, numValue)));
  };

  const handleLatestHoursChange = (value) => {
    const numValue = parseInt(value) || (userTimeFormat === '12h' ? 12 : 0);
    const maxHours = userTimeFormat === '12h' ? 12 : 23;
    const minHours = userTimeFormat === '12h' ? 1 : 0;
    setLatestHours(Math.max(minHours, Math.min(maxHours, numValue)));
  };

  const handleLatestMinutesChange = (value) => {
    const numValue = parseInt(value) || 0;
    setLatestMinutes(Math.max(0, Math.min(59, numValue)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const scheduleData = {
        reptile_id: parseInt(reptileId),
        name: name || null,
        schedule_type: scheduleType,
        schedule_rule: scheduleRule,
        enabled,
        notes,
      };

      // Add type-specific fields
      if (scheduleType === "feeding" && foodCategory) {
        scheduleData.food_category = foodCategory;
      }
      if (scheduleType === "misting" && timeSlot) {
        scheduleData.time_slot = timeSlot;
      }
      if (scheduleType === "weighing" && healthCategory) {
        scheduleData.health_category = healthCategory;
      }

      // Add rule-specific fields
      if (scheduleRule === "every_x_days") {
        scheduleData.frequency_days = parseInt(frequencyDays);
      } else if (scheduleRule === "days_of_week") {
        scheduleData.days_of_week = daysOfWeek.sort((a, b) => a - b).join(",");
      } else if (scheduleRule === "monthly") {
        scheduleData.day_of_month = parseInt(dayOfMonth);
      } else if (scheduleRule === "dependent") {
        scheduleData.parent_schedule_id = parseInt(parentScheduleId);
        scheduleData.dependent_rule = dependentRule;

        if (dependentRule === "every_nth") {
          scheduleData.dependent_frequency = parseInt(dependentFrequency);
        } else if (dependentRule === "specific_days") {
          scheduleData.dependent_days = dependentDays.sort((a, b) => a - b).join(",");
        }
      }

      // Add supplement for supplement schedules
      if (scheduleType === "supplement" && supplementId) {
        scheduleData.supplement_id = parseInt(supplementId);
      }

      // Add time window fields
      scheduleData.time_window_enabled = timeWindowEnabled;
      if (timeWindowEnabled) {
        scheduleData.earliest_time = earliestTime || null;
        scheduleData.latest_time = latestTime || null;
        scheduleData.reminder_minutes_before = reminderMinutesBefore ? parseInt(reminderMinutesBefore) : null;
      }

      if (isEditing) {
        await axios.patch(`/api/schedules/${id}`, scheduleData);
      } else {
        await axios.post("/api/schedules", scheduleData);
      }
      navigate("/calendar");
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} schedule:`, error);
      alert(`Error ${isEditing ? 'updating' : 'creating'} schedule. Please check your inputs.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {isEditing ? 'Edit Schedule' : 'Create Schedule'}
        </h1>
        <button
          onClick={() => navigate("/calendar")}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Calendar</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        {/* Reptile Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Reptile *
          </label>
          <select
            value={reptileId}
            onChange={(e) => setReptileId(e.target.value)}
            required
            className="input-field"
          >
            <option value="">Select a reptile</option>
            {reptiles.map((reptile) => (
              <option key={reptile.id} value={reptile.id}>
                {reptile.name}
              </option>
            ))}
          </select>
        </div>

        {/* Schedule Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Schedule Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Morning Insects, Evening Salad"
            className="input-field"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Optional: Give this schedule a friendly name for easy identification
          </p>
        </div>

        {/* Schedule Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Schedule Type *
          </label>
          <select
            value={scheduleType}
            onChange={(e) => setScheduleType(e.target.value)}
            required
            className="input-field"
          >
            <option value="feeding">Feeding</option>
            <option value="misting">Misting</option>
            <option value="weighing">Health</option>
            <option value="supplement">Supplement</option>
          </select>
        </div>

        {/* Food Category (only for feeding schedules) */}
        {scheduleType === "feeding" && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Food Category
            </label>
            <select
              value={foodCategory}
              onChange={(e) => setFoodCategory(e.target.value)}
              className="input-field"
            >
              <option value="">Not specified</option>
              <option value="insects">Insects/Worms</option>
              <option value="salad">Salad/Vegetables</option>
              <option value="frozen">Frozen Prey (Rodents)</option>
              <option value="prepared">Prepared Diet (CGD, Repashy, etc.)</option>
              <option value="mixed">Mixed (Multiple Types)</option>
              <option value="other">Other</option>
            </select>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Optional: Specify what type of food this feeding is for
            </p>
          </div>
        )}

        {/* Time Slot (only for misting schedules) */}
        {scheduleType === "misting" && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Time Slot
            </label>
            <select
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
              className="input-field"
            >
              <option value="">Not specified</option>
              <option value="morning">Morning</option>
              <option value="midday">Midday</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
              <option value="night">Night</option>
            </select>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Optional: Specify the time of day for misting
            </p>
          </div>
        )}

        {/* Health Category (only for health/weighing schedules) */}
        {scheduleType === "weighing" && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Health Activity Type
            </label>
            <select
              value={healthCategory}
              onChange={(e) => setHealthCategory(e.target.value)}
              className="input-field"
            >
              <option value="weight_check">Weight Check</option>
              <option value="bathing">Bathing</option>
              <option value="shedding_check">Shedding Check</option>
              <option value="health_inspection">Health Inspection</option>
            </select>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Specify what type of health activity this schedule is for
            </p>
          </div>
        )}

        {/* Supplement Selection (only for supplement schedules) */}
        {scheduleType === "supplement" && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Supplement
            </label>
            <select
              value={supplementId}
              onChange={(e) => setSupplementId(e.target.value)}
              className="input-field"
            >
              <option value="">Select a supplement (optional)</option>
              {supplements.map((supplement) => (
                <option key={supplement.id} value={supplement.id}>
                  {supplement.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Schedule Rule */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Schedule Rule *
          </label>
          <select
            value={scheduleRule}
            onChange={(e) => setScheduleRule(e.target.value)}
            required
            className="input-field"
          >
            <option value="days_of_week">Specific Days of Week</option>
            <option value="every_x_days">Every X Days</option>
            <option value="monthly">Monthly (Specific Day)</option>
            <option value="dependent">Dependent on Another Schedule</option>
          </select>
        </div>

        {/* Rule-specific fields */}
        {scheduleRule === "every_x_days" && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Frequency (Days) *
            </label>
            <input
              type="number"
              min="1"
              value={frequencyDays}
              onChange={(e) => setFrequencyDays(e.target.value)}
              required
              placeholder="e.g., 3 for every 3 days"
              className="input-field"
            />
          </div>
        )}

        {scheduleRule === "days_of_week" && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Days of Week *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {weekDays.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDayOfWeek(day.value)}
                  className={`px-4 py-3 rounded-lg border-2 transition-all ${
                    daysOfWeek.includes(day.value)
                      ? "border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400"
                      : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary-400"
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {scheduleRule === "monthly" && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Day of Month *
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              required
              placeholder="e.g., 15 for the 15th of each month"
              className="input-field"
            />
          </div>
        )}

        {scheduleRule === "dependent" && (
          <>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Parent Schedule *
              </label>
              <select
                value={parentScheduleId}
                onChange={(e) => setParentScheduleId(e.target.value)}
                required
                className="input-field"
              >
                <option value="">Select a parent schedule</option>
                {schedules.length === 0 ? (
                  <option disabled>No available parent schedules for this reptile</option>
                ) : (
                  schedules.map((schedule) => {
                    // Create a descriptive label
                    let label = `${schedule.schedule_type}`;
                    if (schedule.name) {
                      label += ` - ${schedule.name}`;
                    }
                    if (schedule.schedule_rule === "every_x_days") {
                      label += ` (Every ${schedule.frequency_days} days)`;
                    } else if (schedule.schedule_rule === "days_of_week") {
                      const days = schedule.days_of_week.split(",").map(d => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parseInt(d)]);
                      label += ` (${days.join(", ")})`;
                    } else if (schedule.schedule_rule === "monthly") {
                      label += ` (Day ${schedule.day_of_month} of month)`;
                    }
                    return (
                      <option key={schedule.id} value={schedule.id}>
                        {label}
                      </option>
                    );
                  })
                )}
              </select>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                This schedule will trigger based on occurrences of the parent schedule. Only non-dependent schedules can be parents.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Dependent Rule *
              </label>
              <select
                value={dependentRule}
                onChange={(e) => setDependentRule(e.target.value)}
                required
                className="input-field"
              >
                <option value="every_occurrence">Every Occurrence</option>
                <option value="every_nth">Every Nth Occurrence</option>
                <option value="specific_days">Specific Days of Week</option>
                <option value="once_per_day">Once Per Day (First Occurrence Only)</option>
              </select>
              {dependentRule === "once_per_day" && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Will trigger once per day when the parent schedule occurs. Perfect for daily supplements that should be given with one feeding per day (you choose which feeding when logging).
                </p>
              )}
            </div>

            {dependentRule === "every_nth" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Occurrence Frequency *
                </label>
                <input
                  type="number"
                  min="2"
                  value={dependentFrequency}
                  onChange={(e) => setDependentFrequency(e.target.value)}
                  required
                  placeholder="e.g., 2 for every 2nd occurrence"
                  className="input-field"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Example: "2" means every 2nd feeding, "3" means every 3rd feeding
                </p>
              </div>
            )}

            {dependentRule === "specific_days" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Days of Week *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {weekDays.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDependentDay(day.value)}
                      className={`px-4 py-3 rounded-lg border-2 transition-all ${
                        dependentDays.includes(day.value)
                          ? "border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400"
                          : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary-400"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Only trigger on parent schedule occurrences that fall on these days
                </p>
              </div>
            )}
          </>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows="3"
            placeholder="Add any notes about this schedule..."
            className="input-field"
          />
        </div>

        {/* Time Window Settings */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              id="timeWindowEnabled"
              checked={timeWindowEnabled}
              onChange={(e) => setTimeWindowEnabled(e.target.checked)}
              className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
            />
            <label htmlFor="timeWindowEnabled" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Enable Time Window
            </label>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Set a time range when this activity should be completed. Useful for basking reptiles that need to eat after warming up.
          </p>

          {timeWindowEnabled && (
            <div className="space-y-4 pl-8 border-l-2 border-primary-200 dark:border-primary-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Earliest Time
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={earliestHours}
                      onChange={e => handleEarliestHoursChange(e.target.value)}
                      className="input-field w-20 text-center"
                      min={userTimeFormat === '12h' ? 1 : 0}
                      max={userTimeFormat === '12h' ? 12 : 23}
                      required
                    />
                    <span className="flex items-center text-xl font-bold text-gray-700 dark:text-gray-300">:</span>
                    <input
                      type="number"
                      value={String(earliestMinutes).padStart(2, '0')}
                      onChange={e => handleEarliestMinutesChange(e.target.value)}
                      className="input-field w-20 text-center"
                      min="0"
                      max="59"
                      required
                    />
                    {userTimeFormat === '12h' && (
                      <select
                        value={earliestPeriod}
                        onChange={e => setEarliestPeriod(e.target.value)}
                        className="input-field w-20"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    When the feeding window opens
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Latest Time
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={latestHours}
                      onChange={e => handleLatestHoursChange(e.target.value)}
                      className="input-field w-20 text-center"
                      min={userTimeFormat === '12h' ? 1 : 0}
                      max={userTimeFormat === '12h' ? 12 : 23}
                      required
                    />
                    <span className="flex items-center text-xl font-bold text-gray-700 dark:text-gray-300">:</span>
                    <input
                      type="number"
                      value={String(latestMinutes).padStart(2, '0')}
                      onChange={e => handleLatestMinutesChange(e.target.value)}
                      className="input-field w-20 text-center"
                      min="0"
                      max="59"
                      required
                    />
                    {userTimeFormat === '12h' && (
                      <select
                        value={latestPeriod}
                        onChange={e => setLatestPeriod(e.target.value)}
                        className="input-field w-20"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    When the feeding must be completed by
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reminder (Minutes Before Latest Time)
                </label>
                <input
                  type="number"
                  min="0"
                  value={reminderMinutesBefore}
                  onChange={(e) => setReminderMinutesBefore(e.target.value)}
                  placeholder="e.g., 30"
                  className="input-field"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Optional: Get reminded before the time window closes
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Enabled Toggle */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
          />
          <label htmlFor="enabled" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Enable this schedule
          </label>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => navigate("/calendar")}
            className="px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={20} />
            <span>
              {loading
                ? (isEditing ? "Saving..." : "Creating...")
                : (isEditing ? "Save Changes" : "Create Schedule")
              }
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default ScheduleForm;
