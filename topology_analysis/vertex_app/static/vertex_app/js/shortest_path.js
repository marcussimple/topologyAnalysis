document.addEventListener('DOMContentLoaded', function() {
    // Créer le popup HTML
    const popupHTML = `
        <div id="shortestPathPopup" class="custom-popup" style="display: none;">
            <div class="popup-content">
                <div class="popup-header">
                    <h3>Plus court chemin</h3>
                    <span class="close-btn">&times;</span>
                </div>
                <div class="popup-body">
                    <input type="number" id="startPointInput" placeholder="ID du point de départ" min="1">
                    <input type="number" id="endPointInput" placeholder="ID du point d'arrivée" min="1">
                    <div class="error-message" style="display: none; color: red; margin-top: 5px;"></div>
                    <button id="submitShortestPath" class="submit-btn">Trouver le chemin</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', popupHTML);
    
    // Gérer l'affichage du popup
    const buttons = document.querySelectorAll('#btn');
    const popup = document.getElementById('shortestPathPopup');
    const closeBtn = popup.querySelector('.close-btn');
    const submitBtn = document.getElementById('submitShortestPath');
    const startInput = document.getElementById('startPointInput');
    const endInput = document.getElementById('endPointInput');
    const errorMessage = popup.querySelector('.error-message');
    
    buttons.forEach(button => {
        if (button.textContent.trim() === "Plus courte chemin entre deux vertex") {
            button.addEventListener('click', () => {
                if (!map || !mapLoaded) {
                    alert('Attendez que la carte soit complètement chargée');
                    return;
                }
                popup.style.display = 'flex';
                startInput.focus();
            });
        }
    });
    
    closeBtn.addEventListener('click', () => {
        popup.style.display = 'none';
        startInput.value = '';
        endInput.value = '';
        errorMessage.style.display = 'none';
    });
    
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            popup.style.display = 'none';
            startInput.value = '';
            endInput.value = '';
            errorMessage.style.display = 'none';
        }
    });
    
    // Gérer la soumission
    submitBtn.addEventListener('click', () => {
        const startId = startInput.value.trim();
        const endId = endInput.value.trim();
        
        if (!startId || !endId) {
            errorMessage.textContent = "Veuillez entrer les deux IDs";
            errorMessage.style.display = 'block';
            return;
        }
        
        errorMessage.style.display = 'none';
        popup.style.display = 'none';
        fetchShortestPath(parseInt(startId), parseInt(endId));
    });
});

function fetchShortestPath(startId, endId) {
    // Nettoyer le chemin précédent
    if (map.getLayer('shortest-path')) {
        map.removeLayer('shortest-path');
        map.removeLayer('shortest-path-halo');
        map.removeSource('shortest-path-source');
    }

    fetch('/get-shortest-path/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({ 
            start_id: startId,
            end_id: endId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'error') {
            alert(data.message);
            return;
        }

        // Ajouter le chemin à la carte
        map.addSource('shortest-path-source', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': data.path.map(point => [
                        point.longitude,
                        point.latitude
                    ])
                }
            }
        });

        // Ajout du halo blanc
        map.addLayer({
            'id': 'shortest-path-halo',
            'type': 'line',
            'source': 'shortest-path-source',
            'paint': {
                'line-color': '#FFFFFF',
                'line-width': 6,
                'line-opacity': 0.8
            }
        });

        // Ligne principale
        map.addLayer({
            'id': 'shortest-path',
            'type': 'line',
            'source': 'shortest-path-source',
            'paint': {
                'line-color': '#FF0000',
                'line-width': 3,
                'line-opacity': 0.8
            }
        });

        // Zoomer sur le chemin
        const bounds = new mapboxgl.LngLatBounds();
        data.path.forEach(point => {
            bounds.extend([point.longitude, point.latitude]);
        });

        map.fitBounds(bounds, {
            padding: 50
        });
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Erreur lors de la récupération du chemin');
    });
}