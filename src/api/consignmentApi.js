import api from "./axios";
import { dispatchDataUpdate } from "./dataStore";

const STORAGE_KEY_CONSIGNMENT = "hinchmart_consignment_inventory_v1";

const getLocalInventory = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONSIGNMENT);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (r) =>
          r &&
          r.id !== 1 &&
          r.id !== 2 &&
          r.productTitle !== "Tata Tiscon 550D TMT Rebar (12mm)" &&
          r.productTitle !== "UltraTech Super Cement (50kg Bag)" &&
          r.vendorStoreName !== "Sri Balaji Steel Traders" &&
          r.vendorStoreName !== "Deccan Cement Depot"
      );
    }
    return [];
  } catch {
    return [];
  }
};

const saveLocalInventory = (rows) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_CONSIGNMENT, JSON.stringify(rows));
  } catch {}
};

const SEED_ROWS = [];

/**
 * 1. List Consignment Inventory Rows
 * GET /api/admin/hinch-store/inventory?page={page}&limit={limit}
 */
export const getConsignmentInventory = async ({ page = 1, limit = 20, productId, vendorStoreId, isActive } = {}) => {
  const params = new URLSearchParams();
  if (page) params.set("page", String(page));
  if (limit) params.set("limit", String(limit));
  if (productId && productId !== "ALL") params.set("productId", String(productId));
  if (vendorStoreId && vendorStoreId !== "ALL") params.set("vendorStoreId", String(vendorStoreId));
  if (isActive !== undefined && isActive !== "ALL") params.set("isActive", String(isActive));

  const endpoints = [
    `/admin/consignment-inventory?${params.toString()}`,
    `/admin/hinch-store/inventory?${params.toString()}`,
  ];

  for (const ep of endpoints) {
    try {
      const res = await api.get(ep);
      let data = res.data?.data || res.data?.items || res.data?.inventory || res.data;
      if (data && Array.isArray(data.rows || data.content)) {
        return {
          rows: (data.rows || data.content).map(normalizeConsignmentRow),
          pagination: {
            page: Number(data.page || page),
            limit: Number(data.limit || limit),
            totalCount: Number(data.totalCount || data.total || data.count || (data.rows || data.content).length),
            totalPages: Math.max(1, Math.ceil(Number(data.totalCount || data.total || 1) / limit)),
          },
        };
      }
      if (Array.isArray(data)) {
        return {
          rows: data.map(normalizeConsignmentRow),
          pagination: {
            page,
            limit,
            totalCount: data.length,
            totalPages: Math.max(1, Math.ceil(data.length / limit)),
          },
        };
      }
    } catch (err) {
      if (err?.response?.status === 401) break;
      continue;
    }
  }

  // Fallback to local storage cache
  let local = getLocalInventory();

  let filtered = [...local];
  if (productId && productId !== "ALL") {
    filtered = filtered.filter((r) => String(r.productId) === String(productId));
  }
  if (vendorStoreId && vendorStoreId !== "ALL") {
    filtered = filtered.filter((r) => String(r.vendorStoreId) === String(vendorStoreId));
  }
  if (isActive !== undefined && isActive !== "ALL") {
    filtered = filtered.filter((r) => Boolean(r.isActive) === (String(isActive) === "true"));
  }

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  return {
    rows: paginated.map(normalizeConsignmentRow),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
    },
  };
};

/**
 * 2. Create or Update a Consignment Inventory Row
 * POST /api/admin/hinch-store/inventory
 * Body: { productId, vendorStoreId, qty, isActive? }
 */
export const createOrUpdateConsignmentRow = async ({ productId, vendorStoreId, qty, isActive = true, productTitle = "", vendorStoreName = "" }) => {
  const numericQty = Math.max(0, Number(qty) || 0);
  const payload = {
    productId: Number(productId),
    vendorStoreId: Number(vendorStoreId),
    qty: numericQty,
    isActive: Boolean(isActive),
  };

  const createEndpoints = [
    "/admin/consignment-inventory",
    "/admin/hinch-store/inventory",
  ];

  for (const ep of createEndpoints) {
    try {
      const res = await api.post(ep, payload);
      const data = res.data?.data || res.data?.item || res.data;
      if (data && typeof data === "object") {
        const normalized = normalizeConsignmentRow(data);
        syncLocalRow(normalized);
        dispatchDataUpdate("consignmentInventory", "CREATE", normalized);
        return normalized;
      }
    } catch (err) {
      if (err?.response?.status === 401) break;
      continue;
    }
  }

  // Local fallback upsert
  const local = getLocalInventory();
  const existingIdx = local.findIndex(
    (r) => Number(r.productId) === Number(productId) && Number(r.vendorStoreId) === Number(vendorStoreId)
  );

  let updatedRow;
  if (existingIdx !== -1) {
    const prev = local[existingIdx];
    const reserved = Number(prev.reservedQty || 0);
    updatedRow = {
      ...prev,
      qty: numericQty,
      reservedQty: reserved,
      availableQty: Math.max(0, numericQty - reserved),
      isActive: Boolean(isActive),
      productTitle: productTitle || prev.productTitle,
      vendorStoreName: vendorStoreName || prev.vendorStoreName,
      updatedAt: new Date().toISOString(),
    };
    local[existingIdx] = updatedRow;
  } else {
    updatedRow = {
      id: Date.now(),
      productId: Number(productId),
      productTitle: productTitle || `Product #${productId}`,
      vendorStoreId: Number(vendorStoreId),
      vendorStoreName: vendorStoreName || `Store #${vendorStoreId}`,
      vendorSellerId: Number(vendorStoreId),
      vendorSellerName: vendorStoreName || `Seller #${vendorStoreId}`,
      qty: numericQty,
      reservedQty: 0,
      availableQty: numericQty,
      isActive: Boolean(isActive),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    local.unshift(updatedRow);
  }

  saveLocalInventory(local);
  dispatchDataUpdate("consignmentInventory", "CREATE", updatedRow);
  return updatedRow;
};

/**
 * 3. Activate or Deactivate a Consignment Row
 * PATCH /api/admin/hinch-store/inventory/{id}/status
 * Body: { isActive }
 */
export const updateConsignmentRowStatus = async (id, isActive) => {
  const payload = { isActive: Boolean(isActive) };
  const statusAttempts = [
    { method: "put", ep: `/admin/consignment-inventory/${id}/status`, payload: { active: Boolean(isActive), isActive: Boolean(isActive) } },
    { method: "patch", ep: `/admin/hinch-store/inventory/${id}/status`, payload },
  ];

  for (const attempt of statusAttempts) {
    try {
      const res = await api[attempt.method](attempt.ep, attempt.payload);
      const data = res.data?.data || res.data;
      if (data) {
        const normalized = normalizeConsignmentRow(data);
        syncLocalRow(normalized);
        dispatchDataUpdate("consignmentInventory", "STATUS_CHANGE", normalized);
        return normalized;
      }
    } catch (err) {
      if (err?.response?.status === 401) break;
      continue;
    }
  }

  const local = getLocalInventory();
  const idx = local.findIndex((r) => String(r.id) === String(id));
  if (idx !== -1) {
    local[idx] = { ...local[idx], isActive: Boolean(isActive), updatedAt: new Date().toISOString() };
    saveLocalInventory(local);
    dispatchDataUpdate("consignmentInventory", "STATUS_CHANGE", local[idx]);
    return local[idx];
  }
  return { id, isActive: Boolean(isActive) };
};

export const normalizeConsignmentRow = (row) => {
  if (!row) return null;
  const id = row.id ?? row.inventoryId ?? Date.now();
  const qty = Math.max(0, Number(row.qty ?? row.quantity ?? 0));
  const reservedQty = Math.max(0, Number(row.reservedQty ?? row.reservedQuantity ?? 0));
  const availableQty = row.availableQty !== undefined ? Number(row.availableQty) : Math.max(0, qty - reservedQty);

  return {
    id,
    productId: Number(row.productId ?? row.product_id),
    productTitle: row.productTitle || row.product_title || row.productName || `Product #${row.productId}`,
    vendorStoreId: Number(row.vendorStoreId ?? row.vendor_store_id ?? row.storeId),
    vendorStoreName: row.vendorStoreName || row.vendor_store_name || row.storeName || `Vendor Store #${row.vendorStoreId}`,
    vendorSellerId: Number(row.vendorSellerId ?? row.vendor_seller_id ?? row.sellerId ?? 1),
    vendorSellerName: row.vendorSellerName || row.vendor_seller_name || row.sellerName || "Vendor Merchant",
    qty,
    reservedQty,
    availableQty,
    isActive: row.isActive !== undefined ? Boolean(row.isActive) : (row.is_active !== undefined ? Boolean(row.is_active) : true),
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
    updatedAt: row.updatedAt || row.updated_at || new Date().toISOString(),
  };
};

const syncLocalRow = (row) => {
  const local = getLocalInventory();
  const idx = local.findIndex((r) => String(r.id) === String(row.id));
  if (idx !== -1) {
    local[idx] = row;
  } else {
    local.unshift(row);
  }
  saveLocalInventory(local);
};
