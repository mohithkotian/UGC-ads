import { Request, Response, NextFunction } from "express";
import axios from "axios";
import { prisma } from "../configs/PrismaClient.js";

export const trackVisitor = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.path.startsWith("/api/admin") || req.path.startsWith("/api/track")) {
    return next();
  }

  try {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      req.socket.remoteAddress ||
      "unknown";

    const userAgent = req.headers["user-agent"] || "unknown";
    const referer = req.headers["referer"] || "direct";
    const path = req.originalUrl;
    const visitorId = (req.headers["x-visitor-id"] as string) || "unknown";
    const sessionId = (req.headers["x-session-id"] as string) || "unknown";

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
    try {
      if (ip !== "unknown" && ip !== "::1" && ip !== "127.0.0.1") {
        const geo = await axios.get(`https://ipapi.co/${ip}/json/`, {
          timeout: 3000,
        });
        if (!geo.data.error) {
          city = geo.data.city || "unknown";
          country = geo.data.country_name || "unknown";
          region = geo.data.region || "unknown";
        }
      }
    } catch {
      // geo lookup failed, continue with unknown location
    }

    if (ip !== "unknown" && ip !== "::1" && ip !== "127.0.0.1") {
      const geo = await axios.get(`https://ipapi.co/${ip}/json/`, {
        timeout: 3000,
      });
      city = geo.data.city || "unknown";
      country = geo.data.country_name || "unknown";
      region = geo.data.region || "unknown";
    }

    const existingVisitor =
      visitorId !== "unknown"
        ? await (prisma as any).visitorLog.findFirst({ where: { visitorId } })
        : null;

    const isNew = !existingVisitor;

    await (prisma as any).visitorLog.create({
      data: {
        visitorId,
        sessionId,
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
        isNew,
        visitedAt: new Date(),
      },
    });

    console.log(
      `[VISITOR] ${ip} | ${city}, ${country} | ${deviceType} | ${browser} | ${path} | ${isNew ? "NEW" : "RETURNING"}`,
    );
  } catch (err) {
    console.error("[TRACKER ERROR]", err);
  }

  next();
};
