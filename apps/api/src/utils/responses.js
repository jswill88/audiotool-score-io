export function sendError(res, error) {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({ error: error.message || 'Unexpected server error' });
}
