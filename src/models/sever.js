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
    };

    this.connectDB();
    this.middlewares();
    this.routes();
  }

  async connectDB() {
    try {
      await mongoose.connect(process.env.MONGODB_CNN);
      console.log('MongoDB conectado ✅');
    } catch (error) {
      console.error('Error conectando a MongoDB ❌', error);
    }
  }

  middlewares() {
    // Habilitar CORS
    this.app.use(cors({
      origin: 'http://localhost:5173', // tu frontend
      credentials: true
    }));

    // Parsear JSON
    this.app.use(express.json());
  }

  routes() {
    this.app.get('/', (req, res) => {
      res.json({ msg: 'API funcionando 🚀' });
    });

    this.app.use(this.paths.usuarios, require('../routes/usuarios'));
    this.app.use(this.paths.auth, require('../routes/auth'));
  }

  listen() {
    this.app.listen(this.port, () => {
      console.log(`Servidor corriendo en http://localhost:${this.port}`);
    });
  }
}

module.exports = Server;
