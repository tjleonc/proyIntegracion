let productoSeleccionado = null;
let sucursalSeleccionada = null;

const eventSource = new EventSource('/api/eventos-stock');
eventSource.onmessage = (e) => {
    mostrarNotificacion(`⚠️ ${e.data}`, 'warning');
};

async function buscarProducto() {
    const query = document.getElementById('buscarInput').value.trim();
    if (!query) {
        mostrarNotificacion('Ingrese un término de búsqueda', 'danger');
        return;
    }

    try {
        const res = await fetch(`/api/productos/buscar?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error('Error en la búsqueda');
        
        const productos = await res.json();
        mostrarResultados(productos);
    } catch (error) {
        mostrarNotificacion(error.message, 'danger');
    }
}

function mostrarResultados(productos) {
    const contenedor = document.getElementById('resultadosBusqueda');
    contenedor.innerHTML = '';

    if (productos.length === 0) {
        contenedor.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle"></i> No se encontraron productos
            </div>
        `;
        return;
    }

    productos.forEach(producto => {
        const productoDiv = document.createElement('div');
        productoDiv.className = 'card mb-3';
        productoDiv.innerHTML = `
            <div class="card-header bg-light">
                <h5>${producto.nombre} - $${producto.precio.toFixed(2)}</h5>
            </div>
            <div class="card-body">
                <h6 class="card-subtitle mb-2 text-muted">Disponible en:</h6>
                ${producto.sucursales.map(sucursal => `
                    <div class="sucursal-item mb-2 p-2 border rounded ${sucursal.stock <= 0 ? 'bg-light text-danger' : 'cursor-pointer hover-item'}" 
                        onclick="${sucursal.stock <= 0 ? '' : `seleccionarItem(${JSON.stringify(producto)}, ${JSON.stringify(sucursal)})`}">
                        <div class="d-flex justify-content-between">
                            <span><i class="bi bi-shop"></i> ${sucursal.nombre}</span>
                            <span>Stock: ${sucursal.stock}</span>
                        </div>
                        ${sucursal.stock <= 0 ? '<span class="badge bg-danger ms-2"><i class="bi bi-exclamation-triangle"></i> Sin stock</span>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
        contenedor.appendChild(productoDiv);
    });
}

function seleccionarItem(producto, sucursal) {
    productoSeleccionado = producto;
    sucursalSeleccionada = sucursal;

    document.getElementById('resumenProducto').textContent = producto.nombre;
    document.getElementById('resumenSucursal').textContent = sucursal.nombre;
    document.getElementById('precioUnitario').textContent = `$${producto.precio.toFixed(2)}`;
    
    document.getElementById('resumenCompra').style.display = 'block';
    actualizarTotales();
}

function actualizarTotales() {
    const cantidad = parseInt(document.getElementById('cantidadInput').value) || 0;
    const precio = productoSeleccionado.precio;
    const subtotal = precio * cantidad;
    const iva = subtotal * 0.19;
    const total = subtotal + iva;

    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('iva').textContent = `$${iva.toFixed(2)}`;
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
}

async function pagarConTransbank() {
    const cantidad = parseInt(document.getElementById('cantidadInput').value);
    
    if (!cantidad || cantidad <= 0) {
        mostrarNotificacion('Ingrese una cantidad válida', 'danger');
        return;
    }

    try {

        const resVenta = await fetch('/api/ventas', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                producto_id: productoSeleccionado.id,
                sucursal_id: sucursalSeleccionada.id,
                cantidad: cantidad
            })
        });

        if (!resVenta.ok) {
            const error = await resVenta.json();
            throw new Error(error.mensaje || 'Error al procesar venta');
        }

        const total = parseFloat(document.getElementById('total').textContent.replace('$', ''));
        
        const resTransbank = await fetch('/api/transbank/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                amount: total,
                buyOrder: `ORD-${Date.now()}`,
                sessionId: `SESSION-${productoSeleccionado.id}`,
                returnUrl: window.location.href
            })
        });

        const data = await resTransbank.json();
        
        window.location.href = data.url;

    } catch (error) {
        mostrarNotificacion(error.message, 'danger');
        console.error('Error en pago:', error);
    }
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    const notificacion = document.createElement('div');
    notificacion.className = `alert alert-${tipo} alert-dismissible fade show`;
    notificacion.innerHTML = `
        <i class="bi ${tipo === 'success' ? 'bi-check-circle' : type === 'danger' ? 'bi-exclamation-triangle' : 'bi-info-circle'}"></i>
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.getElementById('notificaciones').prepend(notificacion);
    
    setTimeout(() => {
        notificacion.classList.remove('show');
        setTimeout(() => notificacion.remove(), 150);
    }, 5000);
}

document.getElementById('buscarInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') buscarProducto();
});