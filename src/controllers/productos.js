const axios = require('axios');
const Producto = require('../models/producto'); // Tu modelo actualizado

// Crear todos los productos desde el endpoint externo
const crearProductosDesdeCasagri = async () => {
  try {
    // Hacer la petición al API externo
    const response = await axios.get('https://casagri.app/api/AppSalesProducto', {
      headers: {
        ServicePassword: '13878A7C15574C51BAFFDD67FCAB0F11',
        ServiceUser: 'iApps_Mobile',
        Username: 'sistemas2@casagri-group.com',
        Password: '123456',
        EmpresaId: '87',
        DispositivoGuid: 'phone',
      },
    });

    // Obtener solo la lista de productos
    const productosAPI = response.data.Productos;

    if (!Array.isArray(productosAPI)) {
      console.error('No se recibieron productos en la respuesta.');
      return;
    }

    const productos = productosAPI.map((item) => ({
      counter: item.Id,
      Id: item.Id,
      IdApi: item.IdAPI,
      Codigo: item.Codigo,
      CodigoFabricante: item.CodigoFabricante,
      CodigoEAN: item.CodigoEAN,
      Nombre: item.Nombre,
      Nombre_interno: item.Nombre.replace(/\s+/g, '-').replace(/%/g, '%25').replace(/[ /]/g, '_'),
      Descripcion: item.Descripcion || '',
      Categorizacion1Id: item.Categorizacion1Id,
      Categorizacion2Id: item.Categorizacion2Id,
      Categorizacion3Id: item.Categorizacion3Id,
      Categorizacion4Id: item.Categorizacion4Id,
      Categorizacion5Id: item.Categorizacion5Id,
      Peso: item.Peso,
      ManejaStock: item.ManejaStock,
      StockActual: item.StockActual || 0,
      StockMinimo: item.StockMinimo || 0,
      ManejaSuperficie: item.ManejaSuperficie,
      CantidadPermiteDecimales: item.CantidadPermiteDecimales,
      UnidadesPorEnvase: item.UnidadesPorEnvase,
      UnidadesPorPedido: item.UnidadesPorPedido,
      UnidadesMinimaVenta: item.UnidadesMinimaVenta,
      ImagenUrl: item.ImagenUrl,
      Etiquetas: item.Etiquetas,
      Marca: item.Marca,
      Publicado: item.Publicado,
      Descuento: item.Descuento,
      UnidadDeMedida: item.UnidadDeMedida || {},
    }));

    // Guardar en MongoDB
    await Producto.insertMany(productos);

    console.log('Productos guardados en la base de datos ✅');
  } catch (error) {
    console.error('Error al obtener o guardar productos:', error.message);
  }
};



const obtenerProductos = async (req, res = response) => {
  try {
    // Puedes agregar filtros o paginación más adelante
    const productos = await Producto.find();

    res.json({
      total: productos.length,
      productos
    });
  } catch (error) {
    console.error('Error al obtener los productos:', error.message);
    res.status(500).json({
      msg: 'Error al obtener los productos'
    });
  }
};



module.exports = { crearProductosDesdeCasagri, obtenerProductos };
