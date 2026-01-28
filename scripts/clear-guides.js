import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearGuides() {
  try {
    console.log("🚀 Starting guide account cleanup...\n");

    // Step 1: Fetch all guides
    console.log("📋 Fetching all guide accounts...");
    const { data: guides, error: fetchError } = await supabase
      .from("users")
      .select("id")
      .eq("role", "guide");

    if (fetchError && fetchError.code !== "PGRST116") {
      throw fetchError;
    }

    if (!guides || guides.length === 0) {
      console.log("✅ No guide accounts found. Database is clean.\n");
      return;
    }

    const guideIds = guides.map((g) => g.id);
    console.log(`📊 Found ${guides.length} guide account(s) to delete\n`);

    // Step 2: Delete guides table records
    console.log("🗑️  Deleting guides table records...");
    const { error: guidesError } = await supabase
      .from("guides")
      .delete()
      .in("user_id", guideIds);

    if (guidesError && guidesError.code !== "PGRST116") {
      throw guidesError;
    }
    console.log("   ✓ Guides table cleaned\n");

    // Step 3: Delete guide availability
    console.log("🗑️  Deleting guide availability records...");
    const { error: availError } = await supabase
      .from("guide_availability")
      .delete()
      .in("guide_id", guideIds);

    if (availError && availError.code !== "PGRST116") {
      throw availError;
    }
    console.log("   ✓ Guide availability records deleted\n");

    // Step 4: Delete bookings assigned to guides
    console.log("🗑️  Deleting bookings assigned to guides...");
    const { error: bookingsError } = await supabase
      .from("bookings")
      .delete()
      .in("guide_id", guideIds);

    if (bookingsError && bookingsError.code !== "PGRST116") {
      throw bookingsError;
    }
    console.log("   ✓ Bookings deleted\n");

    // Step 5: Delete reviews for guides
    console.log("🗑️  Deleting reviews for guides...");
    const { error: reviewsError } = await supabase
      .from("reviews")
      .delete()
      .in("guide_id", guideIds);

    if (reviewsError && reviewsError.code !== "PGRST116") {
      throw reviewsError;
    }
    console.log("   ✓ Reviews deleted\n");

    // Step 6: Delete guide user accounts
    console.log("🗑️  Deleting guide user accounts...");
    const { error: usersError } = await supabase
      .from("users")
      .delete()
      .eq("role", "guide");

    if (usersError && usersError.code !== "PGRST116") {
      throw usersError;
    }
    console.log("   ✓ User accounts deleted\n");

    // Verify deletion
    console.log("📊 Verifying deletion...");
    const { data: remaining } = await supabase
      .from("users")
      .select("id")
      .eq("role", "guide");

    if (remaining && remaining.length === 0) {
      console.log("   ✓ All guide accounts successfully removed\n");
      console.log("🎉 Guide cleanup complete!");
      console.log(`   Deleted: ${guideIds.length} guide account(s)`);
      console.log("   Remaining roles: admin, tourist, user\n");
    } else {
      console.log(
        `⚠️  Warning: ${remaining?.length || 0} guide account(s) still exist\n`
      );
    }
  } catch (error) {
    console.error("❌ Error during guide cleanup:", error.message);
    process.exit(1);
  }
}

clearGuides();
