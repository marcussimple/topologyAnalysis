// Global variables
let map;
let markers = [];

// Initialize map when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize mapbox
    mapboxgl.accessToken = 'pk.eyJ1IjoibWFyY3Vzc2ltcGxlIiwiYSI6ImNseTNvb3hobzA5cWsybHBvenRmdHNxcmwifQ.ZQAMdmO7CT--DCeE1pLF_g'; // Make sure to replace with your token

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
    const vertexListDiv = document.getElementById('vertex-list');
    vertexListDiv.innerHTML = 'Loading vertices...';
    
    try {
        const response = await fetch('/get-vertices/');
        const data = await response.json();
        
        if (data.status === 'success') {
            // Clear existing markers
            if (window.currentMarkers) {
                window.currentMarkers.forEach(marker => marker.remove());
            }
            window.currentMarkers = [];
            
            // Montmorency Forest center coordinates
            const centerPoint = {
                longitude: -71.1500,
                latitude: 47.3167
            };
            
            // Find the range of x and y coordinates
            const xValues = data.vertices.map(v => parseFloat(v.x));
            const yValues = data.vertices.map(v => parseFloat(v.y));
            
            // Debug Z values
            const zValues = data.vertices.map(v => parseFloat(v.z)).filter(z => !isNaN(z));
            const minZ = Math.min(...zValues);
            const maxZ = Math.max(...zValues);
            const range = maxZ - minZ;
            const quartile = range / 4;

            console.log('Z-value analysis:');
            console.log('Min Z:', minZ);
            console.log('Max Z:', maxZ);
            console.log('Range:', range);
            console.log('Quartile size:', quartile);
            
            const xMin = Math.min(...xValues);
            const xMax = Math.max(...xValues);
            const yMin = Math.min(...yValues);
            const yMax = Math.max(...yValues);
            
            // Calculate center of the vertex data
            const xCenter = (xMax + xMin) / 2;
            const yCenter = (yMax + yMin) / 2;
            
            const scaleFactor = 0.0001;

            data.vertices.forEach(vertex => {
                const relativeX = (vertex.x - xCenter) * scaleFactor;
                const relativeY = (vertex.y - yCenter) * scaleFactor;
                
                const longitude = centerPoint.longitude + relativeX;
                const latitude = centerPoint.latitude + relativeY;

                // Create marker with color based on Z
                const el = document.createElement('div');
                el.className = 'marker';
                
                const zValue = parseFloat(vertex.z);
                console.log(`Vertex ${vertex.id} - Z value: ${zValue}, Percentage: ${((zValue - minZ) / (maxZ - minZ)) * 100}%`);
                
                if (!isNaN(zValue)) {
                    const color = getColorForZ(zValue, minZ, maxZ);
                    console.log(`Vertex ${vertex.id} - Color assigned: ${color}`);
                    el.style.backgroundColor = color;
                } else {
                    el.style.backgroundColor = '#FF0000';  // Default red for no Z value
                }
                
                el.style.width = '8px';      // Set size
                el.style.height = '8px';     // Set size
                el.style.borderRadius = '50%';
                el.style.border = '2px solid white';
                
                const marker = new mapboxgl.Marker(el)
                    .setLngLat([longitude, latitude])
                    .setPopup(new mapboxgl.Popup({ offset: 25 })
                        .setHTML(`
                            <h3>Vertex ${vertex.id}</h3>
                            <p>Original X: ${vertex.x}</p>
                            <p>Original Y: ${vertex.y}</p>
                            <p>Z: ${vertex.z || 'N/A'}</p>
                        `))
                    .addTo(map);
                
                window.currentMarkers.push(marker);
            });
            
            // Add legend
            addLegend(minZ, maxZ, quartile);
            
            map.flyTo({
                center: [centerPoint.longitude, centerPoint.latitude],
                zoom: 12
            });

            vertexListDiv.innerHTML = `
                <h3>Found ${data.vertices.length} vertices:</h3>
                <ul style="list-style: none; padding: 0;">
                    ${data.vertices.map(v => `
                        <li style="padding: 5px 0; border-bottom: 1px solid #eee;">
                            Vertex ${v.id}<br>
                            <small>X: ${v.x}, Y: ${v.y}</small>
                            ${v.z ? `<br><small>Z: ${v.z}</small>` : ''}
                        </li>
                    `).join('')}
                </ul>
            `;

        } else {
            vertexListDiv.innerHTML = `
                <p style="color: red;">
                    Error: ${data.message}
                </p>
            `;
        }
    } catch (error) {
        console.error('Error loading vertices:', error);
        vertexListDiv.innerHTML = `
            <p style="color: red;">
                Error loading vertices: ${error.message}
            </p>
        `;
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


// Helper function to scale values from one range to another
function scaleValue(value, fromMin, fromMax, toMin, toMax) {
    // Convert to number if it's a string
    value = parseFloat(value);
    
    // Check for invalid input
    if (isNaN(value) || fromMax === fromMin) {
        return 0;
    }
    
    const scale = (toMax - toMin) / (fromMax - fromMin);
    return toMin + ((value - fromMin) * scale);
}

async function createTestData() {
    const statusDiv = document.getElementById('db-status');
    statusDiv.innerHTML = 'Creating test data...';
    
    try {
        const response = await fetch('/create-test-data/');
        const data = await response.json();
        
        if (data.status === 'success') {
            statusDiv.innerHTML = `
                <p style="color: green;">
                    ✓ ${data.message}<br>
                    Click "Show Vertices" to see the data on the map
                </p>
            `;
        } else {
            statusDiv.innerHTML = `
                <p style="color: red;">
                    ✗ ${data.message}
                </p>
            `;
        }
    } catch (error) {
        statusDiv.innerHTML = `
            <p style="color: red;">
                ✗ Error creating test data: ${error.message}
            </p>
        `;
    }
}

function resetMap() {
    if (map) {
        map.setZoom(3);
        map.setCenter([-95.7129, 37.0902]); // Center of US
    }
}

// Add some CSS to make the markers visible
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