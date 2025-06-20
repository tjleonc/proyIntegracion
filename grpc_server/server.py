import grpc
from concurrent import futures
import mysql.connector
import os
import sys
import grpc

#from grpc_server.protos import product_pb2, product_pb2_grpc
import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "protos")))
import product_pb2
import product_pb2_grpc

class ProductService(product_pb2_grpc.ProductServiceServicer):
    def AddProduct(self, request, context):
        if not request.codigo or not request.nombre or request.precio < 0 or not request.imagen:
            return product_pb2.Response(message="Campos inválidos", success=False)
        
        try:
            conn = mysql.connector.connect(
                host='localhost',
                user='root',
                password='',
                database='sucursalesapi'
            )
            cursor = conn.cursor()

            query = """
                INSERT INTO productos (codigo, nombre, precio, imagen)
                VALUES (%s, %s, %s, %s)
            """
            cursor.execute(query, (
                request.codigo,
                request.nombre,
                request.precio,
                request.imagen  # tipo: bytes
            ))
            conn.commit()
            return product_pb2.Response(message="Producto guardado correctamente", success=True)
        except mysql.connector.IntegrityError as e:
            return product_pb2.Response(message=f"Error: {str(e)}", success=False)
        except Exception as e:
            return product_pb2.Response(message=f"Error inesperado: {str(e)}", success=False)
        finally:
            if conn.is_connected():
                cursor.close()
                conn.close()
    
def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    product_pb2_grpc.add_ProductServiceServicer_to_server(ProductService(), server)
    server.add_insecure_port('[::]:50051')
    print("Servidor gRPC corriendo en puerto 50051...")
    server.start()
    server.wait_for_termination()

if __name__ == '__main__':
    serve()
