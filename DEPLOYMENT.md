# BES — Bid Evaluation System
## Complete Deployment Guide & 5-Sprint Development Plan

---

## SYSTEM OVERVIEW

The Bid Evaluation System (BES) is a full-stack government procurement platform built on:
- **Frontend**: React.js (SPA) with custom CSS design system
- **Backend**: Node.js + Express REST API
- **Database**: PostgreSQL 15
- **Auth**: JWT (access + refresh tokens) + RBAC
- **PDF**: pdf-parse (extraction) + pdfkit (generation)
- **Deployment**: Docker Compose

---

## PREREQUISITES

Install these before starting:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 | https://nodejs.org |
| npm | ≥ 9 | Comes with Node.js |
| PostgreSQL | ≥ 14 | https://postgresql.org |
| Docker | ≥ 24 | https://docker.com (optional) |
| Git | any | https://git-scm.com |

---

## FOLDER STRUCTURE

```
bes/
├── backend/
│   ├── src/
│   │   ├── config/          # database.js, migrate.js, seed.js
│   │   ├── controllers/     # auth, users, projects, workflows,
│   │   │                    # bidders, documents, evaluations,
│   │   │                    # reports, dashboard
│   │   ├── middleware/      # auth.js (JWT + RBAC + audit)
│   │   ├── routes/          # index.js (all routes)
│   │   └── utils/           # logger.js
│   ├── uploads/             # (auto-created) file storage
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/       # WorkflowBuilder, BidderManager,
│   │   │   │                # DocumentUploader, FinalDecisionPanel,
│   │   │   │                # EvaluatorAssigner
│   │   │   ├── evaluator/   # EvaluationWorkspace
│   │   │   └── common/      # Layout, Sidebar, TopHeader
│   │   ├── pages/           # LoginPage, DashboardPage, ProjectsPage,
│   │   │                    # ProjectDetailPage, ProjectFormPage,
│   │   │                    # UsersPage, ReportsPage, ProfilePage
│   │   ├── store/           # authStore.js (Zustand)
│   │   ├── styles/          # global.css
│   │   ├── utils/           # api.js (all API calls)
│   │   ├── App.jsx
│   │   └── index.js
│   ├── public/
│   │   └── index.html
│   ├── .env.example
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
└── DEPLOYMENT.md
```

---

## OPTION A: LOCAL DEVELOPMENT (Recommended for getting started)

### Step 1 — Clone / unzip project

```bash
cd ~/Desktop
# If using Git:
git clone <repo-url> bes
cd bes
# Or just unzip the project folder
```

### Step 2 — Set up PostgreSQL database

**On macOS (using Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
psql postgres -c "CREATE DATABASE bes_db;"
psql postgres -c "CREATE USER bes_user WITH PASSWORD 'BESLocal2024!';"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE bes_db TO bes_user;"
```

**On Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres psql -c "CREATE DATABASE bes_db;"
sudo -u postgres psql -c "CREATE USER bes_user WITH PASSWORD 'BESLocal2024!';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE bes_db TO bes_user;"
```

**On Windows:**
1. Download PostgreSQL from https://postgresql.org/download/windows
2. Install with default settings, set password to `BESLocal2024!`
3. Open pgAdmin 4 → right-click Databases → Create → Database → name: `bes_db`

### Step 3 — Configure backend environment

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=bes_db
DB_USER=postgres          # or bes_user
DB_PASSWORD=BESLocal2024! # your postgres password

JWT_SECRET=bes_jwt_secret_dev_2024_change_in_prod
JWT_REFRESH_SECRET=bes_refresh_secret_dev_2024
JWT_EXPIRE=24h

UPLOAD_PATH=./uploads
MAX_FILE_SIZE=52428800

FRONTEND_URL=http://localhost:3000
```

### Step 4 — Install backend dependencies & run migrations

```bash
# Still in /backend
npm install
node src/config/migrate.js   # Creates all 14 tables
node src/config/seed.js      # Creates default admin + evaluator accounts
```

Expected output:
```
✅ Migration completed successfully
✅ Seed completed successfully
👤 Admin: admin@bes.gov.lk / Admin@1234
👤 Evaluator: evaluator@bes.gov.lk / Eval@1234
```

### Step 5 — Start backend server

```bash
npm run dev
# → Server running on port 5000
```

Keep this terminal open. Verify: http://localhost:5000/health → `{"status":"ok"}`

### Step 6 — Configure & start frontend

Open a **new terminal**:

```bash
cd frontend
cp .env.example .env
# .env content: REACT_APP_API_URL=http://localhost:5000/api
npm install
npm start
```

Browser will open at http://localhost:3000

### Step 7 — Log in and verify

1. Go to http://localhost:3000
2. Login: `admin@bes.gov.lk` / `Admin@1234`
3. You should see the Admin Dashboard

---

## OPTION B: DOCKER COMPOSE (Production-ready)

### Step 1 — Create root `.env` file

```bash
cd bes  # root of project
cat > .env << 'EOF'
DB_PASSWORD=BESPostgres2024!
JWT_SECRET=your_super_secret_jwt_key_min_32_chars_here
JWT_REFRESH_SECRET=your_refresh_secret_key_min_32_chars
REACT_APP_API_URL=http://localhost:5000/api
FRONTEND_URL=http://localhost:3000
EOF
```

### Step 2 — Build and start all services

```bash
docker-compose up --build -d
```

This will:
1. Start PostgreSQL container
2. Build and start backend (runs migrations + seed automatically)
3. Build React app and start nginx

### Step 3 — Check status

```bash
docker-compose ps          # all services should be "Up"
docker-compose logs backend  # check for errors
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Health: http://localhost:5000/health

### Useful Docker commands

```bash
docker-compose down          # stop all
docker-compose down -v       # stop + delete data volumes (DESTRUCTIVE)
docker-compose logs -f       # live logs
docker-compose restart backend  # restart just backend
```

---

## OPTION C: CLOUD DEPLOYMENT (Ubuntu VPS / AWS EC2)

### Server requirements
- Ubuntu 22.04 LTS
- 2 vCPU, 4GB RAM minimum
- Open ports: 22, 80, 443, 3000, 5000

### Step 1 — Server setup

```bash
ssh ubuntu@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
newgrp docker

# Install Docker Compose
sudo apt install -y docker-compose-plugin
```

### Step 2 — Upload project

```bash
# From your local machine:
scp -r ./bes ubuntu@your-server-ip:~/bes
```

### Step 3 — Configure for production

```bash
ssh ubuntu@your-server-ip
cd ~/bes

cat > .env << 'EOF'
DB_PASSWORD=<strong-random-password>
JWT_SECRET=<64-char-random-string>
JWT_REFRESH_SECRET=<64-char-random-string>
REACT_APP_API_URL=http://YOUR_SERVER_IP:5000/api
FRONTEND_URL=http://YOUR_SERVER_IP:3000
EOF
```

### Step 4 — Deploy

```bash
docker-compose up --build -d
```

### Step 5 — Set up SSL with Nginx + Certbot (optional but recommended)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# Create nginx config
sudo tee /etc/nginx/sites-available/bes << 'EOF'
server {
    server_name your-domain.com;

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/bes /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Get SSL cert
sudo certbot --nginx -d your-domain.com
```

---

## DATABASE TABLES REFERENCE

| Table | Purpose |
|-------|---------|
| `users` | System users (admin, evaluator, viewer) |
| `roles` | Role definitions with permissions |
| `projects` | Procurement projects |
| `workflows` | One workflow per project |
| `stages` | Configurable evaluation stages |
| `criteria` | Per-stage evaluation criteria |
| `bidders` | Bidders per project |
| `documents` | Uploaded files with PDF extraction |
| `project_evaluators` | User↔Project assignments |
| `evaluations` | Per-bidder, per-criteria, per-evaluator scores |
| `comments` | Stage-level comments per bidder |
| `votes` | Committee votes per stage per bidder |
| `final_decisions` | Contract award records |
| `reports` | Generated PDF report metadata |
| `audit_logs` | Complete action history |
| `notifications` | User notifications |

---

## DEFAULT ACCOUNTS

| Role | Email | Password |
|------|-------|---------|
| Admin | admin@bes.gov.lk | Admin@1234 |
| Evaluator | evaluator@bes.gov.lk | Eval@1234 |

**Change these immediately in production!**

---

## API ENDPOINTS REFERENCE

```
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/refresh
PUT    /api/auth/change-password

GET    /api/users                        [admin]
POST   /api/users                        [admin]
PUT    /api/users/:id                    [admin]
GET    /api/users/evaluators

GET    /api/dashboard/admin              [admin]
GET    /api/dashboard/evaluator

GET    /api/projects
POST   /api/projects                     [admin]
GET    /api/projects/:id
PUT    /api/projects/:id                 [admin]
POST   /api/projects/:id/evaluators      [admin]
GET    /api/projects/:id/stats

GET    /api/projects/:id/workflow
POST   /api/projects/:id/workflow        [admin]
POST   /api/projects/:id/workflow/start  [admin]
POST   /api/projects/:id/workflow/advance [admin]

GET    /api/projects/:id/bidders
POST   /api/projects/:id/bidders         [admin]
PUT    /api/bidders/:id                  [admin]
DELETE /api/bidders/:id                  [admin]
GET    /api/projects/:id/bidders/evaluation-summary

GET    /api/projects/:id/documents
POST   /api/documents/upload
GET    /api/documents/:id/extracted
DELETE /api/documents/:id                [admin]

GET    /api/projects/:pId/stages/:sId/workspace
POST   /api/stages/:sId/bidders/:bId/evaluate
POST   /api/stages/:sId/bidders/:bId/comment
POST   /api/stages/:sId/bidders/:bId/vote

POST   /api/projects/:id/final-decision  [admin]
GET    /api/projects/:id/final-decision

GET    /api/projects/:id/reports
POST   /api/projects/:id/reports/generate
GET    /api/reports/download/:id
```

---

# 5-SPRINT DEVELOPMENT PLAN

Each sprint is 2 weeks. This plan shows what to build and deploy in each sprint.

---

## SPRINT 1 — Foundation & Authentication (Week 1–2)

**Goal:** Running system with login, DB, and user management

### Files to create in Sprint 1:

```
backend/
  package.json
  .env.example
  Dockerfile
  src/
    server.js
    config/
      database.js
      migrate.js
      seed.js
    utils/
      logger.js
    middleware/
      auth.js
    controllers/
      authController.js
      usersController.js
      dashboardController.js    (basic version only)
    routes/
      index.js                  (auth + users routes only)

frontend/
  package.json
  .env.example
  public/index.html
  src/
    index.js
    App.jsx                     (routes: login, dashboard only)
    styles/
      global.css
    store/
      authStore.js
    utils/
      api.js                    (authAPI, usersAPI, dashboardAPI only)
    components/
      common/
        Layout.jsx
        Sidebar.jsx
        TopHeader.jsx
    pages/
      LoginPage.jsx
      DashboardPage.jsx
      UsersPage.jsx
      ProfilePage.jsx
```

### Sprint 1 Acceptance Criteria:
- [ ] PostgreSQL database created with all 16 tables
- [ ] Admin can log in at /login
- [ ] JWT refresh token flow works
- [ ] Admin dashboard shows stats cards
- [ ] Admin can create/edit/deactivate users
- [ ] Evaluator can log in and see their dashboard
- [ ] Navigation sidebar works for both roles

### Sprint 1 Test:
```bash
# Test API health
curl http://localhost:5000/health

# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bes.gov.lk","password":"Admin@1234"}'
```

---

## SPRINT 2 — Project Management & Workflow Builder (Week 3–4)

**Goal:** Admin can create projects and configure evaluation workflows

### Files to add/update in Sprint 2:

```
backend/
  src/
    controllers/
      projectsController.js     (full CRUD + evaluator assignment)
      workflowsController.js    (create, getByProject, start, advance)
    routes/
      index.js                  (add project + workflow routes)

frontend/
  src/
    utils/
      api.js                    (add projectsAPI, workflowsAPI)
    App.jsx                     (add /projects, /projects/new, /projects/:id routes)
    pages/
      ProjectsPage.jsx
      ProjectFormPage.jsx
      ProjectDetailPage.jsx     (overview + workflow tabs only)
    components/
      admin/
        WorkflowBuilder.jsx     (full configurable engine)
        EvaluatorAssigner.jsx
```

### Sprint 2 Acceptance Criteria:
- [ ] Admin can create a new project with all fields
- [ ] Admin can edit project details
- [ ] Admin can view all projects in a table with filters
- [ ] Admin can configure a workflow with N stages
- [ ] NCB template loads correctly with 3 stages and 20+ criteria
- [ ] Each stage has configurable: name, scoring_method, decision_method, criteria
- [ ] Toggles work for voting, mandatory comments, auto-advance
- [ ] Admin can assign evaluators with roles (Chairman, Member, Convener)
- [ ] Workflow saved to PostgreSQL correctly
- [ ] Project status changes to 'workflow_configured'

### Sprint 2 Test:
1. Create project with file_no `TEST/2024/01`
2. Load NCB template in workflow builder
3. Add a custom 4th stage "Post-Qualification"
4. Save workflow → verify in DB: `SELECT * FROM stages WHERE workflow_id = '...';`
5. Assign 3 evaluators with different roles

---

## SPRINT 3 — Bidders, Documents & PDF Extraction (Week 5–6)

**Goal:** Upload bid documents, auto-extract data, manage bidders

### Files to add/update in Sprint 3:

```
backend/
  src/
    controllers/
      biddersController.js      (full CRUD + evaluation summary)
      documentsController.js    (upload, PDF parse, auto-populate)
    routes/
      index.js                  (add bidder + document routes)

frontend/
  src/
    utils/
      api.js                    (add biddersAPI, documentsAPI)
    pages/
      ProjectDetailPage.jsx     (add bidders + documents tabs)
    components/
      admin/
        BidderManager.jsx       (add/edit/delete bidders, bid price table)
        DocumentUploader.jsx    (drag-drop upload, extraction status)
```

### Sprint 3 Acceptance Criteria:
- [ ] Admin can manually add bidders with all fields
- [ ] Drag-and-drop file upload works
- [ ] PDF is parsed asynchronously, status shown (pending/completed/failed)
- [ ] Bidder names and bid prices auto-extracted from uploaded NCB PDF
- [ ] Project fields auto-populated from TEC PDF (file_no, amount, dates)
- [ ] Document list shows file, type, bidder, size, extraction status
- [ ] Bid opening summary shows: total bids, lowest, highest
- [ ] Admin can start evaluation (status → 'in_evaluation', first stage → 'active')
- [ ] Upload the sample PDF from MENA project → verify 5 bidders extracted

### Sprint 3 Test:
```bash
# Upload the NCB_Final-_Temp.pdf
curl -X POST http://localhost:5000/api/documents/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@NCB_Final-_Temp.pdf" \
  -F "projectId=<project-id>" \
  -F "documentType=tec_report"

# Check extraction status after 5 seconds
curl http://localhost:5000/api/documents/<doc-id>/extracted \
  -H "Authorization: Bearer <token>"
```

---

## SPRINT 4 — Evaluation Workspace & Voting (Week 7–8)

**Goal:** Evaluators can use the dynamic workspace to score bidders per stage

### Files to add/update in Sprint 4:

```
backend/
  src/
    controllers/
      evaluationsController.js  (workspace, submitEvaluation, vote, comment, finalDecision)
    routes/
      index.js                  (add evaluation routes)

frontend/
  src/
    utils/
      api.js                    (add evaluationsAPI)
    pages/
      ProjectDetailPage.jsx     (add evaluation + decision tabs)
    components/
      evaluator/
        EvaluationWorkspace.jsx (dynamic workspace - full implementation)
      admin/
        FinalDecisionPanel.jsx  (award recommendation)
```

### Sprint 4 Acceptance Criteria:
- [ ] Evaluator sees list of active bidders in left panel
- [ ] Selecting a bidder loads all criteria for current stage
- [ ] Pass/Fail buttons work for compliance criteria
- [ ] Numeric score input works for score criteria
- [ ] Deviation checkbox+description works for deviation criteria
- [ ] Rank input works for ranking criteria
- [ ] Text response input works for text criteria
- [ ] Evaluations saved per (stage, bidder, evaluator, criteria)
- [ ] Pre-existing evaluations load when switching bidders
- [ ] Comment panel shows/hides, comments posted and listed
- [ ] Voting (Approve/Reject) works when stage has voting enabled
- [ ] Vote counts shown per bidder
- [ ] Stage can be advanced (admin only) → eliminated bidders auto-marked
- [ ] Stage selector tabs allow viewing any stage (past/current)
- [ ] Final decision panel shows ranked bidder summary
- [ ] Admin can select winner + record contract amount + reasons
- [ ] Project status → 'awarded'

### Sprint 4 Test:
1. Login as evaluator@bes.gov.lk
2. Navigate to project → Evaluation tab
3. Select Bidder 1 (D.B Gangoda Associates)
4. In Preliminary stage: mark all criteria as Pass
5. Save → green dot appears on bidder
6. Login as admin → advance to Technical stage
7. Complete technical evaluation for all bidders
8. Advance to Financial stage → rank bidders by price
9. Open Final Decision → verify D.B Gangoda ranked #1 (Rs. 615,600)
10. Record award → PDF report generated

---

## SPRINT 5 — Reports, Polish & Production Hardening (Week 9–10)

**Goal:** PDF report generation, UI polish, production security

### Files to add/update in Sprint 5:

```
backend/
  src/
    controllers/
      reportsController.js      (PDF generation with pdfkit, download)
    routes/
      index.js                  (add report routes)

frontend/
  src/
    utils/
      api.js                    (add reportsAPI)
    App.jsx                     (add /reports route)
    pages/
      ReportsPage.jsx           (project selector, report type, history)
    styles/
      global.css                (final polish, print styles)

root/
  docker-compose.yml
  backend/Dockerfile
  frontend/Dockerfile
  frontend/nginx.conf
  .env.example
```

### Sprint 5 Acceptance Criteria:
- [ ] Admin can generate "Full Evaluation Report" PDF
- [ ] PDF includes: project info, bidder table, workflow stages, final decision
- [ ] Report auto-downloads in browser
- [ ] Report history table shows all generated reports
- [ ] Previous reports can be re-downloaded
- [ ] Print styles work (sidebar hidden on print)
- [ ] Rate limiting active (500 req/15min)
- [ ] Helmet security headers active
- [ ] JWT refresh token flow tested
- [ ] All audit logs written to audit_logs table
- [ ] Docker Compose builds and runs successfully
- [ ] Docker health checks pass
- [ ] README/DEPLOYMENT.md complete

### Sprint 5 Test:
```bash
# Docker build test
docker-compose up --build -d
docker-compose ps   # all green
curl http://localhost:3000   # React app loads
curl http://localhost:5000/health   # {"status":"ok"}

# Generate report via API
curl -X POST http://localhost:5000/api/projects/<id>/reports/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"reportType":"full_evaluation"}'

# Download report
curl -O -J http://localhost:5000/api/reports/download/<report-id> \
  -H "Authorization: Bearer <token>"
```

---

## QUICK REFERENCE: WORKFLOW FOR DEMO (NCB PROJECT)

Use the uploaded `NCB_Final-_Temp.pdf` to demonstrate:

1. **Create Project**
   - File No: `RUH/SUP/NCB/2022/02`
   - Title: Supply, Delivery, Installation... Desktop Computer i7
   - Department: Faculty of Engineering, University of Ruhuna
   - Estimated Amount: 25,000,000
   - Method: NCB

2. **Configure Workflow** → Load NCB Template
   - Stage 1: Preliminary Examination (pass/fail, 5 criteria)
   - Stage 2: Technical Evaluation (compliance, 10 criteria, voting enabled)
   - Stage 3: Financial Evaluation (ranking, 5 criteria)

3. **Upload PDF** → NCB_Final-_Temp.pdf (TEC report)
   - System auto-extracts 5 bidders + prices

4. **Add Bidders Manually** (if not auto-extracted):
   - Base HP: Rs. 995,000
   - John Keells: Rs. 855,700
   - D.B Gangoda: Rs. 615,600
   - Abans PLC: Rs. 898,000
   - Unity System: Rs. 1,101,500

5. **Assign Evaluators**:
   - Dr. Rajitha Udawalpola — Chairman
   - Dr. K.J.C Kumara — Member
   - Dr. A.W.B.I Annasiwaththa — Member
   - Mr. M.T.T Ranjan — Convener

6. **Start Evaluation**

7. **Stage 1** — All 5 pass preliminary

8. **Advance → Stage 2** — D.B Gangoda: keyboard deviation (minor), all others pass

9. **Advance → Stage 3** — Rank by price: D.B Gangoda #1

10. **Final Decision** — Award to D.B Gangoda: Rs. 15,390,000 (615,600 × 25)

11. **Generate PDF Report**

---

## TROUBLESHOOTING

### "Cannot connect to database"
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql
# Check connection
psql -h localhost -U postgres -d bes_db -c "SELECT 1;"
```

### "Port 5000 already in use"
```bash
lsof -i :5000
kill -9 <PID>
```

### "npm install fails"
```bash
# Clear cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### "JWT token expired"
The frontend automatically refreshes tokens. If you get 401 errors, clear localStorage and log in again.

### "PDF extraction failed"
The extraction runs asynchronously. Check document status after 10 seconds. Some PDFs may have encoding issues — the system will mark status as 'failed' and you can enter bidder data manually.

### Docker: "bind: address already in use"
```bash
docker-compose down
sudo lsof -i :3000 -i :5000 -i :5432
# kill conflicting processes
```

---

*BES v1.0 — Government Procurement Management Platform*
*Built for Sri Lanka University Procurement Division*
