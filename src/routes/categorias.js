const { Router } = require('express');
const { crearCategoriasDesdeCasagri, obtenerProductosPorCategoriaNombre, obtenerCategorias } = require('../controllers/categorias'); // Ajusta la ruta 
const router = Router();

/**
 * GET /api/productos/sync
 * Endpoint para sincronizar todos los productos desde Casagri API
 */

router.get('/syc', async (req, res) => {
  try {
    await crearCategoriasDesdeCasagri(); // Ejecuta el método que obtiene los productos y los guarda en MongoDB
    res.status(200).json({ msg: 'Productos sincronizados correctamente ✅' });
  } catch (error) {
    console.error('Error al sincronizar productos:', error);
    res.status(500).json({ msg: 'Error al sincronizar productos', error: error.message });
  }
});


router.get('/todas', obtenerCategorias );


router.get('/:nombre', obtenerProductosPorCategoriaNombre );

module.exports = router;
