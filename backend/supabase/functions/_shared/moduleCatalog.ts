export type AreaSwitch = "none" | "view" | "manage";
export type PlaceParameter = "none" | "chapters" | "city";

export interface CatalogArea {
  key: string;
  label: string;
  highest: "view" | "manage";
  keysBySwitch: { view: string[]; manage?: string[] };
}

export interface ModuleRoleTemplate {
  name: string;
  description: string;
  place: PlaceParameter;
  switches: Record<string, AreaSwitch>;
}

export interface ModuleCatalog {
  key: string;
  title: string;
  description: string;
  areas: CatalogArea[];
  roleTemplates: ModuleRoleTemplate[];
}

const leadSwitches: Record<string, AreaSwitch> = {
  drives: "manage",
  noticeboard: "manage",
  applications: "manage",
  hours: "manage",
  volunteers: "none",
};

export const youthRepublicCatalog: ModuleCatalog = {
  key: "youth-republic",
  title: "Youth Republic",
  description: "Drives, noticeboard, applications, hours, and volunteer directory.",
  areas: [
    {
      key: "drives",
      label: "Drives",
      highest: "manage",
      keysBySwitch: {
        view: ["opportunities:read"],
        manage: ["opportunities:read", "opportunities:write", "opportunities:update"],
      },
    },
    {
      key: "noticeboard",
      label: "Noticeboard",
      highest: "manage",
      keysBySwitch: {
        view: ["noticeboard:read"],
        manage: ["noticeboard:read", "noticeboard:write"],
      },
    },
    {
      key: "applications",
      label: "Applications",
      highest: "manage",
      keysBySwitch: {
        view: ["applications:read"],
        manage: ["applications:read", "applications:update"],
      },
    },
    {
      key: "hours",
      label: "Hours",
      highest: "manage",
      keysBySwitch: {
        view: ["hours:read"],
        manage: ["hours:read", "hours:update"],
      },
    },
    {
      key: "volunteers",
      label: "Volunteer Directory",
      highest: "view",
      keysBySwitch: {
        view: ["volunteers:read"],
      },
    },
  ],
  roleTemplates: [
    {
      name: "City Lead",
      description: "Full Youth Republic access for every chapter in the assigned city.",
      place: "city",
      switches: { ...leadSwitches },
    },
    {
      name: "Chapter Lead",
      description: "Full Youth Republic access for the assigned chapters.",
      place: "chapters",
      switches: { ...leadSwitches },
    },
    {
      name: "Drive Coordinator",
      description: "Runs drives, applications, and hours for the assigned chapters.",
      place: "chapters",
      switches: {
        drives: "manage",
        noticeboard: "none",
        applications: "manage",
        hours: "manage",
        volunteers: "none",
      },
    },
    {
      name: "Application Reviewer",
      description: "Decides applications for the assigned chapters.",
      place: "chapters",
      switches: {
        drives: "none",
        noticeboard: "none",
        applications: "manage",
        hours: "none",
        volunteers: "none",
      },
    },
  ],
};