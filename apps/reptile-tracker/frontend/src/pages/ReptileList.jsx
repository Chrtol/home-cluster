import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Plus } from 'lucide-react';

export default function ReptileList() {
  const [reptiles, setReptiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReptiles = async () => {
      try {
        const response = await axios.get('/api/reptiles');
        setReptiles(response.data);
      } catch (error) {
        console.error('Failed to fetch reptiles:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReptiles();
  }, []);

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    const birth = new Date(dateOfBirth);
    const today = new Date();
    const diffTime = Math.abs(today - birth);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    const days = Math.floor((diffDays % 365) % 30);

    if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''}${months > 0 ? `, ${months} month${months > 1 ? 's' : ''}` : ''}`;
    } else if (months > 0) {
      return `${months} month${months > 1 ? 's' : ''}${days > 0 ? `, ${days} day${days > 1 ? 's' : ''}` : ''}`;
    } else {
      return `${days} day${days > 1 ? 's' : ''}`;
    }
  };

  if (loading) {
    return <div className="text-center text-gray-700 dark:text-gray-300">Loading reptiles...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Your Reptiles</h1>
        <Link to="/reptiles/new" className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          Add Reptile
        </Link>
      </div>

      {reptiles.length === 0 ? (
        <div className="text-center py-12 card">
          <h2 className="text-xl font-medium text-gray-900 dark:text-white">No reptiles found</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Get started by adding your first reptile.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {reptiles.map(reptile => (
            <Link to={`/reptiles/${reptile.id}`} key={reptile.id} className="card group relative hover:shadow-lg hover:border-primary-500/50 transition-all">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{reptile.name}</h2>
              <p className="text-gray-600 dark:text-gray-400">{reptile.species}</p>
              {reptile.date_of_birth && (
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  Age: {calculateAge(reptile.date_of_birth)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}