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

def test_db_connection(request):
    """
    Test Neo4j database connection
    """
    try:
        query = "MATCH (n) RETURN count(n) as count"
        results, _ = db.cypher_query(query)
        count = results[0][0]
        
        return JsonResponse({
            'status': 'success',
            'message': 'Connected to Neo4j successfully',
            'node_count': count
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Database connection error: {str(e)}'
        }, status=500)
    

def get_all_vertices(request):
    """
    Get all vertices with their coordinates (limited to 30)
    """
    try:
        # Query to get vertices
        query = """
        MATCH (n:Vertex)
        RETURN 
            n.id as id,
            n.x as x,
            n.y as y,
            n.z as z
            LIMIT 1500
        """
        
        results, _ = db.cypher_query(query)
        
        # Print raw results for debugging
        print("Raw query results:")
        for row in results:
            print(f"ID: {row[0]}, X: {row[1]}, Y: {row[2]}, Z: {row[3]}")
        
        vertices = [
            {
                'id': row[0],
                'x': float(row[1]) if row[1] is not None else None,
                'y': float(row[2]) if row[2] is not None else None,
                'z': float(row[3]) if row[3] is not None else None
            }
            for row in results if row[0] is not None
        ]
        
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
def create_test_data(request):
    """
    Create test vertices in the database
    """
    try:
        # Clear existing data (optional)
        clear_query = "MATCH (n) DETACH DELETE n"
        db.cypher_query(clear_query)
        
        # Create test vertices with coordinates
        create_query = """
        CREATE (n1:Vertex {name: 'Location1', latitude: 40.7128, longitude: -74.0060})  // New York
        CREATE (n2:Vertex {name: 'Location2', latitude: 34.0522, longitude: -118.2437}) // Los Angeles
        CREATE (n3:Vertex {name: 'Location3', latitude: 41.8781, longitude: -87.6298})  // Chicago
        CREATE (n4:Vertex {name: 'Location4', latitude: 29.7604, longitude: -95.3698})  // Houston
        CREATE (n5:Vertex {name: 'Location5', latitude: 39.9526, longitude: -75.1652})  // Philadelphia
        
        // Create connections between vertices
        CREATE (n1)-[:CONNECTS_TO]->(n2)
        CREATE (n2)-[:CONNECTS_TO]->(n3)
        CREATE (n3)-[:CONNECTS_TO]->(n4)
        CREATE (n4)-[:CONNECTS_TO]->(n5)
        CREATE (n5)-[:CONNECTS_TO]->(n1)
        """
        
        db.cypher_query(create_query)
        
        return JsonResponse({
            'status': 'success',
            'message': 'Test data created successfully'
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Error creating test data: {str(e)}'
        }, status=500)