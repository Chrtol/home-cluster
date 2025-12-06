import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Edit2, Trash2, Plus } from 'lucide-react';
import { getUserTimeFormat, formatDateTime } from '../utils/dateFormatting';
import DateInput from '../components/DateInput';

export default function MistingLog() {
  const navigate = useNavigate();
  const { reptileId, id } = useParams();
  const [searchParams] = useSearchParams();

  // Mode state
  const [mode, setMode] = useState('create'); // create, view, edit
  const [existingLog, setExistingLog] = useState(null);

  const [reptiles, setReptiles] = useState([]);
  const [selectedReptile, setSelectedReptile] = useState('');
  const [mistingDate, setMistingDate] = useState(new Date().toISOString().slice(0, 10));
  const [mistingTime, setMistingTime] = useState(new Date().toTimeString().slice(0, 5));
  const [notes, setNotes] = useState('');

  // Time input format state
  const [timeFormat, setTimeFormat] = useState('24h');
  const [hours, setHours] = useState(new Date().getHours());
  const [minutes, setMinutes] = useState(new Date().getMinutes());
  const [period, setPeriod] = useState(new Date().getHours() >= 12 ? 'PM' : 'AM');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewModeSuccess, setViewModeSuccess] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      // Load user's time format preference and initialize time
      const format = getUserTimeFormat();
      setTimeFormat(format);

      const now = new Date();
      const currentHour24 = now.getHours();
      const currentMinutes = now.getMinutes();

      setMinutes(currentMinutes);

      if (format === '12h') {
        // Convert to 12h format
        if (currentHour24 === 0) {
          setHours(12);
          setPeriod('AM');
        } else if (currentHour24 < 12) {
          setHours(currentHour24);
          setPeriod('AM');
        } else if (currentHour24 === 12) {
          setHours(12);
          setPeriod('PM');
        } else {
          setHours(currentHour24 - 12);
          setPeriod('PM');
        }
      } else {
        setHours(currentHour24);
      }

      try {
        const reptilesRes = await axios.get('/api/reptiles');
        setReptiles(reptilesRes.data);

        // Check if we're viewing/editing an existing misting log
        if (id && !isNaN(id)) {
          try {
            const logRes = await axios.get(`/api/misting/${id}`);
            setExistingLog(logRes.data);
            setMode('view');
            loadLogData(logRes.data);

            // Check for success query parameter
            const successParam = searchParams.get('success');
            if (successParam === 'created') {
              setViewModeSuccess('Misting logged successfully!');
              // Clear the query parameter from URL without reloading
              const newUrl = window.location.pathname;
              window.history.replaceState({}, '', newUrl);
              // Auto-dismiss after 5 seconds
              setTimeout(() => setViewModeSuccess(''), 5000);
            }
          } catch (err) {
            console.error('Failed to load misting log:', err);
            setError('Failed to load misting log. It may not exist or you may not have permission.');
          }
        } else {
          // Check for instance_id or schedule_id in query params to pre-fill
          const instanceId = searchParams.get('instance_id');
          const scheduleId = searchParams.get('schedule_id');

          if (instanceId) {
            try {
              const instanceRes = await axios.get(`/api/schedule-instances/${instanceId}`);
              const instance = instanceRes.data;
              const schedule = instance.schedule;

              // Pre-fill reptile from schedule
              if (schedule?.reptile_id) {
                setSelectedReptile(schedule.reptile_id);
              }

              // Pre-fill date from instance
              if (instance.scheduled_date) {
                setMistingDate(instance.scheduled_date);
              }

              // Pre-fill time from schedule
              if (schedule?.reminder_time || (schedule?.time_window_enabled && schedule?.earliest_time)) {
                const timeStr = schedule.reminder_time || schedule.earliest_time;
                const [timeHours, timeMinutes] = timeStr.split(':').map(Number);
                setHours(timeHours);
                setMinutes(timeMinutes);
                setPeriod(timeHours >= 12 ? 'PM' : 'AM');
                setMistingTime(timeStr);
              }
            } catch (instanceErr) {
              console.error('Failed to load instance for pre-fill:', instanceErr);
            }
          } else if (scheduleId) {
            try {
              const scheduleRes = await axios.get(`/api/schedules/${scheduleId}`);
              const schedule = scheduleRes.data;

              // Pre-fill reptile from schedule
              if (schedule.reptile_id) {
                setSelectedReptile(schedule.reptile_id);
              }

              // Pre-fill time from schedule
              if (schedule.reminder_time || (schedule.time_window_enabled && schedule.earliest_time)) {
                const timeStr = schedule.reminder_time || schedule.earliest_time;
                const [timeHours, timeMinutes] = timeStr.split(':').map(Number);
                setHours(timeHours);
                setMinutes(timeMinutes);
                setPeriod(timeHours >= 12 ? 'PM' : 'AM');
                setMistingTime(timeStr);
              }
            } catch (scheduleErr) {
              console.error('Failed to load schedule for pre-fill:', scheduleErr);
            }
          }

          // Fallback to defaults if not pre-filled
          if (!selectedReptile) {
            if (reptileId) {
              setSelectedReptile(reptileId);
            } else if (reptilesRes.data.length > 0) {
              setSelectedReptile(reptilesRes.data[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch reptiles:", err);
      }
    };
    fetchData();
  }, [reptileId, id, searchParams]);

  const loadLogData = (log) => {
    setSelectedReptile(log.reptile_id);
    setNotes(log.notes || '');

    // Parse the misted_at datetime
    const mistedAtDate = new Date(log.misted_at);
    setMistingDate(mistedAtDate.toISOString().slice(0, 10));

    const hour = mistedAtDate.getHours();
    const minute = mistedAtDate.getMinutes();

    setHours(hour);
    setMinutes(minute);
    setPeriod(hour >= 12 ? 'PM' : 'AM');
  };

  // Update mistingTime whenever hours/minutes/period change
  useEffect(() => {
    let hour24 = hours;
    if (timeFormat === '12h') {
      if (period === 'PM' && hours !== 12) {
        hour24 = hours + 12;
      } else if (period === 'AM' && hours === 12) {
        hour24 = 0;
      }
    }
    const timeString = `${String(hour24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    setMistingTime(timeString);
  }, [hours, minutes, period, timeFormat]);

  // Reset form when navigating from /misting/:id to /misting
  useEffect(() => {
    if (!id && mode !== 'create') {
      // Reset to create mode
      setMode('create');
      setExistingLog(null);
      setError('');
      setSuccess('');

      // Reset form to defaults
      setSelectedReptile(reptileId || (reptiles.length > 0 ? reptiles[0].id : ''));
      setMistingDate(new Date().toISOString().slice(0, 10));
      const now = new Date();
      setHours(now.getHours());
      setMinutes(now.getMinutes());
      setPeriod(now.getHours() >= 12 ? 'PM' : 'AM');
      setNotes('');
    }
  }, [id, mode, reptiles, reptileId]);

  const handleHoursChange = (value) => {
    const numValue = parseInt(value) || 0;
    if (timeFormat === '12h') {
      setHours(Math.max(1, Math.min(12, numValue)));
    } else {
      setHours(Math.max(0, Math.min(23, numValue)));
    }
  };

  const handleMinutesChange = (value) => {
    const numValue = parseInt(value) || 0;
    setMinutes(Math.max(0, Math.min(59, numValue)));
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this misting log?')) return;

    try {
      await axios.delete(`/api/misting/${id}`);
      setSuccess('Misting log deleted successfully!');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      console.error('Failed to delete misting log:', err);
      setError(err.response?.data?.detail || 'Failed to delete misting log. You may not have permission.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedReptile) {
      setError("Please select a reptile.");
      return;
    }

    const dateTimeString = `${mistingDate}T${mistingTime}`;

    try {
      if (mode === 'edit') {
        const response = await axios.patch(`/api/misting/${id}`, {
          misted_at: new Date(dateTimeString).toISOString(),
          notes,
        });
        setSuccess('Misting log updated successfully!');
        // Redirect to read-only view
        setTimeout(() => navigate(`/misting/${id}`), 1500);
      } else {
        const response = await axios.post('/api/misting', {
          reptile_id: parseInt(selectedReptile),
          misted_at: new Date(dateTimeString).toISOString(),
          notes,
        });
        setSuccess(`Misting logged for ${reptiles.find(r => r.id === parseInt(selectedReptile))?.name}.`);
        // Redirect to read-only view
        setTimeout(() => navigate(`/misting/${response.data.id}?success=created`), 1500);
      }
    } catch (err) {
      console.error("Failed to submit misting log:", err);
      setError(err.response?.data?.detail || "An unexpected error occurred.");
    }
  };

  // VIEW MODE
  if (mode === 'view' && existingLog) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">View Misting Log</h1>
          <div className="flex gap-2">
            <button onClick={() => setMode('edit')} className="btn-primary flex items-center gap-2">
              <Edit2 size={18} /> Edit
            </button>
            <button onClick={handleDelete} className="btn-secondary text-red-600 dark:text-red-400 flex items-center gap-2">
              <Trash2 size={18} /> Delete
            </button>
          </div>
        </div>

        {error && <p className="text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg mb-4 border border-red-200 dark:border-red-800">{error}</p>}
        {success && <p className="text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-900/30 p-3 rounded-lg mb-4 border border-green-200 dark:border-green-800">{success}</p>}
        {viewModeSuccess && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-green-800 dark:text-green-200">{viewModeSuccess}</p>
          </div>
        )}

        <div className="card space-y-6">
          <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Logged at</p>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {formatDateTime(existingLog.created_at || existingLog.misted_at)}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Reptile</p>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {reptiles.find(r => r.id === existingLog.reptile_id)?.name || existingLog.reptile?.name || 'Unknown'}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Misted at</p>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {formatDateTime(existingLog.misted_at)}
            </p>
          </div>

          {existingLog.notes && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Notes</p>
              <p className="text-gray-900 dark:text-white">{existingLog.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // CREATE/EDIT MODE
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        {mode === 'edit' ? 'Edit Misting Log' : 'Log Misting'}
      </h1>
      {error && <p className="text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg mb-4 border border-red-200 dark:border-red-800">{error}</p>}
      {success && <p className="text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-900/30 p-3 rounded-lg mb-4 border border-green-200 dark:border-green-800">{success}</p>}

      {mode === 'edit' && existingLog && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-blue-900 dark:text-blue-100 text-sm">
            Originally logged at {formatDateTime(existingLog.created_at || existingLog.misted_at)}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label htmlFor="reptile" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">Reptile</label>
          <select
            id="reptile"
            value={selectedReptile}
            onChange={e => setSelectedReptile(e.target.value)}
            className="input"
            required
            disabled={mode === 'edit'}
          >
            {reptiles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="mistingDate" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">Date</label>
            <DateInput
              id="mistingDate"
              value={mistingDate}
              onChange={e => setMistingDate(e.target.value)}
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block font-medium mb-1 text-gray-700 dark:text-gray-300">Time ({timeFormat === '12h' ? '12h' : '24h'})</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={hours}
                onChange={e => handleHoursChange(e.target.value)}
                className="input w-20 text-center"
                min={timeFormat === '12h' ? 1 : 0}
                max={timeFormat === '12h' ? 12 : 23}
                required
              />
              <span className="flex items-center text-xl font-bold text-gray-700 dark:text-gray-300">:</span>
              <input
                type="number"
                value={String(minutes).padStart(2, '0')}
                onChange={e => handleMinutesChange(e.target.value)}
                className="input w-20 text-center"
                min="0"
                max="59"
                required
              />
              {timeFormat === '12h' && (
                <select
                  value={period}
                  onChange={e => setPeriod(e.target.value)}
                  className="input w-20"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              )}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">Notes (optional)</label>
          <textarea
            id="notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows="3"
            className="input"
            placeholder="e.g., increased humidity for shedding"
          />
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary flex-1">
            {mode === 'edit' ? 'Update Misting Log' : 'Save Misting Log'}
          </button>
          {mode === 'edit' && (
            <button
              type="button"
              onClick={() => setMode('view')}
              className="btn-secondary"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
