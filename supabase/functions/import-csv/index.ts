import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SupplierRow {
  name: string;
  tag: string;
  phone: string;
}

interface CallRow {
  external_call_id: string;
  phone: string;
  call_at: string;
  duration_seconds: number;
  status: string;
  end_reason?: string;
  skill_base?: string;
  call_list?: string;
  call_attempt_number?: number;
  is_lead?: boolean;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) return "7" + digits.slice(1);
  if (digits.length === 10) return "7" + digits;
  return digits;
}

function parseCallAt(raw: string): string | null {
  // Handle "10.02.2026, 09:00:28 по МСК" format
  const ruMatch = raw.match(/(\d{2})\.(\d{2})\.(\d{4}),?\s*(\d{2}):(\d{2}):(\d{2})/);
  if (ruMatch) {
    const [, dd, mm, yyyy, hh, min, ss] = ruMatch;
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+03:00`;
  }
  // Try ISO or other parseable formats
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

function parseReceivedDate(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // Extract just the date part (YYYY-MM-DD) from formats like "2026-02-02 08:43:50"
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return `${isoMatch[1]}T00:00:00+03:00`;
  // Handle dd.mm.yyyy format
  const ruMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (ruMatch) return `${ruMatch[3]}-${ruMatch[2]}-${ruMatch[1]}T00:00:00+03:00`;
  return undefined;
}

function parseDuration(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "0") return 0;
  // MM:SS format
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
  }
  const num = parseFloat(trimmed);
  if (isNaN(num)) return 0;
  // Excel fractional day — column is "мин:сек", so the value represents minutes
  // e.g. 0.035416 * 1440 = 51 seconds (displayed as "0:51" in mm:ss)
  if (num > 0 && num < 1) {
    return Math.round(num * 1440);
  }
  return Math.round(num);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { project_id, type, rows, filename, supplier_id, is_gck } = body as {
      project_id: string;
      type: "suppliers" | "calls";
      rows: Record<string, string>[];
      filename: string;
      supplier_id?: string;
      is_gck?: boolean;
    };

    if (!project_id || !type || !rows || !Array.isArray(rows)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    const totalRows = rows.length;

    if (type === "suppliers") {
      if (!supplier_id) {
        return new Response(JSON.stringify({ error: "supplier_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const supplierId = supplier_id;

      // Get existing phones to skip duplicates
      const { data: existingNumbers } = await supabaseAdmin
        .from("supplier_numbers")
        .select("phone_normalized")
        .eq("project_id", project_id);

      const existingPhones = new Set((existingNumbers || []).map((n) => n.phone_normalized));
      const batchPhones = new Set<string>();
      const numbersToInsert: any[] = [];

      for (const row of rows) {
        const phone = (row.phone || row.name || "").trim();
        if (!phone) { errors++; continue; }

        const normalized = normalizePhone(phone);
        if (existingPhones.has(normalized)) { skipped++; continue; }

        const isDup = batchPhones.has(normalized);
        batchPhones.add(normalized);
        numbersToInsert.push({
          project_id,
          supplier_id: supplierId,
          phone_raw: phone,
          phone_normalized: normalized,
          is_duplicate_in_project: isDup,
          ...(row.received_at ? { received_at: parseReceivedDate(row.received_at) } : {}),
        });
        existingPhones.add(normalized);
      }

      // Insert in batches of 500
      for (let i = 0; i < numbersToInsert.length; i += 500) {
        const batch = numbersToInsert.slice(i, i + 500);
        const { error: bErr, count } = await supabaseAdmin
          .from("supplier_numbers")
          .insert(batch);
        if (bErr) { errors += batch.length; } else { inserted += batch.length; }
      }
    } else if (type === "calls") {
      // We no longer pre-fetch existing IDs (hits 1000-row limit).
      // Instead we use upsert with ignoreDuplicates below.

      const callsToInsert: any[] = [];
      const seenIds = new Set<string>();

      for (const row of rows) {
        const externalId = (row.external_call_id || "").trim();
        const phone = (row.phone || "").trim();
        const callAtRaw = (row.call_at || "").trim();

        if (!externalId || !phone || !callAtRaw) { errors++; continue; }
        if (seenIds.has(externalId)) { skipped++; continue; }
        seenIds.add(externalId);

        const callAt = parseCallAt(callAtRaw);
        if (!callAt) { errors++; continue; }

        const normalized = normalizePhone(phone);
        const duration = parseDuration(row.duration_seconds || "0");

        callsToInsert.push({
          project_id,
          external_call_id: externalId,
          phone_raw: phone,
          phone_normalized: normalized,
          call_at: callAt,
          duration_seconds: duration,
          status: (row.status || "").trim(),
          end_reason: (row.end_reason || "").trim() || null,
          skill_base: (row.skill_base || "").trim() || null,
          call_list: (row.call_list || "").trim() || null,
          call_attempt_number: parseInt(row.call_attempt_number || "1") || 1,
          is_first_attempt: (parseInt(row.call_attempt_number || "1") || 1) === 1,
          is_lead: row.is_lead === "true" || row.is_lead === "1" || row.is_lead === "Да" || row.is_lead === "да",
        });
      }

      // Upsert in batches of 500, ignoring duplicates (existing rows stay unchanged)
      for (let i = 0; i < callsToInsert.length; i += 500) {
        const batch = callsToInsert.slice(i, i + 500);
        const { error: bErr, count } = await supabaseAdmin
          .from("calls")
          .upsert(batch, { onConflict: "project_id,external_call_id", ignoreDuplicates: true });
        if (bErr) { console.error("Calls batch upsert error:", JSON.stringify(bErr)); errors += batch.length; } else { inserted += batch.length; }
      }
    }

    // Log import job
    await supabaseAdmin.from("import_jobs").insert({
      project_id,
      type: is_gck ? "gck" : type,
      filename,
      total_rows: totalRows,
      inserted_rows: inserted,
      skipped_duplicates: skipped,
      error_rows: errors,
      uploaded_by: user.id,
    });

    // If is_gck flag is set, mark the supplier as GCK
    if (is_gck && supplier_id) {
      await supabaseAdmin.from("suppliers").update({ is_gck: true }).eq("id", supplier_id);
    }

    return new Response(
      JSON.stringify({ total: totalRows, inserted, skipped, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
