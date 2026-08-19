import {
  getCurrentUserById,
  loginUser,
  registerUser,
} from "../services/authService.js";

export async function register(req, res) {
  const result = await registerUser(req.validated.body);

  res.status(201).json({
    success: true,
    data: result,
  });
}

export async function login(req, res) {
  const result = await loginUser(req.validated.body);

  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function getCurrentUser(req, res) {
  const user = await getCurrentUserById(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      user,
    },
  });
}
