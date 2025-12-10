from datetime import datetime, timezone, time as py_time, date as py_date
from enum import Enum as PyEnum
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Date,
    Time,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Table,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class AccessLevel(str, PyEnum):
    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    CARETAKER = "caretaker"
    VIEWER = "viewer"


class FoodCategory(str, PyEnum):
    INSECT = "insect"
    WORMS = "worms"
    VEGETABLE = "vegetable"
    FRUIT = "fruit"
    PREPARED = "prepared"
    FROZEN_ANIMAL = "frozen_animal"
    LIVE_RODENT = "live_rodent"
    FISH_SEAFOOD = "fish_seafood"
    EGGS = "eggs"
    OTHER = "other"


class InsectSize(str, PyEnum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"


class AnimalSize(str, PyEnum):
    """Size categories for frozen prey animals (rodents, etc.)"""
    PINKY = "pinky"  # Newborn mouse/rat
    FUZZY = "fuzzy"  # Young with fur starting
    HOPPER = "hopper"  # Young, mobile
    WEANER = "weaner"  # Juvenile, weaned
    ADULT_SMALL = "adult_small"  # Small adult mouse
    ADULT_MEDIUM = "adult_medium"  # Medium adult mouse or small rat
    ADULT_LARGE = "adult_large"  # Large mouse or medium rat
    JUMBO = "jumbo"  # Large rat or rabbit


class CompletionStatus(str, PyEnum):
    """Status of a schedule completion"""
    COMPLETED_ON_TIME = "completed_on_time"  # Completed within time window
    COMPLETED_EARLY = "completed_early"  # Completed before earliest_time
    COMPLETED_LATE = "completed_late"  # Completed after latest_time
    MISSED = "missed"  # Not completed at all
    PENDING = "pending"  # Future/current, not yet completed


class CompletionType(str, PyEnum):
    """Type of activity that completed a schedule"""
    FEEDING = "feeding"
    MISTING = "misting"
    WEIGHING = "weighing"
    MANUAL = "manual"  # Manually marked as complete


class NotificationType(str, PyEnum):
    """Type of in-app notification"""
    SCHEDULE_REMINDER = "schedule_reminder"
    OVERDUE_ALERT = "overdue_alert"
    FEEDING_LOGGED = "feeding_logged"
    WEIGHT_LOGGED = "weight_logged"
    HEALTH_EVENT = "health_event"
    SYSTEM = "system"


class ScheduleMode(str, PyEnum):
    """Mode of schedule operation"""
    FIXED = "fixed"  # Fixed dates/days (calendar-based schedules)
    INTERVAL = "interval"  # Time-based intervals with min/max days between events
    DEPENDENT = "dependent"  # Triggered by another schedule's completion
    REQUIREMENT = "requirement"  # DEPRECATED: Use INTERVAL instead (kept for migration compatibility)


class QuotaPeriod(str, PyEnum):
    """Period for interval schedule tracking (informational only, no enforcement)"""
    WEEK = "week"  # Group by week for display
    MONTH = "month"  # Group by month for display


# Association table for reptile access
reptile_access = Table(
    "reptile_access",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("reptile_id", Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), primary_key=True),
    Column("access_level", Enum(AccessLevel, values_callable=lambda x: [e.value for e in x]), nullable=False),
    Column("granted_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)),
)


# Association table for feeding foods (many-to-many)
feeding_foods = Table(
    "feeding_foods",
    Base.metadata,
    Column("feeding_id", Integer, ForeignKey("feedings.id", ondelete="CASCADE"), primary_key=True),
    Column("food_id", Integer, ForeignKey("foods.id", ondelete="CASCADE"), primary_key=True),
    Column("quantity", Integer, nullable=False),
)


# Association table for feeding supplements (many-to-many)
feeding_supplements = Table(
    "feeding_supplements",
    Base.metadata,
    Column("feeding_id", Integer, ForeignKey("feedings.id", ondelete="CASCADE"), primary_key=True),
    Column("supplement_id", Integer, ForeignKey("supplements.id", ondelete="CASCADE"), primary_key=True),
)


# Association table for salad components
feeding_salad_components = Table(
    "feeding_salad_components",
    Base.metadata,
    Column("feeding_id", Integer, ForeignKey("feedings.id", ondelete="CASCADE"), primary_key=True),
    Column("food_id", Integer, ForeignKey("foods.id", ondelete="CASCADE"), primary_key=True),
)


# Association table for per-item supplements (supplements applied to specific food items)
feeding_food_supplements = Table(
    "feeding_food_supplements",
    Base.metadata,
    Column("feeding_id", Integer, ForeignKey("feedings.id", ondelete="CASCADE"), primary_key=True),
    Column("food_id", Integer, ForeignKey("foods.id", ondelete="CASCADE"), primary_key=True),
    Column("supplement_id", Integer, ForeignKey("supplements.id", ondelete="CASCADE"), primary_key=True),
)


# Association table for reptile food favorites
reptile_food_favorites = Table(
    "reptile_food_favorites",
    Base.metadata,
    Column("reptile_id", Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), primary_key=True),
    Column("food_id", Integer, ForeignKey("foods.id", ondelete="CASCADE"), primary_key=True),
    Column("added_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)),
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    oidc_sub = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    timezone = Column(String(100), nullable=False, default="UTC")  # User's timezone (e.g., "Europe/Oslo")
    show_favorites_first = Column(Boolean, default=True)  # Show favorite foods first when logging feedings
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_login = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    reptiles = relationship("Reptile", secondary=reptile_access, back_populates="users")
    feedings = relationship("Feeding", back_populates="user")


class Reptile(Base):
    __tablename__ = "reptiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    species = Column(String, nullable=False)
    date_of_birth = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    photo_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Feeding schedule settings
    feeding_schedule_enabled = Column(Boolean, default=False)
    feeding_frequency_days = Column(Integer, nullable=True)  # Feed every X days
    reminder_enabled = Column(Boolean, default=False)
    reminder_hours_before = Column(Integer, default=2)

    # Active/inactive status (for hiding reptiles without deleting them)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    # UVB lighting setup (for schedule recommendations)
    has_uvb = Column(Boolean, nullable=True)  # null = not specified, True = has UVB, False = no UVB

    # Length tracking (for species that determine age category by size)
    length = Column(Integer, nullable=True)  # Length in centimeters

    # Age category (can be set automatically or manually)
    age_category = Column(String, nullable=True)  # hatchling, juvenile, adult, gravid

    # Household relation
    household_id = Column(Integer, ForeignKey("households.id", ondelete="SET NULL"), nullable=True)

    # Default foods for auto-selection when logging feedings
    default_insect_id = Column(Integer, ForeignKey("foods.id", ondelete="SET NULL"), nullable=True)
    default_prepared_id = Column(Integer, ForeignKey("foods.id", ondelete="SET NULL"), nullable=True)

    # Avatar photo (profile picture)
    avatar_photo_id = Column(UUID(as_uuid=True), ForeignKey("photos.id", ondelete="SET NULL"), nullable=True)

    # Avatar crop coordinates (for custom avatar cropping)
    avatar_crop_x = Column(Integer, nullable=True)
    avatar_crop_y = Column(Integer, nullable=True)
    avatar_crop_width = Column(Integer, nullable=True)
    avatar_crop_height = Column(Integer, nullable=True)
    avatar_crop_zoom = Column(Float, nullable=True)  # Zoom level (1.0 to 3.0)

    # Avatar image position (for re-initializing the cropper UI)
    # These are percentage-based coordinates representing where the image is positioned
    avatar_image_pos_x = Column(Float, nullable=True)
    avatar_image_pos_y = Column(Float, nullable=True)

    # Avatar border color (hex color code)
    avatar_border_color = Column(String(7), nullable=True)  # e.g., "#FF5733"

    # Relationships
    users = relationship("User", secondary=reptile_access, back_populates="reptiles")
    feedings = relationship("Feeding", back_populates="reptile", cascade="all, delete-orphan")
    weight_logs = relationship("WeightLog", back_populates="reptile", cascade="all, delete-orphan")
    measurements = relationship("Measurement", back_populates="reptile", cascade="all, delete-orphan")
    health_records = relationship("HealthRecord", back_populates="reptile", cascade="all, delete-orphan")
    misting_logs = relationship("MistingLog", back_populates="reptile", cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="reptile", cascade="all, delete-orphan")
    photos = relationship("Photo", back_populates="reptile", cascade="all, delete-orphan", primaryjoin="Reptile.id==Photo.reptile_id")
    avatar_photo = relationship("Photo", foreign_keys=[avatar_photo_id], post_update=True)
    favorite_foods = relationship("Food", secondary=reptile_food_favorites)
    default_insect_food = relationship("Food", foreign_keys=[default_insect_id])
    default_prepared_food = relationship("Food", foreign_keys=[default_prepared_id])


class Food(Base):
    __tablename__ = "foods"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)
    category = Column(Enum(FoodCategory), nullable=False)
    insect_size = Column(Enum(InsectSize), nullable=True)  # Only for insects
    animal_size = Column(Enum(AnimalSize), nullable=True)  # Only for frozen animals

    # Nutritional data per 100g (or per item for insects)
    nutritional_data = Column(JSON, nullable=True)  # {protein, fat, calcium, phosphorus, vitamins, etc.}

    is_default = Column(Boolean, default=False)  # System-provided vs user-added
    is_favorite = Column(Boolean, default=False)  # User's favorite foods for quick access
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Supplement(Base):
    __tablename__ = "supplements"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)

    # Nutritional composition
    nutritional_data = Column(JSON, nullable=True)  # {calcium, vitamin_d3, vitamin_a, etc.}

    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Feeding(Base):
    __tablename__ = "feedings"

    id = Column(Integer, primary_key=True, index=True)
    reptile_id = Column(Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    fed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    notes = Column(Text, nullable=True)

    # Is this a salad feeding (multiple components)?
    is_salad = Column(Boolean, default=False)

    # Link to schedule completion (if this feeding fulfilled a schedule)
    schedule_completion_id = Column(Integer, ForeignKey("schedule_completions.id", ondelete="SET NULL"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    reptile = relationship("Reptile", back_populates="feedings")
    user = relationship("User", back_populates="feedings")
    foods = relationship("Food", secondary=feeding_foods)
    supplements = relationship("Supplement", secondary=feeding_supplements)
    salad_components = relationship("Food", secondary=feeding_salad_components)
    schedule_completion = relationship("ScheduleCompletion", foreign_keys=[schedule_completion_id])


class WeightLog(Base):
    __tablename__ = "weight_logs"

    id = Column(Integer, primary_key=True, index=True)
    reptile_id = Column(Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), nullable=False)
    logged_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    weight_grams = Column(Float, nullable=False)
    measured_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    notes = Column(Text, nullable=True)

    # Link to schedule completion (if this weighing fulfilled a schedule)
    schedule_completion_id = Column(Integer, ForeignKey("schedule_completions.id", ondelete="SET NULL"), nullable=True, index=True)

    # Relationships
    reptile = relationship("Reptile", back_populates="weight_logs")
    logged_by = relationship("User", foreign_keys=[logged_by_user_id])
    schedule_completion = relationship("ScheduleCompletion", foreign_keys=[schedule_completion_id])


class Measurement(Base):
    """
    Flexible measurement tracking for reptiles.
    Supports both predefined measurement types (SVL, total length, etc.) and custom measurements.
    """
    __tablename__ = "measurements"

    id = Column(Integer, primary_key=True, index=True)
    reptile_id = Column(Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), nullable=False)
    logged_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    measurement_type = Column(String(100), nullable=False)  # e.g., 'weight', 'svl', 'total_length', 'shell_length', 'custom'
    value = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)  # e.g., 'g', 'kg', 'cm', 'mm', 'in'
    measured_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    notes = Column(Text, nullable=True)

    # For custom measurement types
    custom_label = Column(String(100), nullable=True)  # Used when measurement_type is 'custom'

    # Link to schedule completion (if this measurement fulfilled a schedule)
    schedule_completion_id = Column(Integer, ForeignKey("schedule_completions.id", ondelete="SET NULL"), nullable=True, index=True)

    # Relationships
    reptile = relationship("Reptile", back_populates="measurements")
    logged_by = relationship("User", foreign_keys=[logged_by_user_id])
    schedule_completion = relationship("ScheduleCompletion", foreign_keys=[schedule_completion_id])


class HealthRecord(Base):
    __tablename__ = "health_records"

    id = Column(Integer, primary_key=True, index=True)
    reptile_id = Column(Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), nullable=False)
    logged_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    record_type = Column(String, nullable=False)  # "vet_visit", "medication", "observation", "shedding", "bowel_movement"
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    # Bowel movement specific fields
    consistency = Column(String, nullable=True)  # "normal", "soft", "hard", "watery", "mucus"
    photo_url = Column(String, nullable=True)  # For bowel movement photos

    date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    reptile = relationship("Reptile", back_populates="health_records")
    logged_by = relationship("User", foreign_keys=[logged_by_user_id])


class MistingLog(Base):
    __tablename__ = "misting_logs"

    id = Column(Integer, primary_key=True, index=True)
    reptile_id = Column(Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), nullable=False, index=True)
    logged_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    misted_at = Column(DateTime(timezone=True), nullable=False)
    notes = Column(Text, nullable=True)

    # Link to schedule completion (if this misting fulfilled a schedule)
    schedule_completion_id = Column(Integer, ForeignKey("schedule_completions.id", ondelete="SET NULL"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    reptile = relationship("Reptile", back_populates="misting_logs")
    logged_by = relationship("User", foreign_keys=[logged_by_user_id])
    schedule_completion = relationship("ScheduleCompletion", foreign_keys=[schedule_completion_id])


class Photo(Base):
    """Photo model for reptile photos (standalone or attached to logs)."""
    __tablename__ = "photos"

    # UUID for photos (better for public exposure than auto-incrementing IDs)
    id = Column(UUID(as_uuid=True), primary_key=True)  # UUID type
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    reptile_id = Column(Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Storage paths
    file_path = Column(String, nullable=False)
    thumbnail_path = Column(String, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    mime_type = Column(String(50), nullable=True)

    # Categorization
    category = Column(String(50), nullable=False, index=True)  # 'health', 'weight', 'feeding', 'enclosure', 'general'
    tags = Column(JSON, nullable=True)  # Array of tags for future use

    # Metadata
    caption = Column(Text, nullable=True)
    taken_at = Column(DateTime(timezone=True), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True)

    # Relationships to logs (nullable - photos can exist standalone)
    health_record_id = Column(Integer, ForeignKey("health_records.id", ondelete="SET NULL"), nullable=True, index=True)
    feeding_log_id = Column(Integer, ForeignKey("feedings.id", ondelete="SET NULL"), nullable=True, index=True)
    weight_log_id = Column(Integer, ForeignKey("weight_logs.id", ondelete="SET NULL"), nullable=True, index=True)
    misting_log_id = Column(Integer, ForeignKey("misting_logs.id", ondelete="SET NULL"), nullable=True, index=True)

    # Relationships
    household = relationship("Household")
    reptile = relationship("Reptile", foreign_keys=[reptile_id], back_populates="photos")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_user_id])
    health_record = relationship("HealthRecord", foreign_keys=[health_record_id])
    # Note: feeding_log, weight_log, misting_log relationships can be added when needed


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    reptile_id = Column(Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=True)  # User-friendly name for the schedule
    schedule_type = Column(String, nullable=False)  # "feeding", "misting", "weighing", "supplement"
    schedule_mode = Column(Enum(ScheduleMode, values_callable=lambda x: [e.value for e in x], name='schedule_mode'), nullable=False, default=ScheduleMode.FIXED)  # "fixed" or "requirement"
    schedule_rule = Column(String, nullable=True)  # "every_x_days", "days_of_week", "monthly", "dependent" (nullable for interval mode)

    # Additional details
    food_category = Column(String, nullable=True)  # For feeding schedules: "insects", "salad", "mixed", etc.
    time_slot = Column(String, nullable=True)  # For misting schedules: "morning", "midday", "afternoon", "evening", "night"
    health_category = Column(String, nullable=True)  # For weighing schedules: "weight_check", "bathing", "shedding_check", etc.

    # For every_x_days
    frequency_days = Column(Integer, nullable=True)

    # For days_of_week (comma-separated: '1,3,5' for Mon,Wed,Fri - 0=Sunday, 6=Saturday)
    days_of_week = Column(String, nullable=True)

    # For monthly (day of month: 1-31)
    day_of_month = Column(Integer, nullable=True)

    # For dependent schedules
    parent_schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=True)
    dependent_rule = Column(String, nullable=True)  # "every_occurrence", "every_nth", "specific_days"
    dependent_frequency = Column(Integer, nullable=True)  # For every_nth (e.g., every 2nd feeding)
    dependent_days = Column(String, nullable=True)  # For specific_days (e.g., '1,3' for Mon,Wed)

    # For interval-based schedules (time-based with min/max days constraints)
    quota_period = Column(Enum(QuotaPeriod, values_callable=lambda x: [e.value for e in x], name='quota_period'), nullable=True)  # "week" or "month" - for grouping display data only (no enforcement)
    min_days_between = Column(Integer, nullable=True)  # Minimum days between events (HARD constraint - e.g., 2 days)
    max_days_between = Column(Integer, nullable=True)  # Maximum days between events (HARD constraint - e.g., 4 days)
    suggested_days = Column(JSON(none_as_null=True), nullable=True)  # Optional suggested days array (e.g., [1, 4] for Mon, Thu)

    # For supplement schedules
    supplement_id = Column(Integer, ForeignKey("supplements.id", ondelete="SET NULL"), nullable=True)

    # Time window settings
    earliest_time = Column(Time, nullable=True)  # Start of valid feeding window (e.g., 10:00 AM)
    latest_time = Column(Time, nullable=True)  # End of valid feeding window (e.g., 8:00 PM)
    time_window_enabled = Column(Boolean, default=False, nullable=False)
    reminder_minutes_before = Column(Integer, nullable=True)  # Legacy: minutes before latest_time (deprecated, use reminder_time)
    reminder_time = Column(Time, nullable=True)  # Absolute reminder time (must be within time window, takes precedence over reminder_minutes_before)

    # Notification settings
    notifications_enabled = Column(Boolean, default=True, nullable=False)  # Per-schedule notification toggle

    # Auto-complete settings
    auto_complete_enabled = Column(Boolean, default=False, nullable=False)  # Auto-complete after time window + delay
    auto_complete_hours_after = Column(Integer, default=2, nullable=False)  # Hours after time window (or end of day if no window)

    # Flexible completion window settings
    flexible_completion_enabled = Column(Boolean, default=False, nullable=False)  # Allow completing instances within ±N days
    flexible_completion_days = Column(Integer, default=2, nullable=False)  # Number of days before/after scheduled date (default: ±2 days)

    enabled = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    reptile = relationship("Reptile", back_populates="schedules")
    parent_schedule = relationship("Schedule", remote_side=[id], back_populates="child_schedules")
    notification_channels = relationship("NotificationChannel", secondary="schedule_notification_channels", backref="schedules")
    child_schedules = relationship("Schedule", back_populates="parent_schedule", cascade="all, delete-orphan")
    supplement = relationship("Supplement")
    completions = relationship("ScheduleCompletion", back_populates="schedule", cascade="all, delete-orphan")
    instances = relationship("ScheduleInstance", back_populates="schedule", cascade="all, delete-orphan")


class ScheduleCompletion(Base):
    """Tracks completion status of individual schedule occurrences"""
    __tablename__ = "schedule_completions"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    instance_id = Column(Integer, ForeignKey("schedule_instances.id", ondelete="SET NULL"), nullable=True, index=True)
    scheduled_date = Column(Date, nullable=False, index=True)  # The date this occurrence was scheduled for

    completed_at = Column(DateTime(timezone=True), nullable=True)  # When it was actually completed
    completion_type = Column(Enum(CompletionType, values_callable=lambda x: [e.value for e in x]), nullable=True)
    completion_id = Column(Integer, nullable=True)  # ID of the feeding/misting/weighing that fulfilled this

    within_time_window = Column(Boolean, nullable=True)  # True if completed within earliest/latest times
    status = Column(Enum(CompletionStatus, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    auto_completed = Column(Boolean, default=False, nullable=False)  # True if auto-completed by system (not manually logged)

    reptile_id = Column(Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    schedule = relationship("Schedule", back_populates="completions")
    reptile = relationship("Reptile")
    instance = relationship("ScheduleInstance", back_populates="completions")


class ScheduleInstance(Base):
    """Individual occurrence of a schedule (pre-generated for upcoming dates)"""
    __tablename__ = "schedule_instances"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    scheduled_date = Column(Date, nullable=False, index=True)  # The date this instance is scheduled for

    # Status of this instance
    status = Column(String(50), nullable=False, default="pending", index=True)  # pending, completed, missed, skipped

    # Feeding sequence number for this schedule (used for feeding_count supplement rotations)
    # This is the nth feeding instance for this specific schedule (1, 2, 3, etc.)
    # Only populated for feeding schedules
    feeding_sequence_number = Column(Integer, nullable=True, index=True)

    # Pre-calculated supplements for this instance (JSONB array of supplement IDs and names)
    # Example: [{"id": 1, "name": "Calcium", "priority": 1}, {"id": 2, "name": "Multivitamin", "priority": 2}]
    supplements = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    schedule = relationship("Schedule", back_populates="instances")
    completions = relationship("ScheduleCompletion", back_populates="instance")


class QuotaTracking(Base):
    """Tracks quota progress for interval-based schedules (informational only - no enforcement)"""
    __tablename__ = "quota_tracking"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    reptile_id = Column(Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), nullable=False, index=True)
    period_start_date = Column(Date, nullable=False, index=True)  # Start of the period (Monday for week, 1st for month)
    period_type = Column(String(10), nullable=False)  # "week" or "month"
    count = Column(Integer, nullable=False, default=0)  # Number of completions this period (read-only tracking)
    last_completion_date = Column(Date, nullable=True)  # Last completion date (for calculating days_since_last)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    schedule = relationship("Schedule")
    reptile = relationship("Reptile")


class FeedingRotation(Base):
    """Defines supplement or food replacement rotation rules for a reptile"""
    __tablename__ = "feeding_rotations"

    id = Column(Integer, primary_key=True, index=True)
    reptile_id = Column(Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), nullable=False, index=True)

    # Type of rotation: "supplement" or "food_replacement"
    rotation_type = Column(String, nullable=False)

    # For supplement rotations
    supplement_id = Column(Integer, ForeignKey("supplements.id", ondelete="CASCADE"), nullable=True)

    # For food replacement rotations (e.g., "feed frozen mouse every 10th feeding instead of insects")
    replacement_food_category = Column(String, nullable=True)  # "eggs", "frozen_animal", etc.
    replacement_note = Column(String, nullable=True)  # "1 small egg", "1 pinky mouse"

    # Trigger mode: how the rotation is triggered
    # "feeding_count": Based on feeding count (every Nth feeding)
    # "schedule_based": Based on calendar schedule (specific days of week)
    trigger_mode = Column(String, nullable=False, default="feeding_count")

    # For feeding_count trigger mode:
    # Every N feedings (e.g., 3 = every 3rd feeding)
    every_n_feedings = Column(Integer, nullable=True)

    # Counting mode (only for feeding_count)
    # "category_only": Count only feedings matching applies_to_category
    # "all_feedings": Count all feedings regardless of category
    counting_mode = Column(String, nullable=True, default="category_only")

    # For schedule_based trigger mode:
    # Days of week (comma-separated: '0,1,3' for Sun, Mon, Wed)
    schedule_days_of_week = Column(String, nullable=True)

    # Frequency for schedule-based (e.g., every X days)
    schedule_frequency_days = Column(Integer, nullable=True)

    # Category filter (which feedings does this apply to?)
    # Can be: "insects", "salad", "mixed", "all", or null (default = all)
    applies_to_category = Column(String, nullable=True)

    # Application mode
    # "any_feeding": Apply to any feeding that day/occurrence (agnostic to which feeding it is)
    # "specific_occurrence": Apply only to the specific Nth feeding
    application_mode = Column(String, nullable=False, default="any_feeding")

    # Priority (1 = highest) - used when multiple rotations trigger on same feeding
    priority = Column(Integer, nullable=False, default=10)

    # Exclusive mode: If True, only the highest priority supplement applies (others are excluded)
    # If False (default), multiple supplements can apply simultaneously
    is_exclusive = Column(Boolean, default=False, nullable=False)

    # Enabled/disabled
    enabled = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    reptile = relationship("Reptile", backref="feeding_rotations")
    supplement = relationship("Supplement")


class SupplementRotationTemplate(Base):
    """Reusable supplement rotation templates that can be applied to reptiles"""
    __tablename__ = "supplement_rotation_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    # Species and age filters (for matching to reptiles)
    species = Column(String, nullable=True)  # e.g., "Bearded Dragon", null = all species
    age_category = Column(String, nullable=True)  # hatchling, juvenile, adult, gravid, null = all

    # UVB lighting requirement filter
    uvb_lighting = Column(Boolean, nullable=True)  # true = requires UVB, false = no UVB, null = either

    # Supplement reference
    supplement_id = Column(Integer, ForeignKey("supplements.id", ondelete="CASCADE"), nullable=False)

    # Trigger mode: how the rotation is triggered
    trigger_mode = Column(String, nullable=False, default="feeding_count")  # "feeding_count" or "schedule_based"

    # For feeding_count trigger mode
    every_n_feedings = Column(Integer, nullable=True)
    counting_mode = Column(String, nullable=True, default="all_feedings")  # "category_only" or "all_feedings"

    # For schedule_based trigger mode
    schedule_days_of_week = Column(String, nullable=True)  # "0,1,3" for Sun, Mon, Wed
    schedule_frequency_days = Column(Integer, nullable=True)  # For bi-weekly patterns (e.g., 14)

    # Category filter
    applies_to_category = Column(String, nullable=True)  # "insects", "salad", "mixed", "all", null = all

    # Application mode
    application_mode = Column(String, nullable=False, default="any_feeding")  # "any_feeding" or "specific_occurrence"

    # Priority (1 = highest)
    priority = Column(Integer, nullable=False, default=10)

    # Exclusive mode
    is_exclusive = Column(Boolean, default=True, nullable=False)

    # Source information
    source_name = Column(String, nullable=True)  # e.g., "ReptiFiles", "The Bio Dude"
    source_url = Column(String, nullable=True)

    # Notes
    notes = Column(Text, nullable=True)

    # Default template flag
    is_default = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    supplement = relationship("Supplement")


class NotificationSettings(Base):
    __tablename__ = "notification_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Global notification preferences (kept for backward compatibility during migration)
    webhook_enabled = Column(Boolean, default=False)
    webhook_url = Column(String, nullable=True)
    webhook_type = Column(String, default="discord")  # discord, pushover, generic

    # Notification type preferences
    notify_schedule_reminders = Column(Boolean, default=True, nullable=False)
    notify_overdue_alerts = Column(Boolean, default=True, nullable=False)

    # Quiet hours settings
    quiet_hours_enabled = Column(Boolean, default=False, nullable=False)
    quiet_hours_start = Column(Time, nullable=True)  # e.g., 22:00 (10 PM)
    quiet_hours_end = Column(Time, nullable=True)  # e.g., 08:00 (8 AM)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    channels = relationship("NotificationChannel", back_populates="settings", cascade="all, delete-orphan")


class NotificationChannel(Base):
    __tablename__ = "notification_channels"

    id = Column(Integer, primary_key=True, index=True)
    notification_settings_id = Column(Integer, ForeignKey("notification_settings.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)  # User-friendly name (e.g., "Discord - Main Server")
    webhook_type = Column(String, nullable=False)  # discord, pushover, generic, in_app
    webhook_url = Column(String, nullable=True)  # For discord/generic webhooks
    config = Column(JSON, nullable=True)  # For pushover and other configs (api_key, user_key, priority, etc.)
    enabled = Column(Boolean, default=True, nullable=False)
    household_wide = Column(Boolean, default=False, nullable=False)  # If true, available to all household members
    is_system = Column(Boolean, default=False, nullable=True)  # If true, channel cannot be deleted (nullable for backward compatibility)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    settings = relationship("NotificationSettings", back_populates="channels")


class TemplateGroup(Base):
    """User-defined groups for organizing notification templates"""
    __tablename__ = "template_groups"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(20), nullable=True)  # For UI color coding (e.g., "blue", "green", "#FF5733")
    icon = Column(String(50), nullable=True)  # Optional emoji or icon identifier
    sort_order = Column(Integer, default=0, nullable=False)  # For custom ordering

    # Group-level settings
    enabled = Column(Boolean, default=True, nullable=False)  # Master on/off switch for all templates in group
    default_priority = Column(Integer, default=0, nullable=False)  # Priority modifier added to all templates (can be negative)
    ignore_quiet_hours = Column(Boolean, default=False, nullable=False)  # If true, bypass user's quiet hours settings
    default_channel_ids = Column(JSON, nullable=True)  # Array of default channel IDs for templates in this group

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", backref="template_groups")
    templates = relationship("NotificationTemplate", back_populates="group")


class NotificationTemplate(Base):
    __tablename__ = "notification_templates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)  # NULL for system templates

    name = Column(String, nullable=False)  # User-friendly name
    template_type = Column(String, nullable=False, default="custom")  # system or custom
    trigger_type = Column(String, nullable=False)  # schedule_reminder, overdue_alert, feeding_logged, custom

    # Templates with variables like {reptile_name}, {schedule_type}, etc.
    message_template = Column(Text, nullable=False)
    title_template = Column(String, nullable=True)

    # Optional: Limit to specific channel type (discord, pushover, generic) or NULL for all
    channel_type = Column(String, nullable=True)

    # Discord-specific configuration (color, fields, footer, etc.)
    discord_config = Column(JSON, nullable=True)

    # Matching criteria (all optional - NULL means applies to all)
    reptile_id = Column(Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), nullable=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=True)
    schedule_type_filter = Column(String(50), nullable=True)  # 'feeding', 'misting', 'weighing', 'health'
    food_category_filter = Column(String(50), nullable=True)  # 'insects', 'salad', 'prepared', 'supplements'

    # Priority for resolution (lower = higher priority)
    priority = Column(Integer, default=100, nullable=False)

    # Optional description of when this template applies
    applies_to_description = Column(Text, nullable=True)

    # Optional grouping for organization
    group_id = Column(Integer, ForeignKey("template_groups.id", ondelete="SET NULL"), nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", backref="notification_templates")
    reptile = relationship("Reptile", backref="notification_templates")
    schedule = relationship("Schedule", backref="notification_templates")
    group = relationship("TemplateGroup", back_populates="templates")


# Association table for Schedule <-> NotificationChannel many-to-many relationship
schedule_notification_channels = Table(
    "schedule_notification_channels",
    Base.metadata,
    Column("schedule_id", Integer, ForeignKey("schedules.id", ondelete="CASCADE"), primary_key=True),
    Column("channel_id", Integer, ForeignKey("notification_channels.id", ondelete="CASCADE"), primary_key=True),
)


class ScheduledNotificationJob(Base):
    """Tracks scheduled notification jobs for APScheduler"""
    __tablename__ = "scheduled_notification_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(255), unique=True, nullable=False, index=True)  # APScheduler job ID
    job_type = Column(String(50), nullable=False, default="notification_reminder")  # notification_reminder or auto_complete
    schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    channel_id = Column(Integer, ForeignKey("notification_channels.id", ondelete="CASCADE"), nullable=False)
    instance_id = Column(Integer, ForeignKey("schedule_instances.id", ondelete="CASCADE"), nullable=True, index=True)  # For auto_complete jobs
    scheduled_date = Column(Date, nullable=False)  # The date this notification is for
    scheduled_time_utc = Column(DateTime(timezone=True), nullable=False, index=True)  # When to send (UTC)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    status = Column(String(50), nullable=False, default="pending")  # pending, sent, failed, cancelled

    # Relationships
    schedule = relationship("Schedule")
    user = relationship("User")
    channel = relationship("NotificationChannel")
    instance = relationship("ScheduleInstance", foreign_keys=[instance_id])


# Household and Invitation models
household_members = Table(
    "household_members",
    Base.metadata,
    Column("household_id", Integer, ForeignKey("households.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("access_level", Enum(AccessLevel, values_callable=lambda x: [e.value for e in x]), nullable=False, default=AccessLevel.CARETAKER),
    Column("joined_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)),
)


class Household(Base):
    __tablename__ = "households"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    users = relationship("User", secondary=household_members, backref="households")
    reptiles = relationship("Reptile", backref="household")


class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    expires_at = Column(DateTime(timezone=True), nullable=True)
    max_uses = Column(Integer, nullable=True)
    used_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    household = relationship("Household", backref="invitations")
    creator = relationship("User")


class ScheduleTemplate(Base):
    """Reusable schedule templates that can be applied to reptiles"""
    __tablename__ = "schedule_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    # Species and age targeting
    species = Column(String, nullable=True, index=True)  # null = applies to all species
    age_category = Column(String, nullable=True, index=True)  # "hatchling", "juvenile", "adult", "senior", null = all ages
    uvb_lighting = Column(Boolean, nullable=True, index=True)  # null = doesn't matter, True = requires UVB, False = no UVB needed

    # Template metadata
    is_default = Column(Boolean, default=False, nullable=False)  # Protected default templates
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    source_template_id = Column(Integer, ForeignKey("schedule_templates.id", ondelete="SET NULL"), nullable=True)  # Track duplications

    # Source attribution
    source_name = Column(String, nullable=True)  # e.g., "ReptiFiles", "The Bio Dude"
    source_url = Column(String, nullable=True)  # Link to original care guide

    # Schedule configuration (similar to Schedule model)
    schedule_type = Column(String, nullable=False)  # "feeding", "misting", "weighing", "supplement"
    schedule_rule = Column(String, nullable=False)  # "every_x_days", "days_of_week", "monthly"
    food_category = Column(String, nullable=True)
    time_slot = Column(String, nullable=True)
    health_category = Column(String, nullable=True)

    # Rule parameters
    frequency_days = Column(Integer, nullable=True)
    days_of_week = Column(String, nullable=True)
    day_of_month = Column(Integer, nullable=True)

    # Time window settings
    earliest_time = Column(Time, nullable=True)
    latest_time = Column(Time, nullable=True)
    time_window_enabled = Column(Boolean, default=False, nullable=False)
    reminder_minutes_before = Column(Integer, nullable=True)  # Legacy: minutes before latest_time (deprecated, use reminder_time)
    reminder_time = Column(Time, nullable=True)  # Absolute reminder time (must be within time window, takes precedence over reminder_minutes_before)

    # Supplement reference (optional)
    supplement_id = Column(Integer, ForeignKey("supplements.id", ondelete="SET NULL"), nullable=True)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    created_by = relationship("User", lazy="select")
    source_template = relationship("ScheduleTemplate", remote_side=[id], foreign_keys=[source_template_id], lazy="select")
    supplement = relationship("Supplement", lazy="select")


class CareGuideline(Base):
    """Species-specific care recommendations and guidelines"""
    __tablename__ = "care_guidelines"

    id = Column(Integer, primary_key=True, index=True)
    species = Column(String, nullable=False, index=True)
    age_category = Column(String, nullable=True, index=True)  # "hatchling", "juvenile", "adult", "senior", null = general

    # Guideline content
    guideline_type = Column(String, nullable=False, index=True)  # "feeding", "supplements", "environment", "handling", "general"
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)

    # Structured recommendations (JSON)
    recommendations = Column(JSON, nullable=True)  # Structured data for automated suggestions

    # Source attribution
    source_name = Column(String, nullable=True)  # e.g., "ReptiFiles", "Morphmarket Care Guides"
    source_url = Column(String, nullable=True)

    # User contributions
    is_default = Column(Boolean, default=False, nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    created_by = relationship("User", lazy="select")


class UserNotification(Base):
    """In-app notifications for users"""
    __tablename__ = "user_notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Notification content
    notification_type = Column(Enum(NotificationType), nullable=False, index=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String, nullable=True)  # Optional link to relevant page (e.g., /reptiles/123)

    # Read status
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)

    # Notification metadata (JSON) - store additional context like reptile_id, schedule_id, etc.
    # Using 'notification_metadata' instead of 'metadata' to avoid conflict with SQLAlchemy's reserved name
    notification_metadata = Column(JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    # Relationships
    user = relationship("User", lazy="select")