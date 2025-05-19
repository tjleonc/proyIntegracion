from flask import Flask, jsonify, request, Response, render_template
from flask_mysqldb import MySQL
from config import config
import time

app = Flask(__name__)
app.config.from_object(config['development'])
mysql = MySQL(app)

@app.route('/')
def index():
    return render_template('index.html')

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

@app.route('/api/ventas', methods=['POST'])
def crear_venta():
    data = request.json
    try:
        cursor = mysql.connection.cursor()
        cursor.execute("""
            SELECT stock FROM stock_sucursal
            WHERE id_producto = %s AND id_sucursal = %s
        """, (data['producto_id'], data['sucursal_id']))
        
        stock = cursor.fetchone()
        if not stock or stock['stock'] < data['cantidad']:
            return jsonify({
                'success': False,
                'mensaje': f'Stock insuficiente. Disponible: {stock["stock"] if stock else 0}'
            }), 400
        
        cursor.execute("""
            UPDATE stock_sucursal
            SET stock = stock - %s
            WHERE id_producto = %s AND id_sucursal = %s
        """, (data['cantidad'], data['producto_id'], data['sucursal_id']))
        
        mysql.connection.commit()
        return jsonify({'success': True})
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