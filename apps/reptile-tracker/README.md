# Reptile Tracker

A comprehensive web application for tracking reptile feeding schedules, weight, health records, and nutritional data.

## Features

### Core Functionality
- 🦎 **Multi-Reptile Management**: Track multiple reptiles with individual profiles
- 🏠 **Household Organization**: Group reptiles by household with filtering
- 👁️ **Hide/Archive Reptiles**: Non-destructive hiding of inactive reptiles
- 🍽️ **Feeding Log**: Easy-to-use interface with +/- buttons for quick counting
- 📊 **Weight Tracking**: Monitor weight trends with graphical visualization and interpolation
- 🏥 **Health Records**: Track vet visits, medication, and observations
- 📅 **Feeding Schedule**: Advanced scheduling with time windows and reminders
- 🔄 **Supplement Rotations**: Automated rotation schedules for supplements and foods
- 🔔 **Notifications**: Webhook support for Discord/Pushover notifications
- 📈 **Statistics**: Comprehensive analytics with customizable charts and layouts
- ⚙️ **Display Customization**: Drag-and-drop card management and chart settings

### Multi-User & Household System
- **Households**: Organize reptiles into households with shared access
- **Household Roles**: Owner, Admin, Manager, Caretaker, Viewer
- **Invitations**: Invite users to join your household
- **Per-Reptile Access**: Grant specific users direct access to individual reptiles
- **Access Levels**: Hierarchical permissions (Owner > Admin > Manager > Caretaker > Viewer)

### Authentication
- OIDC integration with Authentik
- Secure JWT-based authentication
- Multi-user support with granular permissions

## Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL with AsyncPG
- **ORM**: SQLAlchemy 2.0 (async)
- **Authentication**: OIDC (Authlib) + JWT
- **API Documentation**: OpenAPI/Swagger

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Routing**: React Router v6

## Project Structure

```
apps/reptile-tracker/
├── backend/
│   ├── app/
│   │   ├── routers/        # API endpoints
│   │   ├── models.py       # SQLAlchemy models
│   │   ├── schemas.py      # Pydantic schemas
│   │   ├── auth.py         # Authentication
│   │   ├── permissions.py  # Access control
│   │   ├── notifications.py # Webhook notifications
│   │   ├── seed_data.py    # Default foods/supplements
│   │   ├── database.py     # Database setup
│   │   ├── config.py       # Configuration
│   │   └── main.py         # FastAPI app
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   ├── hooks/          # Custom React hooks
│   │   ├── utils/          # Utility functions
│   │   ├── App.jsx         # Main app component
│   │   └── main.jsx        # Entry point
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
└── README.md
```

## Default Data

### Food Types
**Insects** (with sizes: small, medium, large):
- Crickets
- Dubia Cockroaches
- Mealworms
- Zoophobas

**Salad Components** (Norwegian):
- Hjertesalat (Lettuce)
- Ruccola (Arugula)
- Grønnkål (Kale)
- Gulrot (Carrot)
- Paprika (Bell Pepper)
- Snackspaprika (Mini Bell Pepper)
- Gulrottopper (Carrot Tops)
- Squash

**Fruits**:
- Banana

**Prepared Foods**:
- Crested Gecko Food

### Supplements
- Calcium with D3
- Calcium without D3
- Multivitamin

All foods and supplements include nutritional data (protein, fat, calcium, phosphorus, vitamins, etc.)

## Development

### Backend Setup

```bash
cd apps/reptile-tracker/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run migrations (if using Alembic)
alembic upgrade head

# Seed database with default data
python -c "import asyncio; from app.database import async_session_maker; from app.seed_data import seed_database; asyncio.run(seed_database(async_session_maker()))"

# Run development server
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`
- API Documentation: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Frontend Setup

```bash
cd apps/reptile-tracker/frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API URL

# Run development server
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Building Docker Images

```bash
## Container startup and migrations

The backend image now runs Alembic migrations automatically on container start (if `alembic` is available in the image). The container entrypoint runs:

- `alembic -c migrations/alembic.ini upgrade head` (attempted; skipped if alembic not present)

This keeps the database schema up-to-date on startup. If you prefer to run migrations in CI/CD instead, adjust your deployment to run Alembic before starting the application process.
# Backend
cd apps/reptile-tracker/backend
docker build -t ghcr.io/chrtol/reptile-tracker-backend:latest .

# Frontend
cd apps/reptile-tracker/frontend
docker build -t ghcr.io/chrtol/reptile-tracker-frontend:latest .
```

## Kubernetes Deployment

The application is deployed to Kubernetes using Flux CD. See `/kubernetes/apps/reptile-tracker/` for manifests.

### Required Resources
- PostgreSQL database (CloudNative-PG)
- Secrets for OIDC configuration
- Ingress for external access
- Persistent storage for database

### Environment Variables

**Backend**:
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: JWT signing key
- `OIDC_CLIENT_ID`: Authentik client ID
- `OIDC_CLIENT_SECRET`: Authentik client secret
- `OIDC_DISCOVERY_URL`: Authentik OIDC discovery URL
- `OIDC_REDIRECT_URI`: OAuth callback URL
- `FRONTEND_URL`: Frontend URL for CORS

**Frontend**:
- `VITE_API_URL`: Backend API URL

## API Endpoints

### Authentication
- `GET /auth/login` - Initiate OIDC login
- `GET /auth/callback` - OIDC callback handler
- `GET /auth/me` - Get current user
- `POST /auth/logout` - Logout

### Reptiles
- `GET /api/reptiles` - List all reptiles (with household info, filters inactive by default)
  - Query param: `include_inactive=true` to show hidden reptiles
- `POST /api/reptiles` - Create reptile (auto-assigned to user's household)
- `GET /api/reptiles/{id}` - Get reptile details
- `PUT /api/reptiles/{id}` - Update reptile (including `is_active` for hiding)
- `DELETE /api/reptiles/{id}` - Delete reptile
- `POST /api/reptiles/{id}/grant-access` - Grant user access
- `DELETE /api/reptiles/{id}/revoke-access/{user_id}` - Revoke access

### Households
- `GET /api/households` - List user's households
- `POST /api/households` - Create household
- `GET /api/households/{id}` - Get household details
- `PUT /api/households/{id}` - Update household
- `DELETE /api/households/{id}` - Delete household
- `POST /api/households/{id}/invite` - Create invitation
- `GET /api/households/invitation/{code}` - Get invitation details
- `POST /api/households/accept-invitation` - Accept invitation
- `PUT /api/households/{id}/members/{user_id}` - Update member role
- `DELETE /api/households/{id}/members/{user_id}` - Remove member

### Feedings
- `GET /api/feedings` - List feedings
- `POST /api/feedings` - Log feeding
- `GET /api/feedings/{id}` - Get feeding details
- `DELETE /api/feedings/{id}` - Delete feeding
- `GET /api/feedings/reptile/{id}/last-feeding` - Get last feeding

### Foods & Supplements
- `GET /api/foods` - List all foods
- `POST /api/foods` - Create food type
- `GET /api/supplements` - List all supplements
- `POST /api/supplements` - Create supplement

### Weight Tracking
- `GET /api/weight/reptile/{id}` - List weight logs
- `POST /api/weight` - Log weight measurement
- `DELETE /api/weight/{id}` - Delete weight log

### Health Records
- `GET /api/health/reptile/{id}` - List health records
- `POST /api/health` - Create health record
- `PATCH /api/health/{id}` - Update health record
- `DELETE /api/health/{id}` - Delete health record

### Schedules
- `GET /api/schedules/reptile/{reptile_id}` - List schedules for a reptile
- `POST /api/schedules` - Create schedule
- `GET /api/schedules/{id}` - Get schedule details
- `PUT /api/schedules/{id}` - Update schedule
- `DELETE /api/schedules/{id}` - Delete schedule
- `GET /api/schedules/completions/date-range` - Get completions for date range
- `POST /api/schedules/completions/{completion_id}/complete` - Mark completion as complete
- `POST /api/schedules/completions/{completion_id}/skip` - Skip a scheduled occurrence

### Supplement Rotations
- `GET /api/rotations/reptile/{reptile_id}` - List rotations for a reptile
- `POST /api/rotations` - Create rotation
- `GET /api/rotations/{id}` - Get rotation details
- `PUT /api/rotations/{id}` - Update rotation
- `DELETE /api/rotations/{id}` - Delete rotation
- `POST /api/rotations/{id}/advance` - Manually advance rotation

### Misting Logs
- `GET /api/misting/reptile/{id}` - List misting logs
- `POST /api/misting` - Log misting
- `GET /api/misting/{id}` - Get misting details
- `PUT /api/misting/{id}` - Update misting log
- `DELETE /api/misting/{id}` - Delete misting log

### Statistics
- `GET /api/stats/daily-summary` - Daily feeding summary
- `GET /api/stats/weekly-summary` - Weekly feeding summary
- `GET /api/stats/reptile/{id}` - Reptile statistics

## Frontend Status

### ✅ Implemented Features

**Pages & Views:**
1. **Onboarding Wizard**: First-time user experience
   - Two-option interface: Join household or Create new household
   - Household code validation for joining
   - Mandatory before accessing main app
   - Automatic redirect to dashboard after completion
2. **Dashboard**: Overview with customizable cards (recent activity, weight chart, summary stats)
   - Drag-and-drop card reordering
   - Show/hide individual cards
   - Resize cards (XS/S/M/L)
   - Multi-reptile weight chart with interpolation and extrapolation
3. **ReptileList**: Grouped by household with filter toggles and hide/unhide functionality
   - Visual household sections with headers
   - Filter toggles to show/hide households (Eye/EyeOff icons)
   - Alphabetical sorting with "No Household" last
4. **ReptileDetail**: Comprehensive view with all reptile data
   - Feeding history with edit/delete
   - Weight tracking with inline chart
   - Health records with categories
   - Misting logs
   - Schedule management with completion tracking
   - Supplement rotation configuration
   - Hide/Unhide toggle button
5. **ReptileForm**: Create/edit forms with full reptile information
6. **FeedingLog**: Multi-reptile feeding interface
   - +/- counter for quick food quantity entry
   - Salad component picker with counts
   - Supplement tracking with rotation integration
   - Multi-reptile batch feeding
7. **Statistics**: Advanced analytics dashboard
   - Weight & feeding correlation chart with interpolation modes
   - Feeding activity heatmap (calendar-style)
   - Misting frequency tracking
   - Health events timeline
   - Summary cards (weight change, feeding count, etc.)
   - Customizable chart layouts (drag-and-drop)
   - Per-reptile custom layouts
   - Time range selector (7d, 30d, 90d, 180d, 365d, 730d)
   - Data type toggles (Weight, Feeding, Misting, Health)
   - Food filtering
8. **Calendar**: Schedule view with comprehensive filtering
   - Category filtering (Feeding, Misting, Weight, Health, Supplement)
   - Reptile filtering
   - Completion status indicators
   - Quick completion actions
9. **Settings**: Multi-tab configuration
   - Display: Card/chart management, interpolation modes, chart appearance
   - Date & Time: Format preferences, timezone, first day of week
   - Household: Member management, invitations, role assignment
10. **Health Logging**: Multiple log types with unified interface
   - Weight logs with read-only view
   - Feeding logs with food details
   - Misting logs with time-of-day tracking
   - Health events with categories and notes
   - Redirect to read-only view after creation

**Core Features:**
- **Household System**:
  - Multi-household support per user
  - Invitations with expiration and usage limits
  - Role-based access (Owner, Admin, Manager, Caretaker, Viewer)
  - Per-reptile direct access grants
  - Automatic household assignment for new reptiles
- **Schedules**:
  - Multiple schedule types (feeding, misting, weighing, supplement)
  - Schedule rules: every X days, days of week, monthly, dependent
  - Time windows with earliest/latest times
  - Reminders (minutes before scheduled time)
  - Completion tracking with status (pending, completed, missed, skipped)
  - Parent-child dependent schedules
  - Supplement rotation integration
- **Supplement Rotations**:
  - Rotation types: sequential, alternating, scheduled
  - Foods/supplements can be in multiple rotations
  - Trigger modes: manual, schedule-based, feeding-based
  - Exclusive mode (only rotate items, don't add others)
  - Rotation state tracking per reptile
- **Weight Interpolation**:
  - Linear interpolation between measurements
  - Step interpolation (flat line from last known)
  - None mode (dots only)
  - Forward/backward extrapolation with visual distinction
  - Per-chart interpolation mode settings
- **Display Customization**:
  - Drag-and-drop card management (Dashboard & Statistics)
  - Show/hide individual cards/charts
  - Resize (XS/S/M/L sizes)
  - Chart appearance settings (grid, legend, axis labels, height)
  - Per-reptile custom layouts
  - Export/import settings as JSON
  - Reset functionality
- **Activity Tracking**:
  - Comprehensive activity log with all actions
  - User attribution for multi-user households
  - Filtered views by reptile
  - Recent activity on Dashboard
- **Food Management**:
  - Food categories (Insects, Salad, Fruit, Prepared, Frozen)
  - Insect sizes (Small, Medium, Large)
  - Animal sizes (Pinkie, Fuzzy, Hopper, Small, Medium, Large)
  - Nutritional data tracking
  - Custom food creation
- **Dark Mode**: Full theme support with localStorage persistence
- **Mobile-First**: Responsive design optimized for one-handed feeding
- **Archive/Hide**: Non-destructive hiding of inactive reptiles

### 🚧 In Progress / Planned
1. **PWA**: Service worker and offline support
2. **Care Recommendations**: Species-based feeding and supplement guidelines
3. **Advanced Analytics**: Health trends, multi-reptile comparisons, cost analysis
4. **Export**: Chart image export (PNG/SVG/PDF)

### Mobile-First Design
- ✅ Responsive layout using Tailwind CSS
- ✅ Touch-friendly buttons (large tap targets)
- ✅ Optimized for one-handed use during feeding
- ❌ Progressive Web App (PWA) capabilities (planned)

## Webhook Notifications

### Discord
Send notifications to Discord channels:
```json
{
  "webhook_url": "https://discord.com/api/webhooks/...",
  "webhook_type": "discord"
}
```

### Pushover
Send push notifications via Pushover:
```json
{
  "webhook_url": "https://api.pushover.net/1/messages.json?token=TOKEN&user=USER",
  "webhook_type": "pushover"
}
```

### Generic Webhook
Send JSON payloads to any webhook URL:
```json
{
  "webhook_url": "https://your-webhook-url.com",
  "webhook_type": "generic"
}
```

## Contributing

This application is part of the home-cluster repository. To contribute:

1. Make changes in `apps/reptile-tracker/`
2. Test locally with Docker Compose or directly
3. Update Kubernetes manifests in `kubernetes/apps/reptile-tracker/`
4. Commit and push (Flux webhook will auto-deploy)

## License

This project is part of the home-cluster repository. See main repository for license information.

## Support

For issues or questions, please open an issue in the home-cluster repository.
