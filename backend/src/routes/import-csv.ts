import express from 'express';
import { query } from '../config/database.js';
import { authenticate, requireProjectAccess, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) return '7' + digits.slice(1);
  if (digits.length === 10) return '7' + digits;
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
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return `${isoMatch[1]}T00:00:00+03:00`;
  const ruMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (ruMatch) return `${ruMatch[3]}-${ruMatch[2]}-${ruMatch[1]}T00:00:00+03:00`;
  return undefined;
}

function parseDuration(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '0') return 0;
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
  }
  const num = parseFloat(trimmed);
  if (isNaN(num)) return 0;
  if (num > 0 && num < 1) {
    return Math.round(num * 1440);
  }
  return Math.round(num);
}

// Import CSV data
router.post('/', authenticate, requireProjectAccess, async (req: AuthRequest, res) => {
  try {
    const { project_id, type, rows, filename, supplier_id, is_gck } = req.body;

    if (!project_id || !type || !rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    const MAX_ROWS = 50_000;
    if (rows.length > MAX_ROWS) {
      return res.status(400).json({ error: `Too many rows. Maximum ${MAX_ROWS} per request.` });
    }

    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    const totalRows = rows.length;

    // Create import job first so we can link data to it (for delete cascade)
    const jobResult = await query(
      `INSERT INTO import_jobs (project_id, type, filename, total_rows, inserted_rows, skipped_duplicates, error_rows, uploaded_by)
       VALUES ($1, $2, $3, $4, 0, 0, 0, $5)
       RETURNING id`,
      [project_id, is_gck ? 'gck' : type, filename || '', totalRows, req.user!.userId]
    );
    const importJobId = jobResult.rows[0].id;

    if (type === 'suppliers') {
      if (!supplier_id) {
        return res.status(400).json({ error: 'supplier_id is required' });
      }

      const supplierCheck = await query(
        'SELECT is_gck FROM suppliers WHERE id = $1 AND project_id = $2',
        [supplier_id, project_id]
      );
      if (supplierCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Supplier not found' });
      }
      const supplierIsGck = !!supplierCheck.rows[0].is_gck;

      // Regular import: reject GCK suppliers — они только через Базы ГЦК
      if (!is_gck && supplierIsGck) {
        return res.status(400).json({ error: 'В базу ГЦК нельзя загружать номера через обычный импорт. Используйте «Базы ГЦК».' });
      }

      // GCK import: supplier must be marked as GCK
      if (is_gck && !supplierIsGck) {
        return res.status(400).json({ error: 'Для импорта ГЦК необходимо выбрать базу ГЦК. Обратитесь к администратору для создания базы ГЦК.' });
      }

      // Get existing phones
      const existingResult = await query(
        'SELECT phone_normalized FROM supplier_numbers WHERE project_id = $1',
        [project_id]
      );
      const existingPhones = new Set(existingResult.rows.map((n: any) => n.phone_normalized));
      const batchPhones = new Set<string>();
      const numbersToInsert: any[] = [];

      for (const row of rows) {
        const phone = (row.phone || row.name || '').trim();
        if (!phone) { errors++; continue; }

        const normalized = normalizePhone(phone);
        if (existingPhones.has(normalized)) { skipped++; continue; }

        const isDup = batchPhones.has(normalized);
        batchPhones.add(normalized);
        numbersToInsert.push({
          project_id,
          supplier_id,
          phone_raw: phone,
          phone_normalized: normalized,
          is_duplicate_in_project: isDup,
          import_job_id: importJobId,
          ...(row.received_at ? { received_at: parseReceivedDate(row.received_at) } : {}),
        });
        existingPhones.add(normalized);
      }

      // Insert in batches of 500
      for (let i = 0; i < numbersToInsert.length; i += 500) {
        const batch = numbersToInsert.slice(i, i + 500);
        const values = batch.map((item, idx) => {
          const base = idx * 7;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
        }).join(', ');

        const params: any[] = [];
        batch.forEach(item => {
          params.push(item.project_id, item.supplier_id, item.phone_raw, item.phone_normalized, item.is_duplicate_in_project, item.received_at || null, item.import_job_id);
        });

        try {
          const insResult = await query(
            `INSERT INTO supplier_numbers (project_id, supplier_id, phone_raw, phone_normalized, is_duplicate_in_project, received_at, import_job_id)
             VALUES ${values}
             ON CONFLICT (project_id, supplier_id, phone_normalized) DO NOTHING`,
            params
          );
          inserted += insResult.rowCount ?? batch.length;
        } catch (err) {
          console.error('Batch insert error:', err);
          errors += batch.length;
        }
      }
    } else if (type === 'calls') {
      const callsToInsert: any[] = [];
      const seenIds = new Set<string>();

      for (const row of rows) {
        const externalId = (row.external_call_id || '').trim();
        const phone = (row.phone || '').trim();
        const callAtRaw = (row.call_at || '').trim();

        if (!externalId || !phone || !callAtRaw) { errors++; continue; }
        if (seenIds.has(externalId)) { skipped++; continue; }
        seenIds.add(externalId);

        const callAt = parseCallAt(callAtRaw);
        if (!callAt) { errors++; continue; }

        const normalized = normalizePhone(phone);
        const duration = parseDuration(row.duration_seconds || '0');

        callsToInsert.push({
          project_id,
          external_call_id: externalId,
          phone_raw: phone,
          phone_normalized: normalized,
          call_at: callAt,
          duration_seconds: duration,
          status: (row.status || '').trim(),
          end_reason: (row.end_reason || '').trim() || null,
          skill_base: (row.skill_base || '').trim() || null,
          call_list: (row.call_list || '').trim() || null,
          call_attempt_number: parseInt(row.call_attempt_number || '1') || 1,
          is_first_attempt: (parseInt(row.call_attempt_number || '1') || 1) === 1,
          is_lead: row.is_lead === 'true' || row.is_lead === '1' || row.is_lead === 'Да' || row.is_lead === 'да',
          import_job_id: importJobId,
        });
      }

      // Upsert in batches
      for (let i = 0; i < callsToInsert.length; i += 500) {
        const batch = callsToInsert.slice(i, i + 500);
        const values = batch.map((item, idx) => {
          const base = idx * 14;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14})`;
        }).join(', ');

        const params: any[] = [];
        batch.forEach(item => {
          params.push(
            item.project_id, item.external_call_id, item.phone_raw, item.phone_normalized,
            item.call_list, item.skill_base, item.call_at, item.duration_seconds,
            item.status, item.end_reason, item.is_lead, item.call_attempt_number, item.is_first_attempt,
            item.import_job_id
          );
        });

        try {
          const insertResult = await query(
            `INSERT INTO calls (project_id, external_call_id, phone_raw, phone_normalized, call_list, skill_base, call_at, duration_seconds, status, end_reason, is_lead, call_attempt_number, is_first_attempt, import_job_id)
             VALUES ${values}
             ON CONFLICT (project_id, external_call_id) DO NOTHING
             RETURNING id`,
            params
          );
          inserted += insertResult.rowCount ?? 0;
          skipped += batch.length - (insertResult.rowCount ?? 0);
        } catch (err) {
          console.error('Calls batch upsert error:', err);
          errors += batch.length;
        }
      }
    }

    // Update import job with final counts
    await query(
      `UPDATE import_jobs SET inserted_rows = $1, skipped_duplicates = $2, error_rows = $3 WHERE id = $4`,
      [inserted, skipped, errors, importJobId]
    );

    // If is_gck flag is set, mark the supplier as GCK
    if (is_gck && supplier_id) {
      await query('UPDATE suppliers SET is_gck = true WHERE id = $1', [supplier_id]);
    }

    res.json({ total: totalRows, inserted, skipped, errors });
  } catch (error: any) {
    console.error('Import CSV error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
