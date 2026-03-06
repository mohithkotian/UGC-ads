// routes/admin.ts
import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../configs/PrismaClient.js";

const router = Router();

// Secret key protection — only you can access these routes
const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  const secret = req.headers["x-admin-key"];
  if (!secret || secret !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// GET /api/admin/visitors
router.get("/visitors", isAdmin, async (req: Request, res: Response) => {
  try {
    const visitors = await prisma.visitorLog.findMany({
      orderBy: { visitedAt: "desc" },
      take: 200,
    });

    res.json({ total: visitors.length, visitors });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch visitor logs" });
  }
});

// GET /api/admin/visitors/summary
router.get("/visitors/summary", isAdmin, async (req: Request, res: Response) => {
  try {
    const [total, byCountry, byDevice, byBrowser] = await Promise.all([
      prisma.visitorLog.count(),

      prisma.visitorLog.groupBy({
        by: ["country"],
        _count: { country: true },
        orderBy: { _count: { country: "desc" } },
        take: 10,
      }),

      prisma.visitorLog.groupBy({
        by: ["deviceType"],
        _count: { deviceType: true },
      }),

      prisma.visitorLog.groupBy({
        by: ["browser"],
        _count: { browser: true },
        orderBy: { _count: { browser: "desc" } },
        take: 5,
      }),
    ]);

    res.json({ total, byCountry, byDevice, byBrowser });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

export default router;