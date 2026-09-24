/**
 * Vercel Serverless Function Entry Point
 * 
 * This file adapts the existing Express application for Vercel's serverless runtime.
 * All /api/* requests are routed here by vercel.json.
 * 
 * The Express app (server/index.ts) handles all routing internally —
 * no routes are duplicated or modified here.
 */
import app from '../server/index';

export default app;
