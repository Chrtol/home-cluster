import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

export default function HealthLog() {
  const navigate = useNavigate();
  const { reptileId } = useParams(); // Get reptileId from URL

  const [reptiles, setReptiles] = useState([]);
  const [logType, setLogType] = useState('weight');
  const [selectedReptile, setSelectedReptile] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');
  // Weight specific
  const [weight, setWeight] = useState('');
  // Health specific
  const [recordType, setRecordType] = useState('observation');
  const [title, setTitle] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedReptile) {
      setError("Please select a reptile.");
      return;
    }

    try {
      if (logType === 'weight') {
        await axios.post('/api/weight', {
          reptile_id: parseInt(selectedReptile),
          weight_grams: parseFloat(weight),
          measured_at: new Date(date).toISOString(),
          notes,
        });
        setSuccess(`Weight logged for ${reptiles.find(r => r.id === parseInt(selectedReptile))?.name}.`);
      } else {
        await axios.post('/api/health', {
          reptile_id: parseInt(selectedReptile),
          record_type: recordType,
          title,
          description: notes,
          date: new Date(date).toISOString(),
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

        <div>
            <label htmlFor="date" className="block font-medium mb-1">Date & Time</label>
            <input id="date" type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="input" required />
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