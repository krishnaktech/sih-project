import math
import datetime
from database import get_db

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class EmergencyDispatchEngine:
    def __init__(self):
        pass

    def get_facilities(self, facility_type: str = None):
        conn = get_db()
        cursor = conn.cursor()
        if facility_type:
            cursor.execute("SELECT * FROM emergency_facilities WHERE facility_type = ? ORDER BY state, name", (facility_type,))
        else:
            cursor.execute("SELECT * FROM emergency_facilities ORDER BY facility_type, state, name")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return rows

    def find_nearest_facility(self, lat: float, lng: float, facility_type: str):
        facilities = self.get_facilities(facility_type)
        if not facilities:
            return None, float('inf')

        closest = None
        min_dist = float('inf')

        for fac in facilities:
            dist = haversine_distance(lat, lng, fac["latitude"], fac["longitude"])
            if dist < min_dist:
                min_dist = dist
                closest = fac

        return closest, round(min_dist, 1)

    def dispatch_emergency(self, complaint: dict) -> dict:
        c_type = complaint.get("complaint_type", "ambulance").lower()
        lat = float(complaint.get("latitude"))
        lng = float(complaint.get("longitude"))
        caller_name = complaint.get("caller_name", "Emergency Caller")
        caller_phone = complaint.get("caller_phone", "Unknown")
        emergency_nature = complaint.get("emergency_nature", "trauma_injury")
        location_address = complaint.get("location_address", "North East Sector")
        severity = complaint.get("severity", "critical")
        details = complaint.get("details", "")

        primary_type = "police_station" if c_type == "police" else "hospital_ambulance"
        nearest_primary, primary_dist = self.find_nearest_facility(lat, lng, primary_type)

        secondary_facility = None
        secondary_dist = 0.0
        secondary_unit = None

        if c_type == "both":
            nearest_police, sec_dist = self.find_nearest_facility(lat, lng, "police_station")
            secondary_facility = nearest_police
            secondary_dist = sec_dist
            secondary_unit = f"Highway PCR Patrol ({secondary_facility['name']}) - SI Escort"

        eta_minutes = max(5, int((primary_dist / 40.0) * 60) + 3)

        if primary_type == "hospital_ambulance":
            assigned_unit = f"108 ALS Ambulance (Team: {nearest_primary['nodal_officer']})"
        else:
            assigned_unit = f"Rapid Response PCR-01 ({nearest_primary['name']})"

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO emergency_complaints (
                complaint_type, emergency_nature, caller_name, caller_phone,
                latitude, longitude, location_address, severity, details,
                assigned_facility_id, assigned_facility_name, assigned_facility_type,
                distance_km, eta_minutes, assigned_unit, dispatch_status,
                secondary_facility_name, secondary_unit, alert_sent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'dispatched', ?, ?, 1)
        """, (
            c_type, emergency_nature, caller_name, caller_phone,
            lat, lng, location_address, severity, details,
            nearest_primary["id"] if nearest_primary else None,
            nearest_primary["name"] if nearest_primary else "State Control Room",
            primary_type, primary_dist, eta_minutes, assigned_unit,
            secondary_facility["name"] if secondary_facility else None,
            secondary_unit
        ))
        new_id = cursor.lastrowid
        conn.commit()

        cursor.execute("SELECT * FROM emergency_complaints WHERE id = ?", (new_id,))
        created_complaint = dict(cursor.fetchone())
        conn.close()

        alert_transmission = {
            "ticket_id": f"SOS-{new_id:04d}",
            "broadcast_status": "TRANSMITTED_SUCCESSFULLY",
            "transmission_method": "POLNET / 108 CAD Integrated Dispatch Gateway",
            "primary_responder": {
                "station_name": nearest_primary["name"] if nearest_primary else "Emergency HQ",
                "facility_type": primary_type,
                "district": nearest_primary["district"] if nearest_primary else "State",
                "state": nearest_primary["state"] if nearest_primary else "NE",
                "contact_phone": nearest_primary["phone"] if nearest_primary else "112",
                "emergency_line": nearest_primary["emergency_line"] if nearest_primary else "112",
                "distance_km": primary_dist,
                "eta_minutes": eta_minutes,
                "assigned_unit": assigned_unit,
                "station_lat": nearest_primary["latitude"] if nearest_primary else lat,
                "station_lng": nearest_primary["longitude"] if nearest_primary else lng
            },
            "secondary_responder": {
                "station_name": secondary_facility["name"],
                "distance_km": secondary_dist,
                "assigned_unit": secondary_unit,
                "station_lat": secondary_facility["latitude"],
                "station_lng": secondary_facility["longitude"]
            } if secondary_facility else None,
            "victim_location": {
                "lat": lat,
                "lng": lng,
                "address": location_address
            },
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S IST, %d %b %Y")
        }

        return {
            "success": True,
            "message": f"Emergency alert broadcast sent to nearest {primary_type.replace('_', ' ')}: {nearest_primary['name']}",
            "complaint": created_complaint,
            "alert_dispatch": alert_transmission
        }

    def get_complaints(self):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM emergency_complaints ORDER BY created_at DESC")
        complaints = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return complaints

    def update_complaint_status(self, complaint_id: int, status: str):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("UPDATE emergency_complaints SET dispatch_status = ? WHERE id = ?", (status, complaint_id))
        conn.commit()
        cursor.execute("SELECT * FROM emergency_complaints WHERE id = ?", (complaint_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

emergency_dispatch = EmergencyDispatchEngine()
