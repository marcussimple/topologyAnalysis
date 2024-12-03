from django.urls import path
from . import views

app_name = 'vertex_app'

urlpatterns = [
    path('', views.index, name='index'),
    path('get-vertices/', views.get_all_vertices, name='get_vertices'),
    path('api/query/', views.execute_query, name='execute_query'),
    path('get-thalwegs/', views.get_thalwegs, name='get_thalwegs'),
    path('get-vertex-thalwegs/', views.get_vertex_thalwegs, name='get_vertex_thalwegs'),
]