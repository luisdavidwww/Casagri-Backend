const { response, request } = require('express');
const bcryptjs = require('bcryptjs');  // Validar datos de entrada

//Para Crear usuario con google
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); // Pon tu client ID de Google

const Usuario = require('../models/usuario');


// ---------------------
// OBTENER USUARIOS
// ---------------------
const usuariosGet = async(req = request, res = response) => {

    const { limite = 5, desde = 0 } = req.query;
    const query = { estado: true };

    const [ total, usuarios ] = await Promise.all([
        Usuario.countDocuments(query),
        Usuario.find(query)
            .skip( Number( desde ) )
            .limit(Number( limite ))
    ]);

    res.json({
        total,
        usuarios
    });
}

// ---------------------
// CREAR USUARIOS
// ---------------------

const usuariosPost = async (req, res = response) => {

  const Authorization = req.header('Authorization');

  // Validar el ServicePassword
  if (Authorization !== process.env.SECRETORPRIVATEKEY) {
    return res.status(403).json({
      msg: 'Acceso denegado: ServicePassword inválido'
    });
  }

  const { nombre, correo, password, rol } = req.body;

  const usuario = new Usuario({ nombre, correo, password, rol });

  const salt = bcryptjs.genSaltSync();
  usuario.password = bcryptjs.hashSync(password, salt);

  await usuario.save();

  res.json({
    usuario
  });
};


// ---------------------
// CREAR USUARIOS CON GOOGLE
// ---------------------
const usuariosGooglePost = async(req, res = response) => {

    const Authorization = req.header('Authorization');

  // Validar el ServicePassword
  if (Authorization !== process.env.SECRETORPRIVATEKEY) {
    return res.status(403).json({
      msg: 'Acceso denegado: ServicePassword inválido'
    });
  }

    const { id_token } = req.body;

    console.log("ID Token recibido del cliente:", id_token);

    try {
        // Verificar token con Google
        const ticket = await client.verifyIdToken({
            idToken: id_token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const { name, email, picture } = ticket.getPayload();

        // Buscar si el usuario ya existe
        let usuario = await Usuario.findOne({ correo: email });

        if (!usuario) {
            usuario = new Usuario({
                nombre: name,
                correo: email,
                password: ':P',
                img: picture,
                google: true
            });

            await usuario.save();

            return res.json({
                msg: 'Usuario creado exitosamente con Google',
                usuario
            });
            }

            // Si ya existe, simplemente lo devuelve
            return res.json({
            msg: 'Usuario ya registrado, autenticado con Google',
            usuario
            });



    } catch (error) {
        return res.status(400).json({
            msg: 'Token de Google no válido',
            error
        });
    }
}

// ---------------------
// ELIMINAR USUARIOS
// ---------------------
const usuariosDelete = async(req, res = response) => {

    const Authorization = req.header('Authorization');

  // Validar el ServicePassword
  if (Authorization !== process.env.SECRETORPRIVATEKEY) {
    return res.status(403).json({
      msg: 'Acceso denegado: ServicePassword inválido'
    });
  }

    const { id } = req.params;
    const usuario = await Usuario.findByIdAndUpdate( id, { estado: false } );

    
    res.json(usuario);
}


module.exports = {
    usuariosGet,
    usuariosPost,
    usuariosGooglePost,
    usuariosDelete,
}