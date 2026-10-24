import api from "./axios";
import { getCategories } from "./categoryApi";

const STORAGE_KEY_COMMISSION_RULES = "hinchmart_commission_rules_cache_v1";

/**
 * Normalizes rule object format from backend or local cache
 */
export const normalizeCommissionRule = (rule) => {
  if (!rule || typeof rule !== "object") return null;

  const id = rule.id ?? rule.ruleId ?? rule._id;
  const rawRate = rule.rate ?? rule.commissionRate ?? rule.feeRate ?? 0;
  const rate = Number(rawRate);

  const categoryId =
    rule.categoryId !== undefined &&
    rule.categoryId !== null &&
    rule.categoryId !== "" &&
    rule.categoryId !== "null"
      ? Number(rule.categoryId)
      : null;

  const isActive =
    rule.isActive !== undefined
      ? Boolean(rule.isActive)
      : rule.active !== undefined
      ? Boolean(rule.active)
      : true;

  const effectiveFrom = rule.effectiveFrom || rule.createdAt || new Date().toISOString();
  const effectiveTo = rule.effectiveTo || null;

  return {
    id: id ? (typeof id === "number" ? id : Number(id) || id) : Date.now(),
    categoryId,
    categoryName: rule.categoryName || (categoryId ? `Category #${categoryId}` : "Global Fallback"),
    rate: isNaN(rate) ? 0 : Number(rate.toFixed(2)),
    effectiveFrom,
    effectiveTo,
    isActive,
    createdAt: rule.createdAt || effectiveFrom,
    updatedAt: rule.updatedAt || new Date().toISOString(),
    ruleScope: categoryId === null ? "GLOBAL" : "CATEGORY",
  };
};

/**
 * Retrieve cached fallback rules from localStorage
 */
export const getStoredCommissionRules = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMMISSION_RULES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeCommissionRule).filter(Boolean);
      }
    }
  } catch (err) {
    console.warn("Failed to load cached commission rules:", err);
  }

  // Default seed rule for marketplace holding fee
  const defaultGlobal = [
    {
      id: 1,
      categoryId: null,
      categoryName: "Global Fallback",
      rate: 7.5,
      effectiveFrom: "2026-10-24T00:00:00",
      effectiveTo: null,
      isActive: true,
      createdAt: "2026-10-24T00:00:00",
      updatedAt: "2026-10-24T00:00:00",
      ruleScope: "GLOBAL",
    },
  ];
  saveStoredCommissionRules(defaultGlobal);
  return defaultGlobal;
};

/**
 * Persist rules in local cache
 */
export const saveStoredCommissionRules = (rules) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_COMMISSION_RULES, JSON.stringify(rules));
  } catch (err) {
    console.warn("Failed to cache commission rules:", err);
  }
};

/**
 * Enrich rules with actual category names from categoryApi
 */
export const enrichRulesWithCategories = async (rules) => {
  try {
    const categories = await getCategories();
    const catMap = new Map();
    (categories || []).forEach((c) => {
      const cid = c.categoryId ?? c.id;
      if (cid) {
        catMap.set(Number(cid), c.name || c.title || `Category #${cid}`);
      }
    });

    return rules.map((rule) => {
      if (rule.categoryId !== null && rule.categoryId !== undefined) {
        const foundName = catMap.get(Number(rule.categoryId));
        return {
          ...rule,
          categoryName: foundName || rule.categoryName || `Category #${rule.categoryId}`,
        };
      }
      return {
        ...rule,
        categoryName: "Global Fallback (All Categories)",
      };
    });
  } catch {
    return rules;
  }
};

/**
 * List Commission / Holding Fee Rules
 * GET /api/admin/commission-rules (fallback: /api/admin/holding-fees)
 * @param {{ categoryId?: number | null, activeOnly?: boolean }} params
 */
export const getCommissionRules = async (params = {}) => {
  const cleanParams = {};
  if (params.categoryId !== undefined && params.categoryId !== null && params.categoryId !== "") {
    cleanParams.categoryId = Number(params.categoryId);
  }
  if (params.activeOnly !== undefined && params.activeOnly !== null) {
    cleanParams.activeOnly = Boolean(params.activeOnly);
  }

  let remoteData = null;

  try {
    // 1. Try standard /admin/commission-rules
    try {
      const res = await api.get("/admin/commission-rules", { params: cleanParams });
      remoteData = res.data?.data !== undefined ? res.data.data : res.data;
    } catch (primaryErr) {
      // 2. Try alternate /admin/holding-fees if 404
      if (primaryErr.response?.status === 404) {
        const altRes = await api.get("/admin/holding-fees", { params: cleanParams });
        remoteData = altRes.data?.data !== undefined ? altRes.data.data : altRes.data;
      } else {
        throw primaryErr;
      }
    }

    if (Array.isArray(remoteData)) {
      const normalized = remoteData.map(normalizeCommissionRule).filter(Boolean);
      const enriched = await enrichRulesWithCategories(normalized);
      saveStoredCommissionRules(enriched);
      return enriched;
    }
  } catch (err) {
    console.warn("getCommissionRules notice:", err?.message || err);
  }

  // Fallback to cached rules
  let localRules = getStoredCommissionRules();
  if (cleanParams.categoryId !== undefined) {
    localRules = localRules.filter((r) => r.categoryId === cleanParams.categoryId);
  }
  if (cleanParams.activeOnly) {
    localRules = localRules.filter((r) => r.isActive === true);
  }

  return await enrichRulesWithCategories(localRules);
};

/**
 * Get Rule by ID
 * GET /api/admin/commission-rules/{id}
 */
export const getCommissionRuleById = async (id) => {
  if (!id) return null;
  try {
    let resData = null;
    try {
      const res = await api.get(`/admin/commission-rules/${id}`);
      resData = res.data?.data !== undefined ? res.data.data : res.data;
    } catch (primaryErr) {
      if (primaryErr.response?.status === 404) {
        const altRes = await api.get(`/admin/holding-fees/${id}`);
        resData = altRes.data?.data !== undefined ? altRes.data.data : altRes.data;
      } else {
        throw primaryErr;
      }
    }
    return normalizeCommissionRule(resData);
  } catch (err) {
    console.warn(`getCommissionRuleById (${id}) notice:`, err?.message || err);
    const cached = getStoredCommissionRules().find((r) => String(r.id) === String(id));
    return cached || null;
  }
};

/**
 * Create a new Commission / Holding Fee Rule
 * POST /api/admin/commission-rules
 *
 * Payload:
 * {
 *   "categoryId": null,         // null for global fallback, or specific categoryId
 *   "rate": 7.50,               // 0.00 to 100.00
 *   "effectiveFrom": "2026-10-24T00:00:00", // optional, defaults to now
 *   "effectiveTo": null,        // optional
 *   "isActive": true
 * }
 */
export const createCommissionRule = async (data) => {
  const cleanRate = Number(data.rate);
  if (isNaN(cleanRate) || cleanRate < 0 || cleanRate > 100) {
    throw new Error("Holding fee rate must be a valid percentage between 0.00% and 100.00%.");
  }

  const categoryId =
    data.categoryId !== undefined &&
    data.categoryId !== null &&
    data.categoryId !== "" &&
    data.categoryId !== "null"
      ? Number(data.categoryId)
      : null;

  const payload = {
    categoryId,
    rate: Number(cleanRate.toFixed(2)),
    effectiveFrom: data.effectiveFrom || new Date().toISOString(),
    effectiveTo: data.effectiveTo || null,
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
  };

  let createdRule = null;

  try {
    try {
      const res = await api.post("/admin/commission-rules", payload);
      createdRule = res.data?.data !== undefined ? res.data.data : res.data;
    } catch (primaryErr) {
      if (primaryErr.response?.status === 404) {
        const altRes = await api.post("/admin/holding-fees", payload);
        createdRule = altRes.data?.data !== undefined ? altRes.data.data : altRes.data;
      } else {
        throw primaryErr;
      }
    }
  } catch (err) {
    console.warn("createCommissionRule backend notice (falling back locally):", err?.message || err);
    // Local fallback creation
    createdRule = {
      id: Date.now(),
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const normalized = normalizeCommissionRule(createdRule);

  // Apply Audit Safeguard: If activating a global rule, deactivate prior active global rules
  const currentRules = getStoredCommissionRules();
  let updatedList = currentRules;

  if (normalized.categoryId === null && normalized.isActive) {
    updatedList = updatedList.map((r) => {
      if (r.categoryId === null && r.id !== normalized.id && r.isActive) {
        return {
          ...r,
          isActive: false,
          effectiveTo: r.effectiveTo || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      return r;
    });
  }

  // Prepend new rule
  updatedList = [normalized, ...updatedList.filter((r) => r.id !== normalized.id)];
  saveStoredCommissionRules(updatedList);

  return normalized;
};

/**
 * Update an existing Commission / Holding Fee Rule
 * PUT /api/admin/commission-rules/{id}
 */
export const updateCommissionRule = async (id, data) => {
  if (!id) throw new Error("Rule ID is required for update.");

  const cleanRate = Number(data.rate);
  if (isNaN(cleanRate) || cleanRate < 0 || cleanRate > 100) {
    throw new Error("Holding fee rate must be a valid percentage between 0.00% and 100.00%.");
  }

  const categoryId =
    data.categoryId !== undefined &&
    data.categoryId !== null &&
    data.categoryId !== "" &&
    data.categoryId !== "null"
      ? Number(data.categoryId)
      : null;

  const payload = {
    categoryId,
    rate: Number(cleanRate.toFixed(2)),
    effectiveFrom: data.effectiveFrom,
    effectiveTo: data.effectiveTo || null,
    isActive: Boolean(data.isActive),
  };

  let updatedRule = null;

  try {
    try {
      const res = await api.put(`/admin/commission-rules/${id}`, payload);
      updatedRule = res.data?.data !== undefined ? res.data.data : res.data;
    } catch (primaryErr) {
      if (primaryErr.response?.status === 404) {
        const altRes = await api.put(`/admin/holding-fees/${id}`, payload);
        updatedRule = altRes.data?.data !== undefined ? altRes.data.data : altRes.data;
      } else {
        throw primaryErr;
      }
    }
  } catch (err) {
    console.warn(`updateCommissionRule (${id}) backend notice (falling back locally):`, err?.message || err);
    updatedRule = {
      id,
      ...payload,
      updatedAt: new Date().toISOString(),
    };
  }

  const normalized = normalizeCommissionRule(updatedRule);

  // Update local cache
  const currentRules = getStoredCommissionRules();
  const updatedList = currentRules.map((r) => (String(r.id) === String(id) ? { ...r, ...normalized } : r));
  saveStoredCommissionRules(updatedList);

  return normalized;
};

/**
 * Toggle Status of Rule
 * PATCH /api/admin/commission-rules/{id}/status
 * Request Body: {"isActive": true} or query param ?active=true
 */
export const toggleCommissionRuleStatus = async (id, isActive) => {
  if (!id) throw new Error("Rule ID is required.");
  const boolActive = Boolean(isActive);

  let result = null;

  try {
    try {
      const res = await api.patch(
        `/admin/commission-rules/${id}/status`,
        { isActive: boolActive },
        { params: { active: boolActive } }
      );
      result = res.data?.data !== undefined ? res.data.data : res.data;
    } catch (primaryErr) {
      if (primaryErr.response?.status === 404) {
        const altRes = await api.patch(
          `/admin/holding-fees/${id}/status`,
          { isActive: boolActive },
          { params: { active: boolActive } }
        );
        result = altRes.data?.data !== undefined ? altRes.data.data : altRes.data;
      } else {
        throw primaryErr;
      }
    }
  } catch (err) {
    console.warn(`toggleCommissionRuleStatus (${id}) backend notice:`, err?.message || err);
    result = { id, isActive: boolActive, updatedAt: new Date().toISOString() };
  }

  // Update local cache
  const currentRules = getStoredCommissionRules();
  const updatedList = currentRules.map((r) => {
    if (String(r.id) === String(id)) {
      return {
        ...r,
        isActive: boolActive,
        effectiveTo: !boolActive ? new Date().toISOString() : r.effectiveTo,
        updatedAt: new Date().toISOString(),
      };
    }
    // If activating a global rule, deactivate other globals
    if (boolActive && r.categoryId === null && String(r.id) !== String(id)) {
      return {
        ...r,
        isActive: false,
        effectiveTo: r.effectiveTo || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return r;
  });
  saveStoredCommissionRules(updatedList);

  return normalizeCommissionRule(result);
};

/**
 * Soft Deactivate Rule
 * DELETE /api/admin/commission-rules/{id}
 * Sets isActive = false and effectiveTo = now (preserving historical audit logs).
 */
export const deleteCommissionRule = async (id) => {
  if (!id) throw new Error("Rule ID is required.");

  try {
    try {
      await api.delete(`/admin/commission-rules/${id}`);
    } catch (primaryErr) {
      if (primaryErr.response?.status === 404) {
        await api.delete(`/admin/holding-fees/${id}`);
      } else {
        throw primaryErr;
      }
    }
  } catch (err) {
    console.warn(`deleteCommissionRule (${id}) backend notice:`, err?.message || err);
  }

  // Update local cache with soft deactivation: isActive = false, effectiveTo = now
  const now = new Date().toISOString();
  const currentRules = getStoredCommissionRules();
  const updatedList = currentRules.map((r) => {
    if (String(r.id) === String(id)) {
      return {
        ...r,
        isActive: false,
        effectiveTo: now,
        updatedAt: now,
      };
    }
    return r;
  });
  saveStoredCommissionRules(updatedList);

  return { success: true, id, isActive: false, effectiveTo: now };
};

/**
 * Quick helper: Get the current active Global Holding Fee rate (%)
 */
export const getActiveGlobalHoldingFeeRate = async () => {
  try {
    const rules = await getCommissionRules({ activeOnly: true });
    const globalRule = rules.find((r) => r.categoryId === null && r.isActive);
    if (globalRule) {
      return globalRule.rate;
    }
  } catch {}
  return 7.5; // Default standard holding fee
};
