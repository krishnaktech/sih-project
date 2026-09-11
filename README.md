# AapdaMarg NE 🛣️🚨
### North East India Disaster Resilience & Navigation System

**AapdaMarg NE** ("Disaster Path" — North East) is a disaster-resilience and adaptive navigation platform built for **Smart India Hackathon 2026 (SIH2026)**, under **Problem Statement ID: SIH26002**. It helps citizens, emergency responders, and logistics fleets navigate North East India safely during floods, landslides, and other hazards by combining live weather telemetry, crowdsourced hazard reports, and graph-based route optimization into a single command dashboard.

🔗 **Live demo (deployed):** [sih-project-navy.vercel.app](https://sih-project-navy.vercel.app)

> ⚠️ **Important — this is a deployed web application, not an offline tool.**
> AapdaMarg NE is designed to run as a **hosted, always-online service** and depends on live data (weather feeds, real-time hazard reports, GPS/telemetry, and server-side routing computation). It **does not work offline** and is not intended to be used as a downloaded/standalone app disconnected from the internet or the backend server. Even when run locally for development, it still requires an active internet connection for live weather and map data — it is not a fully offline-capable system.

---

## 📌 Overview

North East India is highly prone to monsoon flooding (Brahmaputra & Barak basins) and landslides (NH-6, NH-10 Teesta Gorge corridors). AapdaMarg NE addresses this by providing:

- **Adaptive route planning** that avoids active hazard zones instead of just the shortest path.
- **Real-time weather & disaster alerts** across major North East cities.
- **Crowdsourced hazard reporting** with photo uploads (floods, landslides, damaged bridges, road collapses).
- **Emergency SOS dispatch** with automatic geolocation-based routing to the nearest facility.
- **Fleet & convoy management** for essential commodity logistics, with automatic rerouting around hazards.
- **Field officer SITREPs** (situation reports) from agencies like ASDMA, broadcast to the network.
- **A command dashboard** summarizing readiness, active incidents, and logistics alerts.
- **A companion Android app** (APK) for field/citizen use — this too requires connectivity to reach the live backend.

---

## 🏆 Smart India Hackathon 2026

| | |
|---|---|
| **Hackathon** | Smart India Hackathon 2026 (SIH2026) |
| **Problem Statement ID** | SIH26002 |
| **Project Name** | AapdaMarg NE |
| **Domain** | Disaster Management / Navigation & Public Safety |
| **Deployment** | Live, cloud-hosted on Vercel (not an offline application) |

A full write-up of the problem understanding, proposed solution, and technical approach is available in the technical dossier included in this repository.

---

## ✨ Key Features

| Module | Description |
|---|---|
| 🗺️ **Smart Route Planning** | Computes both a *direct* route and a *safest* route between North East cities, factoring in live weather and active hazards using a graph-based routing engine (`networkx`). |
| 🌩️ **Live Weather & Alerts** | Aggregates live weather per city and generates a scrolling disaster alert ticker. |
| 📢 **Crowdsourced Hazard Reporting** | Citizens can report hazards (landslide, flood, damaged bridge, road collapse, cloudburst, heavy debris) with photo evidence, geolocation, and severity — reports are upvotable and immediately affect routing. |
| 🆘 **Emergency SOS Dispatch** | One-tap automated emergency complaint system (police/ambulance/both) using live GPS, dispatched to the nearest registered facility. |
| 🚚 **Fleet & Logistics Tracking** | Tracks essential-commodity vehicles/convoys, raises logistics alerts, and can automatically reroute a convoy around a hazard. |
| 🧑‍✈️ **Field SITREPs** | Field officials (e.g., ASDMA) submit corridor/bridge status reports (passability %, bridge condition, photos) that broadcast alerts to the network. |
| 📊 **Command Dashboard** | Centralized readiness and logistics summary for authorities. |
| 🏨 **Emergency Amenities** | Lookup of nearby hotels, restaurants, fuel stations, and relief camps. |
| 📱 **Android App** | Downloadable `.apk` for on-ground/citizen use (requires internet connectivity to function). |

---

## 🏗️ Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — REST API framework
- [Uvicorn](https://www.uvicorn.org/) — ASGI server
- [Pydantic](https://docs.pydantic.dev/) — request/response validation
- [NetworkX](https://networkx.org/) — graph-based route computation
- SQLite — lightweight embedded database (`ne_disaster.db`)
- `requests` — external HTTP calls (weather, etc.)

**Frontend**
- Static HTML/CSS/JS (served from `/static`) with `index.html` as the entry point
- `dossier.html` — project/technical dossier page

**Mobile**
- `AapdaMarg-NE.apk` — Android companion app (online-only)

**Deployment**
- Hosted live on [Vercel](https://vercel.com/) via `vercel.json` — the project is built and shipped as a deployed service, not a downloadable offline package

---

## 📂 Project Structure

```
sih-project/
├── main.py                          # FastAPI app entrypoint & all API routes
├── config.py                        # City data, hazard types, severity levels, dirs
├── database.py                      # SQLite connection & schema initialization
├── seed_data.py                     # Seeds the DB with baseline NE India scenario data
├── routing_engine.py                # Graph-based route computation (networkx)
├── weather_service.py               # Live weather + disaster alert ticker
├── fleet_manager.py                 # Fleet/convoy tracking & rerouting logic
├── emergency_dispatch.py            # SOS complaint creation & facility dispatch
├── generate_road_geometries.py      # Generates/caches real-world road geometries
├── road_geometry_cache.json         # Cached road geometry data
├── ne_disaster.db                   # SQLite database (incidents, camps, fleet, etc.)
├── static/                          # Frontend assets (CSS, JS, images)
├── uploads/                         # User-uploaded hazard/SITREP photos
├── index.html                       # Main frontend entry page
├── dossier.html                     # Project technical dossier page
├── AapdaMarg-NE.apk                 # Android companion app
├── AapdaMarg_NE_Technical_Dossier_Hackathon_Guide.pdf
├── requirements.txt                 # Python dependencies
├── run.bat                          # Windows launch script (dev use only, still needs internet)
├── vercel.json                      # Vercel deployment config
├── test_backend.py                  # Backend unit/integration tests
├── test_e2e.py                      # End-to-end tests
├── test_fleet_system.py             # Fleet system tests
└── test_sos_system.py               # SOS/emergency dispatch tests
```

---

## ⚙️ Running the Project

### Recommended: use the live deployment
The simplest and intended way to use AapdaMarg NE is through the deployed site:
👉 **https://sih-project-navy.vercel.app**

No installation is required, and this is the version judges/evaluators should use for SIH2026.

### For local development only
Running locally is only meant for development/debugging — it still requires an internet connection for weather data and map tiles, and is **not** a way to use the app offline.

**Prerequisites:** Python 3.9+, `pip`

```bash
# 1. Clone the repository
git clone https://github.com/krishnaktech/sih-project.git
cd sih-project

# 2. (Recommended) create a virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the server
run.bat                      # Windows
# or manually:
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The app initializes its SQLite database on first run and seeds it with baseline North East India data if empty. Visit **http://127.0.0.1:8000** once running.

---

## 🔌 API Reference

Base URL (local dev): `http://127.0.0.1:8000` · Base URL (live): `https://sih-project-navy.vercel.app`

### Geography & Hazards
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/nodes` | List all NE India city nodes with coordinates, states, elevation, plus hazard types & severity levels |
| `GET` | `/api/hazards` | Active incidents, damaged structures, and predefined high-risk flood/landslide zones |

### Weather
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/weather` | Weather feed for all cities + disaster alert ticker |
| `GET` | `/api/weather/{city_id}` | Live weather for a specific city |

### Routing
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/route` | Compute direct & safest routes between an `origin` and `destination`, given a `vehicle_mode` |

### Crowdsourced Reports
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/reports` | List active hazard reports |
| `POST` | `/api/reports` | Submit a new hazard report (with optional photo upload) |
| `POST` | `/api/reports/{id}/upvote` | Upvote a report |
| `POST` | `/api/reset-data` | Reset the database to baseline demo data |

### Emergency & SOS
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/emergency` | Relief camps and emergency contacts |
| `GET` | `/api/emergency/facilities` | Nearby emergency facilities (optionally filtered by type) |
| `POST` | `/api/complaints` | Create an automated SOS/emergency complaint (dispatches to nearest facility) |
| `GET` | `/api/complaints` | List emergency complaints |
| `POST` | `/api/complaints/{id}/status` | Update a complaint's status |

### Fleet & Logistics
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/fleet` | List all tracked fleet vehicles |
| `POST` | `/api/fleet/{vehicle_id}/reroute` | Reroute a convoy around a hazard |
| `GET` | `/api/alerts/logistics` | Logistics alerts |
| `GET` | `/api/dashboard/stats` | Command dashboard summary |

### Field Operations
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/sitreps` | List field situation reports |
| `POST` | `/api/sitreps` | Submit a field SITREP (corridor status, passability, bridge condition, photo) |

### Amenities & App
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/amenities` | Nearby hotels, restaurants, petrol pumps (optionally filtered by category) |
| `GET` | `/download/apk` or `/AapdaMarg-NE.apk` | Download the Android app (requires internet to function) |

> Full interactive API docs are available at `/docs` (Swagger UI) once the server is running.

---

## 🧪 Testing

```bash
python test_backend.py       # Core backend logic
python test_e2e.py           # End-to-end flow tests
python test_fleet_system.py  # Fleet management & rerouting
python test_sos_system.py    # Emergency SOS dispatch
```

---

## 🚀 Deployment

The project is deployed on **Vercel** using `vercel.json` and is live at:
👉 https://sih-project-navy.vercel.app

Since the app depends on live weather data, real-time hazard reports, and a running backend, any redeployment must keep the FastAPI ASGI app (`main:app`) and its data services online — this project is **not designed for offline distribution**.

---

## 📱 Mobile App

An Android companion app is bundled in the repo as `AapdaMarg-NE.apk` and can be downloaded from the running server at `/AapdaMarg-NE.apk`. Like the web app, it connects to the live backend for weather, hazards, and routing data and **will not function without an internet connection**.

---

## 📄 Documentation

- **Technical Dossier:** [`AapdaMarg_NE_Technical_Dossier_Hackathon_Guide.pdf`](./AapdaMarg_NE_Technical_Dossier_Hackathon_Guide.pdf) — full SIH2026 technical write-up
- **Dossier page:** `dossier.html`

---

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m "Add your feature"`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## 📜 License

No license file is currently specified in this repository. Please contact the repository owner ([krishnaktech](https://github.com/krishnaktech)) for usage terms.

---

## 🙏 Acknowledgements

Built for **Smart India Hackathon 2026 (SIH2026)** under **Problem Statement ID SIH26002**, addressing disaster-resilience and navigation challenges faced by communities across North East India — including Assam, Meghalaya, Sikkim, and neighboring states — during recurring flood and landslide events.
