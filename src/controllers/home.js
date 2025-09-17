const { response } = require('express');

const homeGet = (req, res = response) => {
  res.json({
    ok: true,
    msg: 'Backend activo 🚀'
  });
};

module.exports = {
  homeGet
};
