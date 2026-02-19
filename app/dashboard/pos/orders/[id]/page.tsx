'use client';

/**
 * Order Detail Page
 *
 * Displays detailed view of a single order:
 * - Order header with status and payment method
 * - Items table with product details
 * - Summary with totals and tax
 * - Back button to return to order list
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
