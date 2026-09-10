import math
import os
import json
import networkx as nx
from config import NE_CITIES, BASE_DIR
from seed_data import NE_ROAD_NETWORK
from database import get_db

CACHE_FILE = os.path.join(BASE_DIR, "road_geometry_cache.json")

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371.0 # km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def point_to_segment_distance(px, py, x1, y1, x2, y2):
    # px, py is incident lat, lng. x1, y1, x2, y2 is edge endpoints.
    # Return approx km distance from point to line segment
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return haversine_distance(px, py, x1, y1)

    t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return haversine_distance(px, py, proj_x, proj_y)

class NorthEastRoutingEngine:
    def __init__(self):
        self.graph = nx.Graph()
        self.road_cache = {}
        self._load_road_cache()
        self._build_base_graph()

    def _load_road_cache(self):
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    self.road_cache = json.load(f)
            except Exception as e:
                print(f"Warning: Could not load road geometry cache: {e}")
                self.road_cache = {}

    def _build_base_graph(self):
        self.graph.clear()
        # Add nodes
        for node_id, node_data in NE_CITIES.items():
            self.graph.add_node(
                node_id,
                name=node_data["name"],
                lat=node_data["lat"],
                lng=node_data["lng"],
                state=node_data["state"],
                elevation=node_data["elevation"]
            )

        # Add edges
        for edge in NE_ROAD_NETWORK:
            u = edge["u"]
            v = edge["v"]
            dist = edge["distance_km"]
            self.graph.add_edge(
                u, v,
                distance=dist,
                base_terrain=edge["base_terrain"],
                highway=edge["highway"],
                elevation_gain=edge["elevation_gain"]
            )

    def calculate_vehicle_speed(self, base_terrain: str, elev_gain: float, risk_info: dict, vehicle_mode: str) -> float:
        terrain_lower = (base_terrain or "plains").lower()
        is_mountainous = any(t in terrain_lower for t in ["himalayan", "steep", "rugged", "hilly", "ridge", "landslide"])
        is_flood_terrain = any(t in terrain_lower for t in ["floodplain", "river", "basin", "extreme_rain"])
        
        score = float(risk_info.get("total_risk", 0))
        elev_gain = float(elev_gain or 0)
        
        if vehicle_mode == "4x4":
            # 4x4 / SUV: High ground clearance, all-wheel drive, high torque
            # Swift on mountain highways and resilient against moderate road damage
            if is_mountainous:
                base_speed = 54.0
            elif is_flood_terrain:
                base_speed = 60.0
            else:
                base_speed = 74.0
                
            climb_penalty = (elev_gain / 100.0) * 0.008
            base_speed = base_speed * max(0.75, 1.0 - climb_penalty)
            
            risk_penalty = score / 160.0
            speed = base_speed * max(0.55, 1.0 - risk_penalty)
            return max(24.0, speed)

        elif vehicle_mode == "emergency_convoy":
            # NDRF Truck / Heavy Logistics Convoy:
            # 10-16 ton vehicles, slower on tight hairpin turns and steep mountain gradients
            if is_mountainous:
                base_speed = 32.0
            elif is_flood_terrain:
                base_speed = 38.0
            else:
                base_speed = 50.0
                
            climb_penalty = (elev_gain / 100.0) * 0.022
            base_speed = base_speed * max(0.60, 1.0 - climb_penalty)
            
            risk_penalty = score / 140.0
            speed = base_speed * max(0.45, 1.0 - risk_penalty)
            return max(16.0, speed)

        elif vehicle_mode == "foot":
            # Foot Patrol: Rescue squad marching on foot with emergency equipment
            # Human walking pace in mountain/monsoon terrain: ~3.0 - 4.8 km/h
            if is_mountainous:
                base_speed = 3.6
            elif is_flood_terrain:
                base_speed = 3.8
            else:
                base_speed = 4.8
                
            climb_penalty = (elev_gain / 100.0) * 0.035
            base_speed = base_speed * max(0.60, 1.0 - climb_penalty)
            
            risk_penalty = score / 150.0
            speed = base_speed * max(0.50, 1.0 - risk_penalty)
            return max(1.8, speed)

        else: # "standard" (Car / Sedan)
            # Standard 2WD passenger car:
            # Lower clearance, vulnerable to underbody damage, slower on broken asphalt & steep ghats
            if is_mountainous:
                base_speed = 42.0
            elif is_flood_terrain:
                base_speed = 48.0
            else:
                base_speed = 65.0
                
            climb_penalty = (elev_gain / 100.0) * 0.015
            base_speed = base_speed * max(0.70, 1.0 - climb_penalty)
            
            risk_penalty = score / 125.0
            speed = base_speed * max(0.35, 1.0 - risk_penalty)
            return max(14.0, speed)

    def calculate_edge_risk(self, u: str, v: str, incidents: list, structures: list, weather_data: dict = None):
        u_data = NE_CITIES.get(u, {})
        v_data = NE_CITIES.get(v, {})
        edge_data = self.graph.get_edge_data(u, v, {})

        if not u_data or not v_data:
            return {"total_risk": 10, "flood_risk": 5, "landslide_risk": 5, "structure_risk": 0, "active_hazards": []}

        u_lat, u_lng = u_data["lat"], u_data["lng"]
        v_lat, v_lng = v_data["lat"], v_data["lng"]

        # 1. Base Terrain and Elevation Risk
        elev_delta = abs(u_data.get("elevation", 0) - v_data.get("elevation", 0))
        terrain_type = edge_data.get("base_terrain", "plains")

        base_landslide = 5
        base_flood = 5

        if "landslide" in terrain_type or "himalayan" in terrain_type or "rugged" in terrain_type or "steep" in terrain_type:
            base_landslide = 35 + min(30, elev_delta // 30)
        elif "hilly" in terrain_type or "ridge" in terrain_type:
            base_landslide = 20 + min(20, elev_delta // 50)

        if "floodplain" in terrain_type or "river" in terrain_type or "basin" in terrain_type:
            base_flood = 45
        elif "extreme_rain" in terrain_type:
            base_flood = 35
            base_landslide += 25

        # 2. Weather influence
        u_rain = 25.0
        v_rain = 25.0
        if weather_data:
            if u in weather_data:
                u_rain = weather_data[u].get("rainfall_mm", 25.0)
            if v in weather_data:
                v_rain = weather_data[v].get("rainfall_mm", 25.0)
        avg_rain = (u_rain + v_rain) / 2.0

        rain_flood_contrib = min(35, avg_rain * 0.4)
        rain_slide_contrib = min(30, avg_rain * 0.35) if elev_delta > 300 else min(10, avg_rain * 0.1)

        flood_risk = min(100, base_flood + rain_flood_contrib)
        landslide_risk = min(100, base_landslide + rain_slide_contrib)
        structure_risk = 0

        active_hazards = []

        # 3. Check Crowdsourced Incidents near this road edge (within 25 km corridor)
        for inc in incidents:
            inc_lat = inc["latitude"]
            inc_lng = inc["longitude"]
            dist_to_corridor = point_to_segment_distance(inc_lat, inc_lng, u_lat, u_lng, v_lat, v_lng)
            if dist_to_corridor <= 25.0:
                h_type = inc["hazard_type"]
                sev = inc.get("severity", "medium").lower()

                # Severity multiplier
                weight = 25 if sev == "low" else (50 if sev == "medium" else (85 if sev == "high" else 100))

                active_hazards.append({
                    "id": inc.get("id"),
                    "title": inc["title"],
                    "type": h_type,
                    "severity": sev,
                    "distance_km": round(dist_to_corridor, 1),
                    "description": inc.get("description", "")
                })

                if h_type in ["flood", "cloudburst"]:
                    flood_risk = min(100, max(flood_risk, weight))
                elif h_type in ["landslide", "heavy_debris"]:
                    landslide_risk = min(100, max(landslide_risk, weight))
                elif h_type in ["damaged_bridge", "road_collapse"]:
                    structure_risk = min(100, max(structure_risk, weight))

        # 4. Check Damaged Structures along corridor
        for st in structures:
            st_lat = st["latitude"]
            st_lng = st["longitude"]
            dist_to_corridor = point_to_segment_distance(st_lat, st_lng, u_lat, u_lng, v_lat, v_lng)
            if dist_to_corridor <= 20.0:
                passability = st.get("passability", "all")
                dmg = st.get("damage_level", "minor")

                s_weight = 30
                if passability == "closed":
                    s_weight = 100
                elif passability == "4x4_only":
                    s_weight = 75
                elif passability == "light_vehicles_only":
                    s_weight = 50

                structure_risk = min(100, max(structure_risk, s_weight))
                active_hazards.append({
                    "name": st["name"],
                    "type": "damaged_structure",
                    "damage_level": dmg,
                    "passability": passability,
                    "distance_km": round(dist_to_corridor, 1),
                    "bypass": st.get("alternate_bypass", "")
                })

        # Composite Risk Formula
        # When a structure is collapsed or road impassable, composite risk should reflect near critical danger
        composite = (0.35 * flood_risk) + (0.35 * landslide_risk) + (0.30 * structure_risk)
        if structure_risk >= 90 or landslide_risk >= 95 or flood_risk >= 95:
            composite = max(composite, 92)

        return {
            "total_risk": round(composite, 1),
            "flood_risk": round(flood_risk, 1),
            "landslide_risk": round(landslide_risk, 1),
            "structure_risk": round(structure_risk, 1),
            "active_hazards": active_hazards
        }

    def compute_routes(self, origin: str, destination: str, vehicle_mode: str = "standard", weather_data: dict = None):
        self._build_base_graph()

        user_gps_origin = None
        user_gps_dest = None

        graph_origin = origin
        graph_dest = destination

        # Resolve GPS Origin
        if origin.startswith("gps:"):
            try:
                coords = origin.replace("gps:", "").split(",")
                user_lat, user_lng = float(coords[0]), float(coords[1])
                user_gps_origin = {"lat": user_lat, "lng": user_lng}
                # Find closest North East node
                graph_origin = min(
                    NE_CITIES.keys(),
                    key=lambda k: haversine_distance(user_lat, user_lng, NE_CITIES[k]["lat"], NE_CITIES[k]["lng"])
                )
            except Exception:
                graph_origin = "guwahati"

        # Resolve GPS Destination
        if destination.startswith("gps:"):
            try:
                coords = destination.replace("gps:", "").split(",")
                user_lat, user_lng = float(coords[0]), float(coords[1])
                user_gps_dest = {"lat": user_lat, "lng": user_lng}
                graph_dest = min(
                    NE_CITIES.keys(),
                    key=lambda k: haversine_distance(user_lat, user_lng, NE_CITIES[k]["lat"], NE_CITIES[k]["lng"])
                )
            except Exception:
                graph_dest = "silchar"

        if graph_origin not in self.graph or graph_dest not in self.graph:
            return {"error": f"Origin '{origin}' or destination '{destination}' could not be resolved in North East road network."}

        # Fetch current incidents and damaged structures from database
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM incidents WHERE status = 'active'")
        incidents = [dict(row) for row in cursor.fetchall()]

        cursor.execute("SELECT * FROM damaged_structures")
        structures = [dict(row) for row in cursor.fetchall()]
        conn.close()

        # Update edges with risk weights
        for u, v, data in self.graph.edges(data=True):
            risk_info = self.calculate_edge_risk(u, v, incidents, structures, weather_data)
            data["risk_info"] = risk_info
            data["risk_score"] = risk_info["total_risk"]

            # Compute custom dynamic costs
            dist = data["distance"]
            r_score = risk_info["total_risk"]

            # Vehicle mode tolerance
            if vehicle_mode == "standard":
                penalty_factor = (r_score / 14.0) ** 2.3
                impassable_penalty = 10000.0 if r_score >= 85 else 0.0
            elif vehicle_mode == "4x4":
                penalty_factor = (r_score / 20.0) ** 2.0
                impassable_penalty = 6000.0 if r_score >= 95 else 0.0
            elif vehicle_mode == "emergency_convoy":
                penalty_factor = (r_score / 22.0) ** 1.8
                impassable_penalty = 8000.0 if r_score >= 98 else 0.0
            else: # foot
                penalty_factor = (r_score / 25.0) ** 1.5
                impassable_penalty = 2000.0 if r_score >= 90 else 0.0

            # Safe routing weight
            data["safe_weight"] = dist * (1.0 + penalty_factor) + impassable_penalty
            # Direct routing weight (pure distance)
            data["direct_weight"] = dist

        # Find Safest Route
        try:
            safe_path = nx.shortest_path(self.graph, source=graph_origin, target=graph_dest, weight="safe_weight")
        except nx.NetworkXNoPath:
            safe_path = None

        # Find Fastest / Direct Route
        try:
            direct_path = nx.shortest_path(self.graph, source=graph_origin, target=graph_dest, weight="direct_weight")
        except nx.NetworkXNoPath:
            direct_path = None

        def format_path_details(path, route_type):
            if not path:
                return None

            total_dist = 0.0
            weighted_risk = 0.0
            segments = []
            coordinates = []
            all_hazards = []
            road_polyline = []
            total_travel_time_hours = 0.0

            for i in range(len(path) - 1):
                u, v = path[i], path[i+1]
                edge_data = self.graph.get_edge_data(u, v)
                u_city = NE_CITIES[u]
                v_city = NE_CITIES[v]

                if i == 0:
                    coordinates.append({"lat": u_city["lat"], "lng": u_city["lng"], "name": u_city["name"], "node_id": u})
                coordinates.append({"lat": v_city["lat"], "lng": v_city["lng"], "name": v_city["name"], "node_id": v})

                # Retrieve real highway road geometry from cache
                edge_key = f"{u}_{v}"
                rev_key = f"{v}_{u}"
                seg_coords = []
                if edge_key in self.road_cache:
                    seg_coords = self.road_cache[edge_key].get("coordinates", [])
                elif rev_key in self.road_cache:
                    seg_coords = list(reversed(self.road_cache[rev_key].get("coordinates", [])))
                
                if not seg_coords:
                    seg_coords = [[u_city["lat"], u_city["lng"]], [v_city["lat"], v_city["lng"]]]

                # Append to full route polyline, avoiding duplicate joint points
                if road_polyline and seg_coords:
                    road_polyline.extend(seg_coords[1:])
                else:
                    road_polyline.extend(seg_coords)

                dist = edge_data["distance"]
                risk_info = edge_data["risk_info"]
                base_terrain = edge_data.get("base_terrain", "plains")
                elev_gain = edge_data.get("elevation_gain", 0)

                total_dist += dist
                weighted_risk += dist * risk_info["total_risk"]

                # Realistic segment speed & travel time for this vehicle mode
                seg_speed = self.calculate_vehicle_speed(
                    base_terrain=base_terrain,
                    elev_gain=elev_gain,
                    risk_info=risk_info,
                    vehicle_mode=vehicle_mode
                )
                seg_time = dist / seg_speed
                total_travel_time_hours += seg_time

                for h in risk_info["active_hazards"]:
                    if h not in all_hazards:
                        all_hazards.append(h)

                # Segment risk category
                score = risk_info["total_risk"]
                badge = "safe" if score < 30 else ("moderate" if score < 65 else "danger")

                segments.append({
                    "from_id": u,
                    "from_name": u_city["name"],
                    "to_id": v,
                    "to_name": v_city["name"],
                    "highway": edge_data.get("highway", "Highway"),
                    "distance_km": dist,
                    "elevation_gain": elev_gain,
                    "risk_score": score,
                    "risk_badge": badge,
                    "flood_risk": risk_info["flood_risk"],
                    "landslide_risk": risk_info["landslide_risk"],
                    "structure_risk": risk_info["structure_risk"],
                    "hazards": risk_info["active_hazards"],
                    "speed_kmh": round(seg_speed, 1),
                    "segment_time_hours": round(seg_time, 2)
                })

            avg_risk = round(weighted_risk / total_dist, 1) if total_dist > 0 else 0

            # If GPS origin exists, prepend it to road_polyline and coordinates
            if user_gps_origin:
                gps_lat = user_gps_origin["lat"]
                gps_lng = user_gps_origin["lng"]
                road_polyline.insert(0, [gps_lat, gps_lng])
                coordinates.insert(0, {
                    "lat": gps_lat,
                    "lng": gps_lng,
                    "name": "📍 Current GPS Location",
                    "node_id": "current_gps"
                })
                # Add connector distance and connector time
                first_node = NE_CITIES.get(path[0])
                if first_node:
                    conn_dist = round(haversine_distance(gps_lat, gps_lng, first_node["lat"], first_node["lng"]), 1)
                    conn_speed = self.calculate_vehicle_speed("plains", 0, {"total_risk": 10}, vehicle_mode)
                    total_dist = round(total_dist + conn_dist, 1)
                    total_travel_time_hours += (conn_dist / conn_speed)

            # If GPS dest exists, append it
            if user_gps_dest:
                dest_lat = user_gps_dest["lat"]
                dest_lng = user_gps_dest["lng"]
                road_polyline.append([dest_lat, dest_lng])
                coordinates.append({
                    "lat": dest_lat,
                    "lng": dest_lng,
                    "name": "📍 Custom GPS Destination",
                    "node_id": "custom_dest"
                })
                last_node = NE_CITIES.get(path[-1])
                if last_node:
                    conn_dist = round(haversine_distance(dest_lat, dest_lng, last_node["lat"], last_node["lng"]), 1)
                    conn_speed = self.calculate_vehicle_speed("plains", 0, {"total_risk": 10}, vehicle_mode)
                    total_dist = round(total_dist + conn_dist, 1)
                    total_travel_time_hours += (conn_dist / conn_speed)

            travel_time_hours = round(total_travel_time_hours, 1)

            # Overall recommendation
            if avg_risk < 30:
                verdict = "Safe & Clear Route"
                verdict_color = "green"
            elif avg_risk < 65:
                verdict = "Caution: Moderate Road & Water Hazards"
                verdict_color = "amber"
            else:
                verdict = "HIGH RISK / BLOCKED SECTORS: Extreme Caution Required"
                verdict_color = "red"

            return {
                "route_type": route_type,
                "path_nodes": path,
                "total_distance_km": round(total_dist, 1),
                "estimated_time_hours": travel_time_hours,
                "composite_risk_score": avg_risk,
                "verdict": verdict,
                "verdict_color": verdict_color,
                "segments": segments,
                "coordinates": coordinates,
                "road_polyline": road_polyline,
                "hazards_encountered": all_hazards
            }

        safe_result = format_path_details(safe_path, "Safest Recommended Route")
        direct_result = format_path_details(direct_path, "Direct / Fastest Route")

        # Determine if direct route is distinct from safe route
        is_same_route = safe_path == direct_path

        origin_label = "📍 My Live GPS Location" if user_gps_origin else NE_CITIES.get(origin, {}).get("name", origin)
        dest_label = "📍 Custom Destination" if user_gps_dest else NE_CITIES.get(destination, {}).get("name", destination)

        return {
            "origin": origin,
            "origin_name": origin_label,
            "destination": destination,
            "destination_name": dest_label,
            "vehicle_mode": vehicle_mode,
            "is_same_route": is_same_route,
            "safest_route": safe_result,
            "direct_route": direct_result
        }

routing_engine = NorthEastRoutingEngine()
