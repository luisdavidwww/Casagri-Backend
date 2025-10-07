const axios = require('axios');
const Producto = require('../models/producto'); // Tu modelo actualizado
const Categoria = require('../models/Categoria'); // Tu modelo actualizado

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

// Obtener productos por nombre de categoría (paginado + filtros)
const obtenerProductosPorCategoriaNombre= async (req, res) => {
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
      filters.Etiquetas = componente;
    }
    if (componente === "null") {
      filters.Etiquetas = { $in: [null, 0] };
    }

    // ======================
    // 5. Consultas en paralelo
    // ======================
    const [total, productos] = await Promise.all([
      Producto.countDocuments(filters),
      Producto.find(filters)
        .select("Id IdApi Codigo Nombre Nombre_interno Descripcion Categorizacion1Id Categorizacion2Id Categorizacion3Id Categorizacion4Id Categorizacion5Id StockActual ImagenUrl Etiquetas Marca")
        .sort(sorting)
        .skip(startIndex)
        .limit(limitNumber)

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
    const componentes = await Producto.distinct("Etiquetas", {
      $or: [
        { Categorizacion1Id: categoriaId },
        { Categorizacion2Id: categoriaId },
        { Categorizacion3Id: categoriaId },
        { Categorizacion4Id: categoriaId },
        { Categorizacion5Id: categoriaId },
      ],
    });
    const componentesArray = componentes.map((c) => ({ Etiquetas: c }));

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


// Obtener productos por nombre de categoría (paginado + filtros)
const obtenerProductosPECUARIA = async (req, res) => {
  try {
    const { page, limit, orderBy, marca, componente } = req.query;
    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 16;
    const startIndex = (pageNumber - 1) * limitNumber;

    // 1. Buscar categorías relevantes
    const categorias = await Categoria.find({
      Nombre: { $in: ["MEDICINA VETERINARIA", "GANADERIA", "MASCOTAS"] }
    });
    

    if (!categorias || categorias.length === 0) {
      return res.status(404).json({ msg: "Categorías no encontradas" });
    }

    const categoriaIds = categorias.map(cat => cat.Id);

    // 2. Construcción de filtros
    const filters = {
      $or: [
        { Categorizacion1Id: { $in: categoriaIds } },
        { Categorizacion2Id: { $in: categoriaIds } },
        { Categorizacion3Id: { $in: categoriaIds } },
        { Categorizacion4Id: { $in: categoriaIds } },
        { Categorizacion5Id: { $in: categoriaIds } },
      ],
    };

    if (marca && marca !== "si" && marca !== "null") {
      filters.Marca = marca;
    }
    if (marca === "null") {
      filters.Marca = { $in: [null, ""] };
    }

    if (componente && componente !== "null") {
      filters.Etiquetas = componente;
    }
    if (componente === "null") {
      filters.Etiquetas = { $in: [null, 0] };
    }

    // 3. Ordenamiento dinámico
    let sorting = { Nombre: 1 };
    if (orderBy === "desc") sorting = { Nombre: -1 };
    if (orderBy === "marca") sorting = { Marca: 1 };

    // 4. Consultas en paralelo
    const [total, productos] = await Promise.all([
      Producto.countDocuments(filters),
      Producto.find(filters)
        .select("Id IdApi Codigo Nombre Nombre_interno Descripcion Categorizacion1Id Categorizacion2Id Categorizacion3Id Categorizacion4Id Categorizacion5Id StockActual ImagenUrl Etiquetas Marca")
        .sort(sorting)
        .skip(startIndex)
        .limit(limitNumber)
    ]);

    // 5. Marcas y componentes
    const marcas = await Producto.distinct("Marca", { $or: filters.$or });
    const componentes = await Producto.distinct("Etiquetas", { $or: filters.$or });

    // 6. Total de páginas
    const totalPages = Math.ceil(total / limitNumber);

    // 7. Respuesta
    res.status(200).json({
      //categorias: categorias.map(cat => ({ Id: cat.Id, Nombre: cat.Nombre })),
      total,
      totalPages,
      currentPage: pageNumber,
      productos,
      marcas: marcas.map(m => ({ Marca: m })),
      componentes: componentes.map(c => ({ Etiquetas: c })),
    });
  } catch (error) {
    console.error("Error al obtener productos PECUARIA:", error.message);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

// Obtener productos por nombre de categoría (paginado + filtros)
const obtenerProductosPorCategoriaNombreOld  = async (req, res) => {
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
    // 5.5. Enriquecer productos con nombres de categorías
    // ======================
    const categoriaIdsSet = new Set();
    productos.forEach(prod => {
      [
        prod.Categorizacion1Id,
        prod.Categorizacion2Id,
        prod.Categorizacion3Id,
        prod.Categorizacion4Id,
        prod.Categorizacion5Id
      ]
        .filter(id => id && id !== 0)
        .forEach(id => categoriaIdsSet.add(id));
    });
    const categoriaIds = Array.from(categoriaIdsSet);

    const categoriasRelacionadas = await Categoria.find({ Id: { $in: categoriaIds } });
    const categoriasMap = {};
    categoriasRelacionadas.forEach(cat => {
      categoriasMap[cat.Id] = cat.Nombre;
    });

    const productosEnriquecidos = productos.map(prod => ({
      ...prod._doc,
      Categorizacion1Nombre: categoriasMap[prod.Categorizacion1Id] || null,
      Categorizacion2Nombre: categoriasMap[prod.Categorizacion2Id] || null,
      Categorizacion3Nombre: categoriasMap[prod.Categorizacion3Id] || null,
      Categorizacion4Nombre: categoriasMap[prod.Categorizacion4Id] || null,
      Categorizacion5Nombre: categoriasMap[prod.Categorizacion5Id] || null,
    }));

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
    // 7. Distinct componentes (Etiquetas)
    // ======================
    const componentes = await Producto.distinct("Etiquetas", {
      $or: [
        { Categorizacion1Id: categoriaId },
        { Categorizacion2Id: categoriaId },
        { Categorizacion3Id: categoriaId },
        { Categorizacion4Id: categoriaId },
        { Categorizacion5Id: categoriaId },
      ],
    });
    const componentesArray = componentes.map((c) => ({ Etiquetas: c }));

    // ======================
    // 8. Total de páginas
    // ======================
    const totalPages = Math.ceil(total / limitNumber);

    // ======================
    // 9. Respuesta
    // ======================
    res.status(200).json({
      //categoria: categoria.Nombre,
      total,
      totalPages,
      currentPage: pageNumber,
      productos: productosEnriquecidos,
      marcas: marcasArray,
      componentes: componentesArray,
    });
  } catch (error) {
    console.error("Error al obtener productos por categoría:", error.message);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};


//Obtener Todos los Productos Casagri
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


const obtenerSubcategoriasPorNivel = async (req, res) => {
  try {
    const { nombre } = req.params;

    // 1. Buscar la categoría principal
    const categoriaPrincipal = await Categoria.findOne({ Nombre: nombre });
    if (!categoriaPrincipal) {
      return res.status(404).json({ msg: "Categoría no encontrada" });
    }

    const categoriaId = categoriaPrincipal.Id;

    // 2. Buscar productos relacionados con esa categoría en cualquier nivel
    const productos = await Producto.find({
      $or: [
        { Categorizacion1Id: categoriaId },
        { Categorizacion2Id: categoriaId },
        { Categorizacion3Id: categoriaId },
        { Categorizacion4Id: categoriaId },
        { Categorizacion5Id: categoriaId },
      ],
    });

    // 3. Extraer IDs únicos por nivel
    const niveles = {
      Categorizacion1Id: new Set(),
      Categorizacion2Id: new Set(),
      Categorizacion3Id: new Set(),
      Categorizacion4Id: new Set(),
      Categorizacion5Id: new Set(),
    };

    productos.forEach(prod => {
      Object.keys(niveles).forEach(nivel => {
        const id = prod[nivel];
        if (id && id !== 0 && id !== categoriaId) {
          niveles[nivel].add(id);
        }
      });
    });

    // 4. Buscar nombres de subcategorías por nivel
    const resultado = {};

    for (const [nivel, idSet] of Object.entries(niveles)) {
      const ids = Array.from(idSet);
      const subcategorias = await Categoria.find({ Id: { $in: ids } }).sort({ Nombre: 1 });
      resultado[nivel] = subcategorias.map(cat => ({
        Id: cat.Id,
        Nombre: cat.Nombre,
        Nivel: cat.Nivel,
      }));
    }

    // 5. Respuesta
    res.status(200).json({
      categoriaPrincipal: {
        Id: categoriaPrincipal.Id,
        Nombre: categoriaPrincipal.Nombre,
        Nivel: categoriaPrincipal.Nivel,
      },
      subcategorias: resultado,
    });
  } catch (error) {
    console.error("Error al obtener subcategorías:", error.message);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};



module.exports = { crearProductosDesdeCasagri, obtenerProductos, obtenerProductosPorCategoriaNombre, obtenerSubcategoriasPorNivel, obtenerProductosPECUARIA };
