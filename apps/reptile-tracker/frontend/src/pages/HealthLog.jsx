import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { getUserTimeFormat } from '../utils/dateFormatting';
import DateInput from '../components/DateInput';

export default function HealthLog() {
  const navigate = useNavigate();
  const { reptileId } = useParams(); // Get reptileId from URL

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

  // Time input format state
  const [timeFormat, setTimeFormat] = useState('24h');
  const [hours, setHours] = useState(new Date().getHours());
  const [minutes, setMinutes] = useState(new Date().getMinutes());
  const [period, setPeriod] = useState(new Date().getHours() >= 12 ? 'PM' : 'AM');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
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

    axios.get('/api/reptiles')
      .then(res => {
        setReptiles(res.data);
        // Use the ID from the URL if it exists, otherwise default to the first reptile
        if (reptileId) {
          setSelectedReptile(reptileId);
        } else if (res.data.length > 0) {
          setSelectedReptile(res.data[0].id);
        }
      })
      .catch(err => console.error("Failed to fetch reptiles:", err));
  }, [reptileId]);

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
      if (logType === 'weight') {
        await axios.post('/api/weight', {
          reptile_id: parseInt(selectedReptile),
          weight_grams: parseFloat(weight),
          measured_at: new Date(dateTimeString).toISOString(),
          notes,
        });
        setSuccess(`Weight logged for ${reptiles.find(r => r.id === parseInt(selectedReptile))?.name}.`);
      } else {
        await axios.post('/api/health', {
          reptile_id: parseInt(selectedReptile),
          record_type: recordType,
          title,
          description: notes,
          date: new Date(dateTimeString).toISOString(),
        });
        setSuccess(`Health record logged for ${reptiles.find(r => r.id === parseInt(selectedReptile))?.name}.`);
      }
      // Reset form partially
      setWeight('');
      setTitle('');
      setNotes('');
    } catch (err) {
      console.error("Failed to submit log:", err);
      setError(err.response?.data?.detail || "An unexpected error occurred.");
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Log Health & Weight</h1>
      {error && <p className="text-red-500 bg-red-100 p-3 rounded mb-4">{error}</p>}
      {success && <p className="text-green-500 bg-green-100 p-3 rounded mb-4">{success}</p>}
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label htmlFor="reptile" className="block font-medium mb-1">Reptile</label>
          <select id="reptile" value={selectedReptile} onChange={e => setSelectedReptile(e.target.value)} className="input" required>
            {reptiles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        <div>
            <label className="block font-medium mb-1">Log Type</label>
            <div className="flex gap-4">
                <button type="button" onClick={() => setLogType('weight')} className={logType === 'weight' ? 'btn-primary' : 'btn-secondary'}>Weight</button>
                <button type="button" onClick={() => setLogType('health')} className={logType === 'health' ? 'btn-primary' : 'btn-secondary'}>Health Record</button>
            </div>
        </div>

        {logType === 'weight' ? (
          <div>
            <label htmlFor="weight" className="block font-medium mb-1">Weight (grams)</label>
            <input id="weight" type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} className="input" required />
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="title" className="block font-medium mb-1">Title</label>
              <input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} className="input" required />
            </div>
            <div>
              <label htmlFor="recordType" className="block font-medium mb-1">Record Type</label>
              <select id="recordType" value={recordType} onChange={e => setRecordType(e.target.value)} className="input">
                <option value="observation">Observation</option>
                <option value="vet_visit">Vet Visit</option>
                <option value="medication">Medication</option>
              </select>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label htmlFor="logDate" className="block font-medium mb-1">Date</label>
                <DateInput
                    id="logDate"
                    value={logDate}
                    onChange={e => setLogDate(e.target.value)}
                    className="input w-full"
                    required
                />
            </div>
            <div>
                <label className="block font-medium mb-1">Time ({timeFormat === '12h' ? '12h' : '24h'})</label>
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
            <label htmlFor="notes" className="block font-medium mb-1">Notes (optional)</label>
            <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows="3" className="input" placeholder={logType === 'weight' ? 'e.g., after shedding' : 'e.g., noticed a small scratch'}/>
        </div>

        <button type="submit" className="btn-primary w-full">Save Log</button>
      </form>
    </div>
  );
}