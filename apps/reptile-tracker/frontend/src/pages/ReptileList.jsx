import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Plus, Eye, EyeOff, Home } from 'lucide-react';
import ReptileAvatar from '../components/ReptileAvatar';

export default function ReptileList() {
  const [reptiles, setReptiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hiddenHouseholds, setHiddenHouseholds] = useState(new Set());

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

  // Group reptiles by household
  const groupedReptiles = reptiles.reduce((groups, reptile) => {
    const householdKey = reptile.household?.id || 'no_household';
    const householdName = reptile.household?.name || 'No Household';

    if (!groups[householdKey]) {
      groups[householdKey] = {
        id: householdKey,
        name: householdName,
        reptiles: [],
      };
    }
    groups[householdKey].reptiles.push(reptile);
    return groups;
  }, {});

  const households = Object.values(groupedReptiles).sort((a, b) => {
    // Sort "No Household" last
    if (a.id === 'no_household') return 1;
    if (b.id === 'no_household') return -1;
    return a.name.localeCompare(b.name);
  });

  const toggleHousehold = (householdId) => {
    const newHidden = new Set(hiddenHouseholds);
    if (newHidden.has(householdId)) {
      newHidden.delete(householdId);
    } else {
      newHidden.add(householdId);
    }
    setHiddenHouseholds(newHidden);
  };

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

      {/* Household Filters */}
      {households.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {households.map(household => (
            <button
              key={household.id}
              onClick={() => toggleHousehold(household.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                hiddenHouseholds.has(household.id)
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  : 'bg-blue-500 text-white'
              }`}
            >
              {hiddenHouseholds.has(household.id) ? <EyeOff size={16} /> : <Eye size={16} />}
              {household.id !== 'no_household' && <Home size={16} />}
              {household.name} ({household.reptiles.length})
            </button>
          ))}
        </div>
      )}

      {reptiles.length === 0 ? (
        <div className="text-center py-12 card">
          <h2 className="text-xl font-medium text-gray-900 dark:text-white">No reptiles found</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Get started by adding your first reptile.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {households.map(household => {
            // Skip hidden households
            if (hiddenHouseholds.has(household.id)) return null;

            return (
              <div key={household.id}>
                {/* Household Header */}
                <div className="mb-4">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    {household.id !== 'no_household' && <Home size={24} className="text-blue-500" />}
                    {household.name}
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                      ({household.reptiles.length} {household.reptiles.length === 1 ? 'reptile' : 'reptiles'})
                    </span>
                  </h2>
                  <div className="mt-1 h-0.5 bg-gradient-to-r from-blue-500 to-transparent"></div>
                </div>

                {/* Reptile Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {household.reptiles.map(reptile => (
                    <Link
                      to={`/reptiles/${reptile.id}`}
                      key={reptile.id}
                      className="card group relative hover:shadow-lg hover:border-primary-500/50 transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <ReptileAvatar reptile={reptile} size="lg" className="flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{reptile.name}</h3>
                          <p className="text-gray-600 dark:text-gray-400">{reptile.species}</p>
                          {reptile.date_of_birth && (
                            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                              Age: {calculateAge(reptile.date_of_birth)}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}