import { assertEquals } from "@std/assert";
import { youthRepublicCatalog } from "./moduleCatalog.ts";

Deno.test("Youth Republic publishes five areas and tops Volunteer Directory at view", () => {
  assertEquals(youthRepublicCatalog.areas.map((area) => area.key), [
    "drives",
    "noticeboard",
    "applications",
    "hours",
    "volunteers",
  ]);
  const volunteers = youthRepublicCatalog.areas.find((area) => area.key === "volunteers")!;
  assertEquals(volunteers.highest, "view");
  assertEquals(volunteers.keysBySwitch.manage, undefined);
  const drives = youthRepublicCatalog.areas.find((area) => area.key === "drives")!;
  assertEquals(drives.keysBySwitch.view, ["opportunities:read"]);
  assertEquals(drives.keysBySwitch.manage, [
    "opportunities:read",
    "opportunities:write",
    "opportunities:update",
  ]);
});

Deno.test("City Lead is one city and Chapter Lead is chapters, with the same switches", () => {
  const city = youthRepublicCatalog.roleTemplates.find((role) => role.name === "City Lead")!;
  const chapter = youthRepublicCatalog.roleTemplates.find((role) => role.name === "Chapter Lead")!;
  assertEquals(city.place, "city");
  assertEquals(chapter.place, "chapters");
  assertEquals(city.switches, chapter.switches);
  assertEquals(city.switches, {
    drives: "manage",
    noticeboard: "manage",
    applications: "manage",
    hours: "manage",
    volunteers: "none",
  });
});