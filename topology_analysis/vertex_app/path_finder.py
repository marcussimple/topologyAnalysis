from neo4j import GraphDatabase

class PathFinder:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def find_shortest_path(self, session, start_id, end_id):
        """
        Trouve le plus court chemin entre deux points.
        """
        query = """
        MATCH path = shortestPath((start:Vertex {id: $start_id})-[:CONNECTS*]-(end:Vertex {id: $end_id}))
        UNWIND nodes(path) as vertex
        RETURN vertex.id as id, vertex.x as x, vertex.y as y, vertex.z as z, vertex.typevertex as type
        """
        
        result = session.run(query, start_id=start_id, end_id=end_id)
        return [dict(record) for record in result]

def main():
    uri = "neo4j://localhost:7687"
    user = ""
    password = ""
    
    finder = PathFinder(uri, user, password)
    try:
        with finder.driver.session() as session:
            start_id = int(input("ID du point de départ : "))
            end_id = int(input("ID du point d'arrivée : "))
            
            path = finder.find_shortest_path(session, start_id, end_id)
            if path:
                print("Chemin trouvé :")
                for point in path:
                    print(f"Point {point['id']} ({point['type']}) : ({point['x']}, {point['y']}, {point['z']})")
            else:
                print("Aucun chemin trouvé")
                
    finally:
        finder.close()

if __name__ == "__main__":
    main()