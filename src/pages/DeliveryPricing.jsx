import { useEffect, useState } from "react";
import {
  Activity,
  MapPin,
  Package,
  Plus,
  Route,
  Search,
  Truck,
  Calculator,
  History,
  Edit2,
  Trash2,
  Loader2,
  X,
  RefreshCw,
} from "lucide-react";
import DeliveryService from "../api/deliveryService";
import { useToast } from "../components/ToastContext";
import { formatInr, formatKm, formatDateTime } from "../utils/formatUtils";

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "areas", label: "Service Areas", icon: MapPin },
  { id: "vehicles", label: "Vehicle Categories", icon: Truck },
  { id: "profiles", label: "Pricing Profiles", icon: Package },
  { id: "slabs", label: "Distance Slabs", icon: Route },
  { id: "simulator", label: "Pricing Simulator", icon: Calculator },
  { id: "audit", label: "Audit History", icon: History },
];

const listFrom = (payload, keys = []) => {
  if (Array.isArray(payload)) return payload;
  for (const key of ["data", "content", "items", "rows", "profiles", "vehicles", "areas", ...keys]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
};

const errorMessage = (error, fallback) =>
  error?.message || error?.response?.data?.message || fallback;

export default function DeliveryPricing() {
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [vehicles, setVehicles] = useState([]);
  const [areas, setAreas] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [audit, setAudit] = useState([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [simulation, setSimulation] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [deliveryBackendAvailable, setDeliveryBackendAvailable] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      if (!localStorage.getItem("hinchmart_admin_token")) {
        setError("Admin session is not ready. Please sign in again.");
        setLoading(false);
        return;
      }
      const [vehicleResult, areaResult] = await Promise.allSettled([
        DeliveryService.getVehicles(),
        DeliveryService.getServiceAreas({ page: 1, limit: 100 }),
      ]);
      if (vehicleResult.status === "fulfilled") setVehicles(listFrom(vehicleResult.value));
      if (areaResult.status === "fulfilled") setAreas(listFrom(areaResult.value));

      let profileItems = [];
      if (areaResult.status === "fulfilled") {
        const areaItems = listFrom(areaResult.value);
        const profileResults = await Promise.allSettled(
          areaItems.map((area) => DeliveryService.getPricingProfiles({ serviceAreaId: area.id }))
        );
        profileItems = profileResults
          .filter((result) => result.status === "fulfilled")
          .flatMap((result) => listFrom(result.value));
        setProfiles(profileItems);
      }

      const failures = [vehicleResult, areaResult].filter(
        (result) => result.status === "rejected"
      );
      if (failures.length) {
        const reason = failures[0].reason;
        const status = reason?.statusCode || reason?.response?.status;
        if (status === 404) {
          setDeliveryBackendAvailable(false);
          setError("The V41 Delivery Pricing backend routes are not deployed on this server. No mock data is being used.");
        } else {
          setError(errorMessage(reason, "Some delivery pricing data could not be loaded."));
        }
      }
    } catch (err) {
      setError(errorMessage(err, "Unable to load delivery pricing."));
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await DeliveryService.getAuditLogs({ page: 1, limit: 100 });
      setAudit(listFrom(result, ["auditLogs"]));
    } catch (err) {
      setError(errorMessage(err, "Unable to load audit history."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (tab === "audit") loadAudit();
  }, [tab]);

  const openCreate = (kind) => {
    if (!deliveryBackendAvailable) {
      toast.error("V41 Delivery Pricing backend routes are not deployed.");
      return;
    }
    if (kind === "vehicle") setForm({ code: "", name: "", description: "", maxPayloadKg: "", maxLengthMm: "", maxWidthMm: "", maxHeightMm: "", maxVolumeCbm: "", requiresHeavyVehicleAccess: false, active: true, effectiveFrom: "", effectiveTo: "", displayOrder: 1 });
    if (kind === "area") setForm({ code: "", name: "", description: "", state: "", city: "", active: true, effectiveFrom: "", effectiveTo: "", pincodes: [] });
    if (kind === "profile") setForm({ serviceAreaId: "", name: "", description: "", effectiveFrom: "", effectiveTo: "", active: true });
    if (kind === "slab") setForm({ profileId: profiles[0]?.id || "", vehicleCategoryId: vehicles[0]?.id || "", fromDistanceKm: "0", toDistanceKm: "", pricingType: "FIXED", rateAmount: "", minimumCharge: "", additionalFlatCharge: "0", active: true, effectiveFrom: "", effectiveTo: "" });
    setModal(kind);
  };

  const openEdit = (kind, item) => {
    setForm({
      ...item,
      effectiveFrom: item.effectiveFrom || "",
      effectiveTo: item.effectiveTo || "",
      pincodes: item.pincodes || [],
    });
    setModal(kind);
  };

  const closeModal = () => {
    if (!submitting) setModal(null);
  };

  const save = async (event) => {
    event.preventEvent?.();
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (modal === "vehicle") {
        const payload = {
          ...form,
          code: form.code?.toUpperCase(),
          maxPayloadKg: Number(form.maxPayloadKg || 0),
          maxLengthMm: Number(form.maxLengthMm || 0),
          maxWidthMm: Number(form.maxWidthMm || 0),
          maxHeightMm: Number(form.maxHeightMm || 0),
          maxVolumeCbm: Number(form.maxVolumeCbm || 0),
          displayOrder: Number(form.displayOrder || 1),
          effectiveFrom: form.effectiveFrom || null,
          effectiveTo: form.effectiveTo || null,
        };
        form.id ? await DeliveryService.updateVehicle(form.id, payload) : await DeliveryService.createVehicle(payload);
        toast.success(form.id ? "Vehicle category updated." : "Vehicle category created.");
      }
      if (modal === "area") {
        const payload = {
          ...form,
          code: form.code?.toUpperCase(),
          effectiveFrom: form.effectiveFrom || null,
          effectiveTo: form.effectiveTo || null,
          pincodes: Array.isArray(form.pincodes) ? form.pincodes : [],
        };
        form.id ? await DeliveryService.updateServiceArea(form.id, payload) : await DeliveryService.createServiceArea(payload);
        toast.success(form.id ? "Service area updated." : "Service area created.");
      }
      if (modal === "profile") {
        const payload = {
          ...form,
          serviceAreaId: Number(form.serviceAreaId),
          effectiveFrom: form.effectiveFrom || null,
          effectiveTo: form.effectiveTo || null,
        };
        form.id ? await DeliveryService.updatePricingProfile(form.id, payload) : await DeliveryService.createPricingProfile(payload);
        toast.success(form.id ? "Pricing profile updated." : "Pricing profile created.");
      }
      if (modal === "slab") {
        const payload = {
          vehicleCategoryId: Number(form.vehicleCategoryId),
          fromDistanceKm: Number(form.fromDistanceKm),
          toDistanceKm: form.toDistanceKm === "" ? null : Number(form.toDistanceKm),
          pricingType: form.pricingType,
          rateAmount: Number(form.rateAmount),
          minimumCharge: Number(form.minimumCharge || 0),
          additionalFlatCharge: Number(form.additionalFlatCharge || 0),
          active: Boolean(form.active),
          effectiveFrom: form.effectiveFrom || null,
          effectiveTo: form.effectiveTo || null,
        };
        form.id ? await DeliveryService.updateSlab(form.id, payload) : await DeliveryService.addSlab(form.profileId, payload);
        toast.success(form.id ? "Distance slab updated." : "Distance slab added.");
      }
      setModal(null);
      await loadAll();
    } catch (err) {
      const message = errorMessage(err, "The request could not be saved.");
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = async (kind, item) => {
    try {
      if (kind === "vehicle") await DeliveryService.toggleVehicleStatus(item.id, !item.active);
      if (kind === "area") await DeliveryService.toggleServiceAreaStatus(item.id, !item.active);
      if (kind === "profile") await DeliveryService.togglePricingProfileStatus(item.id, !item.active);
      toast.success("Status updated.");
      await loadAll();
    } catch (err) {
      toast.error(errorMessage(err, "Status could not be updated."));
    }
  };

  const deleteSlab = async (slab) => {
    if (!window.confirm(`Delete distance slab #${slab.id}?`)) return;
    try {
      await DeliveryService.deleteSlab(slab.id);
      toast.success("Distance slab deleted.");
      await loadAll();
    } catch (err) {
      toast.error(errorMessage(err, "Distance slab could not be deleted."));
    }
  };

  const runSimulation = async (event) => {
    event.preventDefault();
    setSimulating(true);
    setSimulation(null);
    setError("");
    try {
      const payload = {
        storeId: Number(form.storeId),
        addressId: Number(form.addressId),
        hasHeavyVehicleAccess: Boolean(form.hasHeavyVehicleAccess),
        requiresCraneUnloading: Boolean(form.requiresCraneUnloading),
        items: (form.items || [{ productId: 1, productTitle: "", quantity: 1, productWeightKg: 0, packedDimensionsVerified: false }]).map((item) => ({
          ...item,
          productId: Number(item.productId),
          quantity: Number(item.quantity),
          productWeightKg: Number(item.productWeightKg),
        })),
      };
      const result = await DeliveryService.simulateDeliveryPricing(payload);
      setSimulation(result);
    } catch (err) {
      const message = errorMessage(err, "Pricing simulation failed.");
      setError(message);
      toast.error(message);
    } finally {
      setSimulating(false);
    }
  };

  const filteredAreas = areas.filter((area) => {
    const matchesSearch = !search.trim() || [area.code, area.name, area.city, area.state].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchesActive = activeFilter === "ALL" || Boolean(area.active) === (activeFilter === "ACTIVE");
    return matchesSearch && matchesActive;
  });

  const renderStatus = (item) => (
    <span className={`delivery-status ${item.active ? "active" : "inactive"}`}>{item.active ? "Active" : "Inactive"}</span>
  );

  const renderModalFields = () => (
    <>
      {modal === "vehicle" && (
        <div className="delivery-form-grid">
          <label>Code<input required value={form.code || ""} disabled={Boolean(form.id)} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label>Name<input required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="delivery-span-2">Description<textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label>Max payload (kg)<input required type="number" step="0.001" value={form.maxPayloadKg ?? ""} onChange={(e) => setForm({ ...form, maxPayloadKg: e.target.value })} /></label>
          <label>Display order<input type="number" value={form.displayOrder ?? 1} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} /></label>
          <label>Length (mm)<input type="number" value={form.maxLengthMm ?? ""} onChange={(e) => setForm({ ...form, maxLengthMm: e.target.value })} /></label>
          <label>Width (mm)<input type="number" value={form.maxWidthMm ?? ""} onChange={(e) => setForm({ ...form, maxWidthMm: e.target.value })} /></label>
          <label>Height (mm)<input type="number" value={form.maxHeightMm ?? ""} onChange={(e) => setForm({ ...form, maxHeightMm: e.target.value })} /></label>
          <label>Max volume (cbm)<input type="number" step="0.0001" value={form.maxVolumeCbm ?? ""} onChange={(e) => setForm({ ...form, maxVolumeCbm: e.target.value })} /></label>
          <label className="delivery-check"><input type="checkbox" checked={Boolean(form.requiresHeavyVehicleAccess)} onChange={(e) => setForm({ ...form, requiresHeavyVehicleAccess: e.target.checked })} /> Requires heavy vehicle access</label>
          <label className="delivery-check"><input type="checkbox" checked={Boolean(form.active)} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
        </div>
      )}
      {modal === "area" && (
        <div className="delivery-form-grid">
          <label>Code<input required value={form.code || ""} disabled={Boolean(form.id)} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label>Name<input required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>State<input value={form.state || ""} onChange={(e) => setForm({ ...form, state: e.target.value })} /></label>
          <label>City<input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
          <label className="delivery-span-2">Description<textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="delivery-span-2">Pincodes <small>Comma separated</small><input value={(form.pincodes || []).join(",")} onChange={(e) => setForm({ ...form, pincodes: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })} /></label>
          <label className="delivery-check"><input type="checkbox" checked={Boolean(form.active)} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
        </div>
      )}
      {modal === "profile" && (
        <div className="delivery-form-grid">
          <label>Service area<select required value={form.serviceAreaId || ""} onChange={(e) => setForm({ ...form, serviceAreaId: e.target.value })}><option value="">Select area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
          <label>Name<input required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="delivery-span-2">Description<textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label>Effective from<input type="datetime-local" value={form.effectiveFrom?.slice(0, 16) || ""} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} /></label>
          <label>Effective to<input type="datetime-local" value={form.effectiveTo?.slice(0, 16) || ""} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} /></label>
          <label className="delivery-check"><input type="checkbox" checked={Boolean(form.active)} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
        </div>
      )}
      {modal === "slab" && (
        <div className="delivery-form-grid">
          <label>Pricing profile<select required value={form.profileId || ""} disabled={Boolean(form.id)} onChange={(e) => setForm({ ...form, profileId: e.target.value })}><option value="">Select profile</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
          <label>Vehicle category<select required value={form.vehicleCategoryId || ""} onChange={(e) => setForm({ ...form, vehicleCategoryId: e.target.value })}><option value="">Select vehicle</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></label>
          <label>From distance (km)<input required type="number" step="0.01" value={form.fromDistanceKm ?? ""} onChange={(e) => setForm({ ...form, fromDistanceKm: e.target.value })} /></label>
          <label>To distance (km)<input type="number" step="0.01" value={form.toDistanceKm ?? ""} placeholder="Blank = unlimited" onChange={(e) => setForm({ ...form, toDistanceKm: e.target.value })} /></label>
          <label>Pricing type<select value={form.pricingType || "FIXED"} onChange={(e) => setForm({ ...form, pricingType: e.target.value })}><option value="FIXED">FIXED</option><option value="PER_KM">PER_KM</option></select></label>
          <label>Rate amount (₹)<input required type="number" step="0.01" value={form.rateAmount ?? ""} onChange={(e) => setForm({ ...form, rateAmount: e.target.value })} /></label>
          <label>Minimum charge (₹)<input type="number" step="0.01" value={form.minimumCharge ?? ""} onChange={(e) => setForm({ ...form, minimumCharge: e.target.value })} /></label>
          <label>Additional flat charge (₹)<input type="number" step="0.01" value={form.additionalFlatCharge ?? "0"} onChange={(e) => setForm({ ...form, additionalFlatCharge: e.target.value })} /></label>
          <label className="delivery-check"><input type="checkbox" checked={Boolean(form.active)} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
        </div>
      )}
    </>
  );

  const distanceSlabs = profiles.flatMap((profile) =>
    (profile.distanceRates || profile.slabs || []).map((slab) => ({
      ...slab,
      profileName: profile.name,
      profileId: profile.id,
    }))
  );

  return (
    <div className="delivery-page page-container">
      <div className="delivery-heading">
        <div>
          <h1>Delivery Pricing</h1>
          <p>V41 store-based delivery configuration and pricing tools</p>
        </div>
        <button className="delivery-primary" onClick={loadAll} disabled={loading}>
          <RefreshCw size={15} className={loading ? "delivery-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && <div className="delivery-error"><span>{error}</span><button onClick={() => setError("")}><X size={15} /></button></div>}
      {!deliveryBackendAvailable && (
        <div className="delivery-error">
          <span>
            Delivery Pricing APIs are unavailable (HTTP 404). Confirm that the V41 backend routes are deployed before creating production configuration.
          </span>
        </div>
      )}

      <div className="delivery-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="delivery-overview">
          <div className="delivery-stat"><span>Service areas</span><strong>{areas.length}</strong></div>
          <div className="delivery-stat"><span>Active vehicles</span><strong>{vehicles.filter((v) => v.active).length}</strong></div>
          <div className="delivery-stat"><span>Pricing profiles</span><strong>{profiles.length}</strong></div>
          <div className="delivery-stat"><span>Distance slabs</span><strong>{distanceSlabs.length}</strong></div>
          <div className="delivery-overview-card">
            <h3>Configuration flow</h3>
            <ol>
              <li>Create one or more service areas.</li>
              <li>Configure vehicle category capacity and access requirements.</li>
              <li>Create a pricing profile for a service area.</li>
              <li>Add distance slabs and validate their coverage in the backend.</li>
              <li>Use the simulator to inspect the backend result.</li>
            </ol>
          </div>
        </div>
      )}

      {tab === "areas" && (
        <section className="delivery-panel">
          <div className="delivery-toolbar">
            <div className="delivery-search"><Search size={14} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search area, state or city" /></div>
            <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
            <button className="delivery-primary" onClick={() => openCreate("area")}><Plus size={15} /> New area</button>
          </div>
          <div className="delivery-table-scroll">
            <table className="delivery-table">
              <thead><tr><th>Code</th><th>Name</th><th>Location</th><th>Pincodes</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="6" className="delivery-empty">Loading...</td></tr> : filteredAreas.map((area) => (
                  <tr key={area.id}>
                    <td><strong>{area.code}</strong></td><td>{area.name}</td><td>{area.city || "\u2014"}, {area.state || "\u2014"}</td>
                    <td>{area.pincodes?.length || 0}</td><td>{renderStatus(area)}</td>
                    <td><div className="delivery-actions"><button title="Edit" onClick={() => openEdit("area", area)}><Edit2 size={14} /></button><button title="Toggle status" onClick={() => toggle("area", area)}>{area.active ? "Deactivate" : "Activate"}</button></div></td>
                  </tr>
                ))}
                {!loading && filteredAreas.length === 0 && <tr><td colSpan="6" className="delivery-empty">No service areas found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "vehicles" && (
        <section className="delivery-panel">
          <div className="delivery-toolbar"><span className="delivery-toolbar-title">Vehicle eligibility and capacity</span><button className="delivery-primary" onClick={() => openCreate("vehicle")}><Plus size={15} /> New vehicle</button></div>
          <div className="delivery-table-scroll">
            <table className="delivery-table">
              <thead><tr><th>Code</th><th>Name</th><th>Payload</th><th>Dimensions</th><th>Volume</th><th>Heavy access</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="8" className="delivery-empty">Loading...</td></tr> : vehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td><strong>{vehicle.code}</strong></td><td>{vehicle.name}</td><td>{vehicle.maxPayloadKg ?? "\u2014"} kg</td>
                    <td>{vehicle.maxLengthMm || "\u2014"} x {vehicle.maxWidthMm || "\u2014"} x {vehicle.maxHeightMm || "\u2014"} mm</td>
                    <td>{vehicle.maxVolumeCbm ?? "\u2014"} cbm</td><td>{vehicle.requiresHeavyVehicleAccess ? "Required" : "No"}</td><td>{renderStatus(vehicle)}</td>
                    <td><div className="delivery-actions"><button title="Edit" onClick={() => openEdit("vehicle", vehicle)}><Edit2 size={14} /></button><button title="Toggle status" onClick={() => toggle("vehicle", vehicle)}>{vehicle.active ? "Deactivate" : "Activate"}</button></div></td>
                  </tr>
                ))}
                {!loading && vehicles.length === 0 && <tr><td colSpan="8" className="delivery-empty">No vehicle categories found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "profiles" && (
        <section className="delivery-panel">
          <div className="delivery-toolbar"><span className="delivery-toolbar-title">Service area pricing profiles</span><button className="delivery-primary" onClick={() => openCreate("profile")}><Plus size={15} /> New profile</button></div>
          <div className="delivery-table-scroll">
            <table className="delivery-table">
              <thead><tr><th>Name</th><th>Service area</th><th>Effective from</th><th>Effective to</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="6" className="delivery-empty">Loading...</td></tr> : profiles.map((profile) => (
                  <tr key={profile.id}>
                    <td><strong>{profile.name}</strong></td><td>{profile.serviceAreaName || profile.serviceAreaId}</td>
                    <td>{formatDateTime(profile.effectiveFrom)}</td><td>{formatDateTime(profile.effectiveTo)}</td><td>{renderStatus(profile)}</td>
                    <td><div className="delivery-actions"><button title="Edit" onClick={() => openEdit("profile", profile)}><Edit2 size={14} /></button><button title="Toggle status" onClick={() => toggle("profile", profile)}>{profile.active ? "Deactivate" : "Activate"}</button></div></td>
                  </tr>
                ))}
                {!loading && profiles.length === 0 && <tr><td colSpan="6" className="delivery-empty">No pricing profiles found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "slabs" && (
        <section className="delivery-panel">
          <div className="delivery-toolbar"><span className="delivery-toolbar-title">Backend-managed distance slabs</span><button className="delivery-primary" onClick={() => openCreate("slab")}><Plus size={15} /> New slab</button></div>
          <div className="delivery-table-scroll">
            <table className="delivery-table">
              <thead><tr><th>Profile</th><th>Vehicle</th><th>Range</th><th>Pricing</th><th>Rate</th><th>Minimum</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {distanceSlabs.map((slab) => (
                  <tr key={slab.id}>
                    <td><strong>{slab.profileName}</strong></td><td>{slab.vehicleCategoryName || slab.vehicleCategoryId}</td>
                    <td>{formatKm(slab.fromDistanceKm)} - {slab.toDistanceKm == null ? "Unlimited" : `${formatKm(slab.toDistanceKm)} km`}</td>
                    <td>{slab.pricingType}</td><td>{formatInr(slab.rateAmount)}</td><td>{formatInr(slab.minimumCharge)}</td><td>{renderStatus(slab)}</td>
                    <td><div className="delivery-actions"><button title="Edit" onClick={() => openEdit("slab", slab)}><Edit2 size={14} /></button><button title="Delete" className="danger" onClick={() => deleteSlab(slab)}><Trash2 size={14} /></button></div></td>
                  </tr>
                ))}
                {distanceSlabs.length === 0 && <tr><td colSpan="8" className="delivery-empty">No distance slabs returned. Select an individual profile or add a new slab.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "simulator" && (
        <section className="delivery-panel delivery-simulator">
          <form onSubmit={runSimulation}>
            <div className="delivery-form-grid">
              <label>Store ID<input required type="number" value={form.storeId || ""} onChange={(e) => setForm({ ...form, storeId: e.target.value })} /></label>
              <label>Destination address ID<input required type="number" value={form.addressId || ""} onChange={(e) => setForm({ ...form, addressId: e.target.value })} /></label>
              <label className="delivery-check"><input type="checkbox" checked={Boolean(form.hasHeavyVehicleAccess)} onChange={(e) => setForm({ ...form, hasHeavyVehicleAccess: e.target.checked })} /> Destination has heavy vehicle access</label>
              <label className="delivery-check"><input type="checkbox" checked={Boolean(form.requiresCraneUnloading)} onChange={(e) => setForm({ ...form, requiresCraneUnloading: e.target.checked })} /> Crane unloading required</label>
            </div>
            <h3>Simulation item</h3>
            <div className="delivery-form-grid">
              <label>Product ID<input required type="number" value={form.items?.[0]?.productId || ""} onChange={(e) => setForm({ ...form, items: [{ ...(form.items?.[0] || {}), productId: e.target.value }] })} /></label>
              <label>Product title<input value={form.items?.[0]?.productTitle || ""} onChange={(e) => setForm({ ...form, items: [{ ...(form.items?.[0] || {}), productTitle: e.target.value }] })} /></label>
              <label>Quantity<input required type="number" value={form.items?.[0]?.quantity || 1} onChange={(e) => setForm({ ...form, items: [{ ...(form.items?.[0] || {}), quantity: e.target.value }] })} /></label>
              <label>Weight (kg)<input required type="number" step="0.001" value={form.items?.[0]?.productWeightKg || ""} onChange={(e) => setForm({ ...form, items: [{ ...(form.items?.[0] || {}), productWeightKg: e.target.value }] })} /></label>
            </div>
            <button className="delivery-primary" type="submit" disabled={simulating}>{simulating ? <Loader2 size={15} className="delivery-spin" /> : <Calculator size={15} />} Run backend simulation</button>
          </form>
          {simulation && (
            <div className="delivery-result">
              <h3>Backend result</h3>
              {Object.entries(simulation).filter(([key]) => key !== "snapshotJson").map(([key, value]) => (
                <div key={key}><span>{key.replace(/([A-Z])/g, " $1")}</span><strong>{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "\u2014")}</strong></div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "audit" && (
        <section className="delivery-panel">
          <div className="delivery-toolbar"><span className="delivery-toolbar-title">Delivery pricing audit history</span><button className="delivery-primary" onClick={loadAudit}><RefreshCw size={15} /> Refresh</button></div>
          <div className="delivery-table-scroll">
            <table className="delivery-table">
              <thead><tr><th>ID</th><th>Entity</th><th>Action</th><th>Admin</th><th>Created</th><th>Values</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="6" className="delivery-empty">Loading...</td></tr> : audit.map((log) => (
                  <tr key={log.id}><td>{log.id}</td><td>{log.entityType} #{log.entityId}</td><td>{log.action}</td><td>{log.adminEmail || "\u2014"}</td><td>{formatDateTime(log.createdAt)}</td><td><pre>{JSON.stringify({ oldValues: log.oldValues, newValues: log.newValues }, null, 2)}</pre></td></tr>
                ))}
                {!loading && audit.length === 0 && <tr><td colSpan="6" className="delivery-empty">No audit records found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modal && (
        <div className="delivery-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeModal()}>
          <form className="delivery-modal" onSubmit={save}>
            <header><div><h2>{form.id ? "Edit" : "Create"} {modal === "slab" ? "distance slab" : modal}</h2><p>Changes are validated and persisted by the backend.</p></div><button type="button" onClick={closeModal}><X size={17} /></button></header>
            <div className="delivery-modal-body">{renderModalFields()}</div>
            <footer><button type="button" onClick={closeModal} disabled={submitting}>Cancel</button><button className="delivery-primary" type="submit" disabled={submitting}>{submitting && <Loader2 size={15} className="delivery-spin" />} Save</button></footer>
          </form>
        </div>
      )}
    </div>
  );
}
