// Variables globales
let map;
let markers = [];
let thalwegLines = [];    
let mapLoaded = false;

// Fonctions utilitaires
function getColorForThalweg(index) {
   const colors = {
       0: '#0000FF', // Bleu pour thalweg principal
       1: '#FF0000', // Rouge pour thalweg secondaire
       2: '#00FF00', // Vert pour thalweg tertiaire
       3: '#FFA500', // Orange
       4: '#800080'  // Violet
   };
   return colors[index] || '#000000'; // Noir par défaut
}

function getCSRFToken() {
   const name = 'csrftoken';
   let cookieValue = null;
   if (document.cookie && document.cookie !== '') {
       const cookies = document.cookie.split(';');
       for (let i = 0; i < cookies.length; i++) {
           const cookie = cookies[i].trim();
           if (cookie.substring(0, name.length + 1) === (name + '=')) {
               cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
               break;
           }
       }
   }
   return cookieValue;
}

function getColorForZ(z, minZ, maxZ) {
   const percentage = (z - minZ) / (maxZ - minZ);
   console.log(`Z: ${z}, Percentage: ${percentage}`);
   
   if (percentage >= 0.75) {
       return '#FF0000';  // Red for highest points
   } else if (percentage >= 0.5) {
       return '#FFA500';  // Orange for high points
   } else if (percentage >= 0.25) {
       return '#00FF00';  // Green for medium points
   } else {
       return '#0000FF';  // Blue for lowest points
   }
}

function addLegend(minZ, maxZ, quartile) {
   const existingLegend = document.querySelector('.legend');
   if (existingLegend) {
       existingLegend.remove();
   }

   const legend = document.createElement('div');
   legend.className = 'legend';
   legend.innerHTML = `
       <h4>Altitude</h4>
       <div><span style="background: #FF0000"></span>Highest (${(minZ + quartile * 3).toFixed(1)} - ${maxZ.toFixed(1)})</div>
       <div><span style="background: #FFA500"></span>High (${(minZ + quartile * 2).toFixed(1)} - ${(minZ + quartile * 3).toFixed(1)})</div>
       <div><span style="background: #00FF00"></span>Medium (${(minZ + quartile).toFixed(1)} - ${(minZ + quartile * 2).toFixed(1)})</div>
       <div><span style="background: #0000FF"></span>Lowest (${minZ.toFixed(1)} - ${(minZ + quartile).toFixed(1)})</div>
   `;
   
   document.getElementById('map').appendChild(legend);
}

function clearThalwegs() {
    thalwegLines.forEach(line => {
        if (map.getLayer(line.id)) map.removeLayer(line.id);
        if (map.getSource(line.sourceId)) map.removeSource(line.sourceId);
    });
    thalwegLines = [];
}

function resetMap() {
   if (map) {
       map.setZoom(3);
       map.setCenter([-95.7129, 37.0902]);
   }
}

// Initialisation de la carte
document.addEventListener('DOMContentLoaded', function() {
    mapboxgl.accessToken = 'pk.eyJ1IjoibWFyY3Vzc2ltcGxlIiwiYSI6ImNseTNvb3hobzA5cWsybHBvenRmdHNxcmwifQ.ZQAMdmO7CT--DCeE1pLF_g';
 
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/marcussimple/cm4aaiudj01b701s3hdys60ct',  
        center: [-71.1520, 47.3167],
        zoom: 10
    });
 
    map.addControl(new mapboxgl.NavigationControl());
 
    map.on('load', () => {
        console.log('Map loaded successfully');
        mapLoaded = true;
        
        // Vérifier toutes les couches disponibles
        const layers = map.getStyle().layers;
        console.log('Available layers:', layers.map(layer => layer.id));
        
        // Ajouter l'événement de clic sur la couche de vertices
        map.on('click', 'vertices-0f51qm', async (e) => {
            console.log('Click event:', e);
            console.log('Feature properties:', e.features[0].properties);
            
            // Utilisez l'ID approprié selon votre structure de données dans Mapbox
            const vertexId = parseInt(e.features[0].properties.id);
            console.log('Vertex ID:', vertexId);
            
            try {
                console.log('Sending request for vertex:', vertexId);
                const response = await fetch('/get-vertex-thalwegs/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCSRFToken()
                    },
                    body: JSON.stringify({ vertex_id: vertexId })
                });
 
                const data = await response.json();
                console.log('Response from server:', data);
 
                if (!data.is_saddle) {
                    new mapboxgl.Popup()
                        .setLngLat(e.lngLat)
                        .setHTML(data.message)
                        .addTo(map);
                    return;
                }
 
                // Afficher les thalwegs
                if (data.status === 'success' && data.thalwegs && data.thalwegs.length > 0) {
                    data.thalwegs.forEach((thalweg, index) => {
                        const sourceId = `thalweg-source-${thalwegLines.length + index}`;
                        const layerId = `thalweg-layer-${thalwegLines.length + index}`;
 
                        map.addSource(sourceId, {
                            type: 'geojson',
                            data: {
                                type: 'Feature',
                                geometry: {
                                    type: 'LineString',
                                    coordinates: thalweg.vertices.map(v => [v.longitude, v.latitude])
                                }
                            }
                        });
 
                        map.addLayer({
                            id: layerId,
                            type: 'line',
                            source: sourceId,
                            paint: {
                                'line-color': '#FF0000',
                                'line-width': 2,
                                'line-opacity': 0.8
                            }
                        });
 
                        thalwegLines.push({ id: layerId, sourceId: sourceId });
                    });
                }
 
            } catch (error) {
                console.error('Error:', error);
            }
        });
 
        // Changer le curseur au survol des vertices
        map.on('mouseenter', 'vertices-0f51qm', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
 
        map.on('mouseleave', 'vertices-0f51qm', () => {
            map.getCanvas().style.cursor = '';
        });
    });
 });


async function showVertices() {
   console.log('Fetching vertices...');
   
   try {
       console.log('Making request to /get-vertices/');
       const response = await fetch('/get-vertices/');
       console.log('Response received:', response);
       
       const data = await response.json();
       console.log('Data received:', data);
       
       if (data.status === 'success') {
           console.log('Processing vertices:', data.vertices);
           
           // Clear existing markers
           markers.forEach(marker => marker.remove());
           markers = [];
           
           // Find min and max elevation for color scaling
           const elevations = data.vertices.map(v => parseFloat(v.elevation)).filter(z => !isNaN(z));
           const minZ = Math.min(...elevations);
           const maxZ = Math.max(...elevations);
           const range = maxZ - minZ;
           const quartile = range / 4;

           console.log('Elevation analysis:', {
               minZ,
               maxZ,
               range,
               quartile
           });
           
           // Create markers
           data.vertices.forEach((vertex, index) => {
               console.log(`Processing vertex ${index}:`, vertex);
               
               const el = document.createElement('div');
               el.className = 'marker';
               el.setAttribute('data-vertex-id', vertex.id);
               
               const elevation = parseFloat(vertex.elevation);
               if (!isNaN(elevation)) {
                   const color = getColorForZ(elevation, minZ, maxZ);
                   console.log(`Vertex ${vertex.id} color:`, color);
                   el.style.backgroundColor = color;
               } else {
                   el.style.backgroundColor = '#FF0000';
               }
               
               el.style.width = '4px';
               el.style.height = '4px';
               el.style.borderRadius = '50%';
               el.style.border = '1px solid black';
               
               console.log(`Creating marker at [${vertex.longitude}, ${vertex.latitude}]`);
               const marker = new mapboxgl.Marker(el)
                   .setLngLat([vertex.longitude, vertex.latitude])
                   .setPopup(new mapboxgl.Popup({ offset: 25 })
                       .setHTML(`
                           <h3>Vertex ${vertex.id}</h3>
                           <p>Elevation: ${vertex.elevation ? vertex.elevation.toFixed(2) + 'm' : 'N/A'}</p>
                           <p>Position: [${vertex.longitude.toFixed(6)}, ${vertex.latitude.toFixed(6)}]</p>
                       `))
                   .addTo(map);
               
               marker.vertexId = vertex.id;
               markers.push(marker);
           });
           
           // Add elevation legend
           addLegend(minZ, maxZ, quartile);
           
           // Fit map to show all points
           if (markers.length > 0) {
               console.log(`Fitting map to ${markers.length} markers`);
               const bounds = new mapboxgl.LngLatBounds();
               markers.forEach(marker => {
                   bounds.extend(marker.getLngLat());
               });
               map.fitBounds(bounds, {
                   padding: 50,
                   duration: 1000
               });
           }
           
           console.log(`Added ${markers.length} markers to the map`);
           
       } else {
           console.error('Error in response:', data.message);
       }
   } catch (error) {
       console.error('Error loading vertices:', error);
   }
}

async function showThalwegs() {
   if (!mapLoaded) {
       alert("Please wait for map to load");
       return;
   }

   if (markers.length === 0) {
       alert("Please show points first");
       return;
   }

   try {
       console.log('Fetching thalwegs...');
       
       const response = await fetch('/get-thalwegs/', {
           method: 'POST',
           headers: {
               'Content-Type': 'application/json',
               'X-CSRFToken': getCSRFToken()
           },
           body: JSON.stringify({
               vertexIds: markers.map(marker => marker.vertexId)
           })
       });

       const data = await response.json();
       console.log('Data received:', data);

       if (data.status === 'success' && data.thalwegs && data.thalwegs.length > 0) {
           thalwegLines.forEach(line => {
               if (map.getLayer(line.id)) map.removeLayer(line.id);
               if (map.getSource(line.sourceId)) map.removeSource(line.sourceId);
           });
           thalwegLines = [];

           data.thalwegs.forEach((thalweg, index) => {
               if (thalweg.vertices.length < 2) {
                   console.log('Thalweg has insufficient points:', thalweg);
                   return;
               }

               const sourceId = `thalweg-source-${index}`;
               const layerId = `thalweg-layer-${index}`;

               map.addSource(sourceId, {
                   type: 'geojson',
                   data: {
                       type: 'Feature',
                       properties: {
                           thalweg_index: thalweg.thalweg_index
                       },
                       geometry: {
                           type: 'LineString',
                           coordinates: thalweg.vertices.map(vertex => [
                               vertex.longitude,
                               vertex.latitude
                           ])
                       }
                   }
               });

               const color = getColorForThalweg(thalweg.thalweg_index);
               console.log(`Adding thalweg ${index} with index ${thalweg.thalweg_index} and color ${color}`);

               map.addLayer({
                   id: layerId,
                   type: 'line',
                   source: sourceId,
                   paint: {
                       'line-color': color,
                       'line-width': 1,
                       'line-opacity': 0.8
                   }
               });

               thalwegLines.push({ id: layerId, sourceId: sourceId });
           });

           console.log(`Successfully added ${data.thalwegs.length} thalwegs to the map`);
       } else {
           console.log('No thalwegs found in response');
       }

   } catch (error) {
       console.error('Error in showThalwegs:', error);
   }
}

// Style CSS
const style = document.createElement('style');
style.textContent = `
   .marker {
       width: 15px;
       height: 15px;
       background-color: #ff0000;
       border-radius: 50%;
       border: 2px solid #ffffff;
       cursor: pointer;
   }

   .mapboxgl-popup {
       max-width: 200px;
   }

   .mapboxgl-popup-content {
       text-align: center;
       font-family: Arial, sans-serif;
       padding: 10px;
   }
`;
document.head.appendChild(style);