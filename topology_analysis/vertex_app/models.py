from django.db import models

# Create your models here.
from neomodel import (
    StructuredNode, 
    StringProperty, 
    IntegerProperty, 
    FloatProperty,
    RelationshipTo, 
    RelationshipFrom,
    UniqueIdProperty
)

class Vertex(StructuredNode):
    """
    Node representing a vertex in the topology
    """
    uid = UniqueIdProperty()
    name = StringProperty(unique_index=True)
    latitude = FloatProperty()
    longitude = FloatProperty()
    # Add relationship to other vertices
    connected_to = RelationshipTo('Vertex', 'CONNECTS_TO')
    
    def to_dict(self):
        """
        Convert node to dictionary for JSON serialization
        """
        return {
            'uid': self.uid,
            'name': self.name,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'connections': [
                {
                    'name': connection.name,
                    'latitude': connection.latitude,
                    'longitude': connection.longitude
                } for connection in self.connected_to.all()
            ]
        }

    @classmethod
    def get_all_vertices(cls):
        """
        Get all vertices with their connections
        """
        return [vertex.to_dict() for vertex in cls.nodes.all()]

    @classmethod
    def get_vertex_by_name(cls, name):
        """
        Get a specific vertex by name
        """
        try:
            vertex = cls.nodes.get(name=name)
            return vertex.to_dict()
        except cls.DoesNotExist:
            return None