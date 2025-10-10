import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function ReptileForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = id !== 'new';

    const [name, setName] = useState('');
    const [species, setSpecies] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isEditing && id) {
            axios.get(`/api/reptiles/${id}`)
                .then(res => {
                    setName(res.data.name);
                    setSpecies(res.data.species);
                })
                .catch(err => {
                    console.error("Failed to fetch reptile for editing:", err);
                    setError("Could not load reptile data.");
                });
        }
    }, [id, isEditing]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = { name, species };

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
            <h1 className="text-3xl font-bold mb-6">{isEditing ? 'Edit Reptile' : 'Add New Reptile'}</h1>
            {error && <p className="text-red-500 bg-red-100 p-3 rounded-lg mb-4">{error}</p>}
            <form onSubmit={handleSubmit} className="card space-y-4">
                <div>
                    <label htmlFor="name" className="block font-medium mb-1">Name</label>
                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="input"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="species" className="block font-medium mb-1">Species</label>
                    <input
                        id="species"
                        type="text"
                        value={species}
                        onChange={(e) => setSpecies(e.target.value)}
                        className="input"
                        required
                    />
                </div>
                <button type="submit" className="btn-primary w-full py-2">
                    {isEditing ? 'Save Changes' : 'Create Reptile'}
                </button>
            </form>
        </div>
    );
}