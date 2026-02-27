import express from 'express';
import { query } from '../config/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const SUCCESSFUL_STATUS = "LOWER(TRIM(c.status)) IN ('успешный','ответ','answered','success')";

/** Получить список project_id, к которым есть доступ */
async function getAllowedProjectIds(userId: string, isAdmin: boolean): Promise<string[]> {
  if (isAdmin) {
    const r = await query('SELECT id FROM projects ORDER BY name');
    return r.rows.map((row: any) => row.id);
  }
  const r = await query(
    'SELECT project_id FROM project_members WHERE user_id = $1',
    [userId]
  );
  return r.rows.map((row: any) => row.project_id);
}

/**
 * GET /api/statistics/company
 * Query: fromDate, toDate, projectId, activeOnly, groupBy (day|week|month) — группировка Total Company по дням/неделям/месяцам
 */
router.get('/company', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const isAdmin = req.user!.isAdmin;
    const { fromDate, toDate, projectId, activeOnly, groupBy } = req.query;
    const periodGroup = (groupBy === 'day' || groupBy === 'week' || groupBy === 'month') ? groupBy : 'month';
    const dateTrunc = periodGroup === 'day' ? 'day' : periodGroup === 'week' ? 'week' : 'month';

    let projectIds = await getAllowedProjectIds(userId, isAdmin);
    if (projectIds.length === 0) {
      return res.json({
        summary: { totalMinutes: 0, projectCount: 0, totalMinutesCost: 0, totalContactsCost: 0, totalCost: 0, avgCostPerMinute: 0 },
        byMonth: [],
        byProject: [],
        abc: { A: [], B: [], C: [], contributionA: { minutes: 0, cost: 0 }, contributionB: { minutes: 0, cost: 0 }, contributionC: { minutes: 0, cost: 0 } },
        topEfficient: [],
        topInefficient: [],
      });
    }

    if (projectId && typeof projectId === 'string') {
      if (!projectIds.includes(projectId)) {
        return res.status(403).json({ error: 'No access to this project' });
      }
      projectIds = [projectId];
    }

    const conditions = ['c.project_id = ANY($1)'];
    const params: any[] = [projectIds];
    let paramIdx = 2;
    if (fromDate) {
      conditions.push(`c.call_at >= $${paramIdx++}::date`);
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push(`c.call_at < ($${paramIdx++}::date + interval '1 day')`);
      params.push(toDate);
    }
    const whereCalls = conditions.join(' AND ');

    // Минуты только по успешным звонкам
    const minutesResult = await query(
      `SELECT
        c.project_id,
        SUM(CASE WHEN ${SUCCESSFUL_STATUS} THEN CEIL(c.duration_seconds::numeric / 60)::int ELSE 0 END) as minutes,
        COUNT(*) FILTER (WHERE ${SUCCESSFUL_STATUS}) as successful_calls
       FROM calls c
       WHERE ${whereCalls}
       GROUP BY c.project_id`,
      params
    );

    const projectIdsWithCalls = minutesResult.rows.map((r: any) => r.project_id);
    let allProjectIds = activeOnly === 'true'
      ? projectIdsWithCalls
      : [...new Set([...projectIds, ...projectIdsWithCalls])];
    // При выборе одного проекта всегда включаем его в выборку, чтобы блоки сравнения/ABC/топы показывали данные
    if (projectIds.length === 1 && allProjectIds.length === 0) {
      allProjectIds = [...projectIds];
    }

    if (allProjectIds.length === 0) {
      return res.json({
        summary: { totalMinutes: 0, projectCount: projectIds.length, totalMinutesCost: 0, totalContactsCost: 0, totalCost: 0, avgCostPerMinute: 0 },
        byMonth: [],
        byProject: [],
        abc: { A: [], B: [], C: [], contributionA: { minutes: 0, cost: 0 }, contributionB: { minutes: 0, cost: 0 }, contributionC: { minutes: 0, cost: 0 } },
        topEfficient: [],
        topInefficient: [],
      });
    }

    // Проекты и прайсинг
    const projectsResult = await query(
      'SELECT id, name FROM projects WHERE id = ANY($1)',
      [allProjectIds]
    );
    const projectNames = Object.fromEntries(projectsResult.rows.map((r: any) => [r.id, r.name]));

    const pricingResult = await query(
      'SELECT project_id, price_per_number, price_per_minute FROM project_pricing WHERE project_id = ANY($1)',
      [allProjectIds]
    );
    const pricingByProject = Object.fromEntries(
      pricingResult.rows.map((r: any) => [r.project_id, { price_per_number: Number(r.price_per_number) || 0, price_per_minute: Number(r.price_per_minute) || 0 }])
    );

    // Стоимость контактов по проекту: сумма по всем номерам (price_per_contact поставщика), иначе price_per_number * кол-во номеров
    const contactsCostResult = await query(
      `SELECT sn.project_id, SUM(COALESCE(s.price_per_contact, 0)) as total
       FROM supplier_numbers sn
       INNER JOIN suppliers s ON s.id = sn.supplier_id
       WHERE sn.project_id = ANY($1)
       GROUP BY sn.project_id`,
      [allProjectIds]
    );
    const contactsCostByProject: Record<string, number> = {};
    for (const row of contactsCostResult.rows) {
      contactsCostByProject[row.project_id] = Number(row.total) || 0;
    }
    const numbersCountResult = await query(
      'SELECT project_id, COUNT(*) as cnt FROM supplier_numbers WHERE project_id = ANY($1) GROUP BY project_id',
      [allProjectIds]
    );
    for (const row of numbersCountResult.rows) {
      const pid = row.project_id;
      if (!contactsCostByProject[pid] || contactsCostByProject[pid] === 0) {
        const pp = pricingByProject[pid];
        contactsCostByProject[pid] = (Number(row.cnt) || 0) * (pp?.price_per_number || 0);
      }
    }

    const minutesByProject: Record<string, number> = {};
    for (const row of minutesResult.rows) {
      minutesByProject[row.project_id] = parseInt(row.minutes) || 0;
    }

    const leadsResult = await query(
      `SELECT project_id, COUNT(DISTINCT CASE WHEN is_lead THEN phone_normalized END)::int as leads
       FROM calls c
       WHERE ${whereCalls}
       GROUP BY project_id`,
      params
    );
    const leadsByProject: Record<string, number> = {};
    for (const row of leadsResult.rows) {
      leadsByProject[row.project_id] = parseInt(row.leads) || 0;
    }

    let totalMinutes = 0;
    let totalCost = 0;
    let totalMinutesCost = 0;
    let totalContactsCost = 0;

    const byProject: Array<{
      projectId: string;
      projectName: string;
      minutes: number;
      leads: number;
      minutesCost: number;
      contactsCost: number;
      cost: number;
      costPerMinute: number;
      cpl: number;
      shareCost: number;
      shareMinutes: number;
      cplCategory: 'A' | 'B' | 'C';
      abcCategory: 'A' | 'B' | 'C';
    }> = [];

    for (const pid of allProjectIds) {
      const minutes = minutesByProject[pid] || 0;
      const leads = leadsByProject[pid] || 0;
      const pricePerMinute = pricingByProject[pid]?.price_per_minute ?? 0;
      const minutesCost = Math.round(minutes * pricePerMinute * 100) / 100;
      const contactsCost = Math.round((contactsCostByProject[pid] ?? 0) * 100) / 100;
      const cost = Math.round((contactsCost + minutesCost) * 100) / 100;
      totalMinutes += minutes;
      totalCost += cost;
      totalMinutesCost += minutesCost;
      totalContactsCost += contactsCost;
      byProject.push({
        projectId: pid,
        projectName: projectNames[pid] || '—',
        minutes: Math.round(minutes),
        leads,
        minutesCost,
        contactsCost,
        cost,
        costPerMinute: minutes > 0 ? Math.round((cost / minutes) * 100) / 100 : 0,
        cpl: leads > 0 ? Math.round((cost / leads) * 100) / 100 : 0,
        shareCost: 0,
        shareMinutes: 0,
        cplCategory: 'B',
        abcCategory: 'C',
      });
    }

    let cplA = 500;
    let cplB = 1000;
    let cplC = 2000;
    try {
      const settingsResult = await query(
        "SELECT key, value FROM app_settings WHERE key IN ('cpl_target_a','cpl_target_b','cpl_target_c')"
      );
      for (const row of settingsResult.rows) {
        const v = parseFloat(row.value);
        if (!Number.isNaN(v)) {
          if (row.key === 'cpl_target_a') cplA = v;
          else if (row.key === 'cpl_target_b') cplB = v;
          else if (row.key === 'cpl_target_c') cplC = v;
        }
      }
    } catch {
      // app_settings may not exist yet
    }

    if (totalCost > 0 || totalMinutes > 0) {
      for (const p of byProject) {
        p.shareCost = totalCost > 0 ? Math.round((p.cost / totalCost) * 10000) / 100 : 0;
        p.shareMinutes = totalMinutes > 0 ? Math.round((p.minutes / totalMinutes) * 10000) / 100 : 0;
        if (p.leads > 0) {
          if (p.cpl <= cplA) p.cplCategory = 'A';
          else if (p.cpl >= cplC) p.cplCategory = 'C';
          else p.cplCategory = 'B';
        }
      }
    }

    const summary = {
      totalMinutes: Math.round(totalMinutes),
      projectCount: projectIds.length,
      totalMinutesCost: Math.round(totalMinutesCost * 100) / 100,
      totalContactsCost: Math.round(totalContactsCost * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      avgCostPerMinute: totalMinutes > 0 ? Math.round((totalCost / totalMinutes) * 100) / 100 : 0,
    };

    // По периодам (день/неделя/месяц): минуты и стоимость. date_trunc принимает только литерал.
    const truncSql = dateTrunc === 'day' ? "'day'" : dateTrunc === 'week' ? "'week'" : "'month'";
    const periodResult = await query(
      `SELECT
        date_trunc(${truncSql}, c.call_at)::date as period_start,
        SUM(CASE WHEN ${SUCCESSFUL_STATUS} THEN CEIL(c.duration_seconds::numeric / 60)::int ELSE 0 END) as minutes,
        COUNT(DISTINCT c.project_id) as project_count
       FROM calls c
       WHERE ${whereCalls}
       GROUP BY date_trunc(${truncSql}, c.call_at)
       ORDER BY period_start`,
      params
    );

    const costByPeriodResult = await query(
      `SELECT
        date_trunc(${truncSql}, c.call_at)::date as period_start,
        c.project_id,
        SUM(CASE WHEN ${SUCCESSFUL_STATUS} THEN CEIL(c.duration_seconds::numeric / 60)::int ELSE 0 END) as minutes
       FROM calls c
       WHERE ${whereCalls}
       GROUP BY date_trunc(${truncSql}, c.call_at), c.project_id`,
      params
    );

    const toPeriodKey = (periodStart: Date | string): string => {
      const d = typeof periodStart === 'string'
        ? new Date(periodStart.length === 7 ? periodStart + '-01' : periodStart)
        : periodStart;
      const iso = d.toISOString();
      return periodGroup === 'month' ? iso.slice(0, 7) : iso.slice(0, 10);
    };

    const costByPeriodKey: Record<string, number> = {};
    const contactsCostByPeriodKey: Record<string, number> = {};
    for (const row of costByPeriodResult.rows) {
      const key = toPeriodKey(row.period_start);
      const minutes = parseInt(row.minutes) || 0;
      const pid = row.project_id;
      const pricePerMinute = Number(pricingByProject[pid]?.price_per_minute) || 0;
      costByPeriodKey[key] = (costByPeriodKey[key] || 0) + minutes * pricePerMinute;
      // Затраты на контакты проекта распределяем только по тем периодам, где у проекта были минуты
      const projectTotalMinutes = minutesByProject[pid] || 0;
      if (projectTotalMinutes > 0 && minutes > 0) {
        const projectContactsCost = contactsCostByProject[pid] ?? 0;
        const share = minutes / projectTotalMinutes;
        contactsCostByPeriodKey[key] = (contactsCostByPeriodKey[key] || 0) + projectContactsCost * share;
      }
    }

    const byMonth: Array<{
      month: string;
      minutes: number;
      minutesCost: number;
      contactsCost: number;
      cost: number;
      projectCount: number;
      avgCostPerMinute: number;
      changeMinutesPct: number | null;
      changeCostPct: number | null;
    }> = [];
    let prevM = 0;
    let prevCost = 0;
    for (const row of periodResult.rows) {
      const periodKey = toPeriodKey(row.period_start);
      const minutes = parseInt(row.minutes) || 0;
      const projectCount = parseInt(row.project_count) || 0;
      const minutesCost = Math.round((costByPeriodKey[periodKey] || 0) * 100) / 100;
      const contactsCost = Math.round((contactsCostByPeriodKey[periodKey] || 0) * 100) / 100;
      const cost = Math.round((minutesCost + contactsCost) * 100) / 100;
      const avgCostPerMinute = minutes > 0 ? Math.round((cost / minutes) * 100) / 100 : 0;
      byMonth.push({
        month: periodKey,
        minutes: Math.round(minutes),
        minutesCost,
        contactsCost,
        cost,
        projectCount,
        avgCostPerMinute,
        changeMinutesPct: prevM > 0 ? Math.round(((minutes - prevM) / prevM) * 10000) / 100 : null,
        changeCostPct: prevCost > 0 ? Math.round(((cost - prevCost) / prevCost) * 10000) / 100 : null,
      });
      prevM = minutes;
      prevCost = cost;
    }

    // ABC по CPL: сортируем по CPL по возрастанию (лучшие первые), затем A = первые 80% затрат, B = 80–95%, C = остальные
    const withLeads = byProject.filter((p) => p.leads > 0);
    const sortedByCpl = [...withLeads].sort((a, b) => a.cpl - b.cpl);
    let cum = 0;
    const abc = { A: [] as typeof byProject, B: [] as typeof byProject, C: [] as typeof byProject };
    const contributionA = { minutes: 0, cost: 0 };
    const contributionB = { minutes: 0, cost: 0 };
    const contributionC = { minutes: 0, cost: 0 };
    for (const p of sortedByCpl) {
      cum += p.cost;
      const share = totalCost > 0 ? cum / totalCost : 0;
      if (totalCost <= 0) {
        p.abcCategory = 'C';
        abc.C.push(p);
        contributionC.minutes += p.minutes;
        contributionC.cost += p.cost;
      } else if (share <= 0.8) {
        p.abcCategory = 'A';
        abc.A.push(p);
        contributionA.minutes += p.minutes;
        contributionA.cost += p.cost;
      } else if (share <= 0.95) {
        p.abcCategory = 'B';
        abc.B.push(p);
        contributionB.minutes += p.minutes;
        contributionB.cost += p.cost;
      } else {
        p.abcCategory = 'C';
        abc.C.push(p);
        contributionC.minutes += p.minutes;
        contributionC.cost += p.cost;
      }
    }
    for (const p of byProject) {
      if (p.leads === 0) {
        p.abcCategory = 'C';
        abc.C.push(p);
        contributionC.minutes += p.minutes;
        contributionC.cost += p.cost;
      }
    }

    const withLeadsForEfficiency = byProject.filter((p) => p.leads > 0);
    const topEfficient = [...withLeadsForEfficiency].sort((a, b) => a.cpl - b.cpl).slice(0, 5);
    const topInefficient = [...withLeadsForEfficiency].sort((a, b) => b.cpl - a.cpl).slice(0, 5);

    res.json({
      summary,
      byMonth,
      byProject,
      abc: {
        A: abc.A,
        B: abc.B,
        C: abc.C,
        contributionA: { minutes: contributionA.minutes, cost: Math.round(contributionA.cost * 100) / 100 },
        contributionB: { minutes: contributionB.minutes, cost: Math.round(contributionB.cost * 100) / 100 },
        contributionC: { minutes: contributionC.minutes, cost: Math.round(contributionC.cost * 100) / 100 },
      },
      topEfficient,
      topInefficient,
    });
  } catch (error: any) {
    console.error('Statistics company error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = p * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (idx - lower) * (sorted[upper] - sorted[lower]);
}

export default router;
