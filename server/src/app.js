import cors from "cors";
import express from "express";
import healthRoutes from "./routes/healthRoutes.js";

const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app = express();

app.use(
  cors({
    origin: clientOrigin,
  }),
);
app.use(express.json());

app.use("/api/health", healthRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: "Route not found",
    },
  });
});

export default app;
