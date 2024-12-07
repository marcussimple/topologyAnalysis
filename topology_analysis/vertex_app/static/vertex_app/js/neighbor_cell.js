// Fichier: static/vertex_app/js/neighbor_cell.js

document.addEventListener('DOMContentLoaded', function() {
    // Créer le popup HTML
    const popupHTML = `
        <div id="neighborInputPopup" class="custom-popup" style="display: none;">
            <div class="popup-content">
                <div class="popup-header">
                    <h3>Entrez l'ID du maximum</h3>
                    <span class="close-btn">&times;</span>
                </div>
                <div class="popup-body">
                    <input type="number" id="neighborMaximumIdInput" placeholder="ID du maximum" min="1">
                    <div class="error-message" style="display: none; color: red; margin-top: 5px;"></div>
                    <button id="submitNeighborId" class="submit-btn">Valider</button>
                </div>
            </div>
        </div>
    `;
    
    // Ajouter le popup au document
    document.body.insertAdjacentHTML('beforeend', popupHTML);
    
    // Gérer l'affichage du popup et la soumission
    const buttons = document.querySelectorAll('#btn');
    const popup = document.getElementById('neighborInputPopup');
    const closeBtn = popup.querySelector('.close-btn');
    const submitBtn = document.getElementById('submitNeighborId');
    const input = document.getElementById('neighborMaximumIdInput');
    const errorMessage = popup.querySelector('.error-message');
    
    buttons.forEach(button => {
        if (button.textContent.trim() === "Cellules voisines d'une cellule") {
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
    
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            popup.style.display = 'none';
            input.value = '';
            errorMessage.style.display = 'none';
        }
    });
    
    submitBtn.addEventListener('click', () => {
        const maximumId = input.value.trim();
        if (!maximumId) {
            errorMessage.textContent = "Veuillez entrer un ID";
            errorMessage.style.display = 'block';
            return;
        }
        
        errorMessage.style.display = 'none';
        popup.style.display = 'none';
        fetchNeighborCells(parseInt(maximumId));
    });
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitBtn.click();
        }
    });
});

// Couleurs pour les différentes cellules
const cellColors = [
    '#FFFFFF',  // Blanc pour la cellule principale
    '#FF6B6B',  // Rouge
    '#4ECDC4',  // Turquoise
    '#FFD93D',  // Jaune
    '#95A5A6',  // Gris
    '#FF8C42',  // Orange
    '#6C5B7B',  // Violet
    '#45B7D1'   // Bleu
];

function fetchNeighborCells(maximumId) {
    // D'abord, récupérer les IDs des maximums voisins
    fetch('/get-neighbor-maximums/', {
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

        // Nettoyer les cellules précédentes
        clearPreviousCells();

        // Récupérer les cellules une par une
        let cellPromises = [
            fetchCellBoundary(maximumId, 0)  // Cellule principale
        ];

        // Ajouter les promesses pour les cellules voisines
        data.neighbor_maximums.forEach((neighbor, index) => {
            cellPromises.push(fetchCellBoundary(neighbor.id, index + 1));
        });

        // Attendre que toutes les cellules soient chargées
        Promise.all(cellPromises)
            .then(() => {
                // Zoomer pour montrer toutes les cellules
                const bounds = new mapboxgl.LngLatBounds();
                for (let i = 0; i <= data.neighbor_maximums.length; i++) {
                    const source = map.getSource(`cell-${i}`);
                    if (source) {
                        const coordinates = source._data.geometry.coordinates[0];
                        coordinates.forEach(coord => {
                            bounds.extend(coord);
                        });
                    }
                }
                map.fitBounds(bounds, {
                    padding: 50,
                    maxZoom: 22
                });
            });
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Erreur lors de la récupération des cellules voisines');
    });
}


function fetchCellBoundary(maximumId, colorIndex) {
    return fetch('/get-maximum-cell/', {
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
            console.error(data.message);
            return;
        }

        const coordinates = data.boundary.map(point => [
            point.longitude,
            point.latitude
        ]);
        
        if (coordinates.length > 0) {
            coordinates.push(coordinates[0]);
        }

        // Ajouter la source
        map.addSource(`cell-${colorIndex}`, {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'properties': {
                    'maximum_id': maximumId,
                    ...data.statistics
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [coordinates]
                }
            }
        });

        // Ajouter la couche de remplissage seulement pour les cellules voisines
        if (colorIndex !== 0) {
            map.addLayer({
                'id': `cell-${colorIndex}-fill`,
                'type': 'fill',
                'source': `cell-${colorIndex}`,
                'paint': {
                    'fill-color': cellColors[colorIndex % cellColors.length],
                    'fill-opacity': 0.3
                }
            });
        }

        // Ajouter la couche de bordure
        map.addLayer({
            'id': `cell-${colorIndex}-line`,
            'type': 'line',
            'source': `cell-${colorIndex}`,
            'paint': {
                'line-color': '#ffffff',
                'line-width': 2
            }
        });

        // Garder le même comportement pour le popup
        map.on('click', `cell-${colorIndex}-${colorIndex === 0 ? 'line' : 'fill'}`, (e) => {
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
    });
}


function clearPreviousCells() {
    let index = 0;
    while (map.getLayer(`cell-${index}-fill`) || map.getLayer(`cell-${index}-line`)) {
        if (map.getLayer(`cell-${index}-fill`)) {
            map.removeLayer(`cell-${index}-fill`);
        }
        if (map.getLayer(`cell-${index}-line`)) {
            map.removeLayer(`cell-${index}-line`);
        }
        if (map.getSource(`cell-${index}`)) {
            map.removeSource(`cell-${index}`);
        }
        index++;
    }
}