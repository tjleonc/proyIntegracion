from flask import Flask, jsonify, request, Response, render_template
from flask_mysqldb import MySQL
from config import config
import time
import requests

app = Flask(__name__)
app.config.from_object(config['development'])
mysql = MySQL(app)

@app.route('/')
def index():
    return render_template('index.html')

def obtener_tipo_cambio():
    try:
        response = requests.get('https://mindicador.cl/api/dolar')
        data = response.json()
        return data['serie'][0]['valor']
    except Exception as e:
        print(f"Error al obtener tipo de cambio: {str(e)}")
        return 850  # Valor por defecto si falla la API

# Endpoint para buscar productos
@app.route('/api/productos/buscar', methods=['GET'])
def buscar_productos():
    query = request.args.get('q', '')
    try:
        cursor = mysql.connection.cursor()
        cursor.execute("""
            SELECT p.id, p.nombre, p.precio, 
                s.id as sucursal_id, s.nombre as sucursal_nombre, ss.stock
            FROM productos p
            JOIN stock_sucursal ss ON p.id = ss.id_producto
            JOIN sucursales s ON ss.id_sucursal = s.id
            WHERE p.nombre LIKE %s AND s.nombre != 'Casa Matriz'
            ORDER BY p.nombre, s.nombre
        """, (f"%{query}%",))
        
        productos = {}
        for row in cursor.fetchall():
            if row['id'] not in productos:
                productos[row['id']] = {
                    'id': row['id'],
                    'nombre': row['nombre'],
                    'precio': float(row['precio']),
                    'sucursales': []
                }
            productos[row['id']]['sucursales'].append({
                'id': row['sucursal_id'],
                'nombre': row['sucursal_nombre'],
                'stock': row['stock']
            })
        
        return jsonify(list(productos.values()))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Endpoint para procesar venta
@app.route('/api/ventas', methods=['POST'])
def procesar_venta():
    data = request.json
    try:
        cursor = mysql.connection.cursor()
        
        # Verificar stock para cada item
        for item in data['items']:
            cursor.execute("""
                SELECT stock FROM stock_sucursal
                WHERE id_producto = %s AND id_sucursal = %s
                FOR UPDATE
            """, (item['producto_id'], item['sucursal_id']))
            
            stock = cursor.fetchone()
            if not stock or stock['stock'] < item['cantidad']:
                return jsonify({
                    'success': False,
                    'mensaje': f'Stock insuficiente para {item["nombre"]} en {item["sucursal"]}. Disponible: {stock["stock"] if stock else 0}'
                }), 400
        
        # Procesar cada venta
        for item in data['items']:
            cursor.execute("""
                UPDATE stock_sucursal
                SET stock = stock - %s
                WHERE id_producto = %s AND id_sucursal = %s
            """, (item['cantidad'], item['producto_id'], item['sucursal_id']))
            
            # Registrar la venta
            cursor.execute("""
                INSERT INTO ventas 
                (id_producto, id_sucursal, cantidad, precio_unitario, total, fecha)
                VALUES (%s, %s, %s, %s, %s, NOW())
            """, (
                item['producto_id'],
                item['sucursal_id'],
                item['cantidad'],
                item['precio_unitario'],
                item['precio_unitario'] * item['cantidad']
            ))
        
        mysql.connection.commit()
        
        # Obtener tipo de cambio actual
        tipo_cambio = obtener_tipo_cambio()
        total_usd = data['total'] / tipo_cambio
        
        return jsonify({
            'success': True,
            'total_pesos': data['total'],
            'total_usd': round(total_usd, 2),
            'tipo_cambio': tipo_cambio
        })
    except Exception as e:
        mysql.connection.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/eventos-stock')
def eventos_stock():
    def generar_eventos():
        with app.app_context():
            while True:
                try:
                    cursor = mysql.connection.cursor()
                    cursor.execute("""
                        SELECT p.nombre as producto, s.nombre as sucursal
                        FROM stock_sucursal ss
                        JOIN productos p ON ss.id_producto = p.id
                        JOIN sucursales s ON ss.id_sucursal = s.id
                        WHERE ss.stock = 0 AND s.nombre != 'Casa Matriz'
                    """)
                    for row in cursor:
                        yield f"data: Stock agotado en {row['sucursal']} para {row['producto']}\n\n"
                    time.sleep(10)
                except Exception as e:
                    print(f"Error SSE: {str(e)}")
                    time.sleep(5)
    
    return Response(generar_eventos(), mimetype='text/event-stream')



if __name__ == '__main__':
    app.run(debug=True)