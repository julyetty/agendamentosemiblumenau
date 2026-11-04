export type Turma = {
  id: string;
  nome: string;
  alunos: readonly string[];
};

export const TURMAS: readonly Turma[] = [
  {
    id: "1",
    nome: "Turma 1",
    alunos: ["Renan Valmor Floriano", "Luiz Gabriel dos Santos Veiga", "Kaue Martins dos Santos"],
  },
  {
    id: "2",
    nome: "Turma 2",
    alunos: ["João Vitor Nascimento dos Santos", "Keider Jahaziel Sanchez Garcia"],
  },
  {
    id: "3",
    nome: "Turma 3",
    alunos: ["Victor Junior dos Santos Pereira"],
  },
  {
    id: "4",
    nome: "Turma 4",
    alunos: ["Paulo Alexandre de Paz Blaz", "Cristyan Felipe Agostini", "Felipe Rafael Velasquez Boliva", "João Vitor Gomes da Silva"],
  },
];

export const AVISO_TURMA_SEM_INTERNOS =
  "A turma selecionada não possui internos vinculados no momento.";

export function turmaDoAluno(nome: string) {
  const aluno = nome.trim();
  if (!aluno) return undefined;
  return TURMAS.find((turma) => turma.alunos.includes(aluno))?.nome;
}

export function turmaTemAlunos(turma: Turma) {
  return turma.alunos.length > 0;
}

export function alunosVinculados(nomes: readonly string[]) {
  return nomes.filter((nome) => nome.trim() !== "" && turmaDoAluno(nome));
}