from django.urls import path
from . import views

app_name = 'vertex_app'

urlpatterns = [
    path('', views.index, name='index'),
    path('get-saddle-thalwegs/', views.get_saddle_thalwegs, name='get_saddle_thalwegs'),
    path('get-maximum-cell/', views.get_maximum_cell, name='get-maximum-cell'),
    path('get-neighbor-maximums/', views.get_neighbor_maximums, name='get_neighbor_maximums'),
    path('get-shortest-path/', views.get_shortest_path, name='get_shortest_path'),
    path('get-thalweg-slope/', views.get_thalweg_slope, name='get-thalweg-slope'),
]