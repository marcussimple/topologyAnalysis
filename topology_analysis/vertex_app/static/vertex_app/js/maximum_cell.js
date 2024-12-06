// Fichier: static/vertex_app/js/maximum_cell.js
document.addEventListener('DOMContentLoaded', function() {
    // Créer le popup HTML
    const popupHTML = `
        <div id="maximumInputPopup" class="custom-popup" style="display: none;">
            <div class="popup-content">
                <div class="popup-header">
                    <h3>Entrez l'ID du maximum</h3>
                    <span class="close-btn">&times;</span>
                </div>
                <div class="popup-body">
                    <input type="number" id="maximumIdInput" placeholder="ID du maximum" min="1">
                    <div class="error-message" style="display: none; color: red; margin-top: 5px;"></div>
                    <button id="submitMaximumId" class="submit-btn">Valider</button>
                </div>
            </div>
        </div>
    `;
    
    // Ajouter le popup et les styles au document
    document.body.insertAdjacentHTML('beforeend', popupHTML);
    
    // Ajouter les styles
    const styles = `
        .custom-popup {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        
        .popup-content {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            width: 300px;
        }
        
        .popup-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .popup-header h3 {
            margin: 0;
            color: #333;
        }
        
        .close-btn {
            cursor: pointer;
            font-size: 24px;
            color: #666;
        }
        
        .close-btn:hover {
            color: #333;
        }
        
        .popup-body input {
            width: 100%;
            padding: 8px;
            margin-bottom: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        
        .submit-btn {
            width: 100%;
            padding: 8px;
            background-color: #0080ff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }
        
        .submit-btn:hover {
            background-color: #0066cc;
        }
    `;
    
    const styleSheet = document.createElement("style");
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // Gérer l'affichage du popup et la soumission
    const buttons = document.querySelectorAll('#btn');
    const popup = document.getElementById('maximumInputPopup');
    const closeBtn = popup.querySelector('.close-btn');
    const submitBtn = document.getElementById('submitMaximumId');
    const input = document.getElementById('maximumIdInput');
    const errorMessage = popup.querySelector('.error-message');
    
    buttons.forEach(button => {
        if (button.textContent.trim() === "Cellule d'un sommet maximum") {
            button.addEventListener('click', () => {
                if (!map || !mapLoaded) {
                    alert('Attendez que la carte soit complètement chargée');
                    return;
                }
                popup.style.display = 'flex';
                input.focus();
            });
        }
    });
    
    closeBtn.addEventListener('click', () => {
        popup.style.display = 'none';
        input.value = '';
        errorMessage.style.display = 'none';
    });
    
    // Fermer le popup si on clique en dehors
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            popup.style.display = 'none';
            input.value = '';
            errorMessage.style.display = 'none';
        }
    });
    
    // Gérer la soumission du formulaire
    submitBtn.addEventListener('click', () => {
        const maximumId = input.value.trim();
        if (!maximumId) {
            errorMessage.textContent = "Veuillez entrer un ID";
            errorMessage.style.display = 'block';
            return;
        }
        
        errorMessage.style.display = 'none';
        popup.style.display = 'none';
        fetchCellData(parseInt(maximumId));
    });
    
    // Permettre la soumission avec la touche Enter
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitBtn.click();
        }
    });
});

// Fonction pour récupérer les données de la cellule
function fetchCellData(maximumId) {
    fetch('/get-maximum-cell/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({ maximum_id: maximumId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'error') {
            alert(data.message);
            return;
        }

        // Clear previous cell boundaries
        if (map.getLayer('cell-boundary-line')) {
            map.removeLayer('cell-boundary-line');
        }
        if (map.getLayer('cell-boundary-fill')) {
            map.removeLayer('cell-boundary-fill');
        }
        if (map.getSource('cell-boundary')) {
            map.removeSource('cell-boundary');
        }

        // Create coordinates array for the polygon
        const coordinates = data.boundary.map(point => [
            point.longitude,
            point.latitude
        ]);
        
        // Add the first point again to close the polygon
        if (coordinates.length > 0) {
            coordinates.push(coordinates[0]);
        }

        // Create bounds for zooming
        const bounds = coordinates.reduce((bounds, coord) => {
            return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

        // Add the cell boundary to the map
        map.addSource('cell-boundary', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'properties': {
                    ...data.statistics,
                    'maximum_id': data.maximum.id
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [coordinates]
                }
            }
        });

        // Add fill layer
        map.addLayer({
            'id': 'cell-boundary-fill',
            'type': 'fill',
            'source': 'cell-boundary',
            'paint': {
                'fill-color': '#2FFB28',
                'fill-opacity': 0.3
            }
        });

        // Add line layer
        map.addLayer({
            'id': 'cell-boundary-line',
            'type': 'line',
            'source': 'cell-boundary',
            'paint': {
                'line-color': '#2FFB28',
                'line-width': 2
            }
        });

        // Add popup on click
        map.on('click', 'cell-boundary-fill', (e) => {
            if (!e.features.length) return;

            const properties = e.features[0].properties;
            new mapboxgl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(`
                    <div style="text-align: left; width: 200px; line-height: 1.2;">
                        <h3 style="margin: 0 0 5px 0;">Cell Info</h3>
                        <p style="margin: 2px 0;">Maximum: ${properties.maximum_id}</p>
                        <p style="margin: 2px 0;">Altitude moyenne: ${properties.average_altitude.toFixed(2)}m</p>
                        <p style="margin: 2px 0;">Altitude max: ${properties.max_altitude.toFixed(2)}m</p>
                        <p style="margin: 2px 0;">Altitude min: ${properties.min_altitude.toFixed(2)}m</p>
                        <p style="margin: 2px 0;">Dénivelé: ${properties.altitude_range.toFixed(2)}m</p>
                        <p style="margin: 2px 0;">Points: ${properties.boundary_size}</p>
                    </div>
                `)
                .addTo(map);
        });

        // Zoom to the cell
        map.fitBounds(bounds, {
            padding: 50,
            maxZoom: 22
        });
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Erreur lors de la récupération de la cellule');
    });
}