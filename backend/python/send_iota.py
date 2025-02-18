import sys
import json
from iota_sdk import Client, utf8_to_hex

NODE_URL = 'https://api.testnet.iotaledger.net'
client = Client(nodes=[NODE_URL])

def send_data_to_iota(data):
    try:
        tag_hex = utf8_to_hex(data.get("vehicle_id", "default_vehicle_id"))
        message_hex = utf8_to_hex(json.dumps(data))

        # 🔹 Costruisci e invia il blocco
        block_info = client.build_and_post_block(
            secret_manager=None, tag=tag_hex, data=message_hex
        )
        
        # block_info is something like:
        # ['0xebe2d864bd562395d77691b50b91bae0e879f5035c56b5631330db751730931e', Block(...)]
        # We only want the first element:
        block_id = block_info[0]  
        
        return block_id
    except Exception as e:
        print(f"❌ Errore nell'invio a IOTA: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    try:
        input_data = json.loads(sys.argv[1])

        block_id = send_data_to_iota(input_data)

        print(block_id)
    except Exception as e:
        print(f"❌ Errore: {e}", file=sys.stderr)
        sys.exit(1)
