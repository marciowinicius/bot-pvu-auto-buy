require('dotenv').config()

const os = require("os");
const Web3 = require("web3");
const abiDecoder = require('abi-decoder');
// const HDWalletProvider = require("@truffle/hdwallet-provider");

// const web3 = new Web3('wss://bsc.getblock.io/mainnet/?api_key=4a86ff72-bb5b-403f-a077-9548a88b2b20');
// const web3 = new Web3('wss://speedy-nodes-nyc.moralis.io/955149a22a9a018aea8cdb00/bsc/mainnet/ws');
// const web3 = new Web3('wss://bsc-ws-node.nariox.org:443');
// const web3 = new Web3('wss://odenir:TupiDoBrasil25$@apis-sj.ankr.com/wss/9725e57cc94147e9ae4b43481a5a7cdf/7450cdc071967672eb2581cd3e7ca9c6/binance/full/main');
const providerWss = 'wss://bsc.getblock.io/mainnet/?api_key=4a86ff72-bb5b-403f-a077-9548a88b2b20';
const web3 = new Web3(providerWss);

// ADDRESS READ
const abiReadAndSellAuction = require("./abi.json");
abiDecoder.addABI(abiReadAndSellAuction);
const addressReadAndSellAuction = process.env.CONTRACT_ADDRESS

// ADDRESS BID
const contractAddressBid = process.env.CONTRACT_ADDRESS_BID
const abiBid = require("./abi_bid.json");
const web3Bid = new Web3('https://bsc-dataseed1.binance.org:443');
const contractBid = new web3Bid.eth.Contract(abiBid, contractAddressBid);

// ACCOUNT BID
const privateKeyAccountBid = '0x' + process.env.AUTO_BUY_ADDRESS_PRIVATE_KEY
const account = web3Bid.eth.accounts.privateKeyToAccount(privateKeyAccountBid);
web3Bid.eth.accounts.wallet.add(account);
web3Bid.eth.defaultAccount = account.address;

// const localKeyProvider = new HDWalletProvider({
//     privateKeys: [privateKeyAccountBid],
//     providerOrUrl: provider,
// });

const {Webhook, MessageBuilder} = require('discord-webhook-node');

const sequelize = require('./sequelize');
const {QueryTypes} = require('sequelize');

const PVU_FRONT_URL = 'https://marketplace.plantvsundead.com/offering/bundle#/plant/'
const PRICE_PVU_OUT = 500
const MONTH_HOURS = 720
const BSC_URL = 'https://bscscan.com/address/0x926eae99527a9503eaDb4c9e927f21f84f20C977#writeContract'

const NodeCache = require("node-cache");
const myCache = new NodeCache();

execute()

// async function execute() {
//     let options = {
//         fromBlock: 0,
//         address: contractAddressBid,    //Only get events from specific addresses
//         topics: ['0xa9c8dfcda5664a5a124c713e386da27de87432d5b668e79458501eb296389ba7']                              //What topics to subscribe to
//     };
//
//     let subscription = web3.eth.subscribe('logs', options, (err, event) => {
//         if (!err) {
//             console.log('error event:', event.transactionHash)
//         }
//     });
//     subscription.on('data', event => {
//         web3.eth.getTransaction(event.transactionHash, (err, transaction) => {
//             if (transaction) {
//                 processInput(transaction.input).catch(r => {
//                     console.log("DEU RUIM")
//                 })
//             }
//         })
//     })
// }

async function execute() {
    web3.eth.subscribe('pendingTransactions', (err, txHash) => {
        if (err) console.log(err);
    }).on("data", function (txHash) {
        // console.log(txHash)
        web3.eth.getTransaction(txHash, async (err, transaction) => {
            if (transaction) {
                checkTransaction(transaction)
            }
        })
    });
}

async function checkTransaction(transaction) {
    let cache = await myCache.get("transaction_" + transaction.hash)
    if ((typeof cache === "undefined") && transaction.to && transaction.to.toLowerCase() == addressReadAndSellAuction) {

        processInput(transaction).catch(r => {
            console.log("DEU RUIM")
        })
    }
}

async function processInput(transaction) {
    const decodedData = abiDecoder.decodeMethod(transaction.input);

    if ((typeof decodedData.params == 'undefined') || decodedData.params == null) {
        return
    }

    let tokenID = ""
    let price = ""
    decodedData.params.forEach(element => {
        if (element.name === '_tokenId') {
            tokenID = element.value
        }
        if (element.name === '_startingPrice') {
            price = element.value
        }
    });
    if (tokenID === "") {
        return
    }
    let pvuData = await getPvuData(tokenID)

    if (pvuData) {
        console.log('Já foi encontrado anteriormente e é revenda.')
        return
    }

    getPlantId(tokenID, price, transaction)
}

async function getPvuData(tokenId) {
    let cache = await myCache.get("get_pvu_data_" + tokenId)

    if (typeof cache !== "undefined") {
        console.log('get_pvu_data_from_cache')
        return cache
    }

    let query = await sequelize
        .query("SELECT * FROM pvus WHERE pvu_token_id = :pvu_token_id AND created_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY);",
            {
                type: QueryTypes.SELECT,
                plain: true,
                replacements: {pvu_token_id: tokenId},
                raw: true
            }
        );

    myCache.set("get_pvu_data_" + tokenId, query, 150)

    return query
}

async function getPvuDataInformation(plantIdNumber) {
    let cache = await myCache.get("get_pvu_data_information_" + plantIdNumber)

    if (typeof cache !== "undefined") {
        console.log('get_pvu_data_information_from_cache')
        return cache
    }

    let query = await sequelize
        .query("SELECT * FROM pvu_nft_informations WHERE pvu_plant_id = :plant_id_number;",
            {
                type: QueryTypes.SELECT,
                plain: true,
                replacements: {plant_id_number: plantIdNumber},
                raw: true
            }
        );

    myCache.set("get_pvu_data_information_" + plantIdNumber, query, 50000)

    return query
}

const contractReadAndSellAuction = new web3.eth.Contract(abiReadAndSellAuction, addressReadAndSellAuction)
const getPlantId = async function (tokenId, price, transaction) {
    contractReadAndSellAuction.methods.getPlant(tokenId).call().then(data => {
        getPlantInformations(data.plantId, price, tokenId, transaction)
    })
}

const getPlantInformations = async function (plantId, price, tokenId, transaction) {
    let realPrice = parsePrice(price)
    let plantPvuIdNumber = getPlantPvuIdNumber(plantId)
    let pvuDataInformation = await getPvuDataInformation(plantPvuIdNumber)

    let plantPvuTypeNumber = getPlantPvuTypeNumber(plantId)
    let plantPvuRarityNumber = getPlantPvuRarityNumber(plantId)
    let plantPvuRarityLE = getPlantPvuRarityLE(plantPvuRarityNumber, pvuDataInformation)

    let leHour = parseFloat(parseFloat(plantPvuRarityLE.le) / parseFloat(pvuDataInformation.cycle))
    let informations = {
        pvu_id: plantId,
        pvu_token_id: tokenId,
        status: 1,
        pvu_type: plantPvuTypeNumber,
        le: plantPvuRarityLE.le,
        hour: pvuDataInformation.cycle,
        le_hour: leHour,
        pvu_price: realPrice,
        pvu_le_hour_price: realPrice / leHour,
        discord_alert: 0,
        pvu_url: PVU_FRONT_URL + plantId,
        rent: (leHour * MONTH_HOURS) / PRICE_PVU_OUT / realPrice,
        plant_type: pvuDataInformation.element,
        icon_url: null,
        rarity: plantPvuRarityLE.rarity,
        pvu_json: null,
        price: price,
        buy: false,
        reseller_price: null,
        gasLimit: 0,
        gasUsed: 0
    }

    informations = await analyzeNFT(informations)

    // buyNFT(informations)

    if (informations.buy === true && informations.reseller_price != null && informations.reseller_price > 0) {
        buyNFT(informations, transaction)
    }

    savePvuDataInformation(informations)
}

async function estimateGas(data, nonce) {
    web3.eth.estimateGas({
        "from": account.address,
        "nonce": nonce,
        "to": contractAddressBid,
        "data": data
    }).then(r =>
        console.log(r)
    ).catch(err =>
        console.log(err)
    );
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function buyNFT(informations, transaction) {
    // let nonce = (await web3.eth.getTransactionCount(account.address)) + 1
    // var block = await web3.eth.getBlock("latest");
    // var gasLimit = block.gasLimit/block.transactions.length;
    // console.log('nonce: ',nonce)
    let contractBidData = contractBid.methods.bid(informations.pvu_token_id, informations.price).encodeABI()

    let tx = {
        // this could be provider.addresses[0] if it exists
        // from: account.address,
        // target address, this could be a smart contract address
        to: contractAddressBid,
        // optional if you want to specify the gas limit
        gas: web3Bid.utils.toHex(500000),
        gasPrice: web3Bid.utils.toHex(await web3Bid.utils.toWei('5', 'gwei')),
        contractAddress: contractAddressBid,
        // nonce: 58,
        // optional if you are invoking say a payable function
        // value: web3.utils.toHex(informations.reseller_price),
        // this encodes the ABI of the method and the arguements
        data: contractBidData
    };

    // let txReceipt = await getTransactionReceipt(transaction.hash)
    // console.log('tx receipt test:', txReceipt)

    const signPromise = web3Bid.eth.accounts.signTransaction(tx, privateKeyAccountBid);

    signPromise.then((signedTx) => {
        console.log(signedTx)
        // raw transaction string may be available in .raw or
        // .rawTransaction depending on which signTransaction
        // function was called
        let sentTx = web3Bid.eth.sendSignedTransaction(signedTx.rawTransaction);
        sentTx.on("receipt", receipt => {
            console.log('SUCCESS BUY: ', receipt)
            // sellNFT(informations)
        });
        sentTx.on("error", err => {
            console.log('error BID:', err)
        });
    }).catch((err) => {
        console.log('error sign promise:', err)
    });
}

async function getTransactionReceipt(hash) {
    let txReceipt = await web3.eth.getTransactionReceipt(hash)
    console.log('tx receipt:', txReceipt)
    if (!txReceipt){
        await getTransactionReceipt(hash)
    }
    return txReceipt
}

async function sellNFT(informations) {
    let timeStampUTCNow = ((new Date((new Date(new Date().setDate(new Date().getDate() + 1000))).toUTCString())).getTime()) / 1000
    contractReadAndSellAuction.methods.createSaleAuction(
        informations.pvu_token_id,
        informations.reseller_price,
        informations.reseller_price,
        timeStampUTCNow
    ).send({
        from: web3.eth.defaultAccount,
        gas: web3.utils.toHex(30000000)
    }).then(function (result) {
        console.log('SUCCESS SELL: ', result)
    }).catch(function (err) {
        console.log('error SELL: ', err)
    });
}


async function getBasePriceByElement(element) {
    let cache = await myCache.get("get_base_price_by_element_" + element)

    if (typeof cache !== "undefined") {
        console.log('get_base_price_by_element_from_cache')
        return cache
    }

    let query = await sequelize
        .query("SELECT * FROM pvu_element_prices WHERE element = :element;",
            {
                type: QueryTypes.SELECT,
                plain: true,
                replacements: {element: element},
                raw: true
            }
        );

    myCache.set("get_base_price_by_element_" + element, query, 30)

    return query
}


async function analyzeNFT(informations) {
    let basePriceInformation = await getBasePriceByElement(informations.plant_type)
    let basePrice = basePriceInformation ? basePriceInformation.price : 10

    informations.reseller_price = basePriceInformation.reseller_price

    // if (informations.status == 1 && informations.pvu_price <= basePrice && informations.pvu_le_hour_price <= 8
    //     && informations.hour <= 360 && informations.rent >= 0.15 && informations.plant_type == 'DARK'
    // ) {
    //     informations.discord_alert = 1
    //     informations.buy = false
    // }

    if (informations.status == 1 && informations.pvu_price <= basePrice && informations.plant_type == 'DARK'
    ) {
        informations.discord_alert = 1
        informations.buy = true
    }

    // if (informations.status == 1 && informations.pvu_price <= basePrice && informations.pvu_le_hour_price <= 8
    //     && informations.hour <= 360 && informations.rent >= 0.15 && informations.plant_type == 'LIGHT'
    // ) {
    //     informations.discord_alert = 1
    //     informations.buy = false
    // }

    if (informations.status == 1 && informations.pvu_price <= basePrice && informations.plant_type == 'LIGHT'
    ) {
        informations.discord_alert = 1
        informations.buy = true
    }

    // if (informations.status == 1 && informations.pvu_price <= basePrice && informations.pvu_le_hour_price <= 8
    //     && informations.hour <= 168 && informations.rent >= 0.15 && informations.plant_type == 'FIRE'
    // ) {
    //     informations.discord_alert = 1
    //     informations.buy = true
    // }

    if (informations.status == 1 && informations.pvu_price <= basePrice && informations.plant_type == 'FIRE'
    ) {
        informations.discord_alert = 1
        informations.buy = true
    }

    // if (informations.status == 1 && informations.pvu_price <= basePrice && informations.pvu_le_hour_price <= 8
    //     && informations.hour <= 168 && informations.rent >= 0.15 && informations.plant_type == 'WATER'
    // ) {
    //     informations.discord_alert = 1
    //     informations.buy = true
    // }

    if (informations.status == 1 && informations.pvu_price <= basePrice && informations.plant_type == 'WATER'
    ) {
        informations.discord_alert = 1
        informations.buy = true
    }

    // if (informations.status == 1 && informations.pvu_price <= basePrice && informations.pvu_le_hour_price <= 8
    //     && informations.hour <= 168 && informations.rent >= 0.15 && informations.plant_type == 'ICE'
    // ) {
    //     informations.discord_alert = 1
    //     informations.buy = false
    // }

    if (informations.status == 1 && informations.pvu_price <= basePrice && informations.plant_type == 'ICE'
    ) {
        informations.discord_alert = 1
        informations.buy = true
    }

    // if (informations.status == 1 && informations.pvu_price <= basePrice && informations.pvu_le_hour_price <= 8
    //     && informations.hour <= 168 && informations.rent >= 0.15 && informations.plant_type == 'ELETRIC'
    // ) {
    //     informations.discord_alert = 1
    //     informations.buy = false
    // }

    if (informations.status == 1 && informations.pvu_price <= basePrice && informations.plant_type == 'ELETRIC'
    ) {
        informations.discord_alert = 1
        informations.buy = true
    }

    // if (informations.status == 1 && informations.pvu_price <= basePrice && informations.pvu_le_hour_price <= 8
    //     && informations.hour <= 480 && informations.rent >= 0.15 && informations.plant_type == 'METAL'
    // ) {
    //     informations.discord_alert = 1
    //     informations.buy = false
    // }

    if (informations.status == 1 && informations.pvu_price <= basePrice && informations.plant_type == 'METAL'
    ) {
        informations.discord_alert = 1
        informations.buy = true
    }

    // if (informations.status == 1 && informations.pvu_price <= basePrice && informations.pvu_le_hour_price <= 8
    //     && informations.hour <= 168 && informations.rent >= 0.15 && informations.plant_type == 'WIND'
    // ) {
    //     informations.discord_alert = 1
    //     informations.buy = false
    // }

    if (informations.status == 1 && informations.pvu_price <= basePrice && informations.plant_type == 'WIND'
    ) {
        informations.discord_alert = 1
        informations.buy = true
    }

    // if (informations.status == 1 && informations.pvu_price <= basePrice && informations.pvu_le_hour_price <= 8
    //     && informations.hour <= 168 && informations.rent >= 0.15 && informations.plant_type == 'PARASITE'
    // ) {
    //     informations.discord_alert = 1
    //     informations.buy = true
    // }

    if (informations.status == 1 && informations.pvu_price <= basePrice && informations.plant_type == 'PARASITE'
    ) {
        informations.discord_alert = 1
        informations.buy = true
    }

    return informations
}

function parsePrice(price) {
    let priceDecimals = price.substr(price.length - 18)
    let priceDozens = price.substr(0, price.length - 18)

    return parseFloat("" + priceDozens + "." + priceDecimals)
}

async function savePvuDataInformation(informations) {
    sequelize
        .query("INSERT INTO pvus (pvu_id, pvu_token_id, status, pvu_type, le, hour, le_hour, pvu_price, pvu_le_hour_price, pvu_url, created_at, updated_at, discord_alert, rent, plant_type, icon_url, rarity, pvu_json) " +
            "VALUES (:pvu_id, :pvu_token_id, :status, :pvu_type, :le, :hour, :le_hour, :pvu_price, :pvu_le_hour_price, :pvu_url, NOW(), NOW(), :discord_alert, :rent, :plant_type, :icon_url, :rarity, :pvu_json);",
            {
                type: QueryTypes.INSERT,
                replacements: informations,
                raw: true
            }
        );
}

const getPlantPvuRarityLE = function (rarityNumber, pvuDataInformation) {
    let rarity = ''
    let le = 0
    if (rarityNumber >= 0 && rarityNumber <= 59) {
        rarity = 'COMMON'
        le = pvuDataInformation.common_base + (pvuDataInformation.le_factor * (rarityNumber - 0))
    } else if (rarityNumber >= 60 && rarityNumber <= 88) {
        rarity = 'UNCOMMON'
        le = pvuDataInformation.uncommon_base + (pvuDataInformation.le_factor * (rarityNumber - 60))
    } else if (rarityNumber >= 89 && rarityNumber <= 98) {
        rarity = 'RARE'
        le = pvuDataInformation.rare_base + (pvuDataInformation.le_factor * (rarityNumber - 89))
    } else {
        rarity = 'MYTHIC'
        le = pvuDataInformation.mythic_base + (pvuDataInformation.le_factor * (rarityNumber - 99))
    }

    return {rarity: rarity, le: le}
}

const getPlantPvuTypeNumber = function (plantId) {
    return plantId.charAt(0)
}

const getPlantPvuIdNumber = function (plantId) {
    return plantId.substr(3, 2)
}

const getPlantPvuRarityNumber = function (plantId) {
    return plantId.substr(6, 2)
}