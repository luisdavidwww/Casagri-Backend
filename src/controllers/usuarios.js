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
const usuariosPost = async(req, res = response) => {
    
    const { nombre, correo, password, rol } = req.body;
    
    const usuario = new Usuario({ nombre, correo, password, rol });

    // Encriptar la contraseña
    const salt = bcryptjs.genSaltSync();
    usuario.password = bcryptjs.hashSync( password, salt );

    // Guardar en BD
    await usuario.save();

    res.json({
        usuario
    });
}

// ---------------------
// CREAR USUARIOS CON GOOGLE
// ---------------------
const usuariosGooglePost = async(req, res = response) => {
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
            // Crear usuario nuevo
            usuario = new Usuario({
                nombre: name,
                correo: email,
                password: ':P', // placeholder porque Google no envía password
                img: picture,
                google: true
            });

            await usuario.save();
        }

        res.json({
            msg: 'Usuario autenticado con Google',
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
// CREAR USUARIOS CON GOOGLE
// ---------------------
const usuariosDelete = async(req, res = response) => {

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