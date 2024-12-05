from django.shortcuts import render  
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .thalweg_finder import ThalwegFinder

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