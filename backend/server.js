import express from 'express';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { spawn } from 'child_process';
import { ethers } from 'ethers';
import pool from './db.js';
import cors from 'cors'; // 🔹 Importa il pacchetto CORS

import dotenv from 'dotenv';
dotenv.config();




const app = express();
const port = 3001;
app.use(express.json());

app.use(cors({
  origin: 'http://localhost:3000', 
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Ethereum (or EVM-compatible) setup
const provider = new ethers.JsonRpcProvider("https://json-rpc.evm.testnet.iotaledger.net");
const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, provider);
const contractAddress = "0xe74a564037D1ba828B7909A78877A41ff058637B";
const contractABI = [
    {
        "inputs": [
            { "internalType": "string", "name": "jsonData", "type": "string" }
        ],
        "name": "storeData",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": false, "internalType": "string", "name": "jsonData", "type": "string" }
        ],
        "name": "DataStored",
        "type": "event"
    }
];

const dataStorageContract = new ethers.Contract(contractAddress, contractABI, wallet);

const sendToIOTAEVM = async (sensorData) => {
  try {
      const jsonString = JSON.stringify(sensorData);
      console.log("⛓️ Sending JSON data to IOTAEVM:", jsonString);

      const tx = await dataStorageContract.storeData(jsonString);
      console.log(`📜 TX Hash: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

      return tx.hash;
  } catch (error) {
      console.error('❌ Error sending data to Ethereum:', error);
      return null;
  }
};
// 🔹 Configurazione SUI
// NOTE: Replace the URL with your actual RPC endpoint, e.g. devnet, testnet, or mainnet.
const suiClient = new SuiClient({ url: 'https://fullnode.devnet.sui.io:443' });

// Replace this private key with your actual Ed25519 private key
const suiPrivateKey = process.env.SUI_PRIVATE_KEY ;
const suiKeypair = Ed25519Keypair.fromSecretKey(Buffer.from(suiPrivateKey, 'hex'));

// 🔹 The new Move call target. 
//    Adjust the address if necessary. If you actually published the module
//    under your own address, replace `0x0` with the published package address.
const suiMoveCallTarget = '0x3e2cab734d48cef2ca6358051ce365a7ad78c6ce69cd01da3cb35bbe40612f62::DataStorage::store_json';

// 🔹 Generazione dati fittizi
const generateFakeSensorData = () => ({
  vehicle_id: `VEH-${Math.floor(Math.random() * 1000)}`,
  temperature: Math.floor(Math.random() * 100),
  humidity: Math.floor(Math.random() * 100),
  speed: Math.floor(Math.random() * 50),
  timestamp: Math.floor(Date.now() / 1000), // 🔹 Correct format for Solidity contract (uint256)
});

// 🔹 Invio dati a SUI
//    Now it sends a JSON-serialized version of the entire data object.
const sendToSui = async (sensorData) => {
  try {
    // 1. Convert the entire JSON object to a byte array
    const jsonString = JSON.stringify(sensorData);
    const dataBytes = new TextEncoder().encode(jsonString);
    
    const tx = new Transaction();
    tx.setSender(suiKeypair.getPublicKey().toSuiAddress());
    tx.setGasPrice(1000);
    tx.setGasBudget(10_000_000);
    
    tx.moveCall({
      target: suiMoveCallTarget,
      typeArguments: [],
      arguments: [
        tx.pure('vector<u8>', [...dataBytes]), 
        // Oppure: tx.pure.vector('u8', [...dataBytes])
      ],
    });
    

    // 4. Sign and execute the transaction
    const builtTx = await tx.build({ client: suiClient });
    const { bytes: txBytes, signature: txSignature } = await suiKeypair.signTransaction(builtTx);
    const suiResult = await suiClient.executeTransactionBlock({ transactionBlock: txBytes, signature: txSignature });
    
    // Return the transaction digest
    return suiResult.digest;
  } catch (error) {
    console.error('❌ Errore nell invio a SUI:', error);
    return null;
  }
};

// 🔹 Invio dati a IOTA tramite script Python
const sendToIOTA = async (sensorData) => {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', ['python/send_iota.py', JSON.stringify(sensorData)]);
    
    let result = '';
    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      console.error('❌ Errore script Python:', data.toString());
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve(result.trim());
      } else {
        reject(new Error('Errore nell esecuzione dello script Python'));
      }
    });
  });
};

// 🔹 Endpoint per inviare dati a SUI e IOTA
app.post('/send', async (req, res) => {
  const sensorData = req.body;
  console.log(`🚗 Received Sensor Data: ${JSON.stringify(sensorData, null, 2)}`);

  try {
      const ethTxHash = await sendToIOTAEVM(sensorData);
      const suiDigest = await sendToSui(sensorData);
      const iotaBlockId = await sendToIOTA(sensorData);
      const timestamp = Math.floor(Date.now()/1000);

      if (!ethTxHash || !suiDigest || !iotaBlockId) throw new Error('Transaction submission failed');

      console.log(`✅ IOTAEVM TX: https://explorer.evm.testnet.iotaledger.net/tx/${ethTxHash}`);
      console.log(`✅ Sui TX: https://suiscan.xyz/devnet/tx/${suiDigest}?network=devnet`);
      console.log(`✅ IOTA Block: https://explorer.iota.org/iota-testnet/block/${iotaBlockId}`);

      await pool.query(
        "INSERT INTO transactions (timestamp,iota_evm_tx,sui_tx,iota_block) VALUES ($1,$2,$3,$4)",
        [timestamp,ethTxHash,suiDigest,iotaBlockId]
      );

      res.status(200).json({ ethTxHash, suiDigest, iotaBlockId });
  } catch (error) {
      console.error('❌ Error:', error);
      res.status(500).json({ error: error.message });
  }
});

app.get('/transactions', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM transactions ORDER BY timestamp DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Errore nel recupero dati:", error);
    res.status(500).json({ error: "Errore nel recupero dati" });
  }
});

// 🔹 Avvio server Express
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server in esecuzione sulla porta ${port}`);
});

/*
✅ Transaction confirmed in block 628664
✅ IOTAEVM TX: https://explorer.evm.testnet.iotaledger.net/tx/0x22243a983392fa4882f03cf93497a6aa4127f4526e098ddcdcd4794edad47414
✅ Sui TX: https://devnet.suivision.xyz//txblock/EGYFxq446LaTkuZEVptMkUzvPGzLVmEkbMzNTb1V2tju?network=devnet
✅ IOTA Block: https://explorer.iota.org/iota-testnet/block/0x2a4ded683d95237302685cdf28af93587b4002f0592d1a71fd4cfc32b69af6ea
 
 */