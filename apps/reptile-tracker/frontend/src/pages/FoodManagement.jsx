import { useState, useEffect } from 'react';
import axios from 'axios';
import { PlusCircle, Edit2, Trash2, X } from 'lucide-react';

export default function FoodManagement() {
  const [activeTab, setActiveTab] = useState('foods'); // foods, supplements

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Food & Supplement Management</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('foods')}
            className={`py-2 px-4 border-b-2 font-medium text-sm ${
              activeTab === 'foods'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Foods
          </button>
          <button
            onClick={() => setActiveTab('supplements')}
            className={`py-2 px-4 border-b-2 font-medium text-sm ${
              activeTab === 'supplements'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Supplements
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'foods' && <FoodsTab />}
      {activeTab === 'supplements' && <SupplementsTab />}
    </div>
  );
}

// FOODS TAB COMPONENT
function FoodsTab() {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFood, setEditingFood] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    category: 'insect',
    insect_size: '',
    animal_size: '',
    nutritional_data: {}
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchFoods();
  }, []);

  const fetchFoods = async () => {
    try {
      const response = await axios.get('/api/foods');
      setFoods(response.data);
    } catch (error) {
      console.error('Failed to fetch foods:', error);
      setError('Failed to load foods');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingFood(null);
    setFormData({
      name: '',
      category: 'insect',
      insect_size: '',
      animal_size: '',
      nutritional_data: {}
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleEdit = (food) => {
    setEditingFood(food);
    setFormData({
      name: food.name,
      category: food.category,
      insect_size: food.insect_size || '',
      animal_size: food.animal_size || '',
      nutritional_data: food.nutritional_data || {}
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleDelete = async (food) => {
    let confirmMessage = `Are you sure you want to delete "${food.name}"?`;

    if (food.is_default) {
      confirmMessage = `"${food.name}" is a default food. Are you sure you want to delete it? This action cannot be undone.`;
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const url = food.is_default
        ? `/api/foods/${food.id}?force=true`
        : `/api/foods/${food.id}`;

      await axios.delete(url);
      setSuccess('Food deleted successfully');
      fetchFoods();
    } catch (error) {
      console.error('Failed to delete food:', error);
      setError(error.response?.data?.detail || 'Failed to delete food');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Clean up the payload - convert empty strings to null
    const payload = {
      name: formData.name,
      category: formData.category,
      insect_size: formData.insect_size || null,
      animal_size: formData.animal_size || null,
      nutritional_data: Object.keys(formData.nutritional_data).length > 0 ? formData.nutritional_data : null
    };

    try {
      if (editingFood) {
        await axios.put(`/api/foods/${editingFood.id}`, payload);
        setSuccess('Food updated successfully');
      } else {
        await axios.post('/api/foods', payload);
        setSuccess('Food created successfully');
      }
      setShowForm(false);
      fetchFoods();
    } catch (error) {
      console.error('Failed to save food:', error);
      setError(error.response?.data?.detail || 'Failed to save food');
    }
  };

  const filteredFoods = filterCategory
    ? foods.filter(f => f.category === filterCategory)
    : foods;

  if (loading) return <p className="text-center py-12">Loading foods...</p>;

  return (
    <div>
      {error && <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</p>}
      {success && <p className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</p>}

      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 sm:gap-0 mb-6">
        <button onClick={handleCreate} className="btn-primary flex items-center gap-2 justify-center sm:justify-start">
          <PlusCircle size={20} /> Add Food
        </button>

        <div className="w-full sm:w-auto">
          <label className="block font-medium mb-2 text-sm sm:text-base text-gray-900 dark:text-white">Filter by Category</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="input w-full sm:w-64"
          >
            <option value="">All Categories</option>
            <option value="insect">Insects</option>
            <option value="worms">Worms</option>
            <option value="vegetable">Vegetables</option>
            <option value="fruit">Fruits</option>
            <option value="prepared">Prepared Foods</option>
            <option value="frozen_animal">Frozen Animals</option>
            <option value="live_rodent">Live Rodents</option>
            <option value="fish_seafood">Fish/Seafood</option>
            <option value="eggs">Eggs</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Food List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredFoods.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No foods found
                  </td>
                </tr>
              ) : (
                filteredFoods.map(food => (
                  <tr key={food.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {food.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {food.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {food.insect_size || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {food.is_default ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          Default
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          Custom
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(food)}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300 mr-4"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(food)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Food Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {editingFood ? 'Edit Food' : 'Add Food'}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-medium mb-1 text-gray-900 dark:text-white">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 text-gray-900 dark:text-white">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input w-full"
                  >
                    <option value="insect">Insect</option>
                    <option value="worms">Worms</option>
                    <option value="vegetable">Vegetable</option>
                    <option value="fruit">Fruit</option>
                    <option value="prepared">Prepared Food</option>
                    <option value="frozen_animal">Frozen Animal</option>
                    <option value="live_rodent">Live Rodent</option>
                    <option value="fish_seafood">Fish/Seafood</option>
                    <option value="eggs">Eggs</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {formData.category === 'insect' && (
                  <div>
                    <label className="block font-medium mb-1 text-gray-900 dark:text-white">Insect Size</label>
                    <select
                      value={formData.insect_size}
                      onChange={(e) => setFormData({ ...formData, insect_size: e.target.value })}
                      className="input w-full"
                    >
                      <option value="">Select size...</option>
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                )}

                {formData.category === 'frozen_animal' && (
                  <div>
                    <label className="block font-medium mb-1 text-gray-900 dark:text-white">Animal Size</label>
                    <select
                      value={formData.animal_size}
                      onChange={(e) => setFormData({ ...formData, animal_size: e.target.value })}
                      className="input w-full"
                    >
                      <option value="">Select size...</option>
                      <option value="pinky">Pinky (Newborn)</option>
                      <option value="fuzzy">Fuzzy (Young with fur)</option>
                      <option value="hopper">Hopper (Young, mobile)</option>
                      <option value="weaner">Weaner (Juvenile, weaned)</option>
                      <option value="adult_small">Adult Small</option>
                      <option value="adult_medium">Adult Medium</option>
                      <option value="adult_large">Adult Large</option>
                      <option value="jumbo">Jumbo (Large rat/rabbit)</option>
                    </select>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button type="submit" className="flex-1 btn-primary">
                    {editingFood ? 'Update' : 'Create'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn-secondary">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// SUPPLEMENTS TAB COMPONENT
function SupplementsTab() {
  const [supplements, setSupplements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewingSupplement, setViewingSupplement] = useState(null);
  const [editingSupplement, setEditingSupplement] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    nutritional_data: {
      calcium_mg: '',
      vitamin_d3_iu: '',
      vitamin_a_iu: '',
      notes: ''
    }
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchSupplements();
  }, []);

  const fetchSupplements = async () => {
    try {
      const response = await axios.get('/api/supplements');
      setSupplements(response.data);
    } catch (error) {
      console.error('Failed to fetch supplements:', error);
      setError('Failed to load supplements');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSupplement(null);
    setFormData({
      name: '',
      nutritional_data: {
        calcium_mg: '',
        vitamin_d3_iu: '',
        vitamin_a_iu: '',
        notes: ''
      }
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleEdit = (supplement) => {
    setEditingSupplement(supplement);
    const nutritional_data = supplement.nutritional_data || {};
    setFormData({
      name: supplement.name,
      nutritional_data: {
        calcium_mg: nutritional_data.calcium_mg || '',
        vitamin_d3_iu: nutritional_data.vitamin_d3_iu || '',
        vitamin_a_iu: nutritional_data.vitamin_a_iu || '',
        notes: nutritional_data.notes || ''
      }
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleDelete = async (supplement) => {
    let confirmMessage = `Are you sure you want to delete "${supplement.name}"?`;

    if (supplement.is_default) {
      confirmMessage = `"${supplement.name}" is a default supplement. Are you sure you want to delete it? This action cannot be undone.`;
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const url = supplement.is_default
        ? `/api/supplements/${supplement.id}?force=true`
        : `/api/supplements/${supplement.id}`;

      await axios.delete(url);
      setSuccess('Supplement deleted successfully');
      fetchSupplements();
    } catch (error) {
      console.error('Failed to delete supplement:', error);
      setError(error.response?.data?.detail || 'Failed to delete supplement');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Clean up nutritional_data - remove empty values
    const cleanedNutritionalData = {};
    Object.keys(formData.nutritional_data).forEach(key => {
      if (formData.nutritional_data[key]) {
        cleanedNutritionalData[key] = formData.nutritional_data[key];
      }
    });

    const payload = {
      name: formData.name,
      nutritional_data: Object.keys(cleanedNutritionalData).length > 0 ? cleanedNutritionalData : null
    };

    try {
      if (editingSupplement) {
        await axios.put(`/api/supplements/${editingSupplement.id}`, payload);
        setSuccess('Supplement updated successfully');
      } else {
        await axios.post('/api/supplements', payload);
        setSuccess('Supplement created successfully');
      }
      setShowForm(false);
      fetchSupplements();
    } catch (error) {
      console.error('Failed to save supplement:', error);
      setError(error.response?.data?.detail || 'Failed to save supplement');
    }
  };

  if (loading) return <p className="text-center py-12">Loading supplements...</p>;

  return (
    <div>
      {error && <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</p>}
      {success && <p className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</p>}

      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4 mb-6">
        <button onClick={handleCreate} className="btn-primary flex items-center gap-2 justify-center sm:justify-start">
          <PlusCircle size={20} /> Add Supplement
        </button>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center sm:text-right">
          Common supplements: Calcium, Calcium with D3, Multivitamins
        </p>
      </div>

      {/* Supplement List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Composition</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {supplements.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No supplements found. Add common supplements like Calcium, Calcium with D3, or Multivitamins.
                  </td>
                </tr>
              ) : (
                supplements.map(supplement => {
                  const nutritional = supplement.nutritional_data || {};
                  const composition = [];
                  if (nutritional.calcium_mg) composition.push(`Calcium: ${nutritional.calcium_mg}mg`);
                  if (nutritional.vitamin_d3_iu) composition.push(`D3: ${nutritional.vitamin_d3_iu} IU`);
                  if (nutritional.vitamin_a_iu) composition.push(`A: ${nutritional.vitamin_a_iu} IU`);

                  return (
                    <tr
                      key={supplement.id}
                      onClick={() => setViewingSupplement(supplement)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {supplement.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {composition.length > 0 ? composition.join(', ') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {supplement.is_default ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            Default
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                            Custom
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(supplement); }}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300 mr-4"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(supplement); }}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplement Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {editingSupplement ? 'Edit Supplement' : 'Add Supplement'}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-medium mb-1 text-gray-900 dark:text-white">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input w-full"
                    placeholder="e.g., Calcium with D3"
                    required
                  />
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="font-medium mb-3 text-gray-900 dark:text-white">Nutritional Information (Optional)</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">All values are per gram of supplement powder</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Calcium (mg/g)</label>
                      <input
                        type="text"
                        value={formData.nutritional_data.calcium_mg}
                        onChange={(e) => setFormData({
                          ...formData,
                          nutritional_data: { ...formData.nutritional_data, calcium_mg: e.target.value }
                        })}
                        className="input w-full"
                        placeholder="e.g., 500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Vitamin D3 (IU/g)</label>
                      <input
                        type="text"
                        value={formData.nutritional_data.vitamin_d3_iu}
                        onChange={(e) => setFormData({
                          ...formData,
                          nutritional_data: { ...formData.nutritional_data, vitamin_d3_iu: e.target.value }
                        })}
                        className="input w-full"
                        placeholder="e.g., 1000"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Vitamin A (IU/g)</label>
                      <input
                        type="text"
                        value={formData.nutritional_data.vitamin_a_iu}
                        onChange={(e) => setFormData({
                          ...formData,
                          nutritional_data: { ...formData.nutritional_data, vitamin_a_iu: e.target.value }
                        })}
                        className="input w-full"
                        placeholder="e.g., 5000"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Notes</label>
                      <input
                        type="text"
                        value={formData.nutritional_data.notes}
                        onChange={(e) => setFormData({
                          ...formData,
                          nutritional_data: { ...formData.nutritional_data, notes: e.target.value }
                        })}
                        className="input w-full"
                        placeholder="e.g., Dosage instructions"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="submit" className="flex-1 btn-primary">
                    {editingSupplement ? 'Update' : 'Create'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn-secondary">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Supplement Read-Only View Modal */}
      {viewingSupplement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {viewingSupplement.name}
                </h2>
                <button
                  onClick={() => setViewingSupplement(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Type Badge */}
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Type</p>
                  {viewingSupplement.is_default ? (
                    <span className="px-3 py-1.5 text-sm font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Default Supplement
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 text-sm font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                      Custom Supplement
                    </span>
                  )}
                </div>

                {/* Nutritional Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Nutritional Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Calcium</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {viewingSupplement.nutritional_data?.calcium_mg ? `${viewingSupplement.nutritional_data.calcium_mg} mg` : 'Not specified'}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Vitamin D3</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {viewingSupplement.nutritional_data?.vitamin_d3_iu ? `${viewingSupplement.nutritional_data.vitamin_d3_iu} IU` : 'Not specified'}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Vitamin A</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {viewingSupplement.nutritional_data?.vitamin_a_iu ? `${viewingSupplement.nutritional_data.vitamin_a_iu} IU` : 'Not specified'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {viewingSupplement.nutritional_data?.notes && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Notes</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {viewingSupplement.nutritional_data.notes}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setViewingSupplement(null);
                      handleEdit(viewingSupplement);
                    }}
                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                  >
                    <Edit2 size={18} /> Edit
                  </button>
                  <button
                    onClick={() => {
                      setViewingSupplement(null);
                      handleDelete(viewingSupplement);
                    }}
                    className="flex-1 btn-secondary text-red-600 dark:text-red-400 flex items-center justify-center gap-2"
                  >
                    <Trash2 size={18} /> Delete
                  </button>
                  <button
                    onClick={() => setViewingSupplement(null)}
                    className="flex-1 btn-secondary"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
