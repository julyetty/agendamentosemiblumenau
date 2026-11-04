export const TIPOS = [
  "Social",
  "Escolarização",
  "Oficina",
  "Palestra",
  "Pedagógico",
  "Psicológico",
  "Religioso",
  "Saúde",
  "Videochamada",
  "Visita presencial",
  "Audiência",
  "Manutenção",
] as const;

export type Tipo = (typeof TIPOS)[number];

export const LOCAIS = [
  "Sala de aula 01",
  "Sala de aula 02",
  "Sala ao lado da monitoria",
  "Corredor alojamentos",
  "Enfermaria",
  "Hall central",
  "Saída para UBS",
  "Sala de audiência",
  "Refeitório",
  "Sala de atendimento técnico",
] as const;

export type Local = (typeof LOCAIS)[number];

export const TONE: Record<Tipo, string> = {
  Social: "bg-act-assistencia",
  Escolarização: "bg-act-escolarizacao",
  Oficina: "bg-act-oficina",
  Palestra: "bg-act-palestra",
  Pedagógico: "bg-act-pedagogico",
  Psicológico: "bg-act-psicologico",
  Religioso: "bg-act-religioso",
  Saúde: "bg-act-saude",
  Videochamada: "bg-act-video",
  "Visita presencial": "bg-act-visita",
  Audiência: "bg-act-audiencia",
  Manutenção: "bg-act-manutencao",
};

export function asTipo(valor: string | null): Tipo {
  return (TIPOS as readonly string[]).includes(valor ?? "")
    ? (valor as Tipo)
    : "Psicológico";
}

export function asLocal(valor: string | null): Local {
  return (LOCAIS as readonly string[]).includes(valor ?? "")
    ? (valor as Local)
    : "Hall central";
}