import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Edit, Calendar, Clock, Bell, CheckCircle, XCircle, FileText, Users, User as UserIcon } from "lucide-react";
import { getUserTimeFormat, getDayNames } from "../utils/dateFormatting";

function ScheduleDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const userTimeFormat = getUserTimeFormat();
  const [schedule, setSchedule] = useState(null);
  const [reptile, setReptile] = useState(null);
  const [supplement, setSupplement] = useState(null);
  const [parentSchedule, setParentSchedule] = useState(null);
  const [notificationChannels, setNotificationChannels] = useState([]);
  const [feedingRotations, setFeedingRotations] = useState([]);
  const [applicableSupplements, setApplicableSupplements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchScheduleDetails();
  }, [id]);

  const calculateApplicableSupplements = (scheduleData, rotations) => {
    if (!scheduleData.food_category) return [];

    // Filter rotations that apply to this food category
    const applicable = rotations.filter(r => {
      if (r.rotation_type !== 'supplement') return false;
      if (!r.applies_to_category || r.applies_to_category === 'all') return true;
      return r.applies_to_category === scheduleData.food_category;
    });

    // Sort by priority (lower number = higher priority)
    applicable.sort((a, b) => a.priority - b.priority);

    // For schedule-based rotations, check if this schedule's days match
    const scheduleBasedSupplements = applicable
      .filter(r => r.trigger_mode === 'schedule_based')
      .filter(r => {
        if (!r.schedule_days_of_week || !scheduleData.days_of_week) return false;

        // Get days from rotation and schedule
        const rotationDays = r.schedule_days_of_week.split(',').map(d => parseInt(d));
        const scheduleDays = scheduleData.days_of_week.split(',').map(d => parseInt(d));

        // Check if any days overlap
        return rotationDays.some(day => scheduleDays.includes(day));
      })
      .filter(r => r.supplement)
      .map(r => r.supplement);

    // For feeding-count based rotations, we can't determine without actual feeding history
    // So we'll show them as "may apply" based on the frequency
    const feedingCountSupplements = applicable
      .filter(r => r.trigger_mode === 'feeding_count')
      .filter(r => r.supplement)
      .map(r => ({
        ...r.supplement,
        frequency_note: `Every ${r.every_n_feedings} feeding${r.every_n_feedings > 1 ? 's' : ''}`
      }));

    // Combine and deduplicate
    const allSupplements = [...scheduleBasedSupplements, ...feedingCountSupplements];
    const unique = allSupplements.filter((supp, index, self) =>
      index === self.findIndex(s => s.id === supp.id)
    );

    return unique;
  };

  const fetchScheduleDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/schedules/${id}`);
      const scheduleData = response.data;
      setSchedule(scheduleData);

      // Fetch related data
      if (scheduleData.reptile_id) {
        const reptileResponse = await axios.get(`/api/reptiles/${scheduleData.reptile_id}`);
        setReptile(reptileResponse.data);
      }

      // Supplement and parent_schedule are already included in the response
      if (scheduleData.supplement) {
        setSupplement(scheduleData.supplement);
      }

      if (scheduleData.parent_schedule) {
        setParentSchedule(scheduleData.parent_schedule);
      }

      // Fetch notification channels if notifications are enabled
      if (scheduleData.notifications_enabled && scheduleData.channel_ids && scheduleData.channel_ids.length > 0) {
        const channelsResponse = await axios.get("/api/notification-channels/me");
        const enabledChannels = channelsResponse.data.filter(ch => scheduleData.channel_ids.includes(ch.id));
        setNotificationChannels(enabledChannels);
      }

      // Fetch feeding rotations for supplement calculation (only for feeding schedules)
      if (scheduleData.schedule_type === 'feeding' && scheduleData.reptile_id) {
        try {
          const rotationsResponse = await axios.get(`/api/feeding-rotations/reptile/${scheduleData.reptile_id}`);
          const rotations = rotationsResponse.data;
          setFeedingRotations(rotations);

          // Calculate applicable supplements for this schedule
          const supplements = calculateApplicableSupplements(scheduleData, rotations);
          setApplicableSupplements(supplements);
        } catch (err) {
          console.error("Error fetching feeding rotations:", err);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching schedule details:", error);
      setError("Failed to load schedule details");
      setLoading(false);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':').map(Number);

    if (userTimeFormat === '12h') {
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
    } else {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  };

  const formatScheduleRule = () => {
    if (!schedule) return '';

    switch (schedule.schedule_rule) {
      case 'every_x_days':
        return `Every ${schedule.frequency_days} day${schedule.frequency_days > 1 ? 's' : ''}`;
      case 'days_of_week': {
        if (!schedule.days_of_week) return 'Specific days of week';
        const dayNumbers = schedule.days_of_week.split(',').map(d => parseInt(d));
        const dayNames = getDayNames();
        const selectedDays = dayNumbers.map(num => {
          const index = [0, 1, 2, 3, 4, 5, 6].indexOf(num);
          return dayNames[index];
        });
        return selectedDays.join(', ');
      }
      case 'monthly':
        return `Monthly on day ${schedule.day_of_month}`;
      case 'dependent': {
        if (schedule.dependent_rule === 'every_occurrence') {
          return 'Every time parent schedule occurs';
        } else if (schedule.dependent_rule === 'every_x_occurrences') {
          return `Every ${schedule.dependent_frequency} parent occurrences`;
        } else if (schedule.dependent_rule === 'specific_days') {
          const dayNumbers = schedule.dependent_days?.split(',').map(d => parseInt(d)) || [];
          const dayNames = getDayNames();
          const selectedDays = dayNumbers.map(num => {
            const index = [0, 1, 2, 3, 4, 5, 6].indexOf(num);
            return dayNames[index];
          });
          return `On ${selectedDays.join(', ')} when parent occurs`;
        }
        return 'Dependent on parent schedule';
      }
      default:
        return schedule.schedule_rule;
    }
  };

  const getScheduleTypeDisplay = (type) => {
    const typeMap = {
      'feeding': 'Feeding',
      'supplement': 'Supplement',
      'misting': 'Misting',
      'weighing': 'Weighing',
      'health': 'Health Check'
    };
    return typeMap[type] || type;
  };

  const getChannelTypeDisplay = (webhookType) => {
    const typeMap = {
      'in_app': 'In-App',
      'discord': 'Discord',
      'pushover': 'Pushover',
      'generic': 'Generic Webhook'
    };
    return typeMap[webhookType] || webhookType;
  };

  const handleLogNow = () => {
    // Navigate to the appropriate logging page based on schedule type
    switch (schedule.schedule_type) {
      case 'feeding':
        navigate(`/feed?schedule_id=${schedule.id}`);
        break;
      case 'misting':
        navigate(`/misting-log/${reptile.id}?schedule_id=${schedule.id}`);
        break;
      case 'weighing':
        navigate(`/health-log/${reptile.id}?schedule_id=${schedule.id}&log_type=weight`);
        break;
      case 'health':
        navigate(`/health-log/${reptile.id}?schedule_id=${schedule.id}`);
        break;
      case 'supplement':
        // Supplements are logged through feeding
        navigate(`/feed?schedule_id=${schedule.id}`);
        break;
      default:
        navigate(`/reptiles/${reptile.id}`);
    }
  };

  const getActionButtonText = () => {
    switch (schedule?.schedule_type) {
      case 'feeding':
        return 'Log Feeding';
      case 'misting':
        return 'Log Misting';
      case 'weighing':
        return 'Record Weight';
      case 'health':
        return 'Log Health Check';
      case 'supplement':
        return 'Log Supplement';
      default:
        return 'Log Now';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-400">Loading schedule details...</div>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-red-600 dark:text-red-400 mb-4">{error || "Schedule not found"}</div>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
        >
          <ArrowLeft size={20} />
          Back
        </button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {schedule.name}
            </h1>
            {reptile && (
              <p className="text-gray-600 dark:text-gray-400">
                For: <Link to={`/reptiles/${reptile.id}`} className="font-semibold text-primary-600 dark:text-primary-400 hover:underline">{reptile.name}</Link>
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleLogNow}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
            >
              <CheckCircle size={20} />
              {getActionButtonText()}
            </button>
            <button
              onClick={() => navigate(`/schedule-edit/${schedule.id}`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Edit size={20} />
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="mb-6">
        {schedule.enabled ? (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-sm">
            <CheckCircle size={16} />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 text-sm">
            <XCircle size={16} />
            Disabled
          </span>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Schedule Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Schedule Information</h2>

            <div className="space-y-3 text-sm">
              <div>
                <div className="text-gray-500 dark:text-gray-400 mb-1">Type</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {getScheduleTypeDisplay(schedule.schedule_type)}
                </div>
              </div>

              {schedule.food_category && (
                <div>
                  <div className="text-gray-500 dark:text-gray-400 mb-1">Food Category</div>
                  <div className="font-medium text-gray-900 dark:text-white capitalize">
                    {schedule.food_category}
                  </div>
                </div>
              )}

              {schedule.time_slot && (
                <div>
                  <div className="text-gray-500 dark:text-gray-400 mb-1">Time Slot</div>
                  <div className="font-medium text-gray-900 dark:text-white capitalize">
                    {schedule.time_slot}
                  </div>
                </div>
              )}

              {schedule.health_category && (
                <div>
                  <div className="text-gray-500 dark:text-gray-400 mb-1">Health Category</div>
                  <div className="font-medium text-gray-900 dark:text-white capitalize">
                    {schedule.health_category}
                  </div>
                </div>
              )}

              {supplement && (
                <div>
                  <div className="text-gray-500 dark:text-gray-400 mb-1">Supplement</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {supplement.name}
                  </div>
                </div>
              )}

              {applicableSupplements.length > 0 && (
                <div>
                  <div className="text-gray-500 dark:text-gray-400 mb-1">Applicable Supplements</div>
                  <div className="space-y-1">
                    {applicableSupplements.map((supp, idx) => (
                      <div key={idx} className="font-medium text-gray-900 dark:text-white">
                        {supp.name}
                        {supp.frequency_note && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            ({supp.frequency_note})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {parentSchedule && (
                <div>
                  <div className="text-gray-500 dark:text-gray-400 mb-1">Parent Schedule</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {parentSchedule.name}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Frequency */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Calendar size={20} />
              Frequency
            </h2>
            <div className="font-medium text-gray-900 dark:text-white">
              {formatScheduleRule()}
            </div>
          </div>

          {/* Time Window */}
          {schedule.time_window_enabled && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock size={20} />
                Time Window
              </h2>
              <div className="font-medium text-gray-900 dark:text-white">
                {formatTime(schedule.earliest_time)} - {formatTime(schedule.latest_time)}
              </div>
            </div>
          )}

        {/* Notifications */}
        {schedule.notifications_enabled && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Bell size={20} />
                Notifications
              </h2>

              <div className="space-y-4">
                {/* Reminder Time */}
                {schedule.reminder_time && (
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Reminder Time</div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {formatTime(schedule.reminder_time)}
                    </div>
                  </div>
                )}

                {/* Notification Channels */}
                {notificationChannels.length > 0 && (
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Channels</div>
                    <div className="space-y-2">
                      {notificationChannels.map(channel => (
                        <div
                          key={channel.id}
                          className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                        >
                          {channel.household_wide ? (
                            <Users size={14} className="flex-shrink-0" />
                          ) : (
                            <UserIcon size={14} className="flex-shrink-0" />
                          )}
                          <span className="font-medium">{channel.name}</span>
                          <span className="text-gray-500 dark:text-gray-400">
                            ({getChannelTypeDisplay(channel.webhook_type)})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
        )}

          {/* Notes - Full Width */}
          {schedule.notes && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 md:col-span-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FileText size={20} />
                Notes
              </h2>
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {schedule.notes}
              </div>
            </div>
          )}
    </div>
  );
}

export default ScheduleDetails;
