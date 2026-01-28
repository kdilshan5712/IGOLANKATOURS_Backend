import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearTouristAccounts() {
  try {
    console.log("🗑️  Starting to clear all tourist accounts...");

    // First, get all tourist users
    const { data: tourists, error: fetchError } = await supabase
      .from("users")
      .select("id")
      .eq("role", "tourist");

    if (fetchError) {
      console.error("❌ Error fetching tourists:", fetchError);
      return;
    }

    if (!tourists || tourists.length === 0) {
      console.log("✅ No tourist accounts found to delete");
      return;
    }

    console.log(`📊 Found ${tourists.length} tourist account(s) to delete`);

    // Delete related bookings first (if exists)
    const touristIds = tourists.map((t) => t.id);

    // Delete bookings
    const { error: bookingError } = await supabase
      .from("bookings")
      .delete()
      .in("tourist_id", touristIds);

    if (bookingError && bookingError.code !== "PGRST116") {
      console.error("⚠️  Warning deleting bookings:", bookingError.message);
    } else {
      console.log("✅ Deleted related bookings");
    }

    // Delete reviews
    const { error: reviewError } = await supabase
      .from("reviews")
      .delete()
      .in("tourist_id", touristIds);

    if (reviewError && reviewError.code !== "PGRST116") {
      console.error("⚠️  Warning deleting reviews:", reviewError.message);
    } else {
      console.log("✅ Deleted related reviews");
    }

    // Delete contact messages
    const { error: contactError } = await supabase
      .from("contact_messages")
      .delete()
      .in("user_id", touristIds);

    if (contactError && contactError.code !== "PGRST116") {
      console.error("⚠️  Warning deleting contact messages:", contactError.message);
    } else {
      console.log("✅ Deleted related contact messages");
    }

    // Finally, delete the tourist users
    const { error: deleteError } = await supabase
      .from("users")
      .delete()
      .eq("role", "tourist");

    if (deleteError) {
      console.error("❌ Error deleting tourists:", deleteError);
      return;
    }

    console.log(`✅ Successfully deleted ${tourists.length} tourist account(s)!`);
    console.log("🎉 All tourist accounts and related data have been cleared");
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  }
}

// Run the script
clearTouristAccounts();
