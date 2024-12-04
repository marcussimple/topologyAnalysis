from django.shortcuts import render  
from django.http import JsonResponse
from neomodel import db
from django.views.decorators.csrf import csrf_exempt
import json

def index(request):
    """
    Render the main page with the map
    """
    return render(request, 'vertex_app/index.html')


# Fichier: vertex_app/views.py
def transform_coordinates(x, y, z):
    """
    Transform local coordinates to WGS84 using known reference point
    """
    ref_point = {
        'x': 52500,  # Centre approximatif en X
        'y': 35600,  # Centre approximatif en Y
        'lon': -71.1520,
        'lat': 47.3167
    }
    
    try:
        # Utiliser le même facteur que dans l'exportation
        dx = (x - ref_point['x']) * 0.00000899
        dy = (y - ref_point['y']) * 0.00000899
        
        lon = ref_point['lon'] + dx
        lat = ref_point['lat'] + dy
        
        return {
            'longitude': lon,
            'latitude': lat,
            'elevation': z
        }
    except Exception as e:
        print(f"Erreur de transformation: {str(e)}")
        return None


# Fichier: vertex_app/views.py
@csrf_exempt
def get_saddle_thalwegs(request):
    """
    Get thalwegs starting from a saddle point
    """
    try:
        print("1. Début de get_saddle_thalwegs")
        data = json.loads(request.body)
        saddle_id = data.get('saddle_id')
        print(f"2. ID de la selle reçu: {saddle_id}")
        
        # Vérifier d'abord si c'est une selle
        check_query = """
        MATCH (s:Vertex {id: $saddle_id})
        RETURN s.typevertex as type, s
        """
        print("3. Exécution de la requête de vérification")
        check_results, _ = db.cypher_query(check_query, {'saddle_id': int(saddle_id)})
        print(f"4. Résultat de la vérification: {check_results}")
        
        if not check_results or check_results[0][0] != 'saddle':
            print("5. Ce n'est pas une selle valide")
            return JsonResponse({
                'status': 'error',
                'message': f'Selle {saddle_id} non trouvée ou n\'est pas une selle'
            })
        
        print("6. C'est une selle valide, recherche des thalwegs")
        
        # Obtenir tous les chemins thalweg à partir de la selle
        query = """
        MATCH (saddle:Vertex {id: $saddle_id}) 
        WHERE saddle.typevertex = "saddle" 
        MATCH (saddle)-[t:THALWEG_PATH*]->(end) 
        WHERE NOT ((end)-[:THALWEG_PATH]->()) 
        RETURN saddle, collect(t) as paths, collect(end) as ends
        """
        
        print("7. Exécution de la requête principale")
        results, _ = db.cypher_query(query, {'saddle_id': int(saddle_id)})
        print(f"8. Résultats de la requête principale: {results}")
        
        if not results:
            print("9. Aucun thalweg trouvé")
            return JsonResponse({
                'status': 'error',
                'message': f'Aucun thalweg trouvé pour la selle {saddle_id}'
            })
            
        print("10. Traitement des résultats")
        thalwegs = []
        saddle_node = results[0][0]
        paths = results[0][1]
        ends = results[0][2]

        # Pour chaque chemin final
        for end_node in ends:
            path_query = """
            MATCH p=(saddle:Vertex {id: $saddle_id})-[t:THALWEG_PATH*]->(end:Vertex {id: $end_id})
            UNWIND nodes(p) as node
            RETURN collect(node) as path_nodes
            """
            
            path_results, _ = db.cypher_query(path_query, {
                'saddle_id': saddle_id,
                'end_id': end_node['id']
            })
            
            if path_results and path_results[0]:
                vertices = path_results[0][0]
                path_coords = []
                
                print(f"11. Construction du chemin vers le point final: {end_node['id']}")
                for vertex in vertices:
                    coords = transform_coordinates(
                        float(vertex['x']),
                        float(vertex['y']),
                        float(vertex['z'])
                    )
                    if coords:
                        path_coords.append(coords)
                
                if path_coords:
                    thalwegs.append({
                        'path': path_coords,
                        'properties': {
                            'start': saddle_node['id'],
                            'end': end_node['id'],
                            'elevation_start': saddle_node['z'],
                            'elevation_end': end_node['z']
                        }
                    })
        
        print(f"12. Nombre de thalwegs trouvés: {len(thalwegs)}")
        return JsonResponse({
            'status': 'success',
            'thalwegs': thalwegs
        })
        
    except Exception as e:
        print(f"ERREUR dans get_saddle_thalwegs: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)