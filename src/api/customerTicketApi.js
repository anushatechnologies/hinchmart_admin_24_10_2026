import api from "./axios";

const STORAGE_KEY_CUSTOMER_TICKETS = "hinchmart_customer_tickets_cache_v2";

/**
 * Local cache helpers for customer tickets
 */
export const getStoredCustomerTickets = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOMER_TICKETS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveStoredCustomerTickets = (tickets) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOMER_TICKETS, JSON.stringify(tickets));
  } catch {}
};

/**
 * Normalizes a customer ticket message object
 */
export const normalizeCustomerTicketMessage = (msg = {}, fallbackTicketId = null) => {
  const role = (msg.senderRole || msg.sender_role || "CUSTOMER").toUpperCase();
  return {
    messageId: msg.messageId ?? msg.id ?? Date.now(),
    ticketId: msg.ticketId ?? fallbackTicketId,
    senderId: msg.senderId ?? msg.sender_id ?? null,
    senderRole: role,
    senderName:
      msg.senderName ||
      msg.sender_name ||
      (role === "SUPPORT_AGENT" || role === "ADMIN"
        ? "HinchMart Support"
        : "Customer"),
    content: msg.content || msg.message || "",
    attachmentUrl: msg.attachmentUrl || msg.attachment_url || null,
    timestamp: msg.timestamp || msg.createdAt || msg.created_at || new Date().toISOString(),
  };
};

/**
 * Normalizes a customer support ticket
 */
export const normalizeCustomerTicket = (ticket = {}) => {
  const id = ticket.ticketId ?? ticket.id;
  const messagesRaw = Array.isArray(ticket.messages)
    ? ticket.messages
    : Array.isArray(ticket.thread)
    ? ticket.thread
    : [];

  return {
    ticketId: id,
    id,
    ticketNumber:
      ticket.ticketNumber ||
      ticket.ticket_number ||
      (id ? `CTKT-${id}` : "CTKT-—"),
    customerId: (() => {
      const cId = ticket.customerId ?? ticket.customer_id ?? ticket.userId ?? ticket.user_id ?? null;
      return cId;
    })(),
    customerName: (() => {
      const cId = ticket.customerId ?? ticket.customer_id ?? ticket.userId ?? ticket.user_id ?? null;
      const oId = ticket.orderId ?? ticket.order_id ?? null;
      let cached = null;
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("hinchmart_cached_customers") || localStorage.getItem("hinchmart_buyers");
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              cached = list.find((b) => (cId && String(b.id || b.userId || b.customerId) === String(cId)));
            }
          }
          if (!cached && oId) {
            const rawO = localStorage.getItem("hinchmart_orders");
            if (rawO) {
              const orders = JSON.parse(rawO);
              const matchedOrder = orders.find((o) => String(o.id || o.orderId) === String(oId));
              if (matchedOrder) {
                return matchedOrder.customerName || matchedOrder.buyer?.name || (cId ? `Customer #${cId}` : "Customer");
              }
            }
          }
        } catch {}
      }
      return (
        ticket.customerName ||
        ticket.customer_name ||
        ticket.userName ||
        ticket.user_name ||
        ticket.user?.fullName ||
        ticket.user?.name ||
        ticket.customer?.fullName ||
        ticket.customer?.name ||
        ticket.buyer?.fullName ||
        ticket.buyer?.name ||
        cached?.fullName ||
        cached?.name ||
        (cId ? `Customer #${cId}` : "Customer")
      );
    })(),
    customerEmail: (() => {
      const cId = ticket.customerId ?? ticket.customer_id ?? ticket.userId ?? ticket.user_id ?? null;
      const oId = ticket.orderId ?? ticket.order_id ?? null;
      let cached = null;
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("hinchmart_cached_customers") || localStorage.getItem("hinchmart_buyers");
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              cached = list.find((b) => (cId && String(b.id || b.userId || b.customerId) === String(cId)));
            }
          }
          if ((!cached || !cached.email) && oId) {
            const rawO = localStorage.getItem("hinchmart_orders");
            if (rawO) {
              const orders = JSON.parse(rawO);
              const matchedOrder = orders.find((o) => String(o.id || o.orderId) === String(oId));
              if (matchedOrder && (matchedOrder.customerEmail || matchedOrder.buyer?.email)) {
                return matchedOrder.customerEmail || matchedOrder.buyer?.email;
              }
            }
          }
        } catch {}
      }
      return (
        ticket.customerEmail ||
        ticket.customer_email ||
        ticket.userEmail ||
        ticket.user?.email ||
        ticket.customer?.email ||
        ticket.buyer?.email ||
        cached?.email ||
        ticket.email ||
        ""
      );
    })(),
    customerPhone: (() => {
      const cId = ticket.customerId ?? ticket.customer_id ?? ticket.userId ?? ticket.user_id ?? null;
      const oId = ticket.orderId ?? ticket.order_id ?? null;
      let cached = null;
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("hinchmart_cached_customers") || localStorage.getItem("hinchmart_buyers");
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              cached = list.find((b) => (cId && String(b.id || b.userId || b.customerId) === String(cId)));
            }
          }
          if ((!cached || (!cached.phone && !cached.mobile)) && oId) {
            const rawO = localStorage.getItem("hinchmart_orders");
            if (rawO) {
              const orders = JSON.parse(rawO);
              const matchedOrder = orders.find((o) => String(o.id || o.orderId) === String(oId));
              if (matchedOrder && (matchedOrder.customerPhone || matchedOrder.recipientPhone || matchedOrder.buyer?.phone)) {
                return matchedOrder.customerPhone || matchedOrder.recipientPhone || matchedOrder.buyer?.phone;
              }
            }
          }
        } catch {}
      }
      return (
        ticket.customerPhone ||
        ticket.customer_phone ||
        ticket.userPhone ||
        ticket.user?.phone ||
        ticket.customer?.phone ||
        ticket.buyer?.phone ||
        cached?.phone ||
        cached?.mobile ||
        ticket.phone ||
        ""
      );
    })(),
    subject: ticket.subject || "Customer Support Request",
    category: (ticket.category || ticket.issueType || "GENERAL").toUpperCase(),
    priority: (ticket.priority || "MEDIUM").toUpperCase(),
    status: (ticket.status || "OPEN").toUpperCase(),
    orderId: ticket.orderId ?? ticket.order_id ?? null,
    productId: ticket.productId ?? ticket.product_id ?? null,
    productTitle: ticket.productTitle || ticket.product_title || ticket.productName || "",
    userType: "CUSTOMER",
    createdAt: (() => {
      const raw = ticket.createdAt || ticket.created_at;
      if (raw) return raw;
      const num = String(id).replace(/\D/g, "");
      return num.length >= 12 && Number(num) > 1600000000000
        ? new Date(Number(num)).toISOString()
        : new Date().toISOString();
    })(),
    updatedAt: (() => {
      const raw = ticket.updatedAt || ticket.updated_at || ticket.createdAt || ticket.created_at;
      if (raw) return raw;
      const num = String(id).replace(/\D/g, "");
      return num.length >= 12 && Number(num) > 1600000000000
        ? new Date(Number(num)).toISOString()
        : new Date().toISOString();
    })(),
    messages: messagesRaw.map((m) => normalizeCustomerTicketMessage(m, id)),
  };
};

const extractDataList = (resData) => {
  if (!resData) return [];
  if (Array.isArray(resData)) return resData;
  if (Array.isArray(resData.data)) return resData.data;
  if (Array.isArray(resData.tickets)) return resData.tickets;
  if (Array.isArray(resData.content)) return resData.content;
  if (Array.isArray(resData.data?.content)) return resData.data.content;
  if (Array.isArray(resData.data?.tickets)) return resData.data.tickets;
  return [];
};

const extractPagination = (resData, fallbackLength = 0, defaultPage = 1, defaultLimit = 20) => {
  const p = resData?.pagination || resData?.data?.pagination || {};
  return {
    page: Number(p.page ?? p.currentPage ?? defaultPage),
    limit: Number(p.limit ?? p.pageSize ?? defaultLimit),
    total: Number(p.total ?? p.totalElements ?? fallbackLength),
    totalPages: Number(p.totalPages ?? Math.max(1, Math.ceil(fallbackLength / defaultLimit))),
  };
};

/**
 * 1. List All Customer Support Tickets (Admin)
 */
export const getAdminCustomerTickets = async (params = {}) => {
  const cleanParams = {};
  if (params.customerId) cleanParams.customerId = params.customerId;
  if (params.status && params.status !== "ALL") cleanParams.status = params.status;
  if (params.category && params.category !== "ALL") cleanParams.category = params.category;
  if (params.page !== undefined) cleanParams.page = params.page;
  if (params.limit !== undefined) {
    cleanParams.limit = params.limit;
    cleanParams.size = params.limit;
  }

  const candidateEndpoints = [
    { ep: "/admin/support/tickets", params: cleanParams },
    { ep: "/admin/help/tickets", params: cleanParams },
    { ep: "/help/tickets", params: cleanParams },
    { ep: "/admin/customer/tickets", params: cleanParams },
    { ep: "/admin/customer-tickets", params: cleanParams },
    { ep: "/admin/customer/help/tickets", params: cleanParams },
    { ep: "/customer/help/tickets", params: cleanParams },
    { ep: "/customer/tickets", params: cleanParams },
    { ep: "/customer-tickets", params: cleanParams },
    { ep: "/admin/support/customer/tickets", params: cleanParams },
    { ep: "/admin/support/customer-tickets", params: cleanParams },
    { ep: "/admin/tickets", params: { ...cleanParams, targetType: "CUSTOMER" } },
    { ep: "/admin/tickets", params: { ...cleanParams, userType: "CUSTOMER" } },
    { ep: "/support/tickets", params: { ...cleanParams, userType: "CUSTOMER" } },
    { ep: "/tickets", params: { ...cleanParams, userType: "CUSTOMER" } },
  ];

  for (const { ep, params: epParams } of candidateEndpoints) {
    try {
      const response = await api.get(ep, { params: epParams });
      const rawList = extractDataList(response.data);
      // Filter out any seller-specific tickets if returned from unified endpoint
      const filteredRaw = rawList.filter((item) => {
        const uType = (item.userType || item.targetType || "").toUpperCase();
        return uType !== "SELLER";
      });

      const normalized = filteredRaw.map(normalizeCustomerTicket);
      const pagination = extractPagination(
        response.data,
        normalized.length,
        cleanParams.page || 1,
        cleanParams.limit || 20
      );

      // Save to cache
      saveStoredCustomerTickets(normalized);

      return {
        data: normalized,
        pagination,
        raw: response.data,
      };
    } catch (err) {
      if (err?.response?.status === 401) break;
      continue;
    }
  }

  // Fallback to local cache
  const stored = getStoredCustomerTickets().map(normalizeCustomerTicket);
  let filtered = stored;
  if (cleanParams.customerId) {
    filtered = filtered.filter((t) => String(t.customerId) === String(cleanParams.customerId));
  }
  if (cleanParams.status && cleanParams.status !== "ALL") {
    filtered = filtered.filter((t) => t.status === cleanParams.status);
  }
  if (cleanParams.category && cleanParams.category !== "ALL") {
    filtered = filtered.filter((t) => t.category === cleanParams.category);
  }

  const pPage = Number(cleanParams.page || 1);
  const pLimit = Number(cleanParams.limit || 20);
  const start = (pPage - 1) * pLimit;
  const pageSlice = filtered.slice(start, start + pLimit);

  return {
    data: pageSlice,
    pagination: {
      page: pPage,
      limit: pLimit,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pLimit)),
    },
    raw: null,
  };
};

/**
 * 2. Get Customer Ticket Details By ID
 */
export const getAdminCustomerTicketById = async (id) => {
  const candidateEndpoints = [
    `/admin/support/tickets/${id}`,
    `/admin/help/tickets/${id}`,
    `/help/tickets/${id}`,
    `/admin/customer/tickets/${id}`,
    `/admin/customer-tickets/${id}`,
    `/admin/customer/help/tickets/${id}`,
    `/customer/help/tickets/${id}`,
    `/customer/tickets/${id}`,
    `/customer-tickets/${id}`,
    `/admin/support/customer/tickets/${id}`,
    `/admin/support/customer-tickets/${id}`,
    `/admin/tickets/${id}`,
    `/support/tickets/${id}`,
    `/tickets/${id}`,
  ];

  for (const ep of candidateEndpoints) {
    try {
      const response = await api.get(ep);
      const rawTicket = response.data?.data || response.data?.ticket || response.data;
      if (rawTicket) {
        const normalized = normalizeCustomerTicket(rawTicket);
        const stored = getStoredCustomerTickets();
        const updated = [
          normalized,
          ...stored.filter((t) => String(t.ticketId || t.id) !== String(id)),
        ];
        saveStoredCustomerTickets(updated);
        return normalized;
      }
    } catch (err) {
      if (err?.response?.status === 401) break;
      continue;
    }
  }

  // Check local cache
  const stored = getStoredCustomerTickets();
  const found = stored.find((t) => String(t.ticketId || t.id) === String(id));
  if (found) return normalizeCustomerTicket(found);

  // Return null if not found
  return null;
};

/**
 * 3. Admin Reply to Customer Ticket
 */
export const replyToCustomerTicket = async (id, { content, attachmentUrl = null }) => {
  if (!content || !content.trim()) {
    throw new Error("Message content is required to send a reply");
  }

  const trimmed = content.trim();
  const payload = {
    content: trimmed,
    message: trimmed,
    attachmentUrl: attachmentUrl || null,
    attachment_url: attachmentUrl || null,
    senderRole: "ADMIN",
    senderType: "ADMIN",
    senderName: "HinchMart Support Desk",
    sender_role: "ADMIN",
    sender_type: "ADMIN",
  };

  const candidateEndpoints = [
    `/admin/support/tickets/${id}/messages`,
    `/help/tickets/${id}/messages`,
    `/admin/help/tickets/${id}/messages`,
    `/admin/customer/tickets/${id}/messages`,
    `/admin/customer-tickets/${id}/messages`,
    `/admin/customer/help/tickets/${id}/messages`,
    `/customer/help/tickets/${id}/messages`,
    `/customer/tickets/${id}/messages`,
    `/customer-tickets/${id}/messages`,
    `/admin/customer/tickets/${id}/reply`,
    `/admin/customer-tickets/${id}/reply`,
    `/admin/tickets/${id}/messages`,
    `/support/tickets/${id}/messages`,
    `/tickets/${id}/messages`,
  ];

  let rawMessage = null;

  for (const ep of candidateEndpoints) {
    try {
      const response = await api.post(ep, payload);
      rawMessage = response.data?.data || response.data?.message || response.data;
      if (rawMessage) break;
    } catch (err) {
      if (err?.response?.status === 401) break;
      continue;
    }
  }

  const normalizedMessage = normalizeCustomerTicketMessage(
    rawMessage || {
      messageId: Date.now(),
      ticketId: id,
      senderId: 1,
      senderRole: "SUPPORT_AGENT",
      senderName: "HinchMart Support",
      content: payload.content,
      attachmentUrl: payload.attachmentUrl,
      timestamp: new Date().toISOString(),
    },
    id
  );

  // Update stored cache
  const stored = getStoredCustomerTickets();
  const ticket = stored.find((t) => String(t.ticketId || t.id) === String(id));
  if (ticket) {
    ticket.messages = [...(ticket.messages || []), normalizedMessage];
    ticket.updatedAt = new Date().toISOString();
    saveStoredCustomerTickets(stored);
  }

  return normalizedMessage;
};

/**
 * 4. Update Customer Ticket Status & Priority
 */
export const updateCustomerTicketStatus = async (id, { status, priority = null }) => {
  if (!status) {
    throw new Error("Ticket status is required");
  }

  const payload = {
    status: status.toUpperCase(),
  };
  if (priority) {
    payload.priority = priority.toUpperCase();
  }

  const candidateAttempts = [
    { method: "put", ep: `/admin/support/tickets/${id}/status` },
    { method: "patch", ep: `/admin/help/tickets/${id}/status` },
    { method: "patch", ep: `/help/tickets/${id}/status` },
    { method: "put", ep: `/help/tickets/${id}` },
    { method: "patch", ep: `/admin/customer/tickets/${id}/status` },
    { method: "put", ep: `/admin/customer/tickets/${id}/status` },
    { method: "patch", ep: `/admin/customer/help/tickets/${id}/status` },
    { method: "patch", ep: `/customer/help/tickets/${id}/status` },
    { method: "patch", ep: `/admin/tickets/${id}/status` },
    { method: "put", ep: `/admin/tickets/${id}/status` },
  ];

  let updatedTicket = null;

  for (const attempt of candidateAttempts) {
    try {
      const response = await api[attempt.method](attempt.ep, payload);
      const rawTicket = response.data?.data || response.data?.ticket || response.data;
      if (rawTicket) {
        updatedTicket = normalizeCustomerTicket(rawTicket);
        break;
      }
    } catch {
      continue;
    }
  }

  // Update stored cache
  const stored = getStoredCustomerTickets();
  const ticket = stored.find((t) => String(t.ticketId || t.id) === String(id));
  if (ticket) {
    ticket.status = payload.status;
    if (payload.priority) ticket.priority = payload.priority;
    ticket.updatedAt = new Date().toISOString();
    saveStoredCustomerTickets(stored);
    return updatedTicket || normalizeCustomerTicket(ticket);
  }

  if (updatedTicket) {
    saveStoredCustomerTickets([updatedTicket, ...stored]);
    return updatedTicket;
  }

  return {
    ticketId: id,
    status: payload.status,
    priority: payload.priority || "MEDIUM",
  };
};

/**
 * 5. Create Customer Ticket (Admin or on behalf of customer)
 */
export const createCustomerTicket = async (ticketData) => {
  const payload = {
    subject: ticketData.subject,
    category: ticketData.category || "GENERAL",
    priority: ticketData.priority || "MEDIUM",
    message: ticketData.message,
    customerId: ticketData.customerId ? Number(ticketData.customerId) : undefined,
    customerName: ticketData.customerName || undefined,
    customerEmail: ticketData.customerEmail || undefined,
    orderId: ticketData.orderId ? Number(ticketData.orderId) : undefined,
    productId: ticketData.productId ? Number(ticketData.productId) : undefined,
  };

  const candidateEndpoints = [
    "/admin/customer/tickets",
    "/admin/customer/help/tickets",
    "/customer/help/tickets",
    "/customer/tickets",
  ];

  let raw = null;

  for (const ep of candidateEndpoints) {
    try {
      const response = await api.post(ep, payload);
      raw = response.data?.data || response.data?.ticket || response.data;
      if (raw) break;
    } catch (err) {
      if (err.response?.status === 404) continue;
      if (err.response?.status === 401) throw err;
    }
  }

  const newTicket = normalizeCustomerTicket(
    raw || {
      ticketId: Date.now(),
      ticketNumber: `CTKT-${Date.now()}`,
      customerId: payload.customerId || null,
      customerName: payload.customerName || (payload.customerId ? `Customer #${payload.customerId}` : "Customer"),
      customerEmail: payload.customerEmail || "",
      subject: payload.subject,
      category: payload.category,
      priority: payload.priority,
      status: "OPEN",
      orderId: payload.orderId || null,
      productId: payload.productId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          messageId: Date.now() + 1,
          senderRole: "CUSTOMER",
          senderName: payload.customerName || "Customer",
          content: payload.message,
          timestamp: new Date().toISOString(),
        },
      ],
    }
  );

  const stored = getStoredCustomerTickets();
  const updated = [newTicket, ...stored];
  saveStoredCustomerTickets(updated);

  return newTicket;
};
