# Reptile Tracker

A comprehensive web application for tracking reptile feeding schedules, weight, health records, and nutritional data.

## Features

### Core Functionality
- 🦎 **Multi-Reptile Management**: Track multiple reptiles with individual profiles
- 🍽️ **Feeding Log**: Easy-to-use interface with +/- buttons for quick counting
- 📊 **Weight Tracking**: Monitor weight trends with graphical visualization
- 🏥 **Health Records**: Track vet visits, medication, and observations
- 📅 **Feeding Schedule**: Customizable reminders and calendar views
- 🔔 **Notifications**: Webhook support for Discord/Pushover notifications
- 📈 **Statistics**: Daily/weekly summaries and per-reptile analytics

### Access Control
- **Owner**: Full access to reptile management and settings
- **Feeder**: Can log feedings, view history, and add weight logs
- **Viewer**: Read-only access to feeding logs

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
- `GET /api/reptiles` - List all reptiles
- `POST /api/reptiles` - Create reptile
- `GET /api/reptiles/{id}` - Get reptile details
- `PATCH /api/reptiles/{id}` - Update reptile
- `DELETE /api/reptiles/{id}` - Delete reptile
- `POST /api/reptiles/{id}/grant-access` - Grant user access
- `DELETE /api/reptiles/{id}/revoke-access/{user_id}` - Revoke access

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

### Statistics
- `GET /api/stats/daily-summary` - Daily feeding summary
- `GET /api/stats/weekly-summary` - Weekly feeding summary
- `GET /api/stats/reptile/{id}` - Reptile statistics

## Frontend Status

### ✅ Implemented Components
1. **Dashboard**: Overview with recent feedings and reptile list
2. **ReptileList**: Grid view with edit/delete functionality
3. **ReptileDetail**: Tabbed view (feedings, weight, health) with WeightChart
4. **ReptileForm**: Create/edit forms with date_of_birth and notes
5. **FeedingLog**: Complete feeding interface with +/- counter and salad picker
6. **Layout**: Modern sidebar navigation with dark mode toggle
7. **WeightChart**: Line chart using Recharts for weight trends
8. **Dark Mode**: Full support with localStorage persistence

### ❌ To Be Implemented
1. **Calendar**: Calendar view of feeding schedule (using react-calendar)
2. **Statistics**: Dedicated analytics and reports page
3. **Notifications**: Webhook settings and configuration
4. **PWA**: Service worker and offline support

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
