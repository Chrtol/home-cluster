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


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    oidc_sub = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
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

    # Relationships
    users = relationship("User", secondary=reptile_access, back_populates="reptiles")
    feedings = relationship("Feeding", back_populates="reptile", cascade="all, delete-orphan")
    weight_logs = relationship("WeightLog", back_populates="reptile", cascade="all, delete-orphan")
    health_records = relationship("HealthRecord", back_populates="reptile", cascade="all, delete-orphan")
    misting_logs = relationship("MistingLog", back_populates="reptile", cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="reptile", cascade="all, delete-orphan")


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
    weight_grams = Column(Float, nullable=False)
    measured_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    notes = Column(Text, nullable=True)

    # Link to schedule completion (if this weighing fulfilled a schedule)
    schedule_completion_id = Column(Integer, ForeignKey("schedule_completions.id", ondelete="SET NULL"), nullable=True, index=True)

    # Relationships
    reptile = relationship("Reptile", back_populates="weight_logs")
    schedule_completion = relationship("ScheduleCompletion", foreign_keys=[schedule_completion_id])


class HealthRecord(Base):
    __tablename__ = "health_records"

    id = Column(Integer, primary_key=True, index=True)
    reptile_id = Column(Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), nullable=False)

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


class MistingLog(Base):
    __tablename__ = "misting_logs"

    id = Column(Integer, primary_key=True, index=True)
    reptile_id = Column(Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), nullable=False, index=True)

    misted_at = Column(DateTime(timezone=True), nullable=False)
    notes = Column(Text, nullable=True)

    # Link to schedule completion (if this misting fulfilled a schedule)
    schedule_completion_id = Column(Integer, ForeignKey("schedule_completions.id", ondelete="SET NULL"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    reptile = relationship("Reptile", back_populates="misting_logs")
    schedule_completion = relationship("ScheduleCompletion", foreign_keys=[schedule_completion_id])


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    reptile_id = Column(Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=True)  # User-friendly name for the schedule
    schedule_type = Column(String, nullable=False)  # "feeding", "misting", "weighing", "supplement"
    schedule_rule = Column(String, nullable=False)  # "every_x_days", "days_of_week", "monthly", "dependent"

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

    # For supplement schedules
    supplement_id = Column(Integer, ForeignKey("supplements.id", ondelete="SET NULL"), nullable=True)

    # Time window settings
    earliest_time = Column(Time, nullable=True)  # Start of valid feeding window (e.g., 10:00 AM)
    latest_time = Column(Time, nullable=True)  # End of valid feeding window (e.g., 8:00 PM)
    time_window_enabled = Column(Boolean, default=False, nullable=False)
    reminder_minutes_before = Column(Integer, nullable=True)  # For future notifications

    # Notification settings
    notifications_enabled = Column(Boolean, default=True, nullable=False)  # Per-schedule notification toggle

    enabled = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    reptile = relationship("Reptile", back_populates="schedules")
    parent_schedule = relationship("Schedule", remote_side=[id], back_populates="child_schedules")
    child_schedules = relationship("Schedule", back_populates="parent_schedule", cascade="all, delete-orphan")
    supplement = relationship("Supplement")
    completions = relationship("ScheduleCompletion", back_populates="schedule", cascade="all, delete-orphan")


class ScheduleCompletion(Base):
    """Tracks completion status of individual schedule occurrences"""
    __tablename__ = "schedule_completions"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    scheduled_date = Column(Date, nullable=False, index=True)  # The date this occurrence was scheduled for

    completed_at = Column(DateTime(timezone=True), nullable=True)  # When it was actually completed
    completion_type = Column(Enum(CompletionType, values_callable=lambda x: [e.value for e in x]), nullable=True)
    completion_id = Column(Integer, nullable=True)  # ID of the feeding/misting/weighing that fulfilled this

    within_time_window = Column(Boolean, nullable=True)  # True if completed within earliest/latest times
    status = Column(Enum(CompletionStatus, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)

    reptile_id = Column(Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    schedule = relationship("Schedule", back_populates="completions")
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

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    channels = relationship("NotificationChannel", back_populates="settings", cascade="all, delete-orphan")


class NotificationChannel(Base):
    __tablename__ = "notification_channels"

    id = Column(Integer, primary_key=True, index=True)
    notification_settings_id = Column(Integer, ForeignKey("notification_settings.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)  # User-friendly name (e.g., "Discord - Main Server")
    webhook_type = Column(String, nullable=False)  # discord, pushover, generic
    webhook_url = Column(String, nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    settings = relationship("NotificationSettings", back_populates="channels")


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
    reminder_minutes_before = Column(Integer, nullable=True)

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