// AapdaMarg NE - Emergency Amenities, Essential Supply Fleet & Centralized Dashboard Controller

let fleetLayer = null;
let amenityLayers = {
    fuel: L.layerGroup(),
    hotel: L.layerGroup(),
    restaurant: L.layerGroup()
};

async function initFleetAndAmenities() {
    if (map) {
        fleetLayer = layerGroups.fleet;
        amenityLayers.fuel.addTo(map);
        amenityLayers.hotel.addTo(map);
        amenityLayers.restaurant.addTo(map);
    }
    await loadAmenities();
    await loadFleetTracking();
    await loadLogisticsAlerts();
}

// ----------------- Emergency Amenities (Hotels, Restaurants, Petrol Pumps) -----------------

async function loadAmenities() {
    try {
        const res = await fetch('/api/amenities');
        const data = await res.json();
        
        amenityLayers.fuel.clearLayers();
        amenityLayers.hotel.clearLayers();
        amenityLayers.restaurant.clearLayers();

        data.amenities.forEach(am => {
            let iconText = "⛽";
            let typeClass = "fuel";
            let targetLayer = amenityLayers.fuel;

            if (am.category === "hotel") {
                iconText = "🏨";
                typeClass = "hotel";
                targetLayer = amenityLayers.hotel;
            } else if (am.category === "restaurant") {
                iconText = "🍽️";
                typeClass = "restaurant";
                targetLayer = amenityLayers.restaurant;
            }

            const customIcon = L.divIcon({
                className: 'custom-poi-wrapper',
                html: `<div class="amenity-marker ${typeClass}" title="${am.name}">${iconText}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            const marker = L.marker([am.latitude, am.longitude], { icon: customIcon });

            let statusBadge = am.status === 'open' 
                ? '<span style="background: #065f46; color: #6ee7b7; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">OPEN & ACTIVE</span>'
                : '<span style="background: #78350f; color: #fde68a; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">LIMITED / RESTRICTED</span>';

            let extraInfo = '';
            if (am.category === 'petrol_pump') {
                const fColor = am.fuel_status === 'normal' ? '#10b981' : (am.fuel_status === 'diesel_only_rescue' ? '#ef4444' : '#f59e0b');
                extraInfo = `
                    <div style="background: rgba(0,0,0,0.06); padding: 6px; border-radius: 6px; margin: 6px 0; font-size: 11px;">
                        <div><strong>Fuel Stock:</strong> <span style="color: ${fColor}; font-weight: 800;">${am.fuel_status.toUpperCase().replace(/_/g, ' ')}</span></div>
                        <div><strong>Emergency Generator:</strong> ${am.generator_backup ? '✅ Operational' : '❌ Inactive'}</div>
                    </div>
                `;
            } else if (am.category === 'hotel') {
                extraInfo = `
                    <div style="background: rgba(0,0,0,0.06); padding: 6px; border-radius: 6px; margin: 6px 0; font-size: 11px;">
                        <div><strong>Safe Beds Available:</strong> ${am.capacity_beds}</div>
                        <div><strong>Warm Meals:</strong> ${am.food_available ? '✅ Available' : '❌ Limited'}</div>
                    </div>
                `;
            } else {
                extraInfo = `
                    <div style="background: rgba(0,0,0,0.06); padding: 6px; border-radius: 6px; margin: 6px 0; font-size: 11px;">
                        <div><strong>Essential Kitchen:</strong> ${am.food_available ? '✅ Hot Food & Drinking Water' : '❌ Ration Packs'}</div>
                    </div>
                `;
            }

            marker.bindPopup(`
                <div style="color: #0f172a; min-width: 250px; padding: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">${am.highway} • ${am.district}</span>
                        ${statusBadge}
                    </div>
                    <h4 style="font-size: 13px; font-weight: 800; margin: 4px 0; color: #0f172a;">${iconText} ${am.name}</h4>
                    <p style="font-size: 11px; color: #475569; margin-bottom: 6px;">${am.description}</p>
                    ${extraInfo}
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 11px;">
                        <a href="tel:${am.contact_phone}" style="color: #0284c7; font-weight: bold; text-decoration: none;">📞 ${am.contact_phone}</a>
                        <button onclick="setQuickRoute('guwahati', '${am.highway.toLowerCase().includes('6') ? 'shillong' : 'nagaon'}')" style="background: #0284c7; color: white; border: none; padding: 3px 8px; border-radius: 4px; font-size: 10.5px; cursor: pointer; font-weight: bold;">
                            🧭 Route Nearby
                        </button>
                    </div>
                </div>
            `);

            marker.addTo(targetLayer);
        });

    } catch (err) {
        console.error("Error loading amenities:", err);
    }
}

function toggleAmenityLayer(type, checked) {
    if (!amenityLayers[type] || !map) return;
    if (checked) {
        map.addLayer(amenityLayers[type]);
    } else {
        map.removeLayer(amenityLayers[type]);
    }
}

// ----------------- Essential Commodity Fleet GPS Tracking -----------------

async function loadFleetTracking() {
    try {
        const res = await fetch('/api/fleet');
        const data = await res.json();

        fleetLayer.clearLayers();

        const container = document.getElementById('fleetListContainer');
        if (container) {
            container.innerHTML = '';
        }

        data.vehicles.forEach(v => {
            // Icon per cargo type
            let cargoIcon = "📦";
            if (v.cargo_type === "medicines") cargoIcon = "💊";
            else if (v.cargo_type === "agricultural_produce") cargoIcon = "🌾";
            else if (v.cargo_type === "construction_materials") cargoIcon = "🏗️";
            else if (v.cargo_type === "fuel_tanker") cargoIcon = "⛽";
            else if (v.cargo_type === "emergency_rations") cargoIcon = "🍼";

            // Marker on Map
            const isDelayed = v.status === 'delayed' || v.status === 'stranded';
            const isRerouted = v.status === 'rerouted';

            const truckIcon = L.divIcon({
                className: 'custom-fleet-wrapper',
                html: `
                    <div class="fleet-truck-marker ${isDelayed ? 'delayed' : (isRerouted ? 'rerouted' : '')}">
                        🚛
                        <span class="fleet-cargo-badge">${cargoIcon}</span>
                    </div>
                `,
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            });

            const marker = L.marker([v.current_lat, v.current_lng], { icon: truckIcon });

            marker.bindPopup(`
                <div style="color: #0f172a; min-width: 270px; padding: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: 800; font-size: 12px; color: #0284c7;">${v.vehicle_id}</span>
                        <span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; ${isDelayed ? 'background: #fee2e2; color: #b91c1c;' : (isRerouted ? 'background: #dcfce7; color: #15803d;' : 'background: #e0f2fe; color: #0369a1;')}">
                            ${v.status.toUpperCase()}
                        </span>
                    </div>
                    <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px;">
                        ${cargoIcon} <strong>Cargo:</strong> ${v.cargo_desc}
                    </div>
                    <div style="font-size: 11px; color: #475569;">
                        <div><strong>Route:</strong> ${v.origin.toUpperCase()} ➔ ${v.destination.toUpperCase()}</div>
                        <div><strong>Driver:</strong> ${v.driver_name} (<a href="tel:${v.driver_phone}">${v.driver_phone}</a>)</div>
                        <div><strong>Live Speed:</strong> ${v.speed_kmh} km/h • <strong>ETA:</strong> ${v.eta_hours} hrs</div>
                    </div>
                    ${v.hazard_alert ? `
                        <div style="background: ${isDelayed ? '#fef2f2' : '#f0fdf4'}; border: 1px solid ${isDelayed ? '#fca5a5' : '#bbf7d0'}; border-radius: 6px; padding: 6px; margin: 6px 0; font-size: 10.5px; color: ${isDelayed ? '#991b1b' : '#166534'};">
                            ${v.hazard_alert}
                        </div>
                    ` : ''}
                    ${isDelayed ? `
                        <button onclick="rerouteFleetTruck('${v.vehicle_id}')" class="btn-reroute" style="width: 100%; margin-top: 6px;">
                            🧭 Dispatch Automated Safe Detour
                        </button>
                    ` : ''}
                </div>
            `);

            marker.addTo(fleetLayer);

            // Card in Sidebar Fleet List
            if (container) {
                container.innerHTML += `
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-bottom: 10px; border-left: 4px solid ${isDelayed ? '#dc2626' : (isRerouted ? '#10b981' : '#0284c7')}; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <strong style="color: #0284c7; font-size: 13px;">🚛 ${v.vehicle_id}</strong>
                            <span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; ${isDelayed ? 'background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5;' : (isRerouted ? 'background: #dcfce7; color: #15803d; border: 1px solid #86efac;' : 'background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd;')}">
                                ${v.status.toUpperCase()}
                            </span>
                        </div>
                        <div style="font-size: 11.5px; color: #0f172a; font-weight: 600; margin-bottom: 4px;">
                            ${cargoIcon} ${v.cargo_desc}
                        </div>
                        <div style="font-size: 10.5px; color: #64748b; margin-bottom: 6px;">
                            <span>${v.origin.toUpperCase()} ➔ ${v.destination.toUpperCase()}</span> • <span>ETA: <strong>${v.eta_hours} hrs</strong></span>
                        </div>
                        ${v.hazard_alert ? `
                            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 6px; font-size: 10.5px; color: #991b1b; margin-bottom: 8px;">
                                ${v.hazard_alert}
                            </div>
                        ` : ''}
                        <div style="display: flex; gap: 8px; justify-content: flex-end;">
                            <button onclick="map.flyTo([${v.current_lat}, ${v.current_lng}], 12)" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer;">
                                📍 Locate
                            </button>
                            ${isDelayed ? `
                                <button onclick="rerouteFleetTruck('${v.vehicle_id}')" class="btn-reroute">
                                    🧭 Reroute Safe
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }
        });

    } catch (err) {
        console.error("Error loading fleet tracking:", err);
    }
}

async function rerouteFleetTruck(vehicleId) {
    try {
        const res = await fetch(`/api/fleet/${vehicleId}/reroute`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            alert(`Conveyance Updated: ${data.message}`);
            await loadFleetTracking();
            await loadLogisticsAlerts();
            // If centralized dashboard open, refresh it
            const modal = document.getElementById('dashboardModal');
            if (modal && modal.classList.contains('active')) {
                openCommandDashboard();
            }
        } else {
            alert(`Reroute notice: ${data.error || 'Failed to reroute'}`);
        }
    } catch (e) {
        alert("Error dispatching reroute: " + e.message);
    }
}

// ----------------- Automated Logistics Alerts Engine -----------------

async function loadLogisticsAlerts() {
    try {
        const res = await fetch('/api/alerts/logistics');
        const data = await res.json();
        const container = document.getElementById('logisticsAlertsContainer');
        if (!container) return;

        if (!data.alerts || data.alerts.length === 0) {
            container.innerHTML = '<div class="p-3 text-gray-500">All regional transport corridors operational.</div>';
            return;
        }

        container.innerHTML = data.alerts.map(a => `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 8px; border-left: 4px solid ${a.severity === 'critical' ? '#dc2626' : '#f59e0b'}; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                    <strong style="color: ${a.severity === 'critical' ? '#dc2626' : '#b45309'}; font-size: 11.5px;">${a.title}</strong>
                    <span style="font-size: 9.5px; font-weight: bold; background: ${a.severity === 'critical' ? '#fee2e2' : '#fef3c7'}; color: ${a.severity === 'critical' ? '#b91c1c' : '#b45309'}; border: 1px solid ${a.severity === 'critical' ? '#fca5a5' : '#fcd34d'}; padding: 1px 5px; border-radius: 3px;">
                        ${a.severity.toUpperCase()}
                    </span>
                </div>
                <p style="font-size: 11px; color: #334155; margin-bottom: 4px; line-height: 1.3;">${a.message}</p>
                <div style="font-size: 10px; color: #0284c7; font-style: italic;">💡 ${a.suggested_action}</div>
            </div>
        `).join('');

    } catch (err) {
        console.error("Error loading logistics alerts:", err);
    }
}

// ----------------- Centralized Command Dashboard -----------------

async function openCommandDashboard() {
    const modal = document.getElementById('dashboardModal');
    modal.classList.add('active');

    try {
        const res = await fetch('/api/dashboard/stats');
        const data = await res.json();

        // 1. Fill KPI Cards
        document.getElementById('kpiTotalConvoys').innerText = data.total_convoys;
        document.getElementById('kpiInTransit').innerText = data.status_breakdown.in_transit;
        document.getElementById('kpiDelayed').innerText = data.status_breakdown.delayed + data.status_breakdown.stranded;
        document.getElementById('kpiCriticalAlerts').innerText = data.critical_alerts_count;

        // 2. District Reserves List
        const stockContainer = document.getElementById('districtReservesContainer');
        stockContainer.innerHTML = data.district_reserves.map(d => {
            const fuelPct = Math.min(100, (d.fuel_days / 10.0) * 100);
            const foodPct = Math.min(100, (d.food_days / 10.0) * 100);
            const fColor = d.fuel_days <= 3.0 ? '#ef4444' : (d.fuel_days <= 5.0 ? '#f59e0b' : '#10b981');
            const fdColor = d.food_days <= 4.0 ? '#ef4444' : (d.food_days <= 6.0 ? '#f59e0b' : '#10b981');

            return `
                <div class="stock-bar-container">
                    <div class="stock-bar-header">
                        <strong>📍 ${d.district} (${d.state})</strong>
                        <span style="font-size: 10.5px; color: #f87171;">Threat: ${d.flood_threat}</span>
                    </div>
                    <div style="font-size: 10.5px; color: #94a3b8; display: flex; justify-content: space-between; margin-bottom: 2px;">
                        <span>Fuel: <strong>${d.fuel_days} Days</strong></span>
                        <span>Food: <strong>${d.food_days} Days</strong></span>
                    </div>
                    <div class="stock-bar-track" style="margin-bottom: 4px;">
                        <div class="stock-bar-fill" style="width: ${fuelPct}%; background: ${fColor};" title="Fuel Reserve"></div>
                    </div>
                    <div class="stock-bar-track">
                        <div class="stock-bar-fill" style="width: ${foodPct}%; background: ${fdColor};" title="Food Reserve"></div>
                    </div>
                </div>
            `;
        }).join('');

        // 3. Corridor Status List
        const corridorContainer = document.getElementById('corridorHealthContainer');
        corridorContainer.innerHTML = data.corridor_health.map(c => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                <div>
                    <strong style="color: #0f172a;">${c.name}</strong>
                    <div style="color: #64748b; font-size: 10px;">Threat Score: ${c.risk}%</div>
                </div>
                <span class="badge" style="background: ${c.risk > 70 ? '#ef4444' : (c.risk > 45 ? '#d97706' : '#16a34a')}; color: white; font-size: 9.5px; font-weight: 700;">
                    ${c.status}
                </span>
            </div>
        `).join('');

        // 4. Fleet Convoy Table
        const fleetRes = await fetch('/api/fleet');
        const fleetData = await fleetRes.json();
        const tableBody = document.getElementById('dashboardFleetTableBody');
        tableBody.innerHTML = fleetData.vehicles.map(v => `
            <tr>
                <td><strong>${v.vehicle_id}</strong></td>
                <td>${v.cargo_type.replace(/_/g, ' ').toUpperCase()}</td>
                <td>${v.origin.toUpperCase()} ➔ ${v.destination.toUpperCase()}</td>
                <td>${v.driver_name} (<a href="tel:${v.driver_phone}" style="color: #0284c7; font-weight: 600;">${v.driver_phone}</a>)</td>
                <td><span class="badge" style="background: ${v.status === 'delayed' ? '#ef4444' : (v.status === 'rerouted' ? '#16a34a' : '#0284c7')}; color: white; font-weight: 700;">${v.status.toUpperCase()}</span></td>
                <td>${v.eta_hours} hrs</td>
                <td>
                    ${v.status === 'delayed' ? `<button onclick="rerouteFleetTruck('${v.vehicle_id}')" class="btn-reroute">Reroute</button>` : `<span style="color: #10b981;">✓ Optimal</span>`}
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error("Dashboard error:", err);
    }
}

function closeCommandDashboard() {
    document.getElementById('dashboardModal').classList.remove('active');
}
