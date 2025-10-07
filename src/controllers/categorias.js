const axios = require('axios');
const Categoria = require('../models/Categoria'); // Ajusta la ruta a tu modelo
const Producto = require('../models/producto');

// Crear solo las categorías desde el endpoint externo
const crearCategoriasDesdeCasagri = async () => {
  try {
    // Llamada al API externo
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

    const categoriasAPI = response.data.Categorias;

    if (!Array.isArray(categoriasAPI)) {
      console.warn('No se recibieron categorías en la respuesta.');
      return;
    }

    // Mapear categorías
    const categorias = categoriasAPI.map((cat) => ({
      Id: cat.Id,
      IdApi: cat.IdApi,
      Nombre: cat.Nombre,
      Nivel: cat.Nivel || 1,
      ImagenUrl: cat.ImagenUrl || '',
      ModificadoFecha: cat.ModificadoFecha || '',
    }));

    // Guardar en MongoDB
    await Categoria.insertMany(categorias);

    console.log('Categorías guardadas en la base de datos ✅');
  } catch (error) {
    console.error('Error al obtener o guardar categorías:', error.message);
  }
};



// Obtener productos por nombre de categoría (paginado + filtros)
const obtenerProductosPorCategoriaNombre = async (req, res) => {
  try {
    const { page, limit, orderBy, marca, componente } = req.query;
    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 16;

    const { nombre } = req.params; // ej: "MEDICINA VETERINARIA"

    // ======================
    // 1. Buscar la categoría
    // ======================
    const categoria = await Categoria.findOne({ Nombre: nombre });

    if (!categoria) {
      return res.status(404).json({ msg: "Categoría no encontrada" });
    }

    const categoriaId = categoria.Id;

    // ======================
    // 2. Índice inicial
    // ======================
    const startIndex = (pageNumber - 1) * limitNumber;

    // ======================
    // 3. Ordenamiento dinámico
    // ======================
    let sorting = { Nombre: 1 }; // ascendente por defecto
    if (orderBy === "desc") {
      sorting = { Nombre: -1 };
    }
    if (orderBy === "marca") {
      sorting = { Marca: 1 };
    }

    // ======================
    // 4. Construcción de filtros
    // ======================
    let filters = {
      $or: [
        { Categorizacion1Id: categoriaId },
        { Categorizacion2Id: categoriaId },
        { Categorizacion3Id: categoriaId },
        { Categorizacion4Id: categoriaId },
        { Categorizacion5Id: categoriaId },
      ],
    };

    // Filtro por marca
    if (marca && marca !== "si" && marca !== "null") {
      filters.Marca = marca;
    }
    if (marca === "null") {
      filters.Marca = { $in: [null, ""] };
    }

    // Filtro por componente (ejemplo usando Categorizacion4Id)
    if (componente && componente !== "null") {
      filters.Categorizacion4Id = parseInt(componente);
    }
    if (componente === "null") {
      filters.Categorizacion4Id = { $in: [null, 0] };
    }

    // ======================
    // 5. Consultas en paralelo
    // ======================
    const [total, productos] = await Promise.all([
      Producto.countDocuments(filters),
      Producto.find(filters)
        .sort(sorting)
        .skip(startIndex)
        .limit(limitNumber),
    ]);

    // ======================
    // 6. Distinct marcas
    // ======================
    const marcas = await Producto.distinct("Marca", {
      $or: [
        { Categorizacion1Id: categoriaId },
        { Categorizacion2Id: categoriaId },
        { Categorizacion3Id: categoriaId },
        { Categorizacion4Id: categoriaId },
        { Categorizacion5Id: categoriaId },
      ],
    });
    const marcasArray = marcas.map((m) => ({ Marca: m }));

    // ======================
    // 7. Distinct componentes (cat4)
    // ======================
    const componentes = await Producto.distinct("Categorizacion4Id", {
      $or: [
        { Categorizacion1Id: categoriaId },
        { Categorizacion2Id: categoriaId },
        { Categorizacion3Id: categoriaId },
        { Categorizacion4Id: categoriaId },
        { Categorizacion5Id: categoriaId },
      ],
    });
    const componentesArray = componentes.map((c) => ({ Categorizacion4Id: c }));

    // ======================
    // 8. Total de páginas
    // ======================
    const totalPages = Math.ceil(total / limitNumber);

    // ======================
    // 9. Respuesta
    // ======================
    res.status(200).json({
      categoria: categoria.Nombre,
      total,
      totalPages,
      currentPage: pageNumber,
      productos,
      marcas: marcasArray,
      componentes: componentesArray,
    });
  } catch (error) {
    console.error("Error al obtener productos por categoría:", error.message);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};


const obtenerCategorias = async (req, res = response) => {
  try {
    const categorias = await Categoria.find({
      Nivel: { $in: [1, 2, 3, 4] }
    }).sort({ Nivel: 1 });

    // Eliminar duplicados por Nombre
    const categoriasUnicas = [];
    const nombresVistos = new Set();

    for (const cat of categorias) {
      if (!nombresVistos.has(cat.Nombre)) {
        nombresVistos.add(cat.Nombre);
        categoriasUnicas.push(cat);
      }
    }

    res.json({
      total: categoriasUnicas.length,
      categorias: categoriasUnicas
    });
  } catch (error) {
    console.error('Error al obtener las categorías:', error.message);
    res.status(500).json({
      msg: 'Error al obtener las categorías'
    });
  }
};



module.exports = { crearCategoriasDesdeCasagri, obtenerProductosPorCategoriaNombre, obtenerCategorias };
