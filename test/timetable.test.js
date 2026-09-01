import assert from "node:assert/strict";
import test from "node:test";
import { readTimetable, validateTimetable } from "../lib/timetable.js";

delete process.env.BLOB_STORE_ID;
delete process.env.BLOB_READ_WRITE_TOKEN;

test("local timetable is the storage fallback", async () => {
  const timetable = await readTimetable();
  assert.equal(timetable.source, "local");
  assert.equal(timetable.records.length, 54);
  assert.match(timetable.version, /^local-[a-f0-9]{64}$/);
});

test("validation normalizes optional fields and direction indices", () => {
  const records = validateTimetable([
    {
      name: " Ārsts ",
      place: " 12 ",
      mon: " 8:00 - 9:00 ",
      direction: "3",
      section: " Ķirurgs ",
    },
  ]);
  assert.deepEqual(records[0], {
    name: "Ārsts",
    place: "12",
    mon: "8:00 - 9:00",
    tue: null,
    wed: null,
    thu: null,
    fri: null,
    sat: null,
    direction: 3,
    section: "Ķirurgs",
  });
});

test("validation rejects invalid direction indices", () => {
  assert.throws(
    () => validateTimetable([{ name: "Ārsts", section: "Nozare", direction: 4 }]),
    /direction must be empty or an index from 0 to 3/,
  );
});
