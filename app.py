from flask import Flask, render_template, jsonify, request
import mysql.connector

app = Flask(__name__)

# Configuración de la base de datos
db_config = {
    'host': 'localhost',
    'user': 'tu_usuario',
    'password': 'tu_contraseña',
    'database': 'tu_base_de_datos'
}

# Ruta principal
@app.route('/')
def index():
    return render_template('index.html')

# Obtener productos con stock por sucursal
@app.route('/api/productos', methods=['GET'])
def obtener_productos():
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT 
            p.id AS producto_id,
            p.codigo AS codigo_producto,
            p.nombre AS nombre_producto,
            p.precio AS precio,
            s.id AS sucursal_id,
            s.nombre AS nombre_sucursal,
            ss.stock AS stock
        FROM productos p
        JOIN stock_sucursal ss ON p.id = ss.id_producto
        JOIN sucursales s ON ss.id_sucursal = s.id
        ORDER BY p.id, s.id
    """)
    
    data = cursor.fetchall()
    cursor.close()
    conn.close()
    
    return jsonify(data)

# Disminuir stock de un producto
@app.route('/api/vender', methods=['POST'])
def vender():
    data = request.json
    producto_id = data['producto_id']
    sucursal_id = data['sucursal_id']
    cantidad = data['cantidad']
    
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()

    # Verificar stock
    cursor.execute("SELECT stock FROM stock_sucursal WHERE id_sucursal=%s AND id_producto=%s", (sucursal_id, producto_id))
    result = cursor.fetchone()
    
    if not result or result[0] < cantidad:
        return jsonify({'success': False, 'mensaje': 'Stock insuficiente'}), 400
    
    # Disminuir stock
    cursor.execute("""
        UPDATE stock_sucursal SET stock = stock - %s 
        WHERE id_sucursal = %s AND id_producto = %s
    """, (cantidad, sucursal_id, producto_id))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True)
