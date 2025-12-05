import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Calendar, Clock, Utensils, Droplets, Scale, Activity, CheckCircle, AlertCircle, XCircle, MinusCircle, Bell, Plus } from 'lucide-react';
import { formatDate, formatTime } from '../utils/dateFormatting';

export default function ScheduleInstanceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [instance, setInstance] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInstanceDetails();
  }, [id]);

  const fetchInstanceDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/schedule-instances/${id}`);
      setInstance(response.data);

      // If completed, fetch the completion details
      if (response.data.status === 'completed' && response.data.completions && response.data.completions.length > 0) {
        // Get the first completion (should only be one)
        const completionData = response.data.completions[0];

        // Fetch the actual feeding/misting/weighing that completed this instance
        if (completionData.completion_type && completionData.completion_id) {
          const type = completionData.completion_type.toLowerCase();

          if (type === 'feeding') {
            const feedingRes = await axios.get(`/api/feedings/${completionData.completion_id}`);
            setCompletion({ type: 'feeding', data: feedingRes.data });
          } else if (type === 'misting') {
            const mistingRes = await axios.get(`/api/misting/${completionData.completion_id}`);
            setCompletion({ type: 'misting', data: mistingRes.data });
          } else if (type === 'weighing') {
            const weightRes = await axios.get(`/api/weight/${completionData.completion_id}`);
            setCompletion({ type: 'weight', data: weightRes.data });
          }
        }
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching instance details:', err);
      setError('Failed to load schedule instance details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return { Icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' };
      case 'pending':
        return { Icon: Clock, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' };
      case 'missed':
        return { Icon: XCircle, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' };
      case 'skipped':
        return { Icon: MinusCircle, color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-700' };
      default:
        return { Icon: AlertCircle, color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-700' };
    }
  };

  const getScheduleTypeIcon = (type) => {
    switch (type) {
      case 'feeding':
        return { Icon: Utensils, color: 'text-primary-600 dark:text-primary-400', bgColor: 'bg-primary-100 dark:bg-primary-900/30' };
      case 'misting':
        return { Icon: Droplets, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' };
      case 'weighing':
        return { Icon: Scale, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' };
      case 'health':
        return { Icon: Activity, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' };
      default:
        return { Icon: Calendar, color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-700' };
    }
  };

  const getCompletionLink = () => {
    if (!completion) return null;

    switch (completion.type) {
      case 'feeding':
        return `/feed/${completion.data.id}`;
      case 'misting':
        return `/misting/${completion.data.id}`;
      case 'weight':
        return `/health-log/weight/${completion.data.id}`;
      default:
        return null;
    }
  };

  const getCompletionSummary = () => {
    if (!completion) return null;

    switch (completion.type) {
      case 'feeding': {
        const feeding = completion.data;
        const foodItems = feeding.foods || [];
        const totalItems = foodItems.reduce((sum, f) => sum + (f.quantity || 1), 0);
        const foodNames = foodItems.map(f => f.food?.name || f.name).filter(Boolean).join(', ');
        const supplements = feeding.supplements && feeding.supplements.length > 0
          ? ` + ${feeding.supplements.map(s => s.name).join(', ')}`
          : '';

        // Check if this is a countable food (not salad)
        const isCountable = foodItems.some(f => {
          const name = (f.food?.name || f.name || '').toLowerCase();
          return !name.includes('salad');
        });

        return {
          label: 'Feeding',
          quantity: totalItems,
          details: `${foodNames}${supplements}`,
          showQuantityBold: isCountable,
          timestamp: feeding.fed_at,
        };
      }
      case 'misting': {
        const misting = completion.data;
        return {
          label: 'Misting',
          details: misting.notes || 'Misting completed',
          timestamp: misting.misted_at,
        };
      }
      case 'weight': {
        const weight = completion.data;
        return {
          label: 'Weight',
          details: `${weight.weight_grams}g`,
          timestamp: weight.measured_at,
        };
      }
      default:
        return null;
    }
  };

  const handleLogNow = () => {
    const scheduleType = schedule?.schedule_type;
    const reptileId = reptile?.id;

    // Navigate to the appropriate logging page with instance_id
    switch (scheduleType) {
      case 'feeding':
        navigate(`/feed?instance_id=${id}`);
        break;
      case 'misting':
        navigate(`/misting-log/${reptileId}?instance_id=${id}`);
        break;
      case 'weighing':
        navigate(`/health-log/${reptileId}?instance_id=${id}&log_type=weight`);
        break;
      case 'health':
        navigate(`/health-log/${reptileId}?instance_id=${id}`);
        break;
      default:
        navigate(`/reptiles/${reptileId}`);
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
      default:
        return 'Log Now';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error || !instance) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error || 'Instance not found'}</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 btn-secondary"
        >
          <ArrowLeft size={18} />
          Go Back
        </button>
      </div>
    );
  }

  const schedule = instance.schedule;
  const reptile = schedule?.reptile;
  const statusInfo = getStatusIcon(instance.status);
  const typeInfo = getScheduleTypeIcon(schedule?.schedule_type);
  const completionSummary = getCompletionSummary();
  const completionLink = getCompletionLink();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Schedule Instance
          </h1>
        </div>
        <Link
          to={`/schedules/${schedule?.id}`}
          className="btn-secondary inline-flex items-center gap-2"
        >
          <Calendar size={16} />
          View Schedule Details
        </Link>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${statusInfo.bgColor}`}>
                <statusInfo.Icon size={24} className={statusInfo.color} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white capitalize">
                  {instance.status}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(new Date(instance.scheduled_date))}
                </p>
              </div>
            </div>
            {instance.status === 'pending' && (
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
                Not completed yet
              </span>
            )}
          </div>

          {/* Schedule Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Reptile
              </label>
              <Link
                to={`/reptiles/${reptile?.id}`}
                className="text-gray-900 dark:text-white font-medium hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                {reptile?.name}
              </Link>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Schedule Type
              </label>
              <div className="flex items-center gap-2">
                <typeInfo.Icon size={16} className={typeInfo.color} />
                <span className="text-gray-900 dark:text-white capitalize">
                  {schedule?.schedule_type}
                </span>
              </div>
            </div>

            {schedule?.food_category && (
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Food Category
                </label>
                <span className="text-gray-900 dark:text-white capitalize">
                  {schedule.food_category}
                </span>
              </div>
            )}

            {schedule?.health_category && (
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Health Category
                </label>
                <span className="text-gray-900 dark:text-white capitalize">
                  {schedule.health_category}
                </span>
              </div>
            )}

            {schedule?.time_window_enabled && schedule?.earliest_time && schedule?.latest_time && (
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <Clock size={14} />
                  Time Window
                </label>
                <span className="text-gray-900 dark:text-white">
                  {formatTime(new Date(`2000-01-01T${schedule.earliest_time}`))} - {formatTime(new Date(`2000-01-01T${schedule.latest_time}`))}
                </span>
              </div>
            )}

            {schedule?.notifications_enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <Bell size={14} />
                  Notifications
                </label>
                <span className="text-blue-600 dark:text-blue-400">
                  Enabled
                </span>
              </div>
            )}

            {instance.feeding_sequence_number && (
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Feeding Sequence #
                </label>
                <span className="text-gray-900 dark:text-white font-mono">
                  {instance.feeding_sequence_number}
                </span>
              </div>
            )}
          </div>

          {schedule?.notes && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Schedule Notes
              </label>
              <p className="text-gray-900 dark:text-white">
                {schedule.notes}
              </p>
            </div>
          )}

          {/* Supplements section */}
          {instance.supplements && instance.supplements.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Pre-calculated Supplements
              </label>
              <div className="flex flex-wrap gap-2">
                {instance.supplements.map((supp, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 rounded text-xs font-medium"
                  >
                    {supp.name}
                    {supp.priority !== undefined && ` (${supp.priority})`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action/Completion Card */}
          {instance.status === 'pending' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-blue-500 dark:border-blue-600 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Clock size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Action Required
                </h3>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-4">
                This schedule instance is pending and needs to be completed.
              </p>

              <button
                onClick={handleLogNow}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus size={16} />
                {getActionButtonText()}
              </button>
            </div>
          )}

          {instance.status === 'completed' && completionSummary && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-green-500 dark:border-green-600 p-6">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Completion Type
                  </label>
                  <span className="text-gray-900 dark:text-white capitalize">
                    {completionSummary.label}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Details
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {completionSummary.quantity !== undefined ? (
                      <>
                        <span className={completionSummary.showQuantityBold ? 'font-bold' : ''}>
                          {completionSummary.quantity} items
                        </span>
                        : {completionSummary.details}
                      </>
                    ) : (
                      completionSummary.details
                    )}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Completed At
                  </label>
                  <span className="text-gray-900 dark:text-white">
                    {formatTime(new Date(completionSummary.timestamp))} on {formatDate(new Date(completionSummary.timestamp))}
                  </span>
                </div>

                {completionLink && (
                  <div className="pt-3">
                    <Link
                      to={completionLink}
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      View {completionSummary.label} Details
                      <ArrowLeft size={16} className="rotate-180" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

      </div>
    </div>
  );
}
