import sqlite3
from database import get_db, init_db

# Predefined Road Edges with Base Distances, Terrain Gradient, and Default Hazards
NE_ROAD_NETWORK = [
    # Assam - Meghalaya Corridors
    {"u": "guwahati", "v": "shillong", "distance_km": 100, "base_terrain": "hilly", "highway": "NH-6", "elevation_gain": 1470},
    {"u": "shillong", "v": "cherrapunji", "distance_km": 54, "base_terrain": "extreme_rain_plateau", "highway": "SH-5", "elevation_gain": 200},
    {"u": "shillong", "v": "jowai", "distance_km": 65, "base_terrain": "hilly", "highway": "NH-6", "elevation_gain": 250},
    {"u": "jowai", "v": "sonapur", "distance_km": 72, "base_terrain": "landslide_chokepoint", "highway": "NH-6", "elevation_gain": -960},
    {"u": "sonapur", "v": "silchar", "distance_km": 80, "base_terrain": "valley_floodplain", "highway": "NH-6", "elevation_gain": -395},

    # Alternative Route to Silchar via Dima Hasao (Mahasadak)
    {"u": "guwahati", "v": "nagaon", "distance_km": 120, "base_terrain": "plains", "highway": "NH-27", "elevation_gain": 10},
    {"u": "nagaon", "v": "lumding", "distance_km": 85, "base_terrain": "plains_foothills", "highway": "NH-27", "elevation_gain": 65},
    {"u": "lumding", "v": "haflong", "distance_km": 105, "base_terrain": "rugged_hills", "highway": "NH-27", "elevation_gain": 555},
    {"u": "haflong", "v": "silchar", "distance_km": 95, "base_terrain": "hilly_valley", "highway": "NH-27", "elevation_gain": -655},

    # Upper Assam Brahmaputra Trunk Corridor
    {"u": "nagaon", "v": "tezpur", "distance_km": 65, "base_terrain": "river_crossing", "highway": "Kolia Bhomora Bridge", "elevation_gain": -12},
    {"u": "nagaon", "v": "kaziranga", "distance_km": 75, "base_terrain": "floodplain_wildlife", "highway": "NH-715", "elevation_gain": -7},
    {"u": "kaziranga", "v": "jorhat", "distance_km": 90, "base_terrain": "floodplain", "highway": "NH-715", "elevation_gain": 63},
    {"u": "jorhat", "v": "majuli", "distance_km": 25, "base_terrain": "river_ferry_seasonal", "highway": "Nimati Ghat Ferry", "elevation_gain": -32},
    {"u": "jorhat", "v": "dibrugarh", "distance_km": 135, "base_terrain": "river_basin", "highway": "NH-2", "elevation_gain": -8},
    {"u": "dibrugarh", "v": "tinsukia", "distance_km": 48, "base_terrain": "plains", "highway": "NH-37", "elevation_gain": 9},

    # Arunachal Pradesh Corridors
    {"u": "tezpur", "v": "bhalukpong", "distance_km": 52, "base_terrain": "foothills_entry", "highway": "NH-13", "elevation_gain": 165},
    {"u": "bhalukpong", "v": "bomdila", "distance_km": 100, "base_terrain": "steep_himalayan", "highway": "NH-13", "elevation_gain": 2202},
    {"u": "bomdila", "v": "tawang", "distance_km": 175, "base_terrain": "high_altitude_pass", "highway": "NH-13 via Sela Pass", "elevation_gain": 633},
    {"u": "tezpur", "v": "itanagar", "distance_km": 155, "base_terrain": "foothills", "highway": "NH-15", "elevation_gain": 702},

    # Sikkim - Teesta Corridor
    {"u": "siliguri", "v": "rangpo", "distance_km": 75, "base_terrain": "river_gorge_landslide", "highway": "NH-10 (Teesta Lifeline)", "elevation_gain": 208},
    {"u": "rangpo", "v": "gangtok", "distance_km": 40, "base_terrain": "steep_mountain", "highway": "NH-10", "elevation_gain": 1320},

    # Nagaland & Manipur
    {"u": "lumding", "v": "dimapur", "distance_km": 70, "base_terrain": "foothills", "highway": "NH-29", "elevation_gain": 20},
    {"u": "dimapur", "v": "kohima", "distance_km": 74, "base_terrain": "steep_ghat", "highway": "NH-29", "elevation_gain": 1299},
    {"u": "kohima", "v": "imphal", "distance_km": 140, "base_terrain": "mountain_valley", "highway": "NH-2", "elevation_gain": -658},
    {"u": "imphal", "v": "churachandpur", "distance_km": 62, "base_terrain": "plateau_hills", "highway": "Tiddim Road", "elevation_gain": 128},

    # Mizoram & Tripura
    {"u": "silchar", "v": "aizawl", "distance_km": 175, "base_terrain": "ridge_slopes", "highway": "NH-306", "elevation_gain": 1107},
    {"u": "aizawl", "v": "lunglei", "distance_km": 165, "base_terrain": "remote_hills", "highway": "NH-54", "elevation_gain": 90},
    {"u": "silchar", "v": "dharmanagar", "distance_km": 115, "base_terrain": "undulating_slopes", "highway": "NH-8", "elevation_gain": -4},
    {"u": "dharmanagar", "v": "agartala", "distance_km": 170, "base_terrain": "lowland_plains", "highway": "NH-8", "elevation_gain": -9},

    # Lower Assam Corridor
    {"u": "guwahati", "v": "barpeta", "distance_km": 95, "base_terrain": "floodplain_lowland", "highway": "NH-27", "elevation_gain": -20},
    {"u": "barpeta", "v": "dhubri", "distance_km": 130, "base_terrain": "river_basin", "highway": "NH-17", "elevation_gain": -1}
]

# Sample pre-existing crowdsourced incidents
INITIAL_INCIDENTS = [
    {
        "hazard_type": "landslide",
        "title": "Severe Mudslide Blocking NH-6 at Sonapur Tunnel",
        "description": "Massive mudslide occurred following 48 hours of non-stop downpours in Jaintia Hills. Over 400 meters of highway completely blocked by boulders and clay sludge. Heavy vehicles stranded. BRO deploying excavators.",
        "latitude": 25.1090,
        "longitude": 92.3620,
        "nearest_node": "sonapur",
        "severity": "critical",
        "photo_url": "/static/images/sonapur_landslide.svg",
        "reporter_name": "Major R. Sangma (BRO Pushpak)",
        "upvotes": 84,
        "verified": 1
    },
    {
        "hazard_type": "flood",
        "title": "Brahmaputra Overflow Submerging NH-715 at Kaziranga (Bagori)",
        "description": "Flood water depth approx 2.5 feet on the highway carriageway between Kohora and Bagori range. Animal corridors activated. ASDMA speed limit 20 km/h; light sedans advised to avoid or detour via Tezpur-Biswanath.",
        "latitude": 26.5775,
        "longitude": 93.1711,
        "nearest_node": "kaziranga",
        "severity": "high",
        "photo_url": "/static/images/kaziranga_flood.svg",
        "reporter_name": "Forest Ranger B. Gogoi",
        "upvotes": 62,
        "verified": 1
    },
    {
        "hazard_type": "landslide",
        "title": "NH-10 Pagla Jhora Rockfall between Siliguri and Rangpo",
        "description": "Shooting stones and active sliding zone near 29th Mile. Teesta river high embankment erosion. Traffic moving intermittently in single file under police escort.",
        "latitude": 27.0250,
        "longitude": 88.4600,
        "nearest_node": "rangpo",
        "severity": "medium",
        "photo_url": "/static/images/teesta_landslide.svg",
        "reporter_name": "Sikkim Police Highway Patrol",
        "upvotes": 49,
        "verified": 1
    },
    {
        "hazard_type": "damaged_bridge",
        "title": "Barak River Wooden Approach Bridge Scoured in Cachar",
        "description": "Pillar 3 abutment severely eroded due to flood surge. Cracks on northern ramp. Heavy trucks barred; emergency medical 4x4 vehicles only with slow speed.",
        "latitude": 24.8450,
        "longitude": 92.7910,
        "nearest_node": "silchar",
        "severity": "high",
        "photo_url": "/static/images/damaged_bridge.svg",
        "reporter_name": "PWD Executive Engineer Cachar",
        "upvotes": 37,
        "verified": 1
    },
    {
        "hazard_type": "road_collapse",
        "title": "Road Bed Subsidence on NH-29 near Kohima Bypass",
        "description": "Gradual sinking of left lane due to underground seepage after heavy mountain rains. Traffic restricted to right lane with signal guards.",
        "latitude": 25.6890,
        "longitude": 94.1020,
        "nearest_node": "kohima",
        "severity": "medium",
        "photo_url": "/static/images/road_collapse.svg",
        "reporter_name": "Nagaland SDRF Unit",
        "upvotes": 28,
        "verified": 1
    }
]

# Damaged structures and checkpoints
INITIAL_DAMAGED_STRUCTURES = [
    {
        "name": "Sonapur Tunnel North Portal Chokepoint",
        "structure_type": "Tunnel & Retaining Wall",
        "route_name": "NH-6 (East Jaintia Hills)",
        "latitude": 25.1090,
        "longitude": 92.3620,
        "damage_level": "submerged",
        "passability": "closed",
        "description": "Mud sludge inside tunnel portal; 4 JCB excavators clearing debris. Clearance estimated in 18 hours.",
        "photo_url": "/static/images/sonapur_landslide.svg",
        "alternate_bypass": "Divert via Guwahati - Lumding - Haflong - Silchar (NH-27)"
    },
    {
        "name": "Barak River Auxiliary Culvert #12",
        "structure_type": "RCC Slab Culvert",
        "route_name": "Silchar - Kumbhirgram Road",
        "latitude": 24.8900,
        "longitude": 92.9200,
        "damage_level": "structural_crack",
        "passability": "4x4_only",
        "description": "Foundation washed out by flash surge. Light vehicles only. Heavy trucks strictly prohibited.",
        "photo_url": "/static/images/damaged_bridge.svg",
        "alternate_bypass": "Use Udharbond bypass link"
    },
    {
        "name": "Teesta River Causeway at 29th Mile",
        "structure_type": "River Embankment & Culvert",
        "route_name": "NH-10 (Siliguri - Gangtok)",
        "latitude": 27.0250,
        "longitude": 88.4600,
        "damage_level": "minor",
        "passability": "light_vehicles_only",
        "description": "River embankment breached; single-lane alternating passage with BRO safety spotters.",
        "photo_url": "/static/images/teesta_landslide.svg",
        "alternate_bypass": "Detour via Lava - Algarah - Reshi - Rhenock"
    },
    {
        "name": "Jia Bhoreli Sub-bridge Approach",
        "structure_type": "Prestressed Girder Bridge",
        "route_name": "NH-15 (Tezpur - Bhalukpong corridor)",
        "latitude": 26.8500,
        "longitude": 92.7800,
        "damage_level": "minor",
        "passability": "all",
        "description": "Debris accumulation around piers cleared. Safe for all certified loads with cautious driving.",
        "photo_url": "/static/images/bridge_inspect.svg",
        "alternate_bypass": "None required at present"
    }
]

# Relief Camps
INITIAL_RELIEF_CAMPS = [
    {"name": "Kamrup Disaster Relief Camp #1", "district": "Kamrup Metropolitan", "state": "Assam", "latitude": 26.1700, "longitude": 91.7500, "capacity": 600, "current_occupancy": 310, "medical_available": 1, "food_water_available": 1, "contact_phone": "+91-361-2733052", "in_charge": "Dr. P. Baruah"},
    {"name": "Cachar District High School Relief Shelter", "district": "Cachar", "state": "Assam", "latitude": 24.8250, "longitude": 92.8010, "capacity": 1200, "current_occupancy": 840, "medical_available": 1, "food_water_available": 1, "contact_phone": "+91-3842-245866", "in_charge": "S. K. Nath (ADC Cachar)"},
    {"name": "Dima Hasao Hill Evacuation Shelter", "district": "Dima Hasao", "state": "Assam", "latitude": 25.1720, "longitude": 93.0210, "capacity": 450, "current_occupancy": 190, "medical_available": 1, "food_water_available": 1, "contact_phone": "+91-3673-236224", "in_charge": "M. Daulagupu"},
    {"name": "East Khasi Hills Emergency Transit Center", "district": "East Khasi Hills", "state": "Meghalaya", "latitude": 25.5670, "longitude": 91.8820, "capacity": 500, "current_occupancy": 120, "medical_available": 1, "food_water_available": 1, "contact_phone": "+91-364-2502094", "in_charge": "W. Kharkongor"}
]

# Emergency Contacts
INITIAL_EMERGENCY_CONTACTS = [
    {"agency": "National Disaster Response Force (NDRF) 1st Bn", "region": "North East HQ (Guwahati)", "phone": "1078 / +91-361-2849005", "alt_phone": "+91-94351-17246", "email": "hq01-ndrf@nic.in", "category": "NDRF Rescue & Boats"},
    {"agency": "Assam State Disaster Management Authority (ASDMA)", "region": "Assam State Control Room", "phone": "1070 / 1077", "alt_phone": "+91-361-2237221", "email": "sdma-assam@gov.in", "category": "State Disaster Control"},
    {"agency": "Meghalaya State Disaster Management Authority (SDMA)", "region": "Meghalaya (Shillong)", "phone": "1070", "alt_phone": "+91-364-2502094", "email": "sdmamegh@gmail.com", "category": "State Disaster Control"},
    {"agency": "Border Roads Organisation (BRO) Project Pushpak", "region": "NH-6 / Barak Valley / Mizoram", "phone": "+91-3842-263288", "alt_phone": "+91-94350-88219", "email": "bro-pushpak@nic.in", "category": "Highway Clearance & JCBs"},
    {"agency": "Border Roads Organisation (BRO) Project Swastik", "region": "Sikkim NH-10 & Border Passes", "phone": "+91-3592-202244", "alt_phone": "+91-98000-11223", "email": "bro-swastik@nic.in", "category": "Landslide Clearance"},
    {"agency": "Border Roads Organisation (BRO) Project Vartak", "region": "Arunachal Pradesh / Tawang Corridor", "phone": "+91-3712-258012", "alt_phone": "+91-94360-12345", "email": "bro-vartak@nic.in", "category": "Mountain Pass Clearance"},
    {"agency": "State Disaster Response Force (SDRF) Cachar", "region": "Silchar Flood Rescue", "phone": "+91-3842-239247", "alt_phone": "112", "email": "sdrf-cachar@assam.gov.in", "category": "Boat Rescue & Evacuation"},
    {"agency": "Sikkim State Disaster Management Authority (SSDMA)", "region": "Gangtok, Sikkim", "phone": "1070 / 112", "alt_phone": "+91-3592-201145", "email": "ssdma-gangtok@sikkim.gov.in", "category": "State Disaster Control"}
]

# Amenities: Petrol Pumps, Hotels & Safe Havens, Restaurants & Community Kitchens
INITIAL_AMENITIES = [
    # Petrol Pumps
    {"category": "petrol_pump", "name": "IndianOil Highway Refuel Station Byrnihat", "highway": "NH-6", "district": "Ri-Bhoi", "state": "Meghalaya", "latitude": 26.0400, "longitude": 91.8700, "contact_phone": "+91-3638-232144", "status": "open", "fuel_status": "normal", "capacity_beds": 0, "food_available": 1, "generator_backup": 1, "description": "High-capacity diesel & petrol stock with 24/7 generator backup."},
    {"category": "petrol_pump", "name": "Sonapur Chokepoint HPCL Fuel Depot", "highway": "NH-6", "district": "East Jaintia Hills", "state": "Meghalaya", "latitude": 25.1150, "longitude": 92.3580, "contact_phone": "+91-3655-220119", "status": "limited", "fuel_status": "diesel_only_rescue", "capacity_beds": 0, "food_available": 0, "generator_backup": 1, "description": "Diesel strictly reserved for BRO excavators, rescue trucks, and emergency ambulances."},
    {"category": "petrol_pump", "name": "Jowai Bharat Petroleum Express", "highway": "NH-6", "district": "West Jaintia Hills", "state": "Meghalaya", "latitude": 25.4480, "longitude": 92.1950, "contact_phone": "+91-3652-251020", "status": "open", "fuel_status": "normal", "capacity_beds": 0, "food_available": 1, "generator_backup": 1, "description": "Operational refuel hub on Shillong-Silchar corridor."},
    {"category": "petrol_pump", "name": "Kolia Bhomora IOCL Pump Tezpur", "highway": "NH-715", "district": "Sonitpur", "state": "Assam", "latitude": 26.6200, "longitude": 92.8100, "contact_phone": "+91-3712-230015", "status": "open", "fuel_status": "normal", "capacity_beds": 0, "food_available": 1, "generator_backup": 1, "description": "North bank Brahmaputra refuel point, full reserves."},
    {"category": "petrol_pump", "name": "Bokakhat HP Petrol Station", "highway": "NH-715", "district": "Golaghat", "state": "Assam", "latitude": 26.6350, "longitude": 93.5900, "contact_phone": "+91-3776-268042", "status": "open", "fuel_status": "normal", "capacity_beds": 0, "food_available": 0, "generator_backup": 1, "description": "Safe refuel point east of Kaziranga flood stretch."},
    {"category": "petrol_pump", "name": "Silchar Emergency Medical Fuel Depot", "highway": "NH-27", "district": "Cachar", "state": "Assam", "latitude": 24.8390, "longitude": 92.7820, "contact_phone": "+91-3842-234891", "status": "limited", "fuel_status": "low_stock", "capacity_beds": 0, "food_available": 0, "generator_backup": 1, "description": "Waterlogging near forecourt; rationing 20L per vehicle to prevent hoarding."},
    {"category": "petrol_pump", "name": "Rangpo Teesta BPCL Station", "highway": "NH-10", "district": "Pakyong", "state": "Sikkim", "latitude": 27.1720, "longitude": 88.5280, "contact_phone": "+91-3592-240188", "status": "limited", "fuel_status": "diesel_only_rescue", "capacity_beds": 0, "food_available": 1, "generator_backup": 1, "description": "Sikkim entry point fuel depot; priority fuel for essential supply convoys."},
    {"category": "petrol_pump", "name": "Dimapur NH-29 IOCL Hub", "highway": "NH-29", "district": "Dimapur", "state": "Nagaland", "latitude": 25.8980, "longitude": 93.7320, "contact_phone": "+91-3862-231144", "status": "open", "fuel_status": "normal", "capacity_beds": 0, "food_available": 1, "generator_backup": 1, "description": "Nagaland supply highway refueling terminal."},

    # Hotels & Safe Havens
    {"category": "hotel", "name": "Nongpoh Pine Transit Haven", "highway": "NH-6", "district": "Ri-Bhoi", "state": "Meghalaya", "latitude": 25.9010, "longitude": 91.8810, "contact_phone": "+91-3638-232590", "status": "open", "fuel_status": "normal", "capacity_beds": 50, "food_available": 1, "generator_backup": 1, "description": "Safe overnight rooms, warm blankets, and medical first-aid kit for stranded travelers."},
    {"category": "hotel", "name": "Ladrymbai Safe Haven Lodge", "highway": "NH-6", "district": "East Jaintia Hills", "state": "Meghalaya", "latitude": 25.3200, "longitude": 92.3100, "contact_phone": "+91-3655-241088", "status": "open", "fuel_status": "normal", "capacity_beds": 35, "food_available": 1, "generator_backup": 1, "description": "Emergency hillside shelter with warm food and solar generator backup."},
    {"category": "hotel", "name": "Kaziranga Eco Safe Shelter Inn", "highway": "NH-715", "district": "Golaghat", "state": "Assam", "latitude": 26.5820, "longitude": 93.1850, "contact_phone": "+91-3776-262444", "status": "open", "fuel_status": "normal", "capacity_beds": 75, "food_available": 1, "generator_backup": 1, "description": "High-ground facility protected from Brahmaputra floodwaters."},
    {"category": "hotel", "name": "Silchar Barak Transit Inn", "highway": "NH-27", "district": "Cachar", "state": "Assam", "latitude": 24.8210, "longitude": 92.7950, "contact_phone": "+91-3842-225670", "status": "open", "fuel_status": "normal", "capacity_beds": 60, "food_available": 1, "generator_backup": 1, "description": "Safe shelter facility on elevated ground in Silchar town center."},
    {"category": "hotel", "name": "Rangpo Border Alpine Lodge", "highway": "NH-10", "district": "Pakyong", "state": "Sikkim", "latitude": 27.1780, "longitude": 88.5320, "contact_phone": "+91-3592-240562", "status": "open", "fuel_status": "normal", "capacity_beds": 40, "food_available": 1, "generator_backup": 1, "description": "Safe shelter for drivers held up by Teesta valley rockfalls."},
    {"category": "hotel", "name": "Kohima Highland Safe Haven", "highway": "NH-29", "district": "Kohima", "state": "Nagaland", "latitude": 25.6680, "longitude": 94.1020, "contact_phone": "+91-3866-224190", "status": "open", "fuel_status": "normal", "capacity_beds": 45, "food_available": 1, "generator_backup": 1, "description": "Shelter on Kohima ridge with uninterrupted water supply and heaters."},

    # Restaurants, Highway Dhabas & Community Kitchens
    {"category": "restaurant", "name": "Byrnihat Grand Dhaba & Langar", "highway": "NH-6", "district": "Ri-Bhoi", "state": "Meghalaya", "latitude": 26.0420, "longitude": 91.8680, "contact_phone": "+91-98640-11221", "status": "open", "fuel_status": "normal", "capacity_beds": 0, "food_available": 1, "generator_backup": 1, "description": "Hot meals, clean drinking water, mobile phone charging points, and tea."},
    {"category": "restaurant", "name": "Kolia Bhomora Flood Relief Kitchen", "highway": "NH-715", "district": "Sonitpur", "state": "Assam", "latitude": 26.6210, "longitude": 92.8080, "contact_phone": "+91-94350-33441", "status": "open", "fuel_status": "normal", "capacity_beds": 0, "food_available": 1, "generator_backup": 1, "description": "Government & community kitchen distributing free khichdi and ration packets."},
    {"category": "restaurant", "name": "Jowai Highway Canteen", "highway": "NH-6", "district": "West Jaintia Hills", "state": "Meghalaya", "latitude": 25.4490, "longitude": 92.1980, "contact_phone": "+91-98560-55442", "status": "open", "fuel_status": "normal", "capacity_beds": 0, "food_available": 1, "generator_backup": 1, "description": "Clean food, purified bottled water, warm tea, and emergency shelter seating."},
    {"category": "restaurant", "name": "Kaziranga Highway Dhaba & Tea Post", "highway": "NH-715", "district": "Golaghat", "state": "Assam", "latitude": 26.5840, "longitude": 93.1810, "contact_phone": "+91-94351-77882", "status": "open", "fuel_status": "normal", "capacity_beds": 0, "food_available": 1, "generator_backup": 1, "description": "Safe meal stop for drivers awaiting convoy clearance across Kaziranga corridor."}
]

# Essential Commodity Supply Convoys
INITIAL_FLEET = [
    {
        "vehicle_id": "AS-01-MED-104",
        "driver_name": "Bipul Das",
        "driver_phone": "+91-94350-12345",
        "cargo_type": "medicines",
        "cargo_desc": "Insulin, Cold-Chain Blood Plasma Units & Trauma Antibiotics for Silchar Civil Hospital",
        "origin": "guwahati",
        "destination": "silchar",
        "current_lat": 25.2100,
        "current_lng": 92.3200,
        "speed_kmh": 0.0,
        "status": "delayed",
        "eta_hours": 9.5,
        "hazard_alert": "🚨 Critical Hazard: NH-6 Sonapur Tunnel completely blocked by mudslide ahead (6.8 km). Immediate reroute via Haflong recommended.",
        "route_nodes": '["guwahati", "shillong", "jowai", "sonapur", "silchar"]'
    },
    {
        "vehicle_id": "AS-09-RATION-202",
        "driver_name": "Suraj Mech",
        "driver_phone": "+91-98640-67890",
        "cargo_type": "agricultural_produce",
        "cargo_desc": "35 Metric Tons FCI Fortified Rice, Lentils & Baby Food Rations for Aizawl PDS",
        "origin": "guwahati",
        "destination": "aizawl",
        "current_lat": 26.2800,
        "current_lng": 92.5100,
        "speed_kmh": 48.0,
        "status": "in_transit",
        "eta_hours": 11.2,
        "hazard_alert": "🛡️ Green Corridor: Moving smoothly on NH-27 toward Nagaon-Lumding bypass.",
        "route_nodes": '["guwahati", "nagaon", "lumding", "haflong", "silchar", "aizawl"]'
    },
    {
        "vehicle_id": "ML-05-BRG-308",
        "driver_name": "Subedar K. Sharma",
        "driver_phone": "+91-97740-11223",
        "cargo_type": "construction_materials",
        "cargo_desc": "Prefabricated Modular Steel Bailey Bridge Panels & Pylons for BRO Teesta River Causeway",
        "origin": "siliguri",
        "destination": "gangtok",
        "current_lat": 26.9800,
        "current_lng": 88.4400,
        "speed_kmh": 24.0,
        "status": "in_transit",
        "eta_hours": 3.8,
        "hazard_alert": "⚠️ Caution: Single-lane convoy movement under police escort near 29th Mile rockfall.",
        "route_nodes": '["siliguri", "rangpo", "gangtok"]'
    },
    {
        "vehicle_id": "AS-03-FUEL-415",
        "driver_name": "Tenzing Norbu",
        "driver_phone": "+91-94360-99887",
        "cargo_type": "fuel_tanker",
        "cargo_desc": "24,000 Liters High-Altitude Low-Freezing Diesel for Tawang BRO Heavy Excavators",
        "origin": "tezpur",
        "destination": "tawang",
        "current_lat": 27.1800,
        "current_lng": 92.5100,
        "speed_kmh": 32.0,
        "status": "in_transit",
        "eta_hours": 6.5,
        "hazard_alert": "⚠️ Rain slick mountain road between Bhalukpong & Bomdila; 4x4 pilot escort in place.",
        "route_nodes": '["tezpur", "bhalukpong", "bomdila", "tawang"]'
    },
    {
        "vehicle_id": "NL-07-MED-519",
        "driver_name": "L. Sema",
        "driver_phone": "+91-98560-44332",
        "cargo_type": "medicines",
        "cargo_desc": "Regional Medical College Imphal Emergency Trauma Kits, IV Fluids & Oxygen Regulators",
        "origin": "dimapur",
        "destination": "imphal",
        "current_lat": 25.7500,
        "current_lng": 94.0200,
        "speed_kmh": 42.0,
        "status": "in_transit",
        "eta_hours": 4.1,
        "hazard_alert": "⚠️ Subsidence caution on NH-29 near Kohima bypass; single lane traffic.",
        "route_nodes": '["dimapur", "kohima", "imphal"]'
    }
]

# Field Official Verified SITREPs
INITIAL_SITREPS = [
    {
        "officer_name": "Major R. Sangma",
        "officer_rank": "Officer Commanding",
        "agency": "BRO",
        "corridor": "NH-6 Sonapur Tunnel",
        "district": "East Jaintia Hills",
        "latitude": 25.1090,
        "longitude": 92.3620,
        "clearance_pct": 35,
        "passability": "closed",
        "bridge_status": "intact",
        "photo_url": "/static/images/sonapur_landslide.svg",
        "notes": "4 JCB hydraulic excavators deployed. Rain continuing with high mud liquidity. Est. clearance: 14 hours. Convoys must detour via Haflong.",
        "broadcast_alert": 1
    },
    {
        "officer_name": "Inspector D. Kalita",
        "officer_rank": "Company Commander",
        "agency": "NDRF",
        "corridor": "NH-715 Kaziranga Sector",
        "district": "Golaghat",
        "latitude": 26.5775,
        "longitude": 93.1711,
        "clearance_pct": 70,
        "passability": "4x4_only",
        "bridge_status": "scour_inspection",
        "photo_url": "/static/images/kaziranga_flood.svg",
        "notes": "Water depth 1.8 feet. Escorted pilot convoy movement every 45 mins. Speed limit 20 km/h strictly enforced.",
        "broadcast_alert": 1
    },
    {
        "officer_name": "Capt. S. Chettri",
        "officer_rank": "Executive Engineer",
        "agency": "BRO",
        "corridor": "NH-10 29th Mile",
        "district": "Pakyong",
        "latitude": 27.0250,
        "longitude": 88.4600,
        "clearance_pct": 60,
        "passability": "single_lane_escort",
        "bridge_status": "scour_inspection",
        "photo_url": "/static/images/teesta_landslide.svg",
        "notes": "Shooting stones intermittent. Bailey bridge material convoy ML-05-BRG-308 cleared through safely.",
        "broadcast_alert": 1
    }
]

# Emergency Facilities: Police Stations, Hospitals & 108 Ambulance Hubs
INITIAL_EMERGENCY_FACILITIES = [
    # --- POLICE STATIONS & HIGHWAY PATROL POSTS ---
    {
        "name": "Dispur Police Station & Disaster Response Unit",
        "facility_type": "police_station",
        "district": "Kamrup Metropolitan",
        "state": "Assam",
        "latitude": 26.1430,
        "longitude": 91.7890,
        "phone": "+91-361-2261513",
        "emergency_line": "112",
        "units_available": "4 PCR Vans, 1 Disaster Evacuation Truck",
        "nodal_officer": "Inspector P. K. Saikia",
        "operational_status": "active"
    },
    {
        "name": "Sonapur Highway Police Outpost",
        "facility_type": "police_station",
        "district": "Kamrup Metropolitan",
        "state": "Assam",
        "latitude": 26.1180,
        "longitude": 91.9750,
        "phone": "+91-361-2788220",
        "emergency_line": "112",
        "units_available": "2 Highway Interceptor PCRs",
        "nodal_officer": "Sub-Inspector M. Barman",
        "operational_status": "active"
    },
    {
        "name": "Shillong Sadar Police Station",
        "facility_type": "police_station",
        "district": "East Khasi Hills",
        "state": "Meghalaya",
        "latitude": 25.5780,
        "longitude": 91.8840,
        "phone": "+91-364-2224818",
        "emergency_line": "112",
        "units_available": "3 Hill Patrol Gypsy 4x4s, SDRF Liaison",
        "nodal_officer": "DSP B. Nongrum",
        "operational_status": "active"
    },
    {
        "name": "Jowai Police Station",
        "facility_type": "police_station",
        "district": "West Jaintia Hills",
        "state": "Meghalaya",
        "latitude": 25.4470,
        "longitude": 92.2020,
        "phone": "+91-3652-220220",
        "emergency_line": "112",
        "units_available": "2 4x4 Rescue Escorts",
        "nodal_officer": "Inspector D. Shullai",
        "operational_status": "active"
    },
    {
        "name": "Khliehriat Police Station (Sonapur Chokepoint)",
        "facility_type": "police_station",
        "district": "East Jaintia Hills",
        "state": "Meghalaya",
        "latitude": 25.3520,
        "longitude": 92.3680,
        "phone": "+91-3655-230225",
        "emergency_line": "112",
        "units_available": "3 Heavy Duty Patrol Jeeps (Landslide Escort)",
        "nodal_officer": "Inspector T. Lyngdoh",
        "operational_status": "active"
    },
    {
        "name": "Silchar Sadar Police Station",
        "facility_type": "police_station",
        "district": "Cachar",
        "state": "Assam",
        "latitude": 24.8260,
        "longitude": 92.7980,
        "phone": "+91-3842-245842",
        "emergency_line": "112",
        "units_available": "4 PCR Patrol Vans, 2 Flood Rescue Rubber Dinghies",
        "nodal_officer": "Inspector A. Roy",
        "operational_status": "active"
    },
    {
        "name": "Haflong Police Station",
        "facility_type": "police_station",
        "district": "Dima Hasao",
        "state": "Assam",
        "latitude": 25.1760,
        "longitude": 93.0180,
        "phone": "+91-3673-236222",
        "emergency_line": "112",
        "units_available": "2 Hill Emergency Response Patrols",
        "nodal_officer": "Inspector H. Kemprai",
        "operational_status": "active"
    },
    {
        "name": "Bokakhat Police Station (Kaziranga Corridor)",
        "facility_type": "police_station",
        "district": "Golaghat",
        "state": "Assam",
        "latitude": 26.6380,
        "longitude": 93.5950,
        "phone": "+91-3776-268022",
        "emergency_line": "112",
        "units_available": "2 Highway Flood Warning Patrols",
        "nodal_officer": "Inspector R. Hazarika",
        "operational_status": "active"
    },
    {
        "name": "Kohima South Police Station",
        "facility_type": "police_station",
        "district": "Kohima",
        "state": "Nagaland",
        "latitude": 25.6620,
        "longitude": 94.1080,
        "phone": "+91-3866-224422",
        "emergency_line": "112",
        "units_available": "3 Mountain Patrol Units",
        "nodal_officer": "DSP K. Angami",
        "operational_status": "active"
    },
    {
        "name": "Rangpo Police Checkpost & Station",
        "facility_type": "police_station",
        "district": "Pakyong",
        "state": "Sikkim",
        "latitude": 27.1750,
        "longitude": 88.5300,
        "phone": "+91-3592-240822",
        "emergency_line": "112",
        "units_available": "2 Teesta Valley Disaster Rapid Response Jeeps",
        "nodal_officer": "Inspector S. Tamang",
        "operational_status": "active"
    },

    # --- HOSPITALS & 108 AMBULANCE STATIONS ---
    {
        "name": "Gauhati Medical College & Hospital (GMCH) 108 Trauma Hub",
        "facility_type": "hospital_ambulance",
        "district": "Kamrup Metropolitan",
        "state": "Assam",
        "latitude": 26.1580,
        "longitude": 91.7740,
        "phone": "+91-361-2529457",
        "emergency_line": "108",
        "units_available": "6 ALS Ambulances (Ventilator & Oxygen Equipped)",
        "nodal_officer": "Dr. N. Goswami (Emergency Chief)",
        "operational_status": "active"
    },
    {
        "name": "Sonapur Civil Hospital & 108 Ambulance Station",
        "facility_type": "hospital_ambulance",
        "district": "Kamrup Metropolitan",
        "state": "Assam",
        "latitude": 26.1210,
        "longitude": 91.9810,
        "phone": "+91-361-2788108",
        "emergency_line": "108",
        "units_available": "2 BLS Ambulances, 1 Trauma Mobile Unit",
        "nodal_officer": "Dr. R. Medhi",
        "operational_status": "active"
    },
    {
        "name": "NEIGRIHMS Super Specialty Hospital Trauma Fleet",
        "facility_type": "hospital_ambulance",
        "district": "East Khasi Hills",
        "state": "Meghalaya",
        "latitude": 25.5990,
        "longitude": 91.9420,
        "phone": "+91-364-2538011",
        "emergency_line": "108",
        "units_available": "4 Advanced Life Support (ALS) Cardiac Ambulances",
        "nodal_officer": "Dr. P. Laloo",
        "operational_status": "active"
    },
    {
        "name": "Jowai Civil Hospital Emergency Ambulance Center",
        "facility_type": "hospital_ambulance",
        "district": "West Jaintia Hills",
        "state": "Meghalaya",
        "latitude": 25.4410,
        "longitude": 92.2080,
        "phone": "+91-3652-220412",
        "emergency_line": "108",
        "units_available": "2 4x4 Hill Ambulances with Mobile Oxygen",
        "nodal_officer": "Dr. M. Suchiang",
        "operational_status": "active"
    },
    {
        "name": "Khliehriat Community Health Center (CHC) 108 Unit",
        "facility_type": "hospital_ambulance",
        "district": "East Jaintia Hills",
        "state": "Meghalaya",
        "latitude": 25.3560,
        "longitude": 92.3620,
        "phone": "+91-3655-230108",
        "emergency_line": "108",
        "units_available": "2 Landslide Trauma Ambulances",
        "nodal_officer": "Dr. F. Marwein",
        "operational_status": "active"
    },
    {
        "name": "Silchar Medical College & Hospital (SMCH) Trauma Center",
        "facility_type": "hospital_ambulance",
        "district": "Cachar",
        "state": "Assam",
        "latitude": 24.7880,
        "longitude": 92.7930,
        "phone": "+91-3842-240108",
        "emergency_line": "108",
        "units_available": "5 ALS Ambulances, 1 Amphibious Medical Rescue Unit",
        "nodal_officer": "Dr. B. K. Bhattacharjee",
        "operational_status": "active"
    },
    {
        "name": "Haflong Civil Hospital 108 Emergency Ambulance",
        "facility_type": "hospital_ambulance",
        "district": "Dima Hasao",
        "state": "Assam",
        "latitude": 25.1710,
        "longitude": 93.0240,
        "phone": "+91-3673-236108",
        "emergency_line": "108",
        "units_available": "2 Hill 4x4 Ambulances",
        "nodal_officer": "Dr. R. Langthasa",
        "operational_status": "active"
    },
    {
        "name": "Bokakhat Swahid Kamala Miri Hospital 108 Ambulance",
        "facility_type": "hospital_ambulance",
        "district": "Golaghat",
        "state": "Assam",
        "latitude": 26.6320,
        "longitude": 93.5880,
        "phone": "+91-3776-268108",
        "emergency_line": "108",
        "units_available": "2 Flood Evacuation Ambulances",
        "nodal_officer": "Dr. J. Bora",
        "operational_status": "active"
    },
    {
        "name": "Naga Hospital Authority Kohima (NHAK) ALS Fleet",
        "facility_type": "hospital_ambulance",
        "district": "Kohima",
        "state": "Nagaland",
        "latitude": 25.6740,
        "longitude": 94.1120,
        "phone": "+91-3866-222108",
        "emergency_line": "108",
        "units_available": "3 ALS Ambulances with Mountain Tire Chains",
        "nodal_officer": "Dr. T. Jamir",
        "operational_status": "active"
    },
    {
        "name": "Rangpo Primary Health Center Emergency Ambulance Base",
        "facility_type": "hospital_ambulance",
        "district": "Pakyong",
        "state": "Sikkim",
        "latitude": 27.1790,
        "longitude": 88.5340,
        "phone": "+91-3592-240108",
        "emergency_line": "108",
        "units_available": "2 High-Altitude 4x4 Ambulances",
        "nodal_officer": "Dr. K. Sharma",
        "operational_status": "active"
    }
]

# Baseline Emergency Complaints & Dispatch Tickets
INITIAL_COMPLAINTS = [
    {
        "complaint_type": "ambulance",
        "emergency_nature": "trauma_injury",
        "caller_name": "Ramen Bora (Commuter)",
        "caller_phone": "+91-94352-88123",
        "latitude": 26.5920,
        "longitude": 93.2100,
        "location_address": "NH-715 near Kohora Safari Gate, Kaziranga",
        "severity": "critical",
        "details": "Two passengers injured after SUV skidded on flooded highway shoulder. Bleeding leg injury; urgent medical aid needed.",
        "assigned_facility_id": 18,
        "assigned_facility_name": "Bokakhat Swahid Kamala Miri Hospital 108 Ambulance",
        "assigned_facility_type": "hospital_ambulance",
        "distance_km": 11.4,
        "eta_minutes": 16,
        "assigned_unit": "108 ALS Ambulance AS-05-EM-112 (Paramedic: B. Gogoi)",
        "dispatch_status": "en_route",
        "secondary_facility_name": None,
        "secondary_unit": None,
        "alert_sent": 1
    },
    {
        "complaint_type": "police",
        "emergency_nature": "landslide_trapped",
        "caller_name": "K. Sangma (Truck Driver)",
        "caller_phone": "+91-98561-33445",
        "latitude": 25.1320,
        "longitude": 92.3550,
        "location_address": "NH-6 2km north of Sonapur Tunnel",
        "severity": "critical",
        "details": "3 passenger vehicles trapped between two fresh rockfalls. Boulders falling. Elderly passengers inside require emergency extraction.",
        "assigned_facility_id": 5,
        "assigned_facility_name": "Khliehriat Police Station (Sonapur Chokepoint)",
        "assigned_facility_type": "police_station",
        "distance_km": 8.2,
        "eta_minutes": 12,
        "assigned_unit": "Rescue PCR-02 & BRO Heavy Crane Escort (SI T. Lyngdoh)",
        "dispatch_status": "dispatched",
        "secondary_facility_name": None,
        "secondary_unit": None,
        "alert_sent": 1
    },
    {
        "complaint_type": "both",
        "emergency_nature": "stranded_flood",
        "caller_name": "Mitali Das (Local Resident)",
        "caller_phone": "+91-94350-99001",
        "latitude": 24.8320,
        "longitude": 92.7880,
        "location_address": "Rangirkhari Lowland Colony, Silchar",
        "severity": "high",
        "details": "Water entered house up to 4 feet. Pregnant woman in 8th month requires evacuation boat and medical checkup.",
        "assigned_facility_id": 16,
        "assigned_facility_name": "Silchar Medical College & Hospital (SMCH) Trauma Center",
        "assigned_facility_type": "hospital_ambulance",
        "distance_km": 5.1,
        "eta_minutes": 10,
        "assigned_unit": "Amphibious Medical Unit SMCH-01 (Nurse S. Paul)",
        "dispatch_status": "en_route",
        "secondary_facility_name": "Silchar Sadar Police Station",
        "secondary_unit": "Flood Rescue Dinghy Police Team 04",
        "alert_sent": 1
    }
]

def seed_database():
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    # Clear existing to ensure clean seed
    cursor.execute("DELETE FROM incidents")
    cursor.execute("DELETE FROM damaged_structures")
    cursor.execute("DELETE FROM relief_camps")
    cursor.execute("DELETE FROM emergency_contacts")
    cursor.execute("DELETE FROM amenities")
    cursor.execute("DELETE FROM fleet_vehicles")
    cursor.execute("DELETE FROM field_sitreps")
    cursor.execute("DELETE FROM emergency_facilities")
    cursor.execute("DELETE FROM emergency_complaints")

    for inc in INITIAL_INCIDENTS:
        cursor.execute("""
            INSERT INTO incidents (hazard_type, title, description, latitude, longitude, nearest_node, severity, photo_url, reporter_name, upvotes, verified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (inc["hazard_type"], inc["title"], inc["description"], inc["latitude"], inc["longitude"], inc["nearest_node"], inc["severity"], inc["photo_url"], inc["reporter_name"], inc["upvotes"], inc["verified"]))

    for st in INITIAL_DAMAGED_STRUCTURES:
        cursor.execute("""
            INSERT INTO damaged_structures (name, structure_type, route_name, latitude, longitude, damage_level, passability, description, photo_url, alternate_bypass)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (st["name"], st["structure_type"], st["route_name"], st["latitude"], st["longitude"], st["damage_level"], st["passability"], st["description"], st["photo_url"], st["alternate_bypass"]))

    for camp in INITIAL_RELIEF_CAMPS:
        cursor.execute("""
            INSERT INTO relief_camps (name, district, state, latitude, longitude, capacity, current_occupancy, medical_available, food_water_available, contact_phone, in_charge)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (camp["name"], camp["district"], camp["state"], camp["latitude"], camp["longitude"], camp["capacity"], camp["current_occupancy"], camp["medical_available"], camp["food_water_available"], camp["contact_phone"], camp["in_charge"]))

    for contact in INITIAL_EMERGENCY_CONTACTS:
        cursor.execute("""
            INSERT INTO emergency_contacts (agency, region, phone, alt_phone, email, category)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (contact["agency"], contact["region"], contact["phone"], contact["alt_phone"], contact["email"], contact["category"]))

    for am in INITIAL_AMENITIES:
        cursor.execute("""
            INSERT INTO amenities (category, name, highway, district, state, latitude, longitude, contact_phone, status, fuel_status, capacity_beds, food_available, generator_backup, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (am["category"], am["name"], am["highway"], am["district"], am["state"], am["latitude"], am["longitude"], am["contact_phone"], am["status"], am["fuel_status"], am["capacity_beds"], am["food_available"], am["generator_backup"], am["description"]))

    for fv in INITIAL_FLEET:
        cursor.execute("""
            INSERT INTO fleet_vehicles (vehicle_id, driver_name, driver_phone, cargo_type, cargo_desc, origin, destination, current_lat, current_lng, speed_kmh, status, eta_hours, hazard_alert, route_nodes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (fv["vehicle_id"], fv["driver_name"], fv["driver_phone"], fv["cargo_type"], fv["cargo_desc"], fv["origin"], fv["destination"], fv["current_lat"], fv["current_lng"], fv["speed_kmh"], fv["status"], fv["eta_hours"], fv["hazard_alert"], fv["route_nodes"]))

    for sr in INITIAL_SITREPS:
        cursor.execute("""
            INSERT INTO field_sitreps (officer_name, officer_rank, agency, corridor, district, latitude, longitude, clearance_pct, passability, bridge_status, photo_url, notes, broadcast_alert)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (sr["officer_name"], sr["officer_rank"], sr["agency"], sr["corridor"], sr["district"], sr["latitude"], sr["longitude"], sr["clearance_pct"], sr["passability"], sr["bridge_status"], sr["photo_url"], sr["notes"], sr["broadcast_alert"]))

    for ef in INITIAL_EMERGENCY_FACILITIES:
        cursor.execute("""
            INSERT INTO emergency_facilities (name, facility_type, district, state, latitude, longitude, phone, emergency_line, units_available, nodal_officer, operational_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (ef["name"], ef["facility_type"], ef["district"], ef["state"], ef["latitude"], ef["longitude"], ef["phone"], ef["emergency_line"], ef["units_available"], ef["nodal_officer"], ef["operational_status"]))

    for ec in INITIAL_COMPLAINTS:
        cursor.execute("""
            INSERT INTO emergency_complaints (complaint_type, emergency_nature, caller_name, caller_phone, latitude, longitude, location_address, severity, details, assigned_facility_id, assigned_facility_name, assigned_facility_type, distance_km, eta_minutes, assigned_unit, dispatch_status, secondary_facility_name, secondary_unit, alert_sent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (ec["complaint_type"], ec["emergency_nature"], ec["caller_name"], ec["caller_phone"], ec["latitude"], ec["longitude"], ec["location_address"], ec["severity"], ec["details"], ec["assigned_facility_id"], ec["assigned_facility_name"], ec["assigned_facility_type"], ec["distance_km"], ec["eta_minutes"], ec["assigned_unit"], ec["dispatch_status"], ec["secondary_facility_name"], ec["secondary_unit"], ec["alert_sent"]))

    conn.commit()
    conn.close()
    print("Database successfully seeded with realistic North East disaster, supply chain, amenity, and emergency facility data.")

if __name__ == "__main__":
    seed_database()
