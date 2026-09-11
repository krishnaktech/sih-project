// AapdaMarg NE - Interactive Map Controller

let map;
let baseLayers = {};
let layerGroups = {
    routes: L.layerGroup(),
    hazards: L.layerGroup(),
    riskZones: L.layerGroup(),
    reports: L.layerGroup(),
    camps: L.layerGroup(),
    fleet: L.layerGroup(),
    facilities: L.layerGroup(),
    sosIncidents: L.layerGroup()
};

let pickingLocation = false;
let tempPickMarker = null;

function initMap() {
    // Center of North East India (Guwahati / Brahmaputra Valley)
    map = L.map('map', {
        center: [26.1445, 92.5],
        zoom: 7,
        zoomControl: false,
        minZoom: 6,
        maxZoom: 16
    });
    window.map = map;
    window.layerGroups = layerGroups;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // 1. Dark Theme Tile Layer (OSM with custom dark CSS filter - 100% free, no API key, no watermark)
    const darkNavMap = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        className: 'dark-tile-layer',
        maxZoom: 19
    });

    // 2. Topographic & Terrain Map (ESRI World Topo Map - Free, detailed mountain contours)
    const topoMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri, USGS, NOAA',
        maxZoom: 18
    });

    // 3. Satellite Imagery (ESRI World Imagery - Free high-res aerial view)
    const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri, Earthstar Geographics',
        maxZoom: 18
    });

    // 4. Standard OpenStreetMap Street View
    const osmStreet = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    });

    // Default to Light Street layer
    osmStreet.addTo(map);

    baseLayers = {
        "Standard Street": osmStreet,
        "Terrain & Contours": topoMap,
        "Satellite Imagery": satelliteMap,
        "Dark Navigation": darkNavMap
    };

    // Add layer groups to map
    layerGroups.routes.addTo(map);
    layerGroups.hazards.addTo(map);
    layerGroups.riskZones.addTo(map);
    layerGroups.reports.addTo(map);
    layerGroups.camps.addTo(map);
    layerGroups.fleet.addTo(map);
    layerGroups.facilities.addTo(map);
    layerGroups.sosIncidents.addTo(map);

    // Map click handler (for coordinate routing picker, photo/incident reporting & SOS location picker)
    map.on('click', function(e) {
        if (typeof handleMapClickForCoordPicker === 'function' && handleMapClickForCoordPicker(e.latlng.lat, e.latlng.lng)) {
            return;
        }
        if (pickingLocation) {
            setPickedLocation(e.latlng.lat, e.latlng.lng);
        } else if (typeof handleMapClickForSos === 'function') {
            handleMapClickForSos(e.latlng.lat, e.latlng.lng);
        }
    });

    loadHazardsAndZones();
}

function switchBaseMap(type) {
    Object.values(baseLayers).forEach(layer => map.removeLayer(layer));
    if (baseLayers[type]) {
        baseLayers[type].addTo(map);
    }
}

function toggleOverlayLayer(layerKey, show) {
    if (!layerGroups[layerKey]) return;
    if (show) {
        map.addLayer(layerGroups[layerKey]);
    } else {
        map.removeLayer(layerGroups[layerKey]);
    }
}

// Render Risk Zones & Incident Markers
async function loadHazardsAndZones() {
    try {
        const res = await fetch('/api/hazards');
        const data = await res.json();

        // 1. High-Risk Corridors & Polygons
        layerGroups.riskZones.clearLayers();
        if (data.high_risk_zones) {
            data.high_risk_zones.forEach(zone => {
                const polygon = L.polygon(zone.coordinates, {
                    color: zone.color,
                    fillColor: zone.color,
                    fillOpacity: 0.22,
                    weight: 2,
                    dashArray: '5, 5'
                }).addTo(layerGroups.riskZones);

                polygon.bindPopup(`
                    <div style="color: #0f172a; padding: 4px;">
                        <h4 style="font-weight: 700; margin-bottom: 4px; color: ${zone.color};">⚠️ ${zone.name}</h4>
                        <p style="font-size: 12px; margin-bottom: 4px;"><strong>Hazard Type:</strong> ${zone.type.toUpperCase()}</p>
                        <p style="font-size: 11px; color: #475569;">${zone.description}</p>
                        <div style="margin-top: 6px; font-size: 11px; font-weight: bold; color: #dc2626;">STATUS: DANGER ZONE</div>
                    </div>
                `);
            });
        }

        // 2. Active Hazards & Crowdsourced Incidents
        layerGroups.hazards.clearLayers();
        if (data.incidents) {
            data.incidents.forEach(inc => {
                addIncidentMarker(inc);
            });
        }

        // 3. Damaged Structures Checkpoints
        if (data.damaged_structures) {
            data.damaged_structures.forEach(st => {
                addStructureMarker(st);
            });
        }

    } catch (err) {
        console.error("Failed to load hazards:", err);
    }
}

function getHazardIconHtml(hazardType, severity) {
    let icon = "⚠️";
    let bg = "#dc2626";

    if (hazardType === "landslide") {
        icon = "⛰️";
        bg = severity === "critical" ? "#7f1d1d" : "#ea580c";
    } else if (hazardType === "flood") {
        icon = "🌊";
        bg = "#2563eb";
    } else if (hazardType === "damaged_bridge") {
        icon = "🚧";
        bg = "#b91c1c";
    } else if (hazardType === "road_collapse") {
        icon = "🕳️";
        bg = "#dc2626";
    } else if (hazardType === "heavy_debris") {
        icon = "🪵";
        bg = "#d97706";
    }

    return `
        <div class="hazard-marker-pulse" style="background: ${bg}; width: 34px; height: 34px; border: 2px solid #ffffff; font-size: 16px;">
            ${icon}
        </div>
    `;
}

function addIncidentMarker(inc) {
    const customIcon = L.divIcon({
        className: 'custom-hazard-icon',
        html: getHazardIconHtml(inc.hazard_type, inc.severity),
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });

    const marker = L.marker([inc.latitude, inc.longitude], { icon: customIcon });

    const photoHtml = inc.photo_url 
        ? `<div style="margin-top: 8px; border-radius: 6px; overflow: hidden; max-height: 160px; background: #000;">
             <img src="${inc.photo_url}" alt="Hazard Proof" style="width: 100%; height: 140px; object-fit: cover; display: block; cursor: pointer;" onclick="openPhotoModal('${inc.photo_url}', '${escapeQuotes(inc.title)}')">
           </div>`
        : '';

    marker.bindPopup(`
        <div style="color: #0f172a; min-width: 240px; max-width: 290px; padding: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="background: #fee2e2; color: #b91c1c; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                    ${inc.hazard_type.replace('_', ' ')}
                </span>
                <span style="font-size: 11px; color: #64748b;">
                    ${inc.verified ? '✅ Verified by BRO/SDRF' : '🕒 Citizen Report'}
                </span>
            </div>
            <h4 style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 6px; line-height: 1.3;">
                ${inc.title}
            </h4>
            <p style="font-size: 11px; color: #334155; line-height: 1.4; margin-bottom: 8px;">
                ${inc.description || 'No additional notes provided.'}
            </p>
            ${photoHtml}
            <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 11px;">
                <span style="color: #64748b;">By: <strong>${inc.reporter_name || 'Reporter'}</strong></span>
                <button onclick="upvoteIncident(${inc.id}, this)" style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 11px; font-weight: 600;">
                    👍 <span class="upvote-count">${inc.upvotes || 1}</span>
                </button>
            </div>
            ${(typeof isHeadquartersUser === 'function' ? isHeadquartersUser() : (localStorage.getItem('aapdamarg_user_role') === 'headquarters')) ? `
                <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #fca5a5; display: flex; justify-content: flex-end;">
                    <button onclick="deleteHazardReport(${inc.id}, '${escapeQuotes(inc.title)}')" style="background: #fef2f2; color: #dc2626; border: 1px solid #f87171; border-radius: 4px; padding: 3px 8px; font-size: 10.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;" title="Authorized Headquarters Action: Remove Hazard">
                        🗑️ Remove Hazard (HQ)
                    </button>
                </div>
            ` : ''}
        </div>
    `);

    marker.addTo(layerGroups.hazards);
}

function addStructureMarker(st) {
    const icon = L.divIcon({
        className: 'custom-struct-icon',
        html: `<div style="background: #7f1d1d; color: white; width: 30px; height: 30px; border-radius: 6px; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 0 8px rgba(0,0,0,0.5);">🌉</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    const marker = L.marker([st.latitude, st.longitude], { icon });

    marker.bindPopup(`
        <div style="color: #0f172a; min-width: 250px; padding: 4px;">
            <div style="font-size: 10px; font-weight: bold; color: #dc2626; text-transform: uppercase;">
                ${st.structure_type} | ${st.passability.toUpperCase()}
            </div>
            <h4 style="font-size: 13px; font-weight: 700; margin: 4px 0;">${st.name}</h4>
            <p style="font-size: 11px; color: #475569; margin-bottom: 6px;"><strong>Corridor:</strong> ${st.route_name}</p>
            <p style="font-size: 11px; color: #334155; margin-bottom: 6px;">${st.description}</p>
            <div style="background: #fef3c7; border: 1px solid #fde68a; padding: 6px; border-radius: 4px; font-size: 11px; color: #92400e;">
                <strong>Bypass Route:</strong> ${st.alternate_bypass || 'Consult local police'}
            </div>
        </div>
    `);

    marker.addTo(layerGroups.hazards);
}

// Pick Location for Reporting Modal
function startPickLocation() {
    pickingLocation = true;
    document.getElementById('reportModal').classList.remove('active');
    
    // Show a floating banner on map
    const banner = document.createElement('div');
    banner.id = 'pickBanner';
    banner.style.position = 'absolute';
    banner.style.top = '20px';
    banner.style.left = '50%';
    banner.style.transform = 'translateX(-50%)';
    banner.style.background = '#0284c7';
    banner.style.color = '#ffffff';
    banner.style.padding = '10px 20px';
    banner.style.borderRadius = '30px';
    banner.style.fontWeight = 'bold';
    banner.style.fontSize = '14px';
    banner.style.boxShadow = '0 4px 15px rgba(0,0,0,0.4)';
    banner.style.zIndex = '1500';
    banner.innerHTML = '📍 Click anywhere on the map to pinpoint the hazard location';
    document.body.appendChild(banner);
}

function setPickedLocation(lat, lng) {
    pickingLocation = false;
    const banner = document.getElementById('pickBanner');
    if (banner) banner.remove();

    if (tempPickMarker) {
        map.removeLayer(tempPickMarker);
    }

    tempPickMarker = L.marker([lat, lng], {
        icon: L.divIcon({
            html: '<div style="font-size: 26px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">📍</div>',
            iconSize: [26, 26],
            iconAnchor: [13, 26]
        })
    }).addTo(map);

    document.getElementById('reportLat').value = lat.toFixed(5);
    document.getElementById('reportLng').value = lng.toFixed(5);
    document.getElementById('reportModal').classList.add('active');
}

function escapeQuotes(str) {
    return (str || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

// Map Layers & Legend Dropdown Controls
function toggleMapLayersMenu(e) {
    if (e) e.stopPropagation();
    const panel = document.getElementById('mapDropdownPanel');
    const arrow = document.getElementById('mapDropdownArrow');
    if (!panel) return;
    const isOpen = panel.classList.contains('active');
    if (isOpen) {
        panel.classList.remove('active');
        if (arrow) arrow.innerText = '▾';
    } else {
        panel.classList.add('active');
        if (arrow) arrow.innerText = '▴';
    }
}

function closeMapLayersMenu() {
    const panel = document.getElementById('mapDropdownPanel');
    const arrow = document.getElementById('mapDropdownArrow');
    if (panel) panel.classList.remove('active');
    if (arrow) arrow.innerText = '▾';
}

function switchMapMenuTab(tabName) {
    const tabLayers = document.getElementById('tabBtnLayers');
    const tabLegend = document.getElementById('tabBtnLegend');
    const panelLayers = document.getElementById('mapPanelLayers');
    const panelLegend = document.getElementById('mapPanelLegend');

    if (tabName === 'layers') {
        if (tabLayers) tabLayers.classList.add('active');
        if (tabLegend) tabLegend.classList.remove('active');
        if (panelLayers) panelLayers.style.display = 'block';
        if (panelLegend) panelLegend.style.display = 'none';
    } else {
        if (tabLegend) tabLegend.classList.add('active');
        if (tabLayers) tabLayers.classList.remove('active');
        if (panelLegend) panelLegend.style.display = 'block';
        if (panelLayers) panelLayers.style.display = 'none';
    }
}

// Global listener to close dropdown on click outside
document.addEventListener('click', function(e) {
    const container = document.getElementById('mapDropdownContainer');
    if (container && !container.contains(e.target)) {
        closeMapLayersMenu();
    }
});
