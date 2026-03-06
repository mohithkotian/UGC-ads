import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    next();
  } catch (error: any) {
    res.status(401).json({ message: error.code || error.message });
  }
};