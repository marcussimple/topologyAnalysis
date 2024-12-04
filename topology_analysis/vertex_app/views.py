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
        dx = (x - ref_point['x']) * 0.00001
        dy = (y - ref_point['y']) * 0.00001
        
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
    try:
        data = json.loads(request.body)
        saddle_id = data.get('saddle_id')
        
        query = """
        MATCH (saddle:Vertex {id: $saddle_id}) 
        WHERE saddle.typevertex = "saddle" 
        MATCH (saddle)-[t:THALWEG_PATH*]->(end) 
        WHERE NOT ((end)-[:THALWEG_PATH]->()) 
        RETURN saddle, t, end
        """
        
        results, _ = db.cypher_query(query, {'saddle_id': saddle_id})
        
        if not results:
            return JsonResponse({
                'status': 'error',
                'message': f'Selle {saddle_id} non trouvée ou n\'est pas une selle'
            })
            
        thalwegs = []
        for row in results:
            saddle_node = row[0]
            paths = row[1]
            end_node = row[2]
            
            vertices = [saddle_node]
            for path in paths:
                vertex = map.get_node(path.end_node)
                if vertex:
                    vertices.append(vertex)
            vertices.append(end_node)
            
            path_coords = []
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
        
        return JsonResponse({
            'status': 'success',
            'thalwegs': thalwegs
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)