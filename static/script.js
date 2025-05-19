let productos = [];
let productoSeleccionado = null;

async function cargarDatos() {
  const res = await fetch('/api/productos');
  const data = await res.json();
  productos = agruparProductos(data);

  const productoSelect = document.getElementById('productoSelect');
  productoSelect.innerHTML = productos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
  productoSelect.addEventListener('change', actualizarSucursales);

  actualizarSucursales();
}

function agruparProductos(data) {
  const map = new Map();

  data.forEach(row => {
    if (!map.has(row.producto_id)) {
      map.set(row.producto_id, {
        id: row.producto_id,
        nombre: row.nombre_producto,
        precio: row.precio,
        sucursales: []
      });
    }

    map.get(row.producto_id).sucursales.push({
      id: row.sucursal_id,
      nombre: row.nombre_sucursal,
      stock: row.stock
    });
  });

  return Array.from(map.values());
}

function actualizarSucursales() {
  const productoId = parseInt(document.getElementById('productoSelect').value);
  const producto = productos.find(p => p.id === productoId);
  productoSeleccionado = producto;

  const sucursalSelect = document.getElementById('sucursalSelect');
  sucursalSelect.innerHTML = producto.sucursales.map(s =>
    `<option value="${s.id}">${s.nombre} - Stock: ${s.stock}</option>`
  ).join('');
}

async function realizarVenta() {
  const productoId = parseInt(document.getElementById('productoSelect').value);
  const sucursalId = parseInt(document.getElementById('sucursalSelect').value);
  const cantidad = parseInt(document.getElementById('cantidadInput').value);

  const res = await fetch('/api/vender', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ producto_id: productoId, sucursal_id: sucursalId, cantidad: cantidad })
  });

  const mensaje = document.getElementById('mensaje');
  if (res.ok) {
    mensaje.className = 'success';
    mensaje.textContent = 'Venta realizada correctamente';
    await cargarDatos(); // actualizar stock
  } else {
    const error = await res.json();
    mensaje.className = 'error';
    mensaje.textContent = error.mensaje;
  }
}

window.onload = cargarDatos;
