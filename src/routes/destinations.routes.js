/**
 * Destination Informational Routes
 * Path: /api/destinations
 * 
 * Provides public endpoints for retrieving details about geographic 
 * destinations supported by the tour packages.
 */
import express from 'express';
import { getAllDestinations } from '../controllers/destinations.controller.js';

const router = express.Router();

router.get('/', getAllDestinations);

export default router;
