import { useEffect, useState } from "react";
import {
  MapPin,
  Plus,
  Search,
  RotateCcw,
  Edit2,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  configureAdminPincodeService,
  createAdminPincode,
  deleteAdminPincode,
  getAdminPincodes,
  updateAdminPincode,
} from "../api/pincodeApi";
import { useToast } from "../components/ToastContext";
import "../styles/pages.css";
import "../styles/pincodes.css";

const SERVICE_TYPES = ["STANDARD", "EXPRESS", "HEAVY_BULK"];
const PAGE_LIMIT = 20;

const createEmptyService = (serviceType) => ({
  serviceType,
  serviceable: false,
  codAvailable: false,
  estimatedDeliveryDays: "2",
  minimumOrderAmount: "0",
  maximumWeightKg: "50",
});

const createEmptyForm = () => ({
  pincode: "",
  city: "",
  district: "",
  state: "",
  country: "India",
  active: true,
  services: SERVICE_TYPES.map(createEmptyService),
});

const createFormFromPincode = (pincode) => {
  const form = createEmptyForm();
  return {
    ...form,
    pincode: pincode.pincode || "",
    city: pincode.city || "",
    district: pincode.district || "",
    state: pincode.state || "",
    country: pincode.country || "India",
    active: pincode.active ?? true,
    services: SERVICE_TYPES.map((serviceType) => {
      const service = pincode.services?.find((item) => item.serviceType === serviceType);
      return service
        ? {
            serviceType,
            serviceable: service.serviceable ?? false,
            codAvailable: service.codAvailable ?? false,
            estimatedDeliveryDays: String(service.estimatedDeliveryDays ?? 2),
            minimumOrderAmount: String(service.minimumOrderAmount ?? 0),
            maximumWeightKg: String(service.maximumWeightKg ?? 50),
          }
        : createEmptyService(serviceType);
    }),
  };
};

const getListAndMeta = (payload, currentPage) => {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.pincodes)
        ? payload.pincodes
        : Array.isArray(payload?.content)
          ? payload.content
          : [];
  const meta = payload?.meta || payload?.pagination || {};
  return {
    items,
    total: Number(meta.total ?? payload?.total ?? items.length),
    totalPages: Number(meta.totalPages ?? payload?.totalPages ?? (items.length ? currentPage : 1)),
  };
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

export default function Pincodes() {
  const toast = useToast();
  const [pincodes, setPincodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingPincode, setEditingPincode] = useState(null);
  const [form, setForm] = useState(createEmptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = { page, limit: PAGE_LIMIT };
        if (search.trim()) params.search = search.trim();
        if (activeFilter !== "ALL") params.active = activeFilter === "ACTIVE";
        const payload = await getAdminPincodes(params, { signal: controller.signal });
        const result = getListAndMeta(payload, page);
        setPincodes(result.items);
        setTotal(result.total);
        setTotalPages(Math.max(1, result.totalPages));
      } catch (requestError) {
        if (requestError?.name !== "CanceledError" && !controller.signal.aborted) {
          setError(getErrorMessage(requestError, "Unable to load pincodes."));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, activeFilter, page, refreshKey]);

  const openAddModal = () => {
    setEditingPincode(null);
    setForm(createEmptyForm());
    setShowModal(true);
  };

  const openEditModal = (pincode) => {
    setEditingPincode(pincode);
    setForm(createFormFromPincode(pincode));
    setShowModal(true);
  };

  const updateFormField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateService = (serviceType, field, value) => {
    setForm((current) => ({
      ...current,
      services: current.services.map((service) =>
        service.serviceType === serviceType
          ? {
              ...service,
              [field]: value,
              ...(field === "serviceable" && !value ? { codAvailable: false } : {}),
            }
          : service
      ),
    }));
  };

  const serializeService = (service) => ({
    serviceType: service.serviceType,
    serviceable: service.serviceable,
    codAvailable: service.codAvailable,
    estimatedDeliveryDays: Number(service.estimatedDeliveryDays),
    minimumOrderAmount: Number(service.minimumOrderAmount),
    maximumWeightKg: Number(service.maximumWeightKg),
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(form.pincode)) {
      toast.error("Enter a valid 6-digit pincode.");
      return;
    }
    if (!form.city.trim() || !form.district.trim() || !form.state.trim() || !form.country.trim()) {
      toast.error("Complete the city, district, state, and country fields.");
      return;
    }
    const invalidService = form.services.find(
      (service) =>
        !Number.isFinite(Number(service.estimatedDeliveryDays)) ||
        Number(service.estimatedDeliveryDays) < 1 ||
        !Number.isFinite(Number(service.minimumOrderAmount)) ||
        Number(service.minimumOrderAmount) < 0 ||
        !Number.isFinite(Number(service.maximumWeightKg)) ||
        Number(service.maximumWeightKg) <= 0
    );
    if (invalidService) {
      toast.error(`Enter valid delivery settings for ${invalidService.serviceType}.`);
      return;
    }

    const payload = {
      pincode: form.pincode.trim(),
      city: form.city.trim(),
      district: form.district.trim(),
      state: form.state.trim(),
      country: form.country.trim(),
      active: form.active,
      services: form.services.map(serializeService),
    };

    setSubmitting(true);
    try {
      if (editingPincode) {
        const id = editingPincode.id ?? editingPincode.pincodeId;
        if (id === undefined || id === null) {
          throw new Error("The pincode record is missing its identifier.");
        }
        await updateAdminPincode(id, {
          pincode: payload.pincode,
          city: payload.city,
          district: payload.district,
          state: payload.state,
          country: payload.country,
          active: payload.active,
        });
        try {
          await Promise.all(
            payload.services.map((service) => configureAdminPincodeService(id, service))
          );
        } catch (serviceError) {
          setRefreshKey((current) => current + 1);
          throw new Error(
            `Pincode details were saved, but service availability was not fully updated: ${getErrorMessage(
              serviceError,
              "service configuration failed"
            )}`
          );
        }
        toast.success(`Pincode ${payload.pincode} updated.`);
      } else {
        await createAdminPincode(payload);
        toast.success(`Pincode ${payload.pincode} added.`);
      }
      setShowModal(false);
      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      toast.error(getErrorMessage(submitError, "Unable to save the pincode."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (pincode) => {
    const id = pincode.id ?? pincode.pincodeId;
    if (id === undefined || id === null) {
      toast.error("The pincode record is missing its identifier.");
      return;
    }
    if (!window.confirm(`Delete pincode ${pincode.pincode}? This cannot be undone.`)) return;

    setDeletingId(id);
    try {
      await deleteAdminPincode(id);
      toast.success(`Pincode ${pincode.pincode} deleted.`);
      setRefreshKey((current) => current + 1);
    } catch (deleteError) {
      toast.error(getErrorMessage(deleteError, "Unable to delete the pincode."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="pincode-page">
      <div className="page-header">
        <div>
          <h1>Pincode Serviceability</h1>
          <p>Manage delivery coverage, service availability, and COD settings.</p>
        </div>
        <button className="primary-button" onClick={openAddModal}>
          <Plus size={16} />
          <span>Add Pincode</span>
        </button>
      </div>

      <section className="pincode-panel">
        <div className="pincode-toolbar">
          <label className="pincode-search">
            <Search size={17} />
            <input
              aria-label="Search pincodes"
              placeholder="Search pincode, city, or state"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            aria-label="Filter by pincode status"
            className="pincode-status-filter"
            value={activeFilter}
            onChange={(event) => {
              setActiveFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <button
            className="pincode-refresh"
            type="button"
            onClick={() => setRefreshKey((current) => current + 1)}
            disabled={loading}
            aria-label="Refresh pincodes"
          >
            <RotateCcw size={16} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="pincode-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setRefreshKey((current) => current + 1)}>
              Retry
            </button>
          </div>
        )}

        <div className="pincode-table-scroll">
          <table className="pincode-table">
            <thead>
              <tr>
                <th>Pincode</th>
                <th>City / District</th>
                <th>State</th>
                <th>Services</th>
                <th>Availability</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="pincode-table-message">
                    <Loader2 className="pincode-spinner" size={18} />
                    Loading pincodes...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="6" className="pincode-table-message">
                    Pincode data could not be loaded.
                  </td>
                </tr>
              ) : pincodes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="pincode-table-message">
                    No pincodes found. Add one to configure delivery availability.
                  </td>
                </tr>
              ) : (
                pincodes.map((pincode) => {
                  const id = pincode.id ?? pincode.pincodeId;
                  const availableServices = (pincode.services || []).filter(
                    (service) => service.serviceable
                  );
                  const available = Boolean(pincode.active) && availableServices.length > 0;
                  return (
                    <tr key={id ?? pincode.pincode}>
                      <td>
                        <strong className="pincode-number">
                          <MapPin size={15} />
                          {pincode.pincode}
                        </strong>
                      </td>
                      <td>
                        <strong>{pincode.city || "—"}</strong>
                        <small>{pincode.district || "—"}</small>
                      </td>
                      <td>{pincode.state || "—"}</td>
                      <td>
                        {availableServices.length
                          ? availableServices.map((service) => service.serviceType).join(", ")
                          : "None"}
                      </td>
                      <td>
                        <span className={`pincode-status ${available ? "is-available" : "is-unavailable"}`}>
                          {available ? "Serviceable" : "Unavailable"}
                        </span>
                        <small>{pincode.active ? "Active" : "Inactive"}</small>
                      </td>
                      <td>
                        <div className="pincode-row-actions">
                          <button
                            type="button"
                            onClick={() => openEditModal(pincode)}
                            aria-label={`Edit pincode ${pincode.pincode}`}
                            title="Edit pincode"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            className="pincode-delete-button"
                            onClick={() => handleDelete(pincode)}
                            disabled={deletingId === id}
                            aria-label={`Delete pincode ${pincode.pincode}`}
                            title="Delete pincode"
                          >
                            {deletingId === id ? (
                              <Loader2 className="pincode-spinner" size={16} />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="pincode-pagination">
          <span>{total} pincodes</span>
          <div>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages || loading}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {showModal && (
        <div className="modal-overlay pincode-modal-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !submitting) setShowModal(false);
        }}>
          <form className="pincode-modal" onSubmit={handleSubmit}>
            <header>
              <div>
                <span className="pincode-modal-icon"><MapPin size={18} /></span>
                <div>
                  <h2>{editingPincode ? "Edit Pincode" : "Add Pincode"}</h2>
                  <p>Set location details and delivery availability.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowModal(false)} disabled={submitting} aria-label="Close">
                <X size={19} />
              </button>
            </header>

            <div className="pincode-modal-body">
              <div className="pincode-form-grid">
                <label className="form-group">
                  <span>Pincode *</span>
                  <input
                    value={form.pincode}
                    inputMode="numeric"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    required
                    onChange={(event) => updateFormField("pincode", event.target.value.replace(/\D/g, ""))}
                  />
                </label>
                <label className="form-group">
                  <span>City *</span>
                  <input value={form.city} required onChange={(event) => updateFormField("city", event.target.value)} />
                </label>
                <label className="form-group">
                  <span>District *</span>
                  <input value={form.district} required onChange={(event) => updateFormField("district", event.target.value)} />
                </label>
                <label className="form-group">
                  <span>State *</span>
                  <input value={form.state} required onChange={(event) => updateFormField("state", event.target.value)} />
                </label>
                <label className="form-group">
                  <span>Country *</span>
                  <input value={form.country} required onChange={(event) => updateFormField("country", event.target.value)} />
                </label>
              </div>

              <label className="pincode-active-toggle">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => updateFormField("active", event.target.checked)}
                />
                <span>
                  <strong>Pincode active</strong>
                  <small>Inactive pincodes are not available for delivery.</small>
                </span>
              </label>

              <div className="pincode-service-list">
                <div className="pincode-service-heading">
                  <h3>Delivery service availability</h3>
                  <span>Enable the services supported at this pincode.</span>
                </div>
                {form.services.map((service) => (
                  <section className="pincode-service-card" key={service.serviceType}>
                    <div className="pincode-service-card-heading">
                      <label>
                        <input
                          type="checkbox"
                          checked={service.serviceable}
                          onChange={(event) =>
                            updateService(service.serviceType, "serviceable", event.target.checked)
                          }
                        />
                        <strong>{service.serviceType.replace("_", " ")}</strong>
                      </label>
                      <label className="pincode-cod-toggle">
                        <input
                          type="checkbox"
                          checked={service.codAvailable}
                          disabled={!service.serviceable}
                          onChange={(event) =>
                            updateService(service.serviceType, "codAvailable", event.target.checked)
                          }
                        />
                        COD available
                      </label>
                    </div>
                    <div className="pincode-service-fields">
                      <label>
                        <span>Delivery days</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={service.estimatedDeliveryDays}
                          onChange={(event) =>
                            updateService(service.serviceType, "estimatedDeliveryDays", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        <span>Minimum order (INR)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={service.minimumOrderAmount}
                          onChange={(event) =>
                            updateService(service.serviceType, "minimumOrderAmount", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        <span>Maximum weight (kg)</span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={service.maximumWeightKg}
                          onChange={(event) =>
                            updateService(service.serviceType, "maximumWeightKg", event.target.value)
                          }
                        />
                      </label>
                    </div>
                  </section>
                ))}
              </div>
            </div>

            <footer>
              <button type="button" className="pincode-cancel-button" onClick={() => setShowModal(false)} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting && <Loader2 className="pincode-spinner" size={16} />}
                {submitting ? "Saving..." : editingPincode ? "Save Changes" : "Add Pincode"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
