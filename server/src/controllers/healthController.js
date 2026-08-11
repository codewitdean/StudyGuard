export function getHealth(req, res) {
  res.status(200).json({
    success: true,
    data: {
      status: "ok",
      service: "studyguard-api",
      timestamp: new Date().toISOString(),
    },
  });
}
