import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';

const ReptileCard = ({ reptile }) => (
  <Link to={`/reptiles/${reptile.id}`} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
    <div className="flex flex-col h-full">
      <div className="flex-grow">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{reptile.name}</h3>
        <p className="text-gray-600 dark:text-gray-400">{reptile.species}</p>
      </div>
      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        <p>Access: <span className="font-medium capitalize">{reptile.access_level}</span></p>
      </div>
    </div>
  </Link>
);

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

  if (loading) {
    return <div className="text-center text-gray-700 dark:text-gray-300">Loading reptiles...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Reptiles</h1>
        <Link to="/reptiles/new" className="btn-primary flex items-center gap-2">
          <PlusCircle size={20} /> Add Reptile
        </Link>
      </div>
      {reptiles.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {reptiles.map(reptile => (
            <ReptileCard key={reptile.id} reptile={reptile} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-gray-500 dark:text-gray-400 text-lg">You haven't added any reptiles yet.</p>
        </div>
      )}
    </div>
  );
}