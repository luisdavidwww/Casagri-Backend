
const { Router } = require('express');
const { check } = require('express-validator');

const { usuariosGet, usuariosPost } = require('../controllers/usuarios');



const {
    validarCampos,
} = require('../middlewares');



const router = Router();


router.get('/', usuariosGet );

router.post('/',[
    check('nombre', 'El nombre es obligatorio').not().isEmpty(),
    check('password', 'La contraseña debe de ser más de 6 letras').isLength({ min: 6 }),
    check('correo', 'El correo no es válido').isEmail(),
    validarCampos
], usuariosPost );



module.exports = router;