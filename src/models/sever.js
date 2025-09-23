const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;

    this.paths = {
      home: '/home',
      usuarios: '/api/usuarios',
      auth: '/api/auth',
      productos: '/api/productos',
      categorias: '/api/categorias',
    };

    this.connectDB();
    this.middlewares();
    this.routes();
  }

  async connectDB() {
    try {
      await mongoose.connect(process.env.MONGODB_CNN);
      console.log('MongoDB conectado ✅');
    } 
    catch (error) {
      console.error('Error conectando a MongoDB ❌', error);
    }
  }

  middlewares() {
    // Habilitar CORS
    this.app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "http://localhost:5173", "http://casagriprueba.casagri-group.com");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
    next();
  });

    // Parsear JSON
    this.app.use(express.json());
  }

  routes() {
    this.app.get('/', (req, res) => {
      res.json({ msg: 'API funcionando 🚀' });
    });
    this.app.use(this.paths.home, require('../routes/home'));
    this.app.use(this.paths.usuarios, require('../routes/usuarios'));
    this.app.use(this.paths.auth, require('../routes/auth'));
    this.app.use(this.paths.productos, require('../routes/productos'));
    this.app.use(this.paths.categorias, require('../routes/categorias'));
  }

  listen() {
    this.app.listen(this.port, () => {
      console.log(`Servidor corriendo en http://localhost:${this.port}`);
    });
  }
}

module.exports = Server;
