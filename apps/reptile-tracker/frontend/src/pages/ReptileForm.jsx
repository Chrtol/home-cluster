import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import DateInput from '../components/DateInput';

export default function ReptileForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id && id !== 'new'; // Correctly determine if editing

    const [name, setName] = useState('');
    const [species, setSpecies] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [notes, setNotes] = useState('');
    const [hasUvb, setHasUvb] = useState('');
    const [length, setLength] = useState('');
    const [ageCategory, setAgeCategory] = useState('');
    const [ageCategoryAuto, setAgeCategoryAuto] = useState(true); // Toggle for auto/manual age category
    const [error, setError] = useState('');
    const [speciesList, setSpeciesList] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [filteredSpecies, setFilteredSpecies] = useState([]);

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

    useEffect(() => {
        // Fetch list of existing species for autocomplete
        axios.get('/api/reptiles/species')
            .then(res => {
                setSpeciesList(res.data);
            })
            .catch(err => {
                console.error("Failed to fetch species list:", err);
                // Non-critical error, continue without autocomplete
            });

        if (isEditing) {
            axios.get(`/api/reptiles/${id}`)
                .then(res => {
                    setName(res.data.name);
                    setSpecies(res.data.species);
                    setDateOfBirth(res.data.date_of_birth ? res.data.date_of_birth.split('T')[0] : '');
                    setNotes(res.data.notes || '');
                    setHasUvb(res.data.has_uvb === null ? '' : res.data.has_uvb ? 'yes' : 'no');
                    setLength(res.data.length || '');
                    setAgeCategory(res.data.age_category || '');
                    // If age_category is set, assume manual mode
                    setAgeCategoryAuto(!res.data.age_category);
                })
                .catch(err => {
                    console.error("Failed to fetch reptile for editing:", err);
                    setError("Could not load reptile data.");
                });
        }
    }, [id, isEditing]);

    // Auto-calculate age category when date of birth or species changes (if auto mode is enabled)
    useEffect(() => {
        if (ageCategoryAuto && dateOfBirth && species) {
            const calculated = calculateAgeCategory(dateOfBirth, species);
            if (calculated) {
                setAgeCategory(calculated);
            }
        }
    }, [dateOfBirth, species, ageCategoryAuto]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            name,
            species,
            date_of_birth: dateOfBirth || null,
            notes: notes || null,
            has_uvb: hasUvb === '' ? null : hasUvb === 'yes',
            length: length ? parseInt(length) : null,
            age_category: ageCategory || null
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
            setError("Failed to save reptile. Please try again.");
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">{isEditing ? 'Edit Reptile' : 'Add New Reptile'}</h1>
            {error && <p className="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg mb-4 border border-red-200 dark:border-red-800">{error}</p>}
            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 space-y-4">
                <div>
                    <label htmlFor="name" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">Name</label>
                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                    />
                </div>
                <div className="relative">
                    <label htmlFor="species" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Species
                        {speciesList.length > 0 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">(select from list or type new)</span>
                        )}
                    </label>
                    <input
                        id="species"
                        type="text"
                        value={species}
                        onChange={(e) => {
                            const value = e.target.value;
                            setSpecies(value);
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
                        }}
                        onFocus={() => {
                            setFilteredSpecies(speciesList);
                            setShowDropdown(speciesList.length > 0);
                        }}
                        onBlur={() => {
                            // Delay to allow click on dropdown item
                            setTimeout(() => setShowDropdown(false), 200);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., Bearded Dragon, Leopard Gecko"
                        required
                        autoComplete="off"
                    />
                    {showDropdown && filteredSpecies.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {filteredSpecies.map((sp, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => {
                                        setSpecies(sp);
                                        setShowDropdown(false);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white transition-colors"
                                >
                                    {sp}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div>
                    <label htmlFor="dateOfBirth" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Date of Birth (optional)
                    </label>
                    <DateInput
                        id="dateOfBirth"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                </div>
                <div>
                    <label htmlFor="notes" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">Notes (optional)</label>
                    <textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows="4"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Any additional information about your reptile..."
                    />
                </div>
                <div>
                    <label htmlFor="hasUvb" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">
                        UVB Lighting <span className="text-xs text-gray-500 dark:text-gray-400">(optional)</span>
                    </label>
                    <select
                        id="hasUvb"
                        value={hasUvb}
                        onChange={(e) => setHasUvb(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="">Not specified</option>
                        <option value="yes">Yes - Has UVB lighting</option>
                        <option value="no">No - No UVB lighting</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        This helps select appropriate supplement schedules (calcium with/without D3)
                    </p>
                </div>

                <div>
                    <label htmlFor="length" className="block font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Length (cm) <span className="text-xs text-gray-500 dark:text-gray-400">(optional)</span>
                    </label>
                    <input
                        id="length"
                        type="number"
                        min="0"
                        value={length}
                        onChange={(e) => setLength(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., 25"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Track your reptile's length for growth monitoring. For Bearded Dragons, age category is based on size ({`<12" = juvenile, >12" = adult`}).
                    </p>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label htmlFor="ageCategory" className="block font-medium text-gray-700 dark:text-gray-300">
                            Age Category <span className="text-xs text-gray-500 dark:text-gray-400">(optional)</span>
                        </label>
                        <button
                            type="button"
                            onClick={() => setAgeCategoryAuto(!ageCategoryAuto)}
                            className={`text-xs px-3 py-1 rounded-full transition-colors ${
                                ageCategoryAuto
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                        >
                            {ageCategoryAuto ? 'Auto' : 'Manual'}
                        </button>
                    </div>
                    <select
                        id="ageCategory"
                        value={ageCategory}
                        onChange={(e) => setAgeCategory(e.target.value)}
                        disabled={ageCategoryAuto}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <option value="">Not specified</option>
                        <option value="hatchling">Hatchling</option>
                        <option value="juvenile">Juvenile</option>
                        <option value="adult">Adult</option>
                        <option value="gravid">Gravid (Pregnant Female)</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {ageCategoryAuto
                            ? 'Used to recommend appropriate feeding and supplement schedules. Auto-calculated from date of birth and species (e.g., Leopard Geckos are adult at 12+ months).'
                            : `Used to recommend appropriate feeding and supplement schedules. Set manually for size-based species like Bearded Dragons (<12" = juvenile, >12" = adult).`}
                    </p>
                </div>

                <button type="submit" className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium">
                    {isEditing ? 'Save Changes' : 'Create Reptile'}
                </button>
            </form>
        </div>
    );
}