from datetime import datetime, timezone
from enum import Enum as PyEnum
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
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
    FEEDER = "feeder"
    VIEWER = "viewer"


class FoodCategory(str, PyEnum):
    INSECT = "insect"
    VEGETABLE = "vegetable"
    FRUIT = "fruit"
    PREPARED = "prepared"
    OTHER = "other"


class InsectSize(str, PyEnum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"


# Association table for reptile access
reptile_access = Table(
    "reptile_access",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("reptile_id", Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), primary_key=True),
    Column("access_level", Enum(AccessLevel), nullable=False),
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

    # Relationships
    users = relationship("User", secondary=reptile_access, back_populates="reptiles")
    feedings = relationship("Feeding", back_populates="reptile", cascade="all, delete-orphan")
    weight_logs = relationship("WeightLog", back_populates="reptile", cascade="all, delete-orphan")
    health_records = relationship("HealthRecord", back_populates="reptile", cascade="all, delete-orphan")


class Food(Base):
    __tablename__ = "foods"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)
    category = Column(Enum(FoodCategory), nullable=False)
    insect_size = Column(Enum(InsectSize), nullable=True)  # Only for insects

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

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    reptile = relationship("Reptile", back_populates="feedings")
    user = relationship("User", back_populates="feedings")
    foods = relationship("Food", secondary=feeding_foods)
    supplements = relationship("Supplement", secondary=feeding_supplements)
    salad_components = relationship("Food", secondary=feeding_salad_components)


class WeightLog(Base):
    __tablename__ = "weight_logs"

    id = Column(Integer, primary_key=True, index=True)
    reptile_id = Column(Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), nullable=False)
    weight_grams = Column(Float, nullable=False)
    measured_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    notes = Column(Text, nullable=True)

    # Relationships
    reptile = relationship("Reptile", back_populates="weight_logs")


class HealthRecord(Base):
    __tablename__ = "health_records"

    id = Column(Integer, primary_key=True, index=True)
    reptile_id = Column(Integer, ForeignKey("reptiles.id", ondelete="CASCADE"), nullable=False)

    record_type = Column(String, nullable=False)  # "vet_visit", "medication", "observation", etc.
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    reptile = relationship("Reptile", back_populates="health_records")


class NotificationSettings(Base):
    __tablename__ = "notification_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)

    webhook_enabled = Column(Boolean, default=False)
    webhook_url = Column(String, nullable=True)
    webhook_type = Column(String, default="discord")  # discord, pushover, generic

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))