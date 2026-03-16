import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://exfyprnpkplhzuuloebf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4Znlwcm5wa3BsaHp1dWxvZWJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc4NjE0NCwiZXhwIjoyMDgzMzYyMTQ0fQ.9nLbnEai4vXnZMtHmlWaJVAy5NWa4rBJ2wZi54QvDgg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listBucket() {
    try {
        console.log("≡ƒöì Listing gallery bucket...");
        const { data, error } = await supabase.storage
            .from('gallery')
            .list('', { limit: 100 });

        if (error) {
            console.error("❌ Error listing bucket:", error.message);
            return;
        }

        console.log("FILES_START");
        data.forEach(item => console.log(item.name));
        console.log("FILES_END");

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

listBucket();
