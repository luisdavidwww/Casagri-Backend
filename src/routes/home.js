const { Router } = require('express');
const { homeGet } = require('../controllers/home');

const router = Router();

router.get('/', homeGet);

module.exports = router;