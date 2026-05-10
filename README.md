# JLU Marks Management System — Django Backend

A REST API backend for the JLU marks management schema, built with Django 4.2 + PostgreSQL + Django REST Framework.

---

## Stack
| Layer | Tech |
|---|---|
| Web framework | Django 4.2 |
| API | Django REST Framework |
| Auth | JWT via `djangorestframework-simplejwt` |
| Database | PostgreSQL (psycopg2) |
| Filtering | django-filter |
| Config | python-decouple |

---

## Quick Start

### 1. Clone & create virtual environment
```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Create PostgreSQL database
```sql
CREATE DATABASE jlu_marks_db;
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env with your DB credentials and a strong SECRET_KEY
```

### 4. Run migrations
```bash
python manage.py migrate
```

### 5. Seed demo data (optional)
```bash
python manage.py seed_demo
```
This creates:
- Admin   → `ADM001 / Admin@1234`
- Faculty → `FAC001 / Faculty@1234`
- Students → `STU001`, `STU002 / Student@1234`
- Course CS301, IA components, enrolments, and sample marks

### 6. Start the server
```bash
python manage.py runserver
```

---

## API Overview

Base URL: `http://localhost:8000/api/`

### Authentication
| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/login/` | POST | Get access + refresh tokens |
| `/api/auth/refresh/` | POST | Refresh access token |
| `/api/users/me/` | GET | Current user info |
| `/api/users/change_password/` | POST | Change password |

**Login request:**
```json
{ "jlu_id": "FAC001", "password": "Faculty@1234" }
```
Use the returned `access` token as: `Authorization: Bearer <token>`

### Resources
| Endpoint | Admin | Faculty | Student |
|---|---|---|---|
| `GET /api/faculty-of/` | ✓ | ✓ | ✓ |
| `POST /api/faculty-of/` | ✓ | — | — |
| `GET /api/schools/` | ✓ | ✓ | ✓ |
| `GET /api/programs/` | ✓ | ✓ | ✓ |
| `GET /api/faculty/` | ✓ | ✓ | ✓ |
| `POST /api/faculty/` | ✓ | — | — |
| `GET /api/students/` | ✓ | ✓ | ✓ |
| `POST /api/students/` | ✓ | — | — |
| `GET /api/ccr/` | ✓ | ✓ | ✓ |
| `POST /api/ccr/` | ✓ | — | — |
| `GET /api/enrolments/` | ✓ | ✓ | ✓ |
| `POST /api/enrolments/` | ✓ | ✓ | — |
| `GET /api/ia-components/` | ✓ | ✓ | ✓ |
| `POST /api/ia-components/` | ✓ | ✓ | — |
| `GET /api/marks/` | ✓ | ✓ | ✓ |
| `POST /api/marks/` | ✓ | ✓ | — |
| `POST /api/marks/bulk_enter/` | ✓ | ✓ | — |
| `GET /api/result-sheets/` | ✓ | ✓ | ✓ |
| `POST /api/result-sheets/{id}/enter_ese/` | ✓ | ✓ | — |
| `POST /api/result-sheets/{id}/compute/` | ✓ | ✓ | — |
| `POST /api/result-sheets/compute_all/?course=CS301` | ✓ | ✓ | — |

### Useful nested actions
```
GET  /api/students/{id}/results/         → student's result sheets
GET  /api/students/{id}/marks/           → all marks entries for student
GET  /api/ccr/{id}/enrolled_students/    → enrolment list for a course
GET  /api/ccr/{id}/ia_components/        → IA components for a course
```

### Bulk marks entry
```json
POST /api/marks/bulk_enter/
[
  {"student": "S001", "component": 1, "marks_obtained": 38},
  {"student": "S002", "component": 1, "marks_obtained": 42}
]
```
Returns `{ "saved": [...], "errors": [...] }` with HTTP 207.

---

## How marks flow
```
MarksEntry.marks_obtained
    → auto-scaled to scaled_marks = (marks_obtained / max_marks) × weightage

ResultSheet.compute()
    → int_total  = sum of all scaled_marks for that student+course
    → grand_total = int_total × (int_weightage/100) + ese_marks × (ese_weightage/100)
```

---

## Docker (recommended for local dev)

```bash
# Copy env file and set a real SECRET_KEY
cp .env.example .env

# Start DB + Django
docker compose up --build

# Seed demo data
docker compose exec web python manage.py seed_demo
```

Visit:
- API:     http://localhost:8000/api/
- Admin:   http://localhost:8000/admin/
- pgAdmin (optional): `docker compose --profile debug up` → http://localhost:5050

---

## Running Tests

```bash
# Local (activate venv first)
python manage.py test core --verbosity=2

# In Docker
docker compose exec web python manage.py test core --verbosity=2
```

The test suite covers:
- **Model validation** — weightage sum, semester range, total_hrs auto-compute
- **Scaled marks** — automatic calculation on `MarksEntry.save()`
- **Signals** — ResultSheet auto-creation on enrolment, int_total recomputation on marks save/delete
- **Grand total** — full marks flow from IA entry → ESE entry → compute
- **Permissions** — admin-only create, faculty marks entry, student read-only
- **API endpoints** — login, me, CRUD, bulk entry, filters
- **Duplicate guards** — duplicate enrolment, marks exceeding max

---

## Analytics Endpoints

All analytics endpoints require authentication. Faculty/admin-only endpoints are noted.

| Endpoint | Auth | Description |
|---|---|---|
| `GET /api/analytics/dashboard/` | All | Role-aware: admin sees system stats, faculty sees their courses, student sees their results |
| `GET /api/analytics/course_summary/?course=CS301` | Admin, Faculty | Enrolment count, marks completion %, pass/fail counts, avg/max/min |
| `GET /api/analytics/grade_distribution/?course=CS301` | All | Grade band breakdown (O/A+/A/B+/B/C/F) with counts and % |
| `GET /api/analytics/toppers/?course=CS301&limit=10` | All | Top-N students ranked by grand_total |
| `GET /api/analytics/student_report/?student=S001` | All (students: own only) | Full report — all courses, IA breakdown, grades |
| `GET /api/analytics/ia_breakdown/?course=CS301` | Admin, Faculty | Per-component avg/max/min, completion %, missing count |

### Grade Bands
| Grade | Range |
|---|---|
| O | 90–100 |
| A+ | 80–89.99 |
| A | 70–79.99 |
| B+ | 60–69.99 |
| B | 50–59.99 |
| C | 40–49.99 |
| F | 0–39.99 |

---

## JWT Token Payload

Login response now includes extra fields beyond the token pair:
```json
{
  "access":     "...",
  "refresh":    "...",
  "role":       "faculty",
  "full_name":  "Ramesh Sharma",
  "jlu_id":     "FAC001",
  "profile_id": "F001"
}
```
These same claims are embedded inside the JWT so middleware/guards can read them without a DB lookup.

---

## Error Response Envelope

Every API error returns a consistent shape:
```json
{
  "success": false,
  "code":    "validation_error",
  "message": "marks_obtained (99) exceeds max_marks (50).",
  "errors":  { "marks_obtained": "marks_obtained (99) exceeds max_marks (50)." }
}
```

---

## Updated Project Structure
```
jlu_marks/
├── manage.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── jlu_marks/
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
└── core/
    ├── models.py        ← 11 models, 5 enums
    ├── serializers.py   ← DRF serializers + combined create flows
    ├── views.py         ← ViewSets + custom actions
    ├── analytics.py     ← 6 reporting endpoints
    ├── filters.py       ← Proper FilterSet classes with range/cross-table filters
    ├── permissions.py   ← Role-based permission classes
    ├── signals.py       ← Auto ResultSheet creation + int_total recompute
    ├── token.py         ← Custom JWT with role/profile_id claims
    ├── exceptions.py    ← Uniform error envelope + domain exceptions
    ├── admin.py         ← Full Django admin
    ├── apps.py          ← CoreConfig (wires signals)
    ├── tests.py         ← 45+ tests across models, signals, API, analytics
    ├── migrations/
    │   └── 0001_initial.py
    └── management/commands/seed_demo.py
```

Visit `http://localhost:8000/admin/` and log in with your admin credentials.
All models are registered with search, filter, and inline support.

---

## Project Structure
```
jlu_marks/
├── manage.py
├── requirements.txt
├── .env.example
├── jlu_marks/          ← Django project config
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
└── core/               ← Main application
    ├── models.py       ← All 11 models + enums
    ├── serializers.py  ← DRF serializers
    ├── views.py        ← ViewSets
    ├── urls.py         ← Router
    ├── permissions.py  ← Role-based permissions
    ├── admin.py        ← Admin registrations
    └── management/commands/seed_demo.py
```
