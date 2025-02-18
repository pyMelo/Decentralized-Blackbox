import React, { useEffect, useState } from "react";
import { fetchIotaEvmTransaction } from "../utils/fetchIotaEvm";
import { fetchSuiTransaction } from "../utils/fetchSui";
import { fetchIotaDataOnlyTransaction } from "../utils/fetchIotaDataOnly";

// Helper function as defined above
function parseSensorDataString(hexMessage) {
  let jsonString = hexMessage.startsWith("0x") ? hexMessage.slice(2) : hexMessage;
  let parsedJSON;
  try {
    parsedJSON = JSON.parse(jsonString);
  } catch (err) {
    console.error("❌ Failed to parse JSON from message:", err);
    return null;
  }
  const sensorStr = parsedJSON.data;
  if (!sensorStr) return null;
  const tempRegex = /Temp:\s*([\d.]+)\s*C/;
  const humidityRegex = /Humidity:\s*(\d+)%/;
  const gyroRegex = /Gyro \(rad\/s\):\s*X:\s*([-\d.]+),\s*Y:\s*([-\d.]+),\s*Z:\s*([-\d.]+)/;
  const accelRegex = /Accel:\s*([\d.]+)\s*m\/s\^2/;
  const tempMatch = sensorStr.match(tempRegex);
  const humidityMatch = sensorStr.match(humidityRegex);
  const gyroMatch = sensorStr.match(gyroRegex);
  const accelMatch = sensorStr.match(accelRegex);
  const temperature = tempMatch ? tempMatch[1] : "N/A";
  const humidity = humidityMatch ? humidityMatch[1] : "N/A";
  let gyro_x = "N/A", gyro_y = "N/A", gyro_z = "N/A";
  if (gyroMatch) {
    gyro_x = gyroMatch[1];
    gyro_y = gyroMatch[2];
    gyro_z = gyroMatch[3];
  }
  const accel = accelMatch ? accelMatch[1] : "N/A";
  return { temperature, humidity, gyro_x, gyro_y, gyro_z, accel };
}

const TransactionDetails = ({ transaction }) => {
  const [iotaEvmDetails, setIotaEvmDetails] = useState(null);
  const [suiDetails, setSuiDetails] = useState(null);
  const [iotaDataOnlyDetails, setIotaDataOnlyDetails] = useState(null);

  useEffect(() => {
    if (transaction) {
      fetchIotaEvmTransaction(transaction.iota_evm_tx).then(setIotaEvmDetails);
      fetchSuiTransaction(transaction.sui_tx).then(setSuiDetails);
      fetchIotaDataOnlyTransaction(transaction.iota_block).then(setIotaDataOnlyDetails);
    }
  }, [transaction]);

  if (!transaction) return <div className="text-center text-muted">Seleziona una transazione</div>;

  const formatSensorData = (dataObj, source) => {
    let sensorData = null;
    if (source === "dataOnly" && dataObj.message) {
      sensorData = parseSensorDataString(dataObj.message);
    } else if (dataObj.sensorData) {
      sensorData = dataObj.sensorData;
      if (typeof sensorData === "object" && sensorData.data) {
        sensorData = parseSensorDataString("0x" + JSON.stringify(sensorData));
      }
    }
    if (!sensorData) return <p className="text-muted">Dati non disponibili</p>;

    return (
      <>
        <p className="text-muted"><strong>🌡️ Temperature:</strong> {sensorData.temperature || "N/A"} °C</p>
        <p className="text-muted"><strong>💧 Humidity:</strong> {sensorData.humidity || "N/A"} %</p>
        <p className="text-muted">
          <strong>🌀 Gyroscope:</strong> X: {sensorData.gyro_x || "N/A"} rad/s, Y: {sensorData.gyro_y || "N/A"} rad/s, Z: {sensorData.gyro_z || "N/A"} rad/s
        </p>
        <p className="text-muted"><strong>⚡ Acceleration:</strong> {sensorData.accel || "N/A"} m/s²</p>
      </>
    );
  };

  return (
    <div className="container mt-4">
      <h3 className="text-center text-primary mb-3">Dettagli Transazione</h3>
      <div className="row">
        {/* SUI Details */}
        <div className="col-md-4 border p-4 rounded shadow-sm bg-light text-break">
          <h5 className="text-dark">SUI</h5>
          {suiDetails ? (
            <>
              <p className="text-muted"><strong>TX Digest:</strong> {suiDetails.digest}</p>
              <p className="text-muted"><strong>Sender:</strong> {suiDetails.sender}</p>
              <p className="text-muted"><strong>Gas Budget:</strong> {suiDetails.gasBudget}</p>
              <p className="text-muted"><strong>Executed At:</strong> {suiDetails.executedAt}</p>
              {formatSensorData(suiDetails, "sui")}
              <div className="mt-3">
                <a
                  href={`https://suiscan.xyz/devnet/tx/${suiDetails.digest}?network=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-link text-primary"
                >
                  Clicca qui per l'explorer
                </a>
              </div>
            </>
          ) : (
            <p className="text-muted">Loading...</p>
          )}
        </div>

        {/* IOTA EVM Details */}
        <div className="col-md-4 border p-4 rounded shadow-sm bg-light text-break">
          <h5 className="text-dark">IOTA EVM</h5>
          {iotaEvmDetails ? (
            <>
              <p className="text-muted"><strong>Hash:</strong> {iotaEvmDetails.hash}</p>
              <p className="text-muted"><strong>From:</strong> {iotaEvmDetails.from}</p>
              <p className="text-muted"><strong>To:</strong> {iotaEvmDetails.to}</p>
              <p className="text-muted"><strong>Value:</strong> {iotaEvmDetails.value} IOTA</p>
              <p className="text-muted"><strong>Block:</strong> {iotaEvmDetails.blockNumber}</p>
              {formatSensorData(iotaEvmDetails, "evm")}
              <div className="mt-3">
                <a
                  href={`https://explorer.evm.testnet.iotaledger.net/tx/${iotaEvmDetails.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-link text-primary"
                >
                  Clicca qui per l'explorer
                </a>
              </div>
            </>
          ) : (
            <p className="text-muted">Loading...</p>
          )}
        </div>

        {/* IOTA Data-Only Details */}
        <div className="col-md-4 border p-4 rounded shadow-sm bg-light text-break">
          <h5 className="text-dark">IOTA Data-Only</h5>
          {iotaDataOnlyDetails ? (
            <>
              <p className="text-muted"><strong>Block ID:</strong> {iotaDataOnlyDetails.blockId}</p>
              <p className="text-muted"><strong>Tag:</strong> {iotaDataOnlyDetails.tag}</p>
              <p className="text-muted"><strong>Message:</strong> {iotaDataOnlyDetails.message}</p>
              <p className="text-muted"><strong>Timestamp:</strong> {iotaDataOnlyDetails.timestamp || "Unknown"}</p>
              {formatSensorData(iotaDataOnlyDetails, "dataOnly")}
              <div className="mt-3">
                <a
                  href={`https://explorer.iota.org/iota-testnet/block/${iotaDataOnlyDetails.blockId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-link text-primary"
                >
                  Clicca qui per l'explorer
                </a>
              </div>
            </>
          ) : (
            <p className="text-muted">Loading...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionDetails;
