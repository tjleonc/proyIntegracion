from django.urls import path
from . import views

urlpatterns = [
    path('webpay/iniciar/', views.iniciar_pago, name='iniciar_pago'),  # Aquí da error
    path('webpay/retorno/', views.retorno_transaccion,name='retorno_pago'),
    # otras rutas...
]
