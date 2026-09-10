// AapdaMarg NE - Routing & Risk Assessment Controller

let currentSafePolyline = null;
let currentDirectPolyline = null;
let routeMarkers = [];

async function initRouting() {
    try {
        const res = await fetch('/api/nodes');
        const data = await res.json();
        
        const originSelect = document.getElementById('originSelect');
        const destSelect = document.getElementById('destSelect');

        originSelect.innerHTML = '<option value="">-- Choose Origin City --</option>';
        destSelect.innerHTML = '<option value="">-- Choose Destination --</option>';

        // Group by State
        const states = {};
        data.nodes.forEach(node => {
            if (!states[node.state]) states[node.state] = [];
            states[node.state].push(node);
        });

        for (const [state, nodes] of Object.entries(states)) {
            const optgroup1 = document.createElement('optgroup');
            optgroup1.label = state;
            const optgroup2 = document.createElement('optgroup');
            optgroup2.label = state;

            nodes.forEach(node => {
                const opt1 = new Option(node.name, node.id);
                const opt2 = new Option(node.name, node.id);
                optgroup1.appendChild(opt1);
                optgroup2.appendChild(opt2);
            });

            originSelect.appendChild(optgroup1);
            destSelect.appendChild(optgroup2);
        }

        // Set default demo pair: Guwahati to Silchar (famous monsoon disaster route)
        originSelect.value = 'guwahati';
        destSelect.value = 'silchar';

    } catch (err) {
        console.error("Failed to load cities:", err);
    }
}

function setQuickRoute(origin, dest) {
    document.getElementById('originSelect').value = origin;
    document.getElementById('destSelect').value = dest;
    calculateRoute();
}

let selectedVehicle = 'standard';
function selectVehicle(mode, elem) {
    selectedVehicle = mode;
    document.querySelectorAll('.vehicle-btn').forEach(b => b.classList.remove('active'));
    elem.classList.add('active');
    calculateRoute();
}

async function calculateRoute() {
    const origin = document.getElementById('originSelect').value;
    const dest = document.getElementById('destSelect').value;

    if (!origin || !dest) {
        alert("Please select both Origin and Destination.");
        return;
    }

    if (origin === dest) {
        alert("Origin and Destination cannot be the same.");
        return;
    }

    const calcBtn = document.getElementById('btnCalculate');
    calcBtn.innerHTML = '⏳ Analyzing Disaster Terrain...';
    calcBtn.disabled = true;

    try {
        const res = await fetch('/api/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                origin: origin,
                destination: dest,
                vehicle_mode: selectedVehicle
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Route calculation failed");
        }

        const data = await res.json();
        renderRouteResults(data);

    } catch (err) {
        alert(`Routing Error: ${err.message}`);
    } finally {
        calcBtn.innerHTML = '🧭 Calculate Safe Route';
        calcBtn.disabled = false;
    }
}

function renderRouteResults(data) {
    window.lastEvaluatedRoute = data;
    const resultsContainer = document.getElementById('routeResultsContainer');
    resultsContainer.innerHTML = '';

    const originName = data.origin_name || (data.origin ? capitalize(data.origin) : 'Origin');
    const destName = data.destination_name || (data.destination ? capitalize(data.destination) : 'Destination');

    // Clear existing map route lines & markers
    layerGroups.routes.clearLayers();

    const safest = data.safest_route;
    const direct = data.direct_route;

    if (!safest && !direct) {
        resultsContainer.innerHTML = `<div class="p-3" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 12px; margin-top: 10px; font-size: 12px; color: #fca5a5;">
            ⚠️ <strong>No Passable Road Route Found:</strong> Extreme landslides and flood surges currently block all road links between ${originName} and ${destName}. Please check road clearance SITREPs or wait for disaster clearance teams.
        </div>`;
        return;
    }

    const latlngsSafe = (safest && safest.road_polyline && safest.road_polyline.length > 0)
        ? safest.road_polyline
        : (safest ? safest.coordinates.map(c => [c.lat, c.lng]) : []);

    const latlngsDirect = (direct && direct.road_polyline && direct.road_polyline.length > 0)
        ? direct.road_polyline
        : (direct ? direct.coordinates.map(c => [c.lat, c.lng]) : []);

    let directPolyline = null;
    let safePolyline = null;

    // 1. Draw Direct Route (if different from safe route)
    if (direct && !data.is_same_route && latlngsDirect.length > 0) {
        directPolyline = L.polyline(latlngsDirect, {
            color: '#ef4444',
            weight: 5,
            opacity: 0.7,
            dashArray: '8, 8'
        }).addTo(layerGroups.routes);

        directPolyline.bindPopup(`
            <div style="color: #0f172a;">
                <strong style="color: #dc2626;">Direct / Standard Route</strong>
                <div>Distance: ${direct.total_distance_km} km</div>
                <div>Risk Factor: ${direct.composite_risk_score}%</div>
                <div style="color: #b91c1c; font-size: 11px; font-weight: bold;">⚠️ WARNING: Contains critical hazard zones!</div>
            </div>
        `);
    }

    // 2. Draw Safest Route
    if (safest && latlngsSafe.length > 0) {
        const safeGlow = L.polyline(latlngsSafe, {
            color: '#059669',
            weight: 9,
            opacity: 0.35
        }).addTo(layerGroups.routes);

        safePolyline = L.polyline(latlngsSafe, {
            color: '#10b981',
            weight: 5,
            opacity: 0.95
        }).addTo(layerGroups.routes);

        safePolyline.bindPopup(`
            <div style="color: #0f172a;">
                <strong style="color: #059669;">✅ Safest Recommended Route</strong>
                <div>Distance: ${safest.total_distance_km} km</div>
                <div>Risk Factor: ${safest.composite_risk_score}%</div>
                <div style="color: #047857; font-size: 11px; font-weight: bold;">✅ Lowest Flood & Landslide Exposure</div>
            </div>
        `);
    }

    // Add start and end pins
    const activeRoute = safest || direct;
    if (activeRoute && activeRoute.coordinates && activeRoute.coordinates.length > 0) {
        const startCity = activeRoute.coordinates[0];
        const endCity = activeRoute.coordinates[activeRoute.coordinates.length - 1];

        L.circleMarker([startCity.lat, startCity.lng], {
            radius: 7,
            fillColor: '#38bdf8',
            color: '#ffffff',
            weight: 2,
            fillOpacity: 1
        }).addTo(layerGroups.routes).bindTooltip(`Start: ${startCity.name}`);

        L.circleMarker([endCity.lat, endCity.lng], {
            radius: 8,
            fillColor: '#10b981',
            color: '#ffffff',
            weight: 3,
            fillOpacity: 1
        }).addTo(layerGroups.routes).bindTooltip(`Destination: ${endCity.name}`);
    }

    // Fit map bounds to show route
    const boundsPolyline = safePolyline || directPolyline;
    if (boundsPolyline && map) {
        map.fitBounds(boundsPolyline.getBounds(), { padding: [40, 40] });
    }

    // Render HTML Cards for the results
    let html = '';

    // Safest Route Card
    if (safest) {
        const riskFillColor = safest.composite_risk_score < 30 ? '#10b981' : (safest.composite_risk_score < 65 ? '#f59e0b' : '#ef4444');
        html += `
            <div class="route-card safest">
                <div class="route-header">
                    <span class="route-title">
                        ✅ Recommended Safe Path
                    </span>
                    <span class="badge badge-safe">SAFEST</span>
                </div>
                
                <div class="route-stats">
                    <div class="stat-item">
                        <div class="stat-label">Distance</div>
                        <div class="stat-value">${safest.total_distance_km} km</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Est. Time</div>
                        <div class="stat-value">${safest.estimated_time_hours} hrs</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Risk Level</div>
                        <div class="stat-value" style="color: ${riskFillColor};">${safest.composite_risk_score}%</div>
                    </div>
                </div>

                <div class="risk-meter">
                    <div class="risk-meter-header">
                        <span>Terrain & Flood Threat Index</span>
                        <span style="color: ${riskFillColor}; font-weight: bold;">${safest.composite_risk_score}%</span>
                    </div>
                    <div class="risk-progress-bar">
                        <div class="risk-progress-fill" style="width: ${safest.composite_risk_score}%; background: ${riskFillColor};"></div>
                    </div>
                </div>

                <div style="font-size: 11.5px; color: #a7f3d0; margin-bottom: 8px;">
                    ✅ <strong>Corridor:</strong> ${safest.path_nodes.map(n => capitalize(n)).join(' ➔ ')}
                </div>

                <details class="segment-list">
                    <summary style="cursor: pointer; color: #38bdf8; font-weight: 600;">View ${safest.segments.length} Route Segments & Elevations</summary>
                    <div style="margin-top: 8px;">
                        ${safest.segments.map(s => `
                            <div class="segment-item">
                                <div>
                                    <div class="segment-name">${s.from_name} ➔ ${s.to_name}</div>
                                    <div style="font-size: 10px; color: #94a3b8;">${s.highway} • ${s.distance_km} km</div>
                                </div>
                                <div style="text-align: right;">
                                    <span class="badge badge-${s.risk_badge}">${s.risk_score}% Risk</span>
                                    <div style="font-size: 9.5px; color: #cbd5e1;">Flood: ${s.flood_risk}% | Slide: ${s.landslide_risk}%</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </details>
            </div>
        `;
    }

    // Direct / Comparison Card
    if (direct && !data.is_same_route) {
        const directRiskColor = direct.composite_risk_score < 30 ? '#10b981' : (direct.composite_risk_score < 65 ? '#f59e0b' : '#ef4444');
        html += `
            <div class="route-card critical" style="margin-top: 12px;">
                <div class="route-header">
                    <span class="route-title">
                        ⚠️ Direct / Standard Highway
                    </span>
                    <span class="badge badge-danger">HIGH DANGER</span>
                </div>
                
                <div class="route-stats">
                    <div class="stat-item">
                        <div class="stat-label">Distance</div>
                        <div class="stat-value">${direct.total_distance_km} km</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Est. Time</div>
                        <div class="stat-value" style="color: #fca5a5;">${direct.estimated_time_hours} hrs</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Risk Level</div>
                        <div class="stat-value" style="color: ${directRiskColor};">${direct.composite_risk_score}%</div>
                    </div>
                </div>

                <div class="risk-meter">
                    <div class="risk-meter-header">
                        <span>Threat Severity</span>
                        <span style="color: ${directRiskColor}; font-weight: bold;">${direct.composite_risk_score}%</span>
                    </div>
                    <div class="risk-progress-bar">
                        <div class="risk-progress-fill" style="width: ${direct.composite_risk_score}%; background: ${directRiskColor};"></div>
                    </div>
                </div>

                <div style="background: rgba(220, 38, 38, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 6px; padding: 8px; margin: 8px 0; font-size: 11px;">
                    <div style="font-weight: bold; color: #fca5a5; margin-bottom: 4px;">🚨 Critical Hazards Detected on this path:</div>
                    ${direct.hazards_encountered.length > 0 ? direct.hazards_encountered.map(h => `
                        <div style="color: #fee2e2; margin-bottom: 2px;">
                            • <strong>${h.title || h.name}</strong> (${h.type.replace('_', ' ')})
                        </div>
                    `).join('') : '<div style="color: #fee2e2;">Heavy rain and terrain fragility make this corridor vulnerable.</div>'}
                </div>
            </div>
        `;
    }

    resultsContainer.innerHTML = html;

    // Update Mobile Peek Card
    const peekCard = document.getElementById('mobileRoutePeekCard');
    const peekText = document.getElementById('routePeekText');
    const activeRouteForPeek = safest || direct;
    if (peekCard && peekText && activeRouteForPeek) {
        const isMobile = window.innerWidth <= 768;
        peekCard.style.display = isMobile ? 'flex' : 'none';
        const riskColor = activeRouteForPeek.composite_risk_score < 30 ? '#34d399' : (activeRouteForPeek.composite_risk_score < 65 ? '#f59e0b' : '#ef4444');
        peekText.innerHTML = `<strong>${originName} ➔ ${destName}:</strong> ${activeRouteForPeek.total_distance_km} km • ⏱️ <strong>${activeRouteForPeek.estimated_time_hours} hrs</strong> • <span style="color: ${riskColor}; font-weight: bold;">${activeRouteForPeek.composite_risk_score}% Risk</span>`;
    }
}

function handleLocationSelectChange() {
    const origin = document.getElementById('originSelect').value;
    const dest = document.getElementById('destSelect').value;
    if (origin && dest && origin !== dest) {
        calculateRoute();
    }
}

function capitalize(str) {
    return (str || '').charAt(0).toUpperCase() + (str || '').slice(1);
}
