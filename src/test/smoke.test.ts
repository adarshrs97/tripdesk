import { describe, it, expect } from 'vitest';
import { INITIAL_SUPPLIERS } from '../data/initialSuppliers';

describe('Milestone 0 Smoke Test', () => {
  it('should load initial supplier profiles with proper legal and trade names', () => {
    expect(INITIAL_SUPPLIERS.length).toBe(2);
    const starciti = INITIAL_SUPPLIERS.find(s => s.id === 'supplier-starciti-group');
    expect(starciti).toBeDefined();
    expect(starciti?.tradeName).toBe('StarCiti Group');
    expect(starciti?.pan).toBe('BGYPM6861Q');
    expect(starciti?.sacCode).toBe('996601');

    const cityTours = INITIAL_SUPPLIERS.find(s => s.id === 'supplier-city-tours');
    expect(cityTours).toBeDefined();
    expect(cityTours?.tradeName).toBe('M/S City Tours & Travels');
  });

  it('validates PAN and GSTIN regex patterns', () => {
    const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

    expect(PAN_REGEX.test('BGYPM6861Q')).toBe(true);
    expect(PAN_REGEX.test('AAACV7757J')).toBe(true);
    expect(PAN_REGEX.test('INVALID123')).toBe(false);

    expect(GSTIN_REGEX.test('32AAACV7757J2Z0')).toBe(true);
    // Historical bug: phone number as tax number
    expect(GSTIN_REGEX.test('+918136910938')).toBe(false);
  });
});
