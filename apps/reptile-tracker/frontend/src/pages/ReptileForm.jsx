import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function ReptileForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id && id !== 'new'; // Correctly determine if editing

    const [name, setName] = useState('');
    const [species, setSpecies] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isEditing) {
            axios.get(`/api/reptiles/${id}`)
                .then(res => {
                    setName(res.data.name);
                    setSpecies(res.data.species);
                    setDateOfBirth(res.data.date_of_birth ? res.data.date_of_birth.split('T')[0] : '');
                    setNotes(res.data.notes || '');
                })
                .catch(err => {
                    console.error("Failed to fetch reptile for editing:", err);
                    setError("Could not load reptile data.");
                });
        }
    }, [id, isEditing]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            name,
            species,
            date_of_birth: dateOfBirth || null,
            notes: notes || null
        };

        try {
            if (isEditing) {
                await axios.patch(`/api/reptiles/${id}`, payload);
            } else {
                await axios.post('/api/reptiles', payload);
            }
            navigate('/reptiles');
        } catch (err) {
            console.error("Failed to save reptile:", err);
            setError("Failed to save reptile. Please try again.");
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">{isEditing ? 'Edit Reptile' : 'Add New Reptile'}</h1>
            {error && <p className="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg mb-4 border border-red-200 dark:border-red-800">{error}</p>}
            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 space-y-4">
                <div>
                    <label htmlFor="name" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">Name</label>
                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="species" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">Species</label>
                    <input
                        id="species"
                        type="text"
                        value={species}
                        onChange={(e) => setSpecies(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="dateOfBirth" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">Date of Birth (optional)</label>
                    <input
                        id="dateOfBirth"
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                </div>
                <div>
                    <label htmlFor="notes" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">Notes (optional)</label>
                    <textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows="4"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Any additional information about your reptile..."
                    />
                </div>
                <button type="submit" className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium">
                    {isEditing ? 'Save Changes' : 'Create Reptile'}
                </button>
            </form>
        </div>
    );
}