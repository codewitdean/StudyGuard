import cors from "cors";
import express from "express";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import availabilityRoutes from "./routes/availabilityRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import courseworkRoutes from "./routes/courseworkRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import recommendationRoutes from "./routes/recommendationRoutes.js";
import studyPlanRoutes from "./routes/studyPlanRoutes.js";

const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app = express();

app.use(
  cors({
    origin: clientOrigin,
  }),
);
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/coursework", courseworkRoutes);
app.use("/api/study-plans", studyPlanRoutes);
app.use("/api/recommendations", recommendationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
