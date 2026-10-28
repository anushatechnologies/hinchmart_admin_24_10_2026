import api from "./axios";

const STORAGE_KEY_SELLER_TICKETS = "hinchmart_seller_tickets_cache_v2";

/**
 * Local cache helpers for resilient offline/cold fallback
 */
export const getStoredTickets = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SELLER_TICKETS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveStoredTickets = (tickets) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_SELLER_TICKETS, JSON.stringify(tickets));
  } catch {}
};

/**
 * Normalizes a ticket message object
 */
export const normalizeTicketMessage = (msg = {}, fallbackTicketId = null) => {
  return {
    messageId: msg.messageId ?? msg.id ?? Date.now(),
    ticketId: msg.ticketId ?? fallbackTicketId,
    senderId: msg.senderId ?? msg.sender_id ?? null,
    senderRole: (msg.senderRole || msg.sender_role || "SELLER").toUpperCase(),
    senderName:
      msg.senderName ||
      msg.sender_name ||
      ((msg.senderRole || "").toUpperCase() === "SUPPORT_AGENT"
        ? "HinchMart Support"
        : "Seller"),
    content: msg.content || msg.message || "",
    attachmentUrl: msg.attachmentUrl || msg.attachment_url || null,
    timestamp: msg.timestamp || msg.createdAt || msg.created_at || new Date().toISOString(),
  };
};

/**
 * Normalizes a ticket object from backend responses
 */
export const normalizeTicket = (ticket = {}) => {
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
      (id ? `STKT-${id}` : "STKT-—"),
    sellerId: ticket.sellerId ?? ticket.seller_id ?? null,
    sellerName:
      ticket.sellerName ||
      ticket.seller_name ||
      ticket.companyName ||
      (ticket.sellerId ? `Seller #${ticket.sellerId}` : "Unspecified Seller"),
    subject: ticket.subject || "Untitled Support Ticket",
    category: (ticket.category || "GENERAL").toUpperCase(),
    priority: (ticket.priority || "MEDIUM").toUpperCase(),
    status: (ticket.status || "OPEN").toUpperCase(),
    orderId: ticket.orderId ?? ticket.order_id ?? null,
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
    messages: messagesRaw.map((m) => normalizeTicketMessage(m, id)),
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
 * 1. List All Seller Support Tickets (Admin)
 * Primary: GET /api/admin/seller/help/tickets
 * Fallback: /api/seller/help/tickets
 */
export const getAdminSellerTickets = async (params = {}) => {
  const cleanParams = {};
  if (params.sellerId) cleanParams.sellerId = params.sellerId;
  if (params.status && params.status !== "ALL") cleanParams.status = params.status;
  if (params.page !== undefined) {
    cleanParams.page = params.page;
  }
  if (params.limit !== undefined) {
    cleanParams.limit = params.limit;
    cleanParams.size = params.limit;
  }

  // Exact endpoints per the Seller Support Tickets API Specification and aliases
  const candidateEndpoints = [
    "/admin/seller-support/tickets",
    "/admin/seller/help/tickets",
    "/seller/help/tickets",
    "/admin/tickets",
    "/support/tickets",
    "/tickets",
  ];

  for (const ep of candidateEndpoints) {
    try {
      const response = await api.get(ep, { params: cleanParams });
      const rawList = extractDataList(response.data);
      const normalized = rawList.map(normalizeTicket);
      const pagination = extractPagination(
        response.data,
        normalized.length,
        cleanParams.page || 1,
        cleanParams.limit || 20
      );

      // Save to local cache
      saveStoredTickets(normalized);

      return {
        data: normalized,
        pagination,
        raw: response.data,
      };
    } catch (err) {
      if (err?.response?.status === 401) {
        break; // Stop immediately on auth failure
      }
      console.warn(`[Seller Tickets API] Notice on ${ep}:`, err?.response?.status || err?.message);
      continue;
    }
  }

  // Graceful fallback to local tickets cache if endpoints are not yet deployed
  const stored = getStoredTickets().map(normalizeTicket);
  let filtered = stored;
  if (cleanParams.sellerId) {
    filtered = filtered.filter((t) => String(t.sellerId) === String(cleanParams.sellerId));
  }
  if (cleanParams.status && cleanParams.status !== "ALL") {
    filtered = filtered.filter((t) => t.status === cleanParams.status);
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
 * 2. View Seller Ticket Details (Admin)
 * Primary: GET /api/admin/seller/help/tickets/{id}
 */
export const getAdminSellerTicketById = async (id) => {
  const candidateEndpoints = [
    `/admin/seller-support/tickets/${id}`,
    `/admin/seller/help/tickets/${id}`,
    `/seller/help/tickets/${id}`,
    `/admin/tickets/${id}`,
    `/support/tickets/${id}`,
    `/tickets/${id}`,
  ];

  for (const ep of candidateEndpoints) {
    try {
      const response = await api.get(ep);
      const rawTicket = response.data?.data || response.data?.ticket || response.data;
      if (rawTicket) {
        const normalized = normalizeTicket(rawTicket);
        // Update stored cache
        const stored = getStoredTickets();
        const updated = [
          normalized,
          ...stored.filter((t) => String(t.ticketId || t.id) !== String(id)),
        ];
        saveStoredTickets(updated);
        return normalized;
      }
    } catch (err) {
      if (err?.response?.status === 401) break;
      console.warn(`[Seller Tickets API] Notice on ${ep}:`, err?.response?.status || err?.message);
      continue;
    }
  }

  // Fallback to local cache so admin can still view and review ticket details
  const stored = getStoredTickets();
  const found = stored.find((t) => String(t.ticketId || t.id) === String(id));
  if (found) return normalizeTicket(found);

  // If not found in API and not in cache, return null
  return null;
};

/**
 * 3. Admin Reply to Seller Ticket
 * Primary: POST /api/admin/seller/help/tickets/{id}/messages
 */
export const replyToSellerTicket = async (id, { content, attachmentUrl = null }) => {
  if (!content || !content.trim()) {
    throw new Error("Message content is required to send a reply");
  }

  const trimmed = content.trim();
  const payload = {
    content: trimmed,
    message: trimmed,
    attachmentUrl: attachmentUrl || null,
    attachment_url: attachmentUrl || null,
    senderRole: "SUPPORT_AGENT",
    sender_role: "SUPPORT_AGENT",
  };

  const candidateEndpoints = [
    `/admin/seller-support/tickets/${id}/messages`,
    `/admin/seller/help/tickets/${id}/messages`,
    `/admin/seller-tickets/${id}/messages`,
    `/admin/seller/tickets/${id}/messages`,
    `/seller/help/tickets/${id}/messages`,
    `/seller-tickets/${id}/messages`,
    `/admin/seller/help/tickets/${id}/reply`,
    `/admin/seller-tickets/${id}/reply`,
    `/admin/tickets/${id}/messages`,
    `/admin/tickets/${id}/reply`,
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
      console.warn(`[Seller Tickets API] POST notice on ${ep}:`, err?.response?.status || err?.message);
      continue;
    }
  }

  const normalizedMessage = normalizeTicketMessage(
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
  const stored = getStoredTickets();
  const ticket = stored.find((t) => String(t.ticketId || t.id) === String(id));
  if (ticket) {
    ticket.messages = [...(ticket.messages || []), normalizedMessage];
    ticket.updatedAt = new Date().toISOString();
    saveStoredTickets(stored);
  }

  return normalizedMessage;
};

/**
 * 4. Update Ticket Status & Priority (Admin)
 * Primary: PATCH /api/admin/seller/help/tickets/{id}/status
 */
export const updateSellerTicketStatus = async (id, { status, priority = null }) => {
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
    { method: "put", ep: `/admin/seller-support/tickets/${id}/status` },
    { method: "patch", ep: `/admin/seller-support/tickets/${id}/status` },
    { method: "patch", ep: `/admin/seller/help/tickets/${id}/status` },
    { method: "put", ep: `/admin/seller/help/tickets/${id}/status` },
    { method: "patch", ep: `/seller/help/tickets/${id}/status` },
    { method: "put", ep: `/seller/help/tickets/${id}/status` },
  ];

  let updatedTicket = null;

  for (const attempt of candidateAttempts) {
    try {
      const response = await api[attempt.method](attempt.ep, payload);
      const rawTicket = response.data?.data || response.data?.ticket || response.data;
      if (rawTicket) {
        updatedTicket = normalizeTicket(rawTicket);
        break;
      }
    } catch (err) {
      console.warn(`[Seller Tickets API] Status update notice on ${attempt.ep}:`, err?.response?.status || err?.message);
      continue;
    }
  }

  // Update stored cache
  const stored = getStoredTickets();
  const ticket = stored.find((t) => String(t.ticketId || t.id) === String(id));
  if (ticket) {
    ticket.status = payload.status;
    if (payload.priority) ticket.priority = payload.priority;
    ticket.updatedAt = new Date().toISOString();
    saveStoredTickets(stored);
    return updatedTicket || normalizeTicket(ticket);
  }

  if (updatedTicket) {
    saveStoredTickets([updatedTicket, ...stored]);
    return updatedTicket;
  }

  return {
    ticketId: id,
    status: payload.status,
    priority: payload.priority || "MEDIUM",
  };
};

/**
 * 5. Create a Support Ticket (Admin or on behalf of Seller)
 */
export const createSellerTicket = async (ticketData) => {
  const payload = {
    subject: ticketData.subject,
    category: ticketData.category || "GENERAL",
    priority: ticketData.priority || "MEDIUM",
    message: ticketData.message,
  };
  if (ticketData.orderId) payload.orderId = Number(ticketData.orderId);
  if (ticketData.sellerId) payload.sellerId = Number(ticketData.sellerId);

  const candidateEndpoints = [
    "/admin/seller/help/tickets",
    "/seller/help/tickets",
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

  const newTicket = normalizeTicket(
    raw || {
      ticketId: Date.now(),
      ticketNumber: `STKT-${Date.now()}`,
      sellerId: payload.sellerId || 1,
      sellerName: `Seller #${payload.sellerId || 1}`,
      subject: payload.subject,
      category: payload.category,
      priority: payload.priority,
      status: "OPEN",
      orderId: payload.orderId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          messageId: Date.now() + 1,
          senderRole: "SELLER",
          senderName: `Seller #${payload.sellerId || 1}`,
          content: payload.message,
          timestamp: new Date().toISOString(),
        },
      ],
    }
  );

  // Save to stored tickets
  const stored = getStoredTickets();
  const updated = [newTicket, ...stored];
  saveStoredTickets(updated);

  return newTicket;
};
