import api from "./axios";
import { dispatchDataUpdate } from "./dataStore";

const unwrapData = (payload) =>
  payload?.data !== undefined ? payload.data : payload;

const STORAGE_KEY_PINCODES = "hinchmart_admin_pincodes_cache_v1";
const STORAGE_KEY_PINCODES_COOLDOWN = "hinchmart_admin_pincodes_cooldown_v1";

// If the live endpoint fails (e.g. not deployed yet), avoid re-probing it on
// every search keystroke/page change/mount -- go straight to cache until the
// cooldown lapses. Persisted to localStorage so it survives page reloads.
const ENDPOINT_FAILURE_COOLDOWN_MS = 30 * 60 * 1000;

const getPincodesCooldownUntil = () => {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(STORAGE_KEY_PINCODES_COOLDOWN)) || 0;
  } catch {
    return 0;
  }
};

const setPincodesCooldownUntil = (timestamp) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PINCODES_COOLDOWN, String(timestamp));
  } catch {}
};

/**
 * Local cache helpers so the Pincodes page keeps working while the live
 * /admin/pincodes endpoints are not yet deployed on the backend.
 */
export const getStoredPincodes = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PINCODES);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveStoredPincodes = (pincodes) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PINCODES, JSON.stringify(pincodes));
  } catch {}
};

const filterStoredPincodes = (params = {}) => {
  let list = getStoredPincodes();
  const search = params.search?.toString().trim().toLowerCase();
  if (search) {
    list = list.filter(
      (p) =>
        p.pincode?.includes(search) ||
        p.city?.toLowerCase().includes(search) ||
        p.state?.toLowerCase().includes(search)
    );
  }
  if (params.state) {
    list = list.filter(
      (p) => p.state?.toLowerCase() === String(params.state).toLowerCase()
    );
  }
  if (params.active !== undefined && params.active !== null && params.active !== "") {
    const wantActive = params.active === true || params.active === "true";
    list = list.filter((p) => Boolean(p.active) === wantActive);
  }
  if (params.serviceType) {
    list = list.filter((p) =>
      (p.services || []).some((s) => s.serviceType === params.serviceType)
    );
  }
  return list;
};

const paginateStored = (list, page = 1, limit = 20) => {
  const p = Number(page) || 1;
  const l = Number(limit) || 20;
  const start = (p - 1) * l;
  return {
    items: list.slice(start, start + l),
    meta: {
      page: p,
      limit: l,
      total: list.length,
      totalPages: Math.max(1, Math.ceil(list.length / l)),
    },
  };
};

const isAbort = (err) => err?.name === "CanceledError" || err?.code === "ERR_CANCELED";

export const getAdminPincodes = async (params = {}, config = {}) => {
  if (Date.now() >= getPincodesCooldownUntil()) {
    try {
      const response = await api.get("/admin/pincodes", { ...config, params });
      const body = response.data;
      const items = Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body)
          ? body
          : [];
      if (items.length) saveStoredPincodes(items);
      return body;
    } catch (err) {
      if (isAbort(err) || config.signal?.aborted) throw err;
      console.warn(
        "[Pincode API] GET /admin/pincodes notice:",
        err?.response?.status || err?.message
      );
      setPincodesCooldownUntil(Date.now() + ENDPOINT_FAILURE_COOLDOWN_MS);
    }
  }

  const filtered = filterStoredPincodes(params);
  const { items, meta } = paginateStored(filtered, params.page, params.limit);
  return {
    success: true,
    message: "Showing locally cached pincodes (live data unavailable).",
    cached: true,
    data: items,
    meta,
  };
};

/**
 * Raised when a write (create/update/delete) could not be confirmed as
 * persisted on the server. Callers must NOT treat this as a soft warning --
 * the change was not saved to the database and the user must be told so.
 */
export class PincodeNotPersistedError extends Error {
  constructor(message) {
    super(message);
    this.name = "PincodeNotPersistedError";
    this.notPersisted = true;
  }
}

const describeWriteFailure = (err, action) => {
  const status = err?.response?.status;
  if (status === 404) {
    return `${action} could not be saved: the admin pincode API is not live on the server yet (404). Nothing was written to the database.`;
  }
  return (
    err?.response?.data?.message ||
    `${action} failed: ${err?.message || "the server did not confirm the change was saved."}`
  );
};

export const createAdminPincode = async (pincode) => {
  try {
    const response = await api.post("/admin/pincodes", pincode);
    const created = unwrapData(response.data);
    if (!created) {
      throw new PincodeNotPersistedError(
        "The server accepted the request but returned no saved record."
      );
    }
    const stored = getStoredPincodes();
    saveStoredPincodes([created, ...stored.filter((p) => p.id !== created.id)]);
    dispatchDataUpdate("pincodes", "CREATE", created);
    return created;
  } catch (err) {
    if (err instanceof PincodeNotPersistedError) throw err;
    if (err?.response?.status === 409) {
      throw new Error(
        err.response?.data?.message || `Pincode ${pincode.pincode} is already registered.`
      );
    }
    throw new PincodeNotPersistedError(describeWriteFailure(err, "Add pincode"));
  }
};

export const updateAdminPincode = async (id, pincode) => {
  try {
    const response = await api.put(`/admin/pincodes/${encodeURIComponent(id)}`, pincode);
    const updated = unwrapData(response.data) || { id, ...pincode };
    const stored = getStoredPincodes();
    saveStoredPincodes(
      stored.map((p) => (String(p.id) === String(id) ? { ...p, ...updated } : p))
    );
    dispatchDataUpdate("pincodes", "UPDATE", updated);
    return updated;
  } catch (err) {
    throw new PincodeNotPersistedError(describeWriteFailure(err, "Update pincode"));
  }
};

export const configureAdminPincodeService = async (id, service) => {
  try {
    const response = await api.post(
      `/admin/pincodes/${encodeURIComponent(id)}/services`,
      service
    );
    const updated = unwrapData(response.data);
    if (!updated) {
      throw new PincodeNotPersistedError(
        "The server accepted the request but returned no saved service configuration."
      );
    }
    const stored = getStoredPincodes();
    saveStoredPincodes(
      stored.map((p) => (String(p.id) === String(id) ? { ...p, ...updated } : p))
    );
    dispatchDataUpdate("pincodes", "UPDATE", updated);
    return updated;
  } catch (err) {
    if (err instanceof PincodeNotPersistedError) throw err;
    throw new PincodeNotPersistedError(
      describeWriteFailure(err, `Save ${service.serviceType} availability`)
    );
  }
};

export const deleteAdminPincode = async (id) => {
  try {
    const response = await api.delete(`/admin/pincodes/${encodeURIComponent(id)}`);
    const stored = getStoredPincodes();
    saveStoredPincodes(stored.filter((p) => String(p.id) !== String(id)));
    dispatchDataUpdate("pincodes", "DELETE", { id });
    return response.data;
  } catch (err) {
    throw new PincodeNotPersistedError(describeWriteFailure(err, "Delete pincode"));
  }
};

export const bulkUpdatePincodeStatus = async (pincodeIds, active, reason) => {
  try {
    const response = await api.patch("/admin/pincodes/bulk-status", {
      pincodeIds,
      active,
      ...(reason ? { reason } : {}),
    });
    const result = unwrapData(response.data);
    const stored = getStoredPincodes();
    saveStoredPincodes(
      stored.map((p) => (pincodeIds.includes(p.id) ? { ...p, active } : p))
    );
    dispatchDataUpdate("pincodes", "BULK_STATUS", { pincodeIds, active, reason });
    return result;
  } catch (err) {
    throw new PincodeNotPersistedError(describeWriteFailure(err, "Bulk status update"));
  }
};

// ==========================================
// Weight Pricing Slabs
// ==========================================

/**
 * slab: { minWeightKg, maxWeightKg, basePrice, pricePerKg }
 */
export const addWeightSlab = async (serviceId, slab) => {
  const response = await api.post(
    `/admin/pincode-services/${encodeURIComponent(serviceId)}/slabs`,
    slab
  );
  return unwrapData(response.data);
};

/**
 * slab: { minWeightKg, maxWeightKg, basePrice, pricePerKg }
 */
export const updateWeightSlab = async (slabId, slab) => {
  const response = await api.put(
    `/admin/pincode-services/slabs/${encodeURIComponent(slabId)}`,
    slab
  );
  return unwrapData(response.data);
};

export const toggleWeightSlabStatus = async (slabId, active) => {
  const response = await api.patch(
    `/admin/pincode-services/slabs/${encodeURIComponent(slabId)}/status`,
    null,
    { params: { active } }
  );
  return unwrapData(response.data);
};

// ==========================================
// CSV Bulk Import / Export
// ==========================================

export const importAdminPincodesCsv = async (file, dryRun = false) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/admin/pincodes/import", formData, {
    params: { dryRun },
  });
  return unwrapData(response.data);
};

export const exportAdminPincodesCsv = async (params = {}) => {
  const response = await api.get("/admin/pincodes/export", {
    params,
    responseType: "blob",
  });
  return response.data;
};

export const downloadAdminPincodeTemplate = async () => {
  const response = await api.get("/admin/pincodes/template", {
    responseType: "blob",
  });
  return response.data;
};

// ==========================================
// Customer Availability / Service Expansion Requests
// ==========================================

export const getAdminAvailabilityRequests = async (params = {}, config = {}) => {
  const response = await api.get("/admin/availability-requests", { ...config, params });
  return response.data;
};

export const updateAdminAvailabilityRequestStatus = async (id, status, adminNotes) => {
  const response = await api.patch(
    `/admin/availability-requests/${encodeURIComponent(id)}`,
    null,
    { params: { status, adminNotes } }
  );
  return unwrapData(response.data);
};

// ==========================================
// Audit Logs
// ==========================================

export const getAdminPincodeAuditLogs = async (params = {}, config = {}) => {
  const response = await api.get("/admin/pincodes/audit-logs", { ...config, params });
  return response.data;
};

export const getAdminPincodeAuditLogsById = async (pincodeId, params = {}, config = {}) => {
  const response = await api.get(
    `/admin/pincodes/${encodeURIComponent(pincodeId)}/audit-logs`,
    { ...config, params }
  );
  return response.data;
};
