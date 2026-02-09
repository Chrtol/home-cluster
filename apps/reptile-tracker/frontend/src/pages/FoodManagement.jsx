import { useState, useEffect } from 'react';
import axios from 'axios';
import { PlusCircle, Edit2, Trash2, Star } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';

// Friendly name mappings
const CATEGORY_LABELS = {
  insect: 'Insects',
  worms: 'Worms',
  vegetable: 'Vegetables',
  fruit: 'Fruits',
  prepared: 'Prepared Foods',
  frozen_animal: 'Frozen Animals',
  live_rodent: 'Live Rodents',
  fish_seafood: 'Fish/Seafood',
  eggs: 'Eggs',
  other: 'Other',
};

const INSECT_SIZE_LABELS = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
};

const ANIMAL_SIZE_LABELS = {
  pinky: 'Pinky',
  fuzzy: 'Fuzzy',
  hopper: 'Hopper',
  weaner: 'Weaner',
  adult_small: 'Adult Small',
  adult_medium: 'Adult Medium',
  adult_large: 'Adult Large',
  jumbo: 'Jumbo',
};

function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

function getSizeLabel(food) {
  if (food.insect_size) return INSECT_SIZE_LABELS[food.insect_size] || food.insect_size;
  if (food.animal_size) return ANIMAL_SIZE_LABELS[food.animal_size] || food.animal_size;
  return null;
}

export default function FoodManagement() {
  return (
    <div>
      <PageHeader title="Food & Supplement Management" />

      <Tabs defaultValue="foods" className="w-full">
        <TabsList>
          <TabsTrigger value="foods">Foods</TabsTrigger>
          <TabsTrigger value="supplements">Supplements</TabsTrigger>
        </TabsList>
        <TabsContent value="foods">
          <FoodsTab />
        </TabsContent>
        <TabsContent value="supplements">
          <SupplementsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// FOODS TAB COMPONENT
const foodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string(),
  insect_size: z.string().optional(),
  animal_size: z.string().optional(),
});

function FoodsTab() {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFood, setEditingFood] = useState(null);
  const [viewingFood, setViewingFood] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const form = useForm({
    resolver: zodResolver(foodSchema),
    defaultValues: {
      name: '',
      category: 'insect',
      insect_size: '',
      animal_size: '',
    }
  });

  const category = form.watch('category');

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
    form.reset({
      name: '',
      category: 'insect',
      insect_size: '',
      animal_size: '',
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleEdit = (food) => {
    setEditingFood(food);
    form.reset({
      name: food.name,
      category: food.category,
      insect_size: food.insect_size || '',
      animal_size: food.animal_size || '',
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

  const handleToggleFavorite = async (food, e) => {
    e.stopPropagation();
    try {
      await axios.patch(`/api/foods/${food.id}/toggle-favorite`);
      setFoods(foods.map(f =>
        f.id === food.id ? { ...f, is_favorite: !f.is_favorite } : f
      ));
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      setError('Failed to update favorite status');
    }
  };

  const onSubmit = async (data) => {
    setError('');
    setSuccess('');

    const payload = {
      name: data.name,
      category: data.category,
      insect_size: data.insect_size || null,
      animal_size: data.animal_size || null,
      nutritional_data: null
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

  const filteredFoods = filterCategory && filterCategory !== 'all'
    ? foods.filter(f => f.category === filterCategory)
    : foods;

  if (loading) return <LoadingState message="Loading foods..." />;

  return (
    <div className="space-y-4">
      {error && <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</p>}
      {success && <p className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">{success}</p>}

      {/* Header row with filter and add button */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="insect">Insects</SelectItem>
              <SelectItem value="worms">Worms</SelectItem>
              <SelectItem value="vegetable">Vegetables</SelectItem>
              <SelectItem value="fruit">Fruits</SelectItem>
              <SelectItem value="prepared">Prepared Foods</SelectItem>
              <SelectItem value="frozen_animal">Frozen Animals</SelectItem>
              <SelectItem value="live_rodent">Live Rodents</SelectItem>
              <SelectItem value="fish_seafood">Fish/Seafood</SelectItem>
              <SelectItem value="eggs">Eggs</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate} className="bg-green-600 hover:bg-green-700">
              <PlusCircle className="h-4 w-4" /> Add Food
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingFood ? 'Edit Food' : 'Add Food'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="insect">Insect</SelectItem>
                          <SelectItem value="worms">Worms</SelectItem>
                          <SelectItem value="vegetable">Vegetable</SelectItem>
                          <SelectItem value="fruit">Fruit</SelectItem>
                          <SelectItem value="prepared">Prepared Food</SelectItem>
                          <SelectItem value="frozen_animal">Frozen Animal</SelectItem>
                          <SelectItem value="live_rodent">Live Rodent</SelectItem>
                          <SelectItem value="fish_seafood">Fish/Seafood</SelectItem>
                          <SelectItem value="eggs">Eggs</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {category === 'insect' && (
                  <FormField
                    control={form.control}
                    name="insect_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Insect Size</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select size..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="small">Small</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="large">Large</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {category === 'frozen_animal' && (
                  <FormField
                    control={form.control}
                    name="animal_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Animal Size</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select size..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pinky">Pinky (Newborn)</SelectItem>
                            <SelectItem value="fuzzy">Fuzzy (Young with fur)</SelectItem>
                            <SelectItem value="hopper">Hopper (Young, mobile)</SelectItem>
                            <SelectItem value="weaner">Weaner (Juvenile, weaned)</SelectItem>
                            <SelectItem value="adult_small">Adult Small</SelectItem>
                            <SelectItem value="adult_medium">Adult Medium</SelectItem>
                            <SelectItem value="adult_large">Adult Large</SelectItem>
                            <SelectItem value="jumbo">Jumbo (Large rat/rabbit)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex gap-3 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingFood ? 'Update' : 'Create'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Food List */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFoods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No foods found
                </TableCell>
              </TableRow>
            ) : (
              filteredFoods.map(food => (
                <TableRow
                  key={food.id}
                  onClick={() => setViewingFood(food)}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <button
                      onClick={(e) => handleToggleFavorite(food, e)}
                      className="transition-colors"
                      title={food.is_favorite ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star
                        size={18}
                        className={food.is_favorite
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300 dark:text-gray-600 hover:text-yellow-400 dark:hover:text-yellow-400"
                        }
                      />
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{food.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{getCategoryLabel(food.category)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {getSizeLabel(food) || '-'}
                  </TableCell>
                  <TableCell>
                    {food.is_default ? (
                      <Badge variant="default">Default</Badge>
                    ) : (
                      <Badge variant="outline">Custom</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); handleEdit(food); }}
                      className="mr-2"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); handleDelete(food); }}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Food Read-Only View Dialog */}
      <Dialog open={!!viewingFood} onOpenChange={(open) => !open && setViewingFood(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingFood?.name}</DialogTitle>
          </DialogHeader>
          {viewingFood && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Category</p>
                  <p className="text-lg font-semibold text-foreground capitalize">
                    {viewingFood.category.replace('_', ' ')}
                  </p>
                </div>
                {(viewingFood.insect_size || viewingFood.animal_size) && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Size</p>
                    <p className="text-lg font-semibold text-foreground capitalize">
                      {viewingFood.insect_size || viewingFood.animal_size?.replace('_', ' ')}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Type</p>
                {viewingFood.is_default ? (
                  <Badge variant="default">Default Food</Badge>
                ) : (
                  <Badge variant="outline">Custom Food</Badge>
                )}
              </div>

              {viewingFood.nutritional_data && Object.keys(viewingFood.nutritional_data).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Nutritional Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {viewingFood.nutritional_data.protein_percent && (
                      <div className="p-4 bg-secondary/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Protein</p>
                        <p className="text-xl font-bold text-foreground">
                          {viewingFood.nutritional_data.protein_percent}%
                        </p>
                      </div>
                    )}
                    {viewingFood.nutritional_data.fat_percent && (
                      <div className="p-4 bg-secondary/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Fat</p>
                        <p className="text-xl font-bold text-foreground">
                          {viewingFood.nutritional_data.fat_percent}%
                        </p>
                      </div>
                    )}
                    {viewingFood.nutritional_data.calcium_mg_per_100g && (
                      <div className="p-4 bg-secondary/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Calcium</p>
                        <p className="text-xl font-bold text-foreground">
                          {viewingFood.nutritional_data.calcium_mg_per_100g} mg/100g
                        </p>
                      </div>
                    )}
                    {viewingFood.nutritional_data.phosphorus_mg_per_100g && (
                      <div className="p-4 bg-secondary/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Phosphorus</p>
                        <p className="text-xl font-bold text-foreground">
                          {viewingFood.nutritional_data.phosphorus_mg_per_100g} mg/100g
                        </p>
                      </div>
                    )}
                    {viewingFood.nutritional_data.calcium_phosphorus_ratio && (
                      <div className="p-4 bg-secondary/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Ca:P Ratio</p>
                        <p className="text-xl font-bold text-foreground">
                          {viewingFood.nutritional_data.calcium_phosphorus_ratio}
                        </p>
                      </div>
                    )}
                    {viewingFood.nutritional_data.vitamin_a_iu && (
                      <div className="p-4 bg-secondary/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Vitamin A</p>
                        <p className="text-xl font-bold text-foreground">
                          {viewingFood.nutritional_data.vitamin_a_iu} IU
                        </p>
                      </div>
                    )}
                    {viewingFood.nutritional_data.vitamin_c_mg && (
                      <div className="p-4 bg-secondary/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Vitamin C</p>
                        <p className="text-xl font-bold text-foreground">
                          {viewingFood.nutritional_data.vitamin_c_mg} mg
                        </p>
                      </div>
                    )}
                    {viewingFood.nutritional_data.vitamin_d3_iu && (
                      <div className="p-4 bg-secondary/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Vitamin D3</p>
                        <p className="text-xl font-bold text-foreground">
                          {viewingFood.nutritional_data.vitamin_d3_iu} IU
                        </p>
                      </div>
                    )}
                    {viewingFood.nutritional_data.vitamin_k_mcg && (
                      <div className="p-4 bg-secondary/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Vitamin K</p>
                        <p className="text-xl font-bold text-foreground">
                          {viewingFood.nutritional_data.vitamin_k_mcg} mcg
                        </p>
                      </div>
                    )}
                    {viewingFood.nutritional_data.moisture_percent && (
                      <div className="p-4 bg-secondary/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Moisture</p>
                        <p className="text-xl font-bold text-foreground">
                          {viewingFood.nutritional_data.moisture_percent}%
                        </p>
                      </div>
                    )}
                    {viewingFood.nutritional_data.weight_grams && (
                      <div className="p-4 bg-secondary/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Weight</p>
                        <p className="text-xl font-bold text-foreground">
                          {viewingFood.nutritional_data.weight_grams}g
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {viewingFood.nutritional_data?.note && (
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Notes</h3>
                  <p className="text-muted-foreground">
                    {viewingFood.nutritional_data.note}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => {
                    setViewingFood(null);
                    handleEdit(viewingFood);
                  }}
                  className="flex-1"
                >
                  <Edit2 className="h-4 w-4" /> Edit
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setViewingFood(null);
                    handleDelete(viewingFood);
                  }}
                  className="flex-1 text-red-600 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// SUPPLEMENTS TAB COMPONENT
const supplementSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  calcium_mg: z.string().optional(),
  vitamin_d3_iu: z.string().optional(),
  vitamin_a_iu: z.string().optional(),
  notes: z.string().optional(),
});

function SupplementsTab() {
  const [supplements, setSupplements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewingSupplement, setViewingSupplement] = useState(null);
  const [editingSupplement, setEditingSupplement] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const form = useForm({
    resolver: zodResolver(supplementSchema),
    defaultValues: {
      name: '',
      calcium_mg: '',
      vitamin_d3_iu: '',
      vitamin_a_iu: '',
      notes: ''
    }
  });

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
    form.reset({
      name: '',
      calcium_mg: '',
      vitamin_d3_iu: '',
      vitamin_a_iu: '',
      notes: ''
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleEdit = (supplement) => {
    setEditingSupplement(supplement);
    const nutritional_data = supplement.nutritional_data || {};
    form.reset({
      name: supplement.name,
      calcium_mg: nutritional_data.calcium_mg || '',
      vitamin_d3_iu: nutritional_data.vitamin_d3_iu || '',
      vitamin_a_iu: nutritional_data.vitamin_a_iu || '',
      notes: nutritional_data.notes || ''
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

  const onSubmit = async (data) => {
    setError('');
    setSuccess('');

    const cleanedNutritionalData = {};
    if (data.calcium_mg) cleanedNutritionalData.calcium_mg = data.calcium_mg;
    if (data.vitamin_d3_iu) cleanedNutritionalData.vitamin_d3_iu = data.vitamin_d3_iu;
    if (data.vitamin_a_iu) cleanedNutritionalData.vitamin_a_iu = data.vitamin_a_iu;
    if (data.notes) cleanedNutritionalData.notes = data.notes;

    const payload = {
      name: data.name,
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

  if (loading) return <LoadingState message="Loading supplements..." />;

  return (
    <div className="space-y-4">
      {error && <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</p>}
      {success && <p className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">{success}</p>}

      {/* Header row with info and add button */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4">
        <p className="text-sm text-muted-foreground">
          Common supplements: Calcium, Calcium with D3, Multivitamins
        </p>

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate} className="bg-green-600 hover:bg-green-700">
              <PlusCircle className="h-4 w-4" /> Add Supplement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSupplement ? 'Edit Supplement' : 'Add Supplement'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Calcium with D3" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="border-t pt-4">
                  <h3 className="font-medium mb-3 text-foreground">Nutritional Information (Optional)</h3>
                  <p className="text-sm text-muted-foreground mb-3">All values are per gram of supplement powder</p>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="calcium_mg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Calcium (mg/g)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., 500" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="vitamin_d3_iu"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Vitamin D3 (IU/g)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., 1000" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="vitamin_a_iu"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Vitamin A (IU/g)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., 5000" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Notes</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Dosage instructions" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingSupplement ? 'Update' : 'Create'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Supplement List */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Composition</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {supplements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No supplements found. Add common supplements like Calcium, Calcium with D3, or Multivitamins.
                </TableCell>
              </TableRow>
            ) : (
              supplements.map(supplement => {
                const nutritional = supplement.nutritional_data || {};
                const composition = [];
                if (nutritional.calcium_mg) composition.push(`Calcium: ${nutritional.calcium_mg}mg`);
                if (nutritional.vitamin_d3_iu) composition.push(`D3: ${nutritional.vitamin_d3_iu} IU`);
                if (nutritional.vitamin_a_iu) composition.push(`A: ${nutritional.vitamin_a_iu} IU`);

                return (
                  <TableRow
                    key={supplement.id}
                    onClick={() => setViewingSupplement(supplement)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">{supplement.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {composition.length > 0 ? composition.join(', ') : '-'}
                    </TableCell>
                    <TableCell>
                      {supplement.is_default ? (
                        <Badge variant="default">Default</Badge>
                      ) : (
                        <Badge variant="outline">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); handleEdit(supplement); }}
                        className="mr-2"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); handleDelete(supplement); }}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Supplement Read-Only View Dialog */}
      <Dialog open={!!viewingSupplement} onOpenChange={(open) => !open && setViewingSupplement(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingSupplement?.name}</DialogTitle>
          </DialogHeader>
          {viewingSupplement && (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Type</p>
                {viewingSupplement.is_default ? (
                  <Badge variant="default">Default Supplement</Badge>
                ) : (
                  <Badge variant="outline">Custom Supplement</Badge>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Nutritional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-secondary/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Calcium</p>
                    <p className="text-xl font-bold text-foreground">
                      {viewingSupplement.nutritional_data?.calcium_mg ? `${viewingSupplement.nutritional_data.calcium_mg} mg` : 'Not specified'}
                    </p>
                  </div>
                  <div className="p-4 bg-secondary/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Vitamin D3</p>
                    <p className="text-xl font-bold text-foreground">
                      {viewingSupplement.nutritional_data?.vitamin_d3_iu ? `${viewingSupplement.nutritional_data.vitamin_d3_iu} IU` : 'Not specified'}
                    </p>
                  </div>
                  <div className="p-4 bg-secondary/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Vitamin A</p>
                    <p className="text-xl font-bold text-foreground">
                      {viewingSupplement.nutritional_data?.vitamin_a_iu ? `${viewingSupplement.nutritional_data.vitamin_a_iu} IU` : 'Not specified'}
                    </p>
                  </div>
                </div>
              </div>

              {viewingSupplement.nutritional_data?.notes && (
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Notes</h3>
                  <p className="text-muted-foreground">
                    {viewingSupplement.nutritional_data.notes}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => {
                    setViewingSupplement(null);
                    handleEdit(viewingSupplement);
                  }}
                  className="flex-1"
                >
                  <Edit2 className="h-4 w-4" /> Edit
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setViewingSupplement(null);
                    handleDelete(viewingSupplement);
                  }}
                  className="flex-1 text-red-600 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setViewingSupplement(null)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
