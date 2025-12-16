import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Edit2, Trash2, Eye, EyeOff, Heart, Calendar, Ruler, Sun, FileText, Droplet, Scale, Activity, Upload as UploadIcon, Users } from 'lucide-react';
import { formatDate, formatDateTime } from '../utils/dateFormatting';
import FeedingRotationManager from '../components/FeedingRotationManager';
import ReptileAvatar from '../components/ReptileAvatar';
import PhotoGallery from '../components/PhotoGallery';
import PhotoLightbox from '../components/PhotoLightbox';
import PhotoUpload from '../components/PhotoUpload';
import AvatarCropper from '../components/AvatarCropper';

// A new component for the weight chart
const WeightChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">No weight data available to display chart.</p>;
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
  const [activeTab, setActiveTab] = useState('feedings');
  const [loading, setLoading] = useState(true);

  // Photo states
  const [photos, setPhotos] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [photoRefreshTrigger, setPhotoRefreshTrigger] = useState(0);
  const [showAvatarCropper, setShowAvatarCropper] = useState(false);
  const [avatarPhotoUrl, setAvatarPhotoUrl] = useState(null);
  const [autoOpenCropperAfterUpload, setAutoOpenCropperAfterUpload] = useState(false);
  const [croppingPhotoId, setCroppingPhotoId] = useState(null); // Track which photo we're cropping

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
        await axios.put(`/api/reptiles/${id}`, { is_active: newActiveState });
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
    return <div className="text-center text-gray-700 dark:text-gray-300">Loading reptile details...</div>;
  }

  if (!reptile) {
    return <div className="text-center text-red-500 dark:text-red-400">Could not load reptile data.</div>;
  }

  const tabs = {
    rotation: (
      <FeedingRotationManager reptileId={reptile.id} reptileName={reptile.name} />
    ),
    feedings: (
      <div className="space-y-2">
        {feedings.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">No feeding records yet</p>
        ) : (
          feedings.map((f, idx) => (
            <div key={f.id} className="relative group">
              <Link
                to={`/feed/${f.id}`}
                className={`block p-3 border-l-4 border-green-500 dark:border-green-600 rounded-lg shadow-sm hover:shadow-md transition-all ${
                  idx % 2 === 0
                    ? 'bg-white dark:bg-gray-800 hover:bg-green-100 dark:hover:bg-green-900/30'
                    : 'bg-gray-50 dark:bg-gray-700/30 hover:bg-green-100 dark:hover:bg-green-900/30'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <p className="text-gray-900 dark:text-white font-semibold">
                        {formatDateTimeShort(f.fed_at)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">• {f.user?.name}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 items-center">
                      {f.foods && f.foods.length > 0 && f.foods.map((food, foodIdx) => (
                        <span
                          key={foodIdx}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200"
                        >
                          {food.name} ×{food.quantity || 1}
                        </span>
                      ))}
                      {f.supplements && f.supplements.length > 0 && f.supplements.map((sup, supIdx) => (
                        <span
                          key={supIdx}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200"
                        >
                          {sup.name}
                        </span>
                      ))}
                    </div>
                    {f.notes && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 italic line-clamp-2">{f.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      to={`/feed/${f.id}`}
                      className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
                      title="View/Edit"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Edit2 size={16} />
                    </Link>
                    <button
                      onClick={(e) => { e.preventDefault(); handleDeleteFeeding(f.id); }}
                      className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
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
      <div className="space-y-2">
        {mistingLogs.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">No misting records yet</p>
        ) : (
          mistingLogs.map((m, idx) => (
            <div key={m.id} className="relative group">
              <Link
                to={`/misting/${m.id}`}
                className={`block p-3 border-l-4 border-blue-500 dark:border-blue-600 rounded-lg shadow-sm hover:shadow-md transition-all ${
                  idx % 2 === 0
                    ? 'bg-white dark:bg-gray-800 hover:bg-green-100 dark:hover:bg-green-900/30'
                    : 'bg-gray-50 dark:bg-gray-700/30 hover:bg-green-100 dark:hover:bg-green-900/30'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Droplet size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 dark:text-white font-semibold">
                        {formatDateTimeShort(m.misted_at)}
                      </p>
                      {m.notes && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 italic line-clamp-1">{m.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      to={`/misting/${m.id}`}
                      className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
                      title="View/Edit"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Edit2 size={16} />
                    </Link>
                    <button
                      onClick={(e) => { e.preventDefault(); handleDeleteMisting(m.id); }}
                      className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
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
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Weight History</h3>
            <WeightChart data={weightLogs} />
            <div className="space-y-2 mt-6">
                {weightLogs.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">No weight records yet</p>
                ) : (
                  weightLogs.map((w, idx) => (
                    <div key={w.id} className="relative group">
                      <Link
                        to={`/health-log/weight/${w.id}`}
                        className={`block p-3 border-l-4 border-orange-500 dark:border-orange-600 rounded-lg shadow-sm hover:shadow-md transition-all ${
                          idx % 2 === 0
                            ? 'bg-white dark:bg-gray-800 hover:bg-green-100 dark:hover:bg-green-900/30'
                            : 'bg-gray-50 dark:bg-gray-700/30 hover:bg-green-100 dark:hover:bg-green-900/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Scale size={18} className="text-orange-600 dark:text-orange-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <p className="text-gray-900 dark:text-white font-semibold text-lg">
                                  {w.weight_grams}g
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">• {formatDateShort(w.measured_at)}</p>
                              </div>
                              {w.notes && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 italic line-clamp-1">{w.notes}</p>}
                            </div>
                          </div>
                          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link
                              to={`/health-log/weight/${w.id}`}
                              className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
                              title="View/Edit"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Edit2 size={16} />
                            </Link>
                            <button
                              onClick={(e) => { e.preventDefault(); handleDeleteWeight(w.id); }}
                              className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
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
      <div className="space-y-2">
        {healthRecords.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">No health records yet</p>
        ) : (
          healthRecords.map((h, idx) => (
            <div key={h.id} className="relative group">
              <Link
                to={`/health-log/health/${h.id}`}
                className={`block p-3 border-l-4 border-red-500 dark:border-red-600 rounded-lg shadow-sm hover:shadow-md transition-all ${
                  idx % 2 === 0
                    ? 'bg-white dark:bg-gray-800 hover:bg-green-100 dark:hover:bg-green-900/30'
                    : 'bg-gray-50 dark:bg-gray-700/30 hover:bg-green-100 dark:hover:bg-green-900/30'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Activity size={18} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-gray-900 dark:text-white font-semibold">{h.title}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 capitalize">
                          {h.record_type}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">• {formatDateShort(h.date)}</p>
                      </div>
                      {h.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{h.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      to={`/health-log/health/${h.id}`}
                      className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
                      title="View/Edit"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Edit2 size={16} />
                    </Link>
                    <button
                      onClick={(e) => { e.preventDefault(); handleDeleteHealth(h.id); }}
                      className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Default Foods for Auto-Selection
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            These foods will be automatically pre-selected when logging a new feeding for {reptile.name}.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Default Insect */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Insect
              </label>
              <select
                value={reptile.default_insect_id || ''}
                onChange={(e) => handleUpdateDefaultFood('default_insect_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Prepared Food
              </label>
              <select
                value={reptile.default_prepared_id || ''}
                onChange={(e) => handleUpdateDefaultFood('default_prepared_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Manage {reptile.name}'s Favorite Foods
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Select foods that {reptile.name} commonly eats. These will appear first when logging feedings.
          </p>
        </div>

        {/* Group foods by category */}
        {['insect', 'worms', 'vegetable', 'fruit', 'prepared', 'frozen_animal', 'live_rodent', 'fish_seafood', 'eggs', 'other'].map(category => {
          const categoryFoods = allFoods.filter(f => f.category === category);
          if (categoryFoods.length === 0) return null;

          return (
            <div key={category} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3 capitalize">
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
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <Heart
                        size={18}
                        className={isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}
                      />
                      <span className={`text-sm ${isFavorite ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
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
                <span key={food.id} className="px-3 py-1 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-full text-sm text-gray-700 dark:text-gray-300">
                  {food.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    ),
    photos: (
      <div className="space-y-4">
        {/* Upload Button */}
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          <UploadIcon size={20} />
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
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 gap-4">
        <div className="flex items-start gap-4">
          <ReptileAvatar reptile={reptile} size="xl" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{reptile.name}</h1>
            <p className="text-gray-600 dark:text-gray-400">{reptile.species}</p>
          </div>
        </div>
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
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
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

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-900 dark:text-white">Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Date of Birth */}
          <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <Calendar size={20} className="text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Date of Birth</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {reptile.date_of_birth ? formatDate(reptile.date_of_birth) : 'Not set'}
              </p>
            </div>
          </div>

          {/* Age Category - show if set OR if we can calculate from DOB */}
          {(reptile.age_category || reptile.date_of_birth) && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <Activity size={20} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Life Stage</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                  {reptile.age_category || calculateAgeCategory(reptile.date_of_birth)}
                </p>
              </div>
            </div>
          )}

          {/* Sex */}
          {reptile.sex && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <Users size={20} className="text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Sex</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                  {reptile.sex}
                </p>
              </div>
            </div>
          )}

          {/* Length */}
          {reptile.length && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <Ruler size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Length</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {reptile.length} cm
                </p>
              </div>
            </div>
          )}

          {/* UVB Lighting */}
          {reptile.has_uvb !== null && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <Sun size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">UVB Lighting</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {reptile.has_uvb ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Notes - Full Width */}
        {reptile.notes && (
          <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg mt-4">
            <FileText size={20} className="text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                {reptile.notes}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto">
        <nav className="-mb-px flex space-x-4 sm:space-x-8" aria-label="Tabs">
          {Object.keys(tabs).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm capitalize`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        {tabs[activeTab]}
      </div>

      {/* Photo Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
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
    </div>
  );
}
