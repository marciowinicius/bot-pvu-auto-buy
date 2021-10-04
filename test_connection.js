require('dotenv').config()
const database = require('./sequelize');

database.authenticate()
    .then((result) => {
        console.log('DEU CERTO');
    })
    .catch((error) => {
        console.log('DEU RUIM: ', error);
    });