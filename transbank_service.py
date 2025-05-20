from transbank.webpay.webpay_plus.transaction import Transaction, WebpayOptions
from transbank.common.integration_type import IntegrationType
from flask import current_app as app

class TransbankService:
    def __init__(self):
        self.commerce_code = "597055555532"  # Código de comercio de prueba
        self.api_key = "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C"  # API Key de prueba
        self.integration_type = IntegrationType.TEST
        
        self.tx = Transaction(WebpayOptions(
            commerce_code=self.commerce_code,
            api_key=self.api_key,
            integration_type=self.integration_type
        ))
    
    def create_transaction(self, buy_order, session_id, amount, return_url):
        try:
            response = self.tx.create(
                buy_order=buy_order,
                session_id=session_id,
                amount=amount,
                return_url=return_url
            )
            return response
        except Exception as e:
            app.logger.error(f"Error creating Transbank transaction: {str(e)}")
            raise

    def commit_transaction(self, token):
        try:
            response = self.tx.commit(token=token)
            return response
        except Exception as e:
            app.logger.error(f"Error committing Transbank transaction: {str(e)}")
            raise