import { useState, useEffect } from 'react';
import axios from 'axios';
import { PlusCircle, Edit2, Trash2 } from 'lucide-react';

export default function FoodManagement() {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFood, setEditingFood] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    category: 'insect',
    insect_size: '',
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
      setSuccess(`"${food.name}" deleted successfully`);
      fetchFoods();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to delete food:', error);
      setError(error.response?.data?.detail || 'Failed to delete food');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const payload = {
      ...formData,
      insect_size: formData.category === 'insect' && formData.insect_size ? formData.insect_size : null
    };

    try {
      if (editingFood) {
        await axios.put(`/api/foods/${editingFood.id}`, payload);
        setSuccess('Food updated successfully');
      } else {
        await axios.post('/api/foods', payload);
        setSuccess('Food created successfully');
      }

      fetchFoods();
      setShowForm(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to save food:', error);
      setError(error.response?.data?.detail || 'Failed to save food');
    }
  };

  const filteredFoods = filterCategory
    ? foods.filter(f => f.category === filterCategory)
    : foods;

  if (loading) {
    return <div className="text-center py-12">Loading foods...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Food Management</h1>
        <button onClick={handleCreate} className="btn-primary flex items-center gap-2">
          <PlusCircle size={20} />
          Add Food
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg">
          {success}
        </div>
      )}

      {/* Filter */}
      <div className="mb-4">
        <label className="block font-medium mb-2 text-gray-900 dark:text-white">Filter by Category</label>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="input w-64"
        >
          <option value="">All Categories</option>
          <option value="insect">Insects</option>
          <option value="vegetable">Vegetables</option>
          <option value="fruit">Fruits</option>
          <option value="prepared">Prepared Foods</option>
          <option value="other">Other</option>
        </select>
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
              {filteredFoods.map(food => (
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
                      title={food.is_default ? "Delete default food (requires confirmation)" : "Delete food"}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredFoods.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No foods found. Add your first food to get started!
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {editingFood ? 'Edit Food' : 'Add New Food'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-medium mb-1 text-gray-900 dark:text-white">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 text-gray-900 dark:text-white">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input w-full"
                    required
                  >
                    <option value="insect">Insect</option>
                    <option value="vegetable">Vegetable</option>
                    <option value="fruit">Fruit</option>
                    <option value="prepared">Prepared Food</option>
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
                      <option value="">Not specified</option>
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <button type="submit" className="btn-primary flex-1">
                    {editingFood ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="btn-secondary flex-1"
                  >
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
