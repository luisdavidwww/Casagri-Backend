const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
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
    this.app.use(express.json());
  }

  routes() {
    this.app.get('/', (req, res) => {
      res.json({ msg: 'API funcionando 🚀' });
    });
  }

  listen() {
    this.app.listen(this.port, () => {
      console.log(`Servidor corriendo en http://localhost:${this.port}`);
    });
  }
}

module.exports = Server;