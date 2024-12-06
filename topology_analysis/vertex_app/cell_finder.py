from neo4j import GraphDatabase

class CellFinder:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        
    def close(self):
        self.driver.close()

    def get_maximum_info(self, session, maximum_id):
        query = """
        MATCH (m:Vertex {id: $maximum_id})
        RETURN m.id as id, m.x as x, m.y as y, m.z as z, m.typevertex as type
        """
        result = session.run(query, maximum_id=maximum_id).single()
        if not result:
            return None
        return {
            "maximum_id": result["id"],
            "x": result["x"],
            "y": result["y"],
            "altitude": result["z"],
            "type": result["type"]
        }

    def find_cell(self, session, maximum_id):
        query = """
        MATCH (c:Cell {maximum_id: $maximum_id})-[r:CELL_BOUNDARY]->(v:Vertex)
        WITH c, v, r.order as order
        ORDER BY order
        RETURN c.average_altitude as avg_altitude,
               c.max_altitude as max_altitude,
               c.min_altitude as min_altitude,
               c.altitude_range as altitude_range,
               c.boundary_size as boundary_size,
               collect({
                   id: v.id,
                   x: v.x,
                   y: v.y,
                   altitude: v.z,
                   type: v.typevertex,
                   order: order
               }) as boundary_points
        """
        
        result = session.run(query, maximum_id=maximum_id).single()
        if not result:
            return None

        maximum = self.get_maximum_info(session, maximum_id)
        if not maximum:
            return None

        return {
            "maximum": maximum,
            "boundary": result["boundary_points"],
            "statistics": {
                "average_altitude": result["avg_altitude"],
                "max_altitude": result["max_altitude"],
                "min_altitude": result["min_altitude"],
                "altitude_range": result["altitude_range"],
                "boundary_size": result["boundary_size"]
            }
        }

def main():
    uri = "neo4j://localhost:7687"
    user = ""
    password = ""
    
    finder = CellFinder(uri, user, password)
    
    try:
        with finder.driver.session() as session:
            maximum_id = input("Entrez l'ID du maximum : ")
            result = finder.find_cell(session, int(maximum_id))
            
            if result:
                print(f"Cellule trouvée pour le maximum {maximum_id}")
                print(f"Points de la frontière : {[p['id'] for p in result['boundary']]}")
                print(f"Statistiques : {result['statistics']}")
            else:
                print(f"Maximum {maximum_id} non trouvé ou pas de cellule associée")
                
    finally:
        finder.close()

if __name__ == "__main__":
    main()