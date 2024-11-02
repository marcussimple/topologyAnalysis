// At the very top of map.js
mapboxgl.accessToken = 'pk.eyJ1IjoibWFyY3Vzc2ltcGxlIiwiYSI6ImNseTNvb3hobzA5cWsybHBvenRmdHNxcmwifQ.ZQAMdmO7CT--DCeE1pLF_g'; // Replace with your actual token

// Make sure the map initializes after DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-74.5, 40],  // Default center
        zoom: 9
    });

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl());

    // Debug log to check if map is loading
    map.on('load', () => {
        console.log('Map loaded successfully');
    });

    // Debug log for errors
    map.on('error', (e) => {
        console.error('Map error:', e);
    });
});