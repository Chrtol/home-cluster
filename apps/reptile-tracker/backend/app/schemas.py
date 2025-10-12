from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from app.models import AccessLevel, FoodCategory, InsectSize


# User schemas
class UserBase(BaseModel):
    email: EmailStr
    name: str


class UserCreate(UserBase):
    oidc_sub: str


class User(UserBase):
    id: int
    oidc_sub: str
    created_at: datetime
    last_login: datetime

    class Config:
        from_attributes = True


# Reptile schemas
class ReptileBase(BaseModel):
    name: str
    species: str
    date_of_birth: Optional[datetime] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    feeding_schedule_enabled: bool = False
    feeding_frequency_days: Optional[int] = None
    reminder_enabled: bool = False
    reminder_hours_before: int = 2


class ReptileCreate(ReptileBase):
    pass


class ReptileUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    feeding_schedule_enabled: Optional[bool] = None
    feeding_frequency_days: Optional[int] = None
    reminder_enabled: Optional[bool] = None
    reminder_hours_before: Optional[int] = None


class Reptile(ReptileBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReptileWithAccess(Reptile):
    access_level: AccessLevel
    last_feeding: Optional[datetime] = None


# Food schemas
class FoodBase(BaseModel):
    name: str
    category: FoodCategory
    insect_size: Optional[InsectSize] = None
    nutritional_data: Optional[dict] = None


class FoodCreate(FoodBase):
    pass


class Food(FoodBase):
    id: int
    is_default: bool
    created_at: datetime

    class Config:
        from_attributes = True


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


class FeedingCreate(BaseModel):
    reptile_id: int
    fed_at: Optional[datetime] = None
    foods: List[FeedingFoodItem]
    supplements: List[int] = []  # List of supplement IDs
    is_salad: bool = False
    salad_components: List[int] = []  # List of food IDs for salad
    notes: Optional[str] = None


class FeedingFood(BaseModel):
    food: Food
    quantity: int

    class Config:
        from_attributes = True


class Feeding(BaseModel):
    id: int
    reptile_id: int
    user_id: Optional[int]
    fed_at: datetime
    notes: Optional[str]
    is_salad: bool
    foods: List[Food]
    supplements: List[Supplement]
    salad_components: List[Food]
    created_at: datetime

    class Config:
        from_attributes = True


class FeedingWithUser(Feeding):
    user: Optional[User] = None
    reptile: Optional["Reptile"] = None


# Weight log schemas
class WeightLogBase(BaseModel):
    weight_grams: float
    measured_at: Optional[datetime] = None
    notes: Optional[str] = None


class WeightLogCreate(WeightLogBase):
    reptile_id: int


class WeightLog(WeightLogBase):
    id: int
    reptile_id: int
    measured_at: datetime

    class Config:
        from_attributes = True


# Health record schemas
class HealthRecordBase(BaseModel):
    record_type: str
    title: str
    description: Optional[str] = None
    date: datetime


class HealthRecordCreate(HealthRecordBase):
    reptile_id: int


class HealthRecordUpdate(BaseModel):
    record_type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[datetime] = None


class HealthRecord(HealthRecordBase):
    id: int
    reptile_id: int
    created_at: datetime

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
