require('dotenv').config();
const Server = require('./src/models/sever');

const server = new Server();
server.listen();