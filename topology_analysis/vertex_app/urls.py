from django.urls import path
from . import views

app_name = 'vertex_app'

urlpatterns = [
    path('', views.index, name='index'),
    path('get-saddle-thalwegs/', views.get_saddle_thalwegs, name='get_saddle_thalwegs'),
]