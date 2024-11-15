// Global variables
let map;
let markers = [];
let thalwegLines = [];    
let showingThalwegs = false;  

// Initialize map when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize mapbox
    mapboxgl.accessToken = 'pk.eyJ1IjoibWFyY3Vzc2ltcGxlIiwiYSI6ImNseTNvb3hobzA5cWsybHBvenRmdHNxcmwifQ.ZQAMdmO7CT--DCeE1pLF_g';
 
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-95.7129, 37.0902], // Center of US
        zoom: 3
    });
 
    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl());
 
    // Wait for map to load before allowing interactions
    map.on('load', () => {
        console.log('Map loaded successfully');
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
                
                el.style.width = '8px';
                el.style.height = '8px';
                el.style.borderRadius = '50%';
                el.style.border = '2px solid white';
                
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

function getColorForZ(z, minZ, maxZ) {
    const percentage = (z - minZ) / (maxZ - minZ);
    console.log(`Z: ${z}, Percentage: ${percentage}`);
    
    if (percentage >= 0.75) {
        return '#FF0000';  // Red for highest points (75-100% of height range)
    } else if (percentage >= 0.5) {
        return '#FFA500';  // Orange for high points (50-75% of height range)
    } else if (percentage >= 0.25) {
        return '#00FF00';  // Green for medium points (25-50% of height range)
    } else {
        return '#0000FF';  // Blue for lowest points (0-25% of height range)
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

function resetMap() {
    if (map) {
        map.setZoom(3);
        map.setCenter([-95.7129, 37.0902]); // Center of US
    }
}

// Add CSS styles
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