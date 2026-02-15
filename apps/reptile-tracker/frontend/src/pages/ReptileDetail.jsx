import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Edit2, Trash2, Eye, EyeOff, Heart, Calendar, Ruler, Sun, FileText, Droplet, Scale, Activity, Upload as UploadIcon, Users, Flame } from 'lucide-react';
import { formatDate, formatDateTime } from '../utils/dateFormatting';
import FeedingRotationManager from '../components/FeedingRotationManager';
import ReptileAvatar from '../components/ReptileAvatar';
import PhotoGallery from '../components/PhotoGallery';
import PhotoLightbox from '../components/PhotoLightbox';
import PhotoUpload from '../components/PhotoUpload';
import AvatarCropper from '../components/AvatarCropper';
import ResponsibilityManager from '../components/ResponsibilityManager';
import { Badge } from '@/components/ui/badge';
import { useCelebrations } from '../contexts/CelebrationContext';
import { cn } from '@/lib/utils';

// A new component for the weight chart
const WeightChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground">No weight data available to display chart.</p>;
  }

  const chartData = data.map(log => ({
    date: format(new Date(log.measured_at), 'MMM d'),
    weight: log.weight_grams,
  })).reverse();

  return (
    <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgb(31, 41, 55)',
                    border: '1px solid rgb(75, 85, 99)',
                    borderRadius: '0.5rem'
                  }}
                  labelStyle={{ color: '#f3f4f6' }}
                  itemStyle={{ color: '#22c55e' }}
                />
                <Line type="monotone" dataKey="weight" stroke="#16a34a" activeDot={{ r: 8 }} />
            </LineChart>
        </ResponsiveContainer>
    </div>
  );
};

// Helper to format date without year
const formatDateShort = (dateStr) => {
  const date = new Date(dateStr);
  return format(date, 'd MMM');
};

// Helper to format date/time without year
const formatDateTimeShort = (dateStr) => {
  const date = new Date(dateStr);
  return format(date, 'd MMM HH:mm');
};

// Calculate age category from date of birth
const calculateAgeCategory = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  const now = new Date();
  const ageInMonths = (now - birthDate) / (1000 * 60 * 60 * 24 * 30.44);

  if (ageInMonths < 6) return 'hatchling';
  if (ageInMonths < 18) return 'juvenile';
  return 'adult';
};

// Helper to calculate age display string
const calculateAgeDisplay = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  const today = new Date();
  const diffTime = Math.abs(today - birth);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);

  if (years > 0) {
    return `${years}y ${months > 0 ? `${months}mo` : ''}`;
  } else if (months > 0) {
    return `${months} months`;
  } else {
    return `${diffDays} days`;
  }
};

// Helper to get feeding status variant
const getFeedingStatusVariant = (lastFedDate) => {
  if (!lastFedDate) return 'outline';
  const days = differenceInDays(new Date(), new Date(lastFedDate));
  if (days === 0) return 'done';    // Fed today - green
  if (days <= 2) return 'outline';  // Recent - neutral
  if (days <= 5) return 'due';      // Getting old - amber
  return 'overdue';                 // Overdue - red
};

// Helper to get last fed display
const getLastFedDisplay = (lastFedDate) => {
  if (!lastFedDate) return 'No records';
  const days = differenceInDays(new Date(), new Date(lastFedDate));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
};

export default function ReptileDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reptile, setReptile] = useState(null);
  const [feedings, setFeedings] = useState([]);
  const [mistingLogs, setMistingLogs] = useState([]);
  const [weightLogs, setWeightLogs] = useState([]);
  const [healthRecords, setHealthRecords] = useState([]);
  const [favoriteFoods, setFavoriteFoods] = useState([]);
  const [allFoods, setAllFoods] = useState([]);
  const [streakData, setStreakData] = useState(null);
  const [activeTab, setActiveTab] = useState('feedings');
  const [loading, setLoading] = useState(true);
  const [isSingleUserHousehold, setIsSingleUserHousehold] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Photo states
  const [photos, setPhotos] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [photoRefreshTrigger, setPhotoRefreshTrigger] = useState(0);
  const [showAvatarCropper, setShowAvatarCropper] = useState(false);
  const [avatarPhotoUrl, setAvatarPhotoUrl] = useState(null);
  const [autoOpenCropperAfterUpload, setAutoOpenCropperAfterUpload] = useState(false);
  const [croppingPhotoId, setCroppingPhotoId] = useState(null); // Track which photo we're cropping

  const { celebrationsEnabled } = useCelebrations();

  // Check if today is the reptile's birthday
  const isBirthdayToday = () => {
    const dateOfBirth = reptile?.date_of_birth || reptile?.hatch_date;
    if (!dateOfBirth) return false;
    const today = startOfDay(new Date());
    const birthDate = new Date(dateOfBirth);
    return today.getMonth() === birthDate.getMonth() &&
           today.getDate() === birthDate.getDate();
  };

  const isBirthday = reptile && celebrationsEnabled && isBirthdayToday();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reptileRes, feedingsRes, mistingRes, weightRes, healthRes, favFoodsRes, allFoodsRes] = await Promise.all([
          axios.get(`/api/reptiles/${id}`),
          axios.get(`/api/feedings?reptile_id=${id}`),
          axios.get(`/api/misting/reptile/${id}`),
          axios.get(`/api/weight/reptile/${id}`),
          axios.get(`/api/health/reptile/${id}`),
          axios.get(`/api/reptiles/${id}/favorite-foods`),
          axios.get('/api/foods')
        ]);
        setReptile(reptileRes.data);
        setFeedings(feedingsRes.data);
        setMistingLogs(mistingRes.data);
        setWeightLogs(weightRes.data);
        setHealthRecords(healthRes.data);
        setFavoriteFoods(favFoodsRes.data);
        setAllFoods(allFoodsRes.data);

        // Fetch streak data separately (non-critical)
        try {
          const streakRes = await axios.get(`/api/streaks/?reptile_ids=${id}`);
          if (streakRes.data.streaks && streakRes.data.streaks[id]) {
            setStreakData(streakRes.data.streaks[id]);
          }
        } catch (err) {
          console.error('Failed to fetch streak data:', err);
        }

        // Fetch household status for responsibility UI (non-critical)
        try {
          const responsibilityRes = await axios.get('/api/responsibilities/overview');
          setIsSingleUserHousehold(responsibilityRes.data.is_single_user);
        } catch (err) {
          console.error('Failed to fetch responsibility overview:', err);
          // Default to single-user (hide responsibility UI on error)
        }
      } catch (error) {
        console.error('Failed to fetch reptile details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleToggleActive = async () => {
    const newActiveState = !reptile.is_active;
    const action = newActiveState ? 'unhide' : 'hide';

    if (window.confirm(`Are you sure you want to ${action} this reptile? ${newActiveState ? 'It will appear in all views again.' : 'It will be hidden from most views.'}`)) {
      try {
        await axios.patch(`/api/reptiles/${id}`, { is_active: newActiveState });
        setReptile({ ...reptile, is_active: newActiveState });
      } catch (error) {
        console.error(`Error ${action}ing reptile:`, error);
        alert(`Failed to ${action} reptile. You may not have permission.`);
      }
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this reptile? This action cannot be undone!')) {
      axios.delete(`/api/reptiles/${id}`)
        .then(() => {
          navigate('/reptiles');
        })
        .catch(error => {
          console.error('Error deleting reptile:', error);
          alert('Failed to delete reptile. You may not have permission.');
        });
    }
  };

  const handleDeleteFeeding = async (feedingId) => {
    if (window.confirm('Are you sure you want to delete this feeding?')) {
      try {
        await axios.delete(`/api/feedings/${feedingId}`);
        setFeedings(feedings.filter(f => f.id !== feedingId));
      } catch (error) {
        console.error('Error deleting feeding:', error);
        alert('Failed to delete feeding. You may not have permission.');
      }
    }
  };

  const handleDeleteMisting = async (mistingId) => {
    if (window.confirm('Are you sure you want to delete this misting log?')) {
      try {
        await axios.delete(`/api/misting/${mistingId}`);
        setMistingLogs(mistingLogs.filter(m => m.id !== mistingId));
      } catch (error) {
        console.error('Error deleting misting log:', error);
        alert('Failed to delete misting log. You may not have permission.');
      }
    }
  };

  const handleDeleteWeight = async (weightId) => {
    if (window.confirm('Are you sure you want to delete this weight log?')) {
      try {
        await axios.delete(`/api/weight/${weightId}`);
        setWeightLogs(weightLogs.filter(w => w.id !== weightId));
      } catch (error) {
        console.error('Error deleting weight log:', error);
        alert('Failed to delete weight log. You may not have permission.');
      }
    }
  };

  const handleDeleteHealth = async (healthId) => {
    if (window.confirm('Are you sure you want to delete this health record?')) {
      try {
        await axios.delete(`/api/health/${healthId}`);
        setHealthRecords(healthRecords.filter(h => h.id !== healthId));
      } catch (error) {
        console.error('Error deleting health record:', error);
        alert('Failed to delete health record. You may not have permission.');
      }
    }
  };

  const handleToggleFavoriteFood = async (foodId) => {
    const isFavorite = favoriteFoods.some(f => f.id === foodId);

    try {
      if (isFavorite) {
        await axios.delete(`/api/reptiles/${id}/favorite-foods/${foodId}`);
        setFavoriteFoods(favoriteFoods.filter(f => f.id !== foodId));
      } else {
        await axios.post(`/api/reptiles/${id}/favorite-foods/${foodId}`);
        const food = allFoods.find(f => f.id === foodId);
        if (food) {
          setFavoriteFoods([...favoriteFoods, food]);
        }
      }
    } catch (error) {
      console.error('Error toggling favorite food:', error);
      alert('Failed to update favorite food. You may not have permission.');
    }
  };

  // Species-specific default thresholds (matches backend)
  const SPECIES_THRESHOLD_DEFAULTS = {
    'crested gecko': 5,
    'ball python': 15,
    'leopard gecko': 8,
    'bearded dragon': 10,
    'corn snake': 12,
  };
  const DEFAULT_THRESHOLD = 10;

  const getSpeciesDefaultThreshold = (species) => {
    if (!species) return DEFAULT_THRESHOLD;
    const speciesLower = species.toLowerCase();
    for (const [key, value] of Object.entries(SPECIES_THRESHOLD_DEFAULTS)) {
      if (speciesLower.includes(key)) {
        return value;
      }
    }
    return DEFAULT_THRESHOLD;
  };

  // Toast helper
  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleWeightAlertToggle = async (enabled) => {
    try {
      await axios.patch(`/api/reptiles/${id}`, { weight_alerts_enabled: enabled });
      setReptile({ ...reptile, weight_alerts_enabled: enabled });
      showToast(enabled ? 'Weight alerts enabled' : 'Weight alerts disabled');
    } catch (error) {
      console.error('Failed to update weight alert setting:', error);
      showToast('Failed to update setting');
    }
  };

  // Age-aware default thresholds (matches backend AGE_AWARE_DEFAULTS)
  const AGE_AWARE_DEFAULTS = {
    hatchling: { gain: 25, loss: 0 },
    juvenile: { gain: 25, loss: 0 },
    adult: { gain: 10, loss: 5 },
  };

  const getAgeAwareDefaults = (dateOfBirth) => {
    const category = calculateAgeCategory(dateOfBirth);
    return AGE_AWARE_DEFAULTS[category] || AGE_AWARE_DEFAULTS.adult;
  };

  const handleThresholdChange = async (type, value) => {
    const threshold = value === '' ? null : parseInt(value, 10);
    const fieldName = type === 'gain' ? 'weight_alert_gain_threshold_percent' : 'weight_alert_loss_threshold_percent';

    // Validate range (loss can be 0 for "any loss"; gain up to 500% for babies)
    const minVal = type === 'gain' ? 1 : 0;
    const maxVal = type === 'gain' ? 500 : 100;
    if (threshold !== null && (threshold < minVal || threshold > maxVal)) {
      return;
    }

    try {
      await axios.patch(`/api/reptiles/${id}`, { [fieldName]: threshold });
      setReptile({ ...reptile, [fieldName]: threshold });
      // No toast for threshold to avoid spam during typing
    } catch (error) {
      console.error(`Failed to update ${type} threshold:`, error);
      showToast(`Failed to update ${type} threshold`);
    }
  };

  const handleUpdateDefaultFood = async (field, foodId) => {
    try {
      await axios.patch(`/api/reptiles/${id}`, {
        [field]: foodId === '' ? null : parseInt(foodId)
      });
      setReptile({
        ...reptile,
        [field]: foodId === '' ? null : parseInt(foodId)
      });
    } catch (error) {
      console.error('Error updating default food:', error);
      alert('Failed to update default food. You may not have permission.');
    }
  };

  // Photo handlers
  const handlePhotoClick = (photo) => {
    setLightboxPhoto(photo);
  };

  const handleSetAvatar = async (photoId) => {
    try {
      await axios.patch(`/api/reptiles/${id}`, {
        avatar_photo_id: photoId
      });
      setReptile({
        ...reptile,
        avatar_photo_id: photoId,
        avatar_photo_url: `/api/photos/reptiles/${id}/avatar`
      });
    } catch (error) {
      console.error('Error setting avatar:', error);
    }
  };

  const handlePhotoDeleted = (photoId) => {
    setPhotos(photos.filter(p => p.id !== photoId));
    if (reptile.avatar_photo_id === photoId) {
      setReptile({ ...reptile, avatar_photo_id: null, avatar_photo_url: null });
    }
  };

  const handlePhotoUpdated = (updatedPhoto) => {
    setPhotos(photos.map(p => p.id === updatedPhoto.id ? updatedPhoto : p));
  };

  const handleUploadSuccess = (photo) => {
    setPhotos([photo, ...photos]);
    setShowUploadModal(false);
    setPhotoRefreshTrigger(prev => prev + 1); // Trigger gallery refresh

    // If we should auto-open the cropper (e.g., from "Add Avatar" button)
    if (autoOpenCropperAfterUpload && photo.id) {
      setCroppingPhotoId(photo.id); // Track which photo we're cropping
      setAvatarPhotoUrl(`/api/photos/${photo.id}/file`);
      setShowAvatarCropper(true);
      setAutoOpenCropperAfterUpload(false); // Reset flag
    }
  };

  const handleEditAvatar = async () => {
    if (!reptile.avatar_photo_id) return;

    try {
      // Fetch the full-size photo URL for cropping
      const response = await axios.get(`/api/photos/${reptile.avatar_photo_id}`);
      setCroppingPhotoId(reptile.avatar_photo_id); // Track which photo we're cropping
      setAvatarPhotoUrl(`/api/photos/${reptile.avatar_photo_id}/file`);
      setShowAvatarCropper(true);
    } catch (error) {
      console.error('Error loading avatar photo:', error);
      alert('Failed to load avatar photo');
    }
  };

  const handleSaveAvatarCrop = async (cropData) => {
    try {
      console.log('Sending crop data to backend:', cropData);

      const formData = new FormData();
      formData.append('photo_id', croppingPhotoId); // Use the tracked photo ID
      formData.append('crop_x', cropData.x);
      formData.append('crop_y', cropData.y);
      formData.append('crop_width', cropData.width);
      formData.append('crop_height', cropData.height);
      formData.append('zoom', cropData.zoom);
      formData.append('image_pos_x', cropData.imagePosX);
      formData.append('image_pos_y', cropData.imagePosY);
      formData.append('border_color', cropData.borderColor);

      // Log FormData contents
      console.log('FormData contents:');
      for (let [key, value] of formData.entries()) {
        console.log(`  ${key}: ${value}`);
      }

      await axios.post(`/api/photos/reptiles/${id}/avatar`, formData);

      // Refresh reptile data to get updated avatar
      const reptileResponse = await axios.get(`/api/reptiles/${id}`);
      setReptile(reptileResponse.data);

      // Show success notification
      alert('Avatar updated successfully!');

      // Close the cropper modal
      setShowAvatarCropper(false);
      setCroppingPhotoId(null); // Clear the cropping photo ID
    } catch (error) {
      console.error('Error updating avatar:', error);
      console.error('Backend error details:', error.response?.data);
      alert(`Failed to update avatar: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleCloseCropper = () => {
    setShowAvatarCropper(false);
    setAvatarPhotoUrl(null);
    setCroppingPhotoId(null); // Clear the cropping photo ID
  };

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading reptile details...</div>;
  }

  if (!reptile) {
    return <div className="text-center text-red-500 dark:text-red-400">Could not load reptile data.</div>;
  }

  const tabs = {
    rotation: (
      <FeedingRotationManager reptileId={reptile.id} reptileName={reptile.name} />
    ),
    feedings: (
      <div className="space-y-1.5">
        {feedings.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No feeding records yet</p>
        ) : (
          feedings.map((f, idx) => (
            <div key={f.id} className="relative group">
              <Link
                to={`/feed/${f.id}`}
                className={`block p-2.5 border-l-4 border-green-500 dark:border-green-600 rounded-lg shadow-sm hover:shadow-md transition-all ${
                  idx % 2 === 0
                    ? 'bg-card hover:bg-green-100 dark:hover:bg-green-900/30'
                    : 'bg-secondary/30 hover:bg-green-100 dark:hover:bg-green-900/30'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <p className="text-foreground font-semibold">
                        {formatDateTimeShort(f.fed_at)}
                      </p>
                      <p className="text-xs text-muted-foreground">• {f.user?.name}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 items-center">
                      {f.foods && f.foods.length > 0 && f.foods.map((food, foodIdx) => (
                        <Badge key={foodIdx} variant="secondary" className="text-xs h-5 px-1.5">
                          {food.name} x{food.quantity || 1}
                        </Badge>
                      ))}
                      {f.supplements && f.supplements.length > 0 && f.supplements.map((sup, supIdx) => (
                        <Badge key={supIdx} variant="mist" className="text-xs h-5 px-1.5">
                          {sup.name}
                        </Badge>
                      ))}
                    </div>
                    {f.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">{f.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      to={`/feed/${f.id}`}
                      className="p-1.5 bg-card border border-border rounded text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-secondary shadow-sm"
                      title="View/Edit"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Edit2 size={16} />
                    </Link>
                    <button
                      onClick={(e) => { e.preventDefault(); handleDeleteFeeding(f.id); }}
                      className="p-1.5 bg-card border border-border rounded text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-secondary shadow-sm"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </Link>
            </div>
          ))
        )}
      </div>
    ),
    misting: (
      <div className="space-y-1.5">
        {mistingLogs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No misting records yet</p>
        ) : (
          mistingLogs.map((m, idx) => (
            <div key={m.id} className="relative group">
              <Link
                to={`/misting/${m.id}`}
                className={`block p-2.5 border-l-4 border-blue-500 dark:border-blue-600 rounded-lg shadow-sm hover:shadow-md transition-all ${
                  idx % 2 === 0
                    ? 'bg-card hover:bg-green-100 dark:hover:bg-green-900/30'
                    : 'bg-secondary/30 hover:bg-green-100 dark:hover:bg-green-900/30'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Droplet size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-semibold">
                        {formatDateTimeShort(m.misted_at)}
                      </p>
                      {m.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic line-clamp-1">{m.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      to={`/misting/${m.id}`}
                      className="p-1.5 bg-card border border-border rounded text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-secondary shadow-sm"
                      title="View/Edit"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Edit2 size={16} />
                    </Link>
                    <button
                      onClick={(e) => { e.preventDefault(); handleDeleteMisting(m.id); }}
                      className="p-1.5 bg-card border border-border rounded text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-secondary shadow-sm"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </Link>
            </div>
          ))
        )}
      </div>
    ),
    weight: (
        <div>
            <h3 className="text-base font-semibold mb-3 text-foreground">Weight History</h3>
            <WeightChart data={weightLogs} />
            <div className="space-y-1.5 mt-4">
                {weightLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No weight records yet</p>
                ) : (
                  weightLogs.map((w, idx) => (
                    <div key={w.id} className="relative group">
                      <Link
                        to={`/health-log/weight/${w.id}`}
                        className={`block p-2.5 border-l-4 border-orange-500 dark:border-orange-600 rounded-lg shadow-sm hover:shadow-md transition-all ${
                          idx % 2 === 0
                            ? 'bg-card hover:bg-green-100 dark:hover:bg-green-900/30'
                            : 'bg-secondary/30 hover:bg-green-100 dark:hover:bg-green-900/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Scale size={18} className="text-orange-600 dark:text-orange-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <p className="text-foreground font-semibold text-lg">
                                  {w.weight_grams}g
                                </p>
                                <p className="text-xs text-muted-foreground">• {formatDateShort(w.measured_at)}</p>
                              </div>
                              {w.notes && <p className="text-xs text-muted-foreground mt-0.5 italic line-clamp-1">{w.notes}</p>}
                            </div>
                          </div>
                          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link
                              to={`/health-log/weight/${w.id}`}
                              className="p-1.5 bg-card border border-border rounded text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-secondary shadow-sm"
                              title="View/Edit"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Edit2 size={16} />
                            </Link>
                            <button
                              onClick={(e) => { e.preventDefault(); handleDeleteWeight(w.id); }}
                              className="p-1.5 bg-card border border-border rounded text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-secondary shadow-sm"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </Link>
                    </div>
                  ))
                )}
            </div>
        </div>
    ),
    health: (
      <div className="space-y-1.5">
        {healthRecords.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No health records yet</p>
        ) : (
          healthRecords.map((h, idx) => (
            <div key={h.id} className="relative group">
              <Link
                to={`/health-log/health/${h.id}`}
                className={`block p-2.5 border-l-4 border-red-500 dark:border-red-600 rounded-lg shadow-sm hover:shadow-md transition-all ${
                  idx % 2 === 0
                    ? 'bg-card hover:bg-green-100 dark:hover:bg-green-900/30'
                    : 'bg-secondary/30 hover:bg-green-100 dark:hover:bg-green-900/30'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Activity size={18} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-foreground font-semibold">{h.title}</p>
                        <Badge variant="destructive" className="text-xs capitalize">
                          {h.record_type}
                        </Badge>
                        <p className="text-xs text-muted-foreground">• {formatDateShort(h.date)}</p>
                      </div>
                      {h.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{h.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      to={`/health-log/health/${h.id}`}
                      className="p-1.5 bg-card border border-border rounded text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-secondary shadow-sm"
                      title="View/Edit"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Edit2 size={16} />
                    </Link>
                    <button
                      onClick={(e) => { e.preventDefault(); handleDeleteHealth(h.id); }}
                      className="p-1.5 bg-card border border-border rounded text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-secondary shadow-sm"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </Link>
            </div>
          ))
        )}
      </div>
    ),
    favorites: (
      <div className="space-y-6">
        {/* Default Foods for Auto-Selection */}
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Default Foods for Auto-Selection
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            These foods will be automatically pre-selected when logging a new feeding for {reptile.name}.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Default Insect */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Default Insect
              </label>
              <select
                value={reptile.default_insect_id || ''}
                onChange={(e) => handleUpdateDefaultFood('default_insect_id', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground"
              >
                <option value="">None</option>
                {allFoods
                  .filter(f => f.category === 'insect' || f.category === 'worms')
                  .map(food => (
                    <option key={food.id} value={food.id}>
                      {food.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Default Prepared Food */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Default Prepared Food
              </label>
              <select
                value={reptile.default_prepared_id || ''}
                onChange={(e) => handleUpdateDefaultFood('default_prepared_id', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground"
              >
                <option value="">None</option>
                {allFoods
                  .filter(f => f.category === 'prepared')
                  .map(food => (
                    <option key={food.id} value={food.id}>
                      {food.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Manage {reptile.name}'s Favorite Foods
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Select foods that {reptile.name} commonly eats. These will appear first when logging feedings.
          </p>
        </div>

        {/* Group foods by category */}
        {['insect', 'worms', 'vegetable', 'fruit', 'prepared', 'frozen_animal', 'live_rodent', 'fish_seafood', 'eggs', 'other'].map(category => {
          const categoryFoods = allFoods.filter(f => f.category === category);
          if (categoryFoods.length === 0) return null;

          return (
            <div key={category} className="border border-border rounded-lg p-4">
              <h4 className="font-medium text-foreground mb-3 capitalize">
                {category.replace('_', ' ')}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {categoryFoods.map(food => {
                  const isFavorite = favoriteFoods.some(f => f.id === food.id);
                  return (
                    <button
                      key={food.id}
                      onClick={() => handleToggleFavoriteFood(food.id)}
                      className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                        isFavorite
                          ? 'border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-600'
                          : 'border-border hover:border-gray-300 dark:hover:border-gray-600 hover:bg-secondary/50'
                      }`}
                    >
                      <Heart
                        size={18}
                        className={isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}
                      />
                      <span className={`text-sm ${isFavorite ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                        {food.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {favoriteFoods.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              {reptile.name}'s Favorites ({favoriteFoods.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {favoriteFoods.map(food => (
                <span key={food.id} className="px-3 py-1 bg-card border border-blue-300 dark:border-blue-700 rounded-full text-sm text-muted-foreground">
                  {food.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    ),
    photos: (
      <div className="space-y-3">
        {/* Upload Button - compact */}
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary/80 text-primary-foreground rounded-lg text-sm transition-colors"
        >
          <UploadIcon size={16} />
          Upload Photos
        </button>

        {/* Photo Gallery */}
        <PhotoGallery
          reptileId={parseInt(id)}
          currentAvatarId={reptile?.avatar_photo_id}
          avatarCropSettings={
            reptile?.avatar_image_pos_x != null &&
            reptile?.avatar_image_pos_y != null &&
            !isNaN(reptile.avatar_image_pos_x) &&
            !isNaN(reptile.avatar_image_pos_y)
              ? {
                  crop: { x: reptile.avatar_image_pos_x, y: reptile.avatar_image_pos_y },
                  zoom: reptile.avatar_crop_zoom,
                  borderColor: reptile.avatar_border_color
                }
              : undefined
          }
          onPhotoClick={handlePhotoClick}
          onSetAvatar={handleSetAvatar}
          onPhotoDeleted={handlePhotoDeleted}
          onPhotoUpdated={handlePhotoUpdated}
          onPhotosLoaded={setPhotos}
          refreshTrigger={photoRefreshTrigger}
        />
      </div>
    ),
  };

  return (
    <div className={cn(
      isBirthday && 'relative'
    )}>
      {/* Birthday festive glow overlay - subtle gradient accent */}
      {isBirthday && (
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-xl pointer-events-none">
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-violet-500/10 blur-3xl rounded-full" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-violet-400/10 blur-3xl rounded-full" />
        </div>
      )}
      <div className={cn(
        "flex flex-col sm:flex-row sm:items-start gap-4 mb-6 p-4 rounded-xl transition-all",
        isBirthday && "bg-gradient-to-r from-violet-500/5 via-transparent to-violet-400/5 ring-1 ring-violet-500/20"
      )}>
        {/* Avatar - clickable to edit */}
        <div className="flex-shrink-0">
          <ReptileAvatar reptile={reptile} size="xl" className="cursor-pointer" onClick={handleEditAvatar} />
        </div>

        {/* Name, species, and quick stats */}
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">{reptile.name}</h1>
          <p className="text-muted-foreground mb-3">{reptile.species}</p>

          {/* Quick stats - with labels for clarity */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {/* Age */}
            {reptile.date_of_birth && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Age:</span>
                <span className="text-foreground">{calculateAgeDisplay(reptile.date_of_birth)}</span>
              </div>
            )}

            {/* Last fed */}
            {feedings.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-base">🍽️</span>
                <span className="text-muted-foreground">Fed:</span>
                <span className={
                  getFeedingStatusVariant(feedings[0]?.fed_at) === 'done' ? 'text-primary' :
                  getFeedingStatusVariant(feedings[0]?.fed_at) === 'due' ? 'text-amber-500' :
                  getFeedingStatusVariant(feedings[0]?.fed_at) === 'overdue' ? 'text-destructive' :
                  'text-foreground'
                }>
                  {getLastFedDisplay(feedings[0]?.fed_at)}
                </span>
              </div>
            )}

            {/* Weight */}
            {weightLogs.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-amber-500" />
                <span className="text-muted-foreground">Weight:</span>
                <span className="text-foreground">
                  {weightLogs[0].weight_grams}g
                </span>
                {weightLogs.length > 1 && (() => {
                  const prev = weightLogs[1].weight_grams;
                  const curr = weightLogs[0].weight_grams;
                  if (prev && prev !== 0) {
                    const change = ((curr - prev) / prev * 100).toFixed(1);
                    const isPositive = parseFloat(change) > 0;
                    return (
                      <span className={isPositive ? 'text-primary' : 'text-destructive'}>
                        ({isPositive ? '+' : ''}{change}%)
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            {/* Last shed */}
            {(() => {
              const lastShed = healthRecords.find(h => h.record_type === 'shed');
              if (lastShed) {
                return (
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-cyan-500" />
                    <span className="text-muted-foreground">Last Shed:</span>
                    <span className="text-foreground">{formatDateShort(lastShed.date)}</span>
                  </div>
                );
              }
              return null;
            })()}

            {/* Care streak */}
            {streakData && streakData.current_streak > 0 && (
              <div className="flex items-center gap-1.5" title={`Your longest streak: ${streakData.longest_streak} tasks`}>
                <Heart className="w-4 h-4 text-rose-500" />
                <span className="text-muted-foreground">Care Streak:</span>
                <span className="text-rose-400">{streakData.current_streak} tasks</span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Link to={`/health-log/${id}`} className="btn-primary text-sm sm:text-base whitespace-nowrap">Log Health</Link>
          <Link to={`/measurements/${id}`} className="btn-secondary text-sm sm:text-base whitespace-nowrap">Measurements</Link>
          {!reptile.avatar_photo_id && !reptile.avatar_photo_url ? (
            <button
              onClick={() => {
                setAutoOpenCropperAfterUpload(true);
                setShowUploadModal(true);
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm sm:text-base flex items-center gap-2 transition-colors"
            >
              <Edit2 size={16} />
              Add Avatar
            </button>
          ) : (
            <button
              onClick={handleEditAvatar}
              className="btn-secondary text-sm sm:text-base flex items-center gap-2"
            >
              <Edit2 size={16} />
              Edit Avatar
            </button>
          )}
          <Link to={`/reptiles/${id}/edit`} className="btn-secondary text-sm sm:text-base">Edit</Link>
          <button
            onClick={handleToggleActive}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
              reptile.is_active
                ? 'bg-secondary text-muted-foreground hover:bg-gray-300 dark:hover:bg-gray-600'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {reptile.is_active ? (
              <>
                <EyeOff size={18} />
                Hide
              </>
            ) : (
              <>
                <Eye size={18} />
                Unhide
              </>
            )}
          </button>
          <button onClick={handleDelete} className="btn-danger text-sm sm:text-base">Delete</button>
        </div>
      </div>

      {/* Care Responsibility - only shows for multi-user households */}
      {!isSingleUserHousehold && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-4 mb-4">
          <h2 className="text-lg font-semibold mb-3 text-foreground flex items-center gap-2">
            <Users className="w-5 h-5" />
            Care Responsibility
          </h2>
          <ResponsibilityManager reptileId={parseInt(id)} />
        </div>
      )}

      <div className="bg-card rounded-lg shadow-sm border border-border p-4 mb-4">
        <h2 className="text-lg font-semibold mb-3 text-foreground">Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Date of Birth */}
          <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
            <Calendar size={20} className="text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Date of Birth</p>
              <p className="text-sm font-medium text-foreground">
                {reptile.date_of_birth ? formatDate(reptile.date_of_birth) : 'Not set'}
              </p>
            </div>
          </div>

          {/* Age Category - show if set OR if we can calculate from DOB */}
          {(reptile.age_category || reptile.date_of_birth) && (
            <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
              <Activity size={20} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Life Stage</p>
                <p className="text-sm font-medium text-foreground capitalize">
                  {reptile.age_category || calculateAgeCategory(reptile.date_of_birth)}
                </p>
              </div>
            </div>
          )}

          {/* Sex */}
          {reptile.sex && (
            <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
              <Users size={20} className="text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Sex</p>
                <p className="text-sm font-medium text-foreground capitalize">
                  {reptile.sex}
                </p>
              </div>
            </div>
          )}

          {/* Length */}
          {reptile.length && (
            <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
              <Ruler size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Length</p>
                <p className="text-sm font-medium text-foreground">
                  {reptile.length} cm
                </p>
              </div>
            </div>
          )}

          {/* UVB Lighting */}
          {reptile.has_uvb !== null && (
            <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
              <Sun size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">UVB Lighting</p>
                <p className="text-sm font-medium text-foreground">
                  {reptile.has_uvb ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Notes - Full Width */}
        {reptile.notes && (
          <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg mt-4">
            <FileText size={20} className="text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {reptile.notes}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Weight Alert Settings */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-4 mb-4">
        <h2 className="text-lg font-semibold mb-3 text-foreground flex items-center gap-2">
          <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          Weight Change Alerts
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Get notified when weight changes exceed your threshold
        </p>

        {/* Enable/disable toggle */}
        <label className="flex items-start gap-3 p-4 rounded-lg border-2 border-border bg-card/50 cursor-pointer hover:bg-secondary transition-colors mb-4">
          <input
            type="checkbox"
            checked={reptile.weight_alerts_enabled || false}
            onChange={(e) => handleWeightAlertToggle(e.target.checked)}
            className="w-4 h-4 rounded mt-0.5"
          />
          <div className="flex-1">
            <div className="font-medium text-foreground">Enable Weight Alerts</div>
            <div className="text-sm text-muted-foreground">
              Receive notifications for significant weight changes
            </div>
          </div>
        </label>

        {/* Threshold configuration - only show when enabled */}
        {reptile.weight_alerts_enabled && (
          <div className="space-y-4 pt-2 border-t border-border">
            {/* Age category info */}
            <p className="text-xs text-muted-foreground">
              {reptile.date_of_birth ? (
                <>Age category: <span className="font-medium">{calculateAgeCategory(reptile.date_of_birth)}</span> — defaults optimized for this life stage</>
              ) : (
                <>No birth date set — using adult defaults</>
              )}
            </p>

            {/* Gain threshold */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Weight Gain Threshold
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="500"
                  placeholder={getAgeAwareDefaults(reptile.date_of_birth).gain}
                  value={reptile.weight_alert_gain_threshold_percent || ''}
                  onChange={(e) => handleThresholdChange('gain', e.target.value)}
                  className="w-24 px-3 py-2 border border-border rounded-lg bg-card text-foreground"
                />
                <span className="text-sm text-muted-foreground">% increase</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {reptile.weight_alert_gain_threshold_percent
                  ? `Custom: ${reptile.weight_alert_gain_threshold_percent}%`
                  : `Default for ${calculateAgeCategory(reptile.date_of_birth) || 'adult'}: ${getAgeAwareDefaults(reptile.date_of_birth).gain}%`
                }
                {calculateAgeCategory(reptile.date_of_birth) !== 'adult' && ' (celebratory growth milestone!)'}
              </p>
            </div>

            {/* Loss threshold */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Weight Loss Threshold
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder={getAgeAwareDefaults(reptile.date_of_birth).loss}
                  value={reptile.weight_alert_loss_threshold_percent ?? ''}
                  onChange={(e) => handleThresholdChange('loss', e.target.value)}
                  className="w-24 px-3 py-2 border border-border rounded-lg bg-card text-foreground"
                />
                <span className="text-sm text-muted-foreground">% decrease</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {reptile.weight_alert_loss_threshold_percent !== null && reptile.weight_alert_loss_threshold_percent !== undefined
                  ? `Custom: ${reptile.weight_alert_loss_threshold_percent}%`
                  : `Default for ${calculateAgeCategory(reptile.date_of_birth) || 'adult'}: ${getAgeAwareDefaults(reptile.date_of_birth).loss}%`
                }
                {getAgeAwareDefaults(reptile.date_of_birth).loss === 0 && ' (any loss triggers alert)'}
              </p>
            </div>

            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              Alerts use a rolling average of the last 3 weights as baseline. Limited to once per week.
            </p>
          </div>
        )}
      </div>

      <div className="border-b border-border mb-4 overflow-x-auto">
        <nav className="-mb-px flex space-x-4 sm:space-x-8" aria-label="Tabs">
          {Object.keys(tabs).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-2.5 sm:py-3 px-1 border-b-2 font-medium text-xs sm:text-sm capitalize`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border p-4">
        {tabs[activeTab]}
      </div>

      {/* Photo Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full">
            <PhotoUpload
              reptileId={parseInt(id)}
              category="general"
              onUploadSuccess={handleUploadSuccess}
              onCancel={() => setShowUploadModal(false)}
            />
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <PhotoLightbox
          photos={photos}
          initialPhotoId={lightboxPhoto.id}
          currentAvatarId={reptile?.avatar_photo_id}
          avatarCropSettings={
            reptile?.avatar_image_pos_x != null &&
            reptile?.avatar_image_pos_y != null &&
            !isNaN(reptile.avatar_image_pos_x) &&
            !isNaN(reptile.avatar_image_pos_y)
              ? {
                  crop: { x: reptile.avatar_image_pos_x, y: reptile.avatar_image_pos_y },
                  zoom: reptile.avatar_crop_zoom,
                  borderColor: reptile.avatar_border_color
                }
              : undefined
          }
          onClose={() => setLightboxPhoto(null)}
          onSetAvatar={handleSetAvatar}
          onPhotoDeleted={handlePhotoDeleted}
          onPhotoUpdated={handlePhotoUpdated}
        />
      )}

      {/* Avatar Cropper Modal */}
      {showAvatarCropper && avatarPhotoUrl && (
        <AvatarCropper
          imageUrl={avatarPhotoUrl}
          onSave={handleSaveAvatarCrop}
          onCancel={handleCloseCropper}
          initialCrop={
            reptile.avatar_image_pos_x != null && reptile.avatar_image_pos_y != null
              ? { x: reptile.avatar_image_pos_x, y: reptile.avatar_image_pos_y }
              : { x: 0, y: 0 }
          }
          initialZoom={reptile.avatar_crop_zoom}
          initialBorderColor={reptile.avatar_border_color}
        />
      )}

      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-card border border-border rounded-lg shadow-lg p-4 animate-in slide-in-from-right fade-in duration-200">
          <span className="text-sm text-foreground">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
