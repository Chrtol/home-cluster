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
    """Generate realistic sample data for digest template preview with multiple reptiles."""
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
            'emoji': '\U0001F4A8'  # dash symbol (misting)
        },
        {
            'reptile_name': 'Draco',
            'schedule_name': 'Weight Check',
            'schedule_type': 'weighing',
            'time_window': 'Any time',
            'emoji': '\u2696\uFE0F'  # balance scale
        },
        {
            'reptile_name': 'Draco',
            'schedule_name': 'Supplements',
            'schedule_type': 'health',
            'time_window': '',
            'emoji': '\U0001F48A'  # pill
        },
        {
            'reptile_name': 'Smaug',
            'schedule_name': 'Evening Feeding',
            'schedule_type': 'feeding',
            'time_window': '18:00-20:00',
            'emoji': '\U0001F37D\uFE0F'
        }
    ]

    tasks_by_reptile = {
        'Luna': sample_tasks[:2],
        'Draco': sample_tasks[2:4],
        'Smaug': sample_tasks[4:]
    }

    overdue_tasks = [
        {
            'reptile_name': 'Luna',
            'schedule_name': 'Feeding (yesterday)',
            'schedule_type': 'feeding',
            'time_window': '',
            'emoji': '\U0001F37D\uFE0F'
        }
    ]

    context = {
        'tasks_by_reptile': tasks_by_reptile,
        'all_tasks': sample_tasks,
        'overdue_tasks': overdue_tasks,
        'date': 'Monday, February 17',
        'task_count': len(sample_tasks),
        'overdue_count': len(overdue_tasks),
        'app_url': 'https://example.com/dashboard'
    }

    if trigger_type == 'weekly_planner':
        context['start_date'] = 'February 17'
        context['end_date'] = 'February 23'
        context['days'] = [
            {'date': 'Monday, February 17', 'tasks': sample_tasks[:3]},
            {'date': 'Tuesday, February 18', 'tasks': [sample_tasks[3]]},
            {'date': 'Wednesday, February 19', 'tasks': []},
            {'date': 'Thursday, February 20', 'tasks': sample_tasks[0:2]},
            {'date': 'Friday, February 21', 'tasks': [sample_tasks[4]]},
            {'date': 'Saturday, February 22', 'tasks': []},
            {'date': 'Sunday, February 23', 'tasks': [sample_tasks[2]]}
        ]

    return context


def build_digest_preview_message(
    template: NotificationTemplate,
    sample_context: dict,
    trigger_type: str
) -> str:
    """Build preview digest exactly as digest.py would, respecting format options."""
    from app.notifications import render_template

    # Read format options (default to True for backward compat)
    group_by_reptile = template.group_by_reptile if template.group_by_reptile is not None else True
    show_time_windows = template.show_time_windows if template.show_time_windows is not None else True
    include_overdue = template.include_overdue if template.include_overdue is not None else True
    include_app_link = template.include_app_link if template.include_app_link is not None else True

    message_parts = []
    message_template = template.message_template_short or template.message_template

    if trigger_type == "daily_planner":
        # Daily digest preview
        if group_by_reptile:
            for reptile_name, tasks in sample_context['tasks_by_reptile'].items():
                message_parts.append(f"**{reptile_name}**")
                for task in tasks:
                    line = build_task_line_preview(message_template, task, show_time_windows)
                    message_parts.append(f"  {line}")
                message_parts.append("")
        else:
            for task in sample_context['all_tasks']:
                line = build_task_line_preview(message_template, task, show_time_windows)
                message_parts.append(line)

        if not sample_context['all_tasks']:
            message_parts.append("*No tasks scheduled for today*")

        # Overdue section
        if include_overdue and sample_context.get('overdue_tasks'):
            if sample_context['all_tasks']:
                message_parts.append("")
            message_parts.append("**Overdue:**")
            for task in sample_context['overdue_tasks']:
                line = build_task_line_preview(message_template, task, show_time_windows)
                message_parts.append(f"  {line}")

        # App link
        if include_app_link:
            message_parts.append("")
            message_parts.append(f"[View in app]({sample_context['app_url']})")

    elif trigger_type == "weekly_planner":
        # Weekly digest preview
        has_tasks = False
        for day in sample_context.get('days', []):
            if day['tasks']:
                has_tasks = True
                message_parts.append(f"**{day['date']}**")

                if group_by_reptile:
                    # Group tasks by reptile within day
                    tasks_by_reptile = {}
                    for task in day['tasks']:
                        reptile_name = task['reptile_name']
                        if reptile_name not in tasks_by_reptile:
                            tasks_by_reptile[reptile_name] = []
                        tasks_by_reptile[reptile_name].append(task)

                    for reptile_name, tasks in tasks_by_reptile.items():
                        message_parts.append(f"  **{reptile_name}**")
                        for task in tasks:
                            line = build_task_line_preview(message_template, task, show_time_windows)
                            message_parts.append(f"    {line}")
                else:
                    for task in day['tasks']:
                        line = build_task_line_preview(message_template, task, show_time_windows)
                        message_parts.append(f"  {line}")

                message_parts.append("")  # Blank line between days

        if not has_tasks:
            message_parts.append("*No tasks scheduled for the next week*")

        # App link
        if include_app_link:
            if has_tasks:
                message_parts.append("")
            message_parts.append(f"[View in app]({sample_context['app_url']})")

    return "\n".join(message_parts)


def build_task_line_preview(message_template: str, task: dict, show_time_windows: bool) -> str:
    """Build a single task line for preview using template format."""
    from app.notifications import render_template

    # Add time_window_display field for optional time window
    if show_time_windows and task.get('time_window'):
        task['time_window_display'] = f" ({task['time_window']})"
    else:
        task['time_window_display'] = ""

    if not message_template:
        # Fallback format if no template
        return f"{task.get('emoji', '')} {task['reptile_name']}: {task['schedule_name']}{task['time_window_display']}"

    return render_template(message_template, task, use_jinja=False)


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
    template_obj = None
    if template_id:
        result = await db.execute(
            select(NotificationTemplate).where(
                NotificationTemplate.id == template_id
            )
        )
        template_obj = result.scalars().first()
        if not template_obj:
            raise HTTPException(status_code=404, detail="Template not found")

        # Check access
        if template_obj.user_id is not None and template_obj.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        message_template = template_obj.message_template
        title_template = template_obj.title_template
        trigger_type = template_obj.trigger_type

    if not message_template or not trigger_type:
        raise HTTPException(
            status_code=400,
            detail="Must provide either template_id or (message_template + trigger_type)"
        )

    # Generate sample context based on trigger type
    if trigger_type in ["daily_planner", "weekly_planner"]:
        # Build full digest using code-based iteration (respecting format options)
        context = generate_sample_digest_context(trigger_type)

        if template_obj:
            # Use template object with format options
            rendered_message = build_digest_preview_message(template_obj, context, trigger_type)
        else:
            # Draft template (no format options available)
            # Create temporary template object with defaults
            temp_template = NotificationTemplate(
                message_template=message_template,
                message_template_short=message_template,
                title_template=title_template,
                group_by_reptile=True,
                show_time_windows=True,
                include_overdue=True,
                include_app_link=True
            )
            rendered_message = build_digest_preview_message(temp_template, context, trigger_type)

        # Render title
        if trigger_type == "daily_planner":
            rendered_title = f"Daily Planner - {context['date']}"
            if title_template:
                rendered_title = render_template(title_template, {"date": context['date']}, use_jinja=False)
        else:  # weekly_planner
            rendered_title = f"Weekly Planner - {context['start_date']} to {context['end_date']}"
            if title_template:
                rendered_title = render_template(title_template, {
                    "start_date": context['start_date'],
                    "end_date": context['end_date']
                }, use_jinja=False)
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

    # render_template sanitizes its own errors, but guard the response boundary so no
    # internal exception detail (stack trace / error message) can ever be reflected back.
    if not isinstance(rendered_message, str):
        raise HTTPException(status_code=400, detail="Unable to render template preview")

    return {
        "rendered_message": rendered_message,
        "rendered_title": rendered_title,
        "sample_context": context
    }
