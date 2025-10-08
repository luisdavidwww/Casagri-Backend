const { Router } = require('express');

const { 
        crearProductosDesdeCasagri, 
        obtenerProductos,
        obtenerSubcategoriasPorNivel,

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

         } = require('../controllers/productos'); 

const router = Router();

/**
 * GET /api/productos/sync
 * Endpoint para sincronizar todos los productos desde Casagri API
 */
router.get('/sync', async (req, res) => {
  try {
    await crearProductosDesdeCasagri(); // Ejecuta el método que obtiene los productos y los guarda en MongoDB
    res.status(200).json({ msg: 'Productos sincronizados correctamente ✅' });
  } catch (error) {
    console.error('Error al sincronizar productos:', error);
    res.status(500).json({ msg: 'Error al sincronizar productos', error: error.message });
  }
});


/* ------------------------- GENERAL ----------------------------- */
router.get('/BuscarProdCategoria/:nombre', obtenerProductosPorCategoriaNombre);

/* ------------------------- AGRO -------------------------------- */
router.get('/Fertilizantes', obtenerProductosFERTILIZANTES);
router.get('/OtrosAgro', obtenerProductosOTROSAGRO);

/* ------------------------- PECUARIA ---------------------------- */
router.get('/Pecuaria', obtenerProductosPECUARIA);
router.get('/Ganaderia', obtenerProductosGANADERIA);

/* ------------------------- MAQUINARIA -------------------------- */
router.get('/MaquinariaAgricola', obtenerProductosMAQUINARIA);
router.get('/MaquinariaAgricola', obtenerProductosMAQUINARIA);




/* ------------------------- SUBCATEGORIAS ----------------------- */
router.get('/BuscarCategoria/:nombre', obtenerSubcategoriasPorNivel);


// Obtener todos los productos
router.get('/all', obtenerProductos);

module.exports = router;
