document.addEventListener('DOMContentLoaded', function() {
    const buttons = document.querySelectorAll('#btn');
    
    buttons.forEach(button => {
        if (button.textContent.trim() === "Thalweg à partir d'une selle") {
            button.addEventListener('click', () => {
                console.log('Button clicked');
                const saddleId = prompt("Entrez l'ID de la selle :");
                console.log('Saddle ID entered:', saddleId);
                
                if (saddleId) {
                    console.log('Making fetch request...');
                    fetch('/get-saddle-thalwegs/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCSRFToken()
                        },
                        body: JSON.stringify({ saddle_id: parseInt(saddleId) })
                    })
                    .then(response => {
                        console.log('Got response:', response);
                        return response.json();
                    })
                    .then(data => {
                        console.log('Got data:', data);
                        if (data.status === 'error') {
                            alert(data.message);
                            return;
                        }

                        if (data.thalwegs && data.thalwegs.length > 0) {
                            console.log('Processing thalwegs:', data.thalwegs);
                            const bounds = new mapboxgl.LngLatBounds();

                            data.thalwegs.forEach((thalweg, index) => {
                                console.log('Processing thalweg:', index);
                                const sourceId = `saddle-thalweg-source-${Date.now()}-${index}`;
                                const layerId = `saddle-thalweg-layer-${Date.now()}-${index}`;

                                // Créer la source
                                map.addSource(sourceId, {
                                    type: 'geojson',
                                    data: {
                                        type: 'Feature',
                                        properties: thalweg.properties,
                                        geometry: {
                                            type: 'LineString',
                                            coordinates: thalweg.path.map(p => [p.longitude, p.latitude])
                                        }
                                    }
                                });

                                thalweg.path.forEach(p => {
                                    bounds.extend([p.longitude, p.latitude]);
                                });

                                map.addLayer({
                                    id: layerId,
                                    type: 'line',
                                    source: sourceId,
                                    paint: {
                                        'line-color': '#0000FF',
                                        'line-width': 3
                                    }
                                });

                                // Ajouter le popup au clic
                                map.on('click', layerId, (e) => {
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
                            });

                            // Zoom sur les thalwegs
                            map.fitBounds(bounds, {
                                padding: 50
                            });
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('Erreur lors de la récupération des thalwegs');
                    });
                }
            });
        }
    });
});