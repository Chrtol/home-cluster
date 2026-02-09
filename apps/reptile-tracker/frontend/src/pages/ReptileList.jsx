import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Plus, Home, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
    return <div className="text-center text-muted-foreground">Loading reptiles...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-foreground">Your Reptiles</h1>
        <Link to="/reptiles/new" className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          Add Reptile
        </Link>
      </div>

      {/* Household Filters */}
      {households.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {households.map(household => (
            <button
              key={household.id}
              onClick={() => toggleHousehold(household.id)}
              className="group"
            >
              <Badge
                variant={hiddenHouseholds.has(household.id) ? 'secondary' : 'default'}
                className={cn(
                  'cursor-pointer transition-colors gap-1.5 px-2.5 py-1',
                  !hiddenHouseholds.has(household.id) && 'bg-primary hover:bg-primary/80',
                  hiddenHouseholds.has(household.id) && 'opacity-60 hover:opacity-100'
                )}
              >
                {household.id !== 'no_household' && <Home className="w-3 h-3" />}
                {household.name}
                <span className="ml-1 opacity-70">({household.reptiles.length})</span>
              </Badge>
            </button>
          ))}
        </div>
      )}

      {reptiles.length === 0 ? (
        <div className="text-center py-12 card">
          <h2 className="text-xl font-medium text-foreground">No reptiles found</h2>
          <p className="text-muted-foreground mt-2">Get started by adding your first reptile.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {households.map(household => {
            // Skip hidden households
            if (hiddenHouseholds.has(household.id)) return null;

            return (
              <div key={household.id}>
                {/* Household Header */}
                <div className="mb-3">
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    {household.id !== 'no_household' && <Home size={20} className="text-blue-500" />}
                    {household.name}
                    <Badge variant="secondary" className="ml-2">
                      {household.reptiles.length}
                    </Badge>
                  </h2>
                  <div className="mt-1 h-px bg-gradient-to-r from-border to-transparent"></div>
                </div>

                {/* Reptile Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {household.reptiles.map(reptile => (
                    <Link
                      to={`/reptiles/${reptile.id}`}
                      key={reptile.id}
                      className="bg-card rounded-xl border border-border p-3 hover:border-primary/50 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <ReptileAvatar reptile={reptile} size="md" className="flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors mb-0.5">
                            {reptile.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mb-2 truncate">{reptile.species}</p>
                          {reptile.date_of_birth && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Calendar className="w-3 h-3 text-primary" />
                              {calculateAge(reptile.date_of_birth)}
                            </div>
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