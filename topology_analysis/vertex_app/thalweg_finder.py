from neo4j import GraphDatabase

class ThalwegFinder:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def calculate_slope(self, current, neighbor):
        """
        Calcule la pente entre deux points.
        """
        dx = neighbor["x"] - current["x"]
        dy = neighbor["y"] - current["y"]
        dz = neighbor["altitude"] - current["altitude"]
        
        distance = (dx * dx + dy * dy) ** 0.5
        if distance == 0:
            return 0
            
        if dz == 0:  # Même altitude
            if neighbor["x"] < current["x"]:
                return -0.000001
            elif neighbor["x"] > current["x"]:
                return 0.000001
            elif neighbor["y"] < current["y"]:
                return -0.000001
            else:
                return 0.000001
                
        return dz / distance

    def get_ordered_neighbors(self, session, saddle_id):
        """
        Récupère les voisins ordonnés par azimuth.
        """
        query = """
        MATCH (v:Vertex {id: $saddle_id})-[:CONNECTS]-(neighbor:Vertex)
        WITH v, neighbor,
             v.x AS v_x, v.y AS v_y,
             atan2(neighbor.y - v.y, neighbor.x - v.x) AS azimuth_raw
        WITH v, neighbor,
             CASE 
                WHEN azimuth_raw < 0 THEN azimuth_raw + 2 * pi()
                ELSE azimuth_raw
             END AS adjusted_azimuth
        RETURN neighbor.id AS id,
               neighbor.z AS altitude,
               neighbor.x AS x,
               neighbor.y AS y,
               neighbor.typevertex AS type,
               adjusted_azimuth AS azimuth,
               neighbor.isConfluence AS isConfluence
        ORDER BY adjusted_azimuth
        """
        return session.run(query, saddle_id=saddle_id).data()

    def get_neighbors(self, session, vertex_id):
        """
        Récupère tous les voisins d'un sommet.
        """
        query = """
        MATCH (v:Vertex {id: $vertex_id})-[:CONNECTS]-(neighbor:Vertex)
        RETURN neighbor.id AS id,
               neighbor.z AS altitude,
               neighbor.x AS x,
               neighbor.y AS y,
               neighbor.typevertex AS type,
               neighbor.isConfluence AS isConfluence
        """
        return session.run(query, {"vertex_id": vertex_id}).data()

    def get_sign(self, saddle, neighbor):
        """
        Détermine le signe pour un voisin selon sa position relative à la selle.
        """
        if neighbor["altitude"] < saddle["altitude"]:
            return "-"
        elif neighbor["altitude"] > saddle["altitude"]:
            return "+"
        elif neighbor["x"] < saddle["x"]:
            return "-"
        elif neighbor["x"] > saddle["x"]:
            return "+"
        elif neighbor["y"] < saddle["y"]:
            return "-"
        return "+"

    def find_descent_series(self, saddle, neighbors):
        """
        Identifie les séries de descente autour de la selle.
        """
        if not neighbors:
            return []
            
        neighbors_with_signs = [(n, self.get_sign(saddle, n)) for n in neighbors]
        descent_series = []
        current_series = []
        
        for i in range(len(neighbors_with_signs)):
            neighbor, sign = neighbors_with_signs[i]
            if sign == "-":
                current_series.append(neighbor)
            elif current_series:
                descent_series.append(current_series)
                current_series = []
        
        if current_series:
            if descent_series and neighbors_with_signs[0][1] == "-":
                descent_series[0] = current_series + descent_series[0]
            else:
                descent_series.append(current_series)

        return descent_series

    def find_thalweg_path(self, session, start_saddle, first_neighbor):
        """
        Suit un thalweg depuis son début jusqu'à sa fin.
        S'arrête uniquement sur un minimum ou un point de confluence marqué.
        Retourne le chemin et sa pente moyenne.
        """
        current = start_saddle
        path = [current]
        visited = set([current["id"]])
        next_vertex = first_neighbor

        while True:
            if next_vertex is None:
                neighbors = self.get_neighbors(session, current["id"])
                valid_neighbors = []

                for neighbor in neighbors:
                    if neighbor["id"] not in visited:
                        slope = self.calculate_slope(current, neighbor)
                        if slope < 0:  # Descente uniquement
                            valid_neighbors.append((neighbor, slope))

                if not valid_neighbors:
                    unvisited_neighbors = [n for n in neighbors if n["id"] not in visited]
                    if unvisited_neighbors:
                        lowest_neighbor = min(unvisited_neighbors, key=lambda n: n["altitude"])
                        if lowest_neighbor["altitude"] < current["altitude"]:
                            valid_neighbors.append((lowest_neighbor, self.calculate_slope(current, lowest_neighbor)))

                if not valid_neighbors:
                    return None

                next_vertex, _ = min(valid_neighbors, key=lambda x: x[1])

            # Vérifier si on a atteint un point d'arrêt valide
            is_confluence = next_vertex.get("isConfluence", False)
            is_minimum = next_vertex["type"] == "minimum"

            if is_confluence or is_minimum:
                path.append(next_vertex)
                # Calculer la pente moyenne du chemin complet
                total_distance = 0
                total_elevation = next_vertex["altitude"] - path[0]["altitude"]
                
                for i in range(len(path)-1):
                    dx = path[i+1]["x"] - path[i]["x"]
                    dy = path[i+1]["y"] - path[i]["y"]
                    total_distance += (dx * dx + dy * dy) ** 0.5
                
                average_slope = (total_elevation / total_distance) if total_distance > 0 else 0
                return path, average_slope
            elif next_vertex["type"] == "regular":
                path.append(next_vertex)
                current = next_vertex
                visited.add(current["id"])
                next_vertex = None
            else:
                return None

        return None

    def get_saddle_info(self, session, saddle_id):
        """
        Récupère les informations de la selle.
        """
        query = """
        MATCH (saddle:Vertex {id: $saddle_id})
        WHERE saddle.typevertex = "saddle"
        RETURN saddle.id AS saddle_id, 
               saddle.z AS altitude,
               saddle.x AS x, 
               saddle.y AS y,
               saddle.typevertex AS type
        """
        result = session.run(query, saddle_id=saddle_id).single()
        if not result:
            raise ValueError(f"Selle {saddle_id} non trouvée ou n'est pas une selle")
        return result

    def get_thalweg_paths(self, saddle_id):
            """
            Trouve tous les chemins de thalweg valides pour une selle spécifique.
            """
            with self.driver.session() as session:
                # Obtenir les informations de la selle
                saddle = self.get_saddle_info(session, saddle_id)
                if not saddle:
                    return None

                # Obtenir les voisins et trouver les séries de descente
                neighbors = self.get_ordered_neighbors(session, saddle_id)
                descent_series = self.find_descent_series(saddle, neighbors)

                # Générer les chemins de thalweg
                all_paths = []
                end_nodes = []
                for series in descent_series:
                    if len(series) == 1:
                        start_point = series[0]
                    else:
                        start_point = min(
                            series,
                            key=lambda n: self.calculate_slope(saddle, n)
                        )

                    saddle_dict = {
                        "id": saddle["saddle_id"],
                        "x": saddle["x"],
                        "y": saddle["y"],
                        "altitude": saddle["altitude"],
                        "type": saddle["type"]
                    }

                    path = self.find_thalweg_path(session, saddle_dict, start_point)
                    if path:
                        # Stocker le chemin et le point final
                        all_paths.append(path[1:])  # Exclure la selle du début du chemin
                        end_nodes.append(path[-1])  # Stocker le point final

                if not all_paths:
                    return None

                # Formater le résultat exactement comme attendu par la vue
                return {
                    "saddle": {
                        "identity": saddle["saddle_id"],
                        "labels": ["Vertex"],
                        "properties": {
                            "id": saddle["saddle_id"],
                            "x": saddle["x"],
                            "y": saddle["y"],
                            "z": saddle["altitude"],
                            "typevertex": saddle["type"]
                        },
                        "elementId": str(saddle["saddle_id"])
                    },
                    "paths": all_paths,
                    "ends": end_nodes
                }