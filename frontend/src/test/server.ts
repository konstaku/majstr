import { setupServer } from "msw/node";

// Shared MSW server. No default handlers — each test registers its own via
// server.use(...) so unhandled requests fail loudly.
export const server = setupServer();
