import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Home } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import PageHeader from '../components/PageHeader';
import DateInput from '../components/DateInput';
import { getDefaultHouseholdId } from '../utils/householdSettings';

// Zod schema for reptile validation
const reptileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  species: z.string().min(1, 'Species is required'),
  date_of_birth: z.string().optional(),
  notes: z.string().optional(),
  has_uvb: z.enum(['', 'true', 'false']).optional(),
  length: z.string().optional(),
  age_category: z.enum(['', 'hatchling', 'juvenile', 'adult', 'gravid']).optional(),
  sex: z.enum(['', 'male', 'female', 'unknown']).optional(),
  household_id: z.string().optional()
});

// Calculate age category from date of birth and species
const calculateAgeCategory = (dateOfBirth, species) => {
  if (!dateOfBirth) return null;

  const birthDate = new Date(dateOfBirth);
  const now = new Date();
  const ageInMonths = (now - birthDate) / (1000 * 60 * 60 * 24 * 30.44); // Average days per month

  // Species-specific age thresholds based on care guidelines
  const speciesLower = species?.toLowerCase() || '';

  // Leopard Gecko and Crested Gecko: adult at 12 months
  if (speciesLower.includes('leopard gecko') || speciesLower.includes('crested gecko')) {
    if (ageInMonths < 12) return 'juvenile';
    return 'adult';
  }

  // Bearded Dragon: hatchling (0-3 months), juvenile (3-12 months), adult (12+ months)
  if (speciesLower.includes('bearded dragon')) {
    if (ageInMonths < 3) return 'hatchling';
    if (ageInMonths < 12) return 'juvenile';
    return 'adult';
  }

  // Ball Python: juvenile (0-2 years), adult (2+ years)
  if (speciesLower.includes('ball python') || speciesLower.includes('python')) {
    if (ageInMonths < 24) return 'juvenile';
    return 'adult';
  }

  // Generic thresholds for other species
  if (ageInMonths < 6) return 'hatchling';
  if (ageInMonths < 18) return 'juvenile';
  return 'adult';
};

export default function ReptileForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const householdIdParam = searchParams.get('household');
  const isEditing = !!id && id !== 'new';

  const [speciesList, setSpeciesList] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSpecies, setFilteredSpecies] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [ageCategoryAuto, setAgeCategoryAuto] = useState(true);

  // Initialize form with react-hook-form
  const form = useForm({
    resolver: zodResolver(reptileSchema),
    defaultValues: {
      name: '',
      species: '',
      date_of_birth: '',
      notes: '',
      has_uvb: '',
      length: '',
      age_category: '',
      sex: '',
      household_id: ''
    }
  });

  const watchSpecies = form.watch('species');
  const watchDateOfBirth = form.watch('date_of_birth');
  const watchAgeCategory = form.watch('age_category');

  useEffect(() => {
    // Fetch list of existing species for autocomplete
    axios.get('/api/reptiles/species')
      .then(res => {
        setSpeciesList(res.data);
        setFilteredSpecies(res.data);
      })
      .catch(err => {
        console.error("Failed to fetch species list:", err);
      });

    // Fetch user's households for the dropdown (only needed when creating)
    if (!isEditing) {
      axios.get('/api/households/me')
        .then(res => {
          setHouseholds(res.data);
          if (res.data.length > 0) {
            // Priority: URL param > default household > first household
            let initialHouseholdId;
            if (householdIdParam) {
              const validHousehold = res.data.find(h => h.id === parseInt(householdIdParam));
              if (validHousehold) {
                initialHouseholdId = householdIdParam;
              } else {
                const defaultId = getDefaultHouseholdId();
                const defaultHousehold = res.data.find(h => h.id === defaultId);
                initialHouseholdId = defaultHousehold ? String(defaultId) : String(res.data[0].id);
              }
            } else {
              const defaultId = getDefaultHouseholdId();
              const defaultHousehold = res.data.find(h => h.id === defaultId);
              initialHouseholdId = defaultHousehold ? String(defaultId) : String(res.data[0].id);
            }
            form.setValue('household_id', initialHouseholdId);
          }
        })
        .catch(err => {
          console.error("Failed to fetch households:", err);
        });
    }

    // Load existing reptile data for editing
    if (isEditing) {
      axios.get(`/api/reptiles/${id}`)
        .then(res => {
          form.reset({
            name: res.data.name || '',
            species: res.data.species || '',
            date_of_birth: res.data.date_of_birth ? res.data.date_of_birth.split('T')[0] : '',
            notes: res.data.notes || '',
            has_uvb: res.data.has_uvb === null ? '' : res.data.has_uvb ? 'true' : 'false',
            length: res.data.length ? String(res.data.length) : '',
            age_category: res.data.age_category || '',
            sex: res.data.sex || '',
            household_id: ''
          });
          // If age_category is set, assume manual mode
          setAgeCategoryAuto(!res.data.age_category);
        })
        .catch(err => {
          console.error("Failed to fetch reptile for editing:", err);
        });
    }
  }, [id, isEditing, householdIdParam, form]);

  // Auto-calculate age category when date of birth or species changes (if auto mode is enabled)
  useEffect(() => {
    if (ageCategoryAuto && watchDateOfBirth && watchSpecies) {
      const calculated = calculateAgeCategory(watchDateOfBirth, watchSpecies);
      if (calculated) {
        form.setValue('age_category', calculated);
      }
    }
  }, [watchDateOfBirth, watchSpecies, ageCategoryAuto, form]);

  const handleSpeciesChange = (value) => {
    // Filter species list based on input
    if (value) {
      const filtered = speciesList.filter(sp =>
        sp.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSpecies(filtered);
      setShowDropdown(filtered.length > 0);
    } else {
      setFilteredSpecies(speciesList);
      setShowDropdown(speciesList.length > 0);
    }
  };

  const onSubmit = async (data) => {
    const payload = {
      name: data.name,
      species: data.species,
      date_of_birth: data.date_of_birth || null,
      notes: data.notes || null,
      has_uvb: data.has_uvb === '' ? null : data.has_uvb === 'true',
      length: data.length ? parseInt(data.length) : null,
      // Only save age_category if manually set (not auto mode)
      age_category: ageCategoryAuto ? null : (data.age_category || null),
      sex: data.sex || null,
      // Include household_id when creating
      ...(data.household_id && !isEditing && { household_id: parseInt(data.household_id) })
    };

    try {
      if (isEditing) {
        await axios.patch(`/api/reptiles/${id}`, payload);
      } else {
        await axios.post('/api/reptiles', payload);
      }
      navigate('/reptiles');
    } catch (err) {
      console.error("Failed to save reptile:", err);
      form.setError('root', { message: 'Failed to save reptile. Please try again.' });
    }
  };

  return (
    <div>
      <PageHeader
        title={isEditing ? 'Edit Reptile' : 'Add New Reptile'}
        backLink={{ to: '/reptiles', label: 'Back to Reptiles' }}
      />

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Household selector - only show when creating and user has multiple households */}
              {!isEditing && households.length > 1 && (
                <FormField
                  control={form.control}
                  name="household_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Home className="inline w-4 h-4 mr-1" />
                        Household
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select household" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {households.map(h => (
                            <SelectItem key={h.id} value={String(h.id)}>
                              <Home className="w-4 h-4 mr-2 inline" />
                              {h.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select which household this reptile belongs to
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter reptile name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Species with autocomplete */}
              <FormField
                control={form.control}
                name="species"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Species *
                      {speciesList.length > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">(select from list or type new)</span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            handleSpeciesChange(e.target.value);
                          }}
                          onFocus={() => {
                            setFilteredSpecies(speciesList);
                            setShowDropdown(speciesList.length > 0);
                          }}
                          onBlur={() => {
                            // Delay to allow click on dropdown item
                            setTimeout(() => setShowDropdown(false), 200);
                          }}
                          placeholder="e.g., Leopard Gecko, Bearded Dragon"
                          autoComplete="off"
                        />
                        {showDropdown && filteredSpecies.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {filteredSpecies.map((sp, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => {
                                  form.setValue('species', sp);
                                  setShowDropdown(false);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-foreground transition-colors"
                              >
                                {sp}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date of Birth */}
              <FormField
                control={form.control}
                name="date_of_birth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <DateInput
                        value={field.value}
                        onChange={field.onChange}
                        className="w-full"
                      />
                    </FormControl>
                    <FormDescription>Used to calculate age category</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sex */}
              <FormField
                control={form.control}
                name="sex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sex</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Unknown" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Not specified</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* UVB Lighting */}
              <FormField
                control={form.control}
                name="has_uvb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UVB Lighting</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Not specified" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Not specified</SelectItem>
                        <SelectItem value="true">Yes - Has UVB lighting</SelectItem>
                        <SelectItem value="false">No - No UVB lighting</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      This helps select appropriate supplement schedules (calcium with/without D3)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Length */}
              <FormField
                control={form.control}
                name="length"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Length (cm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="e.g., 25"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Track your reptile's length for growth monitoring. For Bearded Dragons, age category is based on size ({`<25cm = juvenile, >25cm = adult`}).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Age Category */}
              <FormField
                control={form.control}
                name="age_category"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between mb-2">
                      <FormLabel>Age Category</FormLabel>
                      <button
                        type="button"
                        onClick={() => setAgeCategoryAuto(!ageCategoryAuto)}
                        className={`text-xs px-3 py-1 rounded-full transition-colors ${
                          ageCategoryAuto
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        {ageCategoryAuto ? 'Auto' : 'Manual'}
                      </button>
                    </div>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={ageCategoryAuto}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Not specified" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Not specified</SelectItem>
                        <SelectItem value="hatchling">Hatchling</SelectItem>
                        <SelectItem value="juvenile">Juvenile</SelectItem>
                        <SelectItem value="adult">Adult</SelectItem>
                        <SelectItem value="gravid">Gravid (Pregnant Female)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {ageCategoryAuto
                        ? 'Used to recommend appropriate feeding and supplement schedules. Auto-calculated from date of birth and species (e.g., Leopard Geckos are adult at 12+ months).'
                        : `Used to recommend appropriate feeding and supplement schedules. Set manually for size-based species like Bearded Dragons (<25cm = juvenile, >25cm = adult).`}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any additional information about your reptile..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Form error */}
              {form.formState.errors.root && (
                <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                  {form.formState.errors.root.message}
                </div>
              )}

              {/* Submit buttons */}
              <div className="flex gap-2 justify-end pt-4">
                <Button type="button" variant="outline" onClick={() => navigate('/reptiles')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Saving...' : (isEditing ? 'Update' : 'Create')} Reptile
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
