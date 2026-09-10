// AapdaMarg NE - Weather & Early Warning Controller

async function initWeather() {
    try {
        const res = await fetch('/api/weather');
        const data = await res.json();

        // 1. Update Alert Ticker (if element present)
        if (data.alerts_ticker && data.alerts_ticker.length > 0) {
            const tickerEl = document.getElementById('alertTickerText');
            if (tickerEl) {
                const tickerHtml = data.alerts_ticker.map(a => 
                    `<span style="margin-right: 35px;"><strong>[${a.title}]</strong>: ${a.message}</span>`
                ).join(' ••• ');
                tickerEl.innerHTML = tickerHtml;
            }
        }

        // 2. Render Weather Cards in Sidebar Weather Tab
        renderWeatherList(data.weather_reports);

    } catch (err) {
        console.error("Failed to load weather telemetry:", err);
    }
}

function renderWeatherList(reports) {
    const container = document.getElementById('weatherListContainer');
    if (!container) return;

    if (!reports || reports.length === 0) {
        container.innerHTML = '<div class="p-3 text-gray-400">No active station telemetry available.</div>';
        return;
    }

    container.innerHTML = reports.map(r => {
        let alertBadge = 'bg-emerald-600 text-white';
        let alertBorder = 'border-emerald-500';
        if (r.alert_level === 'Red') {
            alertBadge = 'bg-red-600 text-white';
            alertBorder = 'border-red-500';
        } else if (r.alert_level === 'Orange') {
            alertBadge = 'bg-amber-600 text-white';
            alertBorder = 'border-amber-500';
        } else if (r.alert_level === 'Yellow') {
            alertBadge = 'bg-yellow-600 text-gray-900';
            alertBorder = 'border-yellow-500';
        }

        return `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-bottom: 10px; border-left: 4px solid ${r.alert_level === 'Red' ? '#dc2626' : (r.alert_level === 'Orange' ? '#ea580c' : '#10b981')}; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div>
                        <strong style="font-size: 13px; color: #0f172a;">${r.city_name}</strong>
                        <div style="font-size: 10.5px; color: #64748b;">${r.state} • Elev. ${r.elevation_m}m</div>
                    </div>
                    <span style="font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px; ${r.alert_level === 'Red' ? 'background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5;' : (r.alert_level === 'Orange' ? 'background: #fef3c7; color: #b45309; border: 1px solid #fcd34d;' : 'background: #dcfce7; color: #15803d; border: 1px solid #86efac;')}">
                        ${r.alert_level.toUpperCase()} ALERT
                    </span>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px; border-radius: 6px; margin: 8px 0; text-align: center;">
                    <div>
                        <div style="font-size: 9.5px; color: #64748b;">RAIN ACCUM.</div>
                        <div style="font-size: 13px; font-weight: bold; color: #0284c7;">${r.rainfall_mm} mm</div>
                    </div>
                    <div>
                        <div style="font-size: 9.5px; color: #64748b;">TEMP / WIND</div>
                        <div style="font-size: 12px; font-weight: 600; color: #1e293b;">${r.temperature}°C | ${r.wind_kmh}kph</div>
                    </div>
                    <div>
                        <div style="font-size: 9.5px; color: #64748b;">FLOOD RISK</div>
                        <div style="font-size: 13px; font-weight: bold; color: ${r.flood_risk_pct > 70 ? '#dc2626' : (r.flood_risk_pct > 40 ? '#d97706' : '#16a34a')};">${r.flood_risk_pct}%</div>
                    </div>
                </div>

                <div style="font-size: 11px; color: #334155; display: flex; align-items: center; gap: 4px;">
                    <span>🌊</span> <strong>River Status:</strong> ${r.river_warning}
                </div>
            </div>
        `;
    }).join('');
}
