from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List

from app.database import get_db
from app.models import NotificationTemplate, User
from app.auth import get_current_user
from app.schemas import (
    NotificationTemplate as NotificationTemplateSchema,
    NotificationTemplateCreate,
    NotificationTemplateUpdate
)

router = APIRouter(prefix="/api/notification-templates", tags=["notification-templates"])


@router.get("/", response_model=List[NotificationTemplateSchema])
async def list_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all available templates (system templates + user's custom templates)
    """
    result = await db.execute(
        select(NotificationTemplate).where(
            or_(
                NotificationTemplate.user_id == current_user.id,
                NotificationTemplate.user_id.is_(None)  # System templates
            )
        ).order_by(
            NotificationTemplate.template_type.desc(),  # System templates first
            NotificationTemplate.trigger_type,
            NotificationTemplate.name
        )
    )
    templates = result.scalars().all()
    return templates


@router.get("/{template_id}", response_model=NotificationTemplateSchema)
async def get_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific template"""
    result = await db.execute(
        select(NotificationTemplate).where(
            NotificationTemplate.id == template_id
        )
    )
    template = result.scalars().first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Check access: user can only access their own templates or system templates
    if template.user_id is not None and template.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return template


@router.post("/", response_model=NotificationTemplateSchema)
async def create_template(
    template_data: NotificationTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new custom template"""
    # Validate reptile_id and schedule_id if provided
    if template_data.reptile_id:
        from app.models import Reptile
        from app.permissions import check_reptile_access
        try:
            await check_reptile_access(db, current_user, template_data.reptile_id)
        except:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this reptile"
            )

    if template_data.schedule_id:
        from app.models import Schedule
        result = await db.execute(
            select(Schedule).where(Schedule.id == template_data.schedule_id)
        )
        schedule = result.scalars().first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")

        # Verify user has access to the schedule's reptile
        from app.permissions import check_reptile_access
        try:
            await check_reptile_access(db, current_user, schedule.reptile_id)
        except:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this schedule's reptile"
            )

    # Create new template (always custom type for user-created templates)
    template = NotificationTemplate(
        user_id=current_user.id,
        template_type="custom",
        **template_data.model_dump()
    )

    db.add(template)
    await db.commit()
    await db.refresh(template)

    return template


@router.patch("/{template_id}", response_model=NotificationTemplateSchema)
async def update_template(
    template_id: int,
    template_data: NotificationTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a custom template"""
    result = await db.execute(
        select(NotificationTemplate).where(
            NotificationTemplate.id == template_id
        )
    )
    template = result.scalars().first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Only allow updating user's own custom templates
    if template.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Cannot modify system templates or other users' templates"
        )

    # Validate reptile_id and schedule_id if being updated
    update_data = template_data.model_dump(exclude_unset=True)

    if "reptile_id" in update_data and update_data["reptile_id"]:
        from app.models import Reptile
        from app.permissions import check_reptile_access
        try:
            await check_reptile_access(db, current_user, update_data["reptile_id"])
        except:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this reptile"
            )

    if "schedule_id" in update_data and update_data["schedule_id"]:
        from app.models import Schedule
        result = await db.execute(
            select(Schedule).where(Schedule.id == update_data["schedule_id"])
        )
        schedule = result.scalars().first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")

        # Verify user has access to the schedule's reptile
        from app.permissions import check_reptile_access
        try:
            await check_reptile_access(db, current_user, schedule.reptile_id)
        except:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this schedule's reptile"
            )

    # Update fields
    for key, value in update_data.items():
        setattr(template, key, value)

    await db.commit()
    await db.refresh(template)

    return template


@router.post("/{template_id}/copy", response_model=NotificationTemplateSchema)
async def copy_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Copy a system template to create a custom user template.
    This allows users to customize system templates.
    """
    # Get the template to copy
    result = await db.execute(
        select(NotificationTemplate).where(
            NotificationTemplate.id == template_id
        )
    )
    source_template = result.scalars().first()

    if not source_template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Create copy (removed duplicate check - users can now have multiple templates)
    new_template = NotificationTemplate(
        user_id=current_user.id,
        name=f"{source_template.name} (Custom)",
        template_type="custom",
        trigger_type=source_template.trigger_type,
        message_template=source_template.message_template,
        title_template=source_template.title_template,
        channel_type=source_template.channel_type,
        is_active=True
    )

    db.add(new_template)
    await db.commit()
    await db.refresh(new_template)

    return new_template


@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a custom template"""
    result = await db.execute(
        select(NotificationTemplate).where(
            NotificationTemplate.id == template_id
        )
    )
    template = result.scalars().first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Only allow deleting user's own custom templates
    if template.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Cannot delete system templates or other users' templates"
        )

    await db.delete(template)
    await db.commit()

    return {"message": "Template deleted successfully"}


@router.post("/validate-context")
async def validate_template_context(
    trigger_type: str,
    channel_type: str = None,
    reptile_id: int = None,
    schedule_id: int = None,
    food_category: str = None,
    schedule_type: str = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Show which template would be used for given context.
    Useful for preview/debugging when creating templates with filters.
    """
    from app.notifications import get_template_for_trigger

    context = {}
    if reptile_id:
        context["reptile_id"] = reptile_id
    if schedule_id:
        context["schedule_id"] = schedule_id
    if food_category:
        context["food_category"] = food_category
    if schedule_type:
        context["schedule_type"] = schedule_type

    template = await get_template_for_trigger(
        db=db,
        trigger_type=trigger_type,
        user_id=current_user.id,
        channel_type=channel_type,
        context=context if context else None
    )

    if template:
        # Determine specificity level
        specificity = []
        if template.schedule_id:
            specificity.append(f"schedule-specific (ID: {template.schedule_id})")
        if template.reptile_id:
            specificity.append(f"reptile-specific (ID: {template.reptile_id})")
        if template.food_category_filter:
            specificity.append(f"food category: {template.food_category_filter}")
        if template.schedule_type_filter:
            specificity.append(f"schedule type: {template.schedule_type_filter}")
        if not specificity:
            specificity.append("generic (no filters)")

        return {
            "template_id": template.id,
            "template_name": template.name,
            "template_type": template.template_type,
            "specificity": ", ".join(specificity),
            "priority": template.priority,
            "matched": True
        }
    else:
        return {
            "template_id": None,
            "template_name": None,
            "template_type": None,
            "specificity": None,
            "priority": None,
            "matched": False
        }


def generate_sample_digest_context(trigger_type: str) -> dict:
    """Generate realistic sample data for digest template preview."""
    sample_tasks = [
        {
            'reptile_name': 'Luna',
            'schedule_name': 'Morning Feeding',
            'schedule_type': 'feeding',
            'time_window': '08:00-10:00',
            'emoji': '\U0001F37D\uFE0F'  # plate with cutlery
        },
        {
            'reptile_name': 'Luna',
            'schedule_name': 'Misting',
            'schedule_type': 'misting',
            'time_window': '14:00-16:00',
            'emoji': '\U0001F4A7'  # droplet
        },
        {
            'reptile_name': 'Rex',
            'schedule_name': 'Weight Check',
            'schedule_type': 'weighing',
            'time_window': '',
            'emoji': '\u2696\uFE0F'  # balance scale
        }
    ]

    tasks_by_reptile = {
        'Luna': sample_tasks[:2],
        'Rex': sample_tasks[2:]
    }

    context = {
        'tasks_by_reptile': tasks_by_reptile,
        'all_tasks': sample_tasks,
        'overdue_tasks': [],
        'date': 'Monday, February 16',
        'task_count': len(sample_tasks),
        'overdue_count': 0,
        'app_url': 'https://example.com/dashboard'
    }

    if trigger_type == 'weekly_planner':
        context['start_date'] = 'February 16'
        context['end_date'] = 'February 22'
        context['days'] = [
            {'date': 'Monday, February 16', 'tasks': sample_tasks[:2]},
            {'date': 'Tuesday, February 17', 'tasks': [sample_tasks[2]]},
            {'date': 'Wednesday, February 18', 'tasks': []},
            {'date': 'Thursday, February 19', 'tasks': [sample_tasks[0]]},
            {'date': 'Friday, February 20', 'tasks': []},
            {'date': 'Saturday, February 21', 'tasks': [sample_tasks[1]]},
            {'date': 'Sunday, February 22', 'tasks': []}
        ]

    return context


@router.post("/preview")
async def preview_template(
    template_id: int = None,
    message_template: str = None,
    title_template: str = None,
    trigger_type: str = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Preview a template with sample data.
    Can preview an existing template (by ID) or a draft template (by providing strings).
    """
    from app.notifications import render_template

    # Get template (either from ID or from provided strings)
    if template_id:
        result = await db.execute(
            select(NotificationTemplate).where(
                NotificationTemplate.id == template_id
            )
        )
        template = result.scalars().first()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        # Check access
        if template.user_id is not None and template.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        message_template = template.message_template
        title_template = template.title_template
        trigger_type = template.trigger_type

    if not message_template or not trigger_type:
        raise HTTPException(
            status_code=400,
            detail="Must provide either template_id or (message_template + trigger_type)"
        )

    # Generate sample context based on trigger type
    if trigger_type in ["daily_planner", "weekly_planner"]:
        # Use Jinja2 for digest templates
        context = generate_sample_digest_context(trigger_type)
        rendered_message = render_template(message_template, context, use_jinja=True)
        rendered_title = render_template(title_template or "", context, use_jinja=True) if title_template else None
    else:
        # Use format_map for other templates (existing behavior)
        # Generate sample context for regular templates
        context = {
            'reptile_name': 'Luna',
            'schedule_name': 'Morning Feeding',
            'schedule_type': 'feeding',
            'scheduled_date': 'Monday, February 16',
            'time_window': '08:00-10:00',
            'notes': 'Remember to dust with calcium',
            'emoji': '\U0001F37D\uFE0F'
        }
        rendered_message = render_template(message_template, context, use_jinja=False)
        rendered_title = render_template(title_template or "", context, use_jinja=False) if title_template else None

    return {
        "rendered_message": rendered_message,
        "rendered_title": rendered_title,
        "sample_context": context
    }
