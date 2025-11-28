import { Router } from "express";
import { PrismaClient, Priority } from "@prisma/client";
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

// New: allowed 2-hour windows between 8:00 and 17:00 (5pm)
const allowedWindowOptions = [
  "08:00-10:00",
  "09:00-11:00",
  "10:00-12:00",
  "11:00-13:00",
  "12:00-14:00",
  "13:00-15:00",
  "14:00-16:00",
  "15:00-17:00",
] as const;
type WindowString = (typeof allowedWindowOptions)[number];

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
    // old field (ignored now, but safe if sent)
    preferredTimeWindow,
    accessInstructions,
    // NEW fields
    preferredWindow1,
    preferredWindow2,
  } = req.body as {
    unit?: string;
    category?: string;
    description?: string;
    phone?: string;
    priority?: PriorityValue;
    preferredTimeWindow?: string;
    accessInstructions?: string;
    preferredWindow1?: string;
    preferredWindow2?: string;
  };

  if (!unit || !category || !description || !phone) {
    return res.status(400).json({
      message: "unit, category, description, and phone are required",
    });
  }

  const prioritySafe: PriorityValue =
    priority && allowedPriorities.includes(priority) ? priority : "normal";

  // Validate new windows
  const w1 = preferredWindow1 as WindowString | undefined;
  const w2 = preferredWindow2 as WindowString | undefined;

  if (!w1 || !allowedWindowOptions.includes(w1)) {
    return res.status(400).json({
      message:
        "preferredWindow1 is required and must be a valid 2-hour window between 8 AM and 5 PM.",
    });
  }

  if (w2 && !allowedWindowOptions.includes(w2)) {
    return res.status(400).json({
      message:
        "preferredWindow2 must be a valid 2-hour window between 8 AM and 5 PM.",
    });
  }

  if (w1 && w2 && w1 === w2) {
    return res.status(400).json({
      message: "Preferred windows must be different if two are provided.",
    });
  }

  try {
    const now = new Date();

    const request = await prisma.request.create({
      data: {
        unit,
        category,
        description,
        phone,
        priority: prioritySafe as Priority,
        preferredWindow1: w1,
        preferredWindow2: w2 || null,
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

    const data: any = {
      status: "completed",
      lastUpdatedByRole: "tenant",
    };

    if (!existing.inQueueAt) {
      data.inQueueAt = existing.createdAt ?? now;
    }
    if (!existing.viewedAt && existing.status !== "in_queue") {
      data.viewedAt = now;
    }
    if (
      !existing.maintenanceRequestedAt &&
      statusPipeline.indexOf(existing.status as RequestStatus) >=
        statusPipeline.indexOf("maintenance_requested")
    ) {
      data.maintenanceRequestedAt = existing.maintenanceRequestedAt ?? now;
    }
    if (
      !existing.implementingActionsAt &&
      statusPipeline.indexOf(existing.status as RequestStatus) >=
        statusPipeline.indexOf("implementing_actions")
    ) {
      data.implementingActionsAt = existing.implementingActionsAt ?? now;
    }

    data.completedAt = existing.completedAt ?? now;

    const updated = await prisma.request.update({
      where: { id: Number(id) },
      data,
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

    if (status !== existing.status) {
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

    if (!existing.inQueueAt) {
      data.inQueueAt = existing.createdAt ?? now;
    }

    switch (status) {
      case "in_queue":
        if (!existing.inQueueAt) data.inQueueAt = now;
        break;
      case "viewed":
        if (!existing.viewedAt) data.viewedAt = now;
        break;
      case "maintenance_requested":
        if (!existing.maintenanceRequestedAt) {
          data.maintenanceRequestedAt = now;
        }
        break;
      case "implementing_actions":
        if (!existing.implementingActionsAt) {
          data.implementingActionsAt = now;
        }
        break;
      case "completed":
        if (!existing.completedAt) {
          data.completedAt = now;
        }
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
