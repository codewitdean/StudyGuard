export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      message: "Route not found",
    },
  });
}

export function errorHandler(error, req, res, next) {
  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : 500;
  const message =
    statusCode >= 500 ? "Internal server error." : error.message;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
    },
  });
}
