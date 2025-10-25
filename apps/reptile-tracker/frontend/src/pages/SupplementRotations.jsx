import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, AlertCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import FeedingRotationManager from '../components/FeedingRotationManager';

function SupplementRotations() {
  const navigate = useNavigate();
  const [reptiles, setReptiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedReptiles, setExpandedReptiles] = useState(new Set());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const reptilesResponse = await axios.get('/api/reptiles', { withCredentials: true });
      setReptiles(reptilesResponse.data);

      // Expand the first reptile by default
      if (reptilesResponse.data.length > 0) {
        setExpandedReptiles(new Set([reptilesResponse.data[0].id]));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load reptiles');
    } finally {
      setLoading(false);
    }
  }

  function toggleReptile(reptileId) {
    const newExpanded = new Set(expandedReptiles);
    if (newExpanded.has(reptileId)) {
      newExpanded.delete(reptileId);
    } else {
      newExpanded.add(reptileId);
    }
    setExpandedReptiles(newExpanded);
  }

  function toggleAll() {
    if (expandedReptiles.size === reptiles.length) {
      // Collapse all
      setExpandedReptiles(new Set());
    } else {
      // Expand all
      setExpandedReptiles(new Set(reptiles.map(r => r.id)));
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Supplement Rotations
          </h1>
          {reptiles.length > 1 && (
            <button
              onClick={toggleAll}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              {expandedReptiles.size === reptiles.length ? (
                <>
                  <ChevronUp size={16} />
                  Collapse All
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  Expand All
                </>
              )}
            </button>
          )}
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Manage supplement schedules and food replacements for your reptiles
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 flex items-start gap-3">
        <AlertCircle className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={20} />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium mb-1">About Supplement Rotations</p>
          <p>
            Rotations automatically suggest supplements or food replacements based on feeding schedules.
            Configure rotations for each reptile below, and they'll appear as suggestions when logging feedings.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : reptiles.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <RefreshCw size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">No reptiles found</p>
          <button
            onClick={() => navigate('/reptiles/new')}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg inline-flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            Add Your First Reptile
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {reptiles.map(reptile => {
            const isExpanded = expandedReptiles.has(reptile.id);

            return (
              <div
                key={reptile.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Reptile Header - Clickable to expand/collapse */}
                <button
                  onClick={() => toggleReptile(reptile.id)}
                  className="w-full bg-gray-50 dark:bg-gray-750 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="text-left">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      {reptile.name}
                      {!isExpanded && (
                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                          Click to manage rotations
                        </span>
                      )}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {reptile.species}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronUp size={24} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={24} className="text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Rotation Manager - Shown when expanded */}
                {isExpanded && (
                  <div className="p-6">
                    <FeedingRotationManager
                      reptileId={reptile.id}
                      reptileName={reptile.name}
                      autoShowPreview={true}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SupplementRotations;
