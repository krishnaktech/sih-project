// AapdaMarg NE - Weather & Early Warning Controller

async function initWeather() {
    try {
        const res = await fetch('/api/weather');
        const data = await res.json();

        // 1. Update Alert Ticker
        if (data.alerts_ticker && data.alerts_ticker.length > 0) {
            const tickerEl = document.getElementById('alertTickerText');
            const tickerHtml = data.alerts_ticker.map(a => 
                `<span style="margin-right: 35px;"><strong>[${a.title}]</strong>: ${a.message}</span>`
            ).join(' ••• ');
            tickerEl.innerHTML = tickerHtml;
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
            <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px; margin-bottom: 10px; border-left: 4px solid ${r.alert_level === 'Red' ? '#dc2626' : (r.alert_level === 'Orange' ? '#ea580c' : '#10b981')};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div>
                        <strong style="font-size: 13px; color: #f8fafc;">${r.city_name}</strong>
                        <div style="font-size: 10.5px; color: #94a3b8;">${r.state} • Elev. ${r.elevation_m}m</div>
                    </div>
                    <span style="font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px; ${r.alert_level === 'Red' ? 'background: #7f1d1d; color: #fca5a5;' : (r.alert_level === 'Orange' ? 'background: #78350f; color: #fde68a;' : 'background: #065f46; color: #6ee7b7;')}">
                        ${r.alert_level.toUpperCase()} ALERT
                    </span>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; background: rgba(0,0,0,0.25); padding: 8px; border-radius: 6px; margin: 8px 0; text-align: center;">
                    <div>
                        <div style="font-size: 9.5px; color: #94a3b8;">RAIN ACCUM.</div>
                        <div style="font-size: 13px; font-weight: bold; color: #38bdf8;">${r.rainfall_mm} mm</div>
                    </div>
                    <div>
                        <div style="font-size: 9.5px; color: #94a3b8;">TEMP / WIND</div>
                        <div style="font-size: 12px; font-weight: 600; color: #e2e8f0;">${r.temperature}°C | ${r.wind_kmh}kph</div>
                    </div>
                    <div>
                        <div style="font-size: 9.5px; color: #94a3b8;">FLOOD RISK</div>
                        <div style="font-size: 13px; font-weight: bold; color: ${r.flood_risk_pct > 70 ? '#f87171' : (r.flood_risk_pct > 40 ? '#fbbf24' : '#34d399')};">${r.flood_risk_pct}%</div>
                    </div>
                </div>

                <div style="font-size: 11px; color: #cbd5e1; display: flex; align-items: center; gap: 4px;">
                    <span>🌊</span> <strong>River Status:</strong> ${r.river_warning}
                </div>
            </div>
        `;
    }).join('');
}
