import json
import math
from database import get_db
from routing_engine import haversine_distance, routing_engine
from config import NE_CITIES

class FleetLogisticsManager:
    def get_all_vehicles(self):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM fleet_vehicles ORDER BY id ASC")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return rows

    def get_logistics_alerts(self):
        vehicles = self.get_all_vehicles()
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM incidents WHERE status = 'active'")
        incidents = [dict(r) for r in cursor.fetchall()]
        cursor.execute("SELECT * FROM damaged_structures")
        structures = [dict(r) for r in cursor.fetchall()]
        conn.close()

        alerts = []

        # 1. Automated Blockade & Delivery Delay Alerts per Vehicle
        for v in vehicles:
            v_lat, v_lng = v["current_lat"], v["current_lng"]
            
            # Check proximity to incidents
            for inc in incidents:
                dist = haversine_distance(v_lat, v_lng, inc["latitude"], inc["longitude"])
                if dist <= 18.0 and inc["severity"] in ["high", "critical"]:
                    alerts.append({
                        "id": f"convoy_delay_{v['vehicle_id']}_{inc['id']}",
                        "alert_type": "delivery_delayed",
                        "severity": "critical",
                        "vehicle_id": v["vehicle_id"],
                        "cargo_type": v["cargo_type"],
                        "title": f"🚨 DELIVERY IMPASSE: {v['cargo_type'].replace('_', ' ').title()} Convoy ({v['vehicle_id']}) Blocked",
                        "message": f"Convoy carrying {v['cargo_desc']} is {dist:.1f} km from active hazard: '{inc['title']}'. Delivery to {v['destination'].title()} delayed.",
                        "corridor": inc.get("title", ""),
                        "distance_km": round(dist, 1),
                        "suggested_action": "Execute automated detour via alternative safe corridor immediately."
                    })

            # Check proximity to damaged bridges / collapsed structures
            for st in structures:
                if st.get("passability") in ["closed", "4x4_only"]:
                    dist = haversine_distance(v_lat, v_lng, st["latitude"], st["longitude"])
                    if dist <= 15.0:
                        alerts.append({
                            "id": f"struct_blocked_{v['vehicle_id']}_{st['id']}",
                            "alert_type": "blocked_road",
                            "severity": "critical" if st.get("passability") == "closed" else "warning",
                            "vehicle_id": v["vehicle_id"],
                            "cargo_type": v["cargo_type"],
                            "title": f"🛑 BRIDGE IMPASSABLE: {st['name']} ({st['passability'].upper()})",
                            "message": f"Heavy vehicle restrictions on {st['route_name']}. Convoy {v['vehicle_id']} cannot proceed safely.",
                            "corridor": st['route_name'],
                            "distance_km": round(dist, 1),
                            "suggested_action": f"Bypass advisory: {st.get('alternate_bypass', 'Detour via secondary highway')}"
                        })

        # 2. Automated Inaccessible Regions & Isolated Hamlets Alerts
        isolated_zones = [
            {"region": "Barak Valley & Tripura Border", "hazard": "Sonapur Tunnel Landslide", "status": "Surface Link Cut Off", "corridor": "NH-6", "severity": "critical"},
            {"region": "Majuli River Island", "hazard": "Brahmaputra Flood Surge", "status": "Ferry Operations Suspended", "corridor": "Nimati Ghat", "severity": "high"},
            {"region": "Sikkim Lifeline (Teesta Valley)", "hazard": "NH-10 Pagla Jhora Debris Slide", "status": "Heavy Truck Movement Barred", "corridor": "NH-10", "severity": "high"}
        ]
        for z in isolated_zones:
            alerts.append({
                "id": f"isolated_{z['region'].lower().replace(' ', '_')}",
                "alert_type": "inaccessible_region",
                "severity": z["severity"],
                "vehicle_id": "REGIONAL_ALERT",
                "cargo_type": "all_commodities",
                "title": f"🏝️ INACCESSIBLE REGION: {z['region']} ({z['status']})",
                "message": f"Regular supply lines severed due to {z['hazard']}. Emergency air-drop or alternative mountain corridor activation required.",
                "corridor": z["corridor"],
                "distance_km": 0,
                "suggested_action": "Divert supply convoys to certified relief distribution depots."
            })

        return alerts

    def reroute_convoy(self, vehicle_id: str):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM fleet_vehicles WHERE vehicle_id = ?", (vehicle_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return {"success": False, "error": "Vehicle not found"}
        
        v = dict(row)
        origin = v["origin"]
        dest = v["destination"]

        # Compute safest route using routing engine
        routes = routing_engine.compute_routes(origin, dest, "emergency_convoy")
        safest = routes.get("safest_route")

        if safest:
            new_nodes = json.dumps(safest["path_nodes"])
            new_eta = safest["estimated_time_hours"]
            new_status = "rerouted"
            alert_msg = f"🛡️ Safely Rerouted via {', '.join([n.title() for n in safest['path_nodes']])}. Detour ETA: {new_eta} hrs."

            cursor.execute("""
                UPDATE fleet_vehicles
                SET status = ?, eta_hours = ?, hazard_alert = ?, route_nodes = ?, last_updated = CURRENT_TIMESTAMP
                WHERE vehicle_id = ?
            """, (new_status, new_eta, alert_msg, new_nodes, vehicle_id))
            conn.commit()
            conn.close()
            return {
                "success": True,
                "message": f"Convoy {vehicle_id} rerouted successfully along safest corridor.",
                "new_route": safest["path_nodes"],
                "eta_hours": new_eta
            }
        
        conn.close()
        return {"success": False, "error": "No alternate safe path available"}

    def get_dashboard_summary(self):
        vehicles = self.get_all_vehicles()
        alerts = self.get_logistics_alerts()

        # Count by status
        status_counts = {"in_transit": 0, "delayed": 0, "stranded": 0, "rerouted": 0, "delivered": 0}
        cargo_counts = {"medicines": 0, "agricultural_produce": 0, "construction_materials": 0, "fuel_tanker": 0, "emergency_rations": 0}

        for v in vehicles:
            st = v.get("status", "in_transit")
            status_counts[st] = status_counts.get(st, 0) + 1
            cg = v.get("cargo_type", "emergency_rations")
            cargo_counts[cg] = cargo_counts.get(cg, 0) + 1

        # District Stock & Reserve Estimates (Days Remaining)
        district_stocks = [
            {"district": "Cachar / Silchar", "state": "Assam", "fuel_days": 2.5, "food_days": 4.0, "medicine_status": "Critical", "flood_threat": "High"},
            {"district": "East Jaintia Hills", "state": "Meghalaya", "fuel_days": 3.0, "food_days": 6.5, "medicine_status": "Moderate", "flood_threat": "Landslide"},
            {"district": "Pakyong / East Sikkim", "state": "Sikkim", "fuel_days": 4.0, "food_days": 5.0, "medicine_status": "Adequate", "flood_threat": "Landslide"},
            {"district": "Golaghat (Kaziranga)", "state": "Assam", "fuel_days": 6.5, "food_days": 8.0, "medicine_status": "Adequate", "flood_threat": "Severe Flood"},
            {"district": "Aizawl", "state": "Mizoram", "fuel_days": 4.5, "food_days": 6.0, "medicine_status": "Moderate", "flood_threat": "Low-Moderate"}
        ]

        # Critical Corridors Status
        corridors = [
            {"name": "NH-6 (Guwahati - Shillong - Silchar)", "status": "BLOCKED AT SONAPUR", "risk": 85, "badge": "bg-red-600"},
            {"name": "NH-27 (Guwahati - Lumding - Haflong - Silchar)", "status": "OPEN (RECOMMENDED DETOUR)", "risk": 24, "badge": "bg-emerald-600"},
            {"name": "NH-715 (Kaziranga Flood Stretch)", "status": "RESTRICTED (4x4 & ESCORT)", "risk": 68, "badge": "bg-amber-600"},
            {"name": "NH-10 (Siliguri - Teesta - Gangtok)", "status": "SINGLE LANE CONVOY", "risk": 58, "badge": "bg-orange-600"},
            {"name": "NH-29 (Dimapur - Kohima - Imphal)", "status": "PASSABLE WITH CAUTION", "risk": 38, "badge": "bg-yellow-600"}
        ]

        return {
            "total_convoys": len(vehicles),
            "status_breakdown": status_counts,
            "cargo_breakdown": cargo_counts,
            "critical_alerts_count": len([a for a in alerts if a.get("severity") == "critical"]),
            "district_reserves": district_stocks,
            "corridor_health": corridors,
            "active_alerts": alerts[:8] # top 8
        }

fleet_manager = FleetLogisticsManager()
