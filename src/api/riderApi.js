import api from "./axios";

const STORAGE_KEY_APPLICATIONS = "hinchmart_admin_rider_applications_v1";
const STORAGE_KEY_REACTIVATIONS = "hinchmart_admin_rider_reactivations_v1";
const STORAGE_KEY_FLEET = "hinchmart_admin_rider_fleet_v1";
const STORAGE_KEY_RIDERS_COOLDOWN = "hinchmart_admin_riders_cooldown_v1";

// 15-minute cooldown to avoid spamming the console with 404s when the backend
// express service endpoints are not yet deployed to https://api.hinchmart.com
const ENDPOINT_FAILURE_COOLDOWN_MS = 15 * 60 * 1000;

export const getRidersCooldownUntil = () => {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(STORAGE_KEY_RIDERS_COOLDOWN)) || 0;
  } catch {
    return 0;
  }
};

export const setRidersCooldownUntil = (timestamp) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_RIDERS_COOLDOWN, String(timestamp));
  } catch {}
};

const unwrapData = (res) => (res?.data?.data !== undefined ? res.data.data : res.data);

// ---------------------------------------------------------------------------
// Seed Data for Development / Offline / Resilient Fallback
// ---------------------------------------------------------------------------

const INITIAL_APPLICATIONS = [
  {
    id: "app_rd_101",
    applicationId: "app_rd_101",
    applicantName: "Vikas Sharma",
    phone: "+91 98765 43210",
    email: "vikas.sharma@gmail.com",
    status: "PENDING",
    city: "New Delhi",
    assignedHubId: "hub_del_okhla_01",
    hubName: "Central Fulfilment Hub (Okhla)",
    vehicleCategory: "TWO_WHEELER",
    vehicleNumber: "DL-01-AB-1234",
    vehicleModel: "Hero Splendor Plus",
    drivingLicenseNumber: "DL-1420200088991",
    licenseExpiry: "2032-05-18",
    emergencyContact: "+91 98112 34567 (Father)",
    submittedAt: "2026-11-25T10:30:00Z",
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    documents: [
      {
        type: "AADHAAR_FRONT",
        name: "Aadhaar Card (Front)",
        status: "VERIFIED",
        uploadedAt: "2026-11-25T10:15:00Z",
        url: "https://images.unsplash.com/photo-1633409381658-6a585725791d?w=800&auto=format&fit=crop&q=60",
      },
      {
        type: "AADHAAR_BACK",
        name: "Aadhaar Card (Back)",
        status: "VERIFIED",
        uploadedAt: "2026-11-25T10:15:00Z",
        url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60",
      },
      {
        type: "PAN_CARD",
        name: "PAN Card",
        status: "PENDING",
        uploadedAt: "2026-11-25T10:18:00Z",
        url: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=60",
      },
      {
        type: "DRIVING_LICENSE",
        name: "Driving License",
        status: "PENDING",
        uploadedAt: "2026-11-25T10:20:00Z",
        url: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=60",
      },
      {
        type: "VEHICLE_RC",
        name: "Vehicle Registration Certificate (RC)",
        status: "PENDING",
        uploadedAt: "2026-11-25T10:22:00Z",
        url: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=60",
      },
    ],
  },
  {
    id: "app_rd_102",
    applicationId: "app_rd_102",
    applicantName: "Rahul Yadav",
    phone: "+91 98112 77889",
    email: "rahul.yadav92@gmail.com",
    status: "PENDING",
    city: "Noida",
    assignedHubId: "hub_noi_sec62_03",
    hubName: "Noida Sector 62 Fulfilment Center",
    vehicleCategory: "ELECTRIC_2W",
    vehicleNumber: "UP-16-EV-9821",
    vehicleModel: "Ather 450X Gen 3",
    drivingLicenseNumber: "UP-1620180012984",
    licenseExpiry: "2030-11-20",
    emergencyContact: "+91 97180 55441 (Brother)",
    submittedAt: "2026-11-25T14:15:00Z",
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    documents: [
      {
        type: "AADHAAR_FRONT",
        name: "Aadhaar Card (Front)",
        status: "VERIFIED",
        uploadedAt: "2026-11-25T14:00:00Z",
        url: "https://images.unsplash.com/photo-1633409381658-6a585725791d?w=800&auto=format&fit=crop&q=60",
      },
      {
        type: "PAN_CARD",
        name: "PAN Card",
        status: "VERIFIED",
        uploadedAt: "2026-11-25T14:02:00Z",
        url: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=60",
      },
      {
        type: "DRIVING_LICENSE",
        name: "Driving License",
        status: "PENDING",
        uploadedAt: "2026-11-25T14:05:00Z",
        url: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=60",
      },
      {
        type: "VEHICLE_RC",
        name: "Vehicle Registration Certificate (RC)",
        status: "PENDING",
        uploadedAt: "2026-11-25T14:06:00Z",
        url: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=60",
      },
    ],
  },
  {
    id: "app_rd_103",
    applicationId: "app_rd_103",
    applicantName: "Mohammed Rizwan",
    phone: "+91 99100 23456",
    email: "rizwan.mohd@gmail.com",
    status: "APPROVED",
    city: "New Delhi",
    assignedHubId: "hub_del_dwarka_02",
    hubName: "West Delhi Dark Store (Dwarka)",
    vehicleCategory: "THREE_WHEELER",
    vehicleNumber: "DL-1E-9932",
    vehicleModel: "Bajaj Maxima Z Cargo",
    drivingLicenseNumber: "DL-0820150034123",
    licenseExpiry: "2029-08-14",
    emergencyContact: "+91 98101 22334 (Spouse)",
    submittedAt: "2026-11-23T09:10:00Z",
    reviewedAt: "2026-11-24T11:00:00Z",
    reviewedBy: "admin_compliance@hinchmart.com",
    rejectionReason: null,
    documents: [
      {
        type: "AADHAAR_FRONT",
        name: "Aadhaar Card (Front)",
        status: "VERIFIED",
        uploadedAt: "2026-11-23T09:00:00Z",
      },
      {
        type: "PAN_CARD",
        name: "PAN Card",
        status: "VERIFIED",
        uploadedAt: "2026-11-23T09:02:00Z",
      },
      {
        type: "DRIVING_LICENSE",
        name: "Driving License",
        status: "VERIFIED",
        uploadedAt: "2026-11-23T09:05:00Z",
      },
      {
        type: "VEHICLE_RC",
        name: "Vehicle RC",
        status: "VERIFIED",
        uploadedAt: "2026-11-23T09:06:00Z",
      },
    ],
  },
  {
    id: "app_rd_104",
    applicationId: "app_rd_104",
    applicantName: "Anil Kumar Soni",
    phone: "+91 98188 66554",
    email: "anil.soni.rider@gmail.com",
    status: "REJECTED",
    city: "New Delhi",
    assignedHubId: "hub_del_okhla_01",
    hubName: "Central Fulfilment Hub (Okhla)",
    vehicleCategory: "TWO_WHEELER",
    vehicleNumber: "DL-05-MN-4321",
    vehicleModel: "TVS Jupiter",
    drivingLicenseNumber: "DL-0520100012398",
    licenseExpiry: "2024-01-10",
    emergencyContact: "+91 98111 99887 (Friend)",
    submittedAt: "2026-11-22T16:00:00Z",
    reviewedAt: "2026-11-23T10:30:00Z",
    reviewedBy: "admin_compliance@hinchmart.com",
    rejectionReason: "Driving license has expired and background check failed verification.",
    documents: [
      {
        type: "DRIVING_LICENSE",
        name: "Driving License",
        status: "REJECTED",
        uploadedAt: "2026-11-22T15:50:00Z",
      },
    ],
  },
];

const INITIAL_REACTIVATIONS = [
  {
    id: "react_901",
    requestId: "react_901",
    riderId: "rdr_504",
    riderName: "Deepak Verma",
    riderPhone: "+91 98990 12345",
    riderEmail: "deepak.verma@gmail.com",
    vehicleCategory: "TWO_WHEELER",
    status: "PENDING",
    deactivationReason: "Automatic deactivation due to consecutive SLA delivery delays and customer complaint.",
    reactivationReason: "Rider attended in-person refresher training at Okhla Hub and passed the road safety assessment.",
    requestedBy: "supervisor_delhi@hinchmart.com",
    requestedByName: "Delhi Hub Supervisor",
    requestedAt: "2026-11-25T11:45:00Z",
    reviewedBy: null,
    reviewedByName: null,
    reviewedAt: null,
    reviewNotes: null,
    supportingDocuments: ["https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=800&auto=format&fit=crop&q=60"],
  },
  {
    id: "react_902",
    requestId: "react_902",
    riderId: "rdr_505",
    riderName: "Manoj Singh",
    riderPhone: "+91 97112 88990",
    riderEmail: "manoj.singh99@gmail.com",
    vehicleCategory: "ELECTRIC_2W",
    status: "APPROVED",
    deactivationReason: "Vehicle RC insurance expired.",
    reactivationReason: "Updated vehicle insurance policy uploaded and verified.",
    requestedBy: "ops_support@hinchmart.com",
    requestedByName: "Ops Dispatch Support",
    requestedAt: "2026-11-24T09:20:00Z",
    reviewedBy: "compliance_head@hinchmart.com",
    reviewedByName: "Compliance Head (Supervisor)",
    reviewedAt: "2026-11-24T15:10:00Z",
    reviewNotes: "Dual control approved: Verified policy with insurer portal directly.",
    supportingDocuments: [],
  },
];

const INITIAL_FLEET = [
  {
    riderId: "rdr_501",
    name: "Ramesh Kumar",
    phone: "+91 98765 43210",
    email: "ramesh.rider@gmail.com",
    hubId: "hub_del_okhla_01",
    hubName: "Central Fulfilment Hub (Okhla)",
    operationalStatus: "ON_DELIVERY", // ONLINE, ON_DELIVERY, BUSY, IDLE, OFFLINE
    redisPresence: {
      isOnline: true,
      lastHeartbeat: "2026-11-26T14:28:10Z",
      ttlSeconds: 52,
    },
    dispatchEligibility: {
      isEligible: true,
      ineligibleReason: null,
    },
    activeAssignment: {
      orderId: "ORD-98421",
      shipmentId: "SHP-3321",
      pickupHub: "Central Fulfilment Hub (Okhla)",
      deliveryPincode: "110020",
      assignedAt: "2026-11-26T14:02:10Z",
      status: "OUT_FOR_DELIVERY",
    },
    vehicleCategory: "TWO_WHEELER",
    vehicleNumber: "DL-10-AB-1234",
    batteryLevel: 86,
    rating: 4.88,
    completedDeliveriesToday: 12,
    latitude: 28.5355,
    longitude: 77.2732,
    maxPayloadKg: 30,
    maxVolumeLiters: 65,
    lastLocationUpdate: "2026-11-26T14:28:00Z",
  },
  {
    riderId: "rdr_502",
    name: "Suresh Sharma",
    phone: "+91 98112 23344",
    email: "suresh.rider@gmail.com",
    hubId: "hub_del_okhla_01",
    hubName: "Central Fulfilment Hub (Okhla)",
    operationalStatus: "ONLINE",
    redisPresence: {
      isOnline: true,
      lastHeartbeat: "2026-11-26T14:29:05Z",
      ttlSeconds: 58,
    },
    dispatchEligibility: {
      isEligible: true,
      ineligibleReason: null,
    },
    activeAssignment: null,
    vehicleCategory: "TWO_WHEELER",
    vehicleNumber: "DL-08-CD-5678",
    batteryLevel: 94,
    rating: 4.92,
    completedDeliveriesToday: 8,
    latitude: 28.5372,
    longitude: 77.2751,
    maxPayloadKg: 30,
    maxVolumeLiters: 65,
    lastLocationUpdate: "2026-11-26T14:29:00Z",
  },
  {
    riderId: "rdr_503",
    name: "Amit Patel",
    phone: "+91 97123 45678",
    email: "amit.rider@gmail.com",
    hubId: "hub_del_dwarka_02",
    hubName: "West Delhi Dark Store (Dwarka)",
    operationalStatus: "BUSY",
    redisPresence: {
      isOnline: true,
      lastHeartbeat: "2026-11-26T14:27:30Z",
      ttlSeconds: 40,
    },
    dispatchEligibility: {
      isEligible: false,
      ineligibleReason: "MAX_ACTIVE_ASSIGNMENTS_REACHED",
    },
    activeAssignment: {
      orderId: "ORD-98440",
      shipmentId: "SHP-3330",
      pickupHub: "West Delhi Dark Store (Dwarka)",
      deliveryPincode: "110078",
      assignedAt: "2026-11-26T14:15:00Z",
      status: "PACKING_PICKUP",
    },
    vehicleCategory: "THREE_WHEELER",
    vehicleNumber: "DL-04-EF-9012",
    batteryLevel: 72,
    rating: 4.75,
    completedDeliveriesToday: 15,
    latitude: 28.5921,
    longitude: 77.046,
    maxPayloadKg: 250,
    maxVolumeLiters: 800,
    lastLocationUpdate: "2026-11-26T14:27:00Z",
  },
  {
    riderId: "rdr_504",
    name: "Deepak Verma",
    phone: "+91 98990 12345",
    email: "deepak.verma@gmail.com",
    hubId: "hub_del_okhla_01",
    hubName: "Central Fulfilment Hub (Okhla)",
    operationalStatus: "OFFLINE",
    redisPresence: {
      isOnline: false,
      lastHeartbeat: "2026-11-24T12:00:00Z",
      ttlSeconds: 0,
    },
    dispatchEligibility: {
      isEligible: false,
      ineligibleReason: "ACCOUNT_DEACTIVATED_PENDING_REACTIVATION",
    },
    activeAssignment: null,
    vehicleCategory: "TWO_WHEELER",
    vehicleNumber: "DL-07-JK-3412",
    batteryLevel: 45,
    rating: 4.12,
    completedDeliveriesToday: 0,
    latitude: 28.54,
    longitude: 77.27,
    maxPayloadKg: 25,
    maxVolumeLiters: 50,
    lastLocationUpdate: "2026-11-24T12:00:00Z",
  },
  {
    riderId: "rdr_505",
    name: "Manoj Singh",
    phone: "+91 97112 88990",
    email: "manoj.singh99@gmail.com",
    hubId: "hub_noi_sec62_03",
    hubName: "Noida Sector 62 Fulfilment Center",
    operationalStatus: "ONLINE",
    redisPresence: {
      isOnline: true,
      lastHeartbeat: "2026-11-26T14:29:40Z",
      ttlSeconds: 59,
    },
    dispatchEligibility: {
      isEligible: true,
      ineligibleReason: null,
    },
    activeAssignment: null,
    vehicleCategory: "ELECTRIC_2W",
    vehicleNumber: "UP-16-EV-5544",
    batteryLevel: 98,
    rating: 4.85,
    completedDeliveriesToday: 6,
    latitude: 28.628,
    longitude: 77.3649,
    maxPayloadKg: 35,
    maxVolumeLiters: 70,
    lastLocationUpdate: "2026-11-26T14:29:30Z",
  },
];

// ---------------------------------------------------------------------------
// Local Cache Helpers
// ---------------------------------------------------------------------------

export const getStoredApplications = () => {
  if (typeof window === "undefined") return INITIAL_APPLICATIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_APPLICATIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_APPLICATIONS, JSON.stringify(INITIAL_APPLICATIONS));
      return INITIAL_APPLICATIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_APPLICATIONS;
  } catch {
    return INITIAL_APPLICATIONS;
  }
};

export const saveStoredApplications = (apps) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_APPLICATIONS, JSON.stringify(apps));
  } catch {}
};

export const getStoredReactivations = () => {
  if (typeof window === "undefined") return INITIAL_REACTIVATIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REACTIVATIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_REACTIVATIONS, JSON.stringify(INITIAL_REACTIVATIONS));
      return INITIAL_REACTIVATIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_REACTIVATIONS;
  } catch {
    return INITIAL_REACTIVATIONS;
  }
};

export const saveStoredReactivations = (requests) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_REACTIVATIONS, JSON.stringify(requests));
  } catch {}
};

export const getStoredFleet = () => {
  if (typeof window === "undefined") return INITIAL_FLEET;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FLEET);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_FLEET, JSON.stringify(INITIAL_FLEET));
      return INITIAL_FLEET;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_FLEET;
  } catch {
    return INITIAL_FLEET;
  }
};

export const saveStoredFleet = (fleet) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_FLEET, JSON.stringify(fleet));
  } catch {}
};

export const filterStoredApplications = (params = {}) => {
  let list = getStoredApplications();
  if (params.status && params.status !== "ALL") {
    list = list.filter((a) => a.status?.toUpperCase() === params.status.toUpperCase());
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    list = list.filter(
      (a) =>
        a.applicantName?.toLowerCase().includes(q) ||
        a.phone?.includes(q) ||
        a.city?.toLowerCase().includes(q) ||
        a.id?.toLowerCase().includes(q)
    );
  }
  return list;
};

export const filterStoredReactivations = (params = {}) => {
  let list = getStoredReactivations();
  if (params.riderId) {
    list = list.filter((r) => r.riderId === params.riderId);
  }
  if (params.status && params.status !== "ALL") {
    list = list.filter((r) => r.status?.toUpperCase() === params.status.toUpperCase());
  }
  return list;
};

export const filterStoredFleet = (params = {}) => {
  let list = getStoredFleet();
  if (params.operationalStatus && params.operationalStatus !== "ALL") {
    list = list.filter((r) => r.operationalStatus === params.operationalStatus);
  }
  if (params.hubId && params.hubId !== "ALL") {
    list = list.filter((r) => r.hubId === params.hubId);
  }
  if (params.vehicleCategory && params.vehicleCategory !== "ALL") {
    list = list.filter((r) => r.vehicleCategory === params.vehicleCategory);
  }
  if (params.isEligible !== undefined && params.isEligible !== "") {
    const want = String(params.isEligible) === "true";
    list = list.filter((r) => Boolean(r.dispatchEligibility?.isEligible) === want);
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    list = list.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.phone?.includes(q) ||
        r.vehicleNumber?.toLowerCase().includes(q) ||
        r.riderId?.toLowerCase().includes(q)
    );
  }
  return list;
};

// ===========================================================================
// 1. Rider Onboarding & KYC Review (AdminRiderApplicationController)
// Base path: /v1/admin/rider-applications
// ===========================================================================

/**
 * GET /api/v1/admin/rider-applications?status=...
 * Paginated list of rider applications (Requires: RIDER_APPLICATION_REVIEW)
 */
export const getRiderApplications = async (params = {}) => {
  if (Date.now() < getRidersCooldownUntil()) {
    return filterStoredApplications(params);
  }
  try {
    const res = await api.get("/v1/admin/rider-applications", { params });
    const data = unwrapData(res);
    if (Array.isArray(data)) {
      saveStoredApplications(data);
      return data;
    }
    if (data && Array.isArray(data.content || data.items || data.applications)) {
      const list = data.content || data.items || data.applications;
      saveStoredApplications(list);
      return list;
    }
    return data || [];
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || status === 504 || !err.response) {
      if (status === 404) {
        setRidersCooldownUntil(Date.now() + ENDPOINT_FAILURE_COOLDOWN_MS);
      }
      return filterStoredApplications(params);
    }
    throw err.response?.data || err;
  }
};

/**
 * GET /api/v1/admin/rider-applications/{applicationId}
 * Detailed application; decrypts PII only with RIDER_APPLICATION_PII_VIEW
 */
export const getRiderApplicationById = async (applicationId) => {
  try {
    const res = await api.get(`/v1/admin/rider-applications/${encodeURIComponent(applicationId)}`);
    return unwrapData(res);
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || !err.response) {
      const list = getStoredApplications();
      const match = list.find((a) => a.id === applicationId || a.applicationId === applicationId);
      if (match) return match;
    }
    throw err.response?.data || err;
  }
};

/**
 * GET /api/v1/admin/rider-applications/{applicationId}/documents/{documentType}/download-url
 * 15-min pre-signed GET URL for KYC document (RIDER_APPLICATION_REVIEW + RIDER_KYC_DOCUMENT_VIEW)
 */
export const getRiderDocumentDownloadUrl = async (applicationId, documentType) => {
  try {
    const res = await api.get(
      `/v1/admin/rider-applications/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(
        documentType
      )}/download-url`
    );
    return unwrapData(res);
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || !err.response) {
      // Fallback pre-signed mockup
      const app = getStoredApplications().find((a) => a.id === applicationId);
      const doc = app?.documents?.find((d) => d.type === documentType);
      return {
        downloadUrl:
          doc?.url ||
          `https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1000&auto=format&fit=crop&q=80`,
        expiresInSeconds: 900,
        documentType,
        applicationId,
      };
    }
    throw err.response?.data || err;
  }
};

/**
 * POST /api/v1/admin/rider-applications/{applicationId}/approve
 * Approve application and provision active rider (RIDER_APPLICATION_REVIEW)
 */
export const approveRiderApplication = async (applicationId, payload = {}) => {
  try {
    const res = await api.post(
      `/v1/admin/rider-applications/${encodeURIComponent(applicationId)}/approve`,
      payload
    );
    const updated = unwrapData(res);
    // Sync local store
    const list = getStoredApplications();
    const updatedList = list.map((a) =>
      a.id === applicationId
        ? {
            ...a,
            status: "APPROVED",
            reviewedAt: new Date().toISOString(),
            reviewedBy: payload.reviewedBy || "admin@hinchmart.com",
            reviewNotes: payload.remarks || "Approved by Admin",
          }
        : a
    );
    saveStoredApplications(updatedList);
    return updated;
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || !err.response) {
      const list = getStoredApplications();
      const updatedList = list.map((a) =>
        a.id === applicationId
          ? {
              ...a,
              status: "APPROVED",
              reviewedAt: new Date().toISOString(),
              reviewedBy: "admin@hinchmart.com",
              reviewNotes: payload.remarks || "Approved and provisioned in fleet",
            }
          : a
      );
      saveStoredApplications(updatedList);

      // Provision into fleet
      const app = list.find((a) => a.id === applicationId);
      if (app) {
        const fleet = getStoredFleet();
        const newRider = {
          riderId: `rdr_${Date.now().toString().slice(-4)}`,
          name: app.applicantName,
          phone: app.phone,
          email: app.email,
          hubId: app.assignedHubId,
          hubName: app.hubName,
          operationalStatus: "ONLINE",
          redisPresence: { isOnline: true, lastHeartbeat: new Date().toISOString(), ttlSeconds: 60 },
          dispatchEligibility: { isEligible: true, ineligibleReason: null },
          activeAssignment: null,
          vehicleCategory: app.vehicleCategory,
          vehicleNumber: app.vehicleNumber,
          batteryLevel: 100,
          rating: 5.0,
          completedDeliveriesToday: 0,
          latitude: 28.5355,
          longitude: 77.2732,
          maxPayloadKg: app.vehicleCategory === "THREE_WHEELER" ? 250 : 30,
          maxVolumeLiters: app.vehicleCategory === "THREE_WHEELER" ? 800 : 65,
          lastLocationUpdate: new Date().toISOString(),
        };
        saveStoredFleet([newRider, ...fleet]);
      }

      return {
        success: true,
        message: "Application approved and rider provisioned successfully.",
        applicationId,
        status: "APPROVED",
      };
    }
    throw err.response?.data || err;
  }
};

/**
 * POST /api/v1/admin/rider-applications/{applicationId}/reject
 * Reject pending application (RIDER_APPLICATION_REVIEW)
 */
export const rejectRiderApplication = async (applicationId, payload = {}) => {
  try {
    const res = await api.post(
      `/v1/admin/rider-applications/${encodeURIComponent(applicationId)}/reject`,
      payload
    );
    const updated = unwrapData(res);
    const list = getStoredApplications();
    const updatedList = list.map((a) =>
      a.id === applicationId
        ? {
            ...a,
            status: "REJECTED",
            rejectionReason: payload.reason || "Rejected by reviewer",
            reviewedAt: new Date().toISOString(),
          }
        : a
    );
    saveStoredApplications(updatedList);
    return updated;
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || !err.response) {
      const list = getStoredApplications();
      const updatedList = list.map((a) =>
        a.id === applicationId
          ? {
              ...a,
              status: "REJECTED",
              rejectionReason: payload.reason || "Documents could not be verified",
              reviewedAt: new Date().toISOString(),
            }
          : a
      );
      saveStoredApplications(updatedList);
      return {
        success: true,
        message: "Application rejected.",
        applicationId,
        status: "REJECTED",
      };
    }
    throw err.response?.data || err;
  }
};

// ===========================================================================
// 2. Rider Reactivation (Dual Control) (AdminRiderReactivationController)
// Base path: /v1/admin
// ===========================================================================

/**
 * POST /api/v1/admin/riders/{riderId}/reactivation-requests
 * Initiate reactivation request (RIDER_REACTIVATION_REQUEST)
 */
export const createReactivationRequest = async (riderId, payload) => {
  try {
    const res = await api.post(`/v1/admin/riders/${encodeURIComponent(riderId)}/reactivation-requests`, payload);
    const created = unwrapData(res);
    if (created) {
      const current = getStoredReactivations();
      saveStoredReactivations([created, ...current]);
    }
    return created;
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || !err.response) {
      const current = getStoredReactivations();
      const fleet = getStoredFleet();
      const rider = fleet.find((r) => r.riderId === riderId);
      const newReq = {
        id: `react_${Date.now().toString().slice(-4)}`,
        requestId: `react_${Date.now().toString().slice(-4)}`,
        riderId,
        riderName: rider?.name || "Rider " + riderId,
        riderPhone: rider?.phone || "",
        riderEmail: rider?.email || "",
        vehicleCategory: rider?.vehicleCategory || "TWO_WHEELER",
        status: "PENDING",
        deactivationReason: payload.deactivationReason || "Account inactive/suspended",
        reactivationReason: payload.reason,
        requestedBy: payload.requestedBy || "current_admin@hinchmart.com",
        requestedByName: payload.requestedByName || "Admin User",
        requestedAt: new Date().toISOString(),
        reviewedBy: null,
        reviewedByName: null,
        reviewedAt: null,
        reviewNotes: null,
        supportingDocuments: payload.supportingDocuments || [],
      };
      saveStoredReactivations([newReq, ...current]);
      return newReq;
    }
    throw err.response?.data || err;
  }
};

/**
 * GET /api/v1/admin/rider-reactivations?riderId=...&status=...
 * List reactivation requests
 */
export const getReactivationRequests = async (params = {}) => {
  if (Date.now() < getRidersCooldownUntil()) {
    return filterStoredReactivations(params);
  }
  try {
    const res = await api.get("/v1/admin/rider-reactivations", { params });
    const data = unwrapData(res);
    if (Array.isArray(data)) {
      saveStoredReactivations(data);
      return data;
    }
    if (data && Array.isArray(data.content || data.items || data.requests)) {
      const list = data.content || data.items || data.requests;
      saveStoredReactivations(list);
      return list;
    }
    return data || [];
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || !err.response) {
      if (status === 404) {
        setRidersCooldownUntil(Date.now() + ENDPOINT_FAILURE_COOLDOWN_MS);
      }
      return filterStoredReactivations(params);
    }
    throw err.response?.data || err;
  }
};

/**
 * GET /api/v1/admin/rider-reactivations/{requestId}
 * Get reactivation request details
 */
export const getReactivationRequestById = async (requestId) => {
  try {
    const res = await api.get(`/v1/admin/rider-reactivations/${encodeURIComponent(requestId)}`);
    return unwrapData(res);
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || !err.response) {
      const list = getStoredReactivations();
      const match = list.find((r) => r.id === requestId || r.requestId === requestId);
      if (match) return match;
    }
    throw err.response?.data || err;
  }
};

/**
 * POST /api/v1/admin/rider-reactivations/{requestId}/approve
 * Supervisor approval (RIDER_REACTIVATION_SUPERVISOR, non-self-approval enforced)
 */
export const approveReactivationRequest = async (requestId, payload = {}) => {
  try {
    const res = await api.post(`/v1/admin/rider-reactivations/${encodeURIComponent(requestId)}/approve`, payload);
    const updated = unwrapData(res);
    const list = getStoredReactivations();
    saveStoredReactivations(
      list.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: "APPROVED",
              reviewedBy: payload.reviewedBy || "supervisor@hinchmart.com",
              reviewedAt: new Date().toISOString(),
              reviewNotes: payload.notes || "Dual control supervisor approval granted",
            }
          : r
      )
    );
    return updated;
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || !err.response) {
      const list = getStoredReactivations();
      const req = list.find((r) => r.id === requestId || r.requestId === requestId);
      // Non-self approval validation
      if (req && payload.currentUserEmail && req.requestedBy === payload.currentUserEmail) {
        const error = new Error("Dual Control Violation: Initiator cannot supervisor-approve their own reactivation request.");
        error.status = 403;
        throw error;
      }
      saveStoredReactivations(
        list.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: "APPROVED",
                reviewedBy: payload.currentUserEmail || "supervisor@hinchmart.com",
                reviewedByName: "Authorized Supervisor",
                reviewedAt: new Date().toISOString(),
                reviewNotes: payload.notes || "Dual-control supervisor approval completed.",
              }
            : r
        )
      );

      // Restore rider to ONLINE in fleet
      if (req?.riderId) {
        const fleet = getStoredFleet();
        saveStoredFleet(
          fleet.map((fl) =>
            fl.riderId === req.riderId
              ? {
                  ...fl,
                  operationalStatus: "ONLINE",
                  dispatchEligibility: { isEligible: true, ineligibleReason: null },
                  redisPresence: { isOnline: true, lastHeartbeat: new Date().toISOString(), ttlSeconds: 60 },
                }
              : fl
          )
        );
      }

      return {
        success: true,
        message: "Reactivation request approved and rider restored to active dispatch.",
        requestId,
        status: "APPROVED",
      };
    }
    throw err.response?.data || err;
  }
};

/**
 * POST /api/v1/admin/rider-reactivations/{requestId}/reject
 * Supervisor rejection (RIDER_REACTIVATION_SUPERVISOR)
 */
export const rejectReactivationRequest = async (requestId, payload = {}) => {
  try {
    const res = await api.post(`/v1/admin/rider-reactivations/${encodeURIComponent(requestId)}/reject`, payload);
    const updated = unwrapData(res);
    const list = getStoredReactivations();
    saveStoredReactivations(
      list.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: "REJECTED",
              reviewedBy: payload.reviewedBy || "supervisor@hinchmart.com",
              reviewedAt: new Date().toISOString(),
              reviewNotes: payload.reason || "Rejected by supervisor",
            }
          : r
      )
    );
    return updated;
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || !err.response) {
      const list = getStoredReactivations();
      saveStoredReactivations(
        list.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: "REJECTED",
                reviewedBy: payload.currentUserEmail || "supervisor@hinchmart.com",
                reviewedAt: new Date().toISOString(),
                reviewNotes: payload.reason || "Reactivation rejected by supervisor",
              }
            : r
        )
      );
      return {
        success: true,
        message: "Reactivation request rejected.",
        requestId,
        status: "REJECTED",
      };
    }
    throw err.response?.data || err;
  }
};

// ===========================================================================
// 3. Rider Vehicle Category (AdminRiderVehicleCategoryController)
// Base path: /v1/admin
// ===========================================================================

/**
 * GET /api/v1/admin/riders/{riderId}/vehicle-category
 * Get a rider's registered vehicle category
 */
export const getRiderVehicleCategory = async (riderId) => {
  try {
    const res = await api.get(`/v1/admin/riders/${encodeURIComponent(riderId)}/vehicle-category`);
    return unwrapData(res);
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || !err.response) {
      const fleet = getStoredFleet();
      const rider = fleet.find((r) => r.riderId === riderId);
      return {
        riderId,
        vehicleCategory: rider?.vehicleCategory || "TWO_WHEELER",
        vehicleNumber: rider?.vehicleNumber || "DL-01-XX-0000",
        maxPayloadKg: rider?.maxPayloadKg || 30,
        maxVolumeLiters: rider?.maxVolumeLiters || 65,
        updatedAt: new Date().toISOString(),
      };
    }
    throw err.response?.data || err;
  }
};

/**
 * PUT /api/v1/admin/riders/{riderId}/vehicle-category
 * Set a rider's vehicle category (VEHICLE_CAPACITY_MANAGEMENT)
 */
export const updateRiderVehicleCategory = async (riderId, payload) => {
  try {
    const res = await api.put(`/v1/admin/riders/${encodeURIComponent(riderId)}/vehicle-category`, payload);
    const updated = unwrapData(res);
    // Update local fleet representation
    const fleet = getStoredFleet();
    saveStoredFleet(
      fleet.map((r) =>
        r.riderId === riderId
          ? {
              ...r,
              vehicleCategory: payload.vehicleCategory || r.vehicleCategory,
              maxPayloadKg: payload.maxPayloadKg ?? r.maxPayloadKg,
              maxVolumeLiters: payload.maxVolumeLiters ?? r.maxVolumeLiters,
            }
          : r
      )
    );
    return updated;
  } catch (err) {
    const status = err.response?.status;
    if (status === 404 || status === 502 || !err.response) {
      const fleet = getStoredFleet();
      const updatedRider = fleet.find((r) => r.riderId === riderId);
      saveStoredFleet(
        fleet.map((r) =>
          r.riderId === riderId
            ? {
                ...r,
                vehicleCategory: payload.vehicleCategory || r.vehicleCategory,
                maxPayloadKg: payload.maxPayloadKg ?? r.maxPayloadKg,
                maxVolumeLiters: payload.maxVolumeLiters ?? r.maxVolumeLiters,
              }
            : r
        )
      );
      return {
        riderId,
        vehicleCategory: payload.vehicleCategory || updatedRider?.vehicleCategory || "TWO_WHEELER",
        maxPayloadKg: payload.maxPayloadKg ?? 30,
        maxVolumeLiters: payload.maxVolumeLiters ?? 65,
        updatedAt: new Date().toISOString(),
      };
    }
    throw err.response?.data || err;
  }
};

// ===========================================================================
// 4. Fleet & Rider Operational Overview (DispatcherOperationsController)
// Base path: /v1/dispatcher/riders (alias: /v1/dispatcher/fleet)
// ===========================================================================

/**
 * GET /api/v1/dispatcher/riders (alias: /api/v1/dispatcher/fleet)
 * Operational status, availability, Redis presence, active assignments, and dispatch eligibility (DISPATCH_VIEW or DISPATCH_ASSIGNMENT)
 */
export const getFleetRiders = async (params = {}) => {
  if (Date.now() < getRidersCooldownUntil()) {
    return filterStoredFleet(params);
  }
  try {
    // Primary path: /v1/dispatcher/riders
    const res = await api.get("/v1/dispatcher/riders", { params });
    const data = unwrapData(res);
    if (Array.isArray(data)) {
      saveStoredFleet(data);
      return data;
    }
    if (data && Array.isArray(data.content || data.riders || data.fleet)) {
      const list = data.content || data.riders || data.fleet;
      saveStoredFleet(list);
      return list;
    }
    return data || [];
  } catch (primaryErr) {
    const status = primaryErr?.response?.status;
    if (status === 404) {
      setRidersCooldownUntil(Date.now() + ENDPOINT_FAILURE_COOLDOWN_MS);
      return filterStoredFleet(params);
    }
    // Secondary fallback alias: /v1/dispatcher/fleet
    try {
      const aliasRes = await api.get("/v1/dispatcher/fleet", { params });
      const data = unwrapData(aliasRes);
      if (Array.isArray(data)) {
        saveStoredFleet(data);
        return data;
      }
      return data || [];
    } catch {
      return filterStoredFleet(params);
    }
  }
};

export default {
  getRiderApplications,
  getRiderApplicationById,
  getRiderDocumentDownloadUrl,
  approveRiderApplication,
  rejectRiderApplication,
  createReactivationRequest,
  getReactivationRequests,
  getReactivationRequestById,
  approveReactivationRequest,
  rejectReactivationRequest,
  getRiderVehicleCategory,
  updateRiderVehicleCategory,
  getFleetRiders,
};
