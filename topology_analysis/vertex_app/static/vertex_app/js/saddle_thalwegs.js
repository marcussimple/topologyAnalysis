// Fichier: static/vertex_app/js/saddle_thalwegs.js

document.addEventListener('DOMContentLoaded', function() {
    const buttons = document.querySelectorAll('#btn');
    
    buttons.forEach(button => {
        if (button.textContent.trim() === "Thalweg à partir d'une selle") {
            button.addEventListener('click', () => {
                // Vérifier si la carte est chargée
                if (!map || !mapLoaded) {
                    alert('Attendez que la carte soit complètement chargée');
                    return;
                }

                console.log('Button clicked');
                const saddleId = prompt("Entrez l'ID de la selle :");
                if (!saddleId) return;

                console.log('Saddle ID entered:', saddleId);
                console.log('Making fetch request...');
                
                fetch('/get-saddle-thalwegs/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCSRFToken()
                    },
                    body: JSON.stringify({ saddle_id: parseInt(saddleId) })
                })
                .then(response => response.json())
                .then(data => {
                    console.log('Got data:', data);
                    if (data.status === 'error') {
                        alert(data.message);
                        return;
                    }

                    if (data.thalwegs && data.thalwegs.length > 0) {
                        console.log(`Processing ${data.thalwegs.length} thalwegs`);
                        const bounds = new mapboxgl.LngLatBounds();

                        data.thalwegs.forEach((thalweg, index) => {
                            try {
                                console.log(`Processing thalweg ${index}`);
                                
                                const sourceId = `saddle-thalweg-source-${Date.now()}-${index}`;
                                const layerId = `saddle-thalweg-layer-${Date.now()}-${index}`;

                                const coordinates = thalweg.path.map(point => [
                                    point.longitude,
                                    point.latitude
                                ]);

                                console.log(`Thalweg ${index} coordinates:`, coordinates);
                                
                                coordinates.forEach(coord => {
                                    bounds.extend(coord);
                                });

                                // Vérifier si la source existe déjà
                                if (map.getSource(sourceId)) {
                                    console.log(`Removing existing source ${sourceId}`);
                                    map.removeSource(sourceId);
                                }

                                map.addSource(sourceId, {
                                    type: 'geojson',
                                    data: {
                                        type: 'Feature',
                                        properties: {
                                            ...thalweg.properties,
                                            thalwegIndex: index
                                        },
                                        geometry: {
                                            type: 'LineString',
                                            coordinates: coordinates
                                        }
                                    }
                                });

                                map.addLayer({
                                    id: layerId,
                                    type: 'line',
                                    source: sourceId,
                                    layout: {
                                        'line-join': 'round',
                                        'line-cap': 'round'
                                    },
                                    paint: {
                                        'line-color': '#0000FF',
                                        'line-width': 3,
                                        'line-opacity': 0.8
                                    }
                                });

                                map.on('click', layerId, (e) => {
                                    if (!e.features.length) return;

                                    const properties = e.features[0].properties;
                                    new mapboxgl.Popup()
                                        .setLngLat(e.lngLat)
                                        .setHTML(`
                                            <h3>Thalweg Info</h3>
                                            <p>De: ${properties.start}</p>
                                            <p>À: ${properties.end}</p>
                                            <p>Altitude départ: ${properties.elevation_start.toFixed(2)}m</p>
                                            <p>Altitude arrivée: ${properties.elevation_end.toFixed(2)}m</p>
                                        `)
                                        .addTo(map);
                                });

                                thalwegLines.push({ id: layerId, sourceId: sourceId });
                                console.log(`Successfully added thalweg ${index}`);

                            } catch (err) {
                                console.error(`Error processing thalweg ${index}:`, err);
                            }
                        });

                        // Ne zoomer que si le nouveau zoom serait plus proche
                        try {
                            if (!bounds.isEmpty()) {
                                const currentZoom = map.getZoom();
                                
                                map.fitBounds(bounds, {
                                    padding: 50,
                                    minZoom: currentZoom,  // Ne pas zoomer plus loin que le zoom actuel
                                    maxZoom: 18,
                                    duration: 1500  // Durée de l'animation en millisecondes
                                });
                            }
                        } catch (err) {
                            console.error('Error handling zoom:', err);
                        }
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Erreur lors de la récupération des thalwegs');
                });
            });
        }
    });
});