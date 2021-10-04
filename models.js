const {DataTypes, Model, Sequelize} = require('sequelize');
const sequelize = require('./sequelize');

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('pvu', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true
        },
        pvu_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        pvu_token_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        status: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        pvu_type: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        le: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        hour: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        le_hour: {
            type: DataTypes.DECIMAL,
            allowNull: false
        },
        pvu_price: {
            type: DataTypes.DECIMAL,
            allowNull: false
        },
        pvu_le_hour_price: {
            type: DataTypes.DECIMAL,
            allowNull: false
        },
        pvu_url: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        created_at: {
            type: 'TIMESTAMP',
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            allowNull: false
        },
        updated_at: {
            type: 'TIMESTAMP',
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            allowNull: false
        },
        discord_alert: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
        rent: {
            type: DataTypes.DECIMAL,
            allowNull: false
        },
        plant_type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        icon_url: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        rarity: {
            type: DataTypes.STRING,
            allowNull: true
        },
        pvu_json: {
            type: DataTypes.JSON,
            allowNull: true
        },
    }, {
        // Other model options go here
        sequelize, // We need to pass the connection instance
        // modelName: 'Pvu', // We need to choose the model name
        tableName: 'pvus',
        timestamps: true
    });
};