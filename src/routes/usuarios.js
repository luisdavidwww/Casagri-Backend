
const { Router } = require('express');
const { check } = require('express-validator');

const { usuariosGet, usuariosPost, usuariosGooglePost, usuariosDelete } = require('../controllers/usuarios');

const { validarJWT, validarCampos, tieneRole } = require('../middlewares');

const { existeUsuarioPorId } = require('../helpers/db-validators');


const router = Router();


router.get('/', usuariosGet );

router.post('/',[
    check('nombre', 'El nombre es obligatorio').not().isEmpty(),
    check('password', 'La contraseña debe de ser más de 6 letras').isLength({ min: 6 }),
    check('correo', 'El correo no es válido').isEmail(),
    validarCampos
], usuariosPost );

router.post('/google',[
], usuariosGooglePost );


router.delete('/:id',[
    validarJWT,
    // esAdminRole,
    //tieneRole('ADMIN_ROLE', 'VENTAR_ROLE','OTRO_ROLE'),
    check('id', 'No es un ID válido').isMongoId(),
    check('id').custom( existeUsuarioPorId ),
    validarCampos
],usuariosDelete );



module.exports = router;