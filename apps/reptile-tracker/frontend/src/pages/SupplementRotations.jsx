import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { Plus, Edit2, Trash2, RefreshCw, Check } from 'lucide-react';
import { getDayNames, getDayNumbers } from '../utils/dateFormatting';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import PageHeader from '@/components/PageHeader';

// Zod schema for rotation form
const rotationSchema = z.object({
  reptile_id: z.string().min(1, 'Please select a reptile'),
  supplement_id: z.string().min(1, 'Please select a supplement'),
  trigger_mode: z.enum(['feeding_count', 'schedule_based']),
  every_n_feedings: z.string().optional(),
  applies_to_category: z.string().optional(),
  counting_mode: z.string().optional(),
  application_mode: z.string().optional(),
  schedule_days_of_week: z.array(z.number()).optional(),
  schedule_frequency_days: z.string().optional(),
  priority: z.string().min(1, 'Priority is required'),
  is_exclusive: z.boolean(),
  enabled: z.boolean(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.trigger_mode === 'feeding_count') {
    return data.every_n_feedings && parseInt(data.every_n_feedings) >= 1;
  }
  return true;
}, {
  message: 'Frequency must be at least 1',
  path: ['every_n_feedings']
}).refine((data) => {
  if (data.trigger_mode === 'schedule_based') {
    return data.schedule_days_of_week && data.schedule_days_of_week.length > 0;
  }
  return true;
}, {
  message: 'Please select at least one day',
  path: ['schedule_days_of_week']
});

function SupplementRotations() {
  const navigate = useNavigate();
  const [reptiles, setReptiles] = useState([]);
  const [rotations, setRotations] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRotation, setEditingRotation] = useState(null);
  const [filterReptile, setFilterReptile] = useState('all');

  // Day helpers
  const dayNumbers = getDayNumbers();
  const dayNames = getDayNames(true);

  // Initialize form
  const form = useForm({
    resolver: zodResolver(rotationSchema),
    defaultValues: {
      reptile_id: '',
      supplement_id: '',
      trigger_mode: 'feeding_count',
      every_n_feedings: '2',
      applies_to_category: '',
      counting_mode: 'category_only',
      application_mode: 'any_feeding',
      schedule_days_of_week: [],
      schedule_frequency_days: '7',
      priority: '10',
      is_exclusive: false,
      enabled: true,
      notes: '',
    }
  });

  const triggerMode = form.watch('trigger_mode');
  const selectedDaysOfWeek = form.watch('schedule_days_of_week');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [reptilesRes, supplementsRes] = await Promise.all([
        axios.get('/api/reptiles', { withCredentials: true }),
        axios.get('/api/supplements', { withCredentials: true })
      ]);
      setReptiles(reptilesRes.data);
      setSupplements(supplementsRes.data);

      // Fetch rotations per-reptile since there's no global endpoint
      if (reptilesRes.data.length > 0) {
        const rotationPromises = reptilesRes.data.map(r =>
          axios.get(`/api/feeding-rotations/reptile/${r.id}`, { withCredentials: true })
            .then(res => res.data)
            .catch(() => [])
        );
        const allRotations = await Promise.all(rotationPromises);
        setRotations(allRotations.flat());
      } else {
        setRotations([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function getReptileName(reptileId) {
    const reptile = reptiles.find(r => r.id === reptileId);
    return reptile?.name || 'Unknown';
  }

  function getSupplementName(supplementId) {
    const supplement = supplements.find(s => s.id === supplementId);
    return supplement?.name || 'Unknown';
  }

  function formatPattern(rotation) {
    if (rotation.trigger_mode === 'feeding_count') {
      const category = rotation.applies_to_category || 'all';
      return `Every ${rotation.every_n_feedings} ${category} feeding${rotation.every_n_feedings > 1 ? 's' : ''}`;
    } else if (rotation.trigger_mode === 'schedule_based') {
      const days = rotation.schedule_days_of_week
        ? rotation.schedule_days_of_week.split(',').map(d => getDayName(parseInt(d)))
        : [];
      return days.join(', ') || 'No days set';
    }
    return 'Unknown pattern';
  }

  function getDayName(dayNum) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayNum];
  }

  function toggleDayOfWeek(day) {
    const current = form.getValues('schedule_days_of_week');
    const newDays = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day].sort((a, b) => a - b);
    form.setValue('schedule_days_of_week', newDays, { shouldValidate: true });
  }

  function handleAdd() {
    setEditingRotation(null);
    form.reset({
      reptile_id: '',
      supplement_id: '',
      trigger_mode: 'feeding_count',
      every_n_feedings: '2',
      applies_to_category: '__all__',
      counting_mode: 'category_only',
      application_mode: 'any_feeding',
      schedule_days_of_week: [],
      schedule_frequency_days: '7',
      priority: '10',
      is_exclusive: false,
      enabled: true,
      notes: '',
    });
    setDialogOpen(true);
  }

  function handleEdit(rotation) {
    setEditingRotation(rotation);
    form.reset({
      reptile_id: String(rotation.reptile_id),
      supplement_id: String(rotation.supplement_id),
      trigger_mode: rotation.trigger_mode || 'feeding_count',
      every_n_feedings: rotation.every_n_feedings ? String(rotation.every_n_feedings) : '2',
      applies_to_category: rotation.applies_to_category || '__all__',
      counting_mode: rotation.counting_mode || 'category_only',
      application_mode: rotation.application_mode || 'any_feeding',
      schedule_days_of_week: rotation.schedule_days_of_week
        ? rotation.schedule_days_of_week.split(',').map(d => parseInt(d))
        : [],
      schedule_frequency_days: rotation.schedule_frequency_days ? String(rotation.schedule_frequency_days) : '7',
      priority: String(rotation.priority),
      is_exclusive: rotation.is_exclusive || false,
      enabled: rotation.enabled,
      notes: rotation.notes || '',
    });
    setDialogOpen(true);
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this rotation?')) return;

    try {
      await axios.delete(`/api/feeding-rotations/${id}`, { withCredentials: true });
      await loadData();
    } catch (error) {
      console.error('Error deleting rotation:', error);
      alert('Failed to delete rotation');
    }
  }

  async function handleSubmit(values) {
    const submitData = {
      reptile_id: parseInt(values.reptile_id),
      supplement_id: parseInt(values.supplement_id),
      trigger_mode: values.trigger_mode,
      every_n_feedings: values.trigger_mode === 'feeding_count' && values.every_n_feedings
        ? parseInt(values.every_n_feedings)
        : null,
      applies_to_category: values.applies_to_category === '__all__' ? null : (values.applies_to_category || null),
      counting_mode: values.counting_mode || null,
      application_mode: values.application_mode || null,
      schedule_days_of_week: values.trigger_mode === 'schedule_based' && values.schedule_days_of_week
        ? values.schedule_days_of_week.join(',')
        : null,
      schedule_frequency_days: values.schedule_frequency_days ? parseInt(values.schedule_frequency_days) : null,
      priority: parseInt(values.priority),
      is_exclusive: values.is_exclusive,
      enabled: values.enabled,
      notes: values.notes?.trim() || null,
    };

    try {
      if (editingRotation) {
        await axios.patch(`/api/feeding-rotations/${editingRotation.id}`, submitData, { withCredentials: true });
      } else {
        await axios.post('/api/feeding-rotations', submitData, { withCredentials: true });
      }
      await loadData();
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving rotation:', error);
      alert(error.response?.data?.detail || 'Failed to save rotation');
    }
  }

  const filteredRotations = filterReptile === 'all'
    ? rotations
    : rotations.filter(r => r.reptile_id === parseInt(filterReptile));

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <PageHeader
        title="Supplement Rotations"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAdd} className="bg-green-600 hover:bg-green-700">
                <Plus size={20} className="mr-2" />
                Add Rotation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingRotation ? 'Edit' : 'Add'} Rotation Rule
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="reptile_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reptile *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select reptile" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {reptiles.map(r => (
                                <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="supplement_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplement *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select supplement" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {supplements.map(s => (
                                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="trigger_mode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Trigger Mode *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="feeding_count">Every N Feedings</SelectItem>
                              <SelectItem value="schedule_based">Specific Days</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority *</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" placeholder="10" {...field} />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">Lower = higher priority</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {triggerMode === 'feeding_count' && (
                    <>
                      <FormField
                        control={form.control}
                        name="every_n_feedings"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Every N Feedings *</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" placeholder="2" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="applies_to_category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Applies To</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="All feedings" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="__all__">All feedings</SelectItem>
                                <SelectItem value="insects">Insects only</SelectItem>
                                <SelectItem value="salad">Salad only</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  {triggerMode === 'schedule_based' && (
                    <FormField
                      control={form.control}
                      name="schedule_days_of_week"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Days of Week *</FormLabel>
                          <div className="flex flex-wrap gap-2">
                            {dayNumbers.map((day, index) => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleDayOfWeek(day)}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                  selectedDaysOfWeek?.includes(day)
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-secondary text-muted-foreground hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                              >
                                {dayNames[index]}
                              </button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="flex items-center gap-4">
                    <FormField
                      control={form.control}
                      name="is_exclusive"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer">Exclusive (only this supplement)</FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="enabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer">Enabled</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional notes..." rows={3} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3 pt-4">
                    <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700">
                      {editingRotation ? 'Update' : 'Create'} Rotation
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
        subtitle="Manage supplement schedules and food replacements for your reptiles"
      />

      {/* Reptile Filter Buttons */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilterReptile('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filterReptile === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-secondary text-muted-foreground hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          All
        </button>
        {reptiles.map(r => (
          <button
            key={r.id}
            onClick={() => setFilterReptile(String(r.id))}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterReptile === String(r.id)
                ? 'bg-blue-600 text-white'
                : 'bg-secondary text-muted-foreground hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : reptiles.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <RefreshCw size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-muted-foreground mb-4">No reptiles found</p>
          <Button onClick={() => navigate('/reptiles/new')} className="bg-green-600 hover:bg-green-700">
            <Plus size={20} className="mr-2" />
            Add Your First Reptile
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Reptile</TableHead>
                <TableHead>Supplement</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Pattern</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-center">Exclusive</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRotations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8 pl-4">
                    No rotations found. Click "Add Rotation" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRotations.map(rotation => (
                  <TableRow key={rotation.id}>
                    <TableCell className="font-medium pl-4 py-3">{getReptileName(rotation.reptile_id)}</TableCell>
                    <TableCell className="py-3">
                      <Badge variant="default">{getSupplementName(rotation.supplement_id)}</Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      {rotation.applies_to_category ? (
                        <Badge variant="secondary">{rotation.applies_to_category}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">All</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm py-3">{formatPattern(rotation)}</TableCell>
                    <TableCell className="py-3">{rotation.priority}</TableCell>
                    <TableCell className="text-center py-3">
                      {rotation.is_exclusive && (
                        <Check size={18} className="text-primary mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      {rotation.enabled ? (
                        <Badge variant="default" className="bg-green-600">Enabled</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(rotation)}
                        >
                          <Edit2 size={16} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(rotation.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default SupplementRotations;
