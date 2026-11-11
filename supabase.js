
/* =====================================
   EARNHUB - SUPABASE CONFIGURATION
===================================== */

const SUPABASE_URL =
    "https://uxsrsnmifeaubvujwgja.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_B1tiorofQzxhrhSHso7ZgQ_g-P3twcj";

// Check Supabase library
if (!window.supabase) {
    console.error("Supabase library not loaded!");
} else {

    // Create Supabase client
    const supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    // Make client available to script.js
    window.supabaseClient = supabaseClient;

    console.log("EarnHub Supabase client initialized!");

    // Test authentication connection
    async function testSupabaseConnection() {
        try {
            const { data, error } =
                await supabaseClient.auth.getSession();

            if (error) throw error;

            console.log(
                "EarnHub Supabase Connected Successfully!"
            );

            return true;

        } catch (error) {
            console.error(
                "Supabase Connection Error:",
                error.message
            );

            return false;
        }
    }

    testSupabaseConnection();
}
