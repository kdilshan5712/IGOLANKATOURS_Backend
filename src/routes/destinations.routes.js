import express from 'express';
import { getAllDestinations } from '../controllers/destinations.controller.js';

const router = express.Router();

router.get('/', getAllDestinations);

export default router;
