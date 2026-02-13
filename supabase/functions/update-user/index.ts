import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const { data: roleCheck } = await callerClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!roleCheck) throw new Error("Only admins can update users");

    const { user_id, email, password } = await req.json();
    if (!user_id) throw new Error("user_id is required");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Build update payload
    const updateData: Record<string, string> = {};
    if (email) updateData.email = email;
    if (password) updateData.password = password;

    if (Object.keys(updateData).length === 0) {
      throw new Error("Nothing to update");
    }

    const { error } = await adminClient.auth.admin.updateUserById(user_id, updateData);
    if (error) throw error;

    // If email changed, also fetch user to return the new email
    let newEmail = email;
    if (!newEmail) {
      const { data } = await adminClient.auth.admin.getUserById(user_id);
      newEmail = data?.user?.email;
    }

    return new Response(JSON.stringify({ success: true, email: newEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
