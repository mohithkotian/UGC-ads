import { Router, Request, Response } from "express";
import { prisma } from "../configs/PrismaClient.js";
import axios from "axios";

const router = Router();
router.post("/pageview", async (req: Request, res: Response) => {
  try {
    const { visitorId, sessionId, path, timeOnPage } = req.body;

    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      req.socket.remoteAddress ||
      "unknown";

    const userAgent = req.headers["user-agent"] || "unknown";
    const referer = req.headers["referer"] || "direct";

    const isMobile = /mobile/i.test(userAgent);
    const isTablet = /tablet|ipad/i.test(userAgent);
    const deviceType = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";
    const browser = userAgent.match(/(chrome|firefox|safari|edge|opera)/i)?.[0] || "unknown";
    const os = userAgent.match(/(windows|mac os|linux|android|ios|iphone|ipad)/i)?.[0] || "unknown";

    let city = "unknown";
    let country = "unknown";
    let region = "unknown";

    if (ip !== "unknown" && ip !== "::1" && ip !== "127.0.0.1") {
      const geo = await axios.get(`https://ipapi.co/${ip}/json/`, { timeout: 3000 });
      city = geo.data.city || "unknown";
      country = geo.data.country_name || "unknown";
      region = geo.data.region || "unknown";
    }

    const existingVisitor = visitorId
      ? await (prisma as any).visitorLog.findFirst({ where: { visitorId } })
      : null;

    const isNew = !existingVisitor;

    await (prisma as any).visitorLog.create({
      data: {
        visitorId: visitorId || "unknown",
        sessionId: sessionId || "unknown",
        ip,
        city,
        region,
        country,
        deviceType,
        browser,
        os,
        userAgent,
        referer,
        path: path || "/",
        timeOnPage: timeOnPage || null,
        isNew,
        visitedAt: new Date(),
      },
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[TRACK PAGEVIEW ERROR]", err);
    res.status(500).json({ error: "Failed to track" });
  }
});

// POST /api/track/click
router.post("/click", async (req: Request, res: Response) => {
  try {
    const { visitorId, sessionId, element, path } = req.body;

    await (prisma as any).clickLog.create({
      data: {
        visitorId: visitorId || "unknown",
        sessionId: sessionId || "unknown",
        element: element || "unknown",
        path: path || "/",
        clickedAt: new Date(),
      },
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[TRACK CLICK ERROR]", err);
    res.status(500).json({ error: "Failed to track click" });
  }
});

export default router;