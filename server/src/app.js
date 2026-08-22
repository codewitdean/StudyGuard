import cors from "cors";
import express from "express";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import availabilityRoutes from "./routes/availabilityRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import courseworkRoutes from "./routes/courseworkRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import progressRoutes from "./routes/progressRoutes.js";
import recommendationRoutes from "./routes/recommendationRoutes.js";
import studyPlanRoutes from "./routes/studyPlanRoutes.js";

const defaultClientOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const clientOrigins = (
  process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(",")
    : defaultClientOrigins
)
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      callback(null, !origin || clientOrigins.includes(origin));
    },
  }),
);
app.use(express.json({ limit: "2mb" }));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/coursework", courseworkRoutes);
app.use("/api/study-plans", studyPlanRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/progress", progressRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
