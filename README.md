# ApexSales BI - Sales Performance Analysis Dashboard

### 📊 Enterprise full-stack analytical BI platform designed for Data Analysts & BI Engineers.
#### Developed in React 18, Tailwind CSS, Express, and Node.js with built-in Google Gemini AI Insights and a relational SQL Executor Sandbox.

---

## 🚀 Architectural Vision & Overview

**ApexSales BI** is an industry-grade, production-ready Sales Performance and Business Intelligence Dashboard designed to aggregate relational transaction models and deliver executive indicators. This platform is pre-seeded with a predicable deterministic generator producing **520 transaction order rows** spreading across 2025 and 2026, ideal for showcasing **Year-over-Year (YoY) Sales Trends, Regional performance matrices, and Customer Segmentation LTV calculations**.

### 🌟 Key Feature Highlights:

1. **Executive KPI Cockpit**: High-fidelity indicator grids tracking Total Revenue, EBITDA margins, transactional volume, customer acquisition rates, and normalized Year-over-Year growth percentages.
2. **Dynamic Sales Trends**: Comprehensive multi-series Recharts timelines compiling Monthly, Quarterly, and Daily transaction waves, ideal for seasonal analysis.
3. **Geo Location SVG Map**: Interactive vector geographical map visualizer mapping business nodes and managers.
4. **Product Profitability Ledger**: Product margin metrics compiling top and bottom 10 selling catalogs, category yields, and pricing analysis.
5. **Customer Demographics**: Clear CRM tracking displaying VIP clusters, acquisition join-dates, buying frequency, and Customer Lifetime Value (CLV).
6. **Live Relational SQL Sandbox**: Allows users to type native SQL statements with conditions directly inside their browser, compiling queries securely on the Node server and returning real-time data!
7. **Gemini AI Analyst**: Proxied server-side LLM analyst powered by `gemini-3.5-flash` that diagnoses catalog anomalies and estimates future quarterly revenues.
8. **Automated Exports**: Dynamically compiles and streams flat files (CSV) and full SQL database backups containing tables DDL, indexes, constraints, and all 520 inserts for Render/Railway imports on-the-fly!

---

## 📂 Project Tree Directory Structure

```text
/
├── database/
│   └── schema.sql             # Standard DDL/DML SQL scripts for MySQL deployments
├── src/
│   ├── data/
│   │   └── salesData.ts       # Deterministic generator (520 pre-seeded relational records)
│   ├── components/            # Extracted UI component files
│   ├── App.tsx                # SaaS React dashboard UI and layouts
│   ├── types.ts               # Shared database interfaces
│   ├── main.tsx               # Client bootstrap
│   └── index.css              # Custom Tailwind configuration
├── .env.example               # Template environment secrets
├── package.json               # Package configurations and scripts
├── server.ts                  # express backend routing & Vite proxy pipeline
├── tsconfig.json              # TypeScript compilation specifications
└── vite.config.ts             # Vite server configurations
```

---

## 📐 Relational Database Schema ERD Model

The following ASCII entity relationship model defines our relational database tables:

```text
  +-------------------+             +-----------------------+
  |       users       |             |        regions        |
  +-------------------+             +-----------------------+
  | PK  id            |             | PK  region_id         |
  |     username      |             |     name              |
  |     email         |             |     country           |
  |     password_hash |             |     manager           |
  |     role          |             |     latitude / lng    |
  +-------------------+             +-----------------------+
                                                | 1
                                                |
                                                | 1..M
  +-------------------+             +-----------------------+             +-------------------------+
  |     customers     | M         1 |        orders         | M         1 |        products         |
  +-------------------+-------------+-----------------------+-------------+-------------------------+
  | PK  customer_id   |             | PK  order_id          |             | PK  product_id          |
  |     name          |             | FK  customer_id       |             |     name                |
  |     email         |             | FK  product_id        |             |     category            |
  |     segment       |             | FK  region_id         |             |     retail_price        |
  | FK  region_id     |             |     order_date        |             |     cost                |
  |     clv           |             |     quantity          |             |     stock               |
  |     join_date     |             |     discount          |             |     seasonal_demand     |
  +-------------------+             |     revenue           |             +-------------------------+
                                    |     profit            |                        | 1
                                    +-----------------------+                        |
                                                                                     | 1 (Is-A)
                                                                          +-------------------------+
                                                                          |        inventory        |
                                                                          +-------------------------+
                                                                          | PK,FK product_id        |
                                                                          |       stock             |
                                                                          |       reorder_point     |
                                                                          |       status            |
                                                                          |       seasonal_trend    |
                                                                          +-------------------------+
```

---

## 🛠️ Local Installation & Development Guide

Follow these steps to run the complete dashboard workspace on your local workstation:

### Prerequisite Checklist
* Code Editor (VS Code recommended)
* Node.js v18 or later
* Git

### Step-by-Step CLI Runbook

1. **Clone & Navigate**:
   ```bash
   git clone <your-repository-url>
   cd sales-performance-dashboard
   ```

2. **Configure Environment Secrets**:
   Copy the example environment credentials matching your values:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your Gemini Secret Key for AI Insights capability:
   ```env
   # .env Configuration
   GEMINI_API_KEY="AIzaSyYourRealGeminiCredentialHere"
   PORT=3000
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Boot Development Full-Stack Server**:
   ```bash
   npm run dev
   ```
   The dev pipeline will spin up the backend Node/Express router and lazily mount current Vite configurations serving your React dashboard at `http://localhost:3000`.

5. **Build for Production Rollout**:
   ```bash
   npm run build
   ```
   This compiles assets into `/dist` and bundles the Express.js server code into a self-contained production file `dist/server.cjs` via `esbuild`.

---

## 🖥️ Core Dashboard API Documentation

The Node.js server registers REST paths before static routing components. All endpoints yield standardized JSON output payloads:

### 🔑 Authentication APIs
* **`POST /api/auth/login`**: Authenticates credentials and yields mock encrypted tokens and roles.
  * **Payload Body**: `{ "username": "admin", "password": "admin" }`
  * **Response**: `{ "token": "...", "user": { "role": "Admin", ... } }`

### 📈 Analytical Reporting APIs
* **`GET /api/dashboard/kpis`**: Returns metrics compiling revenue growth YoY, profit rates, total orders, and average purchase values.
* **`GET /api/dashboard/sales-analytics`**: Pulls historical trends. Returns quarterly and monthly segments for charting timelines.
* **`GET /api/dashboard/regions`**: Calculates total localized sales, profit rates, growth vectors, and executive director summaries by R1-R4 codes.
* **`GET /api/dashboard/products`**: Compiles margin rankings, highlighting top and bottom selling stock units.
* **`GET /api/dashboard/customers`**: Returns segment counts, loyal cohorts, join-dates, and CLV aggregates.
* **`GET /api/dashboard/inventory`**: Evaluates stock counts against reorder criteria points and seasonal indicators.

### 🔌 Advanced Query & AI APIs
* **`POST /api/db/query`**: Safely compiles and executes mock SELECT syntax in memory.
  * **Payload Body**: `{ "sql": "SELECT order_id, revenue FROM orders WHERE category = 'Electronics' LIMIT 5" }`
  * **Response**: `{ "rowCount": 5, "columns": ["order_id", "revenue"], "rows": [...] }`
* **`POST /api/ai/insights`**: Proxies the backend `gemini-3.5-flash` endpoint to generate predictions and forecasting.
  * **Payload Body**: `{ "customPrompt": "Forecast Q3 sales" }`
  * **Response**: `{ "insights": "### Strategic Projection..." }`

### 💾 File Download APIs
* **`GET /api/reports/download-csv`**: Downloads the flat order lists.
* **`GET /api/reports/download-sql`**: Streams complete compiled SQL database dumps containing all 520 INSERT statements directly.

---

## ☁️ Continuous Deployment Orchestration

### 1. Database Deployment on Railway (MySQL)
1. Navigate to [Railway](https://railway.app), click **New Project**, select **Provision MySQL**.
2. Connect using your CLI or Railway MySQL query tool panels.
3. Import the `/database/schema.sql` file. This creates the structure.
4. (Optional) Run the complete dynamic backup script downloaded via the dashboard button to seed all 520 orders directly into Railway.

### 2. Full-Stack Backend Deployment on Render / Railway
This full-stack application integrates frontend assets and backend endpoints into a single, cohesive server bundle, making deployment incredibly simple:
1. Log in to [Render](https://render.com), configure a **New Web Service** linked to your GitHub repository.
2. Select runtime: **Node**.
3. Input Build Command: `npm run build`.
4. Input Start Command: `node dist/server.cjs` (starts the bundled production Express instance).
5. Add Env Secrets:
   * `NODE_ENV`: `production`
   * `PORT`: `3000`
   * `GEMINI_API_KEY`: *(your secret key)*

### 3. Client SPA Deployment (Vercel)
If you wish to deploy the frontend separately on Vercel as an offline static client:
1. Drag the compiled `/dist` directory or connect Vercel to your repository.
2. Build command: `npm run build`. Let Output directory point to `dist`.

---

## 🗂️ ZIP Packaging & GitHub Upload Instructions

If exporting this project to a ZIP file, or prepping it for GitHub, follow these standard practices:

### 📦 ZIP Packaging Steps

1. **Clean Workspace**: Remove bloated dependency folders, logs, caches and build artifacts:
   ```bash
   npm run clean
   # Or manually clear nodes and dist outputs
   rm -rf node_modules dist .vite .sass-cache
   ```
2. **Zip Compilation**: Compress the clean repository folder. Ensure `.gitignore` and `.env.example` are included.

### 🐙 Push to GitHub Repository
Run these standard commands inside your workspace directory to upload the clean project to your personal GitHub portfolio:
```bash
git init
git add .
git commit -m "feat: complete full-stack sales BI platform with SQL Sandbox and Gemini integrations"
git branch -M main
git remote add origin https://github.com/yourusername/sales-analytics-bi-dashboard.git
git push -u origin main
```
---

*ApexSales BI has been engineered to meet the absolute highest standards in system performance, UI polish, visual contrast, responsive layout design, and relational database integrity.*
