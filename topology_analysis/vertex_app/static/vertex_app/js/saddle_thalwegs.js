// saddle_thalwegs.js
document.addEventListener('DOMContentLoaded', function() {
    // Sélectionner l'élément avec id="btn" contenant le texte "Thalweg à partir d'une selle"
    const buttons = document.querySelectorAll('#btn');
    
    buttons.forEach(button => {
        if (button.textContent.trim() === "Thalweg à partir d'une selle") {
            button.addEventListener('click', () => {
                // Créer et afficher la boîte de dialogue
                const saddleId = prompt("Entrez l'ID de la selle :");
                if (saddleId) {
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
                            const bounds = new mapboxgl.LngLatBounds();

                            data.thalwegs.forEach((thalweg, index) => {
                                // ... reste du code pour afficher les thalwegs
                            });
                        }
                    })
                    .catch(error => {
                        console.error('Erreur:', error);
                        alert('Erreur lors de la récupération des thalwegs');
                    });
                }
            });
        }
    });
});