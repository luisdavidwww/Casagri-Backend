const axios = require('axios');
const Producto = require('../models/producto'); // Tu modelo actualizado
const Categoria = require('../models/Categoria'); // Tu modelo actualizado




const obtenerProductosPorCategoriaNombre = async (req, res) => {
  try {
    // Extraemos los parámetros de la URL
    const { page = 1, limit = 15, orderBy, marca, componente, subcategorias, nivel3 } = req.query;
    const pageNumber = parseInt(page);       // Página actual
    const limitNumber = parseInt(limit);     // Cantidad de productos por página
    const { nombre } = req.params;           // Nombre de la categoría principal

    const nombreSinAcentos = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 1. Buscar la categoría principal por nombre
    const categoria = await Categoria.findOne({ Nombre: nombreSinAcentos });
    if (!categoria) return res.status(404).json({ msg: "Categoría no encontrada" });
    const categoriaId = categoria.Id; 

    // 2. Crear filtro base: Buscar productos que tengan esta categoría en cualquiera de sus 5 niveles
    const baseFilter = {
      $or: Array.from({ length: 5 }, (_, i) => ({
        [`Categorizacion${i + 1}Id`]: categoriaId
      }))
    };

    // 3. Aplicar filtro por marca si se especifica
    if (marca && marca !== "si" && marca !== "null") {
      baseFilter.Marca = marca;
    } else if (marca === "null") {
      baseFilter.Marca = { $in: [null, ""] }; // Marca vacía o nula
    }

    // 3. Aplicar filtro por componente si se especifica (usando Categorizacion4Id como referencia)
    if (componente && componente !== "null") {
      // Buscar el ID del componente por su nombre
      const componenteDoc = await Categoria.findOne({ Nombre: componente.trim() });
      if (componenteDoc) {
        baseFilter.Categorizacion4Id = componenteDoc.Id;
      } else {
        // Si no se encuentra el componente, forzar un filtro que no devuelva resultados
        baseFilter.Categorizacion4Id = -999999; // ID inexistente
      }
    } else if (componente === "null") {
      baseFilter.Categorizacion4Id = { $in: [null, 0] }; // Componente vacío o nulo
    }

    // 4. Filtro por subcategorías (por nombre → buscar sus IDs → aplicar en MongoDB)
    if (subcategorias && subcategorias !== "null") {
      const subcategoriasArray = Array.isArray(subcategorias)
        ? subcategorias
         : [subcategorias.trim()];

      // 🔁 Expandir subcategorías con condiciones especiales
      const subcategoriasExpandidas = subcategoriasArray.flatMap(sub => {
        switch (sub.toUpperCase()) {
          case "FERTILIZANTES":
            return ["FERTILIZANTES QUIMICOS", "FERTILIZANTES Y SUSTRATOS"];
          case "MALLAS Y OTROS PLASTICOS":
            return "MALLAS Y PLÁSTICOS DE USOS VAR";
          default:
            return [sub];
        }
      });

      // 🔍 Buscar las subcategorías por nombre
      const subcategoriasDocs = await Categoria.find({ Nombre: { $in: subcategoriasExpandidas } });
      const subcategoriasIds = subcategoriasDocs.map(cat => cat.Id);

      // 🧩 Agregar condición al filtro base
      baseFilter.$and = [
        {
          $or: Array.from({ length: 5 }, (_, i) => ({
            [`Categorizacion${i + 1}Id`]: { $in: subcategoriasIds }
          }))
        }
      ];
    }

    // 4.5
    if (nivel3 && nivel3 !== "null") {
      const nivel3Array = Array.isArray(nivel3)
        ? nivel3
        : [nivel3.trim()];

      // Buscar las categorías por nombre
      const nivel3Docs = await Categoria.find({ Nombre: { $in: nivel3Array } });
      const nivel3Ids = nivel3Docs.map(cat => cat.Id);

      // Agregar condición al filtro base
      if (!baseFilter.$and) baseFilter.$and = [];

      baseFilter.$and.push({
        Categorizacion3Id: { $in: nivel3Ids }
      });
    }


    // 5. Ordenamiento dinámico
    let sorting = { Nombre: 1 }; // Por defecto: ascendente por nombre
    if (orderBy === "desc") sorting = { Nombre: -1 };
    if (orderBy === "marca") sorting = { Marca: 1 };

    // 6. Ejecutar consulta paginada y contar total de resultados
    const [total, productos] = await Promise.all([
      Producto.countDocuments(baseFilter), // Total de productos que cumplen los filtros
      Producto.find(baseFilter)            // Productos paginados
        .select("Id IdApi Codigo Nombre Nombre_interno Descripcion Categorizacion1Id Categorizacion2Id Categorizacion3Id Categorizacion4Id Categorizacion5Id StockActual ImagenUrl Etiquetas Marca")
        .sort(sorting)
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
    ]);

    // 7. Enriquecer productos con nombres de sus categorías
    const categoriaIdsSet = new Set();
    productos.forEach(prod => {
      // Recolectamos todos los IDs de categorizaciones presentes en cada producto
      [1, 2, 3, 4, 5].forEach(i => {
        const id = prod[`Categorizacion${i}Id`];
        if (id && id !== 0) categoriaIdsSet.add(id);
      });
    });

    // Buscar los nombres de esas categorías
    const categoriasRelacionadas = await Categoria.find({ Id: { $in: Array.from(categoriaIdsSet) } });
    const categoriasMap = Object.fromEntries(categoriasRelacionadas.map(cat => [cat.Id, cat.Nombre]));

    // Agregar los nombres de las categorizaciones al producto
    const productosEnriquecidos = productos.map(prod => ({
      ...prod._doc,
      ...Object.fromEntries(
        [1, 2, 3, 4, 5].map(i => [`Categorizacion${i}Nombre`, categoriasMap[prod[`Categorizacion${i}Id`]] || null])
      )
    }));

    // 8. Categorías Permitidas según nombre principal
      let subCategoriasP = [];

      if (nombre.toUpperCase() === "AGROINDUSTRIAL") {
        subCategoriasP = [
          { subcategorias: "AGROQUIMICOS" },
          { subcategorias: "SEMILLAS" },
          { subcategorias: "FERTILIZANTES" },
          { subcategorias: "EQUIPOS DE FUMIGACIÓN" },
          { subcategorias: "SACOS, CABULLAS Y CORDELES" },
          { subcategorias: "MALLAS Y OTROS PLASTICOS" },
        ];
      }


    //9.1
    const categoriasNivel3Completas = await obtenerCategoriasNivel3PorCategoriaPrincipal(subcategorias);

    //9.2
    const marcasPorCategoria = await obtenerMarcasPorCategoriaPrincipalFlexible(subcategorias, nombre);

    //9.3
    const componentesPorCategoria = await obtenerComponentesPorCategoriaPrincipalFlexible(subcategorias, nombre);


    

    // 10. Enviar respuesta al cliente
    res.status(200).json({
      total,                                       // Total de productos encontrados
      totalPages: Math.ceil(total / limitNumber), // Total de páginas
      currentPage: pageNumber,                    // Página actual
      productos: productosEnriquecidos,           // Productos con nombres de categorías
      marcas: marcasPorCategoria,                 // Marcas disponibles
      componentes: componentesPorCategoria,       // Componentes disponibles
      subCategoriasP,
      categoriasInternas: {
        Categorizacion2Id: categoriasMap[categoriaId] ? [{ Id: categoriaId, Nombre: categoriasMap[categoriaId] }] : [],
        Categorizacion3Id: categoriasNivel3Completas
      }
    });
  } catch (error) {
    // Si algo falla, devolvemos error 500
    console.error("Error al obtener productos por categoría:", error.message);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};



const obtenerCategoriasInternasPorNivel = async (productos, niveles = []) => {
  const idsPorNivel = {};

  // 1. Recolectar IDs por nivel
  niveles.forEach(nivel => {
    idsPorNivel[nivel] = new Set();
    productos.forEach(prod => {
      const id = prod[nivel];
      if (id && id !== 0) idsPorNivel[nivel].add(id);
    });
  });

  // 2. Buscar nombres de categorías por nivel
  const resultado = {};
  for (const nivel of niveles) {
    const ids = Array.from(idsPorNivel[nivel]);
    const categorias = await Categoria.find({ Id: { $in: ids } });

    // 3. Mapear y eliminar duplicados por nombre
    const sinDuplicados = [];
    const nombresVistos = new Set();

    categorias.forEach(cat => {
      if (!nombresVistos.has(cat.Nombre)) {
        nombresVistos.add(cat.Nombre);
        sinDuplicados.push({ Id: cat.Id, Nombre: cat.Nombre });
      }
    });

    // 4. Ordenar alfabéticamente
    resultado[nivel] = sinDuplicados.sort((a, b) => a.Nombre.localeCompare(b.Nombre));
  }

  return resultado;
};


const obtenerCategoriasNivel3PorCategoriaPrincipal = async (nombreCategoriaPrincipal) => {
  try {
    // 1. Buscar la categoría principal por nombre
    const categoriaPrincipal = await Categoria.findOne({ Nombre: nombreCategoriaPrincipal });
    if (!categoriaPrincipal) return [];

    const categoriaId = categoriaPrincipal.Id;

    // 2. Buscar productos que tengan esa categoría en cualquier nivel
    const productos = await Producto.find({
      $or: Array.from({ length: 5 }, (_, i) => ({
        [`Categorizacion${i + 1}Id`]: categoriaId
      }))
    }).select("Categorizacion3Id");

    // 3. Extraer todos los IDs únicos de Categorizacion3Id
    const idsNivel3 = [
      ...new Set(productos.map(p => p.Categorizacion3Id).filter(Boolean))
    ];

    if (!idsNivel3.length) return [];

    // 4. Buscar las categorías nivel 3 por ID
    const categoriasNivel3 = await Categoria.find({ Id: { $in: idsNivel3 } });

    // 5. Eliminar duplicados por nombre
    const categoriasUnicas = [];
    const nombresVistos = new Set();

    for (const cat of categoriasNivel3) {
      if (!nombresVistos.has(cat.Nombre)) {
        nombresVistos.add(cat.Nombre);
        categoriasUnicas.push({ Id: cat.Id, Nombre: cat.Nombre });
      }
    }
    // ✅ Ordenar alfabéticamente por Nombre
    categoriasUnicas.sort((a, b) => a.Nombre.localeCompare(b.Nombre));

    return categoriasUnicas;
  } catch (error) {
    console.error("Error al obtener categorías nivel 3:", error.message);
    return [];
  }
};

const obtenerMarcasPorCategoriaPrincipalFlexible = async (subcategorias, nombreFallback) => {
  try {
    // 1. Determinar qué nombre usar
    let nombresCategoria = [];

    if (Array.isArray(subcategorias)) {
      nombresCategoria = subcategorias.filter(Boolean).map(s => s.trim());
    } else if (typeof subcategorias === "string" && subcategorias.trim() !== "") {
      nombresCategoria = [subcategorias.trim()];
    } else if (typeof nombreFallback === "string" && nombreFallback.trim() !== "") {
      nombresCategoria = [nombreFallback.trim()];
    }

    if (!nombresCategoria.length) return [];

    // 2. Expandir nombres si hay condiciones especiales
    const nombresExpandidos = nombresCategoria.flatMap(sub => {
      switch (sub.toUpperCase()) {
        case "FERTILIZANTES":
          return ["FERTILIZANTES QUIMICOS", "FERTILIZANTES Y SUSTRATOS"];
        case "MALLAS Y OTROS PLASTICOS":
          return ["MALLAS Y PLÁSTICOS DE USOS VAR"];
        case "MAQUINARIA AGRICOLA":
          return ["MAQUINAS PARA LA SIEMBRA","MAQUINAS PARA EL ABONO Y FERTI", "MAQUINAS PARA LA PROTECCION Y", "MAQUINARIA PARA LA RECOLECCION", "MAQUINARIA PROCESAMIENTO MATER", "IMPLEMENTOS PARA PREPARACION D" ];
        case "BOMBAS DE AGUA":
          return "BOMBAS DE AGUA USO DOMESTICO";
        case "SALUD PÚBLICA":
          return "SALUD PUBLICA";
        default:
          return [sub];
      }
    });


    // 2. Buscar las categorías por nombre
    const categorias = await Categoria.find({ Nombre: { $in: nombresExpandidos } });
    if (!categorias.length) return [];

    const categoriaIds = categorias.map(cat => cat.Id);

    // 3. Buscar productos que tengan esas categorías en cualquier nivel
    const productos = await Producto.find({
      $or: Array.from({ length: 5 }, (_, i) => ({
        [`Categorizacion${i + 1}Id`]: { $in: categoriaIds }
      }))
    }).select("Marca");

    // 4. Extraer marcas únicas (excluyendo nulas o vacías)
    const marcasUnicas = [];
    const marcasVistas = new Set();

    for (const prod of productos) {
      const marca = prod.Marca?.trim();
      if (marca && !marcasVistas.has(marca)) {
        marcasVistas.add(marca);
        marcasUnicas.push({ Marca: marca });
      }
    }

    // ✅ Ordenar alfabéticamente
    marcasUnicas.sort((a, b) => a.Marca.localeCompare(b.Marca));

    return marcasUnicas;
  } catch (error) {
    console.error("Error al obtener marcas por categoría:", error.message);
    return [];
  }
};

const obtenerComponentesPorCategoriaPrincipalFlexible = async (subcategorias, nombreFallback) => {
  try {
    // 1. Determinar qué nombre usar
    let nombresCategoria = [];

    if (Array.isArray(subcategorias)) {
      nombresCategoria = subcategorias.filter(Boolean).map(s => s.trim());
    } else if (typeof subcategorias === "string" && subcategorias.trim() !== "") {
      nombresCategoria = [subcategorias.trim()];
    } else if (typeof nombreFallback === "string" && nombreFallback.trim() !== "") {
      nombresCategoria = [nombreFallback.trim()];
    }

    if (!nombresCategoria.length) return [];

    // 2. Expandir nombres si hay condiciones especiales
    const nombresExpandidos = nombresCategoria.flatMap(sub => {
      switch (sub.toUpperCase()) {
        case "FERTILIZANTES":
          return ["FERTILIZANTES QUIMICOS", "FERTILIZANTES Y SUSTRATOS"];
        case "MALLAS Y OTROS PLASTICOS":
          return ["MALLAS Y PLÁSTICOS DE USOS VAR"];
        case "MAQUINARIA AGRICOLA":
          return ["MAQUINAS PARA LA SIEMBRA","MAQUINAS PARA EL ABONO Y FERTI", "MAQUINAS PARA LA PROTECCION Y", "MAQUINARIA PARA LA RECOLECCION", "MAQUINARIA PROCESAMIENTO MATER", "IMPLEMENTOS PARA PREPARACION D" ];
        case "BOMBAS DE AGUA":
          return "BOMBAS DE AGUA USO DOMESTICO";
        default:
          return [sub];
      }
    });

    // 2. Buscar las categorías por nombre
    const categorias = await Categoria.find({ Nombre: { $in: nombresExpandidos } });
    if (!categorias.length) return [];

    const categoriaIds = categorias.map(cat => cat.Id);

    // 3. Buscar productos que tengan esas categorías en cualquier nivel
    const productos = await Producto.find({
      $or: Array.from({ length: 5 }, (_, i) => ({
        [`Categorizacion${i + 1}Id`]: { $in: categoriaIds }
      }))
    }).select("Categorizacion4Id");

    // 4. Extraer IDs únicos de componentes (nivel 4)
    const componentesIds = [
      ...new Set(productos.map(p => p.Categorizacion4Id).filter(id => id && id !== 0))
    ];

    if (!componentesIds.length) return [];

    // 5. Buscar nombres de componentes por ID
    const componentes = await Categoria.find({ Id: { $in: componentesIds } });

    // 6. Eliminar duplicados por nombre
    const componentesUnicos = [];
    const nombresVistos = new Set();

    for (const comp of componentes) {
      if (!nombresVistos.has(comp.Nombre)) {
        nombresVistos.add(comp.Nombre);
        componentesUnicos.push({ Id: comp.Id, Nombre: comp.Nombre });
      }
    }

// ✅ Ordenar alfabéticamente por Nombre
componentesUnicos.sort((a, b) => a.Nombre.localeCompare(b.Nombre));

    return componentesUnicos;
  } catch (error) {
    console.error("Error al obtener componentes por categoría:", error.message);
    return [];
  }
};































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


/* //////////////////////////////////////////////////////////// */
/* //////////////////////////////////////////////////////////// */
/* ------------------------- AGRO ----------------------------- */
/* //////////////////////////////////////////////////////////// */
/* //////////////////////////////////////////////////////////// */
// FERTILIZANTES
const obtenerProductosFERTILIZANTES = async (req, res) => {
  try {
    const { page, limit, orderBy, marca, componente } = req.query;
    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 16;
    const startIndex = (pageNumber - 1) * limitNumber;

    // 1. Buscar categorías relevantes
    const categorias = await Categoria.find({
      Nombre: { $in: ["FERTILIZANTES QUIMICOS", "FERTILIZANTES Y SUSTRATOS"] }
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
// OTROSAGRO
const obtenerProductosOTROSAGRO = async (req, res) => {
  try {
    const { page, limit, orderBy, marca, componente } = req.query;
    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 16;
    const startIndex = (pageNumber - 1) * limitNumber;

    // 1. Buscar categorías relevantes
    const categorias = await Categoria.find({
      Nombre: { $in: ["RIEGO", "UNIDADES DE ALMACENAMIENTO"] }
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



/* //////////////////////////////////////////////////////////// */
/* //////////////////////////////////////////////////////////// */
/* ------------------------ PECUARIA -------------------------- */
/* //////////////////////////////////////////////////////////// */
/* //////////////////////////////////////////////////////////// */
const obtenerProductosPECUARIA = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 15,
      orderBy,
      marca,
      componente,
      subcategorias,
      nivel3
    } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    // 1. Buscar categorías principales
    const categoriasPrincipales = await Categoria.find({
      Nombre: { $in: ["MEDICINA VETERINARIA", "GANADERIA", "MASCOTAS"] }
    });
    if (!categoriasPrincipales.length) {
      return res.status(404).json({ msg: "Categorías principales no encontradas" });
    }
    const categoriaIds = categoriasPrincipales.map(cat => cat.Id);

    // 2. Filtro base: productos que tengan alguna de las categorías principales en cualquier nivel
    const baseFilter = {
      $or: Array.from({ length: 5 }, (_, i) => ({
        [`Categorizacion${i + 1}Id`]: { $in: categoriaIds }
      }))
    };

    // 3. Filtro por marca
    if (marca && marca !== "si") {
      baseFilter.Marca = marca === "null" ? { $in: [null, ""] } : marca;
    }

    // 4.  Aplicar filtro por componente si se especifica (usando Categorizacion4Id como referencia)
    if (componente && componente !== "null") {
      // Buscar el ID del componente por su nombre
      const componenteDoc = await Categoria.findOne({ Nombre: componente.trim() });
      if (componenteDoc) {
        baseFilter.Categorizacion4Id = componenteDoc.Id;
      } else {
        // Si no se encuentra el componente, forzar un filtro que no devuelva resultados
        baseFilter.Categorizacion4Id = -999999; // ID inexistente
      }
    } else if (componente === "null") {
      baseFilter.Categorizacion4Id = { $in: [null, 0] }; // Componente vacío o nulo
    }


    // 5. Filtro por subcategorías
    if (subcategorias && subcategorias !== "null") {
      const subcategoriasArray = Array.isArray(subcategorias)
        ? subcategorias
        : [subcategorias.trim()];

      const subcategoriasExpandidas = subcategoriasArray.flatMap(sub => {
        switch (sub.toUpperCase()) {
          case "FERTILIZANTES":
            return ["FERTILIZANTES QUIMICOS", "FERTILIZANTES Y SUSTRATOS"];
          case "MALLAS Y OTROS PLASTICOS":
            return "MALLAS Y PLÁSTICOS DE USOS VAR";
          default:
            return [sub];
        }
      });

      const subcategoriasDocs = await Categoria.find({
        Nombre: { $in: subcategoriasExpandidas }
      });
      const subcategoriasIds = subcategoriasDocs.map(cat => cat.Id);

      baseFilter.$and = baseFilter.$and || [];
      baseFilter.$and.push({
        $or: Array.from({ length: 5 }, (_, i) => ({
          [`Categorizacion${i + 1}Id`]: { $in: subcategoriasIds }
        }))
      });
    }

    // 6. Filtro por nivel3
    if (nivel3 && nivel3 !== "null") {
      const nivel3Array = Array.isArray(nivel3) ? nivel3 : [nivel3.trim()];
      const nivel3Docs = await Categoria.find({ Nombre: { $in: nivel3Array } });
      const nivel3Ids = nivel3Docs.map(cat => cat.Id);

      baseFilter.$and = baseFilter.$and || [];
      baseFilter.$and.push({ Categorizacion3Id: { $in: nivel3Ids } });
    }

    // 7. Ordenamiento
    let sorting = { Nombre: 1 };
    if (orderBy === "desc") sorting = { Nombre: -1 };
    if (orderBy === "marca") sorting = { Marca: 1 };

    // 8. Consulta paginada
    const [total, productos] = await Promise.all([
      Producto.countDocuments(baseFilter),
      Producto.find(baseFilter)
        .select("Id IdApi Codigo Nombre Nombre_interno Descripcion Categorizacion1Id Categorizacion2Id Categorizacion3Id Categorizacion4Id Categorizacion5Id StockActual ImagenUrl Etiquetas Marca")
        .sort(sorting)
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
    ]);

    // 9. Enriquecer productos con nombres de sus categorías
    const categoriaIdsSet = new Set();
    productos.forEach(prod => {
      // Recolectamos todos los IDs de categorizaciones presentes en cada producto
      [1, 2, 3, 4, 5].forEach(i => {
        const id = prod[`Categorizacion${i}Id`];
        if (id && id !== 0) categoriaIdsSet.add(id);
      });
    });

    // Buscar los nombres de esas categorías
    const categoriasRelacionadas = await Categoria.find({ Id: { $in: Array.from(categoriaIdsSet) } });
    const categoriasMap = Object.fromEntries(categoriasRelacionadas.map(cat => [cat.Id, cat.Nombre]));

    // Agregar los nombres de las categorizaciones al producto
    const productosEnriquecidos = productos.map(prod => ({
      ...prod._doc,
      ...Object.fromEntries(
        [1, 2, 3, 4, 5].map(i => [`Categorizacion${i}Nombre`, categoriasMap[prod[`Categorizacion${i}Id`]] || null])
      )
    }));


    // 11. Subcategorías permitidas
    const subCategoriasP = [
      { subcategorias: "MEDICINA VETERINARIA" },
      { subcategorias: "IMPLEMENTOS VETERINARIOS" },
      { subcategorias: "GANADERIA" },
      { subcategorias: "MASCOTAS" }
    ];

    
    //9.1
    const categoriasNivel3Completas = await obtenerCategoriasNivel3PorCategoriaPrincipal(subcategorias);

    //9.2
    const marcasPorCategoria = await obtenerMarcasPorCategoriaPrincipalFlexible(subcategorias);

    //9.3
    const componentesPorCategoria = await obtenerComponentesPorCategoriaPrincipalFlexible(subcategorias);


    // 14. Respuesta
    res.status(200).json({
      total,
      totalPages: Math.ceil(total / limitNumber),
      currentPage: pageNumber,
      productos: productosEnriquecidos,
      marcas: marcasPorCategoria,                 // Marcas disponibles
      componentes: componentesPorCategoria,       // Componentes disponibles
      subCategoriasP,
      categoriasInternas: {
        Categorizacion2Id: categoriasMap[categoriaIds] ? [{ Id: categoriaIds, Nombre: categoriasMap[categoriaIds] }] : [],
        Categorizacion3Id: categoriasNivel3Completas
      }
    });
  } catch (error) {
    console.error("Error al obtener productos PECUARIA:", error.message);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};

const obtenerProductosGANADERIA = async (req, res) => {
  try {
    const { page, limit, orderBy, marca, componente } = req.query;
    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 16;
    const startIndex = (pageNumber - 1) * limitNumber;

    // 1. Buscar categorías relevantes
   const categorias = await Categoria.find({
      $and: [
        { Nombre: { $in: ["ALIMENTOS ANIMALES DE PRODUCCI","ORDEÑO", "CERCAS", "IMPLEMENTOS PARA ESTABULACION" ] } },
      ]
    });

    

    if (!categorias || categorias.length === 0) {
      return res.status(404).json({ msg: "Categorías no encontradas" });
    }

    const categoriaIds = categorias.map(cat => cat.Id)


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



/* //////////////////////////////////////////////////////////// */
/* //////////////////////////////////////////////////////////// */
/* ------------------------ MAQUINARIA ------------------------ */
/* //////////////////////////////////////////////////////////// */
/* //////////////////////////////////////////////////////////// */
const obtenerProductosMAQUINARIA = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 15,
      orderBy,
      marca,
      componente,
      subcategorias,
      nivel3
    } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    // 1. Buscar categorías principales
    const categoriasPrincipales = await Categoria.find({
      Nombre: { $in: ["MAQUINARIA E IMPLEMENTOS"] }
    });
    if (!categoriasPrincipales.length) {
      return res.status(404).json({ msg: "Categorías principales no encontradas" });
    }
    const categoriaIds = categoriasPrincipales.map(cat => cat.Id);

    // 2. Filtro base: productos que tengan alguna de las categorías principales en cualquier nivel
    const baseFilter = {
      $or: Array.from({ length: 5 }, (_, i) => ({
        [`Categorizacion${i + 1}Id`]: { $in: categoriaIds }
      }))
    };

    // 3. Filtro por marca
    if (marca && marca !== "si") {
      baseFilter.Marca = marca === "null" ? { $in: [null, ""] } : marca;
    }

    // 4.  Aplicar filtro por componente si se especifica (usando Categorizacion4Id como referencia)
    if (componente && componente !== "null") {
      // Buscar el ID del componente por su nombre
      const componenteDoc = await Categoria.findOne({ Nombre: componente.trim() });
      if (componenteDoc) {
        baseFilter.Categorizacion4Id = componenteDoc.Id;
      } else {
        // Si no se encuentra el componente, forzar un filtro que no devuelva resultados
        baseFilter.Categorizacion4Id = -999999; // ID inexistente
      }
    } else if (componente === "null") {
      baseFilter.Categorizacion4Id = { $in: [null, 0] }; // Componente vacío o nulo
    }


    // 5. Filtro por subcategorías
    if (subcategorias && subcategorias !== "null") {
      const subcategoriasArray = Array.isArray(subcategorias)
        ? subcategorias
        : [subcategorias.trim()];

      const subcategoriasExpandidas = subcategoriasArray.flatMap(sub => {
        switch (sub.toUpperCase()) {
          case "MAQUINARIA AGRICOLA":
            return ["MAQUINAS PARA LA SIEMBRA","MAQUINAS PARA EL ABONO Y FERTI", "MAQUINAS PARA LA PROTECCION Y", "MAQUINARIA PARA LA RECOLECCION", "MAQUINARIA PROCESAMIENTO MATER", "IMPLEMENTOS PARA PREPARACION D" ];
          case "BOMBAS DE AGUA":
            return "BOMBAS DE AGUA USO DOMESTICO";
          default:
            return [sub];
        }
      });

      const subcategoriasDocs = await Categoria.find({
        Nombre: { $in: subcategoriasExpandidas }
      });
      const subcategoriasIds = subcategoriasDocs.map(cat => cat.Id);

      baseFilter.$and = baseFilter.$and || [];
      baseFilter.$and.push({
        $or: Array.from({ length: 5 }, (_, i) => ({
          [`Categorizacion${i + 1}Id`]: { $in: subcategoriasIds }
        }))
      });
    }

    // 6. Filtro por nivel3
    if (nivel3 && nivel3 !== "null") {
      const nivel3Array = Array.isArray(nivel3) ? nivel3 : [nivel3.trim()];
      const nivel3Docs = await Categoria.find({ Nombre: { $in: nivel3Array } });
      const nivel3Ids = nivel3Docs.map(cat => cat.Id);

      baseFilter.$and = baseFilter.$and || [];
      baseFilter.$and.push({ Categorizacion3Id: { $in: nivel3Ids } });
    }

    // 7. Ordenamiento
    let sorting = { Nombre: 1 };
    if (orderBy === "desc") sorting = { Nombre: -1 };
    if (orderBy === "marca") sorting = { Marca: 1 };

    // 8. Consulta paginada
    const [total, productos] = await Promise.all([
      Producto.countDocuments(baseFilter),
      Producto.find(baseFilter)
        .select("Id IdApi Codigo Nombre Nombre_interno Descripcion Categorizacion1Id Categorizacion2Id Categorizacion3Id Categorizacion4Id Categorizacion5Id StockActual ImagenUrl Etiquetas Marca")
        .sort(sorting)
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
    ]);

    // 9. Enriquecer productos con nombres de sus categorías
    const categoriaIdsSet = new Set();
    productos.forEach(prod => {
      // Recolectamos todos los IDs de categorizaciones presentes en cada producto
      [1, 2, 3, 4, 5].forEach(i => {
        const id = prod[`Categorizacion${i}Id`];
        if (id && id !== 0) categoriaIdsSet.add(id);
      });
    });

    // Buscar los nombres de esas categorías
    const categoriasRelacionadas = await Categoria.find({ Id: { $in: Array.from(categoriaIdsSet) } });
    const categoriasMap = Object.fromEntries(categoriasRelacionadas.map(cat => [cat.Id, cat.Nombre]));

    // Agregar los nombres de las categorizaciones al producto
    const productosEnriquecidos = productos.map(prod => ({
      ...prod._doc,
      ...Object.fromEntries(
        [1, 2, 3, 4, 5].map(i => [`Categorizacion${i}Nombre`, categoriasMap[prod[`Categorizacion${i}Id`]] || null])
      )
    }));


    // 8 Categorias Permitidas
    const subCategoriasP = [
      {subcategorias:"MAQUINARIA AGRICOLA"},
      {subcategorias:"BOMBAS DE AGUA"},
      {subcategorias:"GENERADORES"},
      {subcategorias:"DESMALEZADORAS"},
      {subcategorias:"MOTOSIERRAS"},
    ];

    
    //9.1
    const categoriasNivel3Completas = await obtenerCategoriasNivel3PorCategoriaPrincipal("MAQUINARIA E IMPLEMENTOS");

    //9.2
    const marcasPorCategoria = await obtenerMarcasPorCategoriaPrincipalFlexible(subcategorias);

    //9.3
    const componentesPorCategoria = await obtenerComponentesPorCategoriaPrincipalFlexible(subcategorias);


    // 14. Respuesta
    res.status(200).json({
      total,
      totalPages: Math.ceil(total / limitNumber),
      currentPage: pageNumber,
      productos: productosEnriquecidos,
      marcas: marcasPorCategoria,                 // Marcas disponibles
      componentes: componentesPorCategoria,       // Componentes disponibles
      subCategoriasP,
      categoriasInternas: {
        Categorizacion2Id: categoriasMap[categoriaIds] ? [{ Id: categoriaIds, Nombre: categoriasMap[categoriaIds] }] : [],
        Categorizacion3Id: categoriasNivel3Completas
      }
    });
  } catch (error) {
    console.error("Error al obtener productos PECUARIA:", error.message);
    res.status(500).json({ msg: "Error en el servidor" });
  }
};




/* //////////////////////////////////////////////////////////// */
/* //////////////////////////////////////////////////////////// */
/* ------------------------ Buscar Pro ------------------------ */
/* //////////////////////////////////////////////////////////// */
/* //////////////////////////////////////////////////////////// */
const obtenerProductoPorNombre = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const pageNumber = Math.max(parseInt(page) || 1, 1);
    const limitNumber = Math.max(parseInt(limit) || 16, 1);
    const startIndex = (pageNumber - 1) * limitNumber;

    const { nombre } = req.params;
    const escapedNombre = nombre
      .replace(/\s+/g, '-')
      .replace(/%/g, "%25")
      .replace(/[ / ]/g, "_");

    // 1. Buscar categorías nivel 4 que coincidan con el nombre
    const categoriasNivel4 = await Categoria.find({
      Nivel: 4,
      Nombre: { $regex: nombre, $options: 'i' }
    });

    const categoria4Ids = categoriasNivel4.map(cat => cat.Id);

    // 2. Construcción de filtros
    const query = {
      $or: [
        { Nombre_interno: { $regex: escapedNombre, $options: 'i' } },
        ...(categoria4Ids.length > 0 ? [{ Categorizacion4Id: { $in: categoria4Ids } }] : [])
      ]
    };

    // 3. Consultas en paralelo
    const [total, productos] = await Promise.all([
      Producto.countDocuments(query),
      Producto.find(query)
        .select("Id IdApi Codigo Nombre Nombre_interno Descripcion Categorizacion1Id Categorizacion2Id Categorizacion3Id Categorizacion4Id Categorizacion5Id StockActual ImagenUrl Etiquetas Marca")
        .sort({ Nombre: 1 })
        .skip(startIndex)
        .limit(limitNumber)
    ]);

    // 4. Marcas únicas
    const marcas = [...new Set(productos.map(p => p.Marca).filter(Boolean))];

    // 5. Total de páginas
    const totalPages = Math.ceil(total / limitNumber);

    // 6. Respuesta
    res.status(200).json({
      success: true,
      total,
      totalPages,
      currentPage: pageNumber,
      productos,
      marcas
    });
  } catch (error) {
    console.error("Error al buscar productos por nombre o categoría nivel 4:", error.message);
    res.status(500).json({ success: false, msg: "Error en el servidor" });
  }
};

const obtenerProductoPorId = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const pageNumber = Math.max(parseInt(page) || 1, 1);
    const limitNumber = Math.max(parseInt(limit) || 16, 1);
    const startIndex = (pageNumber - 1) * limitNumber;

    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ success: false, msg: "ID inválido" });
    }

    // 1. Construcción de filtro por ID
    const query = { Id: parseInt(id) };

    // 2. Consultas en paralelo
    const [total, productos] = await Promise.all([
      Producto.countDocuments(query),
      Producto.find(query)
        .select("Id IdApi Codigo Nombre Nombre_interno Descripcion Categorizacion1Id Categorizacion2Id Categorizacion3Id Categorizacion4Id Categorizacion5Id StockActual ImagenUrl Etiquetas Marca")
        .sort({ Nombre: 1 })
        .skip(startIndex)
        .limit(limitNumber)
    ]);

    // 3. Marcas únicas
    const marcas = [...new Set(productos.map(p => p.Marca).filter(Boolean))];

    // 4. Total de páginas
    const totalPages = Math.ceil(total / limitNumber);

    // 5. Respuesta
    res.status(200).json({
      success: true,
      total,
      totalPages,
      currentPage: pageNumber,
      productos,
      marcas
    });
  } catch (error) {
    console.error("Error al buscar producto por ID:", error.message);
    res.status(500).json({ success: false, msg: "Error en el servidor" });
  }
};




































//Obtener Todos los Productos Casagri
const obtenerProductosTodos = async (req, res = response) => {
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

//Obtener Todos los Productos Casagri
const obtenerProductos = async (req, res) => {
  try {
    const { page, limit, orderBy, marca, componente } = req.query;
    const pageNumber = Math.max(parseInt(page) || 1, 1);
    const limitNumber = Math.max(parseInt(limit) || 16, 1);
    const startIndex = (pageNumber - 1) * limitNumber;

    // 1. Buscar todas las categorías
    const categorias = await Categoria.find({});
    if (!categorias || categorias.length === 0) {
      return res.status(404).json({ success: false, msg: "No se encontraron categorías" });
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
      ...(marca && marca !== "si" && marca !== "null" && { Marca: marca }),
      ...(marca === "null" && { Marca: { $in: [null, ""] } }),
      ...(componente && componente !== "null" && { Etiquetas: componente }),
      ...(componente === "null" && { Etiquetas: { $in: [null, 0] } }),
    };

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

    // 5. Marcas y componentes únicos
    const marcas = await Producto.distinct("Marca", { $or: filters.$or });
    const componentes = await Producto.distinct("Etiquetas", { $or: filters.$or });

    // 6. Total de páginas
    const totalPages = Math.ceil(total / limitNumber);

    // 7. Respuesta estructurada
    res.status(200).json({
      total,
      totalPages,
      currentPage: pageNumber,
      productos,
      //marcas: marcas.map(m => ({ Marca: m })),
      //componentes: componentes.map(c => ({ Etiquetas: c }))

    });
  } catch (error) {
    console.error("Error al obtener productos por categoría:", error.message);
    res.status(500).json({ success: false, msg: "Error en el servidor" });
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



module.exports = { 
  crearProductosDesdeCasagri, 
  obtenerProductos,
  obtenerSubcategoriasPorNivel,
  obtenerProductoPorNombre,
  obtenerProductoPorId,

  /* ------------------------- GENERAL ----------------------------- */
  obtenerProductosPorCategoriaNombre, 

  /* ------------------------- AGRO -------------------------------- */
  obtenerProductosFERTILIZANTES,
  obtenerProductosOTROSAGRO, 

  /* ------------------------- PECUARIA ---------------------------- */
  obtenerProductosPECUARIA,
  obtenerProductosGANADERIA,

  /* ------------------------ MAQUINARIA --------------------------- */
  obtenerProductosMAQUINARIA,


  };
