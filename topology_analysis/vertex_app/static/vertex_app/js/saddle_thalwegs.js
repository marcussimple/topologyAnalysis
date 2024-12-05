// Fichier: static/vertex_app/js/saddle_thalwegs.js
document.addEventListener('DOMContentLoaded', function() {
    const buttons = document.querySelectorAll('#btn');
    
    buttons.forEach(button => {
        if (button.textContent.trim() === "Thalweg à partir d'une selle") {
            button.addEventListener('click', () => {
                if (!map || !mapLoaded) {
                    alert('Attendez que la carte soit complètement chargée');
                    return;
                }

                const saddleId = prompt("Entrez l'ID de la selle :");
                if (!saddleId) return;
                
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
                    if (data.status === 'error') {
                        alert(data.message);
                        return;
                    }

                    if (data.thalwegs && data.thalwegs.length > 0) {
                        // Créer un seul bounds pour le premier thalweg uniquement
                        const firstThalweg = data.thalwegs[0];
                        const coordinates = firstThalweg.path.map(point => [
                            point.longitude,
                            point.latitude
                        ]);
                        
                        const bounds = coordinates.reduce((bounds, coord) => {
                            return bounds.extend(coord);
                        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

                        // Zoomer immédiatement sur le premier thalweg
                        map.fitBounds(bounds, {
                            padding: 20,
                            maxZoom: 22
                        });

                        // Ajouter tous les thalwegs à la carte
                        data.thalwegs.forEach((thalweg, index) => {
                            const sourceId = `saddle-thalweg-source-${Date.now()}-${index}`;
                            const layerId = `saddle-thalweg-layer-${Date.now()}-${index}`;

                            const thalwegCoords = thalweg.path.map(point => [
                                point.longitude,
                                point.latitude
                            ]);

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
                                        coordinates: thalwegCoords
                                    }
                                }
                            });

                            map.addLayer({
                                id: `${layerId}-halo`,
                                type: 'line',
                                source: sourceId,
                                layout: {
                                    'line-join': 'round',
                                    'line-cap': 'round'
                                },
                                paint: {
                                    'line-color': '#FFFFFF',
                                    'line-width': 7,
                                    'line-opacity': 0.8,
                                    'line-blur': 2
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
                                    'line-opacity': 0.8,
                                    'line-blur': 1
                                }
                            });

                            map.on('click', layerId, (e) => {
                                if (!e.features.length) return;

                                const properties = e.features[0].properties;
                                new mapboxgl.Popup()
                                    .setLngLat(e.lngLat)
                                    .setHTML(`
                                        <div style="text-align: left; width: 180px; line-height: 1.2;">
                                            <h3 style="margin: 0 0 5px 0;">Thalweg Info</h3>
                                            <p style="margin: 2px 0;">Point de départ: ${properties.start}</p>
                                            <p style="margin: 2px 0;">Point d'arrivé: ${properties.end}</p> 
                                            <p style="margin: 2px 0;">Altitude départ: ${properties.elevation_start.toFixed(2)}m</p>
                                            <p style="margin: 2px 0;">Altitude arrivée: ${properties.elevation_end.toFixed(2)}m</p>
                                            <p style="margin: 2px 0;">Pente: ${(properties.slope * 100).toFixed(2)}%</p>
                                        </div>
                                    `)
                                    .addTo(map);
                            });

                            thalwegLines.push(
                                { id: layerId, sourceId: sourceId },
                                { id: `${layerId}-halo`, sourceId: sourceId }
                            );
                        });
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