const { Router } = require('express'); // Definir rutas separadas
const { check } = require('express-validator'); // Validar datos de entrada


// Importamos middlewares personalizados:
// validarCampos → verifica los errores de validación de express-validator
// validarJWT → verifica que el token JWT sea válido en rutas protegidas
const { validarCampos, validarJWT } = require('../middlewares');

// Importamos los controladores
const { login, googleSignin, renovarToken, logout } = require('../controllers/auth');


// Creamos una instancia de Router
const router = Router();


// ---------------------
// RUTA DE LOGIN NORMAL
// ---------------------
router.post('/login', [
    // Validaciones:
    check('correo', 'El correo es obligatorio').isEmail(), 
    check('password', 'La contraseña es obligatoria').not().isEmpty(),
    validarCampos // Middleware que devuelve errores si alguna validación falla
], login);


// ---------------------
// RUTA LOGIN CON GOOGLE
// ---------------------
router.post('/login/google', [
    // Validación: el id_token enviado desde Google no puede estar vacío
    check('id_token', 'El id_token es necesario').not().isEmpty(),
    validarCampos // Middleware que verifica errores de validación
], googleSignin); 



// ---------------------
// RUTA LOGIN CON GOOGLE
// ---------------------
router.post('/logout', validarJWT, logout);


// ---------------------
// RUTA RENOVAR TOKEN
// ---------------------
router.get('/', validarJWT, renovarToken); 


module.exports = router;
