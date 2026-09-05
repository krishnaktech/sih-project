import os
import uuid
import shutil
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import UPLOAD_DIR, STATIC_DIR, NE_CITIES, HAZARD_TYPES, SEVERITY_LEVELS
from database import get_db, init_db
from routing_engine import routing_engine
from weather_service import get_all_weather, get_live_weather, get_disaster_ticker_alerts
import seed_data

app = FastAPI(
    title="AapdaMarg NE - North East India Disaster Resilience & Navigation",
    description="Adaptive route navigation, flood and landslide risk assessment, real-time weather alerts, and crowdsourced hazard reporting for North East India.",
    version="1.0.0"
)

# Enable CORS for flexible access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static and upload directories
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.on_event("startup")
def startup_event():
    init_db()
    # Check if DB has data; if empty, seed it
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT count(*) as count FROM incidents")
    row = cursor.fetchone()
    if row["count"] == 0:
        print("Database is empty. Populating with realistic North East baseline data...")
        seed_data.seed_database()
    conn.close()

@app.get("/")
def read_root():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "AapdaMarg NE API is running. index.html is being initialized."}

# ----------------- Nodes & Geographic Metadata -----------------

@app.get("/api/nodes")
def get_nodes():
    nodes_list = []
    for k, v in NE_CITIES.items():
        nodes_list.append({
            "id": k,
            "name": v["name"],
            "lat": v["lat"],
            "lng": v["lng"],
            "state": v["state"],
            "elevation": v["elevation"]
        })
    return {
        "nodes": sorted(nodes_list, key=lambda x: (x["state"], x["name"])),
        "hazard_types": HAZARD_TYPES,
        "severity_levels": SEVERITY_LEVELS
    }

# ----------------- Hazards & Damaged Structures -----------------

@app.get("/api/hazards")
def get_hazards():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM incidents WHERE status = 'active' ORDER BY created_at DESC")
    incidents = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT * FROM damaged_structures ORDER BY id ASC")
    structures = [dict(row) for row in cursor.fetchall()]

    conn.close()

    # Predefined high-risk disaster corridors/polygons (GeoJSON style)
    risk_zones = [
        {
            "id": "brahmaputra_floodplain",
            "name": "Brahmaputra Flood Basin (Kaziranga - Majuli Sector)",
            "type": "flood_zone",
            "danger_level": "critical",
            "description": "Annual monsoonal inundation zone. Water level exceeding danger mark at Neamatighat. High animal crossing and highway submerged.",
            "color": "#2563eb",
            "coordinates": [
                [26.50, 93.00], [26.75, 93.15], [26.98, 94.25], [26.85, 94.35], [26.45, 93.25]
            ]
        },
        {
            "id": "jaintia_sonapur_slide_zone",
            "name": "NH-6 Sonapur - Ratacherra Landslide Corridor",
            "type": "landslide_zone",
            "danger_level": "critical",
            "description": "Fragile shale and mudstone mountain cutting. Heavy rainfall triggers debris avalanches over Sonapur Tunnel.",
            "color": "#ea580c",
            "coordinates": [
                [25.05, 92.30], [25.18, 92.33], [25.15, 92.42], [25.03, 92.38]
            ]
        },
        {
            "id": "teesta_gorge_nh10",
            "name": "NH-10 Teesta River Gorge Sinking Zone (Sikkim Lifeline)",
            "type": "landslide_zone",
            "danger_level": "severe",
            "description": "Active sliding at 29th Mile and Pagla Jhora. Severe erosion of river embankment and shooting boulders.",
            "color": "#d97706",
            "coordinates": [
                [26.90, 88.42], [27.15, 88.45], [27.20, 88.52], [26.95, 88.48]
            ]
        },
        {
            "id": "barak_valley_basin",
            "name": "Barak Valley Lowland Inundation Zone (Cachar - Silchar)",
            "type": "flood_zone",
            "danger_level": "severe",
            "description": "Barak river and tributaries backflow into residential and highway arterial corridors.",
            "color": "#0284c7",
            "coordinates": [
                [24.75, 92.65], [24.95, 92.70], [24.90, 92.95], [24.70, 92.90]
            ]
        }
    ]

    return {
        "incidents": incidents,
        "damaged_structures": structures,
        "high_risk_zones": risk_zones
    }

# ----------------- Weather & Telemetry -----------------

@app.get("/api/weather")
def get_weather_feed():
    all_weather = get_all_weather()
    ticker = get_disaster_ticker_alerts()
    return {
        "weather_reports": all_weather,
        "alerts_ticker": ticker
    }

@app.get("/api/weather/{city_id}")
def get_city_weather(city_id: str):
    data = get_live_weather(city_id)
    if not data:
        raise HTTPException(status_code=404, detail="City telemetry not found")
    return data

# ----------------- Emergency Helplines & Relief Camps -----------------

@app.get("/api/emergency")
def get_emergency_info():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM relief_camps ORDER BY id ASC")
    camps = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT * FROM emergency_contacts ORDER BY id ASC")
    contacts = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return {
        "relief_camps": camps,
        "emergency_contacts": contacts
    }

# ----------------- Smart Route Planning -----------------

class RouteRequest(BaseModel):
    origin: str
    destination: str
    vehicle_mode: Optional[str] = "standard"

@app.post("/api/route")
def calculate_route(req: RouteRequest):
    weather_dict = {}
    for item in get_all_weather():
        weather_dict[item["city_id"]] = item

    result = routing_engine.compute_routes(
        origin=req.origin,
        destination=req.destination,
        vehicle_mode=req.vehicle_mode or "standard",
        weather_data=weather_dict
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

# ----------------- Crowdsourced Reporting & Photo Upload -----------------

@app.get("/api/reports")
def get_reports():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incidents WHERE status = 'active' ORDER BY created_at DESC")
    reports = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"reports": reports}

@app.post("/api/reports")
async def create_report(
    hazard_type: str = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    latitude: float = Form(...),
    longitude: float = Form(...),
    severity: str = Form("medium"),
    nearest_node: Optional[str] = Form(""),
    reporter_name: str = Form("Citizen Responder"),
    photo: Optional[UploadFile] = File(None)
):
    photo_url = None
    if photo and photo.filename:
        # Generate safe unique filename
        ext = os.path.splitext(photo.filename)[1].lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
            ext = ".jpg"
        file_id = f"{uuid.uuid4().hex[:10]}{ext}"
        saved_path = os.path.join(UPLOAD_DIR, file_id)

        with open(saved_path, "wb") as buffer:
            shutil.copyfileobj(photo.file, buffer)
        photo_url = f"/uploads/{file_id}"
    else:
        # Assign thematic graphic if no photo was attached
        type_defaults = {
            "landslide": "/static/images/sonapur_landslide.svg",
            "flood": "/static/images/kaziranga_flood.svg",
            "damaged_bridge": "/static/images/damaged_bridge.svg",
            "road_collapse": "/static/images/road_collapse.svg",
            "cloudburst": "/static/images/kaziranga_flood.svg",
            "heavy_debris": "/static/images/teesta_landslide.svg"
        }
        photo_url = type_defaults.get(hazard_type, "/static/images/sonapur_landslide.svg")

    # Save to database
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO incidents (hazard_type, title, description, latitude, longitude, nearest_node, severity, photo_url, reporter_name, upvotes, verified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
    """, (hazard_type, title, description, latitude, longitude, nearest_node, severity, photo_url, reporter_name))
    new_id = cursor.lastrowid
    conn.commit()

    cursor.execute("SELECT * FROM incidents WHERE id = ?", (new_id,))
    new_incident = dict(cursor.fetchone())
    conn.close()

    return {
        "success": True,
        "message": "Hazard report and photo successfully uploaded. Active routing network updated.",
        "incident": new_incident
    }

@app.post("/api/reports/{report_id}/upvote")
def upvote_report(report_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE incidents SET upvotes = upvotes + 1 WHERE id = ?", (report_id,))
    conn.commit()
    cursor.execute("SELECT upvotes FROM incidents WHERE id = ?", (report_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"success": True, "upvotes": row["upvotes"]}

@app.post("/api/reset-data")
def reset_mock_data():
    seed_data.seed_database()
    return {"success": True, "message": "Database reset to baseline North East scenario."}

# ----------------- Emergency Amenities (Hotels, Restaurants, Petrol Pumps) -----------------

@app.get("/api/amenities")
def get_amenities(category: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()
    if category:
        cursor.execute("SELECT * FROM amenities WHERE category = ? ORDER BY id ASC", (category,))
    else:
        cursor.execute("SELECT * FROM amenities ORDER BY category ASC, id ASC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"amenities": rows}

# ----------------- Essential Commodity Fleet Tracking -----------------

from fleet_manager import fleet_manager

@app.get("/api/fleet")
def get_fleet_vehicles():
    vehicles = fleet_manager.get_all_vehicles()
    return {"vehicles": vehicles}

@app.post("/api/fleet/{vehicle_id}/reroute")
def reroute_fleet_vehicle(vehicle_id: str):
    res = fleet_manager.reroute_convoy(vehicle_id)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Reroute failed"))
    return res

@app.get("/api/alerts/logistics")
def get_logistics_alerts():
    alerts = fleet_manager.get_logistics_alerts()
    return {"alerts": alerts}

# ----------------- Field Officials & Authority SITREPs -----------------

@app.get("/api/sitreps")
def get_field_sitreps():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM field_sitreps ORDER BY created_at DESC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"sitreps": rows}

@app.post("/api/sitreps")
async def create_field_sitrep(
    officer_name: str = Form(...),
    officer_rank: str = Form("Field Officer"),
    agency: str = Form("ASDMA"),
    corridor: str = Form(...),
    district: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    clearance_pct: int = Form(0),
    passability: str = Form("closed"),
    bridge_status: str = Form("intact"),
    notes: str = Form(""),
    photo: Optional[UploadFile] = File(None)
):
    photo_url = "/static/images/bridge_inspect.svg"
    if photo and photo.filename:
        ext = os.path.splitext(photo.filename)[1].lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
            ext = ".jpg"
        file_id = f"sitrep_{uuid.uuid4().hex[:8]}{ext}"
        saved_path = os.path.join(UPLOAD_DIR, file_id)
        with open(saved_path, "wb") as buffer:
            shutil.copyfileobj(photo.file, buffer)
        photo_url = f"/uploads/{file_id}"

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO field_sitreps (officer_name, officer_rank, agency, corridor, district, latitude, longitude, clearance_pct, passability, bridge_status, photo_url, notes, broadcast_alert)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    """, (officer_name, officer_rank, agency, corridor, district, latitude, longitude, clearance_pct, passability, bridge_status, photo_url, notes))
    new_id = cursor.lastrowid
    conn.commit()
    cursor.execute("SELECT * FROM field_sitreps WHERE id = ?", (new_id,))
    sitrep = dict(cursor.fetchone())
    conn.close()

    return {
        "success": True,
        "message": "Field SITREP submitted and emergency corridor broadcast dispatched.",
        "sitrep": sitrep
    }

# ----------------- Centralized Logistics & Readiness Dashboard -----------------

@app.get("/api/dashboard/stats")
def get_command_dashboard():
    summary = fleet_manager.get_dashboard_summary()
    return summary

# ----------------- Emergency Complaint & Automated SOS Dispatch -----------------

from emergency_dispatch import emergency_dispatch

class ComplaintRequest(BaseModel):
    complaint_type: str = "both" # police, ambulance, both
    emergency_nature: str = "immediate_danger"
    caller_name: Optional[str] = "Emergency Citizen (Auto-GPS)"
    caller_phone: Optional[str] = "Emergency Telemetry (112)"
    latitude: float
    longitude: float
    location_address: Optional[str] = "Live Satellite GPS Location"
    severity: Optional[str] = "critical"
    details: Optional[str] = "Automated Emergency SOS broadcast triggered. Geolocation automatically acquired."

class ComplaintStatusUpdate(BaseModel):
    status: str

@app.get("/api/emergency/facilities")
def get_facilities(facility_type: Optional[str] = None):
    facilities = emergency_dispatch.get_facilities(facility_type)
    return {"facilities": facilities}

@app.post("/api/complaints")
def create_emergency_complaint(req: ComplaintRequest):
    data = req.dict()
    if not data.get("caller_name"):
        data["caller_name"] = "Emergency Citizen (Auto-GPS)"
    if not data.get("caller_phone"):
        data["caller_phone"] = "Emergency Telemetry (112)"
    
    result = emergency_dispatch.dispatch_emergency(data)
    return result

@app.get("/api/complaints")
def get_emergency_complaints():
    complaints = emergency_dispatch.get_complaints()
    return {"complaints": complaints}

@app.post("/api/complaints/{complaint_id}/status")
def update_complaint_status(complaint_id: int, req: ComplaintStatusUpdate):
    updated = emergency_dispatch.update_complaint_status(complaint_id, req.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return {"success": True, "complaint": updated}
