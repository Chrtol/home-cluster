import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Edit2, Trash2, Plus } from 'lucide-react';
import { getUserTimeFormat, formatDateTime } from '../utils/dateFormatting';
import DateInput from '../components/DateInput';

export default function HealthLog() {
  const navigate = useNavigate();
  const { reptileId, id, type } = useParams(); // Get reptileId, id, and type from URL

  // Mode state
  const [mode, setMode] = useState('create'); // create, view, edit
  const [existingLog, setExistingLog] = useState(null);

  const [reptiles, setReptiles] = useState([]);
  const [logType, setLogType] = useState('weight');
  const [selectedReptile, setSelectedReptile] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logTime, setLogTime] = useState(new Date().toTimeString().slice(0, 5));
  const [notes, setNotes] = useState('');
  // Weight specific
  const [weight, setWeight] = useState('');
  // Health specific
  const [recordType, setRecordType] = useState('observation');
  const [title, setTitle] = useState('');
  // Bowel movement specific
  const [consistency, setConsistency] = useState('normal');

  // Time input format state
  const [timeFormat, setTimeFormat] = useState('24h');
  const [hours, setHours] = useState(new Date().getHours());
  const [minutes, setMinutes] = useState(new Date().getMinutes());
  const [period, setPeriod] = useState(new Date().getHours() >= 12 ? 'PM' : 'AM');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

        // Check if we're viewing/editing an existing log
        if (id && !isNaN(id) && type) {
          try {
            let logRes;
            if (type === 'weight') {
              logRes = await axios.get(`/api/weight/${id}`);
              setLogType('weight');
            } else if (type === 'health') {
              logRes = await axios.get(`/api/health/${id}`);
              setLogType('health');
            }
            setExistingLog(logRes.data);
            setMode('view');
            loadLogData(logRes.data, type);
          } catch (err) {
            console.error('Failed to load log:', err);
            setError('Failed to load log. It may not exist or you may not have permission.');
          }
        } else {
          // Use the ID from the URL if it exists, otherwise default to the first reptile
          if (reptileId) {
            setSelectedReptile(reptileId);
          } else if (reptilesRes.data.length > 0) {
            setSelectedReptile(reptilesRes.data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch reptiles:", err);
      }
    };
    fetchData();
  }, [reptileId, id, type]);

  const loadLogData = (log, logType) => {
    setSelectedReptile(log.reptile_id);
    setNotes(log.notes || '');

    if (logType === 'weight') {
      setWeight(log.weight_grams);
      const measuredAtDate = new Date(log.measured_at);
      setLogDate(measuredAtDate.toISOString().slice(0, 10));
      const hour = measuredAtDate.getHours();
      const minute = measuredAtDate.getMinutes();
      setHours(hour);
      setMinutes(minute);
      setPeriod(hour >= 12 ? 'PM' : 'AM');
    } else if (logType === 'health') {
      setRecordType(log.record_type);
      setTitle(log.title);
      if (log.consistency) {
        setConsistency(log.consistency);
      }
      const logDateObj = new Date(log.date);
      setLogDate(logDateObj.toISOString().slice(0, 10));
      const hour = logDateObj.getHours();
      const minute = logDateObj.getMinutes();
      setHours(hour);
      setMinutes(minute);
      setPeriod(hour >= 12 ? 'PM' : 'AM');
    }
  };

  // Update logTime whenever hours/minutes/period change
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
    setLogTime(timeString);
  }, [hours, minutes, period, timeFormat]);

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
    if (!window.confirm(`Are you sure you want to delete this ${logType === 'weight' ? 'weight' : 'health'} log?`)) return;

    try {
      if (logType === 'weight') {
        await axios.delete(`/api/weight/${id}`);
      } else {
        await axios.delete(`/api/health/${id}`);
      }
      setSuccess('Log deleted successfully!');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      console.error('Failed to delete log:', err);
      setError(err.response?.data?.detail || 'Failed to delete log. You may not have permission.');
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

    const dateTimeString = `${logDate}T${logTime}`;

    try {
      if (mode === 'edit') {
        // Edit existing log
        if (logType === 'weight') {
          await axios.patch(`/api/weight/${id}`, {
            weight_grams: parseFloat(weight),
            measured_at: new Date(dateTimeString).toISOString(),
            notes,
          });
          setSuccess('Weight log updated successfully!');
        } else {
          const payload = {
            record_type: recordType,
            title,
            description: notes,
            date: new Date(dateTimeString).toISOString(),
          };
          if (recordType === 'bowel_movement') {
            payload.consistency = consistency;
          }
          await axios.patch(`/api/health/${id}`, payload);
          setSuccess('Health record updated successfully!');
        }
        setMode('view');
        // Reload the log data
        const logRes = await axios.get(logType === 'weight' ? `/api/weight/${id}` : `/api/health/${id}`);
        setExistingLog(logRes.data);
        loadLogData(logRes.data, logType);
      } else {
        // Create new log
        if (logType === 'weight') {
          const response = await axios.post('/api/weight', {
            reptile_id: parseInt(selectedReptile),
            weight_grams: parseFloat(weight),
            measured_at: new Date(dateTimeString).toISOString(),
            notes,
          });
          setSuccess(`Weight logged for ${reptiles.find(r => r.id === parseInt(selectedReptile))?.name}.`);
          setTimeout(() => navigate(`/health-log/weight/${response.data.id}`), 1500);
        } else {
          const payload = {
            reptile_id: parseInt(selectedReptile),
            record_type: recordType,
            title,
            description: notes,
            date: new Date(dateTimeString).toISOString(),
          };
          if (recordType === 'bowel_movement') {
            payload.consistency = consistency;
          }
          const response = await axios.post('/api/health', payload);
          setSuccess(`Health record logged for ${reptiles.find(r => r.id === parseInt(selectedReptile))?.name}.`);
          setTimeout(() => navigate(`/health-log/health/${response.data.id}`), 1500);
        }
      }
    } catch (err) {
      console.error("Failed to submit log:", err);
      setError(err.response?.data?.detail || "An unexpected error occurred.");
    }
  };

  // VIEW MODE
  if (mode === 'view' && existingLog) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            View {logType === 'weight' ? 'Weight' : 'Health'} Log
          </h1>
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

        <div className="card space-y-6">
          <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Logged at</p>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {formatDateTime(existingLog.created_at || existingLog.measured_at || existingLog.date)}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Reptile</p>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {reptiles.find(r => r.id === existingLog.reptile_id)?.name || existingLog.reptile?.name || 'Unknown'}
            </p>
          </div>

          {logType === 'weight' ? (
            <>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Weight</p>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {existingLog.weight_grams}g
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Measured at</p>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {formatDateTime(existingLog.measured_at)}
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Title</p>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {existingLog.title}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Record Type</p>
                <p className="text-lg font-medium text-gray-900 dark:text-white capitalize">
                  {existingLog.record_type.replace('_', ' ')}
                </p>
              </div>
              {existingLog.consistency && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Consistency</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white capitalize">
                    {existingLog.consistency}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Date</p>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {formatDateTime(existingLog.date)}
                </p>
              </div>
            </>
          )}

          {existingLog.notes && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Notes</p>
              <p className="text-gray-900 dark:text-white">{existingLog.notes}</p>
            </div>
          )}
          {existingLog.description && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Description</p>
              <p className="text-gray-900 dark:text-white">{existingLog.description}</p>
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
        {mode === 'edit' ? `Edit ${logType === 'weight' ? 'Weight' : 'Health'} Log` : 'Log Health'}
      </h1>
      {error && <p className="text-red-500 bg-red-100 p-3 rounded mb-4">{error}</p>}
      {success && <p className="text-green-500 bg-green-100 p-3 rounded mb-4">{success}</p>}

      {mode === 'edit' && existingLog && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-blue-900 dark:text-blue-100 text-sm">
            Originally logged at {formatDateTime(existingLog.created_at || existingLog.measured_at || existingLog.date)}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label htmlFor="reptile" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">Reptile</label>
          <select id="reptile" value={selectedReptile} onChange={e => setSelectedReptile(e.target.value)} className="input" required disabled={mode === 'edit'}>
            {reptiles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        <div>
            <label className="block font-medium mb-2 text-gray-700 dark:text-gray-300">Log Type</label>
            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setLogType('weight')} disabled={mode === 'edit'} className={`px-4 py-2 rounded-lg font-medium transition-colors ${logType === 'weight' ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'} ${mode === 'edit' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  Weight
                </button>
                <button type="button" onClick={() => setLogType('health')} disabled={mode === 'edit'} className={`px-4 py-2 rounded-lg font-medium transition-colors ${logType === 'health' ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'} ${mode === 'edit' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  Health Record
                </button>
            </div>
        </div>

        {logType === 'weight' ? (
          <div>
            <label htmlFor="weight" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">Weight (grams)</label>
            <input id="weight" type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} className="input" required />
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="recordType" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">Record Type</label>
              <select id="recordType" value={recordType} onChange={e => setRecordType(e.target.value)} className="input">
                <option value="observation">General Observation</option>
                <option value="shedding">Shedding</option>
                <option value="bowel_movement">Bowel Movement</option>
                <option value="vet_visit">Vet Visit</option>
                <option value="medication">Medication</option>
              </select>
            </div>
            <div>
              <label htmlFor="title" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">Title</label>
              <input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder={recordType === 'shedding' ? 'e.g., Complete shed' : recordType === 'bowel_movement' ? 'e.g., Morning bowel movement' : 'Brief description'} required />
            </div>
            {recordType === 'bowel_movement' && (
              <div>
                <label htmlFor="consistency" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">Consistency</label>
                <select id="consistency" value={consistency} onChange={e => setConsistency(e.target.value)} className="input">
                  <option value="normal">Normal</option>
                  <option value="soft">Soft</option>
                  <option value="hard">Hard</option>
                  <option value="watery">Watery</option>
                  <option value="mucus">Mucus Present</option>
                </select>
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label htmlFor="logDate" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">Date</label>
                <DateInput
                    id="logDate"
                    value={logDate}
                    onChange={e => setLogDate(e.target.value)}
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
            <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows="3" className="input" placeholder={logType === 'weight' ? 'e.g., after shedding' : recordType === 'bowel_movement' ? 'Additional observations...' : 'e.g., noticed a small scratch'}/>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary flex-1">
            {mode === 'edit' ? 'Update Log' : 'Save Log'}
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