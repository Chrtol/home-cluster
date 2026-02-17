import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Save, Clock, Users, User as UserIcon, ChevronDown, AlertTriangle } from "lucide-react";
import { getUserTimeFormat, getDayNames, getDayNumbers } from "../utils/dateFormatting";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TimePicker } from '@/components/ui/time-picker';
import PageHeader from '../components/PageHeader';

function ScheduleForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const userTimeFormat = getUserTimeFormat();
  const [reptiles, setReptiles] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [schedules, setSchedules] = useState([]); // For dependent schedules
  const [loading, setLoading] = useState(false);

  // Helper function to display friendly channel type names
  const getChannelTypeDisplay = (webhookType) => {
    const typeMap = {
      'in_app': 'In-App',
      'discord': 'Discord',
      'pushover': 'Pushover',
      'generic': 'Generic Webhook'
    };
    return typeMap[webhookType] || webhookType;
  };

  // Form state
  const [reptileId, setReptileId] = useState("");
  const [name, setName] = useState("");
  const [scheduleType, setScheduleType] = useState("feeding");
  const [scheduleMode, setScheduleMode] = useState("fixed");  // "fixed", "interval", or "dependent"
  const [scheduleRule, setScheduleRule] = useState("days_of_week");
  const [foodCategory, setFoodCategory] = useState("__none__");
  const [timeSlot, setTimeSlot] = useState("__none__");
  const [healthCategory, setHealthCategory] = useState("");
  const [healthSubtype, setHealthSubtype] = useState("");
  const [measurementType, setMeasurementType] = useState("");
  const [customMeasurementLabel, setCustomMeasurementLabel] = useState("");
  const [frequencyDays, setFrequencyDays] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState([]);
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [parentScheduleId, setParentScheduleId] = useState("");
  const [dependentRule, setDependentRule] = useState("every_occurrence");
  const [dependentFrequency, setDependentFrequency] = useState("");
  const [dependentDays, setDependentDays] = useState([]);
  const [supplementId, setSupplementId] = useState("__none__");
  const [notes, setNotes] = useState("");
  const [enabled, setEnabled] = useState(true);

  // Requirement mode fields (for flexible quotas - weekly or monthly)
  const [quotaPeriod, setQuotaPeriod] = useState("week");  // "week" or "month"
  const [quotaFrequency, setQuotaFrequency] = useState("");
  const [minDaysBetween, setMinDaysBetween] = useState("");
  const [maxDaysBetween, setMaxDaysBetween] = useState("");
  const [suggestedDays, setSuggestedDays] = useState([]);

  // Time window fields
  const [timeWindowEnabled, setTimeWindowEnabled] = useState(false);
  const [earliestTime, setEarliestTime] = useState("");
  const [latestTime, setLatestTime] = useState("");
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState("");  // Legacy field
  const [reminderTime, setReminderTime] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);

  // Auto-complete settings
  const [autoCompleteEnabled, setAutoCompleteEnabled] = useState(false);
  const [autoCompleteHoursAfter, setAutoCompleteHoursAfter] = useState(2);

  // Flexible completion window settings
  const [flexibleCompletionEnabled, setFlexibleCompletionEnabled] = useState(false);
  const [flexibleCompletionDays, setFlexibleCompletionDays] = useState(2);

  // Notification settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [availableChannels, setAvailableChannels] = useState([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState([]);

  // Smart notification settings (Phase 22)
  const [smartNotificationsOpen, setSmartNotificationsOpen] = useState(false);
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpDelayMinutes, setFollowUpDelayMinutes] = useState(30);

  // Time picker state for earliest time
  const [earliestHours, setEarliestHours] = useState(9);
  const [earliestMinutes, setEarliestMinutes] = useState(0);
  const [earliestPeriod, setEarliestPeriod] = useState('AM');

  // Time picker state for latest time
  const [latestHours, setLatestHours] = useState(4);
  const [latestMinutes, setLatestMinutes] = useState(0);
  const [latestPeriod, setLatestPeriod] = useState('PM');

  // Time picker state for reminder time
  const [reminderHours, setReminderHours] = useState(12);
  const [reminderMinutes, setReminderMinutes] = useState(0);
  const [reminderPeriod, setReminderPeriod] = useState('PM');

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
    fetchAvailableChannels();
    if (isEditing) {
      fetchScheduleData();
    }
  }, []);

  useEffect(() => {
    if (reptileId) {
      fetchSchedules();
    }
  }, [reptileId]);

  // Reset health-specific fields when switching away from health type
  useEffect(() => {
    if (scheduleType !== "health") {
      setHealthSubtype("");
      setMeasurementType("");
      setCustomMeasurementLabel("");
    }
  }, [scheduleType]);

  // Reset custom measurement label when switching away from custom measurement type
  useEffect(() => {
    if (measurementType !== "custom") {
      setCustomMeasurementLabel("");
    }
  }, [measurementType]);

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

  // Update reminderTime string when time picker values change
  useEffect(() => {
    if (!reminderEnabled) {
      setReminderTime("");
      return;
    }

    let hour24 = reminderHours;
    if (userTimeFormat === '12h') {
      if (reminderPeriod === 'PM' && reminderHours !== 12) {
        hour24 = reminderHours + 12;
      } else if (reminderPeriod === 'AM' && reminderHours === 12) {
        hour24 = 0;
      }
    }
    const timeString = `${String(hour24).padStart(2, '0')}:${String(reminderMinutes).padStart(2, '0')}`;
    setReminderTime(timeString);
  }, [reminderHours, reminderMinutes, reminderPeriod, reminderEnabled, userTimeFormat]);

  const fetchScheduleData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/schedules/${id}`);
      const schedule = response.data;

      // Populate form fields with existing schedule data
      setReptileId(schedule.reptile_id);
      setName(schedule.name || "");
      setScheduleType(schedule.schedule_type);
      setScheduleMode(schedule.schedule_mode || "fixed");
      setScheduleRule(schedule.schedule_rule);
      setFoodCategory(schedule.food_category || "__none__");
      setTimeSlot(schedule.time_slot || "__none__");
      setHealthCategory(schedule.health_category || "");
      setHealthSubtype(schedule.health_subtype || "");
      setMeasurementType(schedule.measurement_type || "");
      setCustomMeasurementLabel(schedule.custom_measurement_label || "");

      // Load interval mode fields
      setQuotaPeriod(schedule.quota_period || "week");
      setMinDaysBetween(schedule.min_days_between || "");
      setMaxDaysBetween(schedule.max_days_between || "");
      setSuggestedDays(schedule.suggested_days || []);
      setFrequencyDays(schedule.frequency_days || "");
      setDaysOfWeek(schedule.days_of_week ? schedule.days_of_week.split(",").map(Number) : []);
      setDayOfMonth(schedule.day_of_month || "");
      setParentScheduleId(schedule.parent_schedule_id || "");
      setDependentRule(schedule.dependent_rule || "every_occurrence");
      setDependentFrequency(schedule.dependent_frequency || "");
      setDependentDays(schedule.dependent_days ? schedule.dependent_days.split(",").map(Number) : []);
      setSupplementId(schedule.supplement_id ? String(schedule.supplement_id) : "__none__");
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

      // Parse reminder time (new style - takes precedence)
      if (schedule.reminder_time) {
        setReminderEnabled(true);
        const [hours, minutes] = schedule.reminder_time.split(':').map(Number);
        if (userTimeFormat === '12h') {
          const period = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours % 12 || 12;
          setReminderHours(displayHours);
          setReminderPeriod(period);
        } else {
          setReminderHours(hours);
        }
        setReminderMinutes(minutes);
        setReminderTime(schedule.reminder_time);
      } else {
        setReminderEnabled(false);
        // Keep legacy field for backward compatibility display
        setReminderMinutesBefore(schedule.reminder_minutes_before || "");
      }

      setNotificationsEnabled(schedule.notifications_enabled !== undefined ? schedule.notifications_enabled : false);

      // Load selected channels
      if (schedule.notification_channels) {
        setSelectedChannelIds(schedule.notification_channels.map(ch => ch.id));
      }

      // Auto-complete settings
      setAutoCompleteEnabled(schedule.auto_complete_enabled || false);
      setAutoCompleteHoursAfter(schedule.auto_complete_hours_after || 2);

      // Flexible completion window settings
      setFlexibleCompletionEnabled(schedule.flexible_completion_enabled || false);
      setFlexibleCompletionDays(schedule.flexible_completion_days || 2);

      // Smart notification settings (Phase 22)
      setFollowUpEnabled(schedule.follow_up_enabled || false);
      setFollowUpDelayMinutes(schedule.follow_up_delay_minutes || 30);
      // Open the section if any smart notifications are enabled
      if (schedule.follow_up_enabled) {
        setSmartNotificationsOpen(true);
      }
    } catch (error) {
      console.error("Error fetching schedule:", error);
      toast.error("Failed to load schedule data");
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

  const fetchAvailableChannels = async () => {
    try {
      const response = await axios.get("/api/notification-channels/me");
      // Filter to only show enabled channels (user's own + household-wide)
      const enabled = response.data.filter(channel => channel.enabled);
      setAvailableChannels(enabled);
    } catch (error) {
      console.error("Error fetching notification channels:", error);
      // Silently fail - channels are optional
    }
  };

  const toggleChannelSelection = (channelId) => {
    if (selectedChannelIds.includes(channelId)) {
      setSelectedChannelIds(selectedChannelIds.filter(id => id !== channelId));
    } else {
      setSelectedChannelIds([...selectedChannelIds, channelId]);
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

  const toggleSuggestedDay = (day) => {
    if (suggestedDays.includes(day)) {
      setSuggestedDays(suggestedDays.filter(d => d !== day));
    } else {
      setSuggestedDays([...suggestedDays, day]);
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

  const handleReminderHoursChange = (value) => {
    const numValue = parseInt(value) || (userTimeFormat === '12h' ? 12 : 0);
    const maxHours = userTimeFormat === '12h' ? 12 : 23;
    const minHours = userTimeFormat === '12h' ? 1 : 0;
    setReminderHours(Math.max(minHours, Math.min(maxHours, numValue)));
  };

  const handleReminderMinutesChange = (value) => {
    const numValue = parseInt(value) || 0;
    setReminderMinutes(Math.max(0, Math.min(59, numValue)));
  };

  // Validate that reminder time is within the time window
  const isReminderTimeValid = () => {
    if (!reminderEnabled || !timeWindowEnabled || !earliestTime || !latestTime || !reminderTime) {
      return true; // No validation needed if not all fields are set
    }

    // Compare times as strings (HH:MM format)
    return reminderTime >= earliestTime && reminderTime <= latestTime;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const scheduleData = {
        reptile_id: parseInt(reptileId),
        name: name || null,
        schedule_type: scheduleType,
        schedule_mode: scheduleMode,
        schedule_rule: scheduleMode === "dependent" ? "dependent" : (scheduleMode === "interval" ? null : scheduleRule),
        enabled,
        notes,
      };

      // Add interval mode fields
      if (scheduleMode === "interval") {
        scheduleData.quota_period = quotaPeriod;
        scheduleData.min_days_between = parseInt(minDaysBetween) || null;
        scheduleData.max_days_between = maxDaysBetween ? parseInt(maxDaysBetween) : null;
        scheduleData.suggested_days = suggestedDays.length > 0 ? suggestedDays : null;
      }

      // Add dependent mode fields
      if (scheduleMode === "dependent") {
        scheduleData.parent_schedule_id = parseInt(parentScheduleId);
        scheduleData.dependent_rule = dependentRule;

        if (dependentRule === "every_nth") {
          scheduleData.dependent_frequency = parseInt(dependentFrequency);
        } else if (dependentRule === "specific_days") {
          scheduleData.dependent_days = dependentDays.sort((a, b) => a - b).join(",");
        }
      }

      // Add type-specific fields
      if (scheduleType === "feeding" && foodCategory && foodCategory !== "__none__") {
        scheduleData.food_category = foodCategory;
      }
      if (scheduleType === "misting" && timeSlot && timeSlot !== "__none__") {
        scheduleData.time_slot = timeSlot;
      }
      if (scheduleType === "health") {
        scheduleData.health_subtype = healthSubtype;
        if (healthSubtype === "measurement") {
          scheduleData.measurement_type = measurementType;
          if (measurementType === "custom" && customMeasurementLabel) {
            scheduleData.custom_measurement_label = customMeasurementLabel;
          }
        }
        if (healthSubtype === "health_record" && healthCategory) {
          scheduleData.health_category = healthCategory;
        }
      }

      // Add rule-specific fields
      if (scheduleRule === "every_x_days") {
        scheduleData.frequency_days = parseInt(frequencyDays);
      } else if (scheduleRule === "days_of_week") {
        scheduleData.days_of_week = daysOfWeek.sort((a, b) => a - b).join(",");
      } else if (scheduleRule === "monthly") {
        scheduleData.day_of_month = parseInt(dayOfMonth);
      }

      // Add supplement for supplement schedules
      if (scheduleType === "supplement" && supplementId && supplementId !== "__none__") {
        scheduleData.supplement_id = parseInt(supplementId);
      }

      // Add time window fields
      scheduleData.time_window_enabled = timeWindowEnabled;
      if (timeWindowEnabled) {
        scheduleData.earliest_time = earliestTime || null;
        scheduleData.latest_time = latestTime || null;
      }

      // Add auto-complete settings
      scheduleData.auto_complete_enabled = autoCompleteEnabled;
      scheduleData.auto_complete_hours_after = parseInt(autoCompleteHoursAfter) || 2;

      // Add flexible completion window settings
      scheduleData.flexible_completion_enabled = flexibleCompletionEnabled;
      scheduleData.flexible_completion_days = parseInt(flexibleCompletionDays) || 2;

      // Add notification settings
      scheduleData.notifications_enabled = notificationsEnabled;
      scheduleData.channel_ids = selectedChannelIds;

      // Send reminder_time if enabled (independent of time window)
      if (notificationsEnabled && reminderEnabled && reminderTime) {
        scheduleData.reminder_time = reminderTime;
      } else {
        scheduleData.reminder_time = null;
      }

      // Smart notification settings (Phase 22)
      scheduleData.follow_up_enabled = followUpEnabled;
      scheduleData.follow_up_delay_minutes = followUpEnabled ? parseInt(followUpDelayMinutes) || 30 : null;

      if (isEditing) {
        await axios.patch(`/api/schedules/${id}`, scheduleData);
        toast.success('Schedule updated successfully!');
      } else {
        await axios.post("/api/schedules", scheduleData);
        toast.success('Schedule created successfully!');
      }
      navigate("/calendar");
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} schedule:`, error);
      toast.error(`Error ${isEditing ? 'updating' : 'creating'} schedule. Please check your inputs.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? 'Edit Schedule' : 'Create Schedule'}
        backLink={{ to: '/schedules', label: 'Back to Schedules' }}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Select the reptile and schedule details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Reptile Selection */}
            <div className="space-y-2">
              <Label htmlFor="reptile">Reptile *</Label>
              <Select value={reptileId} onValueChange={setReptileId} required>
                <SelectTrigger id="reptile">
                  <SelectValue placeholder="Select a reptile" />
                </SelectTrigger>
                <SelectContent>
                  {reptiles.map((reptile) => (
                    <SelectItem key={reptile.id} value={String(reptile.id)}>
                      {reptile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Schedule Name */}
            <div className="space-y-2">
              <Label htmlFor="scheduleName">Schedule Name</Label>
              <Input
                id="scheduleName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Morning Insects, Evening Salad"
              />
              <p className="text-sm text-muted-foreground">
                Optional: Give this schedule a friendly name for easy identification
              </p>
            </div>

            {/* Schedule Type */}
            <div className="space-y-2">
              <Label htmlFor="scheduleType">Schedule Type *</Label>
              <Select value={scheduleType} onValueChange={setScheduleType} required>
                <SelectTrigger id="scheduleType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feeding">Feeding</SelectItem>
                  <SelectItem value="misting">Misting</SelectItem>
                  <SelectItem value="health">Health</SelectItem>
                  <SelectItem value="supplement">Supplement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Schedule Mode */}
            <div className="space-y-2">
              <Label>Schedule Mode *</Label>
              <div className="grid grid-cols-3 gap-3">
                <Badge
                  variant={scheduleMode === "fixed" ? "default" : "outline"}
                  className="cursor-pointer justify-center py-3 px-3 h-auto flex-col items-center gap-1"
                  onClick={() => setScheduleMode("fixed")}
                >
                  <div className="font-semibold text-sm">Fixed</div>
                  <div className="text-xs opacity-75">Calendar-based</div>
                </Badge>
                <Badge
                  variant={scheduleMode === "interval" ? "default" : "outline"}
                  className="cursor-pointer justify-center py-3 px-3 h-auto flex-col items-center gap-1"
                  onClick={() => setScheduleMode("interval")}
                >
                  <div className="font-semibold text-sm">Interval</div>
                  <div className="text-xs opacity-75">Time-based</div>
                </Badge>
                <Badge
                  variant={scheduleMode === "dependent" ? "default" : "outline"}
                  className="cursor-pointer justify-center py-3 px-3 h-auto flex-col items-center gap-1"
                  onClick={() => setScheduleMode("dependent")}
                >
                  <div className="font-semibold text-sm">Dependent</div>
                  <div className="text-xs opacity-75">Event-triggered</div>
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {scheduleMode === "fixed"
                  ? "Schedule occurs on specific dates or days of the week"
                  : scheduleMode === "interval"
                  ? "Time interval between events with min/max day constraints (e.g., every 3-4 days)"
                  : "Triggered when another schedule is completed (e.g., weigh after every 3rd feeding)"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Type-specific fields */}
        {scheduleType === "feeding" && (
          <Card>
            <CardHeader>
              <CardTitle>Food Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="foodCategory">Food Category</Label>
                <Select value={foodCategory} onValueChange={setFoodCategory}>
                  <SelectTrigger id="foodCategory">
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not specified</SelectItem>
                    <SelectItem value="insects">Insects/Worms</SelectItem>
                    <SelectItem value="salad">Salad/Vegetables</SelectItem>
                    <SelectItem value="frozen">Frozen Prey (Rodents)</SelectItem>
                    <SelectItem value="prepared">Prepared Diet (CGD, Repashy, etc.)</SelectItem>
                    <SelectItem value="mixed">Mixed (Multiple Types)</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Optional: Specify what type of food this feeding is for
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {scheduleType === "misting" && (
          <Card>
            <CardHeader>
              <CardTitle>Time Slot</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="timeSlot">Time Slot</Label>
                <Select value={timeSlot} onValueChange={setTimeSlot}>
                  <SelectTrigger id="timeSlot">
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not specified</SelectItem>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="midday">Midday</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="evening">Evening</SelectItem>
                    <SelectItem value="night">Night</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Optional: Specify the time of day for misting
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {scheduleType === "health" && (
          <Card>
            <CardHeader>
              <CardTitle>Health Schedule Type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="healthSubtype">Health Type *</Label>
                <Select value={healthSubtype} onValueChange={setHealthSubtype} required>
                  <SelectTrigger id="healthSubtype">
                    <SelectValue placeholder="Select health type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weight">Weight Check</SelectItem>
                    <SelectItem value="measurement">Measurement</SelectItem>
                    <SelectItem value="shedding_check">Shedding Check</SelectItem>
                    <SelectItem value="brumation_check">Brumation Check</SelectItem>
                    <SelectItem value="health_record">Health Record</SelectItem>
                    <SelectItem value="bathing">Bathing</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {healthSubtype === 'weight' && "Scheduled weight check - navigates to weight logging"}
                  {healthSubtype === 'measurement' && "Scheduled measurement - SVL, length, or custom measurement"}
                  {healthSubtype === 'shedding_check' && "Shedding check - asks if reptile is showing shed signs"}
                  {healthSubtype === 'brumation_check' && "Reminder to review/update brumation status"}
                  {healthSubtype === 'health_record' && "General health record - medication, vet visit, observation"}
                  {healthSubtype === 'bathing' && "Scheduled bath time"}
                  {!healthSubtype && "Select the type of health task to schedule"}
                </p>
              </div>

              {/* Secondary selector for measurement type */}
              {healthSubtype === "measurement" && (
                <div className="space-y-2">
                  <Label htmlFor="measurementType">Measurement Type</Label>
                  <Select value={measurementType} onValueChange={setMeasurementType}>
                    <SelectTrigger id="measurementType">
                      <SelectValue placeholder="Select measurement type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SVL">SVL (Snout-Vent Length)</SelectItem>
                      <SelectItem value="total_length">Total Length</SelectItem>
                      <SelectItem value="shell_length">Shell Length</SelectItem>
                      <SelectItem value="humidity">Humidity</SelectItem>
                      <SelectItem value="temp">Temperature</SelectItem>
                      <SelectItem value="custom">Custom Measurement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Custom measurement label - shown when measurement type is custom */}
              {healthSubtype === "measurement" && measurementType === "custom" && (
                <div className="space-y-2">
                  <Label htmlFor="customMeasurementLabel">Custom Measurement Name *</Label>
                  <Input
                    id="customMeasurementLabel"
                    value={customMeasurementLabel}
                    onChange={(e) => setCustomMeasurementLabel(e.target.value)}
                    placeholder="e.g., Head Width, Tail Length, Body Girth"
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    Describe what measurement should be taken (will pre-fill when completing this schedule)
                  </p>
                </div>
              )}

              {/* Secondary selector for health record type */}
              {healthSubtype === "health_record" && (
                <div className="space-y-2">
                  <Label htmlFor="healthCategory">Record Type</Label>
                  <Select value={healthCategory} onValueChange={setHealthCategory}>
                    <SelectTrigger id="healthCategory">
                      <SelectValue placeholder="Select record type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medication">Medication</SelectItem>
                      <SelectItem value="observation">Observation</SelectItem>
                      <SelectItem value="vet_visit">Vet Visit</SelectItem>
                      <SelectItem value="bowel_movement">Bowel Movement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {scheduleType === "supplement" && (
          <Card>
            <CardHeader>
              <CardTitle>Supplement Selection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="supplement">Supplement</Label>
                <Select value={supplementId} onValueChange={setSupplementId}>
                  <SelectTrigger id="supplement">
                    <SelectValue placeholder="Select a supplement (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No supplement</SelectItem>
                    {supplements.map((supplement) => (
                      <SelectItem key={supplement.id} value={String(supplement.id)}>
                        {supplement.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Schedule Rules - only for fixed mode */}
        {scheduleMode === "fixed" && (
          <Card>
            <CardHeader>
              <CardTitle>Schedule Rules</CardTitle>
              <CardDescription>Define when this schedule should occur</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scheduleRule">Schedule Rule *</Label>
                <Select value={scheduleRule} onValueChange={setScheduleRule} required>
                  <SelectTrigger id="scheduleRule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days_of_week">Specific Days of Week</SelectItem>
                    <SelectItem value="every_x_days">Every X Days</SelectItem>
                    <SelectItem value="monthly">Monthly (Specific Day)</SelectItem>
                    <SelectItem value="dependent">Dependent on Another Schedule</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {scheduleRule === "every_x_days" && (
                <div className="space-y-2">
                  <Label htmlFor="frequencyDays">Frequency (Days) *</Label>
                  <Input
                    id="frequencyDays"
                    type="number"
                    min="1"
                    value={frequencyDays}
                    onChange={(e) => setFrequencyDays(e.target.value)}
                    required
                    placeholder="e.g., 3 for every 3 days"
                  />
                </div>
              )}

              {scheduleRule === "days_of_week" && (
                <div className="space-y-2">
                  <Label>Days of Week *</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {weekDays.map((day) => (
                      <Badge
                        key={day.value}
                        variant={daysOfWeek.includes(day.value) ? "default" : "outline"}
                        className="cursor-pointer justify-center py-3"
                        onClick={() => toggleDayOfWeek(day.value)}
                      >
                        {day.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {scheduleRule === "monthly" && (
                <div className="space-y-2">
                  <Label htmlFor="dayOfMonth">Day of Month *</Label>
                  <Input
                    id="dayOfMonth"
                    type="number"
                    min="1"
                    max="31"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value)}
                    required
                    placeholder="e.g., 15 for the 15th of each month"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Interval Mode Fields */}
        {scheduleMode === "interval" && (
          <Card>
            <CardHeader>
              <CardTitle>Interval Settings</CardTitle>
              <CardDescription>Define time-based scheduling rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minDaysBetween">Min Days Between *</Label>
                  <Input
                    id="minDaysBetween"
                    type="number"
                    min="1"
                    value={minDaysBetween}
                    onChange={(e) => setMinDaysBetween(e.target.value)}
                    required
                    placeholder="e.g., 3"
                  />
                  <p className="text-sm text-muted-foreground">
                    Minimum time to wait (HARD constraint)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxDaysBetween">Max Days Between *</Label>
                  <Input
                    id="maxDaysBetween"
                    type="number"
                    min={minDaysBetween || "1"}
                    value={maxDaysBetween}
                    onChange={(e) => setMaxDaysBetween(e.target.value)}
                    required
                    placeholder="e.g., 4"
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum allowed time (HARD constraint)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quotaPeriod">Period Tracking</Label>
                <Select value={quotaPeriod} onValueChange={setQuotaPeriod}>
                  <SelectTrigger id="quotaPeriod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  How to group feeding counts for display (informational only)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Suggested Days (Optional)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {weekDays.map((day) => (
                    <Badge
                      key={day.value}
                      variant={suggestedDays.includes(day.value) ? "default" : "outline"}
                      className="cursor-pointer justify-center py-3"
                      onClick={() => toggleSuggestedDay(day.value)}
                    >
                      {day.label}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Calendar instances will appear on these days (adapts to actual completion)
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dependent Mode Fields */}
        {scheduleMode === "dependent" && (
          <Card>
            <CardHeader>
              <CardTitle>Dependent Schedule Settings</CardTitle>
              <CardDescription>Configure event-triggered scheduling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="parentSchedule">Parent Schedule *</Label>
                <Select value={parentScheduleId} onValueChange={setParentScheduleId} required>
                  <SelectTrigger id="parentSchedule">
                    <SelectValue placeholder="Select a parent schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    {schedules.length === 0 ? (
                      <SelectItem value="__none__" disabled>No available parent schedules for this reptile</SelectItem>
                    ) : (
                      schedules.map((schedule) => {
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
                          <SelectItem key={schedule.id} value={String(schedule.id)}>
                            {label}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  This schedule will trigger based on occurrences of the parent schedule. Only non-dependent schedules can be parents.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dependentRule">Dependent Rule *</Label>
                <Select value={dependentRule} onValueChange={setDependentRule} required>
                  <SelectTrigger id="dependentRule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="every_occurrence">Every Occurrence</SelectItem>
                    <SelectItem value="every_nth">Every Nth Occurrence</SelectItem>
                    <SelectItem value="specific_days">Specific Days of Week</SelectItem>
                    <SelectItem value="once_per_day">Once Per Day (First Occurrence Only)</SelectItem>
                  </SelectContent>
                </Select>
                {dependentRule === "once_per_day" && (
                  <p className="text-sm text-muted-foreground">
                    Will trigger once per day when the parent schedule occurs. Perfect for daily supplements that should be given with one feeding per day (you choose which feeding when logging).
                  </p>
                )}
              </div>

              {dependentRule === "every_nth" && (
                <div className="space-y-2">
                  <Label htmlFor="dependentFrequency">Occurrence Frequency *</Label>
                  <Input
                    id="dependentFrequency"
                    type="number"
                    min="2"
                    value={dependentFrequency}
                    onChange={(e) => setDependentFrequency(e.target.value)}
                    required
                    placeholder="e.g., 2 for every 2nd occurrence"
                  />
                  <p className="text-sm text-muted-foreground">
                    Example: "2" means every 2nd feeding, "3" means every 3rd feeding
                  </p>
                </div>
              )}

              {dependentRule === "specific_days" && (
                <div className="space-y-2">
                  <Label>Days of Week *</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {weekDays.map((day) => (
                      <Badge
                        key={day.value}
                        variant={dependentDays.includes(day.value) ? "default" : "outline"}
                        className="cursor-pointer justify-center py-3"
                        onClick={() => toggleDependentDay(day.value)}
                      >
                        {day.label}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Only trigger on parent schedule occurrences that fall on these days
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Time Window Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Time Window</CardTitle>
            <CardDescription>Set a time range for completion</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="timeWindowEnabled"
                checked={timeWindowEnabled}
                onChange={(e) => setTimeWindowEnabled(e.target.checked)}
                className="w-4 h-4 text-primary rounded border-border focus:ring-primary focus:ring-2"
              />
              <Label htmlFor="timeWindowEnabled" className="cursor-pointer">
                Enable Time Window
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Set a time range when this activity should be completed. Useful for basking reptiles that need to eat after warming up.
            </p>

            {timeWindowEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6 border-l-2 border-primary">
                <div className="space-y-2">
                  <Label>Earliest Time</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={earliestHours}
                      onChange={e => handleEarliestHoursChange(e.target.value)}
                      className="w-20 text-center"
                      min={userTimeFormat === '12h' ? 1 : 0}
                      max={userTimeFormat === '12h' ? 12 : 23}
                      required
                    />
                    <span className="flex items-center text-xl font-bold text-muted-foreground">:</span>
                    <Input
                      type="number"
                      value={String(earliestMinutes).padStart(2, '0')}
                      onChange={e => handleEarliestMinutesChange(e.target.value)}
                      className="w-20 text-center"
                      min="0"
                      max="59"
                      required
                    />
                    {userTimeFormat === '12h' && (
                      <Select value={earliestPeriod} onValueChange={setEarliestPeriod}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AM">AM</SelectItem>
                          <SelectItem value="PM">PM</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">When the feeding window opens</p>
                </div>

                <div className="space-y-2">
                  <Label>Latest Time</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={latestHours}
                      onChange={e => handleLatestHoursChange(e.target.value)}
                      className="w-20 text-center"
                      min={userTimeFormat === '12h' ? 1 : 0}
                      max={userTimeFormat === '12h' ? 12 : 23}
                      required
                    />
                    <span className="flex items-center text-xl font-bold text-muted-foreground">:</span>
                    <Input
                      type="number"
                      value={String(latestMinutes).padStart(2, '0')}
                      onChange={e => handleLatestMinutesChange(e.target.value)}
                      className="w-20 text-center"
                      min="0"
                      max="59"
                      required
                    />
                    {userTimeFormat === '12h' && (
                      <Select value={latestPeriod} onValueChange={setLatestPeriod}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AM">AM</SelectItem>
                          <SelectItem value="PM">PM</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">When the feeding must be completed by</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auto-Complete Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Auto-Complete</CardTitle>
            <CardDescription>Automatically mark tasks as completed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoCompleteEnabled"
                checked={autoCompleteEnabled}
                onChange={(e) => setAutoCompleteEnabled(e.target.checked)}
                className="w-4 h-4 text-primary rounded border-border focus:ring-primary focus:ring-2"
              />
              <Label htmlFor="autoCompleteEnabled" className="cursor-pointer">
                Enable Auto-Complete
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Automatically mark this schedule as completed if not manually logged. Useful for daily repetitive tasks like salad feeding or misting.
            </p>

            {autoCompleteEnabled && (
              <div className="pl-6 border-l-2 border-primary space-y-2">
                <Label htmlFor="autoCompleteHours">Hours After Window</Label>
                <Input
                  id="autoCompleteHours"
                  type="number"
                  value={autoCompleteHoursAfter}
                  onChange={(e) => setAutoCompleteHoursAfter(e.target.value)}
                  className="w-32"
                  min="0"
                  max="24"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {timeWindowEnabled
                    ? "Hours after the latest time to auto-complete this schedule"
                    : "Hours after end of day (11:59 PM) to auto-complete this schedule"}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Note: Auto-completed instances can be manually marked as "missed" or "skipped" if needed
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Flexible Completion Window - Only for fixed schedules */}
        {scheduleMode === "fixed" && (
          <Card>
            <CardHeader>
              <CardTitle>Flexible Completion Window</CardTitle>
              <CardDescription>Allow completing tasks within a date range</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="flexibleCompletionEnabled"
                  checked={flexibleCompletionEnabled}
                  onChange={(e) => setFlexibleCompletionEnabled(e.target.checked)}
                  className="w-4 h-4 text-primary rounded border-border focus:ring-primary focus:ring-2"
                />
                <Label htmlFor="flexibleCompletionEnabled" className="cursor-pointer">
                  Enable Flexible Completion Window
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Allow completing this schedule within a range of days (e.g., feeding 1 day early or late). Useful when your schedule varies slightly from day to day.
              </p>

              {flexibleCompletionEnabled && (
                <div className="pl-6 border-l-2 border-primary space-y-2">
                  <Label htmlFor="flexibleDays">Completion Window (±days)</Label>
                  <Input
                    id="flexibleDays"
                    type="number"
                    value={flexibleCompletionDays}
                    onChange={(e) => setFlexibleCompletionDays(e.target.value)}
                    className="w-32"
                    min="1"
                    max="7"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Activities can be logged {flexibleCompletionDays} day(s) before or after the scheduled date
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Example: With ±{flexibleCompletionDays} days, a schedule on Wednesday can be completed {(() => {
                      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                      const wednesday = 3;
                      const offset = parseInt(flexibleCompletionDays) || 1;
                      const startDay = Math.max(0, wednesday - offset);
                      const endDay = Math.min(6, wednesday + offset);
                      return `${days[startDay]}-${days[endDay]}`;
                    })()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Configure notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="notificationsEnabled"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="w-4 h-4 text-primary rounded border-border focus:ring-primary focus:ring-2"
              />
              <Label htmlFor="notificationsEnabled" className="cursor-pointer">
                Enable notifications for this schedule
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Receive reminder alerts and overdue warnings according to your notification preferences in Settings
            </p>

            {notificationsEnabled && availableChannels.length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg space-y-2">
                <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                  Select notification channels (click to toggle):
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableChannels.map(channel => {
                    const isSelected = selectedChannelIds.includes(channel.id);
                    return (
                      <Badge
                        key={channel.id}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer gap-1.5"
                        onClick={() => toggleChannelSelection(channel.id)}
                      >
                        {channel.household_wide ? (
                          <Users size={14} className="flex-shrink-0" />
                        ) : (
                          <UserIcon size={14} className="flex-shrink-0" />
                        )}
                        <span className="font-semibold">{channel.name}</span>
                        <span className="text-muted-foreground">({getChannelTypeDisplay(channel.webhook_type)})</span>
                      </Badge>
                    );
                  })}
                </div>
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <Users size={12} className="inline mr-1" />
                  = Household channel (shared with all members) •
                  <UserIcon size={12} className="inline mx-1" />
                  = Personal channel
                </p>
              </div>
            )}

            {notificationsEnabled && availableChannels.length === 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                <p className="text-xs text-amber-900 dark:text-amber-100">
                  No notification channels configured. Go to Settings → Notifications to add channels.
                </p>
              </div>
            )}

            {notificationsEnabled && (
              <div className="pl-6 border-l-2 border-primary space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="reminderEnabled"
                    checked={reminderEnabled}
                    onChange={(e) => setReminderEnabled(e.target.checked)}
                    className="w-4 h-4 text-primary rounded border-border focus:ring-primary focus:ring-2"
                  />
                  <Label htmlFor="reminderEnabled" className="cursor-pointer">
                    Set reminder time
                  </Label>
                </div>

                {reminderEnabled && (
                  <div className="space-y-2">
                    <Label>Reminder Time</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={reminderHours}
                        onChange={e => handleReminderHoursChange(e.target.value)}
                        className="w-20 text-center"
                        min={userTimeFormat === '12h' ? 1 : 0}
                        max={userTimeFormat === '12h' ? 12 : 23}
                        required
                      />
                      <span className="flex items-center text-xl font-bold text-muted-foreground">:</span>
                      <Input
                        type="number"
                        value={String(reminderMinutes).padStart(2, '0')}
                        onChange={e => handleReminderMinutesChange(e.target.value)}
                        className="w-20 text-center"
                        min="0"
                        max="59"
                        required
                      />
                      {userTimeFormat === '12h' && (
                        <Select value={reminderPeriod} onValueChange={setReminderPeriod}>
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AM">AM</SelectItem>
                            <SelectItem value="PM">PM</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {timeWindowEnabled
                        ? "Get reminded at this specific time (must be within the time window)"
                        : "Get reminded at this specific time"}
                    </p>

                    {!isReminderTimeValid() && (
                      <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded">
                        <p className="text-xs text-red-800 dark:text-red-200">
                          Reminder time must be between the earliest and latest times
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Smart Notifications - Only show when notifications are enabled */}
        {notificationsEnabled && (
          <Card>
            <Collapsible open={smartNotificationsOpen} onOpenChange={setSmartNotificationsOpen}>
              <CardHeader className="cursor-pointer" onClick={() => setSmartNotificationsOpen(!smartNotificationsOpen)}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <CardTitle>Smart Notifications</CardTitle>
                      <CardDescription>Follow-up reminders for uncompleted tasks</CardDescription>
                    </div>
                    <ChevronDown
                      size={20}
                      className={`text-muted-foreground transition-transform ${smartNotificationsOpen ? 'rotate-180' : ''}`}
                    />
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-6 pt-0">
                  {/* Follow-up Reminder */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="followUpEnabled"
                        checked={followUpEnabled}
                        onChange={(e) => setFollowUpEnabled(e.target.checked)}
                        className="w-4 h-4 text-primary rounded border-border focus:ring-primary focus:ring-2"
                      />
                      <Label htmlFor="followUpEnabled" className="cursor-pointer">
                        Follow-up Reminder
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Send a follow-up reminder if the task is not completed after the initial notification.
                    </p>

                    {followUpEnabled && (
                      <div className="pl-6 border-l-2 border-primary space-y-2">
                        <Label htmlFor="followUpDelayMinutes">Minutes after main reminder</Label>
                        <Input
                          id="followUpDelayMinutes"
                          type="number"
                          value={followUpDelayMinutes}
                          onChange={(e) => setFollowUpDelayMinutes(e.target.value)}
                          className="w-32"
                          min="5"
                          max="240"
                        />
                        <p className="text-xs text-muted-foreground">
                          Send follow-up {followUpDelayMinutes} minutes after the initial reminder if task is still pending
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any notes about this schedule..."
            />
          </CardContent>
        </Card>

        {/* Enabled Toggle */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 text-primary rounded border-border focus:ring-primary focus:ring-2"
              />
              <Label htmlFor="enabled" className="cursor-pointer">
                Enable this schedule
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/calendar")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            <Save size={20} className="mr-2" />
            {loading
              ? (isEditing ? "Saving..." : "Creating...")
              : (isEditing ? "Save Changes" : "Create Schedule")
            }
          </Button>
        </div>
      </form>
    </div>
  );
}

export default ScheduleForm;
