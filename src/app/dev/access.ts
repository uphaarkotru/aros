export function isDevelopmentRouteEnabled() {
  return process.env.NODE_ENV !== "production";
}
