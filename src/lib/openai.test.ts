import { expect, test } from "bun:test";
import { extractResponseOutputText } from "./openai";

test("extractResponseOutputText uses output_text when present", () => {
  expect(extractResponseOutputText({ output_text: "  A useful angle.  " })).toBe(
    "A useful angle."
  );
});

test("extractResponseOutputText falls back to output content parts", () => {
  expect(
    extractResponseOutputText({
      output: [
        {
          content: [
            { type: "output_text", text: "First sentence." },
            { type: "output_text", text: "Second sentence." },
          ],
        },
      ],
    })
  ).toBe("First sentence.\nSecond sentence.");
});
