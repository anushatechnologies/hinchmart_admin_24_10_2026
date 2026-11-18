import api from "./axios";

const unwrapData = (payload) =>
  payload?.data !== undefined ? payload.data : payload;

const request = async (operation) => {
  try {
    const response = await operation();
    return unwrapData(response.data);
  } catch (error) {
    throw error.response?.data || error;
  }
};

const encode = (value) => encodeURIComponent(String(value));

export const DeliveryService = {
  getVehicles: (params = {}) =>
    request(() => api.get("/admin/delivery/vehicles", { params })),
  getVehicle: (id) =>
    request(() => api.get(`/admin/delivery/vehicles/${encode(id)}`)),
  createVehicle: (data) =>
    request(() => api.post("/admin/delivery/vehicles", data)),
  updateVehicle: (id, data) =>
    request(() => api.put(`/admin/delivery/vehicles/${encode(id)}`, data)),
  toggleVehicleStatus: (id, active) =>
    request(() =>
      api.patch(`/admin/delivery/vehicles/${encode(id)}/status`, null, {
        params: { active: Boolean(active) },
      })
    ),

  getServiceAreas: (params = {}) =>
    request(() => api.get("/admin/delivery/service-areas", { params })),
  getServiceArea: (id) =>
    request(() =>
      api.get(`/admin/delivery/service-areas/${encode(id)}`)
    ),
  createServiceArea: (data) =>
    request(() => api.post("/admin/delivery/service-areas", data)),
  updateServiceArea: (id, data) =>
    request(() =>
      api.put(`/admin/delivery/service-areas/${encode(id)}`, data)
    ),
  toggleServiceAreaStatus: (id, active) =>
    request(() =>
      api.patch(
        `/admin/delivery/service-areas/${encode(id)}/status`,
        null,
        { params: { active: Boolean(active) } }
      )
    ),
  addPincodes: (serviceAreaId, pincodes) =>
    request(() =>
      api.post(
        `/admin/delivery/service-areas/${encode(serviceAreaId)}/pincodes`,
        pincodes
      )
    ),
  removePincode: (serviceAreaId, pincode) =>
    request(() =>
      api.delete(
        `/admin/delivery/service-areas/${encode(serviceAreaId)}/pincodes/${encode(pincode)}`
      )
    ),

  getPricingProfiles: (params = {}) =>
    request(() => api.get("/admin/delivery/pricing-profiles", { params })),
  getPricingProfile: (id) =>
    request(() =>
      api.get(`/admin/delivery/pricing-profiles/${encode(id)}`)
    ),
  createPricingProfile: (data) =>
    request(() => api.post("/admin/delivery/pricing-profiles", data)),
  updatePricingProfile: (id, data) =>
    request(() =>
      api.put(`/admin/delivery/pricing-profiles/${encode(id)}`, data)
    ),
  togglePricingProfileStatus: (id, active) =>
    request(() =>
      api.patch(
        `/admin/delivery/pricing-profiles/${encode(id)}/status`,
        null,
        { params: { active: Boolean(active) } }
      )
    ),

  addSlab: (profileId, slab) =>
    request(() =>
      api.post(
        `/admin/delivery/pricing-profiles/${encode(profileId)}/slabs`,
        slab
      )
    ),
  updateSlab: (slabId, slab) =>
    request(() =>
      api.put(`/admin/delivery/slabs/${encode(slabId)}`, slab)
    ),
  toggleSlabStatus: (slabId, active) =>
    request(() =>
      api.patch(`/admin/delivery/slabs/${encode(slabId)}/status`, null, {
        params: { active: Boolean(active) },
      })
    ),
  deleteSlab: (slabId) =>
    request(() => api.delete(`/admin/delivery/slabs/${encode(slabId)}`)),

  simulateDeliveryPricing: (data) =>
    request(() => api.post("/admin/delivery/pricing/simulate", data)),
  verifyOrderMeasurements: (orderId, data) =>
    request(() =>
      api.post(
        `/admin/delivery/orders/${encode(orderId)}/verify-measurements`,
        data
      )
    ),

  getAuditLogs: (params = {}) =>
    request(() => api.get("/admin/delivery/audit-logs", { params })),
  getAuditLogById: (logId) =>
    request(() =>
      api.get(`/admin/delivery/audit-logs/${encode(logId)}`)
    ),
};

export default DeliveryService;
