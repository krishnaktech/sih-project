// AapdaMarg NE - Crowdsourced Hazard & Photo Reporting Controller

function initReporting() {
    setupPhotoPreview();
    loadCommunityFeed();
}

function openReportModal() {
    document.getElementById('reportModal').classList.add('active');
    // Pre-fill with reasonable default if empty
    if (!document.getElementById('reportLat').value) {
        document.getElementById('reportLat').value = "25.6800";
        document.getElementById('reportLng').value = "92.4500";
    }
}

function closeReportModal() {
    document.getElementById('reportModal').classList.remove('active');
}

function setupPhotoPreview() {
    const fileInput = document.getElementById('photoInput');
    const dropZone = document.getElementById('photoDropZone');
    const previewContainer = document.getElementById('photoPreviewContainer');
    const previewImg = document.getElementById('photoPreviewImg');

    if (!fileInput || !dropZone) return;

    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            displayPreview(file);
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#38bdf8';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'rgba(56, 189, 248, 0.4)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(56, 189, 248, 0.4)';
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            displayPreview(e.dataTransfer.files[0]);
        }
    });

    function displayPreview(file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            previewImg.src = event.target.result;
            previewContainer.style.display = 'block';
            dropZone.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}

function removePhoto() {
    document.getElementById('photoInput').value = '';
    document.getElementById('photoPreviewContainer').style.display = 'none';
    document.getElementById('photoDropZone').style.display = 'block';
}

function useCurrentGpsLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                document.getElementById('reportLat').value = pos.coords.latitude.toFixed(5);
                document.getElementById('reportLng').value = pos.coords.longitude.toFixed(5);
                alert(`Location captured: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
            },
            (err) => {
                alert("GPS access not granted or unavailable. You can click 'Pick Location on Map' instead.");
            }
        );
    } else {
        alert("Geolocation is not supported by your browser.");
    }
}

async function submitHazardReport(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('btnSubmitReport');
    submitBtn.innerHTML = 'Uploading Proof & Updating Routing Engine...';
    submitBtn.disabled = true;

    const form = document.getElementById('hazardReportForm');
    const formData = new FormData(form);

    try {
        const res = await fetch('/api/reports', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            throw new Error("Failed to submit hazard report.");
        }

        const data = await res.json();
        alert("Incident reported successfully! The map and safe route computations have been dynamically updated.");

        closeReportModal();
        form.reset();
        removePhoto();

        // Refresh hazards and community feed
        await loadHazardsAndZones();
        await loadCommunityFeed();

        // If an active route was displayed, recalculate it immediately to avoid the newly reported hazard!
        const origin = document.getElementById('originSelect').value;
        const dest = document.getElementById('destSelect').value;
        if (origin && dest && origin !== dest) {
            calculateRoute();
        }

        // Pan map to new incident
        if (data.incident) {
            map.flyTo([data.incident.latitude, data.incident.longitude], 11);
        }

    } catch (err) {
        alert(`Submission Error: ${err.message}`);
    } finally {
        submitBtn.innerHTML = '🚀 Broadcast Hazard & Update Routes';
        submitBtn.disabled = false;
    }
}

async function loadCommunityFeed() {
    const feedContainer = document.getElementById('communityFeedContainer');
    if (!feedContainer) return;

    try {
        const res = await fetch('/api/reports');
        const data = await res.json();

        if (!data.reports || data.reports.length === 0) {
            feedContainer.innerHTML = '<div class="p-3 text-gray-400">No community incident reports yet.</div>';
            return;
        }

        feedContainer.innerHTML = data.reports.map(r => {
            const dateStr = new Date(r.created_at).toLocaleDateString('en-IN', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            return `
                <div class="feed-item">
                    ${r.photo_url ? `<img src="${r.photo_url}" class="feed-item-img" alt="Hazard Photo" onclick="openPhotoModal('${r.photo_url}', '${escapeQuotes(r.title)}')" style="cursor: pointer;">` : ''}
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                        <span style="font-size: 10px; font-weight: 800; background: #dc2626; color: white; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                            ${r.hazard_type.replace('_', ' ')}
                        </span>
                        <span style="font-size: 10px; color: #94a3b8;">${dateStr}</span>
                    </div>
                    <strong style="font-size: 12.5px; color: #f8fafc; display: block; margin: 3px 0;">${r.title}</strong>
                    <p style="font-size: 11px; color: #94a3b8; line-height: 1.3; margin-bottom: 8px;">${r.description}</p>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px; font-size: 10.5px;">
                        <span style="color: #cbd5e1;">By: <strong>${r.reporter_name}</strong></span>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="zoomToCoord(${r.latitude}, ${r.longitude})" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid #38bdf8; border-radius: 4px; padding: 2px 7px; cursor: pointer; font-size: 10.5px;">
                                📍 View on Map
                            </button>
                            <button onclick="upvoteIncident(${r.id}, this)" style="background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 7px; cursor: pointer; font-size: 10.5px;">
                                👍 ${r.upvotes}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Failed to load community feed:", err);
    }
}

async function upvoteIncident(id, btnElem) {
    try {
        const res = await fetch(`/api/reports/${id}/upvote`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            const countElem = btnElem.querySelector('.upvote-count') || btnElem;
            if (countElem) {
                countElem.innerHTML = `👍 ${data.upvotes}`;
            }
            btnElem.style.background = '#0284c7';
            btnElem.style.color = '#ffffff';
        }
    } catch (err) {
        console.error("Failed to upvote:", err);
    }
}

function zoomToCoord(lat, lng) {
    map.flyTo([lat, lng], 13);
}

function openPhotoModal(url, title) {
    const modal = document.getElementById('photoViewerModal');
    document.getElementById('photoViewerImg').src = url;
    document.getElementById('photoViewerTitle').innerText = title;
    modal.classList.add('active');
}

function closePhotoModal() {
    document.getElementById('photoViewerModal').classList.remove('active');
}
