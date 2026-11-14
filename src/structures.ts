export interface Step { title: string; hint: string }
export interface Act { title: string; steps: Step[] }
export interface Structure { id: string; name: string; blurb: string; acts: Act[] }

/** Modèles de structure : chaque étape devient une scène « Idée » avec une consigne en résumé. */
export const STRUCTURES: Structure[] = [
  {
    id: "narratif5",
    name: "Schéma narratif en 5 étapes",
    blurb: "Le classique français : situation initiale, élément perturbateur, péripéties, dénouement, situation finale.",
    acts: [
      { title: "Situation initiale", steps: [{ title: "Situation initiale", hint: "Présenter le héros, son monde, son quotidien." }] },
      { title: "Élément perturbateur", steps: [{ title: "Élément perturbateur", hint: "L'événement qui rompt l'équilibre et lance l'histoire." }] },
      { title: "Péripéties", steps: [{ title: "Premiers obstacles", hint: "Le héros tente d'agir, rencontre des résistances." }, { title: "Le tournant", hint: "Un rebondissement qui change la donne." }, { title: "Moment le plus sombre", hint: "Tout semble perdu." }] },
      { title: "Dénouement", steps: [{ title: "Climax", hint: "L'affrontement décisif." }, { title: "Résolution", hint: "Le conflit est réglé." }] },
      { title: "Situation finale", steps: [{ title: "Situation finale", hint: "Le nouvel équilibre. Ce qui a changé." }] },
    ],
  },
  {
    id: "actes3",
    name: "Trois actes",
    blurb: "Exposition, confrontation, résolution.",
    acts: [
      { title: "Acte I — Exposition", steps: [{ title: "Image d'ouverture", hint: "Le monde ordinaire du héros." }, { title: "Élément déclencheur", hint: "L'événement qui bouscule tout." }, { title: "Premier point de bascule", hint: "Le héros s'engage dans l'aventure." }] },
      { title: "Acte II — Confrontation", steps: [{ title: "Premières épreuves", hint: "Il découvre les règles du nouveau monde." }, { title: "Point médian", hint: "Révélation ou victoire qui change l'enjeu." }, { title: "Les obstacles se durcissent", hint: "L'opposition se resserre." }, { title: "Second point de bascule", hint: "Le héros touche le fond, puis rebondit." }] },
      { title: "Acte III — Résolution", steps: [{ title: "Climax", hint: "L'affrontement final." }, { title: "Résolution", hint: "Les conséquences, le nouvel équilibre." }] },
    ],
  },
  {
    id: "heros",
    name: "Le voyage du héros (12 étapes)",
    blurb: "D'après Joseph Campbell et Christopher Vogler.",
    acts: [
      { title: "Départ", steps: [{ title: "Le monde ordinaire", hint: "" }, { title: "L'appel de l'aventure", hint: "" }, { title: "Le refus de l'appel", hint: "" }, { title: "La rencontre avec le mentor", hint: "" }, { title: "Le franchissement du seuil", hint: "" }] },
      { title: "Initiation", steps: [{ title: "Épreuves, alliés, ennemis", hint: "" }, { title: "L'approche de la caverne", hint: "" }, { title: "L'épreuve suprême", hint: "" }, { title: "La récompense", hint: "" }] },
      { title: "Retour", steps: [{ title: "Le chemin du retour", hint: "" }, { title: "La résurrection", hint: "" }, { title: "Le retour avec l'élixir", hint: "" }] },
    ],
  },
  {
    id: "savethecat",
    name: "Save the Cat (15 temps)",
    blurb: "La structure de Blake Snyder, très utilisée en romance et en thriller.",
    acts: [
      { title: "Acte I", steps: [{ title: "Image d'ouverture", hint: "" }, { title: "Thème énoncé", hint: "" }, { title: "Mise en place", hint: "" }, { title: "Élément déclencheur", hint: "" }, { title: "Débat", hint: "" }] },
      { title: "Acte II (première moitié)", steps: [{ title: "Passage à l'acte II", hint: "" }, { title: "Intrigue B", hint: "" }, { title: "Amusement et jeux", hint: "" }, { title: "Point médian", hint: "" }] },
      { title: "Acte II (seconde moitié)", steps: [{ title: "Les méchants se rapprochent", hint: "" }, { title: "Tout est perdu", hint: "" }, { title: "Nuit noire de l'âme", hint: "" }] },
      { title: "Acte III", steps: [{ title: "Passage à l'acte III", hint: "" }, { title: "Finale", hint: "" }, { title: "Image finale", hint: "" }] },
    ],
  },
  {
    id: "sept",
    name: "Sept points clés",
    blurb: "Une méthode simple : on part de la fin et on revient.",
    acts: [
      { title: "Sept points", steps: [{ title: "Accroche", hint: "L'état initial, opposé à la fin." }, { title: "Premier tournant", hint: "" }, { title: "Premier pincement", hint: "La pression monte." }, { title: "Point médian", hint: "Le héros passe de la réaction à l'action." }, { title: "Second pincement", hint: "" }, { title: "Second tournant", hint: "Le héros a ce qu'il lui faut pour gagner." }, { title: "Résolution", hint: "" }] },
    ],
  },
  {
    id: "polar",
    name: "Roman policier",
    blurb: "Crime, enquête, fausses pistes, révélation.",
    acts: [
      { title: "Le crime", steps: [{ title: "La découverte", hint: "Le crime, la victime, les premiers indices." }, { title: "L'enquêteur entre en scène", hint: "" }] },
      { title: "L'enquête", steps: [{ title: "Les suspects", hint: "Mobiles et alibis." }, { title: "Première fausse piste", hint: "" }, { title: "Rebondissement", hint: "Un second crime ou un indice inattendu." }, { title: "Le doute", hint: "L'enquêteur est en difficulté." }] },
      { title: "La résolution", steps: [{ title: "Le déclic", hint: "L'indice qui change tout." }, { title: "La révélation", hint: "Le coupable est démasqué." }, { title: "Épilogue", hint: "" }] },
    ],
  },
];

/** Champs proposés pour une nouvelle fiche, selon le dossier qui la contient. */
export const PROP_TEMPLATES: { match: RegExp; label: string; keys: string[] }[] = [
  { match: /personnage|perso|h[ée]ros/i, label: "Personnage", keys: ["Rôle", "Âge", "Origine", "Statut", "Particularité"] },
  { match: /lieu|ville|pays|r[ée]gion/i, label: "Lieu", keys: ["Type", "Région", "Climat", "Population"] },
  { match: /objet|artefact/i, label: "Objet", keys: ["Type", "Origine", "Propriétaire", "Pouvoir"] },
  { match: /univers|monde|lore|culture/i, label: "Élément de l'univers", keys: ["Catégorie", "Époque", "Description courte"] },
];

export const RELATION_TYPES = ["Ami", "Allié", "Ennemi", "Rival", "Famille", "Amant", "Mentor", "Élève", "Collègue", "Maître", "Subordonné"];
