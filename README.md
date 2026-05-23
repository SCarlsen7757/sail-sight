# SailSight

A self-hosted sailing telemetry analysis tool for [Vakaros](https://vakaros.com/) devices. Upload your `.vkx` log files, explore GPS tracks on an interactive map, and review race telemetry through live playback and historical charts — with multi-user accounts and team sharing.

> **User management is admin-managed.** There is no public sign-up, password reset, email verification, or social login. The first admin is bootstrapped from environment variables; the admin then creates users and shares a one-time setup URL with each new user out-of-band (Slack/SMS/in-person).
>
> **Quickstart for self-hosters:**
>
> 1. Edit `docker-compose.yml` and set `Auth__Admin__Email` and `Auth__Admin__Password` (min 12 chars) on the `api` service.
> 2. `docker compose up -d` — starts Postgres, the API, and the web app.
> 3. Open `http://localhost:8081` and sign in as the bootstrap admin.
> 4. Go to **Admin → Users** to create new users. Two flows are available:
>    - **Per-user setup link** — for known emails. Copy the one-time URL and share it; the user sets their own password from it.
>    - **Shareable invitation link** — for bulk onboarding. Set an optional expiry (days) and/or max-use count. Share the single URL; each redeemer creates their own account (email + display name + password) and is assigned the role you picked when creating the link. Revoke at any time.
> 5. To skip auth entirely (single-user mode), set `Auth__Mode=SingleUser` in `docker-compose.yml`. The admin bootstrap is skipped in this mode.
>
> If you leave `Auth__Admin__Password` empty, the bootstrap admin is created without a password and a one-time setup URL is logged to the API container logs (`docker compose logs api`) — useful for ephemeral deployments.

---

## Table of Contents

- [SailSight](#sailsight)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Features](#features)
  - [Architecture](#architecture)
    - [Frontend Tech Stack](#frontend-tech-stack)
    - [API Versioning and TypeScript Codegen](#api-versioning-and-typescript-codegen)
    - [Prerequisites](#prerequisites)
    - [Running with Docker Compose](#running-with-docker-compose)
    - [Development (Visual Studio 2022)](#development-visual-studio-2022)
  - [Usage](#usage)
    - [Uploading a Session](#uploading-a-session)
    - [Managing Boats and Courses](#managing-boats-and-courses)
    - [Viewing a Race](#viewing-a-race)
  - [Projects](#projects)
  - [Roadmap](#roadmap)
  - [Contributing](#contributing)

---

## Overview

Vakaros devices record sailing telemetry — GPS position, speed, heading, heel, VMG, and more — into compact binary `.vkx` log files. This project provides:

- A **parser** that decodes the VKX binary format into structured data
- A **REST API** that ingests, stores, and serves the telemetry
- A **Next.js UI** for interactive visualisation of sessions and races

---

## Features

| Feature | Description |
| --- | --- |
| 📤 **File Upload** | Upload `.vkx` files via the API; duplicate detection via SHA-256 hash |
| 🏁 **Automatic Race Detection** | Races are extracted automatically from the timer events embedded in each session |
| 🗺️ **Interactive Map** | GPS track rendered on a Leaflet map with course marks, start line (pin end / boat end) and leg overlays |
| 📈 **Telemetry Charts** | Synced time-series charts for speed, VMG, and heel powered by Apache ECharts |
| 🎛️ **Live Gauges** | Heading, speed, VMG, and heel/angle gauges with scrubbing and playback |
| ⏯️ **Playback Modes** | *Historical* mode shows full-race charts with a synced cursor; *Current* mode shows live-style gauges you can scrub through |
| ⛵ **Boats** | Register boats with name, sail number, and class; link them to sessions |
| 📍 **Marks & Courses** | Define race-course marks and build ordered course legs; overlay them on any race map |
| 🐳 **Self-hosted** | One `docker compose up` starts the database, API, and Web UI |
| 🤖 **AI Race Summaries** | Optional AI-generated post-race analysis streamed via SSE; requires an OpenAI-compatible `RaceSummary:ApiKey` in config |

---

## Architecture

```
┌──────────────────────────┐      HTTP/JSON      ┌────────────────────────────┐
│  SailSight.Web           │ ──────────────────► │  SailSight.Api             │
│  Next.js 15 / React 19   │                     │  ASP.NET Core (.NET 10)    │
└──────────────────────────┘                     └─────────────┬──────────────┘
                                                               │ EF Core
                                                               ▼
                                                 ┌────────────────────────────┐
                                                 │  TimescaleDB (PostgreSQL)  │
                                                 └────────────────────────────┘
                                                               ▲
                                                               │
┌──────────────────────────┐      parse          ┌─────────────┴──────────────┐
│  Vakaros.Vkx.Parser      │ ◄────────────────── │  VkxIngestionService       │
│  Binary VKX decoder      │                     │  (inside the API)          │
└──────────────────────────┘                     └────────────────────────────┘

┌──────────────────────────┐
│  SailSight.Shared        │  ← DTOs shared between API and Web
└──────────────────────────┘
```

### Frontend Tech Stack

| Layer | Library / Tool |
| --- | --- |
| Framework | [Next.js](https://nextjs.org/) (App Router) |
| UI library | [React](https://react.dev/) + [TypeScript 5](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Components | [Radix UI](https://www.radix-ui.com/) primitives, [Lucide React](https://lucide.dev/) icons |
| Maps | [Leaflet](https://leafletjs.com/) + [React Leaflet](https://react-leaflet.js.org/) |
| Charts | [Apache ECharts](https://echarts.apache.org/) via [echarts-for-react](https://github.com/hustcc/echarts-for-react) |
| State management | [Zustand](https://zustand-demo.pmnd.rs/) |
| API client | [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) with generated types from [openapi-typescript](https://openapi-ts.dev/) |
| Theming | [next-themes](https://github.com/pacocoursey/next-themes) |

### API Versioning and TypeScript Codegen

The REST API uses URL-segment versioning (`/api/v1/...`). Each version has a dedicated [OpenAPI](https://www.openapis.org/) document that is generated at **build time** and committed to the repository at `SailSight.Api/OpenApi/v1.json`.

The build pipeline auto-generates the frontend TypeScript types from this spec:

```
dotnet build
  └─► GenerateOpenApiDocuments       → SailSight.Api/OpenApi/v1.json
  └─► GenerateTypeScriptTypes        → SailSight.Web/src/lib/api-types.ts
        (runs: npm run gen:api)
```

The generated `api-types.ts` is consumed by [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) in the web app, giving fully typed API calls with no manual maintenance.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Visual Studio 2022](https://visualstudio.microsoft.com/) with the **ASP.NET and web development** workload (includes Container Tools and Node.js support)

### Running with Docker Compose

```bash
docker compose up --build
```

This starts:

- **TimescaleDB** on port `5432`
- **API** on port `8080`
- **Web UI** on port `8081`

### Development (Visual Studio 2022)

The solution is configured for a **full Docker Compose dev loop** directly from Visual Studio. Everything — database, API, and web frontend — runs in Docker with live hot-reload.

**Prerequisites**

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running with Linux containers
- Visual Studio 2022 with the **ASP.NET and web development** workload (Container Tools included)

**Start the dev environment**

1. Open `SailSight.slnx` in Visual Studio 2022.
2. Set **docker-compose** as the startup project (it should be selected by default).
3. Press **F5** — Visual Studio starts all three services and opens the web app in your browser.

| Service | URL / Port | Notes |
| --------- | ----------- | ------- |
| Web UI | `http://localhost:8081` | Opens automatically on F5 |
| API | `http://localhost:8080` | |
| API docs (Scalar) | `http://localhost:8080/scalar` | |
| PostgreSQL | `localhost:5432` | Exposed for DB tools (pgAdmin, DataGrip) |

**Hot-reload behaviour**

| Layer | Behaviour |
| ------- | ----------- |
| **C# API** | Visual Studio Fast Mode — changes apply via .NET Hot Reload without a full Docker rebuild. For structural changes, rebuild with **Ctrl+Shift+B** and VS pushes the new binaries automatically. |
| **Next.js web** | True file-watch hot-reload — save any `.tsx` / `.ts` file and the browser refreshes instantly. No rebuild needed. |

**When to rebuild Docker images**

```bash
# Rebuild only the web image (e.g. after adding npm packages)
docker compose build web

# Full rebuild of all images
docker compose build
```

**Database migrations**

Migrations are applied automatically on API startup. To add a new migration:

```bash
dotnet ef migrations add <MigrationName> --project SailSight.Api --startup-project SailSight.Api
```

---

## Usage

### Uploading a Session

Use any HTTP client to `POST` a `.vkx` file to the API:

```bash
curl -X POST http://localhost:8080/api/sessions/upload \
     -F "file=@my-session.vkx"
```

The API parses the file, detects races, and returns a `SessionDetailDto` with all metadata.

### Managing Boats and Courses

Boats, marks, and courses can be managed via the REST API:

| Resource | Endpoint |
| --- | --- |
| Boat Classes | `GET/POST /api/boatclasses`, `PUT/DELETE /api/boatclasses/{id}` |
| Boats | `GET/POST /api/boats`, `PUT/DELETE /api/boats/{id}` |
| Marks | `GET/POST /api/marks`, `PUT/DELETE /api/marks/{id}` |
| Courses | `GET/POST /api/courses`, `PUT/DELETE /api/courses/{id}` |
| Sessions | `GET /api/sessions`, `PATCH/DELETE /api/sessions/{id}` (link boat/course) |

### Viewing a Race

1. Navigate to **Sessions** in the web UI.
2. Click a session to see its detail and list of detected races.
3. Click a race to open the **Race Viewer**:
   - The map shows the GPS track with course marks overlaid.
   - Switch between **Historical** (full-race charts with synced cursor) and **Current** (gauge-style scrubbing) modes.

---

## Projects

| Project | Type | Purpose |
| --- | --- | --- |
| `Vakaros.Vkx.Parser` | Class library | Decodes the VKX binary format (v1.4) into typed C# records |
| `SailSight.Api` | ASP.NET Core Web API | Ingestion, storage, race detection, REST endpoints |
| `SailSight.Web` | Next.js 15 / React 19 / TypeScript | Interactive web UI — map, charts, gauges, playback |
| `SailSight.Shared` | Class library | DTOs shared between the API and web projects |

---

## Roadmap

- [ ] **Mark-to-mark VMG** — calculate VMG towards the next course mark when a course is assigned to a session, replacing the current upwind/downwind approximation
- [ ] **Performance benchmarks** — compare speed, VMG, and tacking angles across multiple sessions on the same course
- [ ] **Polar diagram** — plot boat speed against true wind angle to build an empirical polar curve, if wind data is available
- [ ] **Session comparison** — overlay two or more race tracks on the same map
- [ ] **Enhanced telemetry UI** — the API already stores wind, speed-through-water, depth, temperature, and load sensor data; surface these data streams in the Web UI with dedicated charts and gauges
- [ ] **Weather data** — fetch historic weather conditions (wind speed, wind direction, temperature, precipitation, cloud cover) from an external weather API and overlay them on race sessions

---

## Contributing

Pull requests are welcome. For significant changes please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request
