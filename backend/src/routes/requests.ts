import { Router } from "express";
import { PrismaClient, Priority, PreferredTimeWindow } from "@prisma/client";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

type RequestStatus =
  | "in_queue"
  | "viewed"
  | "maintenance_requested"
  | "implementing_actions"
  | "completed";

const statusPipeline: RequestStatus[] = [
  "in_queue",
  "viewed",
  "maintenance_requested",
  "implementing_actions",
  "completed",
];

const allowedStatusValues: RequestStatus[] = [...statusPipeline];

type PriorityValue = "low" | "normal" | "high" | "emergency";

const allowedPriorities: PriorityValue[] = [
  "low",
  "normal",
  "high",
  "emergency",
];

type TimeWindowValue = "morning" | "afternoon" | "evening" | "anytime";

const allowedTimeWindows: TimeWindowValue[] = [
  "morning",
  "afternoon",
  "evening",
  "anytime",
];

function ensureTenant(req: AuthRequest, res: any) {
  const user = req.user as any;
  if (!user || user.role !== "tenant") {
    res.status(403).json({ message: "Only tenants can perform this action" });
    return null;
  }
  return user;
}

function ensureManager(req: AuthRequest, res: any) {
  const user = req.user as any;
  if (!user || (user.role !== "manager" && user.role !== "admin")) {
    res.status(403).json({ message: "Only managers can perform this action" });
    return null;
  }
  return user;
}

// Tenant: create new request
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  const user = ensureTenant(req, res);
  if (!user) return;

  const {
    unit,
    category,
    description,
    phone,
    priority,
    preferredTimeWindow,
    accessInstructions,
  } = req.body as {
    unit?: string;
    category?: string;
    description?: string;
    phone?: string;
    priority?: PriorityValue;
    preferredTimeWindow?: TimeWindowValue;
    accessInstructions?: string;
  };

  if (!unit || !category || !description || !phone) {
    return res.status(400).json({
      message: "unit, category, description, and phone are required",
    });
  }

  const prioritySafe: PriorityValue =
    priority && allowedPriorities.includes(priority) ? priority : "normal";

  const timeWindowSafe: TimeWindowValue | null =
    preferredTimeWindow && allowedTimeWindows.includes(preferredTimeWindow)
      ? preferredTimeWindow
      : null;

  try {
    const now = new Date();

    const request = await prisma.request.create({
      data: {
        unit,
        category,
        description,
        phone,
        priority: prioritySafe as Priority,
        preferredTimeWindow: timeWindowSafe
          ? (timeWindowSafe as PreferredTimeWindow)
          : undefined,
        accessInstructions: accessInstructions || undefined,
        tenantId: user.id,
        status: "in_queue",
        lastUpdatedByRole: "tenant",
        inQueueAt: now,
      },
    });

    return res.status(201).json(request);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create request" });
  }
});

// Tenant: get own requests
router.get("/mine", authMiddleware, async (req: AuthRequest, res) => {
  const user = ensureTenant(req, res);
  if (!user) return;

  try {
    const requests = await prisma.request.findMany({
      where: { tenantId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return res.json(requests);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load requests" });
  }
});

// Tenant: close a request (mark as completed)
router.patch("/:id/close", authMiddleware, async (req: AuthRequest, res) => {
  const user = ensureTenant(req, res);
  if (!user) return;

  const { id } = req.params;

  try {
    const existing = await prisma.request.findUnique({
      where: { id: Number(id) },
    });

    if (!existing || existing.tenantId !== user.id) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (existing.status === "completed") {
      return res.json(existing);
    }

    const now = new Date();

    const updated = await prisma.request.update({
      where: { id: Number(id) },
      data: {
        status: "completed",
        lastUpdatedByRole: "tenant",
        completedAt: existing.completedAt ?? now,
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to close request" });
  }
});

// Manager: get all requests
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  const user = ensureManager(req, res);
  if (!user) return;

  try {
    const requests = await prisma.request.findMany({
      include: {
        tenant: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(requests);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load requests" });
  }
});

// Manager: update status (must follow pipeline order)
router.patch("/:id/status", authMiddleware, async (req: AuthRequest, res) => {
  const user = ensureManager(req, res);
  if (!user) return;

  const { id } = req.params;
  const { status } = req.body as { status?: RequestStatus };

  if (!status || !allowedStatusValues.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    const existing = await prisma.request.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      return res.status(404).json({ message: "Request not found" });
    }

    const currentIndex = statusPipeline.indexOf(
      existing.status as RequestStatus
    );
    const nextIndex = statusPipeline.indexOf(status);

    // Allow no-op (setting same status)
    if (status !== existing.status) {
      // must move exactly one step forward
      if (nextIndex !== currentIndex + 1) {
        return res.status(400).json({
          message:
            "Status must be updated in order: In Queue → Viewed → Maintenance Requested → Implementing Actions → Completed.",
        });
      }
    }

    const now = new Date();
    const data: any = {
      status,
      lastUpdatedByRole: "manager",
    };

    // Set the timestamp for the new status if it wasn't set before
    switch (status) {
      case "in_queue":
        if (!existing.inQueueAt) data.inQueueAt = now;
        break;
      case "viewed":
        if (!existing.viewedAt) data.viewedAt = now;
        break;
      case "maintenance_requested":
        if (!existing.maintenanceRequestedAt) data.maintenanceRequestedAt = now;
        break;
      case "implementing_actions":
        if (!existing.implementingActionsAt) data.implementingActionsAt = now;
        break;
      case "completed":
        if (!existing.completedAt) data.completedAt = now;
        break;
    }

    const updated = await prisma.request.update({
      where: { id: Number(id) },
      data,
    });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update status" });
  }
});

// Manager: update priority
router.patch("/:id/priority", authMiddleware, async (req: AuthRequest, res) => {
  const user = ensureManager(req, res);
  if (!user) return;

  const { id } = req.params;
  const { priority } = req.body as { priority?: PriorityValue };

  if (!priority || !allowedPriorities.includes(priority)) {
    return res.status(400).json({ message: "Invalid priority" });
  }

  try {
    const updated = await prisma.request.update({
      where: { id: Number(id) },
      data: {
        priority: priority as Priority,
        lastUpdatedByRole: "manager",
      },
    });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update priority" });
  }
});

export default router;
