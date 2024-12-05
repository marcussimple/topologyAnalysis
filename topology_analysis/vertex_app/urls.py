from django.urls import path
from . import views

app_name = 'vertex_app'

urlpatterns = [
    path('', views.index, name='index'),
    path('get-saddle-thalwegs/', views.get_saddle_thalwegs, name='get_saddle_thalwegs'),
    path('get-maximum-cell/', views.get_maximum_cell, name='get-maximum-cell'),
]