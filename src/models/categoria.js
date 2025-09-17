const { Schema, model } = require('mongoose');

const CategoriaSchema = Schema({
  Id: { type: Number, required: true },
  IdApi: { type: String, required: true },
  Nombre: { type: String, required: true },
  Nivel: { type: Number, default: 1 },
  ImagenUrl: { type: String, default: "" },
  ModificadoFecha: { type: String, default: "" },
});

CategoriaSchema.methods.toJSON = function () {
  const { __v, ...data } = this.toObject();
  return data;
};

module.exports = model('Categoria', CategoriaSchema);
