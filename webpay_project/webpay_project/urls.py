from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse

def home(request):
    return HttpResponse("Bienvenido a la integración de Webpay!")

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('webpay_api.urls')),
    path('', home), #Ruta raiz para http://127.0.0.1:8000/
]
