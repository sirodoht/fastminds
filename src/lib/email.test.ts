import { expect, test } from "bun:test";
import { shouldSkipEmailRecipient } from "./email";

test("shouldSkipEmailRecipient skips seeded fastminds local users", () => {
  expect(shouldSkipEmailRecipient("simone@fastminds.local")).toBe(true);
});

test("shouldSkipEmailRecipient skips local development domains", () => {
  expect(shouldSkipEmailRecipient("person@example.local")).toBe(true);
});

test("shouldSkipEmailRecipient allows normal email addresses", () => {
  expect(shouldSkipEmailRecipient("person@example.com")).toBe(false);
});
