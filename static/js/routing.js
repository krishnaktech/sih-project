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
    
    // Auto-recalculate if coordinates or cities are already filled
    if (routeInputMode === 'coords') {
        const startRaw = (document.getElementById('startCoordInput')?.value || '').trim();
        const endRaw = (document.getElementById('endCoordInput')?.value || '').trim();
        if (parseCoordinateString(startRaw) && parseCoordinateString(endRaw)) {
            calculateRoute();
        }
    } else {
        const origin = document.getElementById('originSelect')?.value;
        const dest = document.getElementById('destSelect')?.value;
        if (origin && dest && origin !== dest) {
            calculateRoute();
        }
    }
}

function formatTravelTime(hrs) {
    if (hrs === undefined || hrs === null || isNaN(hrs)) return '0 hrs';
    const num = parseFloat(hrs);
    const totalMins = Math.round(num * 60);
    if (totalMins < 60) {
        return `${num} hrs <span style="font-size: 11px; font-weight: 500; opacity: 0.85;">(${totalMins}m)</span>`;
    }
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    const sub = m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${num} hrs <span style="font-size: 11px; font-weight: 500; opacity: 0.85;">(${sub})</span>`;
}

// ----------------- Coordinate Routing & Mode Switcher -----------------
let routeInputMode = 'city'; // 'city' or 'coords'
let activeMapPicker = null;   // 'start', 'end', or null
let startCoordMarker = null;
let endCoordMarker = null;
let coordDebounceTimers = { start: null, end: null };

function setRouteInputMode(mode) {
    routeInputMode = mode;
    const btnCity = document.getElementById('btnModeCity');
    const btnCoords = document.getElementById('btnModeCoords');
    const panelCity = document.getElementById('panelCityInputs');
    const panelCoords = document.getElementById('panelCoordInputs');

    if (mode === 'coords') {
        btnCity?.classList.remove('active');
        btnCoords?.classList.add('active');
        if (panelCity) panelCity.style.display = 'none';
        if (panelCoords) panelCoords.style.display = 'block';

        // Set default demo coordinates if empty
        const startInput = document.getElementById('startCoordInput');
        const endInput = document.getElementById('endCoordInput');
        if (startInput && !startInput.value.trim()) {
            startInput.value = '26.1445, 91.7362';
            handleCoordInputChange('start');
        }
        if (endInput && !endInput.value.trim()) {
            endInput.value = '25.5788, 91.8933';
            handleCoordInputChange('end');
        }
    } else {
        btnCoords?.classList.remove('active');
        btnCity?.classList.add('active');
        if (panelCoords) panelCoords.style.display = 'none';
        if (panelCity) panelCity.style.display = 'block';
        cancelMapPointPicker();
        removeCoordMapMarker('start');
        removeCoordMapMarker('end');
    }
}

function parseCoordinateString(str) {
    if (!str) return null;
    let s = str.trim().replace(/°/g, '');
    const parts = s.split(/[\s,]+/);
    if (parts.length >= 2) {
        let lat = parseFloat(parts[0]);
        let lng = parseFloat(parts[1]);
        if (s.toUpperCase().includes('S')) lat = -Math.abs(lat);
        if (s.toUpperCase().includes('W')) lng = -Math.abs(lng);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
        }
    }
    return null;
}

function handleCoordInputChange(type) {
    const input = document.getElementById(type === 'start' ? 'startCoordInput' : 'endCoordInput');
    const clearBtn = document.getElementById(type === 'start' ? 'btnClearStartCoord' : 'btnClearEndCoord');
    const card = document.getElementById(type === 'start' ? 'startCoordLocationCard' : 'endCoordLocationCard');
    const titleEl = document.getElementById(type === 'start' ? 'startCoordLocTitle' : 'endCoordLocTitle');
    const addrEl = document.getElementById(type === 'start' ? 'startCoordLocAddress' : 'endCoordLocAddress');

    if (!input) return;

    if (input.value.trim()) {
        if (clearBtn) clearBtn.style.display = 'block';
    } else {
        if (clearBtn) clearBtn.style.display = 'none';
        if (card) card.style.display = 'none';
        removeCoordMapMarker(type);
        return;
    }

    const coords = parseCoordinateString(input.value);
    if (!coords) {
        if (card) card.style.display = 'block';
        if (titleEl) {
            titleEl.textContent = 'Invalid Coordinates';
            titleEl.style.color = '#dc2626';
        }
        if (addrEl) addrEl.textContent = 'Enter valid latitude, longitude (e.g. 26.1445, 91.7362)';
        return;
    }

    if (card) card.style.display = 'block';
    if (titleEl) {
        titleEl.style.color = '#0369a1';
        titleEl.textContent = 'Resolving location...';
    }
    if (addrEl) addrEl.textContent = `Pin placed at ${coords.lat}, ${coords.lng}`;

    updateCoordMapMarker(type, coords.lat, coords.lng, 'Resolving address...', `Coordinates: ${coords.lat}, ${coords.lng}`);

    // Debounce reverse geocoding lookup
    clearTimeout(coordDebounceTimers[type]);
    coordDebounceTimers[type] = setTimeout(async () => {
        try {
            const res = await fetch(`/api/geocode/reverse?lat=${coords.lat}&lng=${coords.lng}`);
            if (res.ok) {
                const data = await res.json();
                if (titleEl) titleEl.textContent = data.short_name || data.city || 'Identified Location';
                if (addrEl) addrEl.textContent = data.display_name;
                updateCoordMapMarker(type, coords.lat, coords.lng, data.short_name || 'Location', data.display_name);
            }
        } catch (err) {
            console.warn("Geocoding lookup error:", err);
        }
    }, 350);
}

function clearCoordInput(type) {
    const input = document.getElementById(type === 'start' ? 'startCoordInput' : 'endCoordInput');
    if (input) input.value = '';
    handleCoordInputChange(type);
}

function useGpsForStartCoord() {
    if (typeof currentGpsCoords !== 'undefined' && currentGpsCoords && currentGpsCoords.lat && currentGpsCoords.lng) {
        const input = document.getElementById('startCoordInput');
        if (input) {
            input.value = `${currentGpsCoords.lat.toFixed(5)}, ${currentGpsCoords.lng.toFixed(5)}`;
            handleCoordInputChange('start');
        }
    } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                const input = document.getElementById('startCoordInput');
                if (input) {
                    input.value = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
                    handleCoordInputChange('start');
                }
            },
            err => alert("GPS coordinates could not be retrieved: " + err.message)
        );
    } else {
        alert("Geolocation is not supported on this device.");
    }
}

function toggleMapPointPicker(type) {
    if (activeMapPicker === type) {
        cancelMapPointPicker();
        return;
    }
    activeMapPicker = type;
    const banner = document.getElementById('mapPickerNotice');
    const noticeText = document.getElementById('mapPickerNoticeText');
    const startBtn = document.getElementById('btnPickStartMap');
    const endBtn = document.getElementById('btnPickEndMap');

    if (banner) banner.style.display = 'flex';
    if (noticeText) {
        noticeText.textContent = type === 'start'
            ? '📍 Click anywhere on the map to set Start position'
            : '🏁 Click anywhere on the map to set End position';
    }

    if (startBtn) startBtn.style.color = (type === 'start' ? '#ea580c' : '#059669');
    if (endBtn) endBtn.style.color = (type === 'end' ? '#ea580c' : '#059669');

    if (window.map && window.map.getContainer()) {
        window.map.getContainer().style.cursor = 'crosshair';
    }
}

function cancelMapPointPicker() {
    activeMapPicker = null;
    const banner = document.getElementById('mapPickerNotice');
    const startBtn = document.getElementById('btnPickStartMap');
    const endBtn = document.getElementById('btnPickEndMap');

    if (banner) banner.style.display = 'none';
    if (startBtn) startBtn.style.color = '#059669';
    if (endBtn) endBtn.style.color = '#059669';

    if (window.map && window.map.getContainer()) {
        window.map.getContainer().style.cursor = '';
    }
}

function handleMapClickForCoordPicker(lat, lng) {
    if (!activeMapPicker) return false;
    const type = activeMapPicker;
    const input = document.getElementById(type === 'start' ? 'startCoordInput' : 'endCoordInput');
    if (input) {
        input.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        handleCoordInputChange(type);
    }
    cancelMapPointPicker();
    return true;
}

function updateCoordMapMarker(type, lat, lng, title, address) {
    if (!window.map && typeof map !== 'undefined') window.map = map;
    if (!window.map) return;

    const isStart = type === 'start';
    let marker = isStart ? startCoordMarker : endCoordMarker;

    const iconHtml = isStart
        ? `<div style="background: #16a34a; color: white; width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.35); border: 2.5px solid white;"><span style="transform: rotate(45deg); font-size: 15px;">🟢</span></div>`
        : `<div style="background: #dc2626; color: white; width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.35); border: 2.5px solid white;"><span style="transform: rotate(45deg); font-size: 15px;">🏁</span></div>`;

    const customIcon = L.divIcon({
        className: `custom-route-pin-${type}`,
        html: iconHtml,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -34]
    });

    const popupContent = `
        <div style="font-family: sans-serif; font-size: 12px; min-width: 180px;">
            <div style="font-weight: bold; color: ${isStart ? '#16a34a' : '#dc2626'}; margin-bottom: 3px;">
                ${isStart ? '🟢 Start Position' : '🏁 Destination Position'}
            </div>
            <div style="font-weight: 600; color: #0f172a; margin-bottom: 2px;">${title || 'Selected Coordinate'}</div>
            <div style="color: #475569; font-size: 11px; line-height: 1.3;">${address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}</div>
            <div style="margin-top: 5px; font-size: 10px; color: #64748b; font-style: italic;">↔️ Drag pin to fine-tune position</div>
        </div>
    `;

    if (!marker) {
        marker = L.marker([lat, lng], { icon: customIcon, draggable: true }).addTo(window.map);
        marker.bindPopup(popupContent);

        marker.on('dragend', function(e) {
            const pos = e.target.getLatLng();
            const input = document.getElementById(type === 'start' ? 'startCoordInput' : 'endCoordInput');
            if (input) {
                input.value = `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
                handleCoordInputChange(type);
            }
        });

        if (isStart) startCoordMarker = marker;
        else endCoordMarker = marker;
    } else {
        marker.setLatLng([lat, lng]);
        marker.setPopupContent(popupContent);
    }
}

function removeCoordMapMarker(type) {
    if (type === 'start' && startCoordMarker) {
        if (window.map) window.map.removeLayer(startCoordMarker);
        startCoordMarker = null;
    } else if (type === 'end' && endCoordMarker) {
        if (window.map) window.map.removeLayer(endCoordMarker);
        endCoordMarker = null;
    }
}

async function calculateRoute() {
    let originParam = '';
    let destParam = '';

    if (routeInputMode === 'coords') {
        const startRaw = (document.getElementById('startCoordInput')?.value || '').trim();
        const endRaw = (document.getElementById('endCoordInput')?.value || '').trim();

        const startCoords = parseCoordinateString(startRaw);
        const endCoords = parseCoordinateString(endRaw);

        if (!startCoords || !endCoords) {
            alert("Please enter valid latitude and longitude coordinates for both Start and End positions.\nExample: 26.1445, 91.7362");
            return;
        }

        const startLocName = document.getElementById('startCoordLocTitle')?.textContent || 'Start Position';
        const endLocName = document.getElementById('endCoordLocTitle')?.textContent || 'End Position';

        originParam = `coords:${startCoords.lat},${startCoords.lng}|${startLocName}`;
        destParam = `coords:${endCoords.lat},${endCoords.lng}|${endLocName}`;
    } else {
        const origin = document.getElementById('originSelect')?.value;
        const dest = document.getElementById('destSelect')?.value;

        if (!origin || !dest) {
            alert("Please select both Origin and Destination.");
            return;
        }

        if (origin === dest) {
            alert("Origin and Destination cannot be the same.");
            return;
        }

        originParam = origin;
        destParam = dest;
    }

    const calcBtn = document.getElementById('btnCalculate');
    if (calcBtn) {
        calcBtn.innerHTML = '⏳ Analyzing Disaster Terrain...';
        calcBtn.disabled = true;
    }

    try {
        const res = await fetch('/api/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                origin: originParam,
                destination: destParam,
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
        if (calcBtn) {
            calcBtn.innerHTML = '🧭 Calculate Safe Route';
            calcBtn.disabled = false;
        }
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
                        <div class="stat-value">${formatTravelTime(safest.estimated_time_hours)}</div>
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
                                    <div style="font-size: 10px; color: #94a3b8;">${s.highway} • ${s.distance_km} km • ⏱️ ${formatTravelTime(s.segment_time_hours)}</div>
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
                        <div class="stat-value" style="color: #fca5a5;">${formatTravelTime(direct.estimated_time_hours)}</div>
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
