import {
  AVISO_TURMA_SEM_INTERNOS,
  TURMAS,
  turmaTemAlunos,
  type Turma,
} from "@/lib/turmas";

type TurmasEscolarizacaoProps = {
  alunosSelecionados: string[];
  onAlternarTurma: (alunos: readonly string[]) => void;
  onAlternarAluno: (aluno: string) => void;
  onTurmaVazia: (turma: Turma) => void;
};

export function TurmasEscolarizacao({
  alunosSelecionados,
  onAlternarTurma,
  onAlternarAluno,
  onTurmaVazia,
}: TurmasEscolarizacaoProps) {
  return (
    <div className="space-y-3 rounded-[10px] bg-accent-soft/60 p-3 ring-1 ring-accent/15">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
        Turmas de escolarização
      </p>
      <p className="text-[11px] text-ink">
        Selecione a turma inteira ou apenas alunos específicos.
      </p>
      <div className="space-y-3">
        {TURMAS.map((turma) => {
          const vazia = !turmaTemAlunos(turma);
          const completa =
            !vazia && turma.alunos.every((aluno) => alunosSelecionados.includes(aluno));
          const parcial = turma.alunos.some((aluno) => alunosSelecionados.includes(aluno));

          return (
            <fieldset
              key={turma.id}
              className="rounded-[8px] bg-white/70 p-3 ring-1 ring-line"
            >
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={completa}
                  disabled={vazia}
                  ref={(el) => {
                    if (el) el.indeterminate = !vazia && parcial && !completa;
                  }}
                  onChange={() => {
                    if (vazia) {
                      onTurmaVazia(turma);
                      return;
                    }
                    onAlternarTurma(turma.alunos);
                  }}
                  className="size-3.5 accent-accent disabled:cursor-not-allowed disabled:opacity-50"
                />
                <span className="text-xs font-semibold text-ink">{turma.nome}</span>
              </label>
              <div className="mt-2 space-y-1.5 pl-5">
                {vazia ? (
                  <p className="text-[11px] text-ink/70">{AVISO_TURMA_SEM_INTERNOS}</p>
                ) : (
                  turma.alunos.map((aluno) => (
                    <label
                      key={aluno}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        checked={alunosSelecionados.includes(aluno)}
                        onChange={() => onAlternarAluno(aluno)}
                        className="size-3.5 accent-accent"
                      />
                      <span className="text-xs text-ink">{aluno}</span>
                    </label>
                  ))
                )}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
