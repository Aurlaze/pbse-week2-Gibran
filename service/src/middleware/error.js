import { sendProblem } from '../representations/problem.js';

export function globalErrorHandler(err, req, res, next) {
  const errorId = `err-${Date.now()}`;

  console.error(`[Error ID: ${errorId}] Uncaught Exception:`, {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method
  });

  return sendProblem(res, {
    status: 500,
    type: '/errors/internal-server-error',
    title: 'Internal Server Error',
    detail: 'An unexpected error occurred while processing your request.',
    instance: `/errors/logs/${errorId}`
  });
}
