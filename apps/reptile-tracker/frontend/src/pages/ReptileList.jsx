import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '/src/api/axios';
import { Plus } from 'lucide-react';

export default function ReptileList() {
  const [reptiles, setReptiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReptiles = async () => {
      try {
        const response = await apiClient.get('/api/reptiles');
        setReptiles(response.data);
      } catch (error) {
        console.error('Failed to fetch reptiles:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReptiles();
  }, []);

  const handleDelete = (id, e) => {
    e.preventDefault(); // Prevent navigation
    if (window.confirm('Are you sure you want to delete this reptile?')) {
      apiClient.delete(`/api/reptiles/${id}`)
        .then(() => {
          setReptiles(reptiles.filter(reptile => reptile.id !== id));
        })
        .catch(error => {
          console.error('Error deleting reptile:', error);
        });
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
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link to={`/reptiles/${reptile.id}/edit`} className="btn-secondary p-2 h-8 w-8" onClick={(e) => e.stopPropagation()}>Edit</Link>
                <button onClick={(e) => handleDelete(reptile.id, e)} className="btn-danger p-2 h-8 w-8">Del</button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}