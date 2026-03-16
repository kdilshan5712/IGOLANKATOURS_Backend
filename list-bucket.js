import dotenv from "dotenv";
dotenv.config({ path: 'c:/Users/kdils/OneDrive/Desktop/IGOLANKA/IGOLANKATOURS_Backend/.env' });
import supabase from './src/config/supabase.js';

async function listBucket() {
    try {
        console.log("≡ƒöì Listing TOURPACKAGES bucket...");
        const { data, error } = await supabase.storage
            .from('TOURPACKAGES')
            .list('', { limit: 100 });

        if (error) {
            console.error("❌ Error listing bucket:", error.message);
            return;
        }

        console.log("FILES_START");
        data.forEach(item => console.log(JSON.stringify(item)));
        console.log("FILES_END");

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

listBucket();
