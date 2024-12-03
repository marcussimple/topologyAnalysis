from django.shortcuts import render  
from django.http import JsonResponse
from neomodel import db
from django.views.decorators.csrf import csrf_exempt
from pyproj import Transformer
import json
import os

def index(request):
    """
    Render the main page with the map
    """
    return render(request, 'vertex_app/index.html')


def transform_coordinates(x, y, z):
    """
    Transform local coordinates to WGS84 using known reference point
    """
    # Point de référence de la Forêt Montmorency
    ref_point = {
        'x': 52500,  # Centre approximatif en X
        'y': 35600,  # Centre approximatif en Y
        'lon': -71.1520,
        'lat': 47.3167
    }
    
    try:
        # Calcul des décalages relatifs
        dx = (x - ref_point['x']) * 0.00001
        dy = (y - ref_point['y']) * 0.00001
        
        # Conversion en latitude/longitude
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


def get_all_vertices(request):
    try:
        query = """
        MATCH (n:Vertex)
        RETURN 
            n.id as id,
            n.x as x,
            n.y as y,
            n.z as z
              // Limitons à 5 points pour le debug
        """
        
        results, _ = db.cypher_query(query)
        print("\nRaw data from database:")
        for row in results:
            print(f"ID: {row[0]}, X: {row[1]}, Y: {row[2]}, Z: {row[3]}")
            
        vertices = []
        for row in results:
            if row[0] is not None:
                x = float(row[1]) if row[1] is not None else None
                y = float(row[2]) if row[2] is not None else None
                z = float(row[3]) if row[3] is not None else None
                
                print(f"\nProcessing vertex {row[0]}:")
                print(f"Original coordinates: X={x}, Y={y}, Z={z}")
                
                coords = transform_coordinates(x, y, z)
                print(f"Transformed coordinates: {coords}")
                
                if coords:
                    vertices.append({
                        'id': row[0],
                        'longitude': coords['longitude'],
                        'latitude': coords['latitude'],
                        'elevation': coords['elevation']
                    })
        
        print(f"\nProcessed vertices: {vertices}")
        
        return JsonResponse({
            'status': 'success',
            'vertices': vertices
        })
        
    except Exception as e:
        print(f"Error in get_all_vertices: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': f'Query error: {str(e)}'
        }, status=500)


@csrf_exempt
def get_thalwegs(request):
    try:
        print("\nStarting get_thalwegs function")
        data = json.loads(request.body)
        vertex_ids = data.get('vertexIds', [])

        # D'abord, trouvons les saddle_ids pertinents
        query = """
        MATCH (v:Vertex)-[r:THALWEG_PATH]-()
        WHERE v.id IN $vertex_ids AND r.saddle_id IS NOT NULL
        WITH DISTINCT r.saddle_id as saddle_id
        RETURN saddle_id
        """
        saddle_results = db.cypher_query(query, {'vertex_ids': vertex_ids})[0]
        print(f"Found {len(saddle_results)} saddle points")

        all_thalwegs = []
        for saddle_row in saddle_results:
            saddle_id = saddle_row[0]
            print(f"\nProcessing saddle {saddle_id}")
            
            # Utiliser la procédure pour chaque selle
            thalweg_query = """
            CALL custom.getThalwegPaths($saddle_id)
            YIELD saddle_id, thalweg_index, vertex_ids
            WITH saddle_id, thalweg_index, vertex_ids
            MATCH (v:Vertex)
            WHERE v.id IN vertex_ids
            WITH saddle_id, thalweg_index, vertex_ids,
                 collect({id: v.id, x: v.x, y: v.y, z: v.z}) as vertices
            RETURN thalweg_index, vertices
            """
            
            thalweg_results = db.cypher_query(thalweg_query, {'saddle_id': saddle_id})[0]
            
            for row in thalweg_results:
                thalweg_index = row[0]
                vertices = row[1]
                
                # Transformer les coordonnées
                transformed_vertices = []
                for vertex in vertices:
                    coords = transform_coordinates(
                        float(vertex['x']),
                        float(vertex['y']),
                        float(vertex['z'])
                    )
                    if coords:
                        transformed_vertices.append({
                            'id': vertex['id'],
                            'longitude': coords['longitude'],
                            'latitude': coords['latitude'],
                            'elevation': coords['elevation']
                        })
                
                if len(transformed_vertices) >= 2:
                    all_thalwegs.append({
                        'saddle_id': saddle_id,
                        'thalweg_index': thalweg_index,
                        'vertices': transformed_vertices
                    })

        print(f"\nSending {len(all_thalwegs)} thalwegs")
        return JsonResponse({
            'status': 'success',
            'thalwegs': all_thalwegs
        })
        
    except Exception as e:
        print(f"Error in get_thalwegs: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

def execute_query(request):
    """
    Execute a custom Cypher query
    """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            query = data.get('query', '')
            
            if not query:
                return JsonResponse({
                    'status': 'error',
                    'message': 'No query provided'
                }, status=400)
            
            results, _ = db.cypher_query(query)
            
            # Process results
            processed_results = []
            for record in results:
                processed_record = []
                for item in record:
                    if hasattr(item, 'properties'):  # If it's a Neo4j node
                        processed_record.append(dict(item.properties))
                    else:  # If it's a primitive type
                        processed_record.append(item)
                processed_results.append(processed_record)
            
            return JsonResponse({
                'status': 'success',
                'results': processed_results
            })
            
        except json.JSONDecodeError:
            return JsonResponse({
                'status': 'error',
                'message': 'Invalid JSON in request body'
            }, status=400)
        except Exception as e:
            return JsonResponse({
                'status': 'error',
                'message': str(e)
            }, status=500)
    
    return JsonResponse({
        'status': 'error',
        'message': 'Only POST method is allowed'
    }, status=405)

@csrf_exempt
def get_vertex_thalwegs(request):
    try:
        data = json.loads(request.body)
        vertex_id = data.get('vertex_id')
        
        print(f"\nChecking class of vertex {vertex_id}...")
        
        # 1. Vérifier le type du vertex avec la procédure existante
        check_query = """
        CALL custom.checkVertexClass($vertex_id)
        YIELD vertexId, vertexType
        RETURN vertexType
        """
        
        check_results = db.cypher_query(check_query, {'vertex_id': vertex_id})[0]
        vertex_type = check_results[0][0] if check_results else None
        
        if vertex_type != 'saddle':  # vérifier si c'est une selle
            print(f"Vertex {vertex_id} is not a saddle point (type: {vertex_type})")
            return JsonResponse({
                'status': 'success',
                'is_saddle': False,
                'message': f'This vertex is not a saddle point (type: {vertex_type})'
            })
            
        print(f"Vertex {vertex_id} is a saddle point. Getting thalwegs...")
        
        # 2. Utiliser getThalwegPaths pour obtenir les thalwegs
        thalweg_query = """
        CALL custom.getThalwegPaths($vertex_id)
        YIELD saddle_id, thalweg_index, vertex_ids, altitudes
        MATCH (v:Vertex)
        WHERE v.id IN vertex_ids
        WITH thalweg_index, vertex_ids, altitudes,
             collect({id: v.id, x: v.x, y: v.y, z: v.z}) as vertices
        RETURN thalweg_index, vertices, altitudes
        """
        
        thalweg_results = db.cypher_query(thalweg_query, {'vertex_id': vertex_id})[0]
        print(f"Found {len(thalweg_results)} thalwegs")
        
        transformed_thalwegs = []
        for row in thalweg_results:
            thalweg_index = row[0]
            vertices = row[1]
            altitudes = row[2]
            
            transformed_vertices = []
            for vertex in vertices:
                coords = transform_coordinates(
                    float(vertex['x']),
                    float(vertex['y']),
                    float(vertex['z'])
                )
                if coords:
                    transformed_vertices.append({
                        'id': vertex['id'],
                        'longitude': coords['longitude'],
                        'latitude': coords['latitude'],
                        'elevation': coords['elevation']
                    })
            
            if len(transformed_vertices) >= 2:
                transformed_thalwegs.append({
                    'thalweg_index': thalweg_index,
                    'vertices': transformed_vertices,
                    'altitudes': altitudes
                })
        
        return JsonResponse({
            'status': 'success',
            'is_saddle': True,
            'thalwegs': transformed_thalwegs
        })
        
    except Exception as e:
        print(f"Error in get_vertex_thalwegs: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)