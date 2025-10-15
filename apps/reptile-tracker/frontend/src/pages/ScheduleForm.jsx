import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Save } from "lucide-react";

function ScheduleForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
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

  const weekDays = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
  ];

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
      setSchedules(response.data);
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
            <option value="weighing">Weighing</option>
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
              <option value="mixed">Mixed (Insects + Salad)</option>
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
                {schedules.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.schedule_type} - {schedule.schedule_rule}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                This schedule will trigger based on occurrences of the parent schedule
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
