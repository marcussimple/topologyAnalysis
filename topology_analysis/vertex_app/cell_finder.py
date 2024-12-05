from neo4j import GraphDatabase

class CellFinder:
    def __init__(self, uri, user, password):
        """Initialize the Neo4j driver"""
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        
    def close(self):
        """Close the driver connection"""
        self.driver.close()

    def get_maximum_info(self, session, maximum_id):
        """Get information about a maximum vertex"""
        query = """
        MATCH (m:Vertex {typevertex: 'maximum', id: $maximum_id})
        RETURN m.id as id, m.x as x, m.y as y, m.z as z
        """
        result = session.run(query, maximum_id=maximum_id).single()
        if not result:
            return None
        return {
            "maximum_id": result["id"],
            "x": result["x"],
            "y": result["y"],
            "altitude": result["z"]
        }

    def get_cell_boundary(self, session, maximum_id):
        """Get the cell boundary points for a maximum"""
        query = """
        MATCH (c:Cell {maximum_id: $maximum_id})-[r:CELL_BOUNDARY]->(v:Vertex)
        WITH v, r.order as order
        ORDER BY order
        RETURN v.id as id, v.x as x, v.y as y, v.z as z, 
               v.typevertex as type, order
        """
        result = session.run(query, maximum_id=maximum_id)
        boundary_points = []
        for record in result:
            point = {
                "id": record["id"],
                "x": record["x"],
                "y": record["y"],
                "altitude": record["z"],
                "type": record["type"],
                "order": record["order"]
            }
            boundary_points.append(point)
        
        return boundary_points

    def get_cell_info(self, session, maximum_id):
        """Get cell statistics"""
        query = """
        MATCH (c:Cell {maximum_id: $maximum_id})
        RETURN c.average_altitude as avg_altitude,
               c.max_altitude as max_altitude,
               c.min_altitude as min_altitude,
               c.altitude_range as altitude_range,
               c.boundary_size as boundary_size
        """
        result = session.run(query, maximum_id=maximum_id).single()
        if not result:
            return None
        
        return {
            "average_altitude": result["avg_altitude"],
            "max_altitude": result["max_altitude"],
            "min_altitude": result["min_altitude"],
            "altitude_range": result["altitude_range"],
            "boundary_size": result["boundary_size"]
        }

    def find_cell(self, session, maximum_id):
        """Find all information about a cell"""
        # Get maximum info
        maximum = self.get_maximum_info(session, maximum_id)
        if not maximum:
            return None

        # Get boundary points
        boundary = self.get_cell_boundary(session, maximum_id)
        if not boundary:
            return None

        # Get cell statistics
        cell_info = self.get_cell_info(session, maximum_id)
        if not cell_info:
            return None

        return {
            "maximum": maximum,
            "boundary": boundary,
            "statistics": cell_info
        }