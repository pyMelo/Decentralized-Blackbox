  import React, { useState, useEffect } from "react";
  import axios from "axios";
  import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
  import "bootstrap/dist/css/bootstrap.min.css";
  import TransactionDetails from "./TransactionDetails";
  import { fetchIotaEvmTransaction } from "../utils/fetchIotaEvm";
  import { fetchSuiTransaction } from "../utils/fetchSui";
  import { fetchIotaDataOnlyTransaction } from "../utils/fetchIotaDataOnly";

  // Funzione helper per il parsing dei dati sensoriali
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
    // Estrae il valore reale di accelerazione oppure restituisce null se non presente
    const accel = accelMatch ? parseFloat(accelMatch[1]) : null;
    return { accel };
  }

  const TransactionGraph = () => {
    const [data, setData] = useState([]);
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    // 🔹 Fetch delle transazioni dal backend
    const fetchData = async () => {
      try {
        const response = await axios.get("http://localhost:3001/transactions");
        const transactions = response.data;

        const formattedData = await Promise.all(
          transactions.map(async (tx) => {
            let accel = null;

            // 🔹 Fetch della transazione IOTA EVM e estrazione dell'accelerazione
            if (tx.iota_evm_tx) {
              const evmData = await fetchIotaEvmTransaction(tx.iota_evm_tx);
              if (evmData?.sensorData) {
                let sensorData = evmData.sensorData;
                if (typeof sensorData === "object" && sensorData.data) {
                  sensorData = parseSensorDataString("0x" + JSON.stringify(sensorData));
                }
                accel = sensorData?.accel || null;
              }
            }

            // 🔹 Fetch della transazione SUI e estrazione dell'accelerazione
            if (!accel && tx.sui_tx) {
              const suiData = await fetchSuiTransaction(tx.sui_tx);
              if (suiData?.sensorData) {
                let sensorData = suiData.sensorData;
                if (typeof sensorData === "object" && sensorData.data) {
                  sensorData = parseSensorDataString("0x" + JSON.stringify(sensorData));
                }
                accel = sensorData?.accel || null;
              }
            }

            // 🔹 Fetch della transazione IOTA Data-Only e estrazione dell'accelerazione dal messaggio JSON
            if (!accel && tx.iota_block) {
              const iotaData = await fetchIotaDataOnlyTransaction(tx.iota_block);
              if (iotaData?.message) {
                const sensorData = parseSensorDataString(iotaData.message);
                accel = sensorData?.accel || null;
              }
            }

            return {
              timestamp: new Date(tx.timestamp * 1000).toLocaleTimeString(),
              id: tx.id,
              iota_evm_tx: tx.iota_evm_tx,
              sui_tx: tx.sui_tx,
              iota_block: tx.iota_block,
              // Utilizzo esclusivamente del valore reale di accelerazione (null se non disponibile)
              accel: accel,
            };
          })
        );

        // 🔹 Aggiunge i nuovi dati evitando duplicati
        setData((prevData) => {
          const existingTimestamps = new Set(prevData.map((item) => item.timestamp));
          const filteredNewData = formattedData.filter(
            (item) => !existingTimestamps.has(item.timestamp)
          );
          return [...prevData, ...filteredNewData];
        });
      } catch (error) {
        console.error("❌ Error fetching transaction data:", error);
      }
    };

    useEffect(() => {
      fetchData(); // Caricamento iniziale
      const interval = setInterval(fetchData, 5000); // Refresh ogni 5 secondi
      return () => clearInterval(interval); // Cleanup interval
    }, []);

    // 🔹 Selezione della transazione al click sul punto del grafico
    const handlePointClick = (data) => {
      setSelectedTransaction(data);
    };

    return (
      <div className="container mt-5 p-4 bg-white shadow rounded">
        <h2 className="text-center text-primary mb-4">Explorer Transazioni</h2>
        <h4 className="text-center text-secondary mb-4">Visualizzazione Accelerazione</h4>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart
            data={data}
            onClick={(e) =>
              e.activePayload && handlePointClick(e.activePayload[0].payload)
            }
          >
            <XAxis
              dataKey="timestamp"
              label={{ value: "Orario", position: "insideBottom", offset: -5 }}
            />
            <YAxis
              type="number"
              domain={[0, 'auto']}
              label={{
                value: "Accelerazione (m/s²)",
                angle: -90,
                position: "insideLeft",
              }}
            />
            <Tooltip
              formatter={(value, name) => [value, name === "accel" ? "Accelerazione" : ""]}
              labelFormatter={(label) => `Orario: ${label}`}
              wrapperStyle={{
                backgroundColor: "#fff",
                borderRadius: "8px",
                padding: "10px",
                boxShadow: "0px 4px 6px rgba(0,0,0,0.1)",
              }}
            />
            <Line
              type="monotone"
              dataKey="accel"
              stroke="#007bff"
              strokeWidth={3}
              dot={{ r: 6, fill: "#007bff" }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* 🔹 Passa la transazione selezionata a TransactionDetails */}
        {selectedTransaction && <TransactionDetails transaction={selectedTransaction} />}
      </div>
    );
  };

  export default TransactionGraph;
