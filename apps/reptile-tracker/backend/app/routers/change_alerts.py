"""
Change alert configuration API for Phase 28.

Endpoints for managing feeding alerts, measurement alerts, and species presets.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any, Optional

from app.database import get_db
from app.auth import get_current_user
from app.models import (
    User, Reptile, ChangeAlertConfig, NotificationSettings,
    reptile_access, AccessLevel
)
from app.schemas import (
    ChangeAlertConfigCreate, ChangeAlertConfigUpdate, ChangeAlertConfigResponse,
    GlobalChangeAlertSettingsResponse, GlobalChangeAlertSettingsUpdate,
    SpeciesPreset, ApplyPresetRequest, ReptileAlertSummary,
    BulkApplyPresetRequest, BulkUpdateRequest, BulkOperationResult
)

router = APIRouter(prefix="/change-alerts", tags=["change-alerts"])

# Species presets (hardcoded per Claude's discretion from CONTEXT.md)
SPECIES_PRESETS: Dict[str, SpeciesPreset] = {
    "bearded_dragon_juvenile": SpeciesPreset(
        id="bearded_dragon_juvenile",
        name="Bearded Dragon (Juvenile)",
        description="Fast-growing juveniles with daily insect feeding",
        alerts={
            "feeding": {"enabled": True, "window_days": 7, "threshold_increase": 20, "threshold_decrease": 20, "cooldown_days": 3},
            "weight": {"enabled": True, "threshold_type": "percentage", "threshold_increase": 25, "threshold_decrease": 5, "cooldown_days": 7},
            "measurement_svl": {"enabled": True, "threshold_type": "percentage", "threshold_increase": 10, "threshold_decrease": 5, "rolling_average_window": 3, "cooldown_days": 14},
            "measurement_total_length": {"enabled": True, "threshold_type": "percentage", "threshold_increase": 10, "threshold_decrease": 5, "rolling_average_window": 3, "cooldown_days": 14},
        }
    ),
    "bearded_dragon_adult": SpeciesPreset(
        id="bearded_dragon_adult",
        name="Bearded Dragon (Adult)",
        description="Mature dragons with weekly insect feeding",
        alerts={
            "feeding": {"enabled": True, "window_days": 14, "threshold_increase": 30, "threshold_decrease": 30, "cooldown_days": 7},
            "weight": {"enabled": True, "threshold_type": "percentage", "threshold_increase": 10, "threshold_decrease": 5, "cooldown_days": 7},
            "measurement_svl": {"enabled": False},  # Adults don't grow much
        }
    ),
    "ball_python_juvenile": SpeciesPreset(
        id="ball_python_juvenile",
        name="Ball Python (Juvenile)",
        description="Growing pythons fed every 7-10 days",
        alerts={
            "feeding": {"enabled": True, "window_days": 21, "threshold_increase": 25, "threshold_decrease": 25, "cooldown_days": 14},
            "weight": {"enabled": True, "threshold_type": "percentage", "threshold_increase": 25, "threshold_decrease": 5, "cooldown_days": 7},
            "measurement_svl": {"enabled": True, "threshold_type": "percentage", "threshold_increase": 15, "threshold_decrease": 5, "rolling_average_window": 3, "cooldown_days": 21},
        }
    ),
    "ball_python_adult": SpeciesPreset(
        id="ball_python_adult",
        name="Ball Python (Adult)",
        description="Mature pythons fed every 14-21 days",
        alerts={
            "feeding": {"enabled": True, "window_days": 28, "threshold_increase": 40, "threshold_decrease": 40, "cooldown_days": 21},
            "weight": {"enabled": True, "threshold_type": "percentage", "threshold_increase": 10, "threshold_decrease": 5, "cooldown_days": 7},
        }
    ),
    "leopard_gecko_juvenile": SpeciesPreset(
        id="leopard_gecko_juvenile",
        name="Leopard Gecko (Juvenile)",
        description="Growing geckos fed every 1-2 days",
        alerts={
            "feeding": {"enabled": True, "window_days": 7, "threshold_increase": 25, "threshold_decrease": 25, "cooldown_days": 3},
            "weight": {"enabled": True, "threshold_type": "percentage", "threshold_increase": 25, "threshold_decrease": 5, "cooldown_days": 7},
            "measurement_svl": {"enabled": True, "threshold_type": "percentage", "threshold_increase": 10, "threshold_decrease": 5, "rolling_average_window": 3, "cooldown_days": 14},
        }
    ),
    "leopard_gecko_adult": SpeciesPreset(
        id="leopard_gecko_adult",
        name="Leopard Gecko (Adult)",
        description="Mature geckos fed every 2-3 days",
        alerts={
            "feeding": {"enabled": True, "window_days": 14, "threshold_increase": 30, "threshold_decrease": 30, "cooldown_days": 7},
            "weight": {"enabled": True, "threshold_type": "percentage", "threshold_increase": 10, "threshold_decrease": 5, "cooldown_days": 7},
        }
    ),
    "crested_gecko": SpeciesPreset(
        id="crested_gecko",
        name="Crested Gecko",
        description="CGD-fed geckos with occasional insects",
        alerts={
            "feeding": {"enabled": True, "window_days": 14, "threshold_increase": 30, "threshold_decrease": 30, "cooldown_days": 7},
            "weight": {"enabled": True, "threshold_type": "percentage", "threshold_increase": 10, "threshold_decrease": 5, "cooldown_days": 7},
        }
    ),
    "corn_snake": SpeciesPreset(
        id="corn_snake",
        name="Corn Snake",
        description="Fed every 7-14 days depending on age",
        alerts={
            "feeding": {"enabled": True, "window_days": 21, "threshold_increase": 30, "threshold_decrease": 30, "cooldown_days": 14},
            "weight": {"enabled": True, "threshold_type": "percentage", "threshold_increase": 10, "threshold_decrease": 5, "cooldown_days": 7},
            "measurement_svl": {"enabled": True, "threshold_type": "percentage", "threshold_increase": 10, "threshold_decrease": 5, "rolling_average_window": 3, "cooldown_days": 21},
        }
    ),
}


def auto_match_preset(species: str, age_category: Optional[str]) -> Optional[str]:
    """
    Match a reptile's species and age to the best preset.

    Args:
        species: Reptile species (e.g., "Bearded Dragon")
        age_category: Reptile age category (e.g., "juvenile", "adult")

    Returns:
        Preset ID if match found, None otherwise
    """
    # Normalize species name
    normalized_species = species.lower().replace(" ", "_")

    # Map age categories to preset age suffixes
    age_mapping = {
        "hatchling": "juvenile",
        "juvenile": "juvenile",
        "adult": "adult",
        "gravid": "adult",
    }
    preset_age = age_mapping.get(age_category, "adult") if age_category else "adult"

    # Try full key (species_age)
    full_key = f"{normalized_species}_{preset_age}"
    if full_key in SPECIES_PRESETS:
        return full_key

    # Try species-only key (for species without age variants)
    if normalized_species in SPECIES_PRESETS:
        return normalized_species

    return None


async def verify_reptile_access(
    db: AsyncSession,
    user: User,
    reptile_id: int,
    required_level: AccessLevel = AccessLevel.CARETAKER
) -> Reptile:
    """Verify user has access to reptile and return it."""
    result = await db.execute(
        select(Reptile, reptile_access.c.access_level)
        .join(reptile_access, Reptile.id == reptile_access.c.reptile_id)
        .where(
            and_(
                Reptile.id == reptile_id,
                reptile_access.c.user_id == user.id
            )
        )
    )
    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="Reptile not found")

    reptile, access_level = row
    # Check access level (OWNER > CARETAKER > VIEWER)
    access_levels = [AccessLevel.VIEWER, AccessLevel.CARETAKER, AccessLevel.OWNER]
    if access_levels.index(access_level) < access_levels.index(required_level):
        raise HTTPException(status_code=403, detail="Insufficient access level")

    return reptile


# ---- Global Settings Endpoints ----

@router.get("/global", response_model=GlobalChangeAlertSettingsResponse)
async def get_global_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get global change alert settings for current user."""
    result = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        # Return defaults
        return GlobalChangeAlertSettingsResponse(
            feeding_alert_enabled=False,
            feeding_alert_window_days=14,
            feeding_alert_threshold_percent=30,
            feeding_alert_cooldown_days=7,
            measurement_alert_enabled=False,
            measurement_alert_rolling_window=3,
            measurement_alert_threshold_percent=10,
            measurement_alert_cooldown_days=14,
            measurement_alert_types=None,
        )

    return GlobalChangeAlertSettingsResponse.model_validate(settings)


@router.patch("/global", response_model=GlobalChangeAlertSettingsResponse)
async def update_global_settings(
    updates: GlobalChangeAlertSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update global change alert settings."""
    result = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        # Create settings with defaults
        settings = NotificationSettings(user_id=current_user.id)
        db.add(settings)

    # Apply updates
    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    await db.commit()
    await db.refresh(settings)

    return GlobalChangeAlertSettingsResponse.model_validate(settings)


# ---- All Configs Endpoint ----

@router.get("/configs", response_model=List[ChangeAlertConfigResponse])
async def get_all_configs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all change alert configs for all reptiles the user has access to."""
    # Get all reptile IDs the user has access to
    reptile_result = await db.execute(
        select(reptile_access.c.reptile_id).where(
            reptile_access.c.user_id == current_user.id
        )
    )
    reptile_ids = [row[0] for row in reptile_result.fetchall()]

    if not reptile_ids:
        return []

    # Get all configs for those reptiles
    result = await db.execute(
        select(ChangeAlertConfig).where(
            ChangeAlertConfig.reptile_id.in_(reptile_ids)
        )
    )
    configs = result.scalars().all()

    return [ChangeAlertConfigResponse.model_validate(c) for c in configs]


# ---- Reptile-Specific Config Endpoints ----

@router.get("/reptile/{reptile_id}", response_model=ReptileAlertSummary)
async def get_reptile_alerts(
    reptile_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all change alert configs for a reptile with effective settings."""
    reptile = await verify_reptile_access(db, current_user, reptile_id)

    # Get all configs for this reptile
    result = await db.execute(
        select(ChangeAlertConfig)
        .where(ChangeAlertConfig.reptile_id == reptile_id)
        .order_by(ChangeAlertConfig.alert_type)
    )
    configs = result.scalars().all()

    # Get global settings for effective calculation
    settings_result = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == current_user.id)
    )
    global_settings = settings_result.scalar_one_or_none()

    # Calculate effective settings
    effective_feeding = None
    effective_measurements = {}

    # Find feeding config
    feeding_config = next((c for c in configs if c.alert_type == "feeding"), None)
    if feeding_config or (global_settings and global_settings.feeding_alert_enabled):
        effective_feeding = {
            "enabled": feeding_config.enabled if feeding_config else global_settings.feeding_alert_enabled,
            "window_days": (
                feeding_config.window_days if feeding_config and feeding_config.window_days
                else global_settings.feeding_alert_window_days if global_settings
                else 14
            ),
            "threshold_percent": (
                feeding_config.threshold_increase if feeding_config and feeding_config.threshold_increase
                else global_settings.feeding_alert_threshold_percent if global_settings
                else 30
            ),
            "cooldown_days": (
                feeding_config.cooldown_days if feeding_config and feeding_config.cooldown_days is not None
                else global_settings.feeding_alert_cooldown_days if global_settings
                else 7
            ),
        }

    # Find measurement configs
    for config in configs:
        if config.alert_type.startswith("measurement_"):
            measurement_type = config.alert_type.replace("measurement_", "")
            effective_measurements[measurement_type] = {
                "enabled": config.enabled,
                "threshold_type": config.threshold_type,
                "threshold_increase": config.threshold_increase,
                "threshold_decrease": config.threshold_decrease,
                "rolling_average_window": config.rolling_average_window,
                "cooldown_days": config.cooldown_days,
            }

    return ReptileAlertSummary(
        reptile_id=reptile_id,
        reptile_name=reptile.name,
        configs=[ChangeAlertConfigResponse.model_validate(c) for c in configs],
        effective_feeding=effective_feeding,
        effective_measurements=effective_measurements,
    )


@router.post("/reptile/{reptile_id}", response_model=ChangeAlertConfigResponse)
async def create_reptile_alert_config(
    reptile_id: int,
    config: ChangeAlertConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new change alert config for a reptile."""
    await verify_reptile_access(db, current_user, reptile_id, AccessLevel.CARETAKER)

    # Check if config already exists for this type
    existing = await db.execute(
        select(ChangeAlertConfig)
        .where(
            and_(
                ChangeAlertConfig.reptile_id == reptile_id,
                ChangeAlertConfig.alert_type == config.alert_type
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"Config for alert type '{config.alert_type}' already exists"
        )

    new_config = ChangeAlertConfig(
        reptile_id=reptile_id,
        **config.model_dump(exclude={"reptile_id"})
    )
    db.add(new_config)
    await db.commit()
    await db.refresh(new_config)

    return ChangeAlertConfigResponse.model_validate(new_config)


@router.patch("/reptile/{reptile_id}/{alert_type}", response_model=ChangeAlertConfigResponse)
async def update_reptile_alert_config(
    reptile_id: int,
    alert_type: str,
    updates: ChangeAlertConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a change alert config for a reptile. Creates if doesn't exist."""
    await verify_reptile_access(db, current_user, reptile_id, AccessLevel.CARETAKER)

    result = await db.execute(
        select(ChangeAlertConfig)
        .where(
            and_(
                ChangeAlertConfig.reptile_id == reptile_id,
                ChangeAlertConfig.alert_type == alert_type
            )
        )
    )
    config = result.scalar_one_or_none()

    if not config:
        # Create new config with updates
        config = ChangeAlertConfig(
            reptile_id=reptile_id,
            alert_type=alert_type,
            **updates.model_dump(exclude_unset=True)
        )
        db.add(config)
    else:
        # Apply updates
        update_data = updates.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(config, field, value)

    await db.commit()
    await db.refresh(config)

    return ChangeAlertConfigResponse.model_validate(config)


@router.delete("/reptile/{reptile_id}/{alert_type}")
async def delete_reptile_alert_config(
    reptile_id: int,
    alert_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a change alert config (reverts to global defaults)."""
    await verify_reptile_access(db, current_user, reptile_id, AccessLevel.CARETAKER)

    result = await db.execute(
        delete(ChangeAlertConfig)
        .where(
            and_(
                ChangeAlertConfig.reptile_id == reptile_id,
                ChangeAlertConfig.alert_type == alert_type
            )
        )
    )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Config not found")

    await db.commit()
    return {"status": "deleted"}


# ---- Species Presets Endpoints ----

@router.get("/presets", response_model=List[SpeciesPreset])
async def get_species_presets():
    """Get all available species presets."""
    return list(SPECIES_PRESETS.values())


@router.post("/presets/apply")
async def apply_species_preset(
    request: ApplyPresetRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Apply a species preset to a reptile (creates/updates configs)."""
    reptile = await verify_reptile_access(db, current_user, request.reptile_id, AccessLevel.CARETAKER)

    preset = SPECIES_PRESETS.get(request.preset_id)
    if not preset:
        raise HTTPException(status_code=404, detail=f"Preset '{request.preset_id}' not found")

    # Delete existing configs for this reptile
    await db.execute(
        delete(ChangeAlertConfig)
        .where(ChangeAlertConfig.reptile_id == request.reptile_id)
    )

    # Create new configs from preset
    created_configs = []
    for alert_type, settings in preset.alerts.items():
        if settings.get("enabled", True):  # Only create if enabled
            config = ChangeAlertConfig(
                reptile_id=request.reptile_id,
                alert_type=alert_type,
                enabled=settings.get("enabled", True),
                cooldown_days=settings.get("cooldown_days"),
                threshold_type=settings.get("threshold_type", "percentage"),
                threshold_increase=settings.get("threshold_increase"),
                threshold_decrease=settings.get("threshold_decrease"),
                window_days=settings.get("window_days"),
                rolling_average_window=settings.get("rolling_average_window"),
            )
            db.add(config)
            created_configs.append(alert_type)

    await db.commit()

    return {
        "status": "applied",
        "preset": preset.name,
        "reptile": reptile.name,
        "configs_created": created_configs,
    }


@router.post("/presets/bulk-apply", response_model=BulkOperationResult)
async def bulk_apply_presets(
    request: BulkApplyPresetRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Apply auto-matched species presets to multiple reptiles.

    Used by activation wizard to enable alerts for multiple reptiles at once.
    """
    results = []
    success_count = 0

    for reptile_id in request.reptile_ids:
        try:
            # Verify access
            reptile = await verify_reptile_access(db, current_user, reptile_id)

            # Auto-match preset
            preset_id = auto_match_preset(reptile.species, reptile.age_category)

            if not preset_id:
                results.append({
                    "reptile_id": reptile_id,
                    "reptile_name": reptile.name,
                    "status": "skipped",
                    "reason": "No matching preset found"
                })
                continue

            preset = SPECIES_PRESETS[preset_id]

            # Delete existing configs
            await db.execute(
                delete(ChangeAlertConfig).where(ChangeAlertConfig.reptile_id == reptile_id)
            )

            # Create new configs based on requested alert types
            created_alerts = []
            for alert_type, settings in preset.alerts.items():
                # Check if this alert type was requested
                should_create = False
                if alert_type == "feeding" and request.alert_types.get("feeding", False):
                    should_create = True
                elif alert_type == "weight" and request.alert_types.get("weight", False):
                    should_create = True
                elif alert_type.startswith("measurement_") and request.alert_types.get("measurements", False):
                    should_create = True

                if should_create and settings.get("enabled", True):
                    config = ChangeAlertConfig(
                        reptile_id=reptile_id,
                        alert_type=alert_type,
                        enabled=settings.get("enabled", True),
                        cooldown_days=settings.get("cooldown_days"),
                        threshold_type=settings.get("threshold_type", "percentage"),
                        threshold_increase=settings.get("threshold_increase"),
                        threshold_decrease=settings.get("threshold_decrease"),
                        window_days=settings.get("window_days"),
                        rolling_average_window=settings.get("rolling_average_window"),
                    )
                    db.add(config)
                    created_alerts.append(alert_type)

            results.append({
                "reptile_id": reptile_id,
                "reptile_name": reptile.name,
                "status": "success",
                "preset_applied": preset.name,
                "alerts_created": created_alerts
            })
            success_count += 1

        except HTTPException as e:
            results.append({
                "reptile_id": reptile_id,
                "status": "error",
                "reason": e.detail
            })

    await db.commit()

    return BulkOperationResult(
        success_count=success_count,
        results=results
    )


@router.post("/bulk-update", response_model=BulkOperationResult)
async def bulk_update_configs(
    request: BulkUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Bulk update alert settings across multiple reptiles.

    Replaces "global edit" - allows applying same settings to multiple reptiles.
    """
    # Get reptile IDs to update
    if request.reptile_ids == "all":
        # Get all reptiles user has access to
        result = await db.execute(
            select(Reptile.id)
            .join(reptile_access, Reptile.id == reptile_access.c.reptile_id)
            .where(reptile_access.c.user_id == current_user.id)
        )
        reptile_ids = [row[0] for row in result.fetchall()]
    else:
        reptile_ids = request.reptile_ids

    results = []
    success_count = 0

    for reptile_id in reptile_ids:
        try:
            # Verify access
            reptile = await verify_reptile_access(db, current_user, reptile_id)

            updated_count = 0
            for alert_type in request.alert_types:
                # Find or create config
                result = await db.execute(
                    select(ChangeAlertConfig).where(
                        and_(
                            ChangeAlertConfig.reptile_id == reptile_id,
                            ChangeAlertConfig.alert_type == alert_type
                        )
                    )
                )
                config = result.scalar_one_or_none()

                if not config:
                    # Create new config
                    config = ChangeAlertConfig(
                        reptile_id=reptile_id,
                        alert_type=alert_type
                    )
                    db.add(config)

                # Apply updates
                for key, value in request.settings.items():
                    if hasattr(config, key):
                        setattr(config, key, value)
                        updated_count += 1

            results.append({
                "reptile_id": reptile_id,
                "reptile_name": reptile.name,
                "status": "success",
                "updated_count": updated_count
            })
            success_count += 1

        except HTTPException as e:
            results.append({
                "reptile_id": reptile_id,
                "status": "error",
                "reason": e.detail
            })

    await db.commit()

    return BulkOperationResult(
        success_count=success_count,
        results=results
    )
