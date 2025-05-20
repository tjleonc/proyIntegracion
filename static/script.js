let productosEncontrados = [];
let carrito = [];
let tipoCambioUSD = 850; // Valor por defecto
let eventSourceStock;

// Obtener tipo de cambio al cargar la página
async function obtenerTipoCambio() {
    try {
        const response = await fetch('https://mindicador.cl/api/dolar');
        const data = await response.json();
        tipoCambioUSD = data.serie[0].valor;
        console.log(`Tipo de cambio USD: $${tipoCambioUSD}`);
    } catch (error) {
        console.error("Error al obtener tipo de cambio:", error);
        mostrarNotificacion("No se pudo obtener el tipo de cambio. Usando valor por defecto.", "warning");
    }
}

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

        productosEncontrados = await res.json();
        mostrarResultados(productosEncontrados);
    } catch (error) {
        mostrarNotificacion(error.message, 'danger');
    }
}

// Mostrar resultados de búsqueda
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
        productoDiv.className = 'card mb-3 producto-card';
        productoDiv.innerHTML = `
            <div class="card-header bg-light d-flex justify-content-between align-items-center">
                <h5 class="mb-0">${producto.nombre}</h5>
                <span class="badge bg-primary">$${producto.precio.toFixed(2)}</span>
            </div>
            <div class="card-body">
                <h6 class="card-subtitle mb-2 text-muted">Disponible en:</h6>
                ${producto.sucursales.map(sucursal => `
                    <div class="sucursal-item mb-2 p-2 border rounded ${sucursal.stock <= 0 ? 'bg-light text-danger' : 'cursor-pointer hover-item'}" 
                         onclick="${sucursal.stock <= 0 ? '' : `mostrarModalAgregar(${producto.id}, '${producto.nombre.replace(/'/g, "\\'")}', ${producto.precio}, ${sucursal.id}, '${sucursal.nombre.replace(/'/g, "\\'")}', ${sucursal.stock})`}">
                        <div class="d-flex justify-content-between align-items-center">
                            <span><i class="bi bi-shop"></i> ${sucursal.nombre}</span>
                            <span class="badge ${sucursal.stock <= 0 ? 'bg-danger' : 'bg-success'}">
                                ${sucursal.stock <= 0 ? '<i class="bi bi-exclamation-triangle"></i> Sin stock' : `Stock: ${sucursal.stock}`}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        contenedor.appendChild(productoDiv);
    });
}

// Mostrar modal para agregar al carrito
function mostrarModalAgregar(productoId, productoNombre, productoPrecio, sucursalId, sucursalNombre, stock) {
    document.getElementById('modalBody').innerHTML = `
        <p><strong>Producto:</strong> ${productoNombre}</p>
        <p><strong>Sucursal:</strong> ${sucursalNombre}</p>
        <p><strong>Stock disponible:</strong> ${stock}</p>
        <p><strong>Precio unitario:</strong> $${productoPrecio.toFixed(2)}</p>
        
        <div class="mb-3">
            <label for="cantidadModal" class="form-label">Cantidad:</label>
            <input type="number" id="cantidadModal" class="form-control" min="1" max="${stock}" value="1">
        </div>
    `;

    // Configurar el botón de agregar
    document.getElementById('btnAgregarModal').onclick = function () {
        const cantidad = parseInt(document.getElementById('cantidadModal').value);
        agregarAlCarrito(productoId, productoNombre, productoPrecio, sucursalId, sucursalNombre, stock, cantidad);
    };

    // Mostrar el modal
    const modal = new bootstrap.Modal(document.getElementById('modalAgregar'));
    modal.show();
}

// Agregar producto al carrito
function agregarAlCarrito(productoId, productoNombre, productoPrecio, sucursalId, sucursalNombre, stock, cantidad) {
    if (isNaN(cantidad) || cantidad <= 0) {
        mostrarNotificacion('Ingrese una cantidad válida', 'danger');
        return;
    }

    if (cantidad > stock) {
        mostrarNotificacion(`No hay suficiente stock. Disponible: ${stock}`, 'danger');
        return;
    }

    // Buscar si el producto ya está en el carrito
    const itemExistente = carrito.find(item =>
        item.productoId === productoId && item.sucursalId === sucursalId
    );

    if (itemExistente) {
        // Actualizar cantidad si ya existe
        const nuevaCantidad = itemExistente.cantidad + cantidad;
        if (nuevaCantidad > stock) {
            mostrarNotificacion(`No puedes agregar más de ${stock} unidades`, 'danger');
            return;
        }
        itemExistente.cantidad = nuevaCantidad;
    } else {
        // Agregar nuevo item al carrito
        carrito.push({
            productoId,
            productoNombre,
            productoPrecio,
            sucursalId,
            sucursalNombre,
            stock,
            cantidad
        });
    }

    // Cerrar modal y actualizar vista
    bootstrap.Modal.getInstance(document.getElementById('modalAgregar')).hide();
    mostrarNotificacion(`"${productoNombre}" agregado al carrito`, 'success');
    actualizarCarrito();
}

// Actualizar vista del carrito
function actualizarCarrito() {
    const contenedor = document.getElementById('carritoContenido');
    const btnFinalizar = document.getElementById('btnFinalizar');

    if (carrito.length === 0) {
        contenedor.innerHTML = '<p class="text-muted">No hay productos en el carrito</p>';
        btnFinalizar.disabled = true;
        actualizarTotales();
        return;
    }

    let html = '';
    carrito.forEach((item, index) => {
        const subtotal = item.productoPrecio * item.cantidad;
        html += `
            <div class="carrito-item mb-3 p-3 border rounded">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6>${item.productoNombre}</h6>
                        <p class="small text-muted mb-1">
                            <i class="bi bi-shop"></i> ${item.sucursalNombre}
                        </p>
                        <p class="mb-1">
                            <span class="badge bg-primary">$${item.productoPrecio.toFixed(2)} c/u</span>
                            <span class="badge bg-secondary mx-2">x${item.cantidad}</span>
                            <span class="badge bg-success">$${subtotal.toFixed(2)}</span>
                        </p>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="eliminarDelCarrito(${index})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
                <div class="d-flex align-items-center mt-2">
                    <button class="btn btn-sm btn-outline-secondary" onclick="modificarCantidad(${index}, -1)">
                        <i class="bi bi-dash"></i>
                    </button>
                    <input type="number" min="1" max="${item.stock}" value="${item.cantidad}" 
                           class="form-control form-control-sm mx-2 cantidad-input" style="width: 60px;"
                           onchange="actualizarItemCarrito(${index}, this.value)">
                    <button class="btn btn-sm btn-outline-secondary" onclick="modificarCantidad(${index}, 1)">
                        <i class="bi bi-plus"></i>
                    </button>
                </div>
            </div>
        `;
    });

    contenedor.innerHTML = html;
    btnFinalizar.disabled = false;
    actualizarTotales();
}

// Eliminar item del carrito
function eliminarDelCarrito(index) {
    const productoNombre = carrito[index].productoNombre;
    carrito.splice(index, 1);
    actualizarCarrito();
    mostrarNotificacion(`"${productoNombre}" eliminado del carrito`, 'info');
}

// Modificar cantidad de un item
function modificarCantidad(index, cambio) {
    const nuevaCantidad = carrito[index].cantidad + cambio;
    if (nuevaCantidad >= 1 && nuevaCantidad <= carrito[index].stock) {
        carrito[index].cantidad = nuevaCantidad;
        actualizarCarrito();
    }
}

// Actualizar cantidad desde input
function actualizarItemCarrito(index, nuevaCantidad) {
    nuevaCantidad = parseInt(nuevaCantidad);
    if (isNaN(nuevaCantidad) || nuevaCantidad < 1) {
        nuevaCantidad = 1;
    }

    if (nuevaCantidad > carrito[index].stock) {
        mostrarNotificacion(`No hay suficiente stock. Máximo: ${carrito[index].stock}`, 'danger');
        nuevaCantidad = carrito[index].stock;
    }

    carrito[index].cantidad = nuevaCantidad;
    actualizarCarrito();
}

// Actualizar totales del carrito
function actualizarTotales() {
    const subtotal = carrito.reduce((sum, item) => sum + (item.productoPrecio * item.cantidad), 0);
    const iva = subtotal * 0.19;
    const total = subtotal + iva;
    const totalUSD = (total / tipoCambioUSD).toFixed(2);

    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('iva').textContent = `$${iva.toFixed(2)}`;
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
    document.getElementById('totalUSD').textContent = `≈ $${totalUSD} USD`;
}

// Finalizar compra
async function finalizarCompra() {
    // Validar que hay items en el carrito
    if (carrito.length === 0) {
        mostrarNotificacion('El carrito está vacío', 'warning');
        return;
    }

    // Preparar los datos para la API
    const ventaData = {
        items: carrito.map(item => ({
            producto_id: item.productoId,
            nombre: item.productoNombre,
            sucursal_id: item.sucursalId,
            sucursal: item.sucursalNombre,
            cantidad: item.cantidad,
            precio_unitario: item.productoPrecio,
            stock: item.stock // Solo para referencia, el backend lo validará
        })),
        total: carrito.reduce((total, item) => total + (item.productoPrecio * item.cantidad), 0)
    };

    try {
        // Mostrar carga mientras se procesa
        const btnFinalizar = document.getElementById('btnFinalizar');
        btnFinalizar.disabled = true;
        btnFinalizar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...';

        // Llamar a la API
        const response = await fetch('/api/ventas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ventaData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.mensaje || 'Error al procesar la venta');
        }

        // Éxito - mostrar resultados
        mostrarNotificacion(`Venta procesada con éxito! Total: $${data.total_pesos.toFixed(2)} ($${data.total_usd} USD)`, 'success');
        
        // Limpiar carrito
        carrito = [];
        actualizarCarrito();

        // Opcional: recargar datos de productos
        if (productosEncontrados.length > 0) {
            buscarProducto();
        }

    } catch (error) {
        mostrarNotificacion(error.message, 'danger');
        console.error('Error al finalizar compra:', error);
    } finally {
        // Restaurar botón
        const btnFinalizar = document.getElementById('btnFinalizar');
        btnFinalizar.disabled = false;
        btnFinalizar.innerHTML = '<i class="bi bi-check-circle"></i> Finalizar Compra';
    }
}
// Mostrar notificaciones
function mostrarNotificacion(mensaje, tipo = 'info') {
    const iconos = {
        'success': 'bi-check-circle',
        'danger': 'bi-exclamation-triangle',
        'warning': 'bi-exclamation-circle',
        'info': 'bi-info-circle'
    };

    const notificacion = document.createElement('div');
    notificacion.className = `alert alert-${tipo} alert-dismissible fade show`;
    notificacion.innerHTML = `
        <i class="bi ${iconos[tipo]}"></i> ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.getElementById('notificaciones').prepend(notificacion);

    setTimeout(() => {
        notificacion.classList.remove('show');
        setTimeout(() => notificacion.remove(), 150);
    }, 5000);
}

// Función para iniciar la conexión SSE
function iniciarConexionSSE() {
    // Cerrar conexión existente si hay una
    if (eventSourceStock) {
        eventSourceStock.close();
    }

    // Crear nueva conexión SSE
    eventSourceStock = new EventSource('/api/eventos-stock');

    // Manejador para mensajes recibidos
    eventSourceStock.onmessage = function(event) {
        console.log('Evento de stock recibido:', event.data);
        mostrarNotificacion(event.data, 'warning');
        
        // Opcional: actualizar la búsqueda si hay productos visibles
        if (productosEncontrados.length > 0) {
            buscarProducto(); // Esto refrescará los datos de stock
        }
    };

    // Manejador de errores
    eventSourceStock.onerror = function(error) {
        console.error('Error en conexión SSE:', error);
        
        // Intentar reconectar después de 5 segundos
        setTimeout(iniciarConexionSSE, 5000);
    };
}

// Modifica el DOMContentLoaded para iniciar la conexión SSE
document.addEventListener('DOMContentLoaded', () => {
    obtenerTipoCambio();
    iniciarConexionSSE();  // <-- Agrega esta línea
    
    // Buscar al presionar Enter
    document.getElementById('buscarInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarProducto();
    });
});

async function iniciarPagoTransbank(total) {
    try {
        const response = await fetch('/api/pago/transbank/iniciar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                monto: total,
                ordenCompra: `ORD-${Date.now()}`,
                sesionId: `SES-${Math.random().toString(36).substr(2, 9)}`
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Error al iniciar pago');
        }
        
        // Redirigir a Transbank
        window.location.href = data.url;
        
    } catch (error) {
        console.error('Error en pago Transbank:', error);
        mostrarNotificacion(`Error en pago: ${error.message}`, 'danger');
    }
}