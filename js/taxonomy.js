// Areas mirror the five JobMatch Logic sub-scores; subtypes are our finer tags.

export const AREAS = ["logik", "uppfattning", "matte", "sprak", "komplex"];

export const AREA_LABELS = {
  logik: "Logiskt tänkande",
  uppfattning: "Logisk uppfattning",
  matte: "Matematisk förmåga",
  sprak: "Språklig förmåga",
  komplex: "Komplex differentiering",
};

export const SYLLOGISM_OPTIONS = ["Sant", "Falskt", "Möjligt", "Osannolikt"];

const S = (area, label, optionCount, source) => ({ area, label, optionCount, source });

export const SUBTYPES = {
  syllogism: S("logik", "Slutledning (sant/falskt)", 4, "bank"),
  udda_ord: S("logik", "Udda ord", 5, "bank"),
  slutsats: S("logik", "Slutsats ur text", 4, "bank"),

  matris: S("uppfattning", "Matris", 5, "generated"),
  figurserie: S("uppfattning", "Figurserie", 5, "generated"),
  rotation: S("uppfattning", "Rotation", 4, "generated"),
  udda_figur: S("uppfattning", "Udda figur", 5, "generated"),

  huvudrakning: S("matte", "Huvudräkning", 5, "generated"),
  talserie: S("matte", "Talserie", 5, "generated"),
  talsamband: S("matte", "Talsamband", 5, "generated"),
  procent_brak: S("matte", "Procent och bråk", 5, "bank"),
  textuppgift: S("matte", "Textuppgift", 5, "bank"),

  synonym: S("sprak", "Synonym", 5, "bank"),
  motsats: S("sprak", "Motsats", 5, "bank"),
  ordbetydelse: S("sprak", "Ordbetydelse", 5, "bank"),
  grammatik: S("sprak", "Grammatik", 4, "bank"),
  analogi: S("sprak", "Analogi", 5, "bank"),

  placering: S("komplex", "Placering", 5, "bank"),
  rangordning: S("komplex", "Rangordning", 5, "bank"),
  flerstegs: S("komplex", "Flerstegsproblem", 5, "bank"),
};

export const subtypesOf = (area) => Object.keys(SUBTYPES).filter((s) => SUBTYPES[s].area === area);
