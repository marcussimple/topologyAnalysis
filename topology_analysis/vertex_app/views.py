from django.shortcuts import render  
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .thalweg_finder import ThalwegFinder
from .cell_finder import CellFinder
from .path_finder import PathFinder
from neo4j import GraphDatabase


# Database connection settings
uri = "neo4j://localhost:7687"
user = ""  # votre username Neo4j
password = ""  # votre password Neo4j



def index(request):
    """
    Render the main page with the map
    """
    return render(request, 'vertex_app/index.html')

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

        uri = "neo4j://localhost:7687"
        user = ""  
        password = ""  

        finder = ThalwegFinder(uri, user, password)
        try:
            with finder.driver.session() as session:
                saddle = finder.get_saddle_info(session, int(saddle_id))
                if not saddle:
                    return JsonResponse({
                        'status': 'error',
                        'message': f'Selle {saddle_id} non trouvée'
                    })

                neighbors = finder.get_ordered_neighbors(session, int(saddle_id))
                descent_series = finder.find_descent_series(saddle, neighbors)

                saddle_dict = {
                    "id": saddle["saddle_id"],
                    "x": saddle["x"],
                    "y": saddle["y"],
                    "altitude": saddle["altitude"],
                    "type": saddle["type"]
                }

                thalwegs = []
                for series in descent_series:
                    if len(series) == 1:
                        start_point = series[0]
                    else:
                        start_point = min(
                            series,
                            key=lambda n: finder.calculate_slope(saddle, n)
                        )

                    path_result = finder.find_thalweg_path(session, saddle_dict, start_point)
                    
                    if path_result:
                        path, slope = path_result
                        path_coords = []
                        
                        # Coordonnées de la selle
                        coords_saddle = transform_coordinates(
                            float(saddle["x"]),
                            float(saddle["y"]),
                            float(saddle["altitude"])
                        )
                        if coords_saddle:
                            path_coords.append(coords_saddle)

                        # Coordonnées du chemin
                        for vertex in path[1:]:  # Skip saddle as it's already added
                            coords = transform_coordinates(
                                float(vertex["x"]),
                                float(vertex["y"]),
                                float(vertex["altitude"])
                            )
                            if coords:
                                path_coords.append(coords)

                        if path_coords:
                            thalwegs.append({
                                'path': path_coords,
                                'properties': {
                                    'start': saddle["saddle_id"],
                                    'end': path[-1]["id"],
                                    'elevation_start': float(saddle["altitude"]),
                                    'elevation_end': float(path[-1]["altitude"]),
                                    'slope': float(slope)
                                }
                            })

                if not thalwegs:
                    return JsonResponse({
                        'status': 'error',
                        'message': f'Aucun thalweg trouvé pour la selle {saddle_id}'
                    })

                return JsonResponse({
                    'status': 'success',
                    'thalwegs': thalwegs
                })

        finally:
            finder.close()
            
    except Exception as e:
        print(f"ERREUR dans get_saddle_thalwegs: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)
    

@csrf_exempt
def get_maximum_cell(request):
    """
    Get cell boundary for a maximum point
    """
    try:
        data = json.loads(request.body)
        maximum_id = data.get('maximum_id')
        print(f"ID du maximum reçu: {maximum_id}")

        uri = "neo4j://localhost:7687"
        user = ""  # votre user Neo4j
        password = ""  # votre password Neo4j

        finder = CellFinder(uri, user, password)
        try:
            with finder.driver.session() as session:
                result = finder.find_cell(session, int(maximum_id))
                if not result:
                    return JsonResponse({
                        'status': 'error',
                        'message': f'Maximum {maximum_id} non trouvé ou pas de cellule associée'
                    })

                # Convertir les coordonnées de chaque point de la frontière
                boundary_coords = []
                for point in result['boundary']:
                    coords = transform_coordinates(
                        float(point['x']),
                        float(point['y']),
                        float(point['altitude'])
                    )
                    if coords:
                        boundary_coords.append(coords)

                if not boundary_coords:
                    return JsonResponse({
                        'status': 'error',
                        'message': 'Erreur lors de la conversion des coordonnées'
                    })

                return JsonResponse({
                    'status': 'success',
                    'maximum': result['maximum'],
                    'boundary': boundary_coords,
                    'statistics': result['statistics']
                })

        finally:
            finder.close()
            
    except Exception as e:
        print(f"ERREUR dans get_maximum_cell: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)
    


@csrf_exempt
def get_neighbor_maximums(request):
    try:
        data = json.loads(request.body)
        maximum_id = data.get('maximum_id')

        uri = "neo4j://localhost:7687"
        user = ""
        password = ""

        finder = CellFinder(uri, user, password)
        try:
            with finder.driver.session() as session:
                neighbor_maximums = finder.get_neighbor_maximums(session, int(maximum_id))
                
                return JsonResponse({
                    'status': 'success',
                    'neighbor_maximums': neighbor_maximums
                })
        finally:
            finder.close()
    except Exception as e:
        print(f"ERREUR dans get_neighbor_maximums: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)
    

@csrf_exempt
def get_shortest_path(request):
    try:
        data = json.loads(request.body)
        start_id = data.get('start_id')
        end_id = data.get('end_id')

        if not start_id or not end_id:
            return JsonResponse({
                'status': 'error',
                'message': 'Les IDs de début et de fin sont requis'
            })

        uri = "neo4j://localhost:7687"
        user = ""
        password = ""

        path_finder = PathFinder(uri, user, password)
        try:
            with path_finder.driver.session() as session:
                path = path_finder.find_shortest_path(session, int(start_id), int(end_id))
                
                if not path:
                    return JsonResponse({
                        'status': 'error',
                        'message': 'Aucun chemin trouvé'
                    })

                # Transformer les coordonnées
                path_coords = []
                for point in path:
                    coords = transform_coordinates(
                        float(point['x']),
                        float(point['y']),
                        float(point['z'])
                    )
                    if coords:
                        path_coords.append(coords)

                return JsonResponse({
                    'status': 'success',
                    'path': path_coords
                })

        finally:
            path_finder.close()
            
    except Exception as e:
        print(f"ERREUR dans get_shortest_path: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)
    
@csrf_exempt
def get_thalweg_slope(request):
    try:
        print("1. Début de get_thalweg_slope")
        data = json.loads(request.body)
        thalweg_id = data.get('thalweg_id')
        print(f"2. ID du thalweg reçu: {thalweg_id}")

        with GraphDatabase.driver(uri, auth=(user, password)) as driver:
            with driver.session() as session:
                query = """
                MATCH path = (v1:Vertex)-[r:THALWEG_PATH*]->(v2:Vertex)
                WHERE r[0].tlwg_id = $thalweg_id
                WITH DISTINCT nodes(path) as points
                UNWIND range(0, size(points)-2) as i
                WITH DISTINCT points[i] as start, points[i+1] as end
                RETURN DISTINCT
                    start.id as start_id,
                    end.id as end_id,
                    100 * (end.z - start.z) / 
                    sqrt((end.x - start.x)^2 + (end.y - start.y)^2) as slope,
                    sqrt((end.x - start.x)^2 + (end.y - start.y)^2) as distance,
                    end.z - start.z as elevation_diff
                ORDER BY slope DESC
                """
                print("3. Exécution de la requête Cypher")
                results = session.run(query, thalweg_id=thalweg_id)
                slope_data = [dict(record) for record in results]
                print(f"4. Résultats: {slope_data}")

                return JsonResponse({
                    'status': 'success',
                    'results': slope_data
                })
    except Exception as e:
        print(f"ERREUR dans get_thalweg_slope: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)