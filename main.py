import os
import uuid
import shutil
import json
import urllib.request
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import UPLOAD_DIR, STATIC_DIR, NE_CITIES, HAZARD_TYPES, SEVERITY_LEVELS
from database import get_db, init_db
from routing_engine import routing_engine, haversine_distance
from weather_service import get_all_weather, get_live_weather, get_disaster_ticker_alerts
import seed_data

app = FastAPI(
    title="Aapda Marg - North East India Disaster Resilience & Navigation",
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

@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

# Mount static and upload directories
app.mount("/static", NoCacheStaticFiles(directory=STATIC_DIR), name="static")
app.mount("/uploads", NoCacheStaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/css", NoCacheStaticFiles(directory=os.path.join(STATIC_DIR, "css")), name="css")
app.mount("/js", NoCacheStaticFiles(directory=os.path.join(STATIC_DIR, "js")), name="js")
app.mount("/images", NoCacheStaticFiles(directory=os.path.join(STATIC_DIR, "images")), name="images")

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
        response = FileResponse(index_file)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response
    return {"message": "Aapda Marg API is running. index.html is being initialized."}

@app.get("/download/apk")
@app.get("/AapdaMarg-NE.apk")
def download_apk():
    apk_file = os.path.join(os.path.dirname(__file__), "AapdaMarg-NE.apk")
    if os.path.exists(apk_file):
        return FileResponse(
            apk_file,
            filename="AapdaMarg-NE.apk",
            media_type="application/vnd.android.package-archive"
        )
    raise HTTPException(status_code=404, detail="APK file not found.")

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
    print(f"DEBUG_ROUTE: origin={req.origin}, destination={req.destination}, vehicle_mode={req.vehicle_mode}", flush=True)
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
    safe_time = result.get('safest_route', {}).get('estimated_time_hours')
    direct_time = result.get('direct_route', {}).get('estimated_time_hours')
    print(f"DEBUG_ROUTE RESULT: safe_time={safe_time} hrs, direct_time={direct_time} hrs", flush=True)
    return result

# ----------------- User Real-Time Network Geolocation Fallback -----------------

@app.get("/api/user-location")
def get_user_current_location(request: Request):
    # 1. Cloudflare edge geolocation headers (passed automatically over trycloudflare tunnel)
    cf_lat = request.headers.get("cf-iplatitude")
    cf_lng = request.headers.get("cf-iplongitude")
    cf_city = request.headers.get("cf-ipcity")
    cf_country = request.headers.get("cf-ipcountry")
    if cf_lat and cf_lng:
        try:
            lat = float(cf_lat)
            lng = float(cf_lng)
            loc_name = f"{cf_city}, {cf_country}" if cf_city else "Current Network Location"
            return {
                "success": True,
                "lat": lat,
                "lng": lng,
                "name": loc_name,
                "source": "cloudflare_edge"
            }
        except Exception:
            pass

    # 2. IP lookup based on client IP
    client_ip = request.headers.get("cf-connecting-ip") or request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")
    if client_ip and "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
    
    if client_ip and client_ip not in ["127.0.0.1", "localhost", "::1"]:
        try:
            req = urllib.request.Request(
                f"http://ip-api.com/json/{client_ip}?fields=status,message,country,regionName,city,lat,lon",
                headers={"User-Agent": "AapdaMargServer/1.0"}
            )
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                data = json.loads(resp.read().decode())
                if data.get("status") == "success" and "lat" in data and "lon" in data:
                    city = data.get("city") or data.get("regionName") or "User Location"
                    return {
                        "success": True,
                        "lat": float(data["lat"]),
                        "lng": float(data["lon"]),
                        "name": f"{city}, {data.get('country', 'India')}",
                        "source": "ip_telemetry"
                    }
        except Exception as e:
            print("IP geolocation lookup error:", e)

    # 3. Server egress IP lookup
    try:
        req = urllib.request.Request(
            "http://ip-api.com/json/?fields=status,message,country,regionName,city,lat,lon",
            headers={"User-Agent": "AapdaMargServer/1.0"}
        )
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode())
            if data.get("status") == "success" and "lat" in data and "lon" in data:
                city = data.get("city") or data.get("regionName") or "User Location"
                return {
                    "success": True,
                    "lat": float(data["lat"]),
                    "lng": float(data["lon"]),
                    "name": f"{city}, {data.get('country', 'India')}",
                    "source": "public_egress"
                }
    except Exception:
        pass

    return {
        "success": False,
        "lat": 26.1445,
        "lng": 91.7362,
        "name": "Guwahati Regional Center",
        "source": "default"
    }

# ----------------- Reverse Geocoding (Real Location like Google Maps) -----------------

GEOCODE_CACHE = {}

def local_regional_geocode(lat: float, lng: float):
    # Find closest North East city / landmark
    closest_node = min(
        NE_CITIES.keys(),
        key=lambda k: haversine_distance(lat, lng, NE_CITIES[k]["lat"], NE_CITIES[k]["lng"])
    )
    city_info = NE_CITIES[closest_node]
    dist_km = round(haversine_distance(lat, lng, city_info["lat"], city_info["lng"]), 1)
    
    dlat = lat - city_info["lat"]
    dlng = lng - city_info["lng"]
    ns = "North" if dlat > 0.02 else ("South" if dlat < -0.02 else "")
    ew = "East" if dlng > 0.02 else ("West" if dlng < -0.02 else "")
    direction = f"{ns} {ew}".strip()
    direction_str = f"({dist_km} km {direction} of {city_info['name']})" if dist_km > 0.5 and direction else (f"Near {city_info['name']}" if dist_km > 0.3 else f"{city_info['name']}")

    return {
        "display_name": f"{direction_str}, {city_info.get('state', 'North East')}, India",
        "short_name": f"{city_info['name'].split(' (')[0]} Area",
        "road": f"Sector Road ({dist_km} km from {city_info['name'].split(' (')[0]})",
        "suburb": city_info["name"].split(" (")[0],
        "city": city_info["name"].split(" (")[0],
        "district": city_info.get("state", "North East"),
        "state": city_info.get("state", "Assam"),
        "postcode": "",
        "country": "India",
        "lat": lat,
        "lng": lng,
        "nearest_hub": city_info["name"],
        "distance_to_hub_km": dist_km,
        "source": "regional_gis"
    }

@app.get("/api/geocode/reverse")
async def reverse_geocode_api(lat: float, lng: float):
    if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lng <= 180.0):
        raise HTTPException(status_code=400, detail="Invalid coordinates: latitude must be [-90, 90] and longitude [-180, 180]")

    cache_key = f"{round(lat, 5)},{round(lng, 5)}"
    if cache_key in GEOCODE_CACHE:
        return GEOCODE_CACHE[cache_key]

    # Attempt online OSM Nominatim lookup for high precision street/landmark address
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json&zoom=18&addressdetails=1"
        req = urllib.request.Request(url, headers={"User-Agent": "RouteRakshak-DisasterNav/1.0 (RealTime-GIS)"})
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            addr = data.get("address", {})
            
            # Format clean short and full names
            road = addr.get("road") or addr.get("pedestrian") or addr.get("highway") or ""
            neighbourhood = addr.get("suburb") or addr.get("neighbourhood") or addr.get("village") or addr.get("town") or ""
            city = addr.get("city") or addr.get("town") or addr.get("county") or addr.get("state_district") or ""
            district = addr.get("state_district") or addr.get("county") or ""
            state = addr.get("state") or ""
            postcode = addr.get("postcode") or ""
            country = addr.get("country") or "India"

            parts = [p for p in [road, neighbourhood, city, state] if p]
            short_name = ", ".join(parts[:2]) if len(parts) >= 2 else (city or state or "Location")

            # Find closest NE hub
            closest_node = min(
                NE_CITIES.keys(),
                key=lambda k: haversine_distance(lat, lng, NE_CITIES[k]["lat"], NE_CITIES[k]["lng"])
            )
            hub_info = NE_CITIES[closest_node]
            hub_dist = round(haversine_distance(lat, lng, hub_info["lat"], hub_info["lng"]), 1)

            res = {
                "display_name": data.get("display_name", f"{short_name}, {state}"),
                "short_name": short_name,
                "road": road,
                "suburb": neighbourhood,
                "city": city,
                "district": district,
                "state": state,
                "postcode": postcode,
                "country": country,
                "lat": lat,
                "lng": lng,
                "nearest_hub": hub_info["name"],
                "distance_to_hub_km": hub_dist,
                "source": "osm_nominatim"
            }
            GEOCODE_CACHE[cache_key] = res
            return res
    except Exception as e:
        print(f"Notice: Nominatim lookup error ({e}), using local GIS fallback.")

    # Fallback to local regional geocoder
    fallback = local_regional_geocode(lat, lng)
    GEOCODE_CACHE[cache_key] = fallback
    return fallback

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

@app.delete("/api/reports/{report_id}")
@app.delete("/api/hazards/{report_id}")
def delete_report(
    report_id: int, 
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    role: Optional[str] = None
):
    user_role = (x_user_role or role or "").lower().strip()
    if user_role != "headquarters":
        raise HTTPException(
            status_code=403, 
            detail="Unauthorized: Only Headquarters personnel have clearance to remove hazard reports."
        )
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, title FROM incidents WHERE id = ?", (report_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Incident hazard report not found.")
    
    cursor.execute("DELETE FROM incidents WHERE id = ?", (report_id,))
    conn.commit()
    conn.close()
    return {
        "success": True, 
        "message": f"Hazard incident #{report_id} ('{row['title']}') successfully removed by Headquarters."
    }

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

@app.delete("/api/sitreps/{sitrep_id}")
def delete_sitrep(
    sitrep_id: int,
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    role: Optional[str] = None
):
    user_role = (x_user_role or role or "").lower().strip()
    if user_role != "headquarters":
        raise HTTPException(
            status_code=403,
            detail="Unauthorized: Only Headquarters personnel have clearance to remove field SITREPs."
        )
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, corridor FROM field_sitreps WHERE id = ?", (sitrep_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Field SITREP not found.")
    
    cursor.execute("DELETE FROM field_sitreps WHERE id = ?", (sitrep_id,))
    conn.commit()
    conn.close()
    return {
        "success": True,
        "message": f"Field SITREP #{sitrep_id} ('{row['corridor']}') successfully removed by Headquarters."
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

@app.delete("/api/complaints/{complaint_id}")
def delete_emergency_complaint(
    complaint_id: int,
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    role: Optional[str] = None
):
    user_role = (x_user_role or role or "").lower().strip()
    if user_role != "headquarters":
        raise HTTPException(
            status_code=403,
            detail="Unauthorized: Only Headquarters personnel have clearance to remove emergency complaints."
        )
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, location_address FROM emergency_complaints WHERE id = ?", (complaint_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Emergency complaint record not found.")
    cursor.execute("DELETE FROM emergency_complaints WHERE id = ?", (complaint_id,))
    conn.commit()
    conn.close()
    return {
        "success": True,
        "message": f"Emergency complaint #{complaint_id} successfully removed by Headquarters."
    }

