export const fetchIotaDataOnlyTransaction = async (blockId) => {
    try {
      console.log(`🔍 Fetching IOTA Data-Only block: ${blockId}`);
  
      const response = await fetch(`https://api.testnet.iotaledger.net/api/core/v2/blocks/${blockId}`);
      if (!response.ok) {
        console.error("❌ Error fetching IOTA block.");
        return null;
      }
  
      const data = await response.json();
      
      if (!data.payload) {
        console.log("❌ No payload found in this block.");
        return null;
      }
  
      return {
        blockId,
        tag: data.payload.tag ? hexToUtf8(data.payload.tag) : "N/A",
        message: data.payload.data ? hexToUtf8(data.payload.data) : "No data",
        timestamp: data.timestamp ? new Date(data.timestamp * 1000).toISOString() : "Unknown",
      };
    } catch (error) {
      console.error("❌ Error fetching IOTA Data-Only block:", error);
      return null;
    }
  };
  
  // Convert Hex to UTF-8
  const hexToUtf8 = (hex) => {
    try {
      return decodeURIComponent(
        hex.replace(/\s+/g, '').replace(/[0-9a-f]{2}/g, '%$&')
      );
    } catch (e) {
      console.error("❌ Error decoding hex to UTF-8:", e);
      return hex;
    }
  };
  