let productosEncontrados = [];
let carrito = [];
let tipoCambioUSD = 0;

// Obtener tipo de cambio al cargar la página
async function obtenerTipoCambio() {
    try {
        const response = await fetch('https://mindicador.cl/api/dolar');
        const data = await response.json();
        tipoCambioUSD = data.serie[0].valor;
        console.log(`Tipo de cambio USD: $${tipoCambioUSD}`);
    } catch (error) {
        console.error("Error al obtener tipo de cambio:", error);
        tipoCambioUSD = 850; // Valor por defecto si falla la API
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
function mostrarModalAgregar(producto, sucursal) {
    document.getElementById('modalBody').innerHTML = `
        <p><strong>Producto:</strong> ${producto.nombre}</p>
        <p><strong>Sucursal:</strong> ${sucursal.nombre}</p>
        <p><strong>Stock disponible:</strong> ${sucursal.stock}</p>
        <p><strong>Precio unitario:</strong> $${producto.precio.toFixed(2)}</p>
        
        <div class="mb-3">
            <label for="cantidadModal" class="form-label">Cantidad:</label>
            <input type="number" id="cantidadModal" class="form-control" min="1" max="${sucursal.stock}" value="1">
        </div>
    `;

    // Configurar el botón de agregar
    document.getElementById('btnAgregarModal').onclick = function() {
        agregarAlCarrito(producto, sucursal);
    };

    // Mostrar el modal
    const modal = new bootstrap.Modal(document.getElementById('modalAgregar'));
    modal.show();
}

// Modifica la función mostrarResultados así:
function mostrarResultados(productos) {
    const contenedor = document.getElementById('resultadosBusqueda');
    contenedor.innerHTML = '';

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
                         onclick="${sucursal.stock <= 0 ? '' : `mostrarModalAgregar(${JSON.stringify(producto)}, ${JSON.stringify(sucursal)})`}">
                        <div class="d-flex justify-content-between">
                            <span><i class="bi bi-shop"></i> ${sucursal.nombre}</span>
                            <span>Stock: ${sucursal.stock}</span>
                        </div>
                        ${sucursal.stock <= 0 ? '<span class="badge bg-danger ms-2">Sin stock</span>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
        contenedor.appendChild(productoDiv);
    });
}

// Modal para agregar al carrito
function mostrarModalAgregar(producto, sucursal) {
    const modalHTML = `
        <div class="modal fade" id="modalAgregar" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Agregar al carrito</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Producto:</strong> ${producto.nombre}</p>
                        <p><strong>Sucursal:</strong> ${sucursal.nombre}</p>
                        <p><strong>Stock disponible:</strong> ${sucursal.stock}</p>
                        <p><strong>Precio unitario:</strong> $${producto.precio.toFixed(2)}</p>
                        
                        <div class="mb-3">
                            <label for="cantidadModal" class="form-label">Cantidad:</label>
                            <input type="number" id="cantidadModal" class="form-control" min="1" max="${sucursal.stock}" value="1">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="agregarAlCarrito(${JSON.stringify(producto)}, ${JSON.stringify(sucursal)})">
                            <i class="bi bi-cart-plus"></i> Agregar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Eliminar modal existente si hay uno
    const modalExistente = document.getElementById('modalAgregar');
    if (modalExistente) {
        modalExistente.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('modalAgregar'));
    modal.show();
}

// Agregar producto al carrito
function agregarAlCarrito(producto, sucursal) {
    const cantidad = parseInt(document.getElementById('cantidadModal').value);
    
    if (isNaN(cantidad) || cantidad <= 0) {
        mostrarNotificacion('Ingrese una cantidad válida', 'danger');
        return;
    }
    
    if (cantidad > sucursal.stock) {
        mostrarNotificacion(`No hay suficiente stock. Disponible: ${sucursal.stock}`, 'danger');
        return;
    }
    
    // Buscar si el producto ya está en el carrito
    const itemExistente = carrito.find(item => 
        item.producto.id === producto.id && item.sucursal.id === sucursal.id
    );
    
    if (itemExistente) {
        // Actualizar cantidad si ya existe
        itemExistente.cantidad += cantidad;
        if (itemExistente.cantidad > sucursal.stock) {
            mostrarNotificacion(`No puedes agregar más de ${sucursal.stock} unidades`, 'danger');
            itemExistente.cantidad = sucursal.stock;
        }
    } else {
        // Agregar nuevo item al carrito
        carrito.push({
            producto: producto,
            sucursal: sucursal,
            cantidad: cantidad
        });
    }
    
    // Cerrar modal y actualizar vista
    bootstrap.Modal.getInstance(document.getElementById('modalAgregar')).hide();
    mostrarNotificacion(`Producto agregado al carrito`, 'success');
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
        const subtotal = item.producto.precio * item.cantidad;
        html += `
            <div class="carrito-item mb-3 p-3 border rounded">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6>${item.producto.nombre}</h6>
                        <p class="small text-muted mb-1">
                            <i class="bi bi-shop"></i> ${item.sucursal.nombre}
                        </p>
                        <p class="mb-1">
                            <span class="badge bg-primary">$${item.producto.precio.toFixed(2)} c/u</span>
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
                    <input type="number" min="1" max="${item.sucursal.stock}" value="${item.cantidad}" 
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
    carrito.splice(index, 1);
    actualizarCarrito();
    mostrarNotificacion('Producto eliminado del carrito', 'info');
}

// Modificar cantidad de un item
function modificarCantidad(index, cambio) {
    const nuevaCantidad = carrito[index].cantidad + cambio;
    if (nuevaCantidad >= 1 && nuevaCantidad <= carrito[index].sucursal.stock) {
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
    
    if (nuevaCantidad > carrito[index].sucursal.stock) {
        mostrarNotificacion(`No hay suficiente stock. Máximo: ${carrito[index].sucursal.stock}`, 'danger');
        nuevaCantidad = carrito[index].sucursal.stock;
    }
    
    carrito[index].cantidad = nuevaCantidad;
    actualizarCarrito();
}

// Actualizar totales del carrito
function actualizarTotales() {
    const subtotal = carrito.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);
    const iva = subtotal * 0.19;
    const total = subtotal + iva;
    const totalUSD = tipoCambioUSD > 0 ? (total / tipoCambioUSD).toFixed(2) : 0;
    
    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('iva').textContent = `$${iva.toFixed(2)}`;
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
    document.getElementById('totalUSD').textContent = `≈ $${totalUSD} USD`;
}

// Finalizar compra
function finalizarCompra() {
    // Aquí iría la lógica para procesar la compra
    mostrarNotificacion('Compra finalizada con éxito', 'success');
    carrito = [];
    actualizarCarrito();
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

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    obtenerTipoCambio();
    
    // Buscar al presionar Enter
    document.getElementById('buscarInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarProducto();
    });
});