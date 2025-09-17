const { Schema, model } = require('mongoose');

// Subdocumento para la unidad de medida
const UnidadDeMedidaSchema = new Schema({
  Id: { type: Number },
  IdApi: { type: String },
  Nombre: { type: String },
  Conversiones: { type: [Schema.Types.Mixed], default: [] } // Array flexible
});

// Schema principal del producto
const ProductoMSchema = new Schema({
  counter: { type: Number }, // si lo necesitas para tu lógica
  Id: { type: Number, required: true, unique: true },
  IdApi: { type: String },
  Codigo: { type: String },
  CodigoFabricante: { type: String },
  CodigoEAN: { type: String },
  Nombre: { type: String },
  Nombre_interno: { type: String },
  Descripcion: { type: String, default: "" },
  Categorizacion1Id: { type: Number },
  Categorizacion2Id: { type: Number },
  Categorizacion3Id: { type: Number },
  Categorizacion4Id: { type: Number },
  Categorizacion5Id: { type: Number, default: 0 },
  Peso: { type: Number },
  ManejaStock: { type: Boolean, default: false },
  StockActual: { type: Number, default: 0 },
  StockMinimo: { type: Number, default: 0 },
  ManejaSuperficie: { type: Boolean, default: false },
  CantidadPermiteDecimales: { type: Boolean, default: false },
  UnidadesPorEnvase: { type: Number, default: 1 },
  UnidadesPorPedido: { type: Number, default: 1 },
  UnidadesMinimaVenta: { type: Number, default: 0 },
  ImagenUrl: { type: String, default: null },
  Etiquetas: { type: String, default: "" },
  Marca: { type: String },
  Publicado: { type: Boolean, default: true },
  Descuento: { type: Boolean, default: false },
  UnidadDeMedida: { type: UnidadDeMedidaSchema }
});

// Limpiar campos internos al retornar JSON
ProductoMSchema.methods.toJSON = function() {
  const { __v, _id, ...data } = this.toObject();
  return data;
}

module.exports = model('Articulo', ProductoMSchema);