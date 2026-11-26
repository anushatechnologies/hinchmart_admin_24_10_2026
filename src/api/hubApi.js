import api from "./axios";

const STORAGE_KEY_HUBS = "hinchmart_admin_hubs_cache_v1";

const INITIAL_HUBS = [
  {
    id: "hub_del_okhla_01",
    code: "HUB-001",
    name: "Central Fulfilment Hub (Okhla)",
    addressLine: "Plot 42, Okhla Industrial Area Phase III",
    formattedAddress: "Plot 42, Okhla Industrial Area Phase III, 110020",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110020",
    latitude: 28.53550000,
    longitude: 77.27320000,
    contactPhone: "+91 11 4050 0001",
    active: true,
    assignedRidersCount: 14,
    createdAt: "2026-11-19T11:09:00",
    updatedAt: "2026-11-20T08:30:00",
  },
  {
    id: "hub_del_dwarka_02",
    code: "HUB-002",
    name: "West Delhi Dark Store (Dwarka)",
    addressLine: "Sector 12, Dwarka",
    formattedAddress: "Sector 12, Dwarka, 110078",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110078",
    latitude: 28.59210000,
    longitude: 77.04600000,
    contactPhone: "+91 11 4050 0002",
    active: true,
    assignedRidersCount: 8,
    createdAt: "2026-11-19T11:09:00",
    updatedAt: null,
  },
  {
    id: "hub_noi_sec62_03",
    code: "HUB-003",
    name: "Noida Sector 62 Fulfilment Center",
    addressLine: "Plot B-8, Electronic City, Sector 62",
    formattedAddress: "Plot B-8, Electronic City, Sector 62, 201309",
    city: "Noida",
    state: "Uttar Pradesh",
    pincode: "201309",
    latitude: 28.62800000,
    longitude: 77.36490000,
    contactPhone: "+91 120 499 1234",
    active: true,
    assignedRidersCount: 5,
    createdAt: "2026-11-20T10:00:00",
    updatedAt: null,
  },
];

const SAMPLE_RIDERS = [
  {
    customerId: 501,
    name: "Ramesh Kumar",
    email: "ramesh.rider@gmail.com",
    phone: "+919876543210",
    preferredHubId: "hub_del_okhla_01",
    hubCode: "HUB-001",
    hubLocation: "Central Fulfilment Hub (Okhla)",
    vehicleType: "TWO_WHEELER",
    vehicleNumber: "DL-10-AB-1234",
    licenseNumber: "DL1420110012345",
    createdAt: "2026-11-20T09:15:00",
  },
  {
    customerId: 502,
    name: "Suresh Sharma",
    email: "suresh.rider@gmail.com",
    phone: "+919811223344",
    preferredHubId: "hub_del_okhla_01",
    hubCode: "HUB-001",
    hubLocation: "Central Fulfilment Hub (Okhla)",
    vehicleType: "TWO_WHEELER",
    vehicleNumber: "DL-08-CD-5678",
    licenseNumber: "DL1420180098765",
    createdAt: "2026-11-20T10:00:00",
  },
  {
    customerId: 503,
    name: "Amit Patel",
    email: "amit.rider@gmail.com",
    phone: "+919712345678",
    preferredHubId: "hub_del_dwarka_02",
    hubCode: "HUB-002",
    hubLocation: "West Delhi Dark Store (Dwarka)",
    vehicleType: "THREE_WHEELER",
    vehicleNumber: "DL-04-EF-9012",
    licenseNumber: "DL1420150034567",
    createdAt: "2026-11-19T14:30:00",
  },
];

export const getStoredHubs = () => {
  if (typeof window === "undefined") return INITIAL_HUBS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HUBS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_HUBS, JSON.stringify(INITIAL_HUBS));
      return INITIAL_HUBS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_HUBS;
  } catch {
    return INITIAL_HUBS;
  }
};

export const saveStoredHubs = (hubs) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_HUBS, JSON.stringify(hubs));
  } catch {}
};

const filterStoredHubs = (params = {}) => {
  let list = getStoredHubs();
  const search = params.search?.toString().trim().toLowerCase();
  const city = params.city?.toString().trim().toLowerCase();
  const active = params.active !== undefined && params.active !== "" ? String(params.active) === "true" : null;

  if (search) {
    list = list.filter(
      (h) =>
        h.name?.toLowerCase().includes(search) ||
        h.code?.toLowerCase().includes(search) ||
        h.city?.toLowerCase().includes(search) ||
        h.pincode?.includes(search)
    );
  }

  if (city) {
    list = list.filter((h) => h.city?.toLowerCase().includes(city));
  }

  if (active !== null) {
    list = list.filter((h) => Boolean(h.active) === active);
  }

  return list;
};

const unwrapData = (res) => (res?.data?.data !== undefined ? res.data.data : res.data);

/**
 * 1. List All Hubs
 * GET /api/admin/hubs
 */
export const getHubs = async (params = {}) => {
  try {
    const res = await api.get("/admin/hubs", { params });
    const data = unwrapData(res);
    if (Array.isArray(data)) {
      saveStoredHubs(data);
      return data;
    }
    return data || [];
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || status === 504 || !err.response) {
      return filterStoredHubs(params);
    }
    throw err.response?.data || err;
  }
};

/**
 * 2. Get Hub by ID or Code
 * GET /api/admin/hubs/{id}
 */
export const getHubById = async (id) => {
  try {
    const res = await api.get(`/admin/hubs/${encodeURIComponent(id)}`);
    return unwrapData(res);
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || !err.response) {
      const match = getStoredHubs().find((h) => h.id === id || h.code === id);
      if (match) return match;
    }
    throw err.response?.data || err;
  }
};

/**
 * 3. Create a New Hub
 * POST /api/admin/hubs
 */
export const createHub = async (data) => {
  try {
    const res = await api.post("/admin/hubs", data);
    const created = unwrapData(res);
    if (created) {
      const current = getStoredHubs();
      saveStoredHubs([created, ...current]);
    }
    return created;
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || !err.response) {
      const current = getStoredHubs();
      const nextNum = current.length + 1;
      const code = data.code?.trim() || `HUB-${String(nextNum).padStart(3, "0")}`;
      const newHub = {
        id: `hub_${(data.city || "hub").toLowerCase().slice(0, 3)}_${code.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
        code,
        name: data.name,
        addressLine: data.addressLine,
        formattedAddress: `${data.addressLine}, ${data.pincode}`,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        latitude: Number(data.latitude || 0),
        longitude: Number(data.longitude || 0),
        contactPhone: data.contactPhone || "",
        active: data.active ?? true,
        assignedRidersCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };
      saveStoredHubs([newHub, ...current]);
      return newHub;
    }
    throw err.response?.data || err;
  }
};

/**
 * 4. Update an Existing Hub
 * PUT /api/admin/hubs/{id}
 */
export const updateHub = async (id, data) => {
  try {
    const res = await api.put(`/admin/hubs/${encodeURIComponent(id)}`, data);
    const updated = unwrapData(res);
    if (updated) {
      const current = getStoredHubs();
      saveStoredHubs(current.map((h) => (h.id === id || h.code === id ? { ...h, ...updated } : h)));
    }
    return updated;
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || !err.response) {
      const current = getStoredHubs();
      const updated = current.map((h) => {
        if (h.id === id || h.code === id) {
          return {
            ...h,
            ...data,
            formattedAddress: `${data.addressLine || h.addressLine}, ${data.pincode || h.pincode}`,
            updatedAt: new Date().toISOString(),
          };
        }
        return h;
      });
      saveStoredHubs(updated);
      return updated.find((h) => h.id === id || h.code === id);
    }
    throw err.response?.data || err;
  }
};

/**
 * 5. Toggle Hub Active / Inactive Status
 * PATCH /api/admin/hubs/{id}/status
 */
export const toggleHubStatus = async (id, active) => {
  try {
    const res = await api.patch(`/admin/hubs/${encodeURIComponent(id)}/status`, { active: Boolean(active) });
    return unwrapData(res);
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || !err.response) {
      const current = getStoredHubs();
      const updated = current.map((h) =>
        h.id === id || h.code === id ? { ...h, active: Boolean(active), updatedAt: new Date().toISOString() } : h
      );
      saveStoredHubs(updated);
      return { id, active: Boolean(active) };
    }
    throw err.response?.data || err;
  }
};

/**
 * 6. Delete Hub (Soft Deactivate or Permanent)
 * DELETE /api/admin/hubs/{id}?permanent=false
 */
export const deleteHub = async (id, permanent = false) => {
  try {
    const res = await api.delete(`/admin/hubs/${encodeURIComponent(id)}`, {
      params: { permanent: Boolean(permanent) },
    });
    return unwrapData(res);
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || !err.response) {
      const current = getStoredHubs();
      const target = current.find((h) => h.id === id || h.code === id);
      if (permanent) {
        if (target && target.assignedRidersCount > 0) {
          const conflict = new Error("Cannot permanently delete hub with active assigned riders.");
          conflict.statusCode = 409;
          throw conflict;
        }
        saveStoredHubs(current.filter((h) => h.id !== id && h.code !== id));
      } else {
        saveStoredHubs(
          current.map((h) =>
            h.id === id || h.code === id ? { ...h, active: false, updatedAt: new Date().toISOString() } : h
          )
        );
      }
      return { success: true };
    }
    throw err.response?.data || err;
  }
};

/**
 * 7. Get Riders Assigned to a Hub
 * GET /api/admin/hubs/{id}/riders
 */
export const getHubRiders = async (id) => {
  try {
    const res = await api.get(`/admin/hubs/${encodeURIComponent(id)}/riders`);
    return unwrapData(res);
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || !err.response) {
      return SAMPLE_RIDERS.filter((r) => r.preferredHubId === id || r.hubCode === id);
    }
    throw err.response?.data || err;
  }
};

export default {
  getHubs,
  getHubById,
  createHub,
  updateHub,
  toggleHubStatus,
  deleteHub,
  getHubRiders,
};
