from datetime import datetime, time, date
from typing import Optional, List, Dict
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_serializer
from app.models import AccessLevel, FoodCategory, InsectSize, AnimalSize, CompletionStatus, CompletionType


# User schemas
class UserBase(BaseModel):
    email: EmailStr
    name: str
    timezone: Optional[str] = "UTC"
    show_favorites_first: bool = True


class UserCreate(UserBase):
    oidc_sub: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    timezone: Optional[str] = None
    show_favorites_first: Optional[bool] = None


class User(UserBase):
    id: int
    oidc_sub: str
    created_at: datetime
    last_login: datetime

    class Config:
        from_attributes = True


class UserSimple(BaseModel):
    """Simplified user schema for logged_by fields"""
    id: int
    name: str

    class Config:
        from_attributes = True


# Reptile schemas
class ReptileBase(BaseModel):
    name: str
    species: str
    date_of_birth: Optional[datetime] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None  # Legacy field - deprecated in favor of avatar_photo_id
    feeding_schedule_enabled: bool = False
    feeding_frequency_days: Optional[int] = None
    reminder_enabled: bool = False
    reminder_hours_before: int = 2
    is_active: bool = True
    has_uvb: Optional[bool] = None  # UVB lighting setup
    length: Optional[int] = None  # Length in centimeters
    age_category: Optional[str] = None  # hatchling, juvenile, adult, gravid
    sex: Optional[str] = None  # male, female, unknown
    default_insect_id: Optional[int] = None  # Default insect food for auto-selection
    default_prepared_id: Optional[int] = None  # Default prepared food for auto-selection
    avatar_photo_id: Optional[str] = None  # UUID of photo to use as avatar
    avatar_border_color: Optional[str] = None  # Hex color code for avatar border


class ReptileCreate(ReptileBase):
    pass


class ReptileUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None  # Legacy field
    feeding_schedule_enabled: Optional[bool] = None
    feeding_frequency_days: Optional[int] = None
    reminder_enabled: Optional[bool] = None
    reminder_hours_before: Optional[int] = None
    is_active: Optional[bool] = None
    has_uvb: Optional[bool] = None
    length: Optional[int] = None
    age_category: Optional[str] = None
    sex: Optional[str] = None
    default_insect_id: Optional[int] = None
    default_prepared_id: Optional[int] = None
    avatar_photo_id: Optional[str] = None  # UUID of photo to use as avatar
    avatar_border_color: Optional[str] = None  # Hex color code for avatar border


class Reptile(ReptileBase):
    id: int
    created_at: datetime
    updated_at: datetime
    avatar_photo_id: Optional[UUID] = None  # Override to UUID type for DB model
    avatar_photo_url: Optional[str] = None  # Computed field - populated by endpoint
    avatar_crop_x: Optional[int] = None  # Crop coordinates in pixels
    avatar_crop_y: Optional[int] = None
    avatar_crop_width: Optional[int] = None
    avatar_crop_height: Optional[int] = None
    avatar_crop_zoom: Optional[float] = None  # Zoom level (1.0 to 3.0)
    avatar_image_pos_x: Optional[float] = None  # Image position in percentages (for UI)
    avatar_image_pos_y: Optional[float] = None  # Image position in percentages (for UI)

    @field_serializer('avatar_photo_id')
    def serialize_avatar_id(self, value: Optional[UUID]) -> Optional[str]:
        """Serialize UUID to string for JSON responses."""
        return str(value) if value else None

    class Config:
        from_attributes = True


class ReptileWithAccess(Reptile):
    access_level: AccessLevel
    last_feeding: Optional[datetime] = None


class HouseholdBasic(BaseModel):
    """Basic household info for reptile listings"""
    id: int
    name: str

    class Config:
        from_attributes = True


class ReptileWithHousehold(Reptile):
    """Reptile with household information"""
    household: Optional[HouseholdBasic] = None

    class Config:
        from_attributes = True


# Food schemas
class FoodBase(BaseModel):
    name: str
    category: FoodCategory
    insect_size: Optional[InsectSize] = None
    animal_size: Optional[AnimalSize] = None
    nutritional_data: Optional[dict] = None


class FoodCreate(FoodBase):
    pass


class FoodUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[FoodCategory] = None
    insect_size: Optional[InsectSize] = None
    animal_size: Optional[AnimalSize] = None
    nutritional_data: Optional[dict] = None
    is_favorite: Optional[bool] = None


class Food(FoodBase):
    id: int
    is_default: bool
    is_favorite: bool
    created_at: datetime

    class Config:
        from_attributes = True


class FoodWithReptileFavorite(Food):
    """Food schema with reptile-specific favorite status"""
    is_reptile_favorite: bool = False


# Supplement schemas
class SupplementBase(BaseModel):
    name: str
    nutritional_data: Optional[dict] = None


class SupplementCreate(SupplementBase):
    pass


class Supplement(SupplementBase):
    id: int
    is_default: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Feeding schemas
class FeedingFoodItem(BaseModel):
    food_id: int
    quantity: int = 1
    supplement_ids: List[int] = []  # Per-item supplements


class FeedingCreate(BaseModel):
    reptile_id: int
    fed_at: Optional[datetime] = None
    foods: List[FeedingFoodItem]
    supplements: List[int] = []  # Global supplements (applied to whole feeding)
    is_salad: bool = False
    salad_components: List[int] = []  # List of food IDs for salad
    notes: Optional[str] = None


class FoodWithQuantity(BaseModel):
    """Food item with quantity from association table"""
    id: int
    name: str
    category: FoodCategory
    insect_size: Optional[InsectSize] = None
    nutritional_data: Optional[dict] = None
    is_default: bool
    is_favorite: bool
    created_at: datetime
    quantity: int  # From feeding_foods association table
    supplements: List[Supplement] = []  # Per-item supplements

    class Config:
        from_attributes = True


class Feeding(BaseModel):
    id: int
    reptile_id: int
    user_id: Optional[int]
    fed_at: datetime
    notes: Optional[str]
    is_salad: bool
    foods: List[FoodWithQuantity]
    supplements: List[Supplement]
    salad_components: List[Food]
    schedule_completion_id: Optional[int] = None
    created_at: datetime

    @field_serializer('fed_at', 'created_at')
    def serialize_datetime(self, dt: datetime, _info):
        """Ensure datetimes are serialized with timezone info (UTC 'Z' suffix)"""
        if dt.tzinfo is not None:
            # Convert to UTC and use 'Z' suffix
            return dt.isoformat().replace('+00:00', 'Z')
        # If naive datetime, treat as UTC
        return dt.isoformat() + 'Z'

    class Config:
        from_attributes = True


class FeedingWithUser(Feeding):
    user: Optional[User] = None
    reptile: Optional["Reptile"] = None
    schedule_completion: Optional["ScheduleCompletion"] = None


# Weight log schemas
class WeightLogBase(BaseModel):
    weight_grams: float
    measured_at: Optional[datetime] = None
    notes: Optional[str] = None


class WeightLogCreate(WeightLogBase):
    reptile_id: int


class WeightLogUpdate(BaseModel):
    weight_grams: Optional[float] = None
    measured_at: Optional[datetime] = None
    notes: Optional[str] = None


class WeightLog(WeightLogBase):
    id: int
    reptile_id: int
    measured_at: datetime
    schedule_completion_id: Optional[int] = None
    logged_by_user_id: Optional[int] = None
    logged_by: Optional[UserSimple] = None

    class Config:
        from_attributes = True


class WeightLogWithReptile(WeightLog):
    """Weight log with reptile name for dashboard display"""
    reptile_name: Optional[str] = None
    schedule_completion: Optional["ScheduleCompletion"] = None


# Health record schemas
class HealthRecordBase(BaseModel):
    record_type: str  # "vet_visit", "medication", "observation", "shedding", "bowel_movement"
    title: str
    description: Optional[str] = None
    consistency: Optional[str] = None  # For bowel movements: "normal", "soft", "hard", "watery", "mucus"
    photo_url: Optional[str] = None  # For bowel movement photos
    date: datetime


class HealthRecordCreate(HealthRecordBase):
    reptile_id: int


class HealthRecordUpdate(BaseModel):
    record_type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    consistency: Optional[str] = None
    photo_url: Optional[str] = None
    date: Optional[datetime] = None


class HealthRecord(HealthRecordBase):
    id: int
    reptile_id: int
    created_at: datetime
    logged_by_user_id: Optional[int] = None
    logged_by: Optional[UserSimple] = None

    class Config:
        from_attributes = True


# Misting log schemas
class MistingLogBase(BaseModel):
    misted_at: datetime
    notes: Optional[str] = None


class MistingLogCreate(MistingLogBase):
    reptile_id: int


class MistingLogUpdate(BaseModel):
    misted_at: Optional[datetime] = None
    notes: Optional[str] = None


class MistingLog(MistingLogBase):
    id: int
    reptile_id: int
    created_at: datetime
    schedule_completion_id: Optional[int] = None
    reptile: Optional["Reptile"] = None
    logged_by_user_id: Optional[int] = None
    logged_by: Optional[UserSimple] = None
    schedule_completion: Optional["ScheduleCompletion"] = None

    class Config:
        from_attributes = True


# Photo schemas
class PhotoBase(BaseModel):
    """Base photo schema."""
    category: str  # 'health', 'weight', 'feeding', 'enclosure', 'general'
    caption: Optional[str] = None
    taken_at: Optional[datetime] = None
    tags: Optional[List[str]] = None


class PhotoCreate(PhotoBase):
    """Schema for creating a photo (used with multipart form data)."""
    reptile_id: int
    # Optional log associations
    health_record_id: Optional[int] = None
    feeding_log_id: Optional[int] = None
    weight_log_id: Optional[int] = None
    misting_log_id: Optional[int] = None


class PhotoUpdate(BaseModel):
    """Schema for updating photo metadata."""
    caption: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    taken_at: Optional[datetime] = None


class Photo(PhotoBase):
    """Full photo schema with all fields."""
    id: UUID  # UUID type
    household_id: int
    reptile_id: int
    uploaded_by_user_id: Optional[int] = None
    file_path: str
    thumbnail_path: Optional[str] = None
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    uploaded_at: datetime

    # Log associations
    health_record_id: Optional[int] = None
    feeding_log_id: Optional[int] = None
    weight_log_id: Optional[int] = None
    misting_log_id: Optional[int] = None

    # Relationships (optional, for expanded responses)
    uploaded_by: Optional[UserSimple] = None

    @field_serializer('id')
    def serialize_id(self, value: UUID) -> str:
        """Serialize UUID to string for JSON responses."""
        return str(value)

    class Config:
        from_attributes = True


class PhotoWithUrls(Photo):
    """Photo schema with serving URLs."""
    file_url: str  # Full-size photo URL
    thumbnail_url: str  # Thumbnail URL


class PhotoUploadResponse(BaseModel):
    """Response after uploading photos."""
    photos: List[Photo]
    count: int


# Schedule schemas
class ScheduleBase(BaseModel):
    name: Optional[str] = None  # User-friendly name
    schedule_type: str  # "feeding", "misting", "weighing", "supplement"
    schedule_mode: str = "fixed"  # "fixed", "interval", or "dependent"
    schedule_rule: Optional[str] = None  # "every_x_days", "days_of_week", "monthly", "dependent" (not used for interval mode)
    food_category: Optional[str] = None  # For feeding: "insects", "salad", "mixed"
    time_slot: Optional[str] = None  # For misting: "morning", "midday", "afternoon", "evening", "night"
    health_category: Optional[str] = None  # For weighing/health: "weight_check", "bathing", "shedding_check"
    frequency_days: Optional[int] = None  # For every_x_days
    days_of_week: Optional[str] = None  # For days_of_week (comma-separated: '1,3,5')
    day_of_month: Optional[int] = None  # For monthly (1-31)
    parent_schedule_id: Optional[int] = None  # For dependent schedules
    dependent_rule: Optional[str] = None  # "every_occurrence", "every_nth", "specific_days", "once_per_day"
    dependent_frequency: Optional[int] = None  # For every_nth
    dependent_days: Optional[str] = None  # For specific_days

    # For interval-based schedules (time-based intervals with min/max days constraints)
    quota_period: Optional[str] = None  # "week" or "month" - for grouping display data only (no enforcement)
    min_days_between: Optional[int] = None  # Minimum days between events (HARD constraint - e.g., 2 days)
    max_days_between: Optional[int] = None  # Maximum days between events (HARD constraint - e.g., 4 days)
    suggested_days: Optional[List[int]] = None  # Optional suggested days array (e.g., [1, 4] for Mon, Thu)

    supplement_id: Optional[int] = None  # For supplement schedules

    # Time window settings
    earliest_time: Optional[time] = None  # Start of valid window (e.g., 10:00 AM - after basking)
    latest_time: Optional[time] = None  # End of valid window (e.g., 8:00 PM - before lights off)
    time_window_enabled: bool = False
    reminder_minutes_before: Optional[int] = None  # Legacy: minutes before latest_time (deprecated, use reminder_time)
    reminder_time: Optional[time] = None  # Absolute reminder time (must be within time window, takes precedence over reminder_minutes_before)

    # Notification settings
    notifications_enabled: bool = True  # Per-schedule notification toggle

    # Auto-complete settings
    auto_complete_enabled: bool = False  # Auto-complete after time window + delay
    auto_complete_hours_after: int = 2  # Hours after time window (or end of day if no window)

    # Flexible completion window settings
    flexible_completion_enabled: bool = False  # Allow completing instances within ±N days
    flexible_completion_days: int = 2  # Number of days before/after scheduled date (default: ±2 days)

    enabled: bool = True
    notes: Optional[str] = None


class ScheduleCreate(ScheduleBase):
    reptile_id: int
    channel_ids: Optional[List[int]] = []  # List of notification channel IDs to use


class ScheduleUpdate(BaseModel):
    reptile_id: Optional[int] = None
    name: Optional[str] = None
    schedule_type: Optional[str] = None
    schedule_mode: Optional[str] = None
    schedule_rule: Optional[str] = None
    food_category: Optional[str] = None
    time_slot: Optional[str] = None
    health_category: Optional[str] = None
    frequency_days: Optional[int] = None
    days_of_week: Optional[str] = None
    day_of_month: Optional[int] = None
    parent_schedule_id: Optional[int] = None
    dependent_rule: Optional[str] = None
    dependent_frequency: Optional[int] = None
    dependent_days: Optional[str] = None

    # For interval-based schedules (time-based intervals with min/max days constraints)
    quota_period: Optional[str] = None  # "week" or "month" - for grouping display data only
    min_days_between: Optional[int] = None  # Minimum days between events (HARD constraint)
    max_days_between: Optional[int] = None  # Maximum days between events (HARD constraint)
    suggested_days: Optional[List[int]] = None  # Optional suggested days array

    supplement_id: Optional[int] = None

    # Time window settings
    earliest_time: Optional[time] = None
    latest_time: Optional[time] = None
    time_window_enabled: Optional[bool] = None
    reminder_minutes_before: Optional[int] = None  # Legacy: minutes before latest_time (deprecated, use reminder_time)
    reminder_time: Optional[time] = None  # Absolute reminder time (must be within time window, takes precedence over reminder_minutes_before)

    # Notification settings
    notifications_enabled: Optional[bool] = None
    channel_ids: Optional[List[int]] = None  # List of notification channel IDs to use

    # Auto-complete settings
    auto_complete_enabled: Optional[bool] = None
    auto_complete_hours_after: Optional[int] = None

    # Flexible completion window settings
    flexible_completion_enabled: Optional[bool] = None
    flexible_completion_days: Optional[int] = None

    enabled: Optional[bool] = None
    notes: Optional[str] = None


class Schedule(ScheduleBase):
    id: int
    reptile_id: int
    created_at: datetime
    updated_at: datetime
    notification_channels: List['NotificationChannel'] = []  # Selected channels for this schedule

    class Config:
        from_attributes = True


class ScheduleWithDetails(Schedule):
    """Schedule with supplement and parent schedule details"""
    supplement: Optional[Supplement] = None
    parent_schedule: Optional[Schedule] = None
    child_schedules: List[Schedule] = []


# Schedule Completion schemas
class ScheduleCompletionBase(BaseModel):
    schedule_id: int
    scheduled_date: date
    completion_type: Optional[CompletionType] = None
    completion_id: Optional[int] = None
    within_time_window: Optional[bool] = None
    status: CompletionStatus
    auto_completed: bool = False  # True if auto-completed by system


class ScheduleCompletionCreate(ScheduleCompletionBase):
    reptile_id: int
    completed_at: Optional[datetime] = None


class ScheduleCompletionUpdate(BaseModel):
    completed_at: Optional[datetime] = None
    completion_type: Optional[CompletionType] = None
    completion_id: Optional[int] = None
    within_time_window: Optional[bool] = None
    status: Optional[CompletionStatus] = None
    auto_completed: Optional[bool] = None


class ScheduleCompletion(ScheduleCompletionBase):
    id: int
    reptile_id: int
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Quota Tracking schemas (for requirement-based schedules - weekly or monthly)
class QuotaTrackingBase(BaseModel):
    schedule_id: int
    reptile_id: int
    period_start_date: date  # Start of the period (Monday for week, 1st for month)
    period_type: str  # "week" or "month"
    count: int = 0  # Number of completions this period
    last_completion_date: Optional[date] = None


class QuotaTrackingCreate(QuotaTrackingBase):
    pass


class QuotaTrackingUpdate(BaseModel):
    count: Optional[int] = None
    last_completion_date: Optional[date] = None


class QuotaTracking(QuotaTrackingBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Schedule Instance schemas
class ScheduleInstanceBase(BaseModel):
    schedule_id: int
    scheduled_date: date
    status: str = "pending"  # pending, completed, missed, skipped
    feeding_sequence_number: Optional[int] = None
    supplements: Optional[List[Dict]] = None


class ScheduleInstanceCreate(ScheduleInstanceBase):
    pass


class ScheduleInstanceUpdate(BaseModel):
    status: Optional[str] = None
    feeding_sequence_number: Optional[int] = None
    supplements: Optional[List[Dict]] = None


class ScheduleInstance(ScheduleInstanceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScheduleWithReptile(Schedule):
    """Schedule with reptile details for calendar display"""
    reptile: Optional["Reptile"] = None

    class Config:
        from_attributes = True


class ScheduleInstanceWithSchedule(ScheduleInstance):
    """Schedule instance with full schedule and reptile details"""
    schedule: "ScheduleWithReptile"
    completions: List["ScheduleCompletion"] = []

    class Config:
        from_attributes = True


# Access control schemas
class GrantAccess(BaseModel):
    user_email: EmailStr
    access_level: AccessLevel


# Notification settings schemas
class NotificationSettingsBase(BaseModel):
    webhook_enabled: bool = False
    webhook_url: Optional[str] = None
    webhook_type: str = "discord"


class NotificationSettingsCreate(NotificationSettingsBase):
    pass


class NotificationSettings(NotificationSettingsBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Statistics and reports schemas
class DailySummary(BaseModel):
    date: str
    total_feedings: int
    reptiles_fed: int
    total_reptiles: int


class WeeklySummary(BaseModel):
    week_start: str
    week_end: str
    total_feedings: int
    feedings_by_reptile: dict[str, int]
    average_daily_feedings: float


class ReptileStats(BaseModel):
    reptile_id: int
    reptile_name: str
    total_feedings: int
    last_feeding: Optional[datetime]
    weight_trend: List[WeightLog]
    nutritional_summary: dict


# Household schemas
class HouseholdCreate(BaseModel):
    name: str


class HouseholdOut(BaseModel):
    id: int
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


class MemberRoleUpdate(BaseModel):
    access_level: str  # "owner", "admin", "manager", "caretaker", or "viewer"


# Invitation schemas
class InvitationCreate(BaseModel):
    household_id: int
    code: Optional[str] = None
    expires_at: Optional[datetime] = None
    max_uses: Optional[int] = None


class InvitationOut(BaseModel):
    id: int
    code: str
    household_id: int
    created_by: Optional[int]
    expires_at: Optional[datetime]
    max_uses: Optional[int]
    used_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class InvitationAccept(BaseModel):
    code: str


# Feeding Rotation schemas
class FeedingRotationBase(BaseModel):
    rotation_type: str  # "supplement" or "food_replacement"
    supplement_id: Optional[int] = None
    replacement_food_category: Optional[str] = None
    replacement_note: Optional[str] = None

    # Trigger mode
    trigger_mode: str = "feeding_count"  # "feeding_count" or "schedule_based"

    # For feeding_count mode
    every_n_feedings: Optional[int] = None
    counting_mode: Optional[str] = "category_only"  # "category_only" or "all_feedings"

    # For schedule_based mode
    schedule_days_of_week: Optional[str] = None  # "0,1,3" for Sun, Mon, Wed
    schedule_frequency_days: Optional[int] = None

    applies_to_category: Optional[str] = None  # "insects", "salad", "mixed", "all", null
    application_mode: str = "any_feeding"  # "any_feeding" or "specific_occurrence"
    priority: int = 10
    is_exclusive: bool = False  # If True, only highest priority supplement applies
    enabled: bool = True
    notes: Optional[str] = None


class FeedingRotationCreate(FeedingRotationBase):
    reptile_id: int


class FeedingRotationUpdate(BaseModel):
    rotation_type: Optional[str] = None
    supplement_id: Optional[int] = None
    replacement_food_category: Optional[str] = None
    replacement_note: Optional[str] = None
    trigger_mode: Optional[str] = None
    every_n_feedings: Optional[int] = None
    counting_mode: Optional[str] = None
    schedule_days_of_week: Optional[str] = None
    schedule_frequency_days: Optional[int] = None
    applies_to_category: Optional[str] = None
    application_mode: Optional[str] = None
    priority: Optional[int] = None
    is_exclusive: Optional[bool] = None
    enabled: Optional[bool] = None
    notes: Optional[str] = None


class FeedingRotation(FeedingRotationBase):
    id: int
    reptile_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FeedingRotationWithDetails(FeedingRotation):
    """Feeding rotation with supplement details"""
    supplement: Optional[Supplement] = None


# Supplement Rotation Template schemas
class SupplementRotationTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    species: Optional[str] = None
    age_category: Optional[str] = None
    uvb_lighting: Optional[bool] = None
    supplement_id: int
    trigger_mode: str = "feeding_count"
    every_n_feedings: Optional[int] = None
    counting_mode: Optional[str] = "all_feedings"
    schedule_days_of_week: Optional[str] = None
    schedule_frequency_days: Optional[int] = None
    applies_to_category: Optional[str] = None
    application_mode: str = "any_feeding"
    priority: int = 10
    is_exclusive: bool = True
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    notes: Optional[str] = None


class SupplementRotationTemplateCreate(SupplementRotationTemplateBase):
    pass


class SupplementRotationTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    species: Optional[str] = None
    age_category: Optional[str] = None
    uvb_lighting: Optional[bool] = None
    supplement_id: Optional[int] = None
    trigger_mode: Optional[str] = None
    every_n_feedings: Optional[int] = None
    counting_mode: Optional[str] = None
    schedule_days_of_week: Optional[str] = None
    schedule_frequency_days: Optional[int] = None
    applies_to_category: Optional[str] = None
    application_mode: Optional[str] = None
    priority: Optional[int] = None
    is_exclusive: Optional[bool] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    notes: Optional[str] = None


class SupplementRotationTemplate(SupplementRotationTemplateBase):
    id: int
    is_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SupplementRotationTemplateWithDetails(SupplementRotationTemplate):
    """Supplement rotation template with supplement details"""
    supplement: Optional[Supplement] = None


# Schedule Template schemas
class ScheduleTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    species: Optional[str] = None  # null = applies to all species
    age_category: Optional[str] = None  # "hatchling", "juvenile", "adult", "senior", null = all ages
    uvb_lighting: Optional[bool] = None  # null = doesn't matter, True = requires UVB, False = no UVB needed

    # Schedule configuration
    schedule_type: str  # "feeding", "misting", "weighing", "supplement"
    schedule_rule: str  # "every_x_days", "days_of_week", "monthly"
    food_category: Optional[str] = None
    time_slot: Optional[str] = None
    health_category: Optional[str] = None

    # Rule parameters
    frequency_days: Optional[int] = None
    days_of_week: Optional[str] = None
    day_of_month: Optional[int] = None

    # Time window settings
    earliest_time: Optional[time] = None
    latest_time: Optional[time] = None
    time_window_enabled: bool = False
    reminder_minutes_before: Optional[int] = None  # Legacy: minutes before latest_time (deprecated, use reminder_time)
    reminder_time: Optional[time] = None  # Absolute reminder time (must be within time window, takes precedence over reminder_minutes_before)

    # Supplement reference (optional)
    supplement_id: Optional[int] = None

    # Source attribution
    source_name: Optional[str] = None  # e.g., "ReptiFiles", "The Bio Dude"
    source_url: Optional[str] = None  # Link to original care guide

    notes: Optional[str] = None


class ScheduleTemplateCreate(ScheduleTemplateBase):
    pass


class ScheduleTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    species: Optional[str] = None
    age_category: Optional[str] = None
    schedule_type: Optional[str] = None
    schedule_rule: Optional[str] = None
    food_category: Optional[str] = None
    time_slot: Optional[str] = None
    health_category: Optional[str] = None
    frequency_days: Optional[int] = None
    days_of_week: Optional[str] = None
    day_of_month: Optional[int] = None
    earliest_time: Optional[time] = None
    latest_time: Optional[time] = None
    time_window_enabled: Optional[bool] = None
    reminder_minutes_before: Optional[int] = None  # Legacy: minutes before latest_time (deprecated, use reminder_time)
    reminder_time: Optional[time] = None  # Absolute reminder time (must be within time window, takes precedence over reminder_minutes_before)
    supplement_id: Optional[int] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    notes: Optional[str] = None


class ScheduleTemplate(ScheduleTemplateBase):
    id: int
    is_default: bool
    created_by_user_id: Optional[int] = None
    source_template_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScheduleTemplateWithDetails(ScheduleTemplate):
    """Schedule template with supplement details"""
    supplement: Optional[Supplement] = None


# Care Guideline schemas
class CareGuidelineBase(BaseModel):
    species: str
    age_category: Optional[str] = None  # "hatchling", "juvenile", "adult", "senior", null = general
    guideline_type: str  # "feeding", "supplements", "environment", "handling", "general"
    title: str
    content: str
    recommendations: Optional[dict] = None  # Structured data for automated suggestions
    source_name: Optional[str] = None
    source_url: Optional[str] = None


class CareGuidelineCreate(CareGuidelineBase):
    pass


class CareGuidelineUpdate(BaseModel):
    species: Optional[str] = None
    age_category: Optional[str] = None
    guideline_type: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    recommendations: Optional[dict] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None


class CareGuideline(CareGuidelineBase):
    id: int
    is_default: bool
    created_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Import/Export schemas
class ScheduleTemplateExport(BaseModel):
    """Export format for schedule templates"""
    version: str = "1.0"
    exported_at: datetime
    templates: List[ScheduleTemplate]


class CareGuidelineExport(BaseModel):
    """Export format for care guidelines"""
    version: str = "1.0"
    exported_at: datetime
    guidelines: List[CareGuideline]


# Notification Settings schemas
class NotificationSettingsBase(BaseModel):
    webhook_enabled: bool = False
    webhook_url: Optional[str] = None
    webhook_type: str = "discord"  # discord, pushover, generic
    notify_schedule_reminders: bool = True
    notify_overdue_alerts: bool = True
    quiet_hours_enabled: bool = False
    quiet_hours_start: Optional[time] = None
    quiet_hours_end: Optional[time] = None


class NotificationSettingsUpdate(BaseModel):
    webhook_enabled: Optional[bool] = None
    webhook_url: Optional[str] = None
    webhook_type: Optional[str] = None
    notify_schedule_reminders: Optional[bool] = None
    notify_overdue_alerts: Optional[bool] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[time] = None
    quiet_hours_end: Optional[time] = None


class NotificationSettingsSchema(NotificationSettingsBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Notification Channel schemas
class NotificationChannelBase(BaseModel):
    name: str
    webhook_type: str  # discord, pushover, generic, in_app
    webhook_url: Optional[str] = None  # For discord/generic
    config: Optional[dict] = None  # For pushover: {api_key, user_key, devices, priority, retry, expire, sound}
    enabled: bool = True
    household_wide: bool = False  # If true, available to all household members
    is_system: Optional[bool] = False  # If true, channel cannot be deleted (optional for backward compatibility)


class NotificationChannelCreate(BaseModel):
    name: str
    webhook_type: str  # discord, pushover, generic (not in_app - system channels are auto-created)
    webhook_url: Optional[str] = None
    config: Optional[dict] = None
    enabled: bool = True
    household_wide: bool = False


class NotificationChannelUpdate(BaseModel):
    name: Optional[str] = None
    webhook_type: Optional[str] = None
    webhook_url: Optional[str] = None
    config: Optional[dict] = None
    enabled: Optional[bool] = None
    household_wide: Optional[bool] = None


class NotificationChannel(NotificationChannelBase):
    id: int
    notification_settings_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Template Group schemas
class TemplateGroupBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    color: Optional[str] = Field(None, max_length=20)  # e.g., "blue", "green", "#FF5733"
    icon: Optional[str] = Field(None, max_length=50)  # emoji or icon identifier
    sort_order: int = 0

    # Group-level settings
    enabled: bool = True  # Master on/off switch
    default_priority: int = 0  # Priority modifier for all templates in group
    ignore_quiet_hours: bool = False  # Bypass quiet hours settings
    default_channel_ids: Optional[List[int]] = None  # Default channel IDs for templates


class TemplateGroupCreate(TemplateGroupBase):
    pass


class TemplateGroupUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    color: Optional[str] = Field(None, max_length=20)
    icon: Optional[str] = Field(None, max_length=50)
    sort_order: Optional[int] = None

    # Group-level settings
    enabled: Optional[bool] = None
    default_priority: Optional[int] = None
    ignore_quiet_hours: Optional[bool] = None
    default_channel_ids: Optional[List[int]] = None


class TemplateGroup(TemplateGroupBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Notification Template schemas
class NotificationTemplateBase(BaseModel):
    name: str
    trigger_type: str  # schedule_reminder, overdue_alert, feeding_logged, custom
    message_template: str
    title_template: Optional[str] = None
    channel_type: Optional[str] = None  # discord, pushover, generic, or null for all
    discord_config: Optional[dict] = None  # Discord-specific embed configuration
    is_active: bool = True

    # Matching criteria (all optional - None means applies to all)
    reptile_id: Optional[int] = None
    schedule_id: Optional[int] = None
    schedule_type_filter: Optional[str] = None  # 'feeding', 'misting', 'weighing', 'health'
    food_category_filter: Optional[str] = None  # 'insects', 'salad', 'prepared', 'supplements'

    # Priority for resolution (lower = higher priority)
    priority: int = 100

    # Optional description of when this template applies
    applies_to_description: Optional[str] = None

    # Optional grouping for organization
    group_id: Optional[int] = None


class NotificationTemplateCreate(NotificationTemplateBase):
    template_type: str = "custom"  # system templates can only be created via migration


class NotificationTemplateUpdate(BaseModel):
    name: Optional[str] = None
    message_template: Optional[str] = None
    title_template: Optional[str] = None
    channel_type: Optional[str] = None
    discord_config: Optional[dict] = None
    is_active: Optional[bool] = None

    # Matching criteria (all optional)
    reptile_id: Optional[int] = None
    schedule_id: Optional[int] = None
    schedule_type_filter: Optional[str] = None
    food_category_filter: Optional[str] = None
    priority: Optional[int] = None
    applies_to_description: Optional[str] = None

    # Optional grouping for organization
    group_id: Optional[int] = None


class NotificationTemplate(NotificationTemplateBase):
    id: int
    user_id: Optional[int] = None
    template_type: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# User Notification schemas (in-app notifications)
class UserNotificationBase(BaseModel):
    notification_type: str
    title: str
    message: str
    link: Optional[str] = None
    notification_metadata: Optional[dict] = None


class UserNotificationCreate(UserNotificationBase):
    user_id: int


class UserNotification(UserNotificationBase):
    id: int
    user_id: int
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Measurement schemas
class MeasurementBase(BaseModel):
    measurement_type: str  # e.g., 'weight', 'svl', 'total_length', 'shell_length', 'custom'
    value: float
    unit: str  # e.g., 'g', 'kg', 'cm', 'mm', 'in'
    measured_at: datetime
    notes: Optional[str] = None
    custom_label: Optional[str] = None  # Used when measurement_type is 'custom'


class MeasurementCreate(MeasurementBase):
    reptile_id: int
    schedule_completion_id: Optional[int] = None


class MeasurementUpdate(BaseModel):
    measurement_type: Optional[str] = None
    value: Optional[float] = None
    unit: Optional[str] = None
    measured_at: Optional[datetime] = None
    notes: Optional[str] = None
    custom_label: Optional[str] = None


class Measurement(MeasurementBase):
    id: int
    reptile_id: int
    schedule_completion_id: Optional[int] = None
    logged_by_user_id: Optional[int] = None
    logged_by: Optional[UserSimple] = None

    class Config:
        from_attributes = True
