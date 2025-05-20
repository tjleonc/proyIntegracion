from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from transbank.webpay.webpay_plus.transaction import Transaction, WebpayOptions
from transbank.common.integration_type import IntegrationType

#Confirguarion de webpay para prueba
options = WebpayOptions(
    commerce_code='597055555532',
    api_key='XNNzCw44CJG7n8z3qkGr5hSDdrp3Wz2N',
    integration_type=IntegrationType.TEST
)

tx = Transaction(options)

@csrf_exempt
def iniciar_pago(request):
    if request.method == 'POST':
        buy_order = 'orden123456'
        session_id = 'session123456' 
        amount = 10000 #Monto a cobrar
        return_url = 'http://localhost:8000/api/retorno/'  #URL donde webpay envia el resultado

        #Crea la transaccion en webpay
        response = tx.create(buy_order, session_id, amount, return_url)

        #Retorna URL y token para redirigir al usuario
        return JsonResponse({
            'url': response['url'],
            'token': response['token']
        })

    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def retorno_transaccion(request):
    if request.method == 'POST':
        token = request.POST.get("token_ws")
        
        #Confirma la transaccion con webpay
        response = tx.commit(token)
        
        #Retorna informacion relevante de transaccion
        return JsonResponse({
            'status': response['status'],
            'amount': response['amount'],
            'buy_order': response['buy_order'],
            'card_detail': response['card_detail'],
        })

    return JsonResponse({'error': 'Método no permitido'}, status=405)
