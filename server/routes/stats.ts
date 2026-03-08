// routes/stats.ts
import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../configs/PrismaClient.js";

const router = Router();

const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  const secret = req.headers["x-admin-key"];
  if (!secret || secret !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// GET /api/stats/visitors
router.get("/visitors", isAdmin, async (req: Request, res: Response) => {
  try {
    const visitors = await (prisma as any).visitorLog.findMany({
      orderBy: { visitedAt: "desc" },
      take: 200,
    });
    res.json({ total: visitors.length, visitors });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch visitor logs" });
  }
});

// GET /api/stats/visitors/summary
router.get("/visitors/summary", isAdmin, async (req: Request, res: Response) => {
  try {
    const [
      totalVisits,
      uniqueVisitorsRaw,
      newVisitors,
      returningVisitors,
      byCountry,
      byDevice,
      byBrowser,
      byPage,
      avgTimeOnPage,
      recentVisitors,
      topClicks,
    ] = await Promise.all([
      (prisma as any).visitorLog.count(),
      (prisma as any).visitorLog.groupBy({ by: ["visitorId"] }),
      (prisma as any).visitorLog.count({ where: { isNew: true } }),
      (prisma as any).visitorLog.count({ where: { isNew: false } }),
      (prisma as any).visitorLog.groupBy({
        by: ["country"],
        _count: { country: true },
        orderBy: { _count: { country: "desc" } },
        take: 10,
      }),
      (prisma as any).visitorLog.groupBy({
        by: ["deviceType"],
        _count: { deviceType: true },
      }),
      (prisma as any).visitorLog.groupBy({
        by: ["browser"],
        _count: { browser: true },
        orderBy: { _count: { browser: "desc" } },
        take: 5,
      }),
      (prisma as any).visitorLog.groupBy({
        by: ["path"],
        _count: { path: true },
        orderBy: { _count: { path: "desc" } },
        take: 10,
      }),
      (prisma as any).visitorLog.aggregate({
        _avg: { timeOnPage: true },
      }),
      (prisma as any).visitorLog.findMany({
        orderBy: { visitedAt: "desc" },
        take: 10,
        select: {
          ip: true,
          city: true,
          country: true,
          deviceType: true,
          browser: true,
          path: true,
          isNew: true,
          timeOnPage: true,
          visitedAt: true,
        },
      }),
      (prisma as any).clickLog.groupBy({
        by: ["element"],
        _count: { element: true },
        orderBy: { _count: { element: "desc" } },
        take: 10,
      }),
    ]);

    res.json({
      totalVisits,
      uniqueVisitors: uniqueVisitorsRaw.length,
      newVisitors,
      returningVisitors,
      avgTimeOnPage: Math.round(avgTimeOnPage._avg?.timeOnPage || 0),
      byCountry,
      byDevice,
      byBrowser,
      byPage,
      recentVisitors,
      topClicks,
    });
  }  catch (err) {
  console.error("[STATS SUMMARY ERROR]", err);
  res.status(500).json({ error: "Failed to fetch summary" });
}
});

export default router;