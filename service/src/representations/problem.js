// service/src/representations/problem.js
import { randomUUID } from 'node:crypto';

/**
 * Single function to send RFC 9457 Problem Details responses
 */
export function sendProblem(res, { status, type, title, detail, instance, invalidParams }) {
  const problemDetails = {
    type: type || 'about:blank',
    title,
    status,
    ...(detail && { detail }),
    instance: instance || `/errors/${randomUUID()}`,
    ...(invalidParams && { invalid_params: invalidParams })
  };

  return res
    .status(status)
    .setHeader('Content-Type', 'application/problem+json')
    .json(problemDetails);
}
