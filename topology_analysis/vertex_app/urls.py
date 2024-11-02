from django.urls import path
from . import views

app_name = 'vertex_app'

urlpatterns = [
    path('', views.index, name='index'),
    path('test-db/', views.test_db_connection, name='test_db_connection'),
    path('get-vertices/', views.get_all_vertices, name='get_vertices'),
    path('api/query/', views.execute_query, name='execute_query'),
    path('create-test-data/', views.create_test_data, name='create_test_data'),  # Add this line
]