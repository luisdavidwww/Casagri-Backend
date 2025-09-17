const axios = require('axios');
const Categoria = require('../models/categoria'); // Ajusta la ruta

const crearCategoriasDesdeCasagri = async () => {
  try {
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
      console.error('No se recibieron categorías en la respuesta.');
      return;
    }

    const categorias = categoriasAPI.map((item) => ({
      Id: item.Id,
      IdApi: item.IdApi,
      Nombre: item.Nombre,
      Nivel: item.Nivel || 1,
      ImagenUrl: item.ImagenUrl || "",
      ModificadoFecha: item.ModificadoFecha || "",
    }));

    await Categoria.insertMany(categorias);

    console.log('Categorías guardadas en la base de datos ✅');
  } catch (error) {
    console.error('Error al obtener o guardar categorías:', error.message);
  }
};


module.exports = { crearCategoriasDesdeCasagri };