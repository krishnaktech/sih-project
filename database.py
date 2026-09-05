import sqlite3
import json
from config import DB_PATH

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Incidents / Crowdsourced Reports Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hazard_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        nearest_node TEXT,
        severity TEXT NOT NULL DEFAULT 'medium',
        photo_url TEXT,
        reporter_name TEXT DEFAULT 'Citizen Reporter',
        upvotes INTEGER DEFAULT 1,
        verified INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Damaged Structures Table (Bridges, Culverts, Mountain Passes)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS damaged_structures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        structure_type TEXT NOT NULL,
        route_name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        damage_level TEXT NOT NULL, -- minor, structural_crack, submerged, collapsed
        passability TEXT NOT NULL, -- all, 4x4_only, light_vehicles_only, closed
        description TEXT,
        photo_url TEXT,
        alternate_bypass TEXT,
        last_inspected TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Emergency Relief Camps and Response Hubs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS relief_camps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        district TEXT NOT NULL,
        state TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        capacity INTEGER,
        current_occupancy INTEGER,
        medical_available INTEGER DEFAULT 1,
        food_water_available INTEGER DEFAULT 1,
        contact_phone TEXT,
        in_charge TEXT
    )
    """)

    # Emergency Contacts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS emergency_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency TEXT NOT NULL,
        region TEXT NOT NULL,
        phone TEXT NOT NULL,
        alt_phone TEXT,
        email TEXT,
        category TEXT NOT NULL
    )
    """)

    # Amenities Table: Hotels, Restaurants, Petrol Pumps
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS amenities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL, -- petrol_pump, hotel, restaurant
        name TEXT NOT NULL,
        highway TEXT NOT NULL,
        district TEXT,
        state TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        contact_phone TEXT,
        status TEXT NOT NULL DEFAULT 'open', -- open, limited, closed
        fuel_status TEXT DEFAULT 'normal', -- normal, low_stock, diesel_only_rescue, dry
        capacity_beds INTEGER DEFAULT 0,
        food_available INTEGER DEFAULT 1,
        generator_backup INTEGER DEFAULT 1,
        description TEXT,
        last_reported TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Essential Commodity Fleet Tracking Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS fleet_vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id TEXT UNIQUE NOT NULL, -- e.g. AS-01-MED-104
        driver_name TEXT NOT NULL,
        driver_phone TEXT NOT NULL,
        cargo_type TEXT NOT NULL, -- medicines, agricultural_produce, construction_materials, fuel_tanker, emergency_rations
        cargo_desc TEXT NOT NULL,
        origin TEXT NOT NULL,
        destination TEXT NOT NULL,
        current_lat REAL NOT NULL,
        current_lng REAL NOT NULL,
        speed_kmh REAL DEFAULT 45.0,
        status TEXT NOT NULL DEFAULT 'in_transit', -- in_transit, delayed, stranded, rerouted, delivered
        eta_hours REAL DEFAULT 4.0,
        hazard_alert TEXT, -- alert if corridor blocked
        route_nodes TEXT, -- JSON array of route nodes
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Field Officials & Authority Situation Reports (SITREPs)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS field_sitreps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        officer_name TEXT NOT NULL,
        officer_rank TEXT NOT NULL,
        agency TEXT NOT NULL, -- NDRF, BRO, ASDMA, SDRF, PWD, Police
        corridor TEXT NOT NULL,
        district TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        clearance_pct INTEGER DEFAULT 0, -- 0 to 100%
        passability TEXT NOT NULL, -- closed, 4x4_only, single_lane_escort, all_vehicles
        bridge_status TEXT, -- intact, scour_inspection, critical_crack, washed_out
        photo_url TEXT,
        notes TEXT,
        broadcast_alert INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Emergency Facilities: Police Stations, Hospitals & Ambulance Bases
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS emergency_facilities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        facility_type TEXT NOT NULL, -- police_station, hospital_ambulance
        district TEXT NOT NULL,
        state TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        phone TEXT NOT NULL,
        emergency_line TEXT NOT NULL, -- e.g. 112, 108
        units_available TEXT NOT NULL, -- e.g. "2 PCR Vans on standby", "3 ALS Ambulances"
        nodal_officer TEXT,
        operational_status TEXT DEFAULT 'active'
    )
    """)

    # Emergency Complaints & Automated SOS Dispatch Tickets
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS emergency_complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_type TEXT NOT NULL, -- police, ambulance, both
        emergency_nature TEXT NOT NULL, -- trauma_injury, stranded_flood, landslide_trapped, critical_medical, law_and_order, search_rescue
        caller_name TEXT NOT NULL,
        caller_phone TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        location_address TEXT,
        severity TEXT NOT NULL DEFAULT 'critical', -- critical, high, medium
        details TEXT,
        assigned_facility_id INTEGER,
        assigned_facility_name TEXT,
        assigned_facility_type TEXT,
        distance_km REAL,
        eta_minutes INTEGER,
        assigned_unit TEXT,
        dispatch_status TEXT NOT NULL DEFAULT 'dispatched', -- dispatched, en_route, on_scene, resolved
        secondary_facility_name TEXT, -- in case of both
        secondary_unit TEXT,
        alert_sent INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
