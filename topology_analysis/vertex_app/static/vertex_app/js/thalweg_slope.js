document.addEventListener('DOMContentLoaded', function() {
    // Popup HTML
    const popupHTML = `
        <div id="thalwegSlopePopup" class="custom-popup" style="display: none;">
            <div class="popup-content">
                <div class="popup-header">
                    <h3>Pente descendante d'un thalweg</h3>
                    <span class="close-btn">&times;</span>
                </div>
                <div class="popup-body">
                    <input type="number" id="thalwegIdInput" placeholder="ID du thalweg" min="1">
                    <div class="error-message" style="display: none; color: red;"></div>
                    <button id="submitThalwegId" class="submit-btn">Valider</button>
                </div>
            </div>
        </div>
    `;
    
    // Ajouter le popup au document s'il n'existe pas déjà
    if (!document.getElementById('thalwegSlopePopup')) {
        document.body.insertAdjacentHTML('beforeend', popupHTML);
    }

    // Récupérer les éléments
    const popup = document.getElementById('thalwegSlopePopup');
    const closeBtn = popup.querySelector('.close-btn');
    const submitBtn = document.getElementById('submitThalwegId');
    const input = document.getElementById('thalwegIdInput');
    const errorMessage = popup.querySelector('.error-message');
    const validationResults = document.getElementById('validation-results');
    const slopeResults = document.getElementById('slope-results');

    // Gestionnaires d'événements pour les boutons
    document.querySelectorAll('#btn').forEach(button => {
        if (button.textContent.trim() === "Pente descandante d'un thalweg") {
            button.addEventListener('click', () => {
                popup.style.display = 'flex';
                input.value = '';
                errorMessage.style.display = 'none';
            });
        }
    });

    // Ajouter ceci dans l'événement DOMContentLoaded
    document.querySelector('.close-results').addEventListener('click', () => {
        document.getElementById('validation-results').style.display = 'none';
        document.getElementById('slope-results').style.display = 'none';
    });

    // Gérer la fermeture du popup
    closeBtn.addEventListener('click', () => {
        popup.style.display = 'none';
        
        input.value = '';
    });

    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            popup.style.display = 'none';
            
            input.value = '';
        }
    });

    // Gérer la soumission
    submitBtn.addEventListener('click', () => {
        const thalwegId = input.value.trim();
        if (!thalwegId) {
            errorMessage.textContent = "Veuillez entrer un ID";
            errorMessage.style.display = 'block';
            return;
        }
        
        fetchThalwegSlope(parseInt(thalwegId));
    });

    // Permettre la soumission avec Enter
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitBtn.click();
        }
    });
});

function fetchThalwegSlope(thalwegId) {
    fetch('/get-thalweg-slope/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({ 
            thalweg_id: thalwegId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            displayResults(data.results);
        } else {
            alert(data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Erreur lors de la récupération des données');
    });
}

function displayResults(results) {
    // Afficher la section des résultats
    const validationResults = document.getElementById('validation-results');
    const slopeResults = document.getElementById('slope-results');
    validationResults.style.display = 'block';
    slopeResults.style.display = 'block';

    // Remplir le tableau
    const tbody = slopeResults.querySelector('table tbody');
    tbody.innerHTML = '';

    results.forEach(segment => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = segment.start_id;
        row.insertCell(1).textContent = segment.end_id;
        row.insertCell(2).textContent = segment.slope.toFixed(2) + '%';
        row.insertCell(3).textContent = segment.distance.toFixed(2) + 'm';
        row.insertCell(4).textContent = segment.elevation_diff.toFixed(2) + 'm';
    });
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