// Run with: npm run test:tax
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateTax,
  gstinStateCode,
  isValidGstin,
  normalizeStateCode,
} from "../src/lib/billing/tax.ts";

const config = { gstRate: 18, homeStateCode: "HR", otherTaxName: "Platform Tax", otherTaxRate: 4 };

test("Starter yearly, Haryana → CGST 9% + SGST 9% + other 4%", () => {
  const t = calculateTax({ baseAmount: 129900, stateCode: "Haryana", config });
  assert.equal(t.taxType, "intra_state");
  assert.equal(t.cgstAmount, 11691);
  assert.equal(t.sgstAmount, 11691);
  assert.equal(t.igstAmount, 0);
  assert.equal(t.otherTaxAmount, 5196);
  assert.equal(t.totalAmount, 158478);
  assert.equal(t.cgstRate, 9);
});

test("Starter yearly, Delhi → IGST 18% + other 4%", () => {
  const t = calculateTax({ baseAmount: 129900, stateCode: "DL", config });
  assert.equal(t.taxType, "inter_state");
  assert.equal(t.igstAmount, 23382);
  assert.equal(t.cgstAmount + t.sgstAmount, 0);
  assert.equal(t.otherTaxAmount, 5196);
  assert.equal(t.totalAmount, 158478);
});

test("Business yearly, Haryana", () => {
  const t = calculateTax({ baseAmount: 459900, stateCode: "HARYANA", config });
  assert.equal(t.cgstAmount, 41391);
  assert.equal(t.sgstAmount, 41391);
  assert.equal(t.otherTaxAmount, 18396);
  assert.equal(t.totalAmount, 561078);
});

test("Enterprise yearly, Maharashtra", () => {
  const t = calculateTax({ baseAmount: 2999900, stateCode: "Maharashtra", config });
  assert.equal(t.igstAmount, 539982);
  assert.equal(t.otherTaxAmount, 119996);
  assert.equal(t.totalAmount, 3659878);
});

test("Admin-changed other tax rate applies to new calculations", () => {
  const t = calculateTax({ baseAmount: 129900, stateCode: "DL", config: { ...config, otherTaxRate: 5 } });
  assert.equal(t.otherTaxAmount, 6495);
  assert.equal(t.otherTaxRate, 5);
});

test("Coupon discounts reduce the taxable value", () => {
  const t = calculateTax({ baseAmount: 129900, discountAmount: 29900, stateCode: "DL", config });
  assert.equal(t.taxableAmount, 100000);
  assert.equal(t.igstAmount, 18000);
  assert.equal(t.otherTaxAmount, 4000);
  assert.equal(t.totalAmount, 122000);
});

test("Odd paise are rounded half-up and CGST always equals SGST", () => {
  const t = calculateTax({ baseAmount: 101, stateCode: "HR", config });
  assert.equal(t.cgstAmount, t.sgstAmount);
  assert.equal(t.cgstAmount, 9); // 101 × 9% = 9.09
  assert.ok(Number.isInteger(t.totalAmount));
});

test("State normalization", () => {
  for (const v of ["Haryana", "HR", "HARYANA", " haryana ", "hr"]) assert.equal(normalizeStateCode(v), "HR");
  assert.equal(normalizeStateCode("New Delhi"), "DL");
  assert.equal(normalizeStateCode("Orissa"), "OD");
  assert.equal(normalizeStateCode("Jammu & Kashmir"), "JK");
  assert.equal(normalizeStateCode("Atlantis"), null);
  assert.throws(() => calculateTax({ baseAmount: 100, stateCode: "", config }));
});

test("GSTIN validation", () => {
  assert.equal(isValidGstin("27AAPFU0939F1ZV"), true);
  assert.equal(isValidGstin("27aapfu0939f1zv"), true);
  assert.equal(isValidGstin("27AAPFU0939F1ZX"), false); // wrong check digit
  assert.equal(isValidGstin("27AAPFU0939F1Z"), false);
  assert.equal(gstinStateCode("27AAPFU0939F1ZV"), "MH");
  assert.equal(gstinStateCode("06AAAAA0000A1Z5"), "HR");
});
