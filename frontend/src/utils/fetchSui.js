import { SuiClient } from '@mysten/sui/client';

// Connetti al Devnet (modifica per mainnet se necessario)
const client = new SuiClient({ url: 'https://fullnode.devnet.sui.io:443' });

// Helper per ottenere il prezzo in EUR da CoinGecko (per SUI)
async function getPriceInEur(coinId = "sui") {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=eur`;
    const resp = await fetch(url);
    const data = await resp.json();
    return data[coinId].eur; // es. data.sui.eur
  } catch (error) {
    console.error("❌ Error fetching price from CoinGecko:", error);
    return 0;
  }
}

export const fetchSuiTransaction = async (txDigest) => {
  try {
    console.log(`🔍 Fetching SUI transaction: ${txDigest}`);

    // Richiedi anche gli effetti per ottenere il gas usato
    const transactionDetails = await client.getTransactionBlock({
      digest: txDigest,
      options: {
        showInput: true,
        showEffects: true,
        showEvents: false,
        showObjectChanges: false,
        showBalanceChanges: false,
      },
    });

    if (
      !transactionDetails ||
      !transactionDetails.transaction ||
      !transactionDetails.transaction.data
    ) {
      console.log("❌ No transaction data found.");
      return null;
    }

    // Estrai il sensorData dagli input (come già fatto)
    const inputs = transactionDetails.transaction.data.transaction.inputs;
    let sensorData = null;
    for (const input of inputs) {
      if (input.type === "pure" && typeof input.value === "string") {
        try {
          sensorData = JSON.parse(input.value);
          break;
        } catch (e) {
          continue;
        }
      }
    }

    // Calcolo del costo: ipotizziamo di ottenere gasUsed dagli effetti
    let fee = { coin: "0.000", eur: "0.00" };
    if (
      transactionDetails.effects &&
      transactionDetails.effects.gasUsed !== undefined
    ) {
      // Supponiamo che gasUsed sia un numero (o una stringa numerica) che rappresenta il numero di unità di gas usate
      // E supponiamo che il prezzo del gas sia fisso a 1000 MIST per unità
      const gasUsed = Number(transactionDetails.effects.gasUsed);
      const gasPriceMist = 1000; // esempio
      const totalCostMist = gasUsed * gasPriceMist; // in MIST
      const costInSui = totalCostMist / 1e9; // 1 SUI = 1e9 MIST

      const priceInEur = await getPriceInEur("sui"); // Ottieni prezzo in EUR
      const costInEur = costInSui * priceInEur;

      fee = {
        coin: costInSui.toFixed(6),
        eur: costInEur.toFixed(6),
      };
    }

    return {
      digest: transactionDetails.digest,
      sender: transactionDetails.transaction.data.sender,
      gasBudget: transactionDetails.transaction.data.gasBudget,
      executedAt: transactionDetails.timestampMs
        ? new Date(parseInt(transactionDetails.timestampMs)).toISOString()
        : "Unknown",
      sensorData,
      fee, // costo calcolato
    };
  } catch (error) {
    console.error("❌ Error fetching SUI transaction:", error);
    return null;
  }
};
