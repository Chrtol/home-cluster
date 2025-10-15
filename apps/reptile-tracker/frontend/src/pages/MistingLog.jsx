import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getUserTimeFormat } from '../utils/dateFormatting';
import DateInput from '../components/DateInput';

export default function MistingLog() {
  const navigate = useNavigate();
  const { reptileId } = useParams();

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
        if (reptileId) {
          setSelectedReptile(reptileId);
        } else if (res.data.length > 0) {
          setSelectedReptile(res.data[0].id);
        }
      })
      .catch(err => console.error("Failed to fetch reptiles:", err));
  }, [reptileId]);

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

    const dateTimeString = `${mistingDate}T${mistingTime}`;

    try {
      await axios.post('/api/misting', {
        reptile_id: parseInt(selectedReptile),
        misted_at: new Date(dateTimeString).toISOString(),
        notes,
      });
      setSuccess(`Misting logged for ${reptiles.find(r => r.id === parseInt(selectedReptile))?.name}.`);
      setNotes('');
    } catch (err) {
      console.error("Failed to submit misting log:", err);
      setError(err.response?.data?.detail || "An unexpected error occurred.");
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Log Misting</h1>
      {error && <p className="text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg mb-4 border border-red-200 dark:border-red-800">{error}</p>}
      {success && <p className="text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-900/30 p-3 rounded-lg mb-4 border border-green-200 dark:border-green-800">{success}</p>}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label htmlFor="reptile" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">Reptile</label>
          <select
            id="reptile"
            value={selectedReptile}
            onChange={e => setSelectedReptile(e.target.value)}
            className="input"
            required
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

        <button type="submit" className="btn-primary w-full">Save Misting Log</button>
      </form>
    </div>
  );
}
