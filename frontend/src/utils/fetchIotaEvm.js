import { ethers } from "ethers";

const RPC_URL = "https://json-rpc.evm.testnet.iotaledger.net";
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Helper function to decode a Solidity-encoded string
function decodeSolidityString(hexData) {
  // Remove leading "0x"
  let data = hexData.replace(/^0x/, "");

  // 1) Skip the first 8 hex chars (4 bytes) => function selector
  data = data.slice(8);

  // 2) The next 64 hex chars = the offset (where the string starts)
  //    We typically don't need the offset's value, but we must remove it.
  data = data.slice(64);

  // 3) The next 64 hex chars = the string length in bytes
  const lengthHex = data.slice(0, 64);
  data = data.slice(64);

  // Convert length to decimal
  const stringByteLength = parseInt(lengthHex, 16);

  // 4) Read exactly `stringByteLength` bytes of hex for the string
  const stringHex = data.slice(0, stringByteLength * 2); // 1 byte = 2 hex chars

  // 5) Convert hex to UTF-8
  const decoded = ethers.toUtf8String("0x" + stringHex);

  return decoded;
}

// Main function to fetch transaction details
export const fetchIotaEvmTransaction = async (txHash) => {
  try {
    console.log(`🔍 Fetching IOTAEVM transaction: ${txHash}`);

    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      console.error("❌ Transaction not found on IOTAEVM.");
      return null;
    }

    const txReceipt = await provider.getTransactionReceipt(txHash);
    if (!txReceipt) {
      console.error("❌ Transaction receipt not found.");
      return null;
    }

    // The raw input data from the transaction
    const inputData = tx.data;
    let sensorData = null;

    if (inputData && inputData.length > 10) {
      try {
        // Decode the ABI-encoded string from the inputData
        const decodedInput = decodeSolidityString(inputData);

        console.log("✅ Decoded Input:", decodedInput);

        // Attempt to parse JSON from the decoded string
        // Usually something like: {"data":"some text ..."}
        const jsonMatch = decodedInput.match(/\{.*\}/);
        if (jsonMatch) {
          sensorData = JSON.parse(jsonMatch[0]);
        } else {
          console.warn("⚠️ No valid JSON found in the decoded input data.");
        }
      } catch (error) {
        console.error("❌ JSON parsing failed:", error);
      }
    }

    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: ethers.formatEther(tx.value),
      blockNumber: tx.blockNumber,
      gasUsed: txReceipt.gasUsed.toString(),
      sensorData, // acceleration, gyroscope, etc. if present
    };
  } catch (error) {
    console.error("❌ Error fetching IOTAEVM transaction:", error);
    return null;
  }
};
