let productoSeleccionado = null;
let sucursalSeleccionada = null;

// Configuración SSE mejorada
function iniciarConexionSSE() {
    if (typeof(EventSource) !== "undefined") {
        const eventSource = new EventSource('/api/eventos-stock');
        
        eventSource.onmessage = (e) => {
            mostrarNotificacion(`⚠️ ${e.data}`, 'warning');
        };
        
        eventSource.onerror = (e) => {
            console.error("Error en conexión SSE:", e);
            eventSource.close();
            
            // Reconectar después de 5 segundos
            setTimeout(iniciarConexionSSE, 5000);
        };
        
        // Guardar referencia para poder cerrarla si es necesario
        window.sseConnection = eventSource;
    } else {
        console.log("Tu navegador no soporta Server-Sent Events");
        mostrarNotificacion("Tu navegador no soporta notificaciones en tiempo real", "info");
    }
}

// Función para mostrar notificaciones mejorada
function mostrarNotificacion(mensaje, tipo = 'info') {
    const iconos = {
        'success': 'bi-check-circle-fill',
        'danger': 'bi-exclamation-triangle-fill',
        'warning': 'bi-exclamation-triangle-fill',
        'info': 'bi-info-circle-fill'
    };
    
    const notificacion = document.createElement('div');
    notificacion.className = `alert alert-${tipo} alert-dismissible fade show`;
    notificacion.role = "alert";
    notificacion.innerHTML = `
        <i class="bi ${iconos[tipo] || 'bi-info-circle-fill'}"></i>
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    const contenedor = document.getElementById('notificaciones');
    contenedor.prepend(notificacion);
    
    // Inicializar el tooltip de Bootstrap para que funcione el cierre
    const closeButton = notificacion.querySelector('.btn-close');
    closeButton.addEventListener('click', () => {
        notificacion.classList.remove('show');
        setTimeout(() => notificacion.remove(), 150);
    });
    
    // Configurar autoeliminación
    const tiempoVisible = tipo === 'warning' ? 10000 : 5000;
    setTimeout(() => {
        notificacion.classList.remove('show');
        setTimeout(() => notificacion.remove(), 150);
    }, tiempoVisible);
}

// Iniciar la conexión SSE al cargar la página
document.addEventListener('DOMContentLoaded', iniciarConexionSSE);

// Función para buscar productos
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

// Función para mostrar resultados de búsqueda
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

// Función para seleccionar un item
function seleccionarItem(producto, sucursal) {
    productoSeleccionado = producto;
    sucursalSeleccionada = sucursal;

    document.getElementById('resumenProducto').textContent = producto.nombre;
    document.getElementById('resumenSucursal').textContent = sucursal.nombre;
    document.getElementById('precioUnitario').textContent = `$${producto.precio.toFixed(2)}`;
    
    document.getElementById('resumenCompra').style.display = 'block';
    actualizarTotales();
}

// Función para actualizar totales
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

// Función para procesar pago con Transbank
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

// Event listener para búsqueda con Enter
document.getElementById('buscarInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') buscarProducto();
});