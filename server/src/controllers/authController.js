import { registerUser } from "../services/authService.js";

export async function register(req, res) {
  const result = await registerUser(req.validated.body);

  res.status(201).json({
    success: true,
    data: result,
  });
}
