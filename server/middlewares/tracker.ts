// middlewares/tracker.ts
import { Request, Response, NextFunction } from "express";
import axios from "axios";
import { prisma } from "../configs/PrismaClient.js";

export const trackVisitor = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      req.socket.remoteAddress ||
      "unknown";

    const userAgent = req.headers["user-agent"] || "unknown";
    const referer = req.headers["referer"] || "direct";
    const path = req.originalUrl;

    const isMobile = /mobile/i.test(userAgent);
    const isTablet = /tablet|ipad/i.test(userAgent);
    const deviceType = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

    const browser =
      userAgent.match(/(chrome|firefox|safari|edge|opera)/i)?.[0] || "unknown";

    const os =
      userAgent.match(/(windows|mac os|linux|android|ios|iphone|ipad)/i)?.[0] ||
      "unknown";

    let city = "unknown";
    let country = "unknown";
    let region = "unknown";

    if (ip !== "unknown" && ip !== "::1" && ip !== "127.0.0.1") {
      const geo = await axios.get(`https://ipapi.co/${ip}/json/`, {
        timeout: 3000,
      });
      city = geo.data.city || "unknown";
      country = geo.data.country_name || "unknown";
      region = geo.data.region || "unknown";
    }

    await prisma.visitorLog.create({
      data: {
        ip,
        city,
        region,
        country,
        deviceType,
        browser,
        os,
        userAgent,
        referer,
        path,
        visitedAt: new Date(),
      },
    });

    console.log(
      `[VISITOR] ${ip} | ${city}, ${country} | ${deviceType} | ${browser} | ${path}`
    );
  } catch (err) {
    console.error("[TRACKER ERROR]", err);
  }

  next();
};